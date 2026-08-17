// Avance del levantamiento, en la forma exacta que necesita mostrarlo: un porcentaje
// global y el detalle por dominio.
//
// Vive aparte del motor de madurez a propósito: madurez responde "qué tan bien está la
// empresa" y esto responde "cuánto del trabajo se ha hecho". Son dos preguntas
// distintas y se muestran en momentos distintos.
//
// Lo consumen el panel y —más adelante— el correo de reporte, así que devuelve datos
// planos, sin nada atado a la interfaz.

import { prisma } from "@/lib/db";
import { respuestaCompleta } from "@/lib/constants";

const CERRADOS = ["EN_VALIDACION", "COMPLETADO"];

export type AvanceDominio = {
  orden: number;
  nombre: string;
  total: number;
  completas: number;
  porcentaje: number;
  estado: string;
  cerrado: boolean; // ya enviado a validación
};

export type AvanceDiagnostico = {
  id: string;
  nombre: string;
  empresa: string;
  total: number;
  completas: number;
  porcentaje: number;
  dominios: AvanceDominio[];
  dominiosCerrados: number;
  evidencias: number;
  participantes: number;
  participantesActivos: number;
};

function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export async function avanceDelDiagnostico(diagnosticoId: string): Promise<AvanceDiagnostico | null> {
  const diag = await prisma.diagnostico.findUnique({
    where: { id: diagnosticoId },
    select: {
      id: true,
      nombre: true,
      empresa: { select: { razonSocial: true } },
      dominios: {
        where: { incluido: true },
        orderBy: { dominio: { orden: "asc" } },
        select: {
          estado: true,
          dominio: { select: { orden: true, nombre: true } },
          participantes: { select: { userId: true } },
          respuestas: {
            select: {
              valor: true,
              comentario: true,
              pregunta: { select: { evidenciaObligatoria: true } },
              evidencias: { select: { archivoPath: true } },
              aportes: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (!diag) return null;

  const dominios: AvanceDominio[] = [];
  let total = 0;
  let completas = 0;
  let evidencias = 0;
  const personas = new Set<string>();
  const activas = new Set<string>();

  for (const dd of diag.dominios) {
    const t = dd.respuestas.length;
    const c = dd.respuestas.filter((r) =>
      respuestaCompleta({
        valor: r.valor,
        comentario: r.comentario,
        evidenciaObligatoria: r.pregunta.evidenciaObligatoria,
        tieneEvidencia: r.evidencias.some((e) => e.archivoPath),
      })
    ).length;

    total += t;
    completas += c;
    for (const r of dd.respuestas) {
      evidencias += r.evidencias.filter((e) => e.archivoPath).length;
      for (const a of r.aportes) activas.add(a.userId);
    }
    for (const p of dd.participantes) personas.add(p.userId);

    dominios.push({
      orden: dd.dominio.orden,
      nombre: dd.dominio.nombre,
      total: t,
      completas: c,
      porcentaje: pct(c, t),
      estado: dd.estado,
      cerrado: CERRADOS.includes(dd.estado),
    });
  }

  return {
    id: diag.id,
    nombre: diag.nombre,
    empresa: diag.empresa.razonSocial,
    total,
    completas,
    porcentaje: pct(completas, total),
    dominios,
    dominiosCerrados: dominios.filter((d) => d.cerrado).length,
    evidencias,
    participantes: personas.size,
    participantesActivos: activas.size,
  };
}
