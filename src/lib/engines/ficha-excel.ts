import "server-only";
import type { FilaFicha } from "@/lib/engines/ficha-proceso";

// Convierte una ficha en Excel a filas con sus celdas separadas.
//
// Existe aparte del extractor de texto porque resuelve dos cosas que el texto plano
// pierde, y que son justamente las que la ficha usa:
//
//   · Las CELDAS COMBINADAS. La fila de roles de la matriz RECI combina varias columnas;
//     al leerlas, solo la primera trae valor y el resto vuelve vacía. Aquí se recupera el
//     valor de la celda maestra, que es lo que un humano ve en pantalla.
//   · El ANCHO REAL de la fila. Se recorre hasta la última columna de la hoja y no hasta
//     la última celda con contenido, porque una fila que empieza con huecos se leería
//     corrida una columna.

const MAX_FILAS = 400;

/** El texto de una celda, resolviendo fórmulas, texto con formato y combinaciones. */
function texto(celda: import("exceljs").Cell): string {
  const c = celda.isMerged && celda.master ? celda.master : celda;
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if ("result" in o) return String(o.result ?? "");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v);
}

export async function filasDeFicha(buf: Buffer): Promise<FilaFicha[]> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buf as unknown as ArrayBuffer);

  const filas: FilaFicha[] = [];
  libro.eachSheet((hoja) => {
    const ancho = Math.max(1, Math.min(hoja.columnCount, 40));
    let leidas = 0;
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      if (leidas++ > MAX_FILAS) return;
      const celdas: string[] = [];
      for (let c = 1; c <= ancho; c++) celdas.push(texto(fila.getCell(c)).replace(/\s+/g, " ").trim());
      if (celdas.some(Boolean)) filas.push({ hoja: hoja.name, celdas });
    });
  });
  return filas;
}
