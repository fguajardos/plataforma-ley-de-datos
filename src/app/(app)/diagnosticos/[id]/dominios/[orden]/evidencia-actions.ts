"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import {
  subirEvidencia,
  eliminarArchivoEvidencia,
  urlFirmadaEvidencia,
  storageConfigurado,
} from "@/lib/storage";
import { ESTADO_EVIDENCIA, ROLES } from "@/lib/constants";

export type EvidenciaResult = { ok: boolean; error?: string };

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function sanitizar(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

/** Sube una evidencia asociada a una respuesta (pregunta) del cuestionario. */
export async function subirEvidenciaAction(formData: FormData): Promise<EvidenciaResult> {
  const session = await requireSession();

  const respuestaId = String(formData.get("respuestaId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipoDocumental = String(formData.get("tipoDocumental") ?? "").trim() || null;
  const vigenciaRaw = String(formData.get("vigencia") ?? "").trim();
  const file = formData.get("file");

  if (!respuestaId) return { ok: false, error: "Falta la respuesta asociada." };
  if (!nombre) return { ok: false, error: "El nombre del documento es obligatorio." };

  // Control de acceso: respuesta → diagnóstico.
  const respuesta = await prisma.respuesta.findUnique({
    where: { id: respuestaId },
    select: {
      id: true,
      diagnosticoDominio: {
        select: {
          id: true,
          responsableId: true,
          diagnostico: { select: { id: true, empresaId: true } },
          dominio: { select: { orden: true } },
        },
      },
    },
  });
  if (!respuesta) return { ok: false, error: "Respuesta no encontrada." };
  const diag = respuesta.diagnosticoDominio.diagnostico;
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }
  // El Responsable de Dominio solo adjunta evidencias en sus dominios asignados.
  if (
    session.user.role === ROLES.RESPONSABLE_DOMINIO &&
    respuesta.diagnosticoDominio.responsableId !== session.user.id
  ) {
    return { ok: false, error: "Este dominio no está asignado a ti." };
  }

  let archivoPath: string | null = null;
  let mimeType: string | null = null;
  let tamano: number | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { ok: false, error: "El archivo supera 10 MB." };
    if (!storageConfigurado()) {
      return { ok: false, error: "Storage no configurado: falta SUPABASE_SERVICE_ROLE_KEY." };
    }
    const path = `${diag.id}/${respuestaId}/${randomUUID()}-${sanitizar(file.name)}`;
    try {
      const buf = await file.arrayBuffer();
      archivoPath = await subirEvidencia(path, buf, file.type);
      mimeType = file.type || null;
      tamano = file.size;
    } catch (e) {
      return { ok: false, error: `Error al subir el archivo: ${(e as Error).message}` };
    }
  }

  await prisma.evidencia.create({
    data: {
      respuestaId,
      diagnosticoDominioId: respuesta.diagnosticoDominio.id,
      nombre,
      tipoDocumental,
      archivoPath,
      mimeType,
      tamano,
      vigencia: vigenciaRaw ? new Date(vigenciaRaw) : null,
      subidoPorId: session.user.id,
      estado: "PENDIENTE",
    },
  });

  revalidatePath(`/diagnosticos/${diag.id}/dominios/${respuesta.diagnosticoDominio.dominio.orden}`);
  revalidatePath(`/diagnosticos/${diag.id}/evidencias`);
  return { ok: true };
}

/** Valida/observa/rechaza una evidencia (solo staff Procesos360). */
export async function validarEvidenciaAction(
  evidenciaId: string,
  estado: keyof typeof ESTADO_EVIDENCIA,
  observaciones?: string
): Promise<EvidenciaResult> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) return { ok: false, error: "Solo el consultor puede validar." };
  if (!(estado in ESTADO_EVIDENCIA)) return { ok: false, error: "Estado inválido." };

  const ev = await prisma.evidencia.findUnique({
    where: { id: evidenciaId },
    select: { id: true, respuesta: { select: { diagnosticoDominio: { select: { diagnostico: { select: { id: true } }, dominio: { select: { orden: true } } } } } } },
  });
  if (!ev) return { ok: false, error: "Evidencia no encontrada." };

  await prisma.evidencia.update({
    where: { id: evidenciaId },
    data: { estado, observaciones: observaciones?.trim() || null },
  });

  const diagId = ev.respuesta?.diagnosticoDominio.diagnostico.id;
  if (diagId) {
    revalidatePath(`/diagnosticos/${diagId}/evidencias`);
    revalidatePath(`/diagnosticos/${diagId}/dominios/${ev.respuesta?.diagnosticoDominio.dominio.orden}`);
  }
  return { ok: true };
}

/** Devuelve una URL firmada temporal para descargar la evidencia. */
export async function descargarEvidenciaAction(
  evidenciaId: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const session = await requireSession();
  const ev = await prisma.evidencia.findUnique({
    where: { id: evidenciaId },
    select: {
      archivoPath: true,
      respuesta: { select: { diagnosticoDominio: { select: { diagnostico: { select: { empresaId: true } } } } } },
    },
  });
  if (!ev?.archivoPath) return { ok: false, error: "La evidencia no tiene archivo." };
  const empresaId = ev.respuesta?.diagnosticoDominio.diagnostico.empresaId;
  if (!esStaffP360(session.user.role) && empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }
  try {
    return { ok: true, url: await urlFirmadaEvidencia(ev.archivoPath) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Elimina una evidencia (registro + archivo en Storage). */
export async function eliminarEvidenciaAction(evidenciaId: string): Promise<EvidenciaResult> {
  const session = await requireSession();

  const ev = await prisma.evidencia.findUnique({
    where: { id: evidenciaId },
    select: {
      id: true,
      archivoPath: true,
      subidoPorId: true,
      respuesta: {
        select: {
          diagnosticoDominio: {
            select: { responsableId: true, diagnostico: { select: { id: true, empresaId: true } }, dominio: { select: { orden: true } } },
          },
        },
      },
    },
  });
  if (!ev) return { ok: false, error: "Evidencia no encontrada." };
  const diag = ev.respuesta?.diagnosticoDominio.diagnostico;
  if (!esStaffP360(session.user.role) && diag?.empresaId !== session.user.empresaId) {
    return { ok: false, error: "Sin acceso." };
  }
  // El Responsable de Dominio solo gestiona evidencias de sus dominios asignados.
  if (
    session.user.role === ROLES.RESPONSABLE_DOMINIO &&
    ev.respuesta?.diagnosticoDominio.responsableId !== session.user.id
  ) {
    return { ok: false, error: "Este dominio no está asignado a ti." };
  }

  if (ev.archivoPath) await eliminarArchivoEvidencia(ev.archivoPath);
  await prisma.evidencia.delete({ where: { id: evidenciaId } });

  if (diag) {
    revalidatePath(`/diagnosticos/${diag.id}/dominios/${ev.respuesta?.diagnosticoDominio.dominio.orden}`);
    revalidatePath(`/diagnosticos/${diag.id}/evidencias`);
  }
  return { ok: true };
}
