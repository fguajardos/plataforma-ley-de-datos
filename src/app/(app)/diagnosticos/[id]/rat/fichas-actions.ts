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
  urlFirmadaEvidencia,
} from "@/lib/storage";
import { XLSX } from "@/lib/documentos";
import { leerFicha } from "@/lib/engines/ficha-proceso";
import { filasDeFicha } from "@/lib/engines/ficha-excel";
import { MAX_EVIDENCIA_BYTES, MAX_EVIDENCIA_MB, MAX_FICHAS_LOTE } from "@/lib/constants";

// Fichas de proceso: el trabajo de campo del equipo consultor.
//
// Solo las sube y las borra Procesos360. No es una restricción por desconfianza: una
// ficha es lo que NOSOTROS levantamos en la entrevista, y si el cliente pudiera
// editarla dejaría de servir como contraste independiente de lo que él mismo declaró en
// el cuestionario. El cliente aporta por el otro carril, que son las evidencias.

export type FichaResult = { ok: boolean; error?: string; creadas?: number; ids?: string[] };

async function permiso(empresaId: string) {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { error: "Las fichas de proceso las mantiene el equipo consultor." };
  }
  if (sinAccesoAEmpresa(session, empresaId)) return { error: "Sin acceso." };
  // Que la empresa exista se comprueba aquí y no al registrar. El staff global pasa el
  // control de acceso con cualquier id, y antes eso alcanzaba para firmar las URL de
  // subida: los archivos llegaban a Storage y recién despues fallaba el registro, dejando
  // basura sin dueño que nadie iba a encontrar.
  if ((await prisma.empresa.count({ where: { id: empresaId } })) === 0) {
    return { error: "Esa empresa no existe." };
  }
  return { session };
}

