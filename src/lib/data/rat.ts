import "server-only";
import { prisma } from "@/lib/db";
import { faltantesDe, type TratamientoPlano } from "@/lib/rat";

// Lectura del RAT desde la base. Lo que el RAT exige y cómo se llama cada campo vive en
// `@/lib/rat`, sin "server-only", porque el editor lo necesita en el navegador.

export type RatEmpresa = {
  empresaId: string;
  empresa: string;
  tratamientos: TratamientoPlano[];
  /** Áreas que declararon tratar datos y todavía no tienen ninguna actividad registrada. */
  areasSinTratamiento: { id: string; nombre: string; sensibles: boolean }[];
  areasQueTratanDatos: number;
  completos: number;
  conSensibles: number;
  conTransferencia: number;
};

function aplanar(t: {
  id: string;
  nombre: string;
  areaId: string | null;
  area: { nombre: string } | null;
  finalidad: string | null;
  categoriasTitulares: string | null;
  categoriasDatos: string | null;
  datosSensibles: boolean;
  baseLegal: string | null;
  origen: string | null;
  destinatarios: string | null;
  encargados: string | null;
  sistemas: string | null;
  transferenciaInternacional: boolean;
  paisesDestino: string | null;
  garantiasTransferencia: string | null;
  plazoConservacion: string | null;
  medidasSeguridad: string | null;
  estado: string;
}): TratamientoPlano {
  return { ...t, areaNombre: t.area?.nombre ?? null };
}

export async function ratDeEmpresa(empresaId: string): Promise<RatEmpresa | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      razonSocial: true,
      areas: {
        where: { trataDatos: true },
        select: { id: true, nombre: true, trataDatosSensibles: true },
        orderBy: { nombre: "asc" },
      },
      tratamientos: {
        select: {
          id: true,
          nombre: true,
          areaId: true,
          area: { select: { nombre: true } },
          finalidad: true,
          categoriasTitulares: true,
          categoriasDatos: true,
          datosSensibles: true,
          baseLegal: true,
          origen: true,
          destinatarios: true,
          encargados: true,
          sistemas: true,
          transferenciaInternacional: true,
          paisesDestino: true,
          garantiasTransferencia: true,
          plazoConservacion: true,
          medidasSeguridad: true,
          estado: true,
        },
        orderBy: [{ area: { nombre: "asc" } }, { nombre: "asc" }],
      },
    },
  });
  if (!empresa) return null;

  const tratamientos = empresa.tratamientos.map(aplanar);
  const conActividad = new Set(tratamientos.map((t) => t.areaId).filter(Boolean));

  return {
    empresaId: empresa.id,
    empresa: empresa.razonSocial,
    tratamientos,
    areasSinTratamiento: empresa.areas
      .filter((a) => !conActividad.has(a.id))
      .map((a) => ({ id: a.id, nombre: a.nombre, sensibles: a.trataDatosSensibles })),
    areasQueTratanDatos: empresa.areas.length,
    completos: tratamientos.filter((t) => faltantesDe(t).length === 0).length,
    conSensibles: tratamientos.filter((t) => t.datosSensibles).length,
    conTransferencia: tratamientos.filter((t) => t.transferenciaInternacional).length,
  };
}
