import "server-only";
import { prisma } from "@/lib/db";
import { urlFirmadaEvidencia } from "@/lib/storage";
import { CAMPOS_RAT } from "@/lib/rat";
import { esOfficeLegible, extraerTexto } from "@/lib/engines/texto-documento";

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
// Lee TODO el levantamiento, no solo el dominio del RAT. Cuatro dominios aportan campos
// que ese no puede dar por sí solo —bases legales el 3, medidas de seguridad el 5,
// encargados y destinatarios el 7, plazos de conservación el 9— y el material completo
// son unos 1.500 tokens: leerlo entero cuesta menos que perder esos campos.

const MODELO = "gemini-2.5-flash";
// Los documentos pesan de verdad y viajan en base64: cuatro es lo que cabe sin arriesgar
// que la petición se caiga por tiempo. Los comentarios, en cambio, entran todos.
const MAX_DOCUMENTOS = 4;
const MAX_MB_POR_DOCUMENTO = 8;

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
  fuentes: { documentos: number; comentarios: number; fichas: number };
};

/** Lo que se le manda al modelo, con su procedencia, para poder citarlo después. */
type Fuente = { etiqueta: string; texto: string };

async function comentariosDelDiagnostico(diagnosticoId: string): Promise<Fuente[]> {
  const dds = await prisma.diagnosticoDominio.findMany({
    where: { diagnosticoId, incluido: true },
    orderBy: { dominio: { orden: "asc" } },
    select: {
      dominio: { select: { orden: true, nombre: true } },
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

  const fuentes: Fuente[] = [];
  for (const dd of dds) {
    for (const r of dd.respuestas) {
      for (const a of r.aportes) {
        if (!a.comentario?.trim()) continue;
        fuentes.push({
          // El dominio va en la etiqueta porque le dice al modelo qué está leyendo: lo
          // dicho en "Gestión de Terceros" habla de encargados, y lo de "Retención", de
          // plazos. Sin eso, todo se lee como si fuera del mismo tema.
          etiqueta: `Dominio ${dd.dominio.orden} (${dd.dominio.nombre}) · ${a.user.nombre}${a.user.cargo ? ` — ${a.user.cargo}` : ""}`,
          texto: `Pregunta: ${r.pregunta.texto}\nRespondió: ${a.comentario.trim()}`,
        });
      }
    }
  }
  return fuentes;
}

/**
 * Fichas de proceso levantadas por el equipo consultor.
 *
 * Son la mejor fuente de las tres. Una evidencia prueba un control y un comentario cuenta
 * una impresión, pero una ficha describe el proceso: qué se hace, con qué datos, quién
 * los toca y a dónde van. Es literalmente la materia prima de una actividad de
 * tratamiento, y por eso entra primero.
 */
async function fichasDeLaEmpresa(empresaId: string) {
  return prisma.fichaProceso.findMany({
    where: { empresaId, archivoPath: { not: null } },
    select: {
      nombre: true,
      descripcion: true,
      archivoPath: true,
      mimeType: true,
      tamano: true,
      area: { select: { nombre: true } },
    },
    orderBy: { tamano: "asc" },
    take: MAX_DOCUMENTOS * 3,
  });
}

async function documentosDelDiagnostico(diagnosticoId: string) {
  return prisma.evidencia.findMany({
    where: {
      archivoPath: { not: null },
      respuesta: { diagnosticoDominio: { diagnosticoId } },
    },
    select: { nombre: true, archivoPath: true, mimeType: true, tamano: true },
    // Los más livianos primero: caben más antes de topar el límite, y un PDF corto suele
    // ser una política concreta y no un manual entero.
    orderBy: { tamano: "asc" },
    take: MAX_DOCUMENTOS * 3,
  });
}

const INSTRUCCIONES = `Eres un consultor experto en la Ley 21.719 de protección de datos de Chile, ayudando a construir el Registro de Actividades de Tratamiento (RAT) de una empresa.

Tu tarea: leer el material entregado por la empresa y proponer las ACTIVIDADES DE TRATAMIENTO que se desprenden de él.

Una actividad de tratamiento es una operación concreta con datos personales: "reclutamiento y selección", "ficha de cliente en el CRM", "pago de remuneraciones". No es un sistema ni un área.

El material viene de un cuestionario de 10 dominios y cada respuesta trae anotado de cuál. Úsalo: el dominio 2 habla del inventario de tratamientos, el 3 de bases legales y consentimiento, el 5 de medidas de seguridad, el 7 de encargados y terceros, el 9 de plazos de conservación. Cruza lo dicho en dominios distintos cuando se refiera a la misma actividad —la finalidad puede venir del dominio 2 y su plazo de conservación del 9— y cita siempre la frase del dominio de donde sacaste cada campo.

Cuando haya fichas de proceso levantadas por el equipo consultor, son la fuente más fiable: describen cómo opera el proceso de verdad. Un comentario del cuestionario es una impresión de una persona; una ficha es trabajo de campo. Si se contradicen, quédate con la ficha y dilo en la cita.

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
  diagnosticoId: string
): Promise<ResultadoExtraccion> {
  const vacio = { actividades: [], fuentes: { documentos: 0, comentarios: 0, fichas: 0 } };
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "El análisis no está configurado en el servidor.", ...vacio };
  }

  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: { empresaId: true },
  });
  if (!diag) return { ok: false, error: "Diagnóstico no encontrado.", ...vacio };

  const [comentarios, documentos, fichas] = await Promise.all([
    comentariosDelDiagnostico(diagnosticoId),
    documentosDelDiagnostico(diagnosticoId),
    fichasDeLaEmpresa(diag.empresaId),
  ]);

  // Solo PDF e imágenes: los formatos de Office no los ingiere la API, y mandarlos
  // produce un error opaco en vez de un aviso entendible.
  // PDF e imágenes viajan tal cual; Word y Excel se convierten a texto antes de salir.
  const seLee = (m: string | null, tam: number | null) =>
    (m === "application/pdf" || Boolean(m?.startsWith("image/")) || esOfficeLegible(m)) &&
    (tam ?? 0) <= MAX_MB_POR_DOCUMENTO * 1024 * 1024;

  /**
   * Convierte un archivo en las partes que entiende el modelo.
   *
   * Un Office se manda como texto extraído en el servidor; un PDF o una imagen, como
   * archivo, porque ahí el modelo lee mejor que cualquier extractor —incluidos los
   * escaneados, que no tienen texto que sacar—.
   */
  async function comoPartes(
    encabezado: string,
    ruta: string,
    mimeType: string | null
  ): Promise<Record<string, unknown>[]> {
    const url = await urlFirmadaEvidencia(ruta, 300);
    const res = await fetch(url);
    if (!res.ok) return [];
    const buf = Buffer.from(await res.arrayBuffer());

    if (esOfficeLegible(mimeType)) {
      const ex = await extraerTexto(buf, mimeType);
      if (!ex.ok) return [];
      return [
        {
          text:
            `${encabezado}\n${ex.texto}` +
            (ex.truncado ? "\n[…documento recortado por extensión]" : ""),
        },
      ];
    }
    return [
      { text: encabezado },
      { inlineData: { mimeType: mimeType ?? "application/pdf", data: buf.toString("base64") } },
    ];
  }

  // Las fichas tienen prioridad sobre las evidencias: describen el proceso, que es lo que
  // se está buscando. Las evidencias entran con lo que sobre del cupo.
  const fichasLegibles = fichas.filter((f) => seLee(f.mimeType, f.tamano)).slice(0, MAX_DOCUMENTOS);
  const legibles = documentos
    .filter((d) => seLee(d.mimeType, d.tamano))
    .slice(0, Math.max(0, MAX_DOCUMENTOS - fichasLegibles.length));

  if (comentarios.length === 0 && legibles.length === 0 && fichasLegibles.length === 0) {
    return {
      ok: false,
      error:
        "No hay material que analizar: ni documentos legibles (PDF, imagen, Word o Excel) ni comentarios en las respuestas del levantamiento.",
      ...vacio,
    };
  }

  const partes: Record<string, unknown>[] = [];

  if (comentarios.length > 0) {
    partes.push({
      text:
        "MATERIAL 1 — Lo que los participantes escribieron al responder el cuestionario de los 10 dominios:\n\n" +
        comentarios.map((f) => `[${f.etiqueta}]\n${f.texto}`).join("\n\n"),
    });
  }

  for (const f of fichasLegibles) {
    try {
      const encabezado =
        `MATERIAL 2 — Ficha de proceso levantada por el equipo consultor: "${f.nombre}"` +
        (f.area ? ` · área ${f.area.nombre}` : "") +
        (f.descripcion ? `
${f.descripcion}` : "");
      partes.push(...(await comoPartes(encabezado, f.archivoPath!, f.mimeType)));
    } catch {
      // Una ficha ilegible no detiene el análisis del resto.
    }
  }

  for (const d of legibles) {
    try {
      partes.push(
        ...(await comoPartes(
          `MATERIAL 3 — Documento entregado por la empresa: "${d.nombre}"`,
          d.archivoPath!,
          d.mimeType
        ))
      );
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
            // El razonamiento interno del modelo se descuenta de este mismo presupuesto:
            // con el material de los diez dominios se lo comía entero y el JSON llegaba
            // cortado a la mitad. Se apaga y se sube el techo.
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 16384,
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
    fuentes: {
      documentos: legibles.length,
      comentarios: comentarios.length,
      fichas: fichasLegibles.length,
    },
  };
}
