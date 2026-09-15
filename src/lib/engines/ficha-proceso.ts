// Lectura estructurada de una ficha de proceso.
//
// Las fichas que levanta Procesos360 no son documentos libres: traen hojas con nombre
// conocido —SIPOC, RECI— y dentro de ellas el proceso se declara textualmente. Eso permite
// sacar tres cosas SIN pasar por el modelo de lenguaje, que es más barato, instantáneo y,
// sobre todo, determinista: el mismo archivo da siempre el mismo resultado.
//
//   · el CÓDIGO del proceso   "Nombre del proceso: S-3.6 Cuentas por Pagar"
//   · los SUBPROCESOS          S-3.6.1 Recepcionar Documentos de Cobro, …
//   · los ROLES de la RECI     "Finanzas F. Villalón", "Compras C. Guzmán", …
//
// Lo que sí necesita el modelo es la parte de juicio: qué de todo eso es una actividad de
// tratamiento de datos personales. Esto le entrega el andamio para que no tenga que
// adivinarlo, y para que cuando proponga una actividad ya venga anclada a un proceso real.

/** Códigos del mapa de procesos: N-5.5, S-3.6, E-5.2, y sus subniveles S-3.6.1. */
const CODIGO = /\b([A-Z])-(\d+(?:\.\d+)*)\b/g;

export type LecturaFicha = {
  /** El código del proceso principal, si se pudo determinar. */
  codigoProceso: string | null;
  /** De dónde salió, para poder mostrarlo y que alguien lo confirme o lo corrija. */
  origen: string | null;
  /**
   * Qué tan fiable es la detección.
   *
   * Importa que se diga: hay fichas que traen hojas de OTRO proceso pegadas dentro —una
   * quedó con una hoja "S-11.2.4.1 Validar Cumplimiento Tributario" siendo la ficha de
   * Planificación del Portafolio— y en esos casos el código más repetido es el equivocado.
   * Una detección de baja confianza se muestra como propuesta, no como hecho.
   */
  confianza: "alta" | "media" | "baja" | null;
  /** Subprocesos declarados dentro del proceso: S-3.6.1, S-3.6.2… */
  subprocesos: { codigo: string; nombre: string }[];
  /** Los roles de la matriz RECI, tal como están escritos. */
  roles: string[];
};

const normalizar = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Deja una línea comparable.
 *
 * El texto extraído de un Excel une las celdas con "|", y la primera suele venir vacía:
 * la fila llega como "| Actividades / Roles | Finanzas …". Sin recortar ese borde, todo
 * lo que se ancle al principio de la línea falla en silencio.
 */
const limpiar = (linea: string) => normalizar(linea).replace(/^\|\s*/, "").replace(/\s*\|\s*$/, "");

/**
 * Normaliza un código a la forma del mapa de procesos: letra, guion, dos niveles.
 *
 * Los archivos no son consistentes: el mapa dice "S-3.6", el nombre de archivo escribe
 * "S_2.1" y uno de ellos llega como "N.1-1". Los tres apuntan a lo mismo.
 */
function normalizarCodigo(bruto: string): string | null {
  const m = bruto.toUpperCase().match(/([A-Z])[.\-_](\d+)(?:[.\-_](\d+))?/);
  if (!m) return null;
  return m[3] ? `${m[1]}-${m[2]}.${m[3]}` : `${m[1]}-${m[2]}`;
}

/**
 * Una fila de la ficha, con su hoja y sus celdas por separado.
 *
 * Las celdas NO se pegan en una sola cadena. La fila de roles de la matriz RECI trae una
 * celda por rol, varias combinadas entre sí, y aplanarla a texto pierde justamente lo que
 * se necesita: cuántas columnas hay y qué dice cada una.
 */
export type FilaFicha = { hoja: string; celdas: string[] };

/** La fila como una línea, para lo que sí se busca por texto. */
const comoLinea = (f: FilaFicha) => limpiar(f.celdas.join(" | "));

