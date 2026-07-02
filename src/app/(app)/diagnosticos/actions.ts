"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { assertAccesoDiagnostico } from "@/lib/data/diagnosticos";
import { TIPO_DIAGNOSTICO, ESTADO_DIAGNOSTICO } from "@/lib/constants";

export type CrearResult = { ok: boolean; id?: string; error?: string };
export type ConfigResult = { ok: boolean; error?: string };

const crearSchema = z.object({
  empresaId: z.string().min(1),
  nombre: z.string().min(3).max(200),
  tipo: z.enum(Object.keys(TIPO_DIAGNOSTICO) as [string, ...string[]]),
  fechaInicio: z.string().optional().default(""),
  fechaCierre: z.string().optional().default(""),
  consultorId: z.string().optional().default(""),
});

/** Crea un diagnóstico con sus 10 dominios y respuestas pendientes. */
export async function crearDiagnosticoAction(input: z.input<typeof crearSchema>): Promise<CrearResult> {
  const session = await requireSession();
  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { empresaId, nombre, tipo, fechaInicio, fechaCierre, consultorId } = parsed.data;

  // Acceso: staff P360 crea para cualquier empresa; ADMIN_EMPRESA solo la suya.
  if (!esStaffP360(session.user.role) && empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso a esa empresa." };
  }

  const dominios = await prisma.dominio.findMany({
    orderBy: { orden: "asc" },
    include: { preguntas: { select: { id: true } } },
  });
  if (dominios.length === 0) return { ok: false, error: "No hay catálogo de dominios." };

  const diag = await prisma.diagnostico.create({
    data: {
      empresaId,
      nombre,
      tipo,
      estado: "BORRADOR",
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
      consultorId: consultorId || null,
    },
  });

  for (const d of dominios) {
    const dd = await prisma.diagnosticoDominio.create({
      data: { diagnosticoId: diag.id, dominioId: d.id, estado: "PENDIENTE" },
    });
    if (d.preguntas.length > 0) {
      await prisma.respuesta.createMany({
        data: d.preguntas.map((p) => ({
          diagnosticoDominioId: dd.id,
          preguntaId: p.id,
          estado: "PENDIENTE",
        })),
      });
    }
  }

  revalidatePath("/diagnosticos");
  return { ok: true, id: diag.id };
}

const configSchema = z.object({
  diagnosticoId: z.string().min(1),
  nombre: z.string().min(3).max(200).optional(),
  tipo: z.enum(Object.keys(TIPO_DIAGNOSTICO) as [string, ...string[]]).optional(),
  fechaInicio: z.string().optional(),
  fechaCierre: z.string().optional(),
  consultorId: z.string().optional(),
  dominios: z.array(
    z.object({
      diagnosticoDominioId: z.string().min(1),
      incluido: z.boolean(),
      responsableId: z.string().optional().default(""),
      areaId: z.string().optional().default(""),
      justificacionNoAplica: z.string().max(1000).optional().default(""),
    })
  ),
});

/** Configura el alcance del diagnóstico: dominios incluidos, responsables y áreas. */
export async function configurarDiagnosticoAction(input: z.input<typeof configSchema>): Promise<ConfigResult> {
  const session = await requireSession();
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const data = parsed.data;

  const diag = await assertAccesoDiagnostico(data.diagnosticoId, session);
  if (!diag) return { ok: false, error: "Sin acceso al diagnóstico." };

  await prisma.diagnostico.update({
    where: { id: data.diagnosticoId },
    data: {
      ...(data.nombre ? { nombre: data.nombre } : {}),
      ...(data.tipo ? { tipo: data.tipo } : {}),
      ...(data.fechaInicio !== undefined ? { fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : null } : {}),
      ...(data.fechaCierre !== undefined ? { fechaCierre: data.fechaCierre ? new Date(data.fechaCierre) : null } : {}),
      ...(data.consultorId !== undefined ? { consultorId: data.consultorId || null } : {}),
      estado: diag.estado === "BORRADOR" ? "CONFIGURADO" : diag.estado,
    },
  });

  for (const d of data.dominios) {
    await prisma.diagnosticoDominio.update({
      where: { id: d.diagnosticoDominioId },
      data: {
        incluido: d.incluido,
        responsableId: d.responsableId || null,
        areaId: d.areaId || null,
        justificacionNoAplica: d.justificacionNoAplica.trim() || null,
      },
    });
  }

  revalidatePath(`/diagnosticos/${data.diagnosticoId}`);
  revalidatePath(`/diagnosticos/${data.diagnosticoId}/configurar`);
  return { ok: true };
}

/** Cambia el estado del diagnóstico (avance del flujo). */
export async function cambiarEstadoAction(
  diagnosticoId: string,
  estado: keyof typeof ESTADO_DIAGNOSTICO
): Promise<ConfigResult> {
  const session = await requireSession();
  const diag = await assertAccesoDiagnostico(diagnosticoId, session);
  if (!diag) return { ok: false, error: "Sin acceso al diagnóstico." };
  if (!(estado in ESTADO_DIAGNOSTICO)) return { ok: false, error: "Estado inválido." };

  await prisma.diagnostico.update({ where: { id: diagnosticoId }, data: { estado } });
  revalidatePath(`/diagnosticos/${diagnosticoId}`);
  return { ok: true };
}
