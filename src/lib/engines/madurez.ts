// Motor de Madurez — calcula el nivel de cumplimiento (0-5) por pregunta, dominio y global.
// Las respuestas N/A y OTRO no puntúan (se excluyen del promedio).

import { clasificarMadurez, valorNumerico, type NivelMadurez } from "@/lib/constants";

export type RespuestaInput = {
  preguntaId: string;
  valor: string | null;
};

export type DominioInput = {
  dominioId: string;
  orden: number;
  nombre: string;
  respuestas: RespuestaInput[];
  totalPreguntas: number;
};

export type ResultadoDominio = {
  dominioId: string;
  orden: number;
  nombre: string;
  promedio: number | null;
  nivel: NivelMadurez | null;
  respondidas: number;
  puntuables: number;
  totalPreguntas: number;
  avance: number; // % respondidas sobre total
};

export type ResultadoMadurez = {
  global: number | null;
  nivelGlobal: NivelMadurez | null;
  dominios: ResultadoDominio[];
  criticos: ResultadoDominio[]; // dominios peor evaluados (nivel CRITICO o BAJO)
  mejores: ResultadoDominio[];
};

function promedio(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function calcularMadurez(dominios: DominioInput[]): ResultadoMadurez {
  const resultados: ResultadoDominio[] = dominios.map((d) => {
    const puntuables = d.respuestas
      .map((r) => valorNumerico(r.valor))
      .filter((n): n is number => n != null);
    const respondidas = d.respuestas.filter((r) => r.valor != null).length;
    const prom = promedio(puntuables);
    return {
      dominioId: d.dominioId,
      orden: d.orden,
      nombre: d.nombre,
      promedio: prom,
      nivel: clasificarMadurez(prom),
      respondidas,
      puntuables: puntuables.length,
      totalPreguntas: d.totalPreguntas,
      avance: d.totalPreguntas > 0 ? Math.round((respondidas / d.totalPreguntas) * 100) : 0,
    };
  });

  // Global: promedio ponderado por número de preguntas puntuables.
  const todasPuntuables = dominios.flatMap((d) =>
    d.respuestas.map((r) => valorNumerico(r.valor)).filter((n): n is number => n != null)
  );
  const global = promedio(todasPuntuables);

  const conPromedio = resultados.filter((r) => r.promedio != null);
  const criticos = [...conPromedio]
    .filter((r) => r.nivel === "CRITICO" || r.nivel === "BAJO")
    .sort((a, b) => (a.promedio ?? 0) - (b.promedio ?? 0));
  const mejores = [...conPromedio].sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0)).slice(0, 3);

  return {
    global,
    nivelGlobal: clasificarMadurez(global),
    dominios: resultados,
    criticos,
    mejores,
  };
}
