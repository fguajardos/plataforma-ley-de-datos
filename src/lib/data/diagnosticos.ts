import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { empresaScope, esStaffP360 } from "@/lib/session";
import { calcularMadurez, type DominioInput } from "@/lib/engines/madurez";
import type { Role } from "@/lib/constants";

type SessionLike = { user: { id: string; role: Role; empresaId: string | null } };

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
          respuestas: { select: { id: true, valor: true, estado: true } },
        },
      },
    },
  });

  if (!diag) notFound();
  if (!esStaffP360(session.user.role) && diag.empresaId !== session.user.empresaId) notFound();
  return diag;
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
