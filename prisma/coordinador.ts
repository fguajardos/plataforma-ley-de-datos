// Otorga (o quita) el control del seguimiento a la contraparte del cliente.
//
// Quien lo recibe ve el panel de "qué le falta a cada uno" de SU empresa y puede
// mandarles el recordatorio, sin dejar de ser un participante más: sigue respondiendo
// los dominios que tiene asignados y sigue sin ver las respuestas de sus colegas.
//
// Uso:
//   npx tsx prisma/coordinador.ts                              (lista quién lo tiene)
//   npx tsx prisma/coordinador.ts pablo_torrealba@honda.cl     (se lo otorga)
//   npx tsx prisma/coordinador.ts --quitar pablo_torrealba@honda.cl

import { readFileSync } from "fs";
import { join } from "path";
for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listar() {
  const us = await prisma.user.findMany({
    where: { coordinaSeguimiento: true },
    select: { nombre: true, email: true, role: true, empresa: { select: { razonSocial: true } } },
    orderBy: { nombre: "asc" },
  });
  if (us.length === 0) {
    console.log("Nadie del lado cliente coordina el seguimiento todavía.");
    return;
  }
  console.log("Coordinan el seguimiento:");
  for (const u of us) {
    console.log(`  ${u.nombre} <${u.email}> · ${u.role} · ${u.empresa?.razonSocial ?? "sin empresa"}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const quitar = args.includes("--quitar");
  const correos = args.filter((a) => a.includes("@")).map((a) => a.trim().toLowerCase());

  if (correos.length === 0) return listar();

  for (const email of correos) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, nombre: true, empresaId: true, empresa: { select: { razonSocial: true } } },
    });
    if (!u) {
      console.log(`  ✗ ${email}: no existe.`);
      continue;
    }
    // Sin empresa asignada el permiso no acota nada: es del staff, que ya ve todo.
    if (!u.empresaId) {
      console.log(`  ✗ ${u.nombre}: no tiene empresa asignada, este permiso es para la contraparte del cliente.`);
      continue;
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { coordinaSeguimiento: !quitar },
    });
    console.log(
      `  ✓ ${u.nombre} (${u.empresa!.razonSocial}) ${quitar ? "ya no coordina" : "coordina"} el seguimiento.`
    );
  }
  console.log();
  await listar();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
