import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { empresaScope, esStaffP360 } from "@/lib/session";
import { calcularMadurez, type DominioInput } from "@/lib/engines/madurez";
import type { Role } from "@/lib/constants";

type SessionLike = { user: { id: string; role: Role; empresaId: string | null } };

/** Verifica acceso a un diagnóstico; devuelve {id, empresaId} o null si no hay acceso. */
export async function assertAccesoDiagnostico(diagnosticoId: string, session: SessionLike) {
  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: { id: true, empresaId: true, estado: true, fechaInicio: true },
  });
  if (!diag) return null;
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) return null;
  return diag;
}

/** Lista de diagnósticos visibles para la sesión (P360 ve todo; resto su empresa). */
export async function listarDiagnosticos(session: SessionLike) {
  return prisma.diagnostico.findMany({
    where: empresaScope(session),
    include: {
      empresa: { select: { razonSocial: true } },
      consultor: { select: { nombre: true } },
      _count: { select: { brechas: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Diagnóstico completo con dominios, preguntas y respuestas. Aplica control de acceso. */
export async function getDiagnosticoFull(id: string, session: SessionLike) {
  const diag = await prisma.diagnostico.findUnique({
    where: { id },
    include: {
      empresa: true,
      consultor: { select: { id: true, nombre: true } },
      dominios: {
        orderBy: { dominio: { orden: "asc" } },
        include: {
          dominio: { include: { _count: { select: { preguntas: true } } } },
          responsable: { select: { id: true, nombre: true } },
          area: { select: { id: true, nombre: true } },
          respuestas: { select: { id: true, valor: true, estado: true } },
        },
      },
    },
  });

  if (!diag) notFound();
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) notFound();
  return diag;
}

/** Mapa dominioId → área asignada en el diagnóstico (para madurez por área). */
export function areaDeDominioMap(
  diag: Awaited<ReturnType<typeof getDiagnosticoFull>>
): Record<string, { id: string | null; nombre: string }> {
  const map: Record<string, { id: string | null; nombre: string }> = {};
  for (const d of diag.dominios) {
    if (!d.incluido) continue;
    map[d.dominioId] = d.area
      ? { id: d.area.id, nombre: d.area.nombre }
      : { id: null, nombre: "Sin área asignada" };
  }
  return map;
}

/** Madurez del diagnóstico anterior (mismo empresa, creado antes). Null si no hay. */
export async function madurezDiagnosticoAnterior(
  diag: Awaited<ReturnType<typeof getDiagnosticoFull>>,
  session: SessionLike
) {
  const previo = await prisma.diagnostico.findFirst({
    where: { empresaId: diag.empresaId, createdAt: { lt: diag.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!previo) return null;
  const full = await getDiagnosticoFull(previo.id, session);
  return madurezDeDiagnostico(full);
}

/** Riesgos del diagnóstico. */
export async function getRiesgos(diagnosticoId: string) {
  return prisma.riesgo.findMany({
    where: { diagnosticoId },
    include: { brecha: { select: { codigo: true } } },
    orderBy: { id: "asc" },
  });
}

/** Acciones de tratamiento del diagnóstico. */
export async function getAcciones(diagnosticoId: string) {
  return prisma.accionTratamiento.findMany({
    where: { diagnosticoId },
    include: { brecha: { select: { codigo: true, criticidad: true } } },
    orderBy: [{ prioridad: "asc" }, { plazo: "asc" }],
  });
}

/** Evidencias de un diagnóstico (a través de sus respuestas/dominios/brechas/acciones). */
export async function getEvidenciasDiagnostico(diagnosticoId: string) {
  return prisma.evidencia.findMany({
    where: {
      OR: [
        { respuesta: { diagnosticoDominio: { diagnosticoId } } },
        { diagnosticoDominio: { diagnosticoId } },
        { brecha: { diagnosticoId } },
        { accion: { diagnosticoId } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Respuestas completas por dominio (para el reporte técnico). */
export async function getRespuestasPorDominio(diagnosticoId: string) {
  return prisma.diagnosticoDominio.findMany({
    where: { diagnosticoId, incluido: true },
    orderBy: { dominio: { orden: "asc" } },
    include: {
      dominio: { select: { orden: true, nombre: true } },
      responsable: { select: { nombre: true } },
      area: { select: { nombre: true } },
      respuestas: {
        orderBy: { pregunta: { orden: "asc" } },
        include: {
          pregunta: { select: { orden: true, texto: true } },
          evidencias: { select: { id: true, nombre: true, estado: true } },
        },
      },
    },
  });
}

/** Matriz de trazabilidad: brecha → pregunta → riesgo → acciones → evidencias. */
export async function getTrazabilidad(diagnosticoId: string) {
  return prisma.brecha.findMany({
    where: { diagnosticoId },
    orderBy: { codigo: "asc" },
    include: {
      respuesta: {
        select: {
          pregunta: { select: { orden: true, texto: true } },
          diagnosticoDominio: { select: { dominio: { select: { orden: true, nombre: true } } } },
          evidencias: { select: { id: true, estado: true } },
        },
      },
      riesgo: { select: { nivel: true } },
      acciones: { select: { id: true, estado: true, avance: true, prioridad: true } },
    },
  });
}

/** Insumos para el Índice de Preparación para Certificación. */
export async function getPreparacionInput(
  diagnosticoId: string,
  diag: Awaited<ReturnType<typeof getDiagnosticoFull>>,
  madurezGlobal: number | null
) {
  const [brechasCriticasAbiertas, riesgosCriticosAbiertos, planTotal, planCerradas, evidenciasValidadas] =
    await Promise.all([
      prisma.brecha.count({ where: { diagnosticoId, criticidad: "CRITICA", estado: { not: "CERRADA" } } }),
      prisma.riesgo.count({ where: { diagnosticoId, nivel: "CRITICO" } }),
      prisma.accionTratamiento.count({ where: { diagnosticoId } }),
      prisma.accionTratamiento.count({ where: { diagnosticoId, estado: "CERRADA" } }),
      prisma.evidencia.count({
        where: { estado: "VALIDADA", respuesta: { diagnosticoDominio: { diagnosticoId } } },
      }),
    ]);

  // Preguntas con evidencia obligatoria en los dominios incluidos = evidencias requeridas.
  const evidenciasRequeridas = await prisma.pregunta.count({
    where: {
      evidenciaObligatoria: true,
      dominio: { diagnosticoDominios: { some: { diagnosticoId, incluido: true } } },
    },
  });

  return {
    madurezGlobal,
    brechasCriticasAbiertas,
    riesgosCriticosAbiertos,
    evidenciasValidadas,
    evidenciasRequeridas,
    planTotal,
    planCerradas,
  };
}

/** Un dominio de un diagnóstico con sus preguntas y respuestas (para el cuestionario). */
export async function getDiagnosticoDominio(
  diagnosticoId: string,
  dominioOrden: number,
  session: SessionLike
) {
  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: { id: true, nombre: true, empresaId: true, estado: true },
  });
  if (!diag) notFound();
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) notFound();

  const dd = await prisma.diagnosticoDominio.findFirst({
    where: { diagnosticoId, dominio: { orden: dominioOrden } },
    include: {
      dominio: true,
      responsable: { select: { id: true, nombre: true } },
      respuestas: {
        include: { pregunta: true, evidencias: true },
        orderBy: { pregunta: { orden: "asc" } },
      },
    },
  });
  if (!dd) notFound();
  return { diag, dd };
}

/** Construye el input del motor de madurez a partir del diagnóstico completo. */
export function madurezDeDiagnostico(
  diag: Awaited<ReturnType<typeof getDiagnosticoFull>>
) {
  const dominios: DominioInput[] = diag.dominios
    .filter((d) => d.incluido)
    .map((d) => ({
      dominioId: d.dominioId,
      orden: d.dominio.orden,
      nombre: d.dominio.nombre,
      totalPreguntas: d.dominio._count.preguntas,
      respuestas: d.respuestas.map((r) => ({ preguntaId: r.id, valor: r.valor })),
    }));
  return calcularMadurez(dominios);
}