function sanitizar(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

export type Destino = { signedUrl?: string; path?: string; error?: string };

/**
 * Paso 1: una URL firmada por archivo, para que viajen del navegador directo a Storage.
 *
 * Se piden todas juntas y no una por una. Subir de a uno era el reclamo: cada ficha
 * costaba dos viajes al servidor más el formulario completo, y un levantamiento de área
 * son seis fichas. Ahora una jornada entera son dos viajes.
 *
 * Los destinos vuelven alineados por posición con lo que se pidió, cada uno con su
 * error si lo tiene: que un archivo se pase de tamaño no puede cancelar los otros
 * diecinueve.
 */
export async function prepararSubidaFichas(
  empresaId: string,
  archivos: { nombre: string; tamano: number }[]
): Promise<{ ok: boolean; error?: string; destinos?: Destino[] }> {
  const { error } = await permiso(empresaId);
  if (error) return { ok: false, error };
  if (!storageConfigurado()) {
    return { ok: false, error: "Storage no configurado en el servidor." };
  }
  if (archivos.length === 0) return { ok: false, error: "No elegiste ningún archivo." };
  if (archivos.length > MAX_FICHAS_LOTE) {
    return { ok: false, error: `Son ${archivos.length} archivos: el máximo por tanda es ${MAX_FICHAS_LOTE}.` };
  }

  const destinos: Destino[] = [];
  for (const a of archivos) {
    if (a.tamano > MAX_EVIDENCIA_BYTES) {
      destinos.push({ error: `supera ${MAX_EVIDENCIA_MB} MB` });
      continue;
    }
    // Prefijo propio: las fichas no se mezclan con las evidencias del cliente ni en la ruta.
    const path = `fichas/${empresaId}/${randomUUID()}-${sanitizar(a.nombre)}`;
    try {
      const { signedUrl } = await crearUrlSubidaEvidencia(path);
      destinos.push({ signedUrl, path });
    } catch (e) {
      destinos.push({ error: `no se pudo preparar: ${(e as Error).message.slice(0, 80)}` });
    }
  }
  return { ok: true, destinos };
}

const registrarSchema = z.object({
  empresaId: z.string().min(1),
  // El área y el contexto valen para la tanda entera: quien sube seis fichas de una
  // entrevista las sube todas de la misma área, y escribirlo seis veces es el trámite que
  // hacía preferible no usar la plataforma.
  areaId: z.string().optional(),
  descripcion: z.string().max(1000).optional(),
  fichas: z
    .array(
      z.object({
        nombre: z.string().trim().min(3, "Ponle un nombre a la ficha.").max(200),
        archivoPath: z.string().min(1),
        mimeType: z.string().optional(),
        tamano: z.number().int().nonnegative().optional(),
      })
    )
    .min(1)
    .max(MAX_FICHAS_LOTE),
});

/** Paso 2: registra las fichas cuyos archivos ya llegaron a Storage. */
export async function registrarFichas(
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

  await prisma.fichaProceso.createMany({
    data: d.fichas.map((f) => ({
      empresaId: d.empresaId,
      areaId: d.areaId || null,
      nombre: f.nombre,
      descripcion: d.descripcion?.trim() || null,
      archivoPath: f.archivoPath,
      mimeType: f.mimeType ?? null,
      tamano: f.tamano ?? null,
      subidoPorId: session.user.id,
    })),
  });

  // Se devuelven los ids para poder analizarlas enseguida. `createMany` no los da, y la
  // ruta en Storage lleva un UUID propio: sirve de identificador sin ambigüedad.
  const creadas = await prisma.fichaProceso.findMany({
    where: { empresaId: d.empresaId, archivoPath: { in: d.fichas.map((f) => f.archivoPath) } },
    select: { id: true },
  });

  revalidatePath("/diagnosticos", "layout");
  return { ok: true, creadas: d.fichas.length, ids: creadas.map((f) => f.id) };
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

// ───────────────────── Lectura de la ficha: proceso y roles ─────────────────────

export type AnalisisFicha = {
  id: string;
  nombre: string;
  /** Código del proceso detectado, ya confirmado contra el mapa de la empresa. */
  proceso: string | null;
  procesoNombre: string | null;
  confianza: "alta" | "media" | "baja" | null;
  origen: string | null;
  subprocesos: number;
  roles: number;
  /** El código se detectó pero no existe en el mapa de procesos cargado. */
  procesoDesconocido: string | null;
  error?: string;
};

/**
 * Lee las fichas recién cargadas y las engancha con su proceso.
 *
 * Va en un paso aparte del registro, y no dentro, por una razón práctica: una tanda son
 * hasta veinte archivos y cada uno hay que bajarlo de Storage y abrirlo. Hacerlo dentro
 * del registro dejaría la subida colgada minutos sin decir nada; hacerlo después deja
 * las fichas guardadas de inmediato y el análisis visible mientras corre.
 *
 * No inventa procesos: si el código que trae la ficha no está en el mapa de la empresa, se
 * informa y la ficha queda sin enganchar. Crear el proceso aquí escondería justamente lo
 * que hay que mirar —un levantamiento que apunta a un proceso que nadie mapeó—.
 */
export async function analizarFichas(ids: string[]): Promise<AnalisisFicha[]> {
  if (ids.length === 0) return [];

  const fichas = await prisma.fichaProceso.findMany({
    where: { id: { in: ids.slice(0, MAX_FICHAS_LOTE) } },
    select: { id: true, nombre: true, empresaId: true, archivoPath: true, mimeType: true },
  });
  if (fichas.length === 0) return [];

  const { error } = await permiso(fichas[0].empresaId);
  if (error) return fichas.map((f) => ({ ...vacio(f), error }));

  const procesos = await prisma.procesoNegocio.findMany({
    where: { empresaId: fichas[0].empresaId },
    select: { id: true, codigo: true, nombre: true },
  });
  const porCodigo = new Map(procesos.map((p) => [p.codigo.toUpperCase(), p]));

  const salida: AnalisisFicha[] = [];
  for (const f of fichas) {
    // Solo las planillas tienen la estructura que se sabe leer. Un PDF escaneado no la
    // tiene, y forzarlo por el modelo aquí sería caro para lo poco que devolvería.
    if (!f.archivoPath || f.mimeType !== XLSX) {
      salida.push({ ...vacio(f), error: "solo se leen fichas en Excel (.xlsx)" });
      continue;
    }
    try {
      const url = await urlFirmadaEvidencia(f.archivoPath, 300);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`no se pudo descargar (${res.status})`);
      const filas = await filasDeFicha(Buffer.from(await res.arrayBuffer()));
      const lectura = leerFicha(nombreOriginal(f.archivoPath), filas);

      const proceso = lectura.codigoProceso
        ? (porCodigo.get(lectura.codigoProceso.toUpperCase()) ?? null)
        : null;

      await prisma.fichaProceso.update({
        where: { id: f.id },
        data: {
          procesoId: proceso?.id ?? null,
          rolesCrudos: lectura.roles.length > 0 ? lectura.roles.join("\n") : null,
        },
      });

      salida.push({
        id: f.id,
        nombre: f.nombre,
        proceso: proceso?.codigo ?? null,
        procesoNombre: proceso?.nombre ?? null,
        confianza: lectura.confianza,
        origen: lectura.origen,
        subprocesos: lectura.subprocesos.length,
        roles: lectura.roles.length,
        procesoDesconocido: lectura.codigoProceso && !proceso ? lectura.codigoProceso : null,
      });
    } catch (e) {
      salida.push({ ...vacio(f), error: (e as Error).message.slice(0, 90) });
    }
  }

  revalidatePath("/diagnosticos", "layout");
  return salida;
}

/**
 * El nombre con el que se subió el archivo, sin el identificador que le antepone Storage.
 *
 * La ruta guardada es "fichas/<empresa>/<uuid>-<nombre real>". Si el UUID entra en la
 * detección, sus grupos hexadecimales parecen códigos de proceso —"ea95eab0-c61f" se lee
 * como "F-4"— y contradicen a la ficha sin motivo.
 */
function nombreOriginal(ruta: string): string {
  const base = ruta.split("/").pop() ?? "";
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function vacio(f: { id: string; nombre: string }): AnalisisFicha {
  return {
    id: f.id,
    nombre: f.nombre,
    proceso: null,
    procesoNombre: null,
    confianza: null,
    origen: null,
    subprocesos: 0,
    roles: 0,
    procesoDesconocido: null,
  };
}

/** Corrige a mano el proceso de una ficha, cuando la detección no acertó. */
export async function asignarProcesoAFicha(
  fichaId: string,
  procesoId: string | null
): Promise<FichaResult> {
  const ficha = await prisma.fichaProceso.findUnique({
    where: { id: fichaId },
    select: { empresaId: true },
  });
  if (!ficha) return { ok: false, error: "Ficha no encontrada." };
  const { error } = await permiso(ficha.empresaId);
  if (error) return { ok: false, error };

  if (procesoId) {
    const ok = await prisma.procesoNegocio.count({
      where: { id: procesoId, empresaId: ficha.empresaId },
    });
    if (ok === 0) return { ok: false, error: "Ese proceso no pertenece a esta empresa." };
  }

  await prisma.fichaProceso.update({ where: { id: fichaId }, data: { procesoId } });
  revalidatePath("/diagnosticos", "layout");
  return { ok: true };
}
