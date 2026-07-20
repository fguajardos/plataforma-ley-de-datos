"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
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
  // El Responsable de Dominio solo responde los dominios que tiene asignados.
  if (
    session.user.role === ROLES.RESPONSABLE_DOMINIO &&
    respuesta.diagnosticoDominio.responsableId !== session.user.id
  ) {
    return { ok: false, error: "Este dominio no está asignado a ti." };
  }

  // Regla: comentario obligatorio para 0, 1, 2, N/A u Otro.
  if (requiereComentario(valor) && !comentario.trim()) {
    return { ok: false, error: "El comentario es obligatorio para esta respuesta." };
  }

  await prisma.respuesta.update({
    where: { id: respuestaId },
    data: {
      valor,
      comentario: comentario.trim() || null,
      riesgoIdentificado: riesgoIdentificado.trim() || null,
      estado: "RESPONDIDA",
      respondidoPorId: session.user.id,
    },
  });

  // Marcar el dominio en ejecución.
  await prisma.diagnosticoDominio.update({
    where: { id: respuesta.diagnosticoDominioId },
    data: { estado: "EN_EJECUCION" },
  });

  revalidatePath(
    `/diagnosticos/${diag.id}/dominios/${respuesta.diagnosticoDominio.dominio.orden}`
  );
  revalidatePath(`/diagnosticos/${diag.id}`);
  return { ok: true };
}
