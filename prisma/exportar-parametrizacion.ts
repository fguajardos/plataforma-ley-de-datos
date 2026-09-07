// Exporta a Excel toda la parametrización del diagnóstico, para poder revisarla.
//
// La parametrización vive en `src/data/dominios.json` y en `src/lib/constants.ts`, que
// son la fuente de verdad, pero ninguno de los dos se lee cómodo: 42 KB de JSON y un
// archivo de código. Cuando hay que contrastar contra el documento del cliente, o
// explicarle a alguien por qué una pregunta exige evidencia y otra no, hace falta verlo
// en una tabla.
//
// Lee el JSON del repo y, si se le pide, lo contrasta contra lo que hay cargado en la
// base: son dos cosas distintas y conviene que se vea cuándo dejan de coincidir.
//
// Uso:
//   npx tsx prisma/exportar-parametrizacion.ts                 (solo el JSON del repo)
//   npx tsx prisma/exportar-parametrizacion.ts --contra-la-base
//   npx tsx prisma/exportar-parametrizacion.ts --uat --contra-la-base
//   ...--salida "C:/ruta/archivo.xlsx"

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
import { exigeEvidencia, type DominioJson } from "./catalogo";
import { ESCALA, NIVEL_MADUREZ, VALORES, requiereComentario, type Valor } from "../src/lib/constants";

const dominios = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "data", "dominios.json"), "utf-8")
) as DominioJson[];

/**
 * Qué palabra del texto hace que la pregunta exija evidencia.
 *
 * La exigencia no está declarada pregunta por pregunta: se deduce del texto, buscando si
 * menciona un artefacto verificable. Mostrar la palabra que la disparó es lo que permite
 * discutir la regla en vez de discutir el resultado.
 */
const KEYWORDS = [
  "política", "politica", "procedimiento", "contrato", "registro", "inventario",
  "documenta", "cláusula", "clausula", "acta", "informe", "matriz", "roadmap",
];
const porQueExige = (texto: string) =>
  KEYWORDS.filter((k) => texto.toLowerCase().includes(k)).join(", ");

const NEGRITA_OSCURA = { argb: "FF1E293B" };

function encabezar(hoja: ExcelJS.Worksheet) {
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: NEGRITA_OSCURA };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

