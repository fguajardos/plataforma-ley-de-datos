"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { esParticipanteDominio } from "@/lib/data/diagnosticos";
import { requiereComentario, ROLES, VALORES } from "@/lib/constants";

const schema = z.object({
  respuestaId: z.string().min(1),
  valor: z.enum(VALORES),
  comentario: z.string().max(2000).optional().default(""),
  riesgoIdentificado: z.string().max(1000).optional().default(""),
});

export type RespuestaResult = { ok: boolean; error?: string };

export async function guardarRespuesta(input: z.input<typeof schema>): Promise<RespuestaResult> {
  const session = await requireSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { respuestaId, valor, comentario, riesgoIdentificado } = parsed.data;

  // Cargar respuesta + cadena hacia el diagnóstico para control de acceso.
  const respuesta = await prisma.respuesta.findUnique({
    where: { id: respuestaId },
    include: {
      diagnosticoDominio: {
        include: { diagnostico: { select: { id: true, empresaId: true } }, dominio: { select: { orden: true } } },
      },
    },
  });
  if (!respuesta) return { ok: false, error: "Respuesta no encontrada." };

  const diag = respuesta.diagnosticoDominio.diagnostico;
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }
  // El Responsable de Dominio solo responde los dominios en los que participa.
  if (
    session.user.role === ROLES.RESPONSABLE_DOMINIO &&
    !(await esParticipanteDominio(respuesta.diagnosticoDominio.id, session.user.id))
  ) {
    return { ok: false, error: "Este dominio no está asignado a ti." };
  }

  // Ya enviado a validación: solo se reabre lo que el consultor observó (§6.6).
  const dominioBloqueado = ["EN_VALIDACION", "COMPLETADO"].includes(
    respuesta.diagnosticoDominio.estado
  );
  if (dominioBloqueado && respuesta.estado !== "OBSERVADA") {
    return { ok: false, error: "El dominio ya fue enviado a validación." };
  }

  // El guardado es automático, así que acepta borradores incompletos: nunca se pierde
  // lo avanzado. La regla del §7.5 (comentario obligatorio en 0/1/2/N-A/Otro) se exige
  // al ENVIAR el dominio; aquí solo determina si la respuesta ya está completa.
  const completa = !requiereComentario(valor) || Boolean(comentario.trim());

  await prisma.respuesta.update({
    where: { id: respuestaId },
    data: {
      valor,
      comentario: comentario.trim() || null,
      riesgoIdentificado: riesgoIdentificado.trim() || null,
      // Una respuesta observada por el consultor vuelve a "respondida" al corregirse.
      estado: completa ? "RESPONDIDA" : "PENDIENTE",
      respondidoPorId: session.user.id,
    },
  });

  // Marcar el dominio en ejecución (si no venía de una corrección post-validación).
  if (!dominioBloqueado) {
    await prisma.diagnosticoDominio.update({
      where: { id: respuesta.diagnosticoDominioId },
      data: { estado: "EN_EJECUCION" },
    });
  }

  revalidatePath(
    `/diagnosticos/${diag.id}/dominios/${respuesta.diagnosticoDominio.dominio.orden}`
  );
  revalidatePath(`/diagnosticos/${diag.id}`);
  return { ok: true };
}

// ───────────────────────── Envío del dominio a validación ─────────────────────────

export type Faltante = { orden: number; motivo: string };
export type EnvioResult = { ok: boolean; error?: string; faltantes?: Faltante[] };

/**
 * Cierra el cuestionario del dominio y lo deja en manos del consultor.
 * Aquí se exigen las reglas del §7.5: toda pregunta respondida, comentario obligatorio
 * en 0/1/2/N-A/Otro, y evidencia cargada donde la pregunta la exige.
 */
export async function enviarDominio(diagnosticoDominioId: string): Promise<EnvioResult> {
  const session = await requireSession();

  const dd = await prisma.diagnosticoDominio.findUnique({
    where: { id: diagnosticoDominioId },
    include: {
      diagnostico: { select: { id: true, empresaId: true } },
      dominio: { select: { orden: true } },
      respuestas: {
        include: {
          pregunta: { select: { orden: true, evidenciaObligatoria: true } },
          evidencias: { select: { id: true, archivoPath: true } },
        },
        orderBy: { pregunta: { orden: "asc" } },
      },
    },
  });
  if (!dd) return { ok: false, error: "Dominio no encontrado." };

  if (!esStaffP360(session.user.role) && dd.diagnostico.empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }
  if (
    session.user.role === ROLES.RESPONSABLE_DOMINIO &&
    !(await esParticipanteDominio(dd.id, session.user.id))
  ) {
    return { ok: false, error: "Este dominio no está asignado a ti." };
  }
  if (["EN_VALIDACION", "COMPLETADO"].includes(dd.estado)) {
    return { ok: false, error: "Este dominio ya fue enviado a validación." };
  }

  const faltantes: Faltante[] = [];
  for (const r of dd.respuestas) {
    const orden = r.pregunta.orden;
    if (r.valor == null) {
      faltantes.push({ orden, motivo: "sin responder" });
      continue;
    }
    if (requiereComentario(r.valor) && !r.comentario?.trim()) {
      faltantes.push({ orden, motivo: "falta el comentario obligatorio" });
      continue;
    }
    if (r.pregunta.evidenciaObligatoria && !r.evidencias.some((e) => e.archivoPath)) {
      faltantes.push({ orden, motivo: "falta la evidencia obligatoria" });
    }
  }
  if (faltantes.length > 0) return { ok: false, faltantes };

  await prisma.diagnosticoDominio.update({
    where: { id: dd.id },
    data: { estado: "EN_VALIDACION" },
  });
  // El diagnóstico entra en validación en cuanto llega el primer dominio.
  await prisma.diagnostico.update({
    where: { id: dd.diagnostico.id },
    data: { estado: "EN_VALIDACION" },
  });

  revalidatePath(`/diagnosticos/${dd.diagnostico.id}/dominios/${dd.dominio.orden}`);
  revalidatePath(`/diagnosticos/${dd.diagnostico.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
