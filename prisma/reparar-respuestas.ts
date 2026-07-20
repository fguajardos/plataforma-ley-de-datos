// Repara diagnósticos cuyos dominios quedaron sin filas Respuesta (una por pregunta
// del catálogo). Ocurre cuando el diagnóstico se crea por script (parametrizar-honda.ts)
// en vez de por la UI, que sí las crea (diagnosticos/actions.ts).
//
// Idempotente: solo crea las respuestas que faltan; nunca toca las existentes.
//
// Uso: npx tsx prisma/reparar-respuestas.ts   (usa DATABASE_URL de .env → producción)

import { readFileSync } from "fs";
import { join } from "path";

// Carga .env sin depender de dotenv (tsx no lo carga solo)
for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dds = await prisma.diagnosticoDominio.findMany({
    where: { incluido: true },
    include: {
      diagnostico: { select: { nombre: true } },
      dominio: { select: { orden: true, nombre: true, preguntas: { select: { id: true } } } },
      respuestas: { select: { preguntaId: true } },
    },
  });

  let creadas = 0;
  for (const dd of dds) {
    const existentes = new Set(dd.respuestas.map((r) => r.preguntaId));
    const faltantes = dd.dominio.preguntas.filter((p) => !existentes.has(p.id));
    if (!faltantes.length) continue;
    await prisma.respuesta.createMany({
      data: faltantes.map((p) => ({
        diagnosticoDominioId: dd.id,
        preguntaId: p.id,
        estado: "PENDIENTE",
      })),
      skipDuplicates: true,
    });
    creadas += faltantes.length;
    console.log(
      `  ${dd.diagnostico.nombre} · D${dd.dominio.orden} ${dd.dominio.nombre}: +${faltantes.length} respuestas (tenía ${existentes.size})`
    );
  }

  console.log(creadas ? `\nListo: ${creadas} respuestas creadas.` : "Nada que reparar: todos los dominios tienen sus respuestas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
