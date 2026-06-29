import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ROLES_P360, type Role } from "@/lib/constants";

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

/** ¿El usuario pertenece al staff de Procesos360 (ve todas las empresas)? */
export function esStaffP360(role: Role): boolean {
  return ROLES_P360.includes(role);
}

/**
 * Filtro de empresa para queries de diagnósticos: staff P360 ve todo;
 * el resto sólo su empresa.
 */
export function empresaScope(session: { user: { role: Role; empresaId: string | null } }) {
  if (esStaffP360(session.user.role)) return {};
  return { empresaId: session.user.empresaId ?? "__none__" };
}
