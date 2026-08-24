"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, sinAccesoAEmpresa } from "@/lib/session";
import { ROLES } from "@/lib/constants";

export type RatResult = { ok: boolean; error?: string; creados?: number };

/**
 * El RAT lo llena la empresa; el consultor lo revisa. El Responsable de Dominio queda
 * fuera: su trabajo es el cuestionario de sus dominios, no el registro completo.
 */
async function permiso(empresaId: string) {
  const session = await requireSession();
  if (session.user.role === ROLES.RESPONSABLE_DOMINIO) {
    return { error: "Tu rol responde el cuestionario; el RAT lo mantiene la empresa." };
  }
  if (sinAccesoAEmpresa(session, empresaId)) return { error: "Sin acceso." };
  return { session };
}

/**
 * Arma el borrador: una actividad por cada área que declaró tratar datos y todavía no
 * tiene ninguna.
 *
 * Deja los campos vacíos a propósito. La plataforma sabe QUÉ áreas tratan datos —lo
 * declararon en el levantamiento— pero no sabe para qué, con qué base legal ni por
 * cuánto tiempo. Rellenar eso con supuestos convertiría un registro legal en una
 * conjetura, y el RAT es justamente el documento con el que la empresa responde.
 */
export async function generarBorradorRat(empresaId: string): Promise<RatResult> {
  const { error } = await permiso(empresaId);
  if (error) return { ok: false, error };

  const areas = await prisma.area.findMany({
    where: { empresaId, trataDatos: true },
    select: { id: true, nombre: true, trataDatosSensibles: true, usaSistemas: true },
    orderBy: { nombre: "asc" },
  });
  const yaTienen = new Set(
    (
      await prisma.tratamientoDato.findMany({
        where: { empresaId },
        select: { areaId: true },
      })
    )
      .map((t) => t.areaId)
      .filter(Boolean)
  );

  const nuevas = areas.filter((a) => !yaTienen.has(a.id));
  if (nuevas.length === 0) {
    return { ok: false, error: "Todas las áreas que tratan datos ya tienen al menos una actividad." };
  }

  await prisma.tratamientoDato.createMany({
    data: nuevas.map((a) => ({
      empresaId,
      areaId: a.id,
      nombre: `Tratamiento de datos — ${a.nombre}`,
      // Lo único que se prellena es lo que el área ya declaró en el levantamiento.
      datosSensibles: a.trataDatosSensibles,
      estado: "BORRADOR",
    })),
  });

  revalidatePath("/diagnosticos", "layout");
  return { ok: true, creados: nuevas.length };
}

const guardarSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().trim().min(3, "Ponle un nombre a la actividad.").max(200),
  areaId: z.string().optional(),
  finalidad: z.string().max(2000).optional(),
  categoriasTitulares: z.string().max(1000).optional(),
  categoriasDatos: z.string().max(2000).optional(),
  datosSensibles: z.boolean(),
  baseLegal: z.string().max(500).optional(),
  origen: z.string().max(500).optional(),
  destinatarios: z.string().max(2000).optional(),
  encargados: z.string().max(1000).optional(),
  sistemas: z.string().max(1000).optional(),
  transferenciaInternacional: z.boolean(),
  paisesDestino: z.string().max(500).optional(),
  garantiasTransferencia: z.string().max(1000).optional(),
  plazoConservacion: z.string().max(500).optional(),
  medidasSeguridad: z.string().max(2000).optional(),
  estado: z.enum(["BORRADOR", "EN_REVISION", "VIGENTE"]),
});

export async function guardarTratamiento(
  input: z.input<typeof guardarSchema>
): Promise<RatResult> {
  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { id, areaId, ...datos } = parsed.data;

  const actual = await prisma.tratamientoDato.findUnique({
    where: { id },
    select: { empresaId: true },
  });
  if (!actual) return { ok: false, error: "Actividad no encontrada." };
  const { error } = await permiso(actual.empresaId);
  if (error) return { ok: false, error };

  // Un área de otra empresa no puede colarse por el formulario.
  if (areaId) {
    const ok = await prisma.area.count({ where: { id: areaId, empresaId: actual.empresaId } });
    if (ok === 0) return { ok: false, error: "Esa área no pertenece a esta empresa." };
  }

  const vacioANull = (s: string | undefined) => (s?.trim() ? s.trim() : null);

  await prisma.tratamientoDato.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      areaId: areaId || null,
      finalidad: vacioANull(datos.finalidad),
      categoriasTitulares: vacioANull(datos.categoriasTitulares),
      categoriasDatos: vacioANull(datos.categoriasDatos),
      datosSensibles: datos.datosSensibles,
      baseLegal: vacioANull(datos.baseLegal),
      origen: vacioANull(datos.origen),
      destinatarios: vacioANull(datos.destinatarios),
      encargados: vacioANull(datos.encargados),
      sistemas: vacioANull(datos.sistemas),
      transferenciaInternacional: datos.transferenciaInternacional,
      paisesDestino: vacioANull(datos.paisesDestino),
      garantiasTransferencia: vacioANull(datos.garantiasTransferencia),
      plazoConservacion: vacioANull(datos.plazoConservacion),
      medidasSeguridad: vacioANull(datos.medidasSeguridad),
      estado: datos.estado,
    },
  });

  revalidatePath("/diagnosticos", "layout");
  return { ok: true };
}

export async function crearTratamiento(empresaId: string): Promise<RatResult> {
  const { error } = await permiso(empresaId);
  if (error) return { ok: false, error };

  await prisma.tratamientoDato.create({
    data: { empresaId, nombre: "Nueva actividad de tratamiento", estado: "BORRADOR" },
  });
  revalidatePath("/diagnosticos", "layout");
  return { ok: true, creados: 1 };
}

export async function eliminarTratamiento(id: string): Promise<RatResult> {
  const actual = await prisma.tratamientoDato.findUnique({
    where: { id },
    select: { empresaId: true, estado: true },
  });
  if (!actual) return { ok: false, error: "Actividad no encontrada." };
  const { error } = await permiso(actual.empresaId);
  if (error) return { ok: false, error };
  // Una actividad vigente es parte del registro legal: se saca de vigencia antes.
  if (actual.estado === "VIGENTE") {
    return { ok: false, error: "Está vigente. Cámbiala a borrador antes de eliminarla." };
  }

  await prisma.tratamientoDato.delete({ where: { id } });
  revalidatePath("/diagnosticos", "layout");
  return { ok: true };
}
