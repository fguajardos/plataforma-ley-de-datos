"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, sinAccesoAEmpresa } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { proponerActividades, type ActividadPropuesta } from "@/lib/engines/extraccion-rat";

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

// ───────────────── Propuesta a partir del material del cliente ─────────────────

export type PropuestaResult = {
  ok: boolean;
  error?: string;
  actividades?: ActividadPropuesta[];
  fuentes?: { documentos: number; comentarios: number };
};

/**
 * Lee lo que la empresa entregó en el dominio del RAT y propone actividades.
 *
 * No escribe nada: devuelve sugerencias con su cita para que el consultor las revise. El
 * paso de aceptar es deliberadamente aparte, porque un RAT es un registro legal y quien
 * responde por él es una persona, no el análisis.
 */
export async function proponerDesdeElLevantamiento(
  diagnosticoId: string
): Promise<PropuestaResult> {
  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: { empresaId: true },
  });
  if (!diag) return { ok: false, error: "Diagnóstico no encontrado." };
  const { error } = await permiso(diag.empresaId);
  if (error) return { ok: false, error };

  const r = await proponerActividades(diagnosticoId);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.actividades.length === 0) {
    return {
      ok: false,
      error:
        "El análisis no encontró actividades de tratamiento sustentables en el material. Suele pasar cuando lo entregado describe carencias en vez de tratamientos.",
    };
  }
  return { ok: true, actividades: r.actividades, fuentes: r.fuentes };
}

const aceptarSchema = z.object({
  empresaId: z.string().min(1),
  actividades: z
    .array(
      z.object({
        nombre: z.string().trim().min(3).max(200),
        area: z.string().nullable().optional(),
        datosSensibles: z.boolean(),
        transferenciaInternacional: z.boolean(),
        finalidad: z.object({ valor: z.string(), cita: z.string() }).optional(),
        categoriasTitulares: z.object({ valor: z.string(), cita: z.string() }).optional(),
        categoriasDatos: z.object({ valor: z.string(), cita: z.string() }).optional(),
        baseLegal: z.object({ valor: z.string(), cita: z.string() }).optional(),
        origen: z.object({ valor: z.string(), cita: z.string() }).optional(),
        destinatarios: z.object({ valor: z.string(), cita: z.string() }).optional(),
        encargados: z.object({ valor: z.string(), cita: z.string() }).optional(),
        sistemas: z.object({ valor: z.string(), cita: z.string() }).optional(),
        plazoConservacion: z.object({ valor: z.string(), cita: z.string() }).optional(),
        medidasSeguridad: z.object({ valor: z.string(), cita: z.string() }).optional(),
      })
    )
    .min(1)
    .max(40),
});

/** Crea en el registro las actividades que el consultor aceptó. Siempre como BORRADOR. */
export async function aceptarPropuesta(
  input: z.input<typeof aceptarSchema>
): Promise<RatResult> {
  const parsed = aceptarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { empresaId, actividades } = parsed.data;
  const { error } = await permiso(empresaId);
  if (error) return { ok: false, error };

  const areas = await prisma.area.findMany({
    where: { empresaId },
    select: { id: true, nombre: true },
  });
  const porNombre = new Map(areas.map((a) => [a.nombre.toLowerCase(), a.id]));
  const v = (c?: { valor: string }) => (c?.valor?.trim() ? c.valor.trim() : null);

  await prisma.tratamientoDato.createMany({
    data: actividades.map((a) => ({
      empresaId,
      areaId: a.area ? (porNombre.get(a.area.toLowerCase()) ?? null) : null,
      nombre: a.nombre,
      finalidad: v(a.finalidad),
      categoriasTitulares: v(a.categoriasTitulares),
      categoriasDatos: v(a.categoriasDatos),
      baseLegal: v(a.baseLegal),
      origen: v(a.origen),
      destinatarios: v(a.destinatarios),
      encargados: v(a.encargados),
      sistemas: v(a.sistemas),
      plazoConservacion: v(a.plazoConservacion),
      medidasSeguridad: v(a.medidasSeguridad),
      datosSensibles: a.datosSensibles,
      transferenciaInternacional: a.transferenciaInternacional,
      // Nunca entra vigente: lo propuso un análisis y todavía nadie lo verificó contra
      // la operación real de la empresa.
      estado: "BORRADOR",
    })),
  });

  revalidatePath("/diagnosticos", "layout");
  return { ok: true, creados: actividades.length };
}
