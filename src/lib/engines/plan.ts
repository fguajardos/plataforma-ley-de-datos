// Motor de Plan de Tratamiento — convierte brechas en acciones concretas (Documento Funcional Base §12).
// Cada brecha genera una acción con prioridad, esfuerzo y plazo derivados de su criticidad.

import { diasPlazoPorCriticidad, esfuerzoPorCriticidad, prioridadPorCriticidad } from "@/lib/constants";

export type BrechaPlanInput = {
  brechaId: string;
  codigo: string;
  descripcion: string;
  criticidad: string;
  accionRecomendada: string | null;
  evidenciaEsperada: string | null;
  responsableSugerido: string | null;
};

export type AccionGenerada = {
  brechaId: string;
  descripcion: string;
  responsable: string | null;
  prioridad: "ALTA" | "MEDIA" | "BAJA";
  esfuerzo: "BAJO" | "MEDIO" | "ALTO";
  plazoDias: number; // offset en días desde la fecha base (para calcular la fecha plazo)
  evidenciaEsperada: string | null;
};

export function evaluarAccion(b: BrechaPlanInput): AccionGenerada {
  return {
    brechaId: b.brechaId,
    descripcion: b.accionRecomendada?.trim() || `Cerrar la brecha ${b.codigo}: ${b.descripcion}`,
    responsable: b.responsableSugerido,
    prioridad: prioridadPorCriticidad(b.criticidad),
    esfuerzo: esfuerzoPorCriticidad(b.criticidad),
    plazoDias: diasPlazoPorCriticidad(b.criticidad),
    evidenciaEsperada: b.evidenciaEsperada,
  };
}

export function generarPlan(brechas: BrechaPlanInput[]): AccionGenerada[] {
  return brechas.map(evaluarAccion);
}
