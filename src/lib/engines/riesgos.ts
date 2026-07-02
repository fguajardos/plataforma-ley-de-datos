// Motor de Riesgos — traduce brechas en riesgos de privacidad/cumplimiento (Documento Funcional Base §11).
// Cada brecha genera un riesgo con probabilidad/impacto derivados de su criticidad y nivel calculado.

import { nivelRiesgo, type Criticidad } from "@/lib/constants";

export type BrechaRiesgoInput = {
  brechaId: string;
  codigo: string;
  descripcion: string;
  tipo: "REGULATORIA" | "DOCUMENTAL" | "TECNOLOGICA" | "OPERACIONAL";
  criticidad: string;
  dominio: { orden: number; nombre: string };
};

export type RiesgoGenerado = {
  brechaId: string;
  descripcion: string;
  causa: string;
  consecuencia: string;
  probabilidad: "BAJA" | "MEDIA" | "ALTA";
  impacto: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
  nivel: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
  controlExistente: string;
  mitigacion: string;
};

const PROB_POR_CRIT: Record<Criticidad, "BAJA" | "MEDIA" | "ALTA"> = {
  CRITICA: "ALTA",
  ALTA: "ALTA",
  MEDIA: "MEDIA",
  BAJA: "BAJA",
};

const IMPACTO_POR_CRIT: Record<Criticidad, "BAJO" | "MEDIO" | "ALTO" | "CRITICO"> = {
  CRITICA: "CRITICO",
  ALTA: "ALTO",
  MEDIA: "MEDIO",
  BAJA: "BAJO",
};

// Consecuencia esperada según el tipo de brecha.
const CONSECUENCIA_POR_TIPO: Record<BrechaRiesgoInput["tipo"], string> = {
  REGULATORIA: "Sanción administrativa o multa por incumplimiento de la Ley N° 21.719.",
  DOCUMENTAL: "Imposibilidad de demostrar accountability ante fiscalización o titulares.",
  TECNOLOGICA: "Exposición o filtración de datos personales por controles técnicos insuficientes.",
  OPERACIONAL: "Tratamiento de datos sin control efectivo, con impacto en derechos de los titulares.",
};

export function evaluarRiesgo(b: BrechaRiesgoInput): RiesgoGenerado {
  const crit = (b.criticidad as Criticidad) ?? "MEDIA";
  const probabilidad = PROB_POR_CRIT[crit] ?? "MEDIA";
  const impacto = IMPACTO_POR_CRIT[crit] ?? "MEDIO";
  return {
    brechaId: b.brechaId,
    descripcion: `Riesgo derivado de ${b.codigo} (D${b.dominio.orden} · ${b.dominio.nombre}): ${b.descripcion}`,
    causa: `Brecha ${b.tipo.toLowerCase()} detectada en el dominio ${b.dominio.nombre}.`,
    consecuencia: CONSECUENCIA_POR_TIPO[b.tipo],
    probabilidad,
    impacto,
    nivel: nivelRiesgo(probabilidad, impacto),
    controlExistente: "",
    mitigacion: "Ejecutar la acción de tratamiento asociada a la brecha para cerrar el control.",
  };
}

export function generarRiesgos(brechas: BrechaRiesgoInput[]): RiesgoGenerado[] {
  return brechas.map(evaluarRiesgo);
}
