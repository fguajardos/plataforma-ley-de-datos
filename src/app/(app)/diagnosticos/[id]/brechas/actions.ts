"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { generarBrechas, type RespuestaBrechaInput } from "@/lib/engines/brechas";

export type GenerarBrechasResult = { ok: boolean; count?: number; error?: string };

export async function generarBrechasAction(diagnosticoId: string): Promise<GenerarBrechasResult> {
  const session = await requireSession();
  if (session.user.role === ROLES.RESPONSABLE_DOMINIO) {
    return { ok: false, error: "No tienes permiso para esta accion. Tu rol solo responde el cuestionario de sus dominios asignados." };
  }

  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: { id: true, empresaId: true },
  });
  if (!diag) return { ok: false, error: "Diagnóstico no encontrado." };
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }

  const dds = await prisma.diagnosticoDominio.findMany({
    where: { diagnosticoId, incluido: true },
    include: {
      dominio: { select: { orden: true, nombre: true } },
      respuestas: { include: { pregunta: true, evidencias: { select: { id: true } } } },
    },
  });

  const inputs: RespuestaBrechaInput[] = dds.flatMap((dd) =>
    dd.respuestas
      .filter((r) => r.valor != null) // sólo respuestas contestadas
      .map((r) => ({
        respuestaId: r.id,
        valor: r.valor,
        comentario: r.comentario,
        tieneEvidencia: r.evidencias.length > 0,
        pregunta: {
          orden: r.pregunta.orden,
          texto: r.pregunta.texto,
          evidenciaObligatoria: r.pregunta.evidenciaObligatoria,
        },
        dominio: { orden: dd.dominio.orden, nombre: dd.dominio.nombre },
      }))
  );

  const brechas = generarBrechas(inputs);

  // Reemplazar las brechas existentes del diagnóstico.
  await prisma.brecha.deleteMany({ where: { diagnosticoId } });
  if (brechas.length > 0) {
    await prisma.brecha.createMany({
      data: brechas.map((b) => ({
        diagnosticoId,
        respuestaId: b.respuestaId,
        codigo: b.codigo,
        descripcion: b.descripcion,
        tipo: b.tipo,
        criticidad: b.criticidad,
        accionRecomendada: b.accionRecomendada,
        evidenciaEsperada: b.evidenciaEsperada,
      })),
    });
  }

  await prisma.diagnostico.update({
    where: { id: diagnosticoId },
    data: { estado: "CON_BRECHAS" },
  });

  revalidatePath(`/diagnosticos/${diagnosticoId}/brechas`);
  revalidatePath(`/diagnosticos/${diagnosticoId}`);
  return { ok: true, count: brechas.length };
}
