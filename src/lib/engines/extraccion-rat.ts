import "server-only";
import { prisma } from "@/lib/db";
import { urlFirmadaEvidencia } from "@/lib/storage";
import { CAMPOS_RAT } from "@/lib/rat";

// Propuesta de actividades de tratamiento a partir de lo que el cliente ya entregó.
//
// Dos reglas gobiernan este motor, y las dos son de oficio antes que técnicas:
//
//   1. **Propone, no decide.** Lo que sale de aquí son sugerencias con su cita de
//      respaldo. Nada se escribe en el RAT sin que una persona lo confirme. Un RAT es
//      un registro legal: que un modelo escriba "base legal: consentimiento" y nadie lo
//      verifique es exactamente lo que no puede pasar.
//   2. **No inventa.** Si algo no está dicho en la fuente, el campo vuelve vacío. Es
//      preferible un registro con huecos —que se ven y se llenan— que uno completo con
//      supuestos, porque el segundo se firma sin que nadie note el invento.
//
// Lee dos fuentes: los documentos cargados en el dominio del RAT y los comentarios que
// los participantes escribieron al responderlo. Hoy la segunda es la que tiene material.

const MODELO = "gemini-2.5-flash";
const MAX_DOCUMENTOS = 6;
const MAX_MB_POR_DOCUMENTO = 15;

export type CampoPropuesto = { valor: string; cita: string };

export type ActividadPropuesta = {
  nombre: string;
  area: string | null;
  finalidad?: CampoPropuesto;
  categoriasTitulares?: CampoPropuesto;
  categoriasDatos?: CampoPropuesto;
  baseLegal?: CampoPropuesto;
  origen?: CampoPropuesto;
  destinatarios?: CampoPropuesto;
  encargados?: CampoPropuesto;
  sistemas?: CampoPropuesto;
  plazoConservacion?: CampoPropuesto;
  medidasSeguridad?: CampoPropuesto;
  datosSensibles: boolean;
  transferenciaInternacional: boolean;
};

export type ResultadoExtraccion = {
  ok: boolean;
  error?: string;
  actividades: ActividadPropuesta[];
  fuentes: { documentos: number; comentarios: number };
};

/** Lo que se le manda al modelo, con su procedencia, para poder citarlo después. */
type Fuente = { etiqueta: string; texto: string };

async function comentariosDelDominio(diagnosticoId: string, orden: number): Promise<Fuente[]> {
  const dd = await prisma.diagnosticoDominio.findFirst({
    where: { diagnosticoId, dominio: { orden } },
    select: {
      respuestas: {
        orderBy: { pregunta: { orden: "asc" } },
        select: {
          pregunta: { select: { orden: true, texto: true } },
          aportes: {
            select: { comentario: true, user: { select: { nombre: true, cargo: true } } },
          },
        },
      },
    },
  });
  if (!dd) return [];

  const fuentes: Fuente[] = [];
  for (const r of dd.respuestas) {
    for (const a of r.aportes) {
      if (!a.comentario?.trim()) continue;
      fuentes.push({
        etiqueta: `${a.user.nombre}${a.user.cargo ? ` (${a.user.cargo})` : ""} — pregunta ${r.pregunta.orden}`,
        texto: `Pregunta: ${r.pregunta.texto}\nRespondió: ${a.comentario.trim()}`,
      });
    }
  }
  return fuentes;
}

async function documentosDelDominio(diagnosticoId: string, orden: number) {
  return prisma.evidencia.findMany({
    where: {
      archivoPath: { not: null },
      respuesta: { diagnosticoDominio: { diagnosticoId, dominio: { orden } } },
    },
    select: { nombre: true, archivoPath: true, mimeType: true, tamano: true },
    take: MAX_DOCUMENTOS,
  });
}

const INSTRUCCIONES = `Eres un consultor experto en la Ley 21.719 de protección de datos de Chile, ayudando a construir el Registro de Actividades de Tratamiento (RAT) de una empresa.

Tu tarea: leer el material entregado por la empresa y proponer las ACTIVIDADES DE TRATAMIENTO que se desprenden de él.

Una actividad de tratamiento es una operación concreta con datos personales: "reclutamiento y selección", "ficha de cliente en el CRM", "pago de remuneraciones". No es un sistema ni un área.

REGLAS QUE NO PUEDES ROMPER:

1. NO INVENTES. Solo puedes afirmar lo que el material dice. Si la finalidad, la base legal o el plazo de conservación no aparecen, OMITE ese campo. Un campo omitido es correcto; un campo inventado hace que un registro legal diga algo falso.
2. CITA SIEMPRE. Cada campo que propongas debe venir con la frase textual del material de donde lo sacaste, en "cita". Si no puedes citar, no lo propongas.
3. NO DEDUZCAS BASE LEGAL. La base legal solo se propone si el material la menciona explícitamente (un contrato, un consentimiento firmado, una obligación legal). Deducirla del contexto es una opinión jurídica y no te corresponde.
4. Si el material dice que algo NO existe o NO está controlado, eso NO es una actividad de tratamiento: es una brecha. No la registres como actividad.

Devuelve SOLO un JSON válido con esta forma, sin texto alrededor ni markdown:

{"actividades":[{"nombre":"...","area":"... o null","datosSensibles":false,"transferenciaInternacional":false,"finalidad":{"valor":"...","cita":"..."},"categoriasTitulares":{"valor":"...","cita":"..."},"categoriasDatos":{"valor":"...","cita":"..."},"baseLegal":{"valor":"...","cita":"..."},"origen":{"valor":"...","cita":"..."},"destinatarios":{"valor":"...","cita":"..."},"encargados":{"valor":"...","cita":"..."},"sistemas":{"valor":"...","cita":"..."},"plazoConservacion":{"valor":"...","cita":"..."},"medidasSeguridad":{"valor":"...","cita":"..."}}]}

Omite por completo las claves de los campos que no puedas sustentar. "datosSensibles" y "transferenciaInternacional" son obligatorias: ponlas en false salvo que el material diga lo contrario.`;

