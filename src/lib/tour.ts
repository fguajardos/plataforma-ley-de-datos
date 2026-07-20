import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";

export type PasoTour = {
  /** Selector del elemento a resaltar; null = paso centrado (bienvenida/cierre). */
  target: string | null;
  titulo: string;
  texto: string;
  roles: Role[];
};

const ALL: Role[] = [
  ROLES.ADMIN_P360,
  ROLES.CONSULTOR,
  ROLES.ADMIN_EMPRESA,
  ROLES.RESPONSABLE_DOMINIO,
  ROLES.ALTA_DIRECCION,
];

const EMPRESA: Role[] = [ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO, ROLES.ALTA_DIRECCION];

/**
 * Pasos del tutorial inicial. Se filtran por rol y se descartan los que no
 * encuentran su elemento en pantalla (p. ej. una sección que ese rol no ve).
 */
export const PASOS_TOUR: PasoTour[] = [
  {
    target: null,
    titulo: "Te damos la bienvenida a Procesos360",
    texto:
      "Esta plataforma te acompaña en el diagnóstico y cumplimiento de la Ley 21.719 de Protección de Datos Personales. Son 6 pasos, menos de un minuto.",
    roles: ALL,
  },
  {
    target: '[data-tour="nav-dashboard"]',
    titulo: "Tu Dashboard",
    texto:
      "El punto de partida. Muestra el nivel de madurez de tu organización en los 10 dominios de la ley, las brechas detectadas y el avance del diagnóstico.",
    roles: ALL,
  },
  {
    target: '[data-tour="nav-diagnosticos"]',
    titulo: "Diagnósticos",
    texto:
      "Aquí vive el trabajo: cada dominio tiene un cuestionario que respondes con una escala de 0 a 5. A medida que respondes, la plataforma calcula tu madurez y detecta brechas automáticamente.",
    roles: [ROLES.ADMIN_P360, ROLES.CONSULTOR, ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO],
  },
  {
    target: '[data-tour="nav-empresa"]',
    titulo: "Mi Empresa",
    texto:
      "Administra los datos de tu organización, las áreas que participan del diagnóstico y los usuarios con acceso a la plataforma.",
    roles: [ROLES.ADMIN_EMPRESA],
  },
  {
    target: '[data-tour="nav-empresas"]',
    titulo: "Empresas",
    texto:
      "Como equipo Procesos360, desde aquí administras todas las empresas cliente, sus áreas y sus usuarios.",
    roles: [ROLES.ADMIN_P360],
  },
  {
    target: '[data-tour="nav-catalogo"]',
    titulo: "Catálogo LPDP",
    texto:
      "El catálogo maestro de 10 dominios y sus preguntas, común a todas las empresas. Editarlo afecta a todos los diagnósticos nuevos.",
    roles: [ROLES.ADMIN_P360],
  },
  {
    target: '[data-tour="usuario"]',
    titulo: "Tu perfil y tu rol",
    texto:
      "Tu rol define qué ves y qué puedes editar. Desde aquí también cierras sesión. ¿Necesitas ver el tutorial otra vez? Está disponible en el asistente.",
    roles: ALL,
  },
  {
    target: '[data-tour="chat"]',
    titulo: "El asistente te acompaña",
    texto:
      "Si una pregunta del cuestionario no te queda clara o tienes dudas sobre la ley, pregúntale al asistente. Responde en cualquier momento, desde cualquier pantalla.",
    roles: ALL,
  },
  {
    target: null,
    titulo: "Todo listo para empezar",
    texto:
      "Te recomendamos partir por el Dashboard para ver el estado general, y luego entrar al diagnóstico para responder los dominios que tengas asignados. Recuerda que puedes apoyar cada respuesta con evidencias.",
    roles: ALL,
  },
];

export function pasosParaRol(role: Role): PasoTour[] {
  return PASOS_TOUR.filter((p) => p.roles.includes(role));
}

export { EMPRESA };