async function main() {
  const contrastar = bandera("contra-la-base");
  const libro = new ExcelJS.Workbook();
  libro.creator = "Procesos360";
  libro.created = new Date();

  // ── Dominios ──
  const hd = libro.addWorksheet("Dominios");
  hd.columns = [
    { header: "N°", key: "orden", width: 6 },
    { header: "Dominio", key: "nombre", width: 42 },
    { header: "Objetivo", key: "objetivo", width: 80 },
    { header: "Preguntas", key: "n", width: 11 },
    { header: "Con evidencia obligatoria", key: "ev", width: 24 },
    { header: "Evidencias mínimas", key: "evs", width: 70 },
    { header: "Riesgos del dominio", key: "riesgos", width: 70 },
  ];
  encabezar(hd);
  for (const d of dominios) {
    hd.addRow({
      orden: d.orden,
      nombre: d.nombre,
      objetivo: d.objetivo,
      n: d.preguntas.length,
      ev: d.preguntas.filter((p) => exigeEvidencia(p.texto)).length,
      evs: d.evidenciasMinimas.map((e, i) => `${i + 1}. ${e}`).join("\n"),
      riesgos: d.riesgos.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    }).alignment = { vertical: "top", wrapText: true };
  }

  // ── Preguntas ──
  const hp = libro.addWorksheet("Preguntas");
  hp.columns = [
    { header: "Dominio", key: "dom", width: 34 },
    { header: "N°", key: "orden", width: 6 },
    { header: "Pregunta", key: "texto", width: 74 },
    { header: "Qué verificar", key: "desc", width: 74 },
    { header: "¿Exige evidencia?", key: "exige", width: 17 },
    { header: "Por qué la exige", key: "porque", width: 26 },
  ];
  encabezar(hp);
  for (const d of dominios) {
    for (const p of d.preguntas) {
      const exige = exigeEvidencia(p.texto);
      const fila = hp.addRow({
        dom: `${d.orden}. ${d.nombre}`,
        orden: p.orden,
        texto: p.texto,
        desc: p.descripcion,
        exige: exige ? "Sí" : "No",
        porque: exige ? `menciona: ${porQueExige(p.texto)}` : "",
      });
      fila.alignment = { vertical: "top", wrapText: true };
      if (exige) fila.getCell("exige").font = { bold: true, color: { argb: "FFB45309" } };
    }
  }
  hp.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };

  // ── Escala de respuesta ──
  const he = libro.addWorksheet("Escala");
  he.columns = [
    { header: "Valor", key: "v", width: 10 },
    { header: "Estado", key: "e", width: 22 },
    { header: "Descripción", key: "d", width: 66 },
    { header: "¿Puntúa en madurez?", key: "p", width: 20 },
    { header: "¿Comentario obligatorio?", key: "c", width: 24 },
  ];
  encabezar(he);
  for (const v of VALORES) {
    he.addRow({
      v: v === "N_A" ? "N/A" : v === "OTRO" ? "Otro" : v,
      e: ESCALA[v as Valor].estado,
      d: ESCALA[v as Valor].descripcion,
      p: v === "N_A" || v === "OTRO" ? "No — se excluye del promedio" : "Sí",
      c: requiereComentario(v) ? "Sí" : "No",
    }).alignment = { vertical: "top", wrapText: true };
  }

  // ── Niveles de madurez ──
  const hn = libro.addWorksheet("Niveles de madurez");
  hn.columns = [
    { header: "Nivel", key: "n", width: 16 },
    { header: "Desde", key: "min", width: 9 },
    { header: "Hasta", key: "max", width: 9 },
    { header: "Estado de cumplimiento", key: "e", width: 40 },
  ];
  encabezar(hn);
  for (const [clave, n] of Object.entries(NIVEL_MADUREZ)) {
    hn.addRow({ n: `${n.label} (${clave})`, min: n.min, max: n.max, e: n.estado });
  }

  // ── Reglas de cálculo ──
  // Van escritas porque son las que generan las dudas: no se ven en ninguna pantalla y
  // explican por qué dos números que parecen lo mismo no coinciden.
  const hr = libro.addWorksheet("Reglas de cálculo");
  hr.columns = [
    { header: "Regla", key: "r", width: 34 },
    { header: "Cómo funciona", key: "c", width: 96 },
  ];
  encabezar(hr);
  for (const [r, c] of [
    ["Promedio del dominio", "Promedio simple de las preguntas con nota 0-5. Todas pesan igual: no hay ponderación por pregunta ni por dominio."],
    ["N/A y Otro", "No puntúan: se excluyen del promedio, no cuentan como 0. Un dominio respondido entero con N/A no tiene nivel de madurez."],
    ["Madurez global", "Promedio de los promedios de dominio, no de las 83 preguntas. Un dominio de 4 preguntas pesa lo mismo que uno de 16."],
    ["Avance (%)", "Preguntas COMPLETAS sobre el total del dominio. Completa = tiene nota, más comentario si la nota lo exige, más evidencia cargada si la pregunta la exige."],
    ["Respondidas vs completas", "Respondida es solo tener nota. Por eso el avance puede ser menor que el porcentaje de respondidas, y esa es la diferencia que suele confundir."],
    ["Evidencia obligatoria", "No está declarada pregunta por pregunta: se deduce del texto de la pregunta si menciona un artefacto verificable (política, procedimiento, contrato, registro, inventario, documenta, cláusula, acta, informe, matriz, roadmap). Ver la columna 'Por qué la exige'."],
    ["Evidencia del dominio", "La evidencia es del dominio, no de cada persona: si un colega ya la subió, cuenta para todos."],
    ["Respuesta oficial", "Se consolida sola con la NOTA MÁS BAJA de los aportes de los participantes. Si alguien la edita a mano queda fijada y deja de recalcularse."],
    ["Comentario obligatorio", "En 0, 1, 2, N/A y Otro. La nota baja sin explicación no sirve como hallazgo, y N/A sin motivo no se puede auditar."],
  ]) {
    hr.addRow({ r, c }).alignment = { vertical: "top", wrapText: true };
  }

  // ── Contraste con la base ──
  if (contrastar) {
    const prisma = new PrismaClient();
    const enBase = await prisma.dominio.findMany({
      include: { preguntas: { orderBy: { orden: "asc" } } },
      orderBy: { orden: "asc" },
    });
    const hc = libro.addWorksheet("JSON vs base");
    hc.columns = [
      { header: "Dominio", key: "d", width: 40 },
      { header: "Preguntas en el JSON", key: "j", width: 20 },
      { header: "Preguntas en la base", key: "b", width: 20 },
      { header: "Diferencias de texto", key: "x", width: 60 },
    ];
    encabezar(hc);
    for (const d of dominios) {
      const b = enBase.find((x) => x.orden === d.orden);
      const distintas = (b?.preguntas ?? []).filter((p) => {
        const j = d.preguntas.find((q) => q.orden === p.orden);
        return j && j.texto !== p.texto;
      });
      hc.addRow({
        d: `${d.orden}. ${d.nombre}`,
        j: d.preguntas.length,
        b: b?.preguntas.length ?? "no está en la base",
        x: distintas.length === 0 ? "—" : distintas.map((p) => `P${p.orden}`).join(", "),
      });
    }
    console.log(`Contrastado contra ${usarUat ? "UAT" : "PRODUCCIÓN"}.`);
    await prisma.$disconnect();
  }

  const salida =
    opcion("salida") ??
    join(__dirname, "..", "docs", `Parametrizacion-LPDP-${new Date().toISOString().slice(0, 10)}.xlsx`);
  await libro.xlsx.writeFile(salida);
  console.log(`\n${dominios.length} dominios · ${dominios.reduce((n, d) => n + d.preguntas.length, 0)} preguntas`);
  console.log(`Escrito en: ${salida}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
