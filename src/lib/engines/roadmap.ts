// Motor de Roadmap — ordena las acciones de tratamiento en horizontes (Documento Funcional Base §13).
// Ubica cada acción en su horizonte según la fecha plazo relativa a una fecha base.

import { HORIZONTES, horizontePorDias, type HorizonteKey } from "@/lib/constants";

export type AccionRoadmapInput = {
  id: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  avance: number;
  plazo: Date | null;
  responsable: string | null;
};

export type HorizonteRoadmap = {
  key: HorizonteKey;
  label: string;
  objetivo: string;
  acciones: AccionRoadmapInput[];
};

export type Roadmap = {
  horizontes: HorizonteRoadmap[];
  vencidas: AccionRoadmapInput[];
  criticas: AccionRoadmapInput[];
  total: number;
};

const MS_DIA = 1000 * 60 * 60 * 24;

/** Ubica la acción en un horizonte por días de plazo; si no tiene fecha, usa la prioridad. */
function horizonteDeAccion(a: AccionRoadmapInput, base: Date): HorizonteKey {
  if (a.plazo) {
    const dias = Math.round((a.plazo.getTime() - base.getTime()) / MS_DIA);
    return horizontePorDias(Math.max(0, dias));
  }
  if (a.prioridad === "ALTA") return "H30";
  if (a.prioridad === "MEDIA") return "H90";
  return "H120";
}

export function construirRoadmap(acciones: AccionRoadmapInput[], base: Date): Roadmap {
  const horizontes: HorizonteRoadmap[] = HORIZONTES.map((h) => ({
    key: h.key,
    label: h.label,
    objetivo: h.objetivo,
    acciones: [],
  }));
  const porKey = new Map(horizontes.map((h) => [h.key, h]));

  for (const a of acciones) {
    porKey.get(horizonteDeAccion(a, base))?.acciones.push(a);
  }

  const vencidas = acciones.filter(
    (a) => a.plazo != null && a.plazo.getTime() < base.getTime() && a.estado !== "CERRADA"
  );
  const criticas = acciones.filter((a) => a.prioridad === "ALTA" && a.estado !== "CERRADA");

  return { horizontes, vencidas, criticas, total: acciones.length };
}