function limpiarJson(texto: string): string {
  // El modelo a veces envuelve el JSON en un bloque de código pese a pedírselo.
  const sinCerca = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const ini = sinCerca.indexOf("{");
  const fin = sinCerca.lastIndexOf("}");
  return ini >= 0 && fin > ini ? sinCerca.slice(ini, fin + 1) : sinCerca;
}

/**
 * Interpreta la respuesta aunque venga imperfecta.
 *
 * Una generación mal cerrada no puede costar el análisis entero: si el JSON no parsea,
 * se rescatan las actividades completas que alcanzaron a salir y se descarta la que
 * quedó a medias. Es preferible entregar seis propuestas revisables que ninguna.
 */
function interpretar(texto: string): ActividadPropuesta[] {
  const limpio = limpiarJson(texto);
  try {
    return (JSON.parse(limpio) as { actividades?: ActividadPropuesta[] }).actividades ?? [];
  } catch {
    // Se recortan objetos desde el final hasta que el conjunto vuelva a ser válido.
    let corte = limpio.lastIndexOf("},{");
    while (corte > 0) {
      try {
        const datos = JSON.parse(limpio.slice(0, corte + 1) + "]}") as {
          actividades?: ActividadPropuesta[];
        };
        if (datos.actividades?.length) return datos.actividades;
      } catch {
        /* se sigue recortando */
      }
      corte = limpio.lastIndexOf("},{", corte - 1);
    }
    return [];
  }
}

/**
 * Analiza el material del dominio indicado y propone actividades de tratamiento.
 *
 * Sale información de la empresa hacia el proveedor del modelo. La decisión de habilitarlo
 * es contractual y la toma Procesos360 con su cliente; aquí solo se ejecuta.
 */
export async function proponerActividades(
  diagnosticoId: string,
  ordenDominio = 2
): Promise<ResultadoExtraccion> {
  const vacio = { actividades: [], fuentes: { documentos: 0, comentarios: 0 } };
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "El análisis no está configurado en el servidor.", ...vacio };
  }

  const [comentarios, documentos] = await Promise.all([
    comentariosDelDominio(diagnosticoId, ordenDominio),
    documentosDelDominio(diagnosticoId, ordenDominio),
  ]);

  // Solo PDF e imágenes: los formatos de Office no los ingiere la API, y mandarlos
  // produce un error opaco en vez de un aviso entendible.
  const legibles = documentos.filter(
    (d) =>
      (d.mimeType === "application/pdf" || d.mimeType?.startsWith("image/")) &&
      (d.tamano ?? 0) <= MAX_MB_POR_DOCUMENTO * 1024 * 1024
  );

  if (comentarios.length === 0 && legibles.length === 0) {
    return {
      ok: false,
      error:
        "No hay material que analizar en este dominio: ni documentos legibles (PDF o imagen) ni comentarios en las respuestas.",
      ...vacio,
    };
  }

  const partes: Record<string, unknown>[] = [];

  if (comentarios.length > 0) {
    partes.push({
      text:
        "MATERIAL 1 — Lo que los participantes escribieron al responder el cuestionario:\n\n" +
        comentarios.map((f) => `[${f.etiqueta}]\n${f.texto}`).join("\n\n"),
    });
  }

  for (const d of legibles) {
    try {
      const url = await urlFirmadaEvidencia(d.archivoPath!, 300);
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      partes.push({ text: `MATERIAL 2 — Documento entregado por la empresa: "${d.nombre}"` });
      partes.push({
        inlineData: { mimeType: d.mimeType ?? "application/pdf", data: buf.toString("base64") },
      });
    } catch {
      // Un documento que no se puede leer no detiene el análisis del resto.
    }
  }

  partes.push({
    text: `Campos posibles del RAT: ${CAMPOS_RAT.map((c) => `${c.clave} (${c.etiqueta})`).join(", ")}.`,
  });

  let respuesta: Response;
  try {
    respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
          contents: [{ role: "user", parts: partes }],
          generationConfig: {
            // Temperatura baja: aquí no se quiere creatividad, se quiere fidelidad.
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );
  } catch {
    return { ok: false, error: "No se pudo contactar el servicio de análisis.", ...vacio };
  }

  if (!respuesta.ok) {
    const detalle = respuesta.status === 429 ? "demasiadas consultas seguidas" : `error ${respuesta.status}`;
    return { ok: false, error: `El análisis no respondió (${detalle}).`, ...vacio };
  }

  const cuerpo = await respuesta.json().catch(() => null);
  const texto: string =
    cuerpo?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!texto.trim()) {
    return { ok: false, error: "El análisis no devolvió resultados.", ...vacio };
  }

  const crudas = interpretar(texto);
  if (crudas.length === 0) {
    return { ok: false, error: "El análisis devolvió una respuesta que no se pudo leer.", ...vacio };
  }

  const actividades = crudas
    // Sin nombre no es una actividad, y sin cita no es verificable: ambas se descartan.
    .filter((a) => a?.nombre?.trim())
    .map((a) => ({
      ...a,
      nombre: a.nombre.trim(),
      datosSensibles: Boolean(a.datosSensibles),
      transferenciaInternacional: Boolean(a.transferenciaInternacional),
    }));

  return {
    ok: true,
    actividades,
    fuentes: { documentos: legibles.length, comentarios: comentarios.length },
  };
}
