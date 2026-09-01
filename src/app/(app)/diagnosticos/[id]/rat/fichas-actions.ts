"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360, sinAccesoAEmpresa } from "@/lib/session";
import {
  crearUrlSubidaEvidencia,
  eliminarArchivoEvidencia,
  storageConfigurado,
} from "@/lib/storage";
import { MAX_EVIDENCIA_BYTES, MAX_EVIDENCIA_MB } from "@/lib/constants";

// Fichas de proceso: el trabajo de campo del equipo consultor.
//
// Solo las sube y las borra Procesos360. No es una restricción por desconfianza: una
// ficha es lo que NOSOTROS levantamos en la entrevista, y si el cliente pudiera
// editarla dejaría de servir como contraste independiente de lo que él mismo declaró en
// el cuestionario. El cliente aporta por el otro carril, que son las evidencias.

export type FichaResult = { ok: boolean; error?: string };

async function permiso(empresaId: string) {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { error: "Las fichas de proceso las mantiene el equipo consultor." };
  }
  if (sinAccesoAEmpresa(session, empresaId)) return { error: "Sin acceso." };
  return { session };
}

function sanitizar(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

/** Paso 1: URL firmada para que el archivo viaje del navegador directo a Storage. */
export async function prepararSubidaFicha(
  empresaId: string,
  nombreArchivo: string,
  tamano: number
): Promise<{ ok: boolean; signedUrl?: string; path?: string; error?: string }> {
  const { error } = await permiso(empresaId);
  if (error) return { ok: false, error };
  if (!storageConfigurado()) {
    return { ok: false, error: "Storage no configurado en el servidor." };
  }
  if (tamano > MAX_EVIDENCIA_BYTES) {
    return { ok: false, error: `El archivo supera ${MAX_EVIDENCIA_MB} MB.` };
  }
  // Prefijo propio: las fichas no se mezclan con las evidencias del cliente ni en la ruta.
  const path = `fichas/${empresaId}/${randomUUID()}-${sanitizar(nombreArchivo)}`;
  try {
    const { signedUrl } = await crearUrlSubidaEvidencia(path);
    return { ok: true, signedUrl, path };
  } catch (e) {
    return { ok: false, error: `No se pudo preparar la subida: ${(e as Error).message}` };
  }
}

const registrarSchema = z.object({
  empresaId: z.string().min(1),
  nombre: z.string().trim().min(3, "Ponle un nombre a la ficha.").max(200),
  descripcion: z.string().max(1000).optional(),
  areaId: z.string().optional(),
  archivoPath: z.string().min(1),
  mimeType: z.string().optional(),
  tamano: z.number().int().nonnegative().optional(),
});

/** Paso 2: registra la ficha una vez que el archivo ya está en Storage. */
export async function registrarFicha(
  input: z.input<typeof registrarSchema>
): Promise<FichaResult> {
  const parsed = registrarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;
  const { session, error } = await permiso(d.empresaId);
  if (error || !session) return { ok: false, error };

  if (d.areaId) {
    const ok = await prisma.area.count({ where: { id: d.areaId, empresaId: d.empresaId } });
    if (ok === 0) return { ok: false, error: "Esa área no pertenece a esta empresa." };
  }

  await prisma.fichaProceso.create({
    data: {
      empresaId: d.empresaId,
      areaId: d.areaId || null,
      nombre: d.nombre,
      descripcion: d.descripcion?.trim() || null,
      archivoPath: d.archivoPath,
      mimeType: d.mimeType ?? null,
      tamano: d.tamano ?? null,
      subidoPorId: session.user.id,
    },
  });

  revalidatePath("/diagnosticos", "layout");
  return { ok: true };
}

export async function eliminarFicha(id: string): Promise<FichaResult> {
  const ficha = await prisma.fichaProceso.findUnique({
    where: { id },
    select: { empresaId: true, archivoPath: true },
  });
  if (!ficha) return { ok: false, error: "Ficha no encontrada." };
  const { error } = await permiso(ficha.empresaId);
  if (error) return { ok: false, error };

  // Primero la fila y después el archivo: si falla el borrado en Storage queda un archivo
  // huérfano, que es molesto; al revés queda una ficha que apunta a la nada, que rompe.
  await prisma.fichaProceso.delete({ where: { id } });
  if (ficha.archivoPath) await eliminarArchivoEvidencia(ficha.archivoPath);

  revalidatePath("/diagnosticos", "layout");
  return { ok: true };
}
