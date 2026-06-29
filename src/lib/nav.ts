import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // clave de icono (ver components/Icon)
  roles: Role[];
};

const ALL: Role[] = [
  ROLES.ADMIN_P360,
  ROLES.CONSULTOR,
  ROLES.ADMIN_EMPRESA,
  ROLES.RESPONSABLE_DOMINIO,
  ROLES.ALTA_DIRECCION,
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid", roles: ALL },
  {
    href: "/diagnosticos",
    label: "Diagnósticos",
    icon: "clipboard",
    roles: [ROLES.ADMIN_P360, ROLES.CONSULTOR, ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO],
  },
  {
    href: "/empresa",
    label: "Mi Empresa",
    icon: "building",
    roles: [ROLES.ADMIN_EMPRESA],
  },
  {
    href: "/admin/empresas",
    label: "Empresas",
    icon: "building",
    roles: [ROLES.ADMIN_P360],
  },
  {
    href: "/admin/catalogo",
    label: "Catálogo LPDP",
    icon: "book",
    roles: [ROLES.ADMIN_P360],
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
