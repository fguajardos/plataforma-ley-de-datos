import "server-only";

// Extracción de texto de documentos de Office.
//
// La API del modelo solo ingiere PDF e imágenes. Un Word o un Excel mandados tal cual
// producen un error opaco, así que hasta ahora se descartaban —y las fichas de proceso
// llegan justamente en Word—.
//
// La salida es texto, no una imagen del documento. Para un formato estructurado eso es
// mejor y no peor: se lee el contenido real en vez de una representación visual, y cuesta
// una fracción de los tokens. Lo que se pierde es la maquetación, que en una ficha de
// proceso o una planilla de inventario no aporta.

/** Un prompt gigante no mejora la extracción y sí puede reventar el presupuesto. */
const MAX_CARACTERES = 40_000;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type Extraccion =
  | { ok: true; texto: string; truncado: boolean }
  | { ok: false; motivo: string };

/** ¿Es un formato de Office del que sabemos sacar texto? */
export function esOfficeLegible(mimeType: string | null): boolean {
  return mimeType === DOCX || mimeType === XLSX;
}

/**
 * Formatos que NO se pueden leer y hay que exportar a PDF.
 *
 * Se distinguen de los legibles para poder decírselo al consultor con precisión: "este
 * Word sí se lee, este .doc antiguo no" es una instrucción accionable; "puede que no
 * funcione" no lo es.
 */
export function motivoNoLegible(mimeType: string | null): string | null {
  if (!mimeType) return "sin tipo de archivo reconocible";
  if (mimeType === "application/msword") return "es un .doc antiguo";
  if (mimeType === "application/vnd.ms-excel") return "es un .xls antiguo";
  if (mimeType.includes("presentationml")) return "es una presentación";
  return null;
}

function recortar(texto: string): { texto: string; truncado: boolean } {
  const limpio = texto.replace(/\n{3,}/g, "\n\n").trim();
  return limpio.length > MAX_CARACTERES
    ? { texto: limpio.slice(0, MAX_CARACTERES), truncado: true }
    : { texto: limpio, truncado: false };
}

async function deWord(buf: Buffer): Promise<Extraccion> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  if (!value.trim()) return { ok: false, motivo: "el documento no tiene texto" };
  return { ok: true, ...recortar(value) };
}

async function deExcel(buf: Buffer): Promise<Extraccion> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buf as unknown as ArrayBuffer);

  const partes: string[] = [];
  libro.eachSheet((hoja) => {
    // El nombre de la hoja suele ser el que da el contexto —"Sistemas", "Flujos"— y sin
    // él las filas de dos planillas distintas se leen como una sola tabla.
    partes.push(`## Hoja: ${hoja.name}`);
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: string[] = [];
      fila.eachCell({ includeEmpty: true }, (celda) => {
        const v = celda.value;
        if (v === null || v === undefined) celdas.push("");
        else if (typeof v === "object" && "text" in v) celdas.push(String(v.text));
        else if (typeof v === "object" && "result" in v) celdas.push(String(v.result ?? ""));
        else if (v instanceof Date) celdas.push(v.toISOString().slice(0, 10));
        else celdas.push(String(v));
      });
      // Filas vacías de relleno: no aportan y ocupan presupuesto.
      if (celdas.some((c) => c.trim())) partes.push(celdas.join(" | "));
    });
  });

  if (partes.length === 0) return { ok: false, motivo: "la planilla está vacía" };
  return { ok: true, ...recortar(partes.join("\n")) };
}

/** Saca el texto de un Word o un Excel. Devuelve el motivo si no se puede. */
export async function extraerTexto(buf: Buffer, mimeType: string | null): Promise<Extraccion> {
  try {
    if (mimeType === DOCX) return await deWord(buf);
    if (mimeType === XLSX) return await deExcel(buf);
    return { ok: false, motivo: motivoNoLegible(mimeType) ?? "formato no soportado" };
  } catch (e) {
    // Un archivo corrupto o protegido con contraseña no puede tumbar el análisis entero.
    return { ok: false, motivo: `no se pudo leer: ${(e as Error).message.slice(0, 80)}` };
  }
}