/** Las hojas donde el consultor declara el proceso a conciencia. */
const esHojaDeCabecera = (hoja: string) => /^(sipoc|md|ficha|portada|resumen)/i.test(hoja);

/**
 * El código del proceso que declara la ficha.
 *
 * Se busca primero en las hojas de cabecera —SIPOC y MD—, que es donde el consultor lo
 * escribió a propósito. Una declaración en cualquier otra hoja vale menos: puede venir de
 * una plantilla de otro proceso que quedó pegada en el mismo archivo.
 */
function codigoDeclarado(filas: FilaFicha[]): { codigo: string; origen: string; confianza: "alta" | "media" } | null {
  const declaraciones = filas
    .map((f) => ({ hoja: f.hoja, linea: comoLinea(f) }))
    .filter((f) => /nombre del proceso/i.test(f.linea));

  for (const preferidas of [true, false]) {
    for (const f of declaraciones) {
      if (esHojaDeCabecera(f.hoja) !== preferidas) continue;
      // Lo que viene después de "Nombre del proceso", que es donde está el código.
      const cola = f.linea.replace(/^.*?nombre del proceso\s*:?\s*/i, "");
      const codigo = normalizarCodigo(cola);
      if (codigo) {
        return {
          codigo,
          origen: `hoja ${f.hoja || "sin nombre"}`,
          confianza: preferidas ? "alta" : "media",
        };
      }
    }
  }
  return null;
}

/** El código más repetido del texto. Último recurso: dice poco y se equivoca fácil. */
function codigoMasPresente(filas: FilaFicha[]): string | null {
  const texto = filas.map(comoLinea).join("\n");
  const cuenta = new Map<string, number>();
  for (const m of texto.toUpperCase().matchAll(CODIGO)) {
    const partes = m[2].split(".");
    const codigo = `${m[1]}-${partes.slice(0, 2).join(".")}`;
    cuenta.set(codigo, (cuenta.get(codigo) ?? 0) + 1);
  }
  const orden = [...cuenta].sort((a, b) => b[1] - a[1]);
  return orden.length > 0 && orden[0][1] >= 3 ? orden[0][0] : null;
}

/**
 * Subprocesos declarados: las líneas que empiezan con un código de tercer nivel.
 *
 * Son los candidatos naturales a actividad de tratamiento —"S-3.6.1 Recepcionar Documentos
 * de Cobro"— porque el propio levantamiento ya los separó como pasos con entidad propia.
 */
function subprocesosDe(filas: FilaFicha[]): { codigo: string; nombre: string }[] {
  const vistos = new Map<string, string>();
  for (const f of filas) {
    const linea = comoLinea(f);
    const m = linea.match(/^([A-Z])-(\d+\.\d+\.\d+)\s+(.{3,120}?)(?:\s*\||$)/);
    if (m) {
      const codigo = `${m[1]}-${m[2]}`;
      if (!vistos.has(codigo)) vistos.set(codigo, normalizar(m[3]));
    }
  }
  return [...vistos].map(([codigo, nombre]) => ({ codigo, nombre }));
}

/**
 * Los roles de la matriz RECI.
 *
 * La fila de encabezado dice "Actividades / Roles" y a continuación, una por columna, las
 * áreas o personas que participan. Vienen mezcladas —"Finanzas F. Villalón" es un área y
 * una persona en la misma celda— y así se devuelven: normalizarlas aquí sería adivinar, y
 * para eso está la homologación, que la confirma una persona.
 */
function rolesDe(filas: FilaFicha[]): string[] {
  const encontrados: string[] = [];
  for (const f of filas) {
    // La celda que rotula la fila puede estar en cualquier columna: lo que importa es que
    // alguna diga "Actividades / Roles". El resto de esa fila son los roles.
    const i = f.celdas.findIndex((c) => /^actividades\s*\/?\s*roles/i.test(normalizar(c)));
    if (i < 0) continue;
    for (const celda of f.celdas.slice(i + 1).map(normalizar)) {
      if (celda.length > 1 && celda.length < 80) encontrados.push(celda);
    }
  }
  // Una celda combinada se desdobla repetida: las repeticiones se descartan aquí.
  return [...new Set(encontrados)];
}

