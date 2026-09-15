// Engancha cada fila del RAT con su proceso del mapa.
//
// La matriz ya traía la columna "Proceso(s) relacionado(s)" como texto —"S-3.6 Cuentas por
// Pagar / S-3.7 Tesorería"— y ese texto se conserva, porque una actividad puede cruzar
// varios procesos y perder esa información sería empobrecer el registro.
//
// Lo que falta es el enlace al PRINCIPAL, que es el primero de la lista. Con él la
// plataforma puede responder la pregunta que importa para cerrar el RAT: ¿esta fila tiene
// su levantamiento hecho, o sea, hay una ficha cargada para su proceso?
//
// Uso:
//   npx tsx prisma/enganchar-rat-procesos.ts --empresa HONDA
//   npx tsx prisma/enganchar-rat-procesos.ts --empresa HONDA --aplicar
//   ...--uat

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

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/** El primer código de la lista: el proceso donde la actividad vive principalmente. */
function codigoPrincipal(texto: string | null): string | null {
  const m = texto?.toUpperCase().match(/\b([A-Z])-(\d+(?:\.\d+)*)\b/);
  return m ? `${m[1]}-${m[2].split(".").slice(0, 2).join(".")}` : null;
}

async function main() {
  const buscada = opcion("empresa");
  if (!buscada) {
    console.error("Falta --empresa <rut o razón social>.");
    process.exit(1);
  }
  const empresa = await prisma.empresa.findFirst({
    where: { OR: [{ rut: buscada }, { razonSocial: { contains: buscada, mode: "insensitive" } }] },
    select: { id: true, razonSocial: true },
  });
  if (!empresa) {
    console.error(`No se encontró la empresa "${buscada}".`);
    process.exit(1);
  }

  const procesos = await prisma.procesoNegocio.findMany({
    where: { empresaId: empresa.id },
    select: { id: true, codigo: true, nombre: true },
  });
  const porCodigo = new Map(procesos.map((p) => [p.codigo.toUpperCase(), p]));

  const filas = await prisma.tratamientoDato.findMany({
    where: { empresaId: empresa.id },
    select: { id: true, codigo: true, nombre: true, procesos: true, procesoId: true },
    orderBy: { codigo: "asc" },
  });

  const cambios: { id: string; etiqueta: string; procesoId: string; codigo: string }[] = [];
  const sinCodigo: string[] = [];
  const fueraDelMapa: string[] = [];

  for (const f of filas) {
    const codigo = codigoPrincipal(f.procesos);
    if (!codigo) {
      sinCodigo.push(`${f.codigo ?? "—"} ${f.nombre}`);
      continue;
    }
    const proceso = porCodigo.get(codigo);
    if (!proceso) {
      fueraDelMapa.push(`${f.codigo ?? "—"} ${f.nombre} → ${codigo}`);
      continue;
    }
    if (f.procesoId === proceso.id) continue;
    cambios.push({
      id: f.id,
      etiqueta: `${f.codigo ?? "—"} ${f.nombre}`,
      procesoId: proceso.id,
      codigo: proceso.codigo,
    });
  }

  console.log(`${empresa.razonSocial} · ${filas.length} actividades · ${procesos.length} procesos en el mapa\n`);
  for (const c of cambios) console.log(`  ${c.codigo.padEnd(7)} ← ${c.etiqueta}`);
  if (sinCodigo.length > 0) {
    console.log(`\n  sin código de proceso en la columna (${sinCodigo.length}):`);
    for (const x of sinCodigo) console.log(`    ${x}`);
  }
  if (fueraDelMapa.length > 0) {
    console.log(`\n  apuntan a un proceso que no está en el mapa (${fueraDelMapa.length}):`);
    for (const x of fueraDelMapa) console.log(`    ${x}`);
  }

  if (!bandera("aplicar")) {
    console.log(`\n(solo revisión — ${cambios.length} filas se engancharían. Agrega --aplicar)`);
    return;
  }
  for (const c of cambios) {
    await prisma.tratamientoDato.update({ where: { id: c.id }, data: { procesoId: c.procesoId } });
  }
  const enganchadas = await prisma.tratamientoDato.count({
    where: { empresaId: empresa.id, procesoId: { not: null } },
  });
  console.log(`\nEnganchadas ${cambios.length}. Total con proceso: ${enganchadas} de ${filas.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
