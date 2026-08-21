"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360, sinAccesoAEmpresa } from "@/lib/session";

// Cierre del ciclo de revisión: validar, observar y cerrar.
//
// El vocabulario ya estaba en el esquema (Respuesta.estado, DiagnosticoDominio.estado
// COMPLETADO) y `guardarRespuesta` ya sabía reabrir una pregunta observada aunque el
// dominio esté cerrado. Lo único que faltaba era quién disparara todo eso: hasta ahora
// un dominio entraba en validación y se quedaba ahí para siempre.
//
// Todo esto es del equipo consultor. Admin y consultor son equivalentes en la
// plataforma, así que `esStaffP360` cubre a los dos sin distinguirlos.

export type ValidacionResult = { ok: boolean; error?: string };

const observacionSchema = z.object({
  respuestaId: z.string().min(1),
  // La observación es obligatoria: el punto de observar es decir qué hay que corregir.
  observacion: z.string().trim().min(3, "Escribe qué hay que corregir.").max(1000),
});

/** Carga la respuesta con la cadena hasta el diagnóstico, para el control de acceso. */
async function contexto(respuestaId: string) {
  return prisma.respuesta.findUnique({
    where: { id: respuestaId },
    select: {
      id: true,
      valor: true,
      diagnosticoDominio: {
        select: {
          id: true,
          estado: true,
          dominio: { select: { orden: true } },
          diagnostico: { select: { id: true, empresaId: true } },
        },
      },
    },
  });
}

function revalidar(diagId: string, orden: number) {
  revalidatePath(`/diagnosticos/${diagId}/dominios/${orden}`);
  revalidatePath(`/diagnosticos/${diagId}`);
  revalidatePath(`/diagnosticos/${diagId}/seguimiento`);
}

/** Da por buena la respuesta consolidada de una pregunta. */
export async function validarRespuesta(respuestaId: string): Promise<ValidacionResult> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { ok: false, error: "Solo el equipo consultor puede validar." };
  }

  const r = await contexto(respuestaId);
  if (!r) return { ok: false, error: "Pregunta no encontrada." };
  if (sinAccesoAEmpresa(session, r.diagnosticoDominio.diagnostico.empresaId)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (r.valor == null) {
    return { ok: false, error: "No se puede validar una pregunta sin responder." };
  }

  await prisma.respuesta.update({
    where: { id: respuestaId },
    // Se limpia la observación anterior: si quedara, la pregunta se vería validada y
    // objetada a la vez, y el participante no sabría cuál de las dos rige.
    data: { estado: "VALIDADA", observacionConsultor: null },
  });

  revalidar(r.diagnosticoDominio.diagnostico.id, r.diagnosticoDominio.dominio.orden);
  return { ok: true };
}

/**
 * Devuelve una pregunta al participante con una observación.
 *
 * Es la vía formal para pedir una corrección puntual: `guardarRespuesta` deja editar
 * una pregunta OBSERVADA aunque el dominio esté en solo lectura, así que esto reabre
 * esa pregunta —y solo esa— sin devolver el dominio entero a ejecución.
 */
export async function observarRespuesta(
  input: z.input<typeof observacionSchema>
): Promise<ValidacionResult> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { ok: false, error: "Solo el equipo consultor puede observar." };
  }
  const parsed = observacionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { respuestaId, observacion } = parsed.data;

  const r = await contexto(respuestaId);
  if (!r) return { ok: false, error: "Pregunta no encontrada." };
  if (sinAccesoAEmpresa(session, r.diagnosticoDominio.diagnostico.empresaId)) {
    return { ok: false, error: "Sin acceso." };
  }

  await prisma.respuesta.update({
    where: { id: respuestaId },
    data: { estado: "OBSERVADA", observacionConsultor: observacion },
  });

  // Un dominio dado por cerrado con una pregunta objetada no está cerrado: vuelve a
  // validación, para que el tablero no lo cuente como terminado.
  if (r.diagnosticoDominio.estado === "COMPLETADO") {
    await prisma.diagnosticoDominio.update({
      where: { id: r.diagnosticoDominio.id },
      data: { estado: "EN_VALIDACION" },
    });
  }

  revalidar(r.diagnosticoDominio.diagnostico.id, r.diagnosticoDominio.dominio.orden);
  return { ok: true };
}

async function contextoDominio(diagnosticoDominioId: string) {
  return prisma.diagnosticoDominio.findUnique({
    where: { id: diagnosticoDominioId },
    select: {
      id: true,
      estado: true,
      dominio: { select: { orden: true } },
      diagnostico: { select: { id: true, empresaId: true } },
      respuestas: { select: { estado: true, valor: true, pregunta: { select: { orden: true } } } },
    },
  });
}

/** Cierra el dominio: revisado y conforme. */
export async function cerrarDominio(
  diagnosticoDominioId: string
): Promise<ValidacionResult> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { ok: false, error: "Solo el equipo consultor puede cerrar un dominio." };
  }

  const dd = await contextoDominio(diagnosticoDominioId);
  if (!dd) return { ok: false, error: "Dominio no encontrado." };
  if (sinAccesoAEmpresa(session, dd.diagnostico.empresaId)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (dd.estado === "COMPLETADO") return { ok: false, error: "Este dominio ya está cerrado." };
  if (dd.estado !== "EN_VALIDACION") {
    return { ok: false, error: "El dominio todavía no se ha enviado a validación." };
  }

  const sinResponder = dd.respuestas.filter((r) => r.valor == null).map((r) => r.pregunta.orden);
  if (sinResponder.length > 0) {
    return {
      ok: false,
      error: `Quedan preguntas sin responder: ${sinResponder.join(", ")}.`,
    };
  }
  const observadas = dd.respuestas
    .filter((r) => r.estado === "OBSERVADA")
    .map((r) => r.pregunta.orden);
  if (observadas.length > 0) {
    return {
      ok: false,
      error: `Hay observaciones sin resolver en ${
        observadas.length === 1 ? "la pregunta" : "las preguntas"
      } ${observadas.join(", ")}.`,
    };
  }

  await prisma.diagnosticoDominio.update({
    where: { id: dd.id },
    data: { estado: "COMPLETADO" },
  });

  revalidar(dd.diagnostico.id, dd.dominio.orden);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Devuelve el dominio a ejecución.
 *
 * El contrapeso de enviar: un dominio cerrado deja a sus participantes en solo lectura,
 * y cuando se cierra antes de tiempo —alguien apretó enviar mientras un colega iba por
 * la mitad— esta es la única forma de recoger lo que falta.
 */
export async function reabrirDominio(
  diagnosticoDominioId: string
): Promise<ValidacionResult> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { ok: false, error: "Solo el equipo consultor puede reabrir un dominio." };
  }

  const dd = await contextoDominio(diagnosticoDominioId);
  if (!dd) return { ok: false, error: "Dominio no encontrado." };
  if (sinAccesoAEmpresa(session, dd.diagnostico.empresaId)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (!["EN_VALIDACION", "COMPLETADO"].includes(dd.estado)) {
    return { ok: false, error: "Este dominio ya está abierto." };
  }

  await prisma.diagnosticoDominio.update({
    where: { id: dd.id },
    data: { estado: "EN_EJECUCION" },
  });

  revalidar(dd.diagnostico.id, dd.dominio.orden);
  revalidatePath("/dashboard");
  return { ok: true };
}