/** Lee lo que la ficha declara sin ambigüedad. No interpreta: extrae. */
export function leerFicha(nombreArchivo: string, filas: FilaFicha[]): LecturaFicha {
  const declarado = codigoDeclarado(filas);
  const delNombre = normalizarCodigo(nombreArchivo);

  let codigo = declarado?.codigo ?? null;
  let origen = declarado?.origen ?? null;
  let confianza: LecturaFicha["confianza"] = declarado?.confianza ?? null;

  // El nombre del archivo desempata: si coincide con lo declarado, sube la confianza; si
  // la ficha no declaró nada, sirve de candidato.
  if (codigo && delNombre && codigo === delNombre) confianza = "alta";
  else if (!codigo && delNombre) {
    codigo = delNombre;
    origen = "nombre del archivo";
    confianza = "media";
  } else if (codigo && delNombre && codigo !== delNombre) {
    origen = `${origen} — el nombre del archivo dice ${delNombre}`;
    confianza = "baja";
  }

  if (!codigo) {
    const frecuente = codigoMasPresente(filas);
    if (frecuente) {
      codigo = frecuente;
      origen = "el código más repetido del texto";
      confianza = "baja";
    }
  }

  return {
    codigoProceso: codigo,
    origen: codigo ? origen : null,
    confianza: codigo ? confianza : null,
    subprocesos: subprocesosDe(filas),
    roles: rolesDe(filas),
  };
}

// ───────────────────────── Homologación de cargos ─────────────────────────

/** Forma comparable de un cargo: sin tildes, sin mayúsculas, sin puntuación. */
export function claveCargo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Quita del rol la persona que viene pegada.
 *
 * En la matriz RECI la columna dice "Finanzas F. Villalón": el área y quién la ocupa, en
 * la misma celda. Para homologar interesa el rol, no la persona —la persona cambia y el
 * cargo queda—, así que se recorta lo que parece un nombre propio abreviado.
 */
export function sinPersona(rol: string): string {
  // Una inicial con punto y lo que le siga en mayúsculas: "J. Gaete", y también los
  // apellidos compuestos, "M. San Martín", que con un solo apellido dejaban "Martín"
  // pegado al cargo.
  const limpio = normalizar(rol.replace(/[A-ZÁÉÍÓÚÑ]\.(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}/g, ""));
  return limpio || normalizar(rol);
}

export type Candidato = { texto: string; fuente: string };

/**
 * Agrupa formas de escribir que probablemente son el mismo cargo.
 *
 * La propuesta se queda corta a propósito: agrupa lo que coincide tras quitar tildes,
 * mayúsculas y la persona pegada, y nada más. Agrupar por parecido —"Jefe de CRM" con
 * "Jefe de Desarrollo"— produciría fusiones que nadie pidió y que después hay que
 * deshacer a mano, y una homologación equivocada es peor que ninguna: el RAT terminaría
 * diciendo que responde por el tratamiento alguien que no responde.
 */
export function agruparCargos(candidatos: Candidato[]): { sugerido: string; variantes: Candidato[] }[] {
  const grupos = new Map<string, Candidato[]>();
  for (const c of candidatos) {
    const texto = normalizar(c.texto);
    if (!texto) continue;
    const clave = claveCargo(sinPersona(texto));
    if (!clave) continue;
    grupos.set(clave, [...(grupos.get(clave) ?? []), { ...c, texto }]);
  }

  return [...grupos.values()]
    .map((variantes) => ({
      // Se propone la forma más larga: suele ser la más específica ("Encargada de Compra"
      // gana a "Compras"), y es más fácil acortar un nombre que reconstruirlo.
      sugerido: [...variantes].sort((a, b) => b.texto.length - a.texto.length)[0].texto,
      variantes,
    }))
    .sort((a, b) => b.variantes.length - a.variantes.length || a.sugerido.localeCompare(b.sugerido));
}
