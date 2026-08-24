
// Qué exige el Registro de Actividades de Tratamiento, y cómo se llama cada cosa.
//
// Vive aparte de las consultas a la base porque lo usan tres piezas que tienen que decir
// exactamente lo mismo: la pantalla de requisitos que le explica al cliente qué reunir,
// el editor donde lo completa —que corre en el navegador— y el archivo que se descarga.
// Si divergen, el cliente completa una cosa y entrega otra.

/**
 * Solo los campos de texto que el usuario llena. Deja fuera lo derivado (`areaNombre`) y
 * lo que tiene su propio control —área, estado, y las dos casillas de sí/no—, que no se
 * dibujan como cuadro de texto.
 */
export type CampoClave =
  | "nombre"
  | "finalidad"
  | "categoriasTitulares"
  | "categoriasDatos"
  | "baseLegal"
  | "origen"
  | "destinatarios"
  | "encargados"
  | "sistemas"
  | "paisesDestino"
  | "garantiasTransferencia"
  | "plazoConservacion"
  | "medidasSeguridad";

export type CampoRat = {
  clave: CampoClave;
  etiqueta: string;
  /** Qué se espera ahí, en el lenguaje de quien lo tiene que llenar. */
  ayuda: string;
  ejemplo: string;
  /** Sin esto, la actividad no está documentada: la ley lo exige por cada tratamiento. */
  obligatorio: boolean;
  ancho: "corto" | "largo";
};

export type TratamientoPlano = {
  id: string;
  nombre: string;
  areaId: string | null;
  areaNombre: string | null;
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
};

/**
 * Lo que la Ley 21.719 exige documentar por cada actividad de tratamiento.
 *
 * `obligatorio` marca lo que sin excepción tiene que estar. El resto depende del caso
 * —los países de destino solo aplican si hay transferencia internacional— y por eso no
 * se cuentan como faltantes.
 */
export const CAMPOS_RAT: CampoRat[] = [
  {
    clave: "nombre",
    etiqueta: "Actividad de tratamiento",
    ayuda: "Cómo se llama internamente lo que se hace con los datos.",
    ejemplo: "Ficha de cliente en Salesforce",
    obligatorio: true,
    ancho: "corto",
  },
  {
    clave: "finalidad",
    etiqueta: "Finalidad",
    ayuda: "Para qué se usan esos datos. Si hay varias finalidades, van todas.",
    ejemplo: "Gestionar la postventa y contactar al cliente por campañas de servicio.",
    obligatorio: true,
    ancho: "largo",
  },
  {
    clave: "categoriasTitulares",
    etiqueta: "Titulares",
    ayuda: "De quiénes son los datos.",
    ejemplo: "Clientes, trabajadores, postulantes, contactos de proveedores",
    obligatorio: true,
    ancho: "corto",
  },
  {
    clave: "categoriasDatos",
    etiqueta: "Categorías de datos",
    ayuda: "Qué datos se tratan, agrupados por tipo.",
    ejemplo: "Identificación, contacto, datos del vehículo, historial de compras",
    obligatorio: true,
    ancho: "largo",
  },
  {
    clave: "baseLegal",
    etiqueta: "Base legal",
    ayuda:
      "Qué permite tratarlos: consentimiento, ejecución de un contrato, obligación legal o interés legítimo.",
    ejemplo: "Ejecución del contrato de compraventa",
    obligatorio: true,
    ancho: "corto",
  },
  {
    clave: "origen",
    etiqueta: "Origen de los datos",
    ayuda: "De dónde salieron.",
    ejemplo: "Entregados por el propio titular al comprar",
    obligatorio: false,
    ancho: "corto",
  },
  {
    clave: "destinatarios",
    etiqueta: "Destinatarios",
    ayuda: "A quién se le comunican, dentro y fuera de la empresa.",
    ejemplo: "Concesionarios de la red, Servicio de Impuestos Internos",
    obligatorio: true,
    ancho: "largo",
  },
  {
    clave: "encargados",
    etiqueta: "Encargados",
    ayuda: "Terceros que tratan los datos por cuenta de la empresa.",
    ejemplo: "Salesforce (CRM), empresa de call center",
    obligatorio: false,
    ancho: "corto",
  },
  {
    clave: "sistemas",
    etiqueta: "Sistemas",
    ayuda: "Dónde viven los datos. Vale también la planilla en un computador.",
    ejemplo: "Salesforce, SAP, planillas en OneDrive del área",
    obligatorio: false,
    ancho: "corto",
  },
  {
    clave: "paisesDestino",
    etiqueta: "Países de destino",
    ayuda: "Solo si hay transferencia internacional.",
    ejemplo: "Estados Unidos (servidores del CRM), Japón (casa matriz)",
    obligatorio: false,
    ancho: "corto",
  },
  {
    clave: "garantiasTransferencia",
    etiqueta: "Garantías de la transferencia",
    ayuda: "Qué protege esos datos al salir del país. Solo si hay transferencia.",
    ejemplo: "Cláusulas contractuales tipo con la casa matriz",
    obligatorio: false,
    ancho: "largo",
  },
  {
    clave: "plazoConservacion",
    etiqueta: "Plazo de conservación",
    ayuda: "Cuánto tiempo se guardan y qué pasa después. \"Indefinido\" no es un plazo.",
    ejemplo: "5 años desde el término de la garantía; luego se eliminan",
    obligatorio: true,
    ancho: "corto",
  },
  {
    clave: "medidasSeguridad",
    etiqueta: "Medidas de seguridad",
    ayuda: "Qué los protege: control de acceso, cifrado, respaldos, confidencialidad.",
    ejemplo: "Acceso por perfil en el CRM, cifrado en reposo, respaldo diario",
    obligatorio: true,
    ancho: "largo",
  },
];

const OBLIGATORIOS = CAMPOS_RAT.filter((c) => c.obligatorio);

/** Campos obligatorios que esta actividad todavía no tiene. */
export function faltantesDe(t: TratamientoPlano): CampoRat[] {
  return OBLIGATORIOS.filter((c) => {
    const v = t[c.clave];
    return typeof v === "string" ? v.trim() === "" : v == null;
  });
}
