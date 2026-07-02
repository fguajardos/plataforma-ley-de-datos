// Motor de Preparación para Certificación — Índice de Preparación (Documento Funcional Base §14).
// Combina madurez, brechas/riesgos críticos abiertos, evidencias validadas y % de plan ejecutado.

import { clasificarPreparacion, type EstadoPreparacion } from "@/lib/constants";

export type PreparacionInput = {
  madurezGlobal: number | null; // 0-5
  brechasCriticasAbiertas: number;
  riesgosCriticosAbiertos: number;
  evidenciasValidadas: number;
  evidenciasRequeridas: number; // preguntas con evidencia obligatoria
  planTotal: number;
  planCerradas: number;
};

export type FactorPreparacion = {
  label: string;
  valor: number; // 0-100
  peso: number; // 0-1
};

export type Preparacion = {
  indice: number; // 0-100
  estado: EstadoPreparacion;
  factores: FactorPreparacion[];
};

function pct(n: number, d: number): number {
  if (d <= 0) return 100; // sin requisitos → no penaliza
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

export function calcularPreparacion(i: PreparacionInput): Preparacion {
  const madurez = i.madurezGlobal != null ? Math.round((i.madurezGlobal / 5) * 100) : 0;
  const brechas = Math.max(0, 100 - i.brechasCriticasAbiertas * 20);
  const riesgos = Math.max(0, 100 - i.riesgosCriticosAbiertos * 20);
  const evidencias = pct(i.evidenciasValidadas, i.evidenciasRequeridas);
  const plan = pct(i.planCerradas, i.planTotal);

  const factores: FactorPreparacion[] = [
    { label: "Madurez global", valor: madurez, peso: 0.3 },
    { label: "Brechas críticas cerradas", valor: brechas, peso: 0.25 },
    { label: "Riesgos críticos mitigados", valor: riesgos, peso: 0.15 },
    { label: "Evidencias validadas", valor: evidencias, peso: 0.15 },
    { label: "Plan de tratamiento ejecutado", valor: plan, peso: 0.15 },
  ];

  const indice = Math.round(factores.reduce((a, f) => a + f.valor * f.peso, 0));

  // Regla del doc §14.3: con brechas críticas abiertas, el estado es "No preparado".
  const estado: EstadoPreparacion =
    i.brechasCriticasAbiertas > 0 ? "NO_PREPARADO" : clasificarPreparacion(indice);

  return { indice, estado, factores };
}
