import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLES_P360, type Role } from "@/lib/constants";

/** Sesión memoizada dentro del request. */
export const getSession = cache(async () => auth());

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}

/** Exige que el usuario tenga uno de los roles indicados; si no, lo manda al dashboard. */
export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.user) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: { empresa: true },
  });
});

/**
 * Guard de las secciones de gestión de un diagnóstico (configurar, madurez,
 * brechas, riesgos, plan, roadmap, certificación, reportes, expediente).
 * El Responsable de Dominio solo responde su cuestionario: se le redirige
 * al resumen del diagnóstico.
 */
export async function requireAccesoSecciones(diagnosticoId: string) {
  const session = await requireSession();
  if (session.user.role === ROLES.RESPONSABLE_DOMINIO) redirect(`/diagnosticos/${diagnosticoId}`);
  return session;
}

/** ¿El usuario pertenece al staff de Procesos360 (ve todas las empresas)? */
export function esStaffP360(role: Role): boolean {
  return ROLES_P360.includes(role);
}

type SesionMinima = { user: { role: Role; empresaId: string | null } };

/**
 * Filtro de empresa para listar diagnósticos.
 *
 * La regla es una sola: **quien tiene una empresa asignada ve esa y ninguna otra**, sea
 * del cliente o del staff. Eso permite acotar una cuenta de Procesos360 a un entorno de
 * demostración sin darle un rol distinto: conserva la vista de consultor, pero encerrada.
 *
 * El staff sin empresa asignada ve todas las empresas reales, y las de demostración
 * quedan fuera para que no se mezclen con el trabajo diario.
 */
export function empresaScope(session: SesionMinima) {
  if (session.user.empresaId) return { empresaId: session.user.empresaId };
  if (esStaffP360(session.user.role)) return { empresa: { esDemo: false } };
  return { empresaId: "__none__" };
}

/**
 * ¿Este usuario NO puede ver un recurso de esta empresa? Misma regla que empresaScope,
 * aplicada a un recurso concreto (un diagnóstico, una respuesta, una evidencia).
 *
 * Reemplaza el control que antes se repetía en doce lugares: tenerlo en uno solo evita
 * que al agregar una pantalla se olvide, y que las reglas se separen entre sí.
 */
export function sinAccesoAEmpresa(
  session: SesionMinima,
  empresaIdRecurso: string | null | undefined
): boolean {
  if (session.user.empresaId) return empresaIdRecurso !== session.user.empresaId;
  return !esStaffP360(session.user.role);
}
