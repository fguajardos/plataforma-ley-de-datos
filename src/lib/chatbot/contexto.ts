// Contexto agregado del diagnóstico para el asistente. Por decisión de privacidad,
// SOLO se envían números y niveles (madurez, conteos de brechas/acciones, % avance):
// nunca comentarios, textos de respuestas, evidencias ni nombres de empresa o usuarios.

import "server-only";
import { prisma } from "@/lib/db";
import { esStaffP360 } from "@/lib/session";
import { getDiagnosticoFull, madurezDeDiagnostico } from "@/lib/data/diagnosticos";
import { NIVEL_MADUREZ, ROLE_LABELS, type Role } from "@/lib/constants";

type SessionLike = { user: { id: string; role: Role; empresaId: string | null } };

function labelNivel(nivel: string | null): string {
  return nivel ? NIVEL_MADUREZ[nivel as keyof typeof NIVEL_MADUREZ].label : "sin datos";
}

/** Contexto agregado (solo números/niveles) del último diagnóstico visible para la sesión. */
export async function contextoAgregado(session: SessionLike): Promise<string> {
  const rol = `Rol del usuario: ${ROLE_LABELS[session.user.role]}.`;

  if (esStaffP360(session.user.role)) {
    const [empresas, diagnosticos] = await Promise.all([
      prisma.empresa.count(),
      prisma.diagnostico.count(),
    ]);
    return `${rol} Usuario interno de Procesos360 con visibilidad de todas las empresas (${empresas} empresas, ${diagnosticos} diagnósticos). No se incluye contexto de un diagnóstico específico; oriéntalo a las secciones de la plataforma.`;
  }

  if (!session.user.empresaId) {
    return `${rol} El usuario aún no tiene empresa asociada.`;
  }

  const ultimo = await prisma.diagnostico.findFirst({
    where: { empresaId: session.user.empresaId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!ultimo) return `${rol} Su empresa aún no tiene diagnósticos creados.`;

  const [diag, brechas, acciones] = await Promise.all([
    getDiagnosticoFull(ultimo.id, session),
    prisma.brecha.groupBy({
      by: ["criticidad", "estado"],
      where: { diagnosticoId: ultimo.id },
      _count: true,
    }),
    prisma.accionTratamiento.groupBy({
      by: ["estado"],
      where: { diagnosticoId: ultimo.id },
      _count: true,
    }),
  ]);

  const madurez = madurezDeDiagnostico(diag);
  const porDominio = madurez.dominios
    .map(
      (d) =>
        `  - ${d.nombre}: ${d.promedio ?? "s/d"} (${labelNivel(d.nivel)}), avance ${d.avance}%`
    )
    .join("\n");

  const brechasTxt =
    brechas.length === 0
      ? "sin brechas generadas aún"
      : brechas.map((b) => `${b._count} ${b.criticidad} ${b.estado}`).join(", ");
  const accionesTxt =
    acciones.length === 0
      ? "sin plan de tratamiento generado aún"
      : acciones.map((a) => `${a._count} ${a.estado}`).join(", ");

  return [
    rol,
    `Diagnóstico vigente de su empresa (tipo ${diag.tipo}, estado ${diag.estado}):`,
    `- Madurez global: ${madurez.global ?? "sin datos"} (${labelNivel(madurez.nivelGlobal)})`,
    `- Madurez por dominio:\n${porDominio}`,
    `- Brechas: ${brechasTxt}`,
    `- Plan de tratamiento: ${accionesTxt}`,
  ].join("\n");
}
