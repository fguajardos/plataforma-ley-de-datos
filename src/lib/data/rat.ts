import "server-only";
import { prisma } from "@/lib/db";
import { faltantesDe, type CampoValidado, type TratamientoPlano } from "@/lib/rat";

// Lectura del RAT desde la base. Lo que el RAT exige y cómo se llama cada campo vive en
// `@/lib/rat`, sin "server-only", porque el editor lo necesita en el navegador.

export type DatoInventarioPlano = {
  codigo: string;
  categoria: string | null;
  nombre: string;
  titularPrincipal: string | null;
  areas: string | null;
  clasificacion: string | null;
  procesos: string | null;
};

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
  /** Cuántos datos del inventario están cargados: da o no da vocabulario al análisis. */
  datosInventariados: number;
  procesosMapeados: number;
  /** Actividades cuyo proceso ya tiene ficha de levantamiento cargada. */
  levantados: number;
};

/** Las columnas del registro, en el orden de la matriz. Se lee una sola vez. */
const SELECT_TRATAMIENTO = {
  id: true,
  codigo: true,
  nombre: true,
  areaId: true,
  area: { select: { nombre: true } },
  procesos: true,
  areaPropuesta: true,
  duenoProceso: true,
  finalidad: true,
  categoriasTitulares: true,
  categoriasDatos: true,
  idsInventario: true,
  datosInvolucrados: true,
  clasificacionDato: true,
  datosSensibles: true,
  origen: true,
  baseLegal: true,
  sistemas: true,
  encargados: true,
  destinatarios: true,
  transferenciaInternacional: true,
  paisesDestino: true,
  garantiasTransferencia: true,
  plazoConservacion: true,
  criterioEliminacion: true,
  decisionesAutomatizadas: true,
  medidasSeguridad: true,
  evaluarEipd: true,
  riesgoPreliminar: true,
  evidenciasSolicitar: true,
  fuenteDiseno: true,
  observaciones: true,
  estado: true,
  procesoId: true,
  proceso: { select: { codigo: true, nombre: true } },
  camposValidados: {
    select: { campo: true, contenido: true, validadoEn: true, validadoPor: { select: { nombre: true } } },
  },
} as const;

type FilaCruda = {
  area: { nombre: string } | null;
  proceso: { codigo: string; nombre: string } | null;
  camposValidados: {
    campo: string;
    contenido: string | null;
    validadoEn: Date;
    validadoPor: { nombre: string } | null;
  }[];
} & Record<string, unknown>;

function aplanar(t: FilaCruda, conFicha: Set<string>): TratamientoPlano {
  const { area, proceso, camposValidados, ...resto } = t;

  const validados: Record<string, CampoValidado> = {};
  for (const v of camposValidados) {
    // La firma vale sobre el texto que se firmó: si cambió, se dice.
    const actual = (resto as Record<string, unknown>)[v.campo];
    const vigente = (typeof actual === "string" ? actual : "") === (v.contenido ?? "");
    validados[v.campo] = {
      por: v.validadoPor?.nombre ?? null,
      en: v.validadoEn.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }),
      vigente,
    };
  }

  return {
    ...resto,
    areaNombre: area?.nombre ?? null,
    procesoCodigo: proceso?.codigo ?? null,
    procesoNombre: proceso?.nombre ?? null,
    levantado: Boolean(resto.procesoId) && conFicha.has(String(resto.procesoId)),
    validados,
  } as TratamientoPlano;
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
        select: SELECT_TRATAMIENTO,
        // Por código primero: la matriz numera las filas (RAT-001…) y el orden del archivo
        // que el cliente conoce tiene que ser el mismo que ve en pantalla.
        orderBy: [{ codigo: "asc" }, { nombre: "asc" }],
      },
      _count: { select: { inventario: true, procesos: true } },
    },
  });
  if (!empresa) return null;

  // Los procesos que ya tienen su ficha cargada: es lo que permite decir, fila por fila,
  // si el levantamiento de esa actividad está hecho o sigue pendiente.
  const conFicha = new Set(
    (
      await prisma.fichaProceso.findMany({
        where: { empresaId, procesoId: { not: null } },
        select: { procesoId: true },
        distinct: ["procesoId"],
      })
    ).map((f) => f.procesoId!)
  );

  const tratamientos = empresa.tratamientos.map((t) => aplanar(t as FilaCruda, conFicha));
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
    datosInventariados: empresa._count.inventario,
    procesosMapeados: empresa._count.procesos,
    levantados: tratamientos.filter((t) => t.levantado).length,
  };
}

/** El inventario de datos personales de la empresa, para la matriz y para el análisis. */
export async function inventarioDeEmpresa(empresaId: string): Promise<DatoInventarioPlano[]> {
  return prisma.datoInventario.findMany({
    where: { empresaId },
    select: {
      codigo: true,
      categoria: true,
      nombre: true,
      titularPrincipal: true,
      areas: true,
      clasificacion: true,
      procesos: true,
    },
    orderBy: { codigo: "asc" },
  });
}
