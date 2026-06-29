// Verificación rápida de los motores contra los datos sembrados.
// Ejecutar: npx tsx scripts/check-engines.ts
import { PrismaClient } from "@prisma/client";
import { calcularMadurez } from "../src/lib/engines/madurez";
import { generarBrechas, type RespuestaBrechaInput } from "../src/lib/engines/brechas";

const prisma = new PrismaClient();

async function main() {
  const diag = await prisma.diagnostico.findFirstOrThrow({
    include: {
      dominios: {
        where: { incluido: true },
        include: {
          dominio: { include: { _count: { select: { preguntas: true } } } },
          respuestas: { include: { pregunta: true, evidencias: { select: { id: true } } } },
        },
      },
    },
  });

  const madurez = calcularMadurez(
    diag.dominios.map((d) => ({
      dominioId: d.dominioId,
      orden: d.dominio.orden,
      nombre: d.dominio.nombre,
      totalPreguntas: d.dominio._count.preguntas,
      respuestas: d.respuestas.map((r) => ({ preguntaId: r.id, valor: r.valor })),
    }))
  );

  console.log("== MADUREZ ==");
  console.log("Global:", madurez.global, "Nivel:", madurez.nivelGlobal);
  for (const d of madurez.dominios) {
    console.log(`  D${d.orden} ${d.nombre}: prom=${d.promedio} nivel=${d.nivel} avance=${d.avance}%`);
  }

  const inputs: RespuestaBrechaInput[] = diag.dominios.flatMap((dd) =>
    dd.respuestas
      .filter((r) => r.valor != null)
      .map((r) => ({
        respuestaId: r.id,
        valor: r.valor,
        comentario: r.comentario,
        tieneEvidencia: r.evidencias.length > 0,
        pregunta: { orden: r.pregunta.orden, texto: r.pregunta.texto, evidenciaObligatoria: r.pregunta.evidenciaObligatoria },
        dominio: { orden: dd.dominio.orden, nombre: dd.dominio.nombre },
      }))
  );
  const brechas = generarBrechas(inputs);
  console.log("\n== BRECHAS ==");
  console.log("Total:", brechas.length);
  for (const b of brechas.slice(0, 8)) console.log(`  ${b.codigo} [${b.criticidad}] ${b.descripcion}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
