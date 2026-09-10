// Exporta a Excel las respuestas de cada participante, pregunta por pregunta, para la
// sesión de calibración.
//
// No es un volcado. Una calibración necesita responder dos preguntas, y ninguna se ve en
// una lista plana:
//
//   1. ¿DÓNDE discrepan? La hoja "Calibración" trae una fila por pregunta con las notas
//      que dio cada uno, ordenada por dispersión: arriba queda lo que hay que discutir
//      primero, y abajo lo que ya está de acuerdo y no vale la reunión.
//
//   2. ¿QUIÉN puntúa distinto? La hoja "Sesgo por persona" compara la nota de cada
//      participante contra el promedio del grupo EN LAS MISMAS preguntas. Un sesgo de
//      -1,2 no significa que esa persona se equivoque: significa que mira la misma
//      práctica con una vara más dura, y eso es exactamente lo que una calibración
//      alinea.
//
// La hoja "Respuestas" queda en formato largo —una fila por participante y pregunta— para
// poder dinamizarla sin pelear con celdas combinadas.
//
// Uso:
//   npx tsx prisma/exportar-calibracion.ts --empresa HONDA
//   npx tsx prisma/exportar-calibracion.ts --empresa 96.870.620-9 --salida "C:/ruta.xlsx"
//   npx tsx prisma/exportar-calibracion.ts --uat --empresa Demo

import { readFileSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const bandera = (n: string) => args.includes(`--${n}`);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const usarUat = bandera("uat");
for (const line of readFileSync(join(__dirname, "..", usarUat ? ".env.uat" : ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { ESCALA, type Valor } from "../src/lib/constants";

const prisma = new PrismaClient();

/** Solo 0-5 puntúa. N/A y Otro quedan fuera del promedio, igual que en el motor. */
const nota = (v: string | null): number | null => (v && /^[0-5]$/.test(v) ? Number(v) : null);
const etiqueta = (v: string | null): string =>
  !v ? "sin responder" : v === "N_A" ? "N/A" : v === "OTRO" ? "Otro" : `${v} · ${ESCALA[v as Valor]?.estado ?? ""}`;

/**
 * Nombre corto que sigue siendo único.
 *
 * En Honda hay dos Carolinas y dos Pablos: abreviar al nombre de pila deja la columna de
 * notas ilegible justo donde más importa —"Pablo 2 · Pablo 5" no le sirve a nadie en una
 * reunión de calibración—. Se agrega la inicial del apellido.
 */
function corto(nombre: string): string {
  const [pila, apellido] = nombre.trim().split(/\s+/);
  return apellido ? `${pila} ${apellido[0]}.` : pila;
}

const OSCURO = { argb: "FF1E293B" };
function encabezar(hoja: ExcelJS.Worksheet, columnas: number) {
  const f = hoja.getRow(1);
  f.font = { bold: true, color: { argb: "FFFFFFFF" } };
  f.fill = { type: "pattern", pattern: "solid", fgColor: OSCURO };
  f.alignment = { vertical: "middle", wrapText: true };
  f.height = 28;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas } };
}

/** Color de la celda de dispersión: lo que más separa, primero a la vista. */
function pintarDispersion(celda: ExcelJS.Cell, d: number) {
  if (d >= 3) celda.font = { bold: true, color: { argb: "FFDC2626" } };
  else if (d >= 2) celda.font = { bold: true, color: { argb: "FFEA580C" } };
  else if (d >= 1) celda.font = { color: { argb: "FFCA8A04" } };
  else celda.font = { color: { argb: "FF94A3B8" } };
}

async function main() {
  const buscada = opcion("empresa");
  if (!buscada) {
    console.error("Falta --empresa <rut o razón social>.");
    process.exit(1);
  }

  const empresa = await prisma.empresa.findFirst({
    where: { OR: [{ rut: buscada }, { razonSocial: { contains: buscada, mode: "insensitive" } }] },
    select: { id: true, razonSocial: true, rut: true },
  });
  if (!empresa) {
    console.error(`No se encontró la empresa "${buscada}".`);
    process.exit(1);
  }

  const dds = await prisma.diagnosticoDominio.findMany({
    where: { incluido: true, diagnostico: { empresaId: empresa.id } },
    orderBy: { dominio: { orden: "asc" } },
    select: {
      estado: true,
      dominio: { select: { orden: true, nombre: true } },
      respuestas: {
        orderBy: { pregunta: { orden: "asc" } },
        select: {
          valor: true,
          comentario: true,
          estado: true,
          consolidadaManual: true,
          pregunta: { select: { orden: true, texto: true, evidenciaObligatoria: true } },
          aportes: {
            orderBy: { user: { nombre: "asc" } },
            select: {
              valor: true,
              comentario: true,
              riesgoIdentificado: true,
              user: { select: { nombre: true, cargo: true } },
              corregidoPor: { select: { nombre: true } },
              corregidoEn: true,
            },
          },
        },
      },
    },
  });

  const libro = new ExcelJS.Workbook();
  libro.creator = "Procesos360";
  libro.created = new Date();

  // ── Hoja 1: respuestas en formato largo ──
  const hr = libro.addWorksheet("Respuestas");
  hr.columns = [
    { header: "Dominio", key: "dom", width: 34 },
    { header: "N°", key: "np", width: 5 },
    { header: "Pregunta", key: "preg", width: 62 },
    { header: "Participante", key: "quien", width: 26 },
    { header: "Cargo", key: "cargo", width: 30 },
    { header: "Nota", key: "n", width: 7 },
    { header: "Nivel", key: "niv", width: 22 },
    { header: "Comentario del participante", key: "com", width: 66 },
    { header: "Riesgo identificado", key: "riesgo", width: 34 },
    { header: "Corregido por", key: "corr", width: 22 },
    { header: "Nota oficial del dominio", key: "of", width: 12 },
    { header: "¿Exige evidencia?", key: "ev", width: 12 },
  ];
  encabezar(hr, 12);

  // ── Recolección para las otras dos hojas ──
  type FilaCal = {
    dom: string; np: number; preg: string;
    notas: { quien: string; n: number }[];
    otras: string[]; // N/A, Otro o sin responder
    oficial: string | null; fijada: boolean;
  };
  const calibracion: FilaCal[] = [];
  const desvios = new Map<string, { cargo: string | null; suma: number; n: number; notas: number[] }>();

  for (const dd of dds) {
    const dom = `${dd.dominio.orden}. ${dd.dominio.nombre}`;
    for (const r of dd.respuestas) {
      const conNota: { quien: string; n: number }[] = [];
      const otras: string[] = [];

      for (const a of r.aportes) {
        const n = nota(a.valor);
        const quien = a.user.nombre;
        if (n != null) conNota.push({ quien, n });
        else otras.push(`${quien}: ${etiqueta(a.valor)}`);

        hr.addRow({
          dom,
          np: r.pregunta.orden,
          preg: r.pregunta.texto,
          quien,
          cargo: a.user.cargo ?? "",
          n: n ?? "",
          niv: etiqueta(a.valor),
          com: a.comentario ?? "",
          riesgo: a.riesgoIdentificado ?? "",
          corr: a.corregidoPor
            ? `${a.corregidoPor.nombre}${a.corregidoEn ? ` · ${a.corregidoEn.toLocaleDateString("es-CL")}` : ""}`
            : "",
          of: r.valor ?? "",
          ev: r.pregunta.evidenciaObligatoria ? "Sí" : "No",
        }).alignment = { vertical: "top", wrapText: true };
      }

      calibracion.push({
        dom, np: r.pregunta.orden, preg: r.pregunta.texto,
        notas: conNota, otras,
        oficial: r.valor, fijada: r.consolidadaManual,
      });

      // El sesgo solo tiene sentido donde hay con quién compararse.
      if (conNota.length >= 2) {
        const media = conNota.reduce((s, x) => s + x.n, 0) / conNota.length;
        for (const x of conNota) {
          const cargo = r.aportes.find((a) => a.user.nombre === x.quien)?.user.cargo ?? null;
          const acc = desvios.get(x.quien) ?? { cargo, suma: 0, n: 0, notas: [] };
          acc.suma += x.n - media;
          acc.n += 1;
          acc.notas.push(x.n);
          desvios.set(x.quien, acc);
        }
      }
    }
  }

  // ── Hoja 2: la agenda de la calibración ──
  const hc = libro.addWorksheet("Calibración");
  hc.columns = [
    { header: "Dispersión", key: "disp", width: 11 },
    { header: "Dominio", key: "dom", width: 34 },
    { header: "N°", key: "np", width: 5 },
    { header: "Pregunta", key: "preg", width: 62 },
    { header: "Respondieron", key: "cuantos", width: 12 },
    { header: "Notas dadas", key: "notas", width: 34 },
    { header: "Mín", key: "min", width: 6 },
    { header: "Máx", key: "max", width: 6 },
    { header: "Promedio", key: "prom", width: 10 },
    { header: "Oficial (la más baja)", key: "of", width: 12 },
    { header: "Sin nota (N/A, Otro, sin responder)", key: "otras", width: 40 },
  ];
  encabezar(hc, 11);

  // Ordenada por dispersión: la reunión empieza por donde más se separan.
  const ordenada = [...calibracion].sort((a, b) => {
    const d = (x: FilaCal) => (x.notas.length >= 2 ? Math.max(...x.notas.map((y) => y.n)) - Math.min(...x.notas.map((y) => y.n)) : -1);
    return d(b) - d(a) || a.dom.localeCompare(b.dom) || a.np - b.np;
  });

  for (const f of ordenada) {
    const ns = f.notas.map((x) => x.n);
    const hayComparacion = ns.length >= 2;
    const disp = hayComparacion ? Math.max(...ns) - Math.min(...ns) : null;
    const fila = hc.addRow({
      disp: disp ?? "",
      dom: f.dom,
      np: f.np,
      preg: f.preg,
      cuantos: f.notas.length,
      notas: f.notas.map((x) => `${corto(x.quien)} ${x.n}`).join(" · "),
      min: ns.length ? Math.min(...ns) : "",
      max: ns.length ? Math.max(...ns) : "",
      prom: ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100 : "",
      of: f.oficial ?? "",
      otras: f.otras.join(" · "),
    });
    fila.alignment = { vertical: "top", wrapText: true };
    if (disp != null) pintarDispersion(fila.getCell("disp"), disp);
    if (f.fijada) fila.getCell("of").note = "Fijada a mano: dejó de recalcularse con la más baja.";
  }

  // ── Hoja 3: sesgo por persona ──
  const hs = libro.addWorksheet("Sesgo por persona");
  hs.columns = [
    { header: "Participante", key: "quien", width: 26 },
    { header: "Cargo", key: "cargo", width: 32 },
    { header: "Preguntas comparables", key: "n", width: 14 },
    { header: "Su promedio", key: "prom", width: 12 },
    { header: "Sesgo vs. el grupo", key: "sesgo", width: 16 },
    { header: "Cómo leerlo", key: "lectura", width: 52 },
  ];
  encabezar(hs, 6);

  const orden = [...desvios.entries()].sort((a, b) => a[1].suma / a[1].n - b[1].suma / b[1].n);
  for (const [quien, d] of orden) {
    const sesgo = Math.round((d.suma / d.n) * 100) / 100;
    const prom = Math.round((d.notas.reduce((a, b) => a + b, 0) / d.notas.length) * 100) / 100;
    const lectura =
      sesgo <= -0.5 ? "Puntúa más duro que el grupo en las mismas preguntas."
      : sesgo >= 0.5 ? "Puntúa más blando que el grupo en las mismas preguntas."
      : "Alineado con el grupo.";
    const fila = hs.addRow({ quien, cargo: d.cargo ?? "", n: d.n, prom, sesgo, lectura });
    fila.alignment = { vertical: "top", wrapText: true };
    if (sesgo <= -0.5) fila.getCell("sesgo").font = { bold: true, color: { argb: "FFDC2626" } };
    else if (sesgo >= 0.5) fila.getCell("sesgo").font = { bold: true, color: { argb: "FF2563EB" } };
  }

  hs.addRow({});
  hs.addRow({
    quien: "Cómo se calcula",
    cargo:
      "En cada pregunta donde respondieron dos o más personas se saca el promedio del grupo, y se mide cuánto se aparta la nota de cada uno. La columna es el promedio de esos apartamientos.",
  }).alignment = { vertical: "top", wrapText: true };
  hs.addRow({
    quien: "Qué NO significa",
    cargo:
      "Un sesgo negativo no es un error: es una vara más exigente sobre la misma práctica. Alinear esa vara es justamente el objeto de la calibración.",
  }).alignment = { vertical: "top", wrapText: true };

  const conDispersion = calibracion.filter((f) => f.notas.length >= 2);
  const discrepan = conDispersion.filter((f) => new Set(f.notas.map((x) => x.n)).size > 1);

  const salida =
    opcion("salida") ??
    join(__dirname, "..", "docs", `Calibracion-${empresa.razonSocial.replace(/[^a-zA-Z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  await libro.xlsx.writeFile(salida);

  console.log(`${empresa.razonSocial} (${empresa.rut})`);
  console.log(`  ${hr.rowCount - 1} respuestas de participantes en ${dds.length} dominios`);
  console.log(`  ${conDispersion.length} preguntas con 2+ notas · ${discrepan.length} con notas distintas`);
  console.log(`  ${desvios.size} participantes con preguntas comparables`);
  console.log(`\nEscrito en: ${salida}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
