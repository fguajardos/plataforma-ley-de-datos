// Constantes y reglas de negocio de la plataforma LPDP.
// Centraliza los valores "enum-like" (almacenados como String en SQLite) y la lógica
// derivada del Documento Funcional Base.

// ───────────────────────── Roles ─────────────────────────

export const ROLES = {
  ADMIN_P360: "ADMIN_P360",
  CONSULTOR: "CONSULTOR",
  ADMIN_EMPRESA: "ADMIN_EMPRESA",
  RESPONSABLE_DOMINIO: "RESPONSABLE_DOMINIO",
  ALTA_DIRECCION: "ALTA_DIRECCION",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN_P360: "Administrador Procesos360",
  CONSULTOR: "Consultor Procesos360",
  ADMIN_EMPRESA: "Administrador Empresa",
  RESPONSABLE_DOMINIO: "Responsable de Dominio",
  ALTA_DIRECCION: "Alta Dirección",
};

/** Roles internos de Procesos360 (sin empresa asociada). */
export const ROLES_P360: Role[] = [ROLES.ADMIN_P360, ROLES.CONSULTOR];

// ───────────────────────── Escala de evaluación ─────────────────────────

export const VALORES = ["0", "1", "2", "3", "4", "5", "N_A", "OTRO"] as const;
export type Valor = (typeof VALORES)[number];

export const ESCALA: Record<Valor, { estado: string; descripcion: string }> = {
  "0": { estado: "No Existe", descripcion: "No existe práctica, control ni evidencia." },
  "1": { estado: "Inicial", descripcion: "Existe informalmente y depende de personas." },
  "2": { estado: "Parcial", descripcion: "Existe parcialmente o sólo en algunas áreas." },
  "3": { estado: "Implementado", descripcion: "Existe formalmente y documentado." },
  "4": { estado: "Gestionado", descripcion: "Se monitorea mediante indicadores." },
  "5": { estado: "Optimizado", descripcion: "Automatizado y sujeto a mejora continua." },
  N_A: { estado: "No Aplica", descripcion: "No aplica al área evaluada." },
  OTRO: { estado: "Otro", descripcion: "Situación distinta, debe describirse." },
};

/** Valor numérico para el cálculo de madurez (N/A y OTRO no puntúan). */
export function valorNumerico(valor: string | null | undefined): number | null {
  if (valor == null) return null;
  if (["0", "1", "2", "3", "4", "5"].includes(valor)) return Number(valor);
  return null; // N_A, OTRO
}

/** Comentario obligatorio si la respuesta es 0, 1, 2, N/A u Otro. */
export function requiereComentario(valor: string | null | undefined): boolean {
  return valor != null && ["0", "1", "2", "N_A", "OTRO"].includes(valor);
}

/** Las respuestas 0, 1 y 2 generan brecha preliminar. */
export function generaBrechaPreliminar(valor: string | null | undefined): boolean {
  return valor != null && ["0", "1", "2"].includes(valor);
}

// ───────────────────────── Niveles de madurez ─────────────────────────

export type NivelMadurez = "CRITICO" | "BAJO" | "MEDIO" | "ALTO" | "AVANZADO";

export const NIVEL_MADUREZ: Record<
  NivelMadurez,
  { label: string; estado: string; color: string; min: number; max: number }
> = {
  CRITICO: { label: "Crítico", estado: "No cumple", color: "#dc2626", min: 0.0, max: 1.4 },
  BAJO: { label: "Bajo", estado: "Cumplimiento parcial débil", color: "#f97316", min: 1.5, max: 2.4 },
  MEDIO: { label: "Medio", estado: "Cumplimiento documentado parcial", color: "#eab308", min: 2.5, max: 3.4 },
  ALTO: { label: "Alto", estado: "Cumplimiento gestionado", color: "#22c55e", min: 3.5, max: 4.4 },
  AVANZADO: { label: "Avanzado", estado: "Cumplimiento optimizado", color: "#16a34a", min: 4.5, max: 5.0 },
};

/** Clasifica un promedio (0-5) en su nivel de madurez. */
export function clasificarMadurez(promedio: number | null): NivelMadurez | null {
  if (promedio == null) return null;
  if (promedio <= 1.4) return "CRITICO";
  if (promedio <= 2.4) return "BAJO";
  if (promedio <= 3.4) return "MEDIO";
  if (promedio <= 4.4) return "ALTO";
  return "AVANZADO";
}

// ───────────────────────── Diagnóstico ─────────────────────────

export const TIPO_DIAGNOSTICO = {
  INICIAL: "Diagnóstico Inicial",
  COMPLETO: "Diagnóstico Completo",
  PARCIAL: "Diagnóstico Parcial",
  REEVALUACION: "Reevaluación",
  CERTIFICACION: "Preparación Certificación",
  SEGUIMIENTO: "Seguimiento",
} as const;

export const ESTADO_DIAGNOSTICO = {
  BORRADOR: "Borrador",
  CONFIGURADO: "Configurado",
  EN_EJECUCION: "En ejecución",
  EN_VALIDACION: "En validación",
  CON_BRECHAS: "Con brechas generadas",
  CON_PLAN: "Con plan generado",
  EN_SEGUIMIENTO: "En seguimiento",
  PREPARADO_CERT: "Preparado para certificación",
  CERRADO: "Cerrado",
} as const;

// ───────────────────────── Brechas, riesgos, evidencias ─────────────────────────

export const CRITICIDAD = ["BAJA", "MEDIA", "ALTA", "CRITICA"] as const;
export const TIPO_BRECHA = ["REGULATORIA", "DOCUMENTAL", "TECNOLOGICA", "OPERACIONAL"] as const;
export const PROBABILIDAD = ["BAJA", "MEDIA", "ALTA"] as const;
export const IMPACTO = ["BAJO", "MEDIO", "ALTO", "CRITICO"] as const;

export const ESTADO_RESPUESTA = {
  PENDIENTE: "Pendiente",
  RESPONDIDA: "Respondida",
  VALIDADA: "Validada",
  OBSERVADA: "Observada",
} as const;

export const ESTADO_EVIDENCIA = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  VALIDADA: "Validada",
  OBSERVADA: "Observada",
  RECHAZADA: "Rechazada",
  VENCIDA: "Vencida",
} as const;

/** Mapea el valor (0/1/2) a la criticidad por defecto de la brecha. */
export function criticidadPorValor(valor: string): (typeof CRITICIDAD)[number] {
  if (valor === "0") return "CRITICA";
  if (valor === "1") return "ALTA";
  return "MEDIA"; // "2"
}

/** Nivel de riesgo a partir de probabilidad × impacto. */
export function nivelRiesgo(
  probabilidad: (typeof PROBABILIDAD)[number],
  impacto: (typeof IMPACTO)[number]
): (typeof IMPACTO)[number] {
  const p = { BAJA: 1, MEDIA: 2, ALTA: 3 }[probabilidad];
  const i = { BAJO: 1, MEDIO: 2, ALTO: 3, CRITICO: 4 }[impacto];
  const score = p * i;
  if (score >= 9) return "CRITICO";
  if (score >= 6) return "ALTO";
  if (score >= 3) return "MEDIO";
  return "BAJO";
}
