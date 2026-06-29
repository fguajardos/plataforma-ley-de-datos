// Motor de Brechas — genera brechas a partir de las respuestas que incumplen el estándar.
// Regla base (Documento Funcional Base §10.2): generan brecha las respuestas 0, 1 o 2,
// N/A sin justificación, y la ausencia de evidencia obligatoria.

import { criticidadPorValor, generaBrechaPreliminar } from "@/lib/constants";

export type RespuestaBrechaInput = {
  respuestaId: string;
  valor: string | null;
  comentario: string | null;
  tieneEvidencia: boolean;
  pregunta: {
    orden: number;
    texto: string;
    evidenciaObligatoria: boolean;
  };
  dominio: {
    orden: number;
    nombre: string;
  };
};

export type BrechaGenerada = {
  respuestaId: string;
  codigo: string;
  descripcion: string;
  tipo: "REGULATORIA" | "DOCUMENTAL" | "TECNOLOGICA" | "OPERACIONAL";
  criticidad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  accionRecomendada: string;
  evidenciaEsperada: string;
};

function codigoBrecha(dominioOrden: number, preguntaOrden: number): string {
  return `BR-D${dominioOrden}-P${String(preguntaOrden).padStart(2, "0")}`;
}

/** Determina si una respuesta debe generar brecha y la construye. */
export function evaluarBrecha(r: RespuestaBrechaInput): BrechaGenerada | null {
  const esBrechaPorValor = generaBrechaPreliminar(r.valor);
  const esNaSinJustificacion = r.valor === "N_A" && !r.comentario?.trim();
  const faltaEvidenciaObligatoria =
    r.pregunta.evidenciaObligatoria &&
    !r.tieneEvidencia &&
    ["3", "4", "5"].includes(r.valor ?? "");

  if (!esBrechaPorValor && !esNaSinJustificacion && !faltaEvidenciaObligatoria) return null;

  let descripcion: string;
  let tipo: BrechaGenerada["tipo"] = "REGULATORIA";
  let criticidad: BrechaGenerada["criticidad"] = "MEDIA";

  if (esBrechaPorValor && r.valor) {
    descripcion = `Cumplimiento insuficiente: "${r.pregunta.texto}"`;
    criticidad = criticidadPorValor(r.valor);
  } else if (esNaSinJustificacion) {
    descripcion = `Respuesta "No Aplica" sin justificación: "${r.pregunta.texto}"`;
    tipo = "DOCUMENTAL";
    criticidad = "MEDIA";
  } else {
    descripcion = `Falta evidencia obligatoria para: "${r.pregunta.texto}"`;
    tipo = "DOCUMENTAL";
    criticidad = "ALTA";
  }

  return {
    respuestaId: r.respuestaId,
    codigo: codigoBrecha(r.dominio.orden, r.pregunta.orden),
    descripcion,
    tipo,
    criticidad,
    accionRecomendada: `Implementar y formalizar el control asociado a: ${r.pregunta.texto}`,
    evidenciaEsperada: "Política, procedimiento o registro que acredite el control.",
  };
}

export function generarBrechas(respuestas: RespuestaBrechaInput[]): BrechaGenerada[] {
  return respuestas
    .map(evaluarBrecha)
    .filter((b): b is BrechaGenerada => b !== null);
}
