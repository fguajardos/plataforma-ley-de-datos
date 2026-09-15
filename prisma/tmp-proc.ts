import { readFileSync } from "fs";
import { join } from "path";
for (const l of readFileSync(join(__dirname, "..", ".env.uat"), "utf-8").split("\n")) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const PROCESOS = [
  ["S-3.6", "Cuentas por Pagar"], ["N-3.5", "Gestión de Inventarios de Vehículos"],
  ["S-2.1", "Recepción de Materiales"], ["N-3.4", "Preparación de Vehículos PDI"],
  ["S-4.1", "Gestión de la Estructura Organizacional"], ["N-5.3", "Inteligencia de Mercado"],
  ["N-1.1", "Planificación del Portafolio"],
];
(async () => {
  const e = await p.empresa.findFirst({ where: { razonSocial: { contains: "Demo" } }, select: { id: true } });
  for (const [codigo, nombre] of PROCESOS) {
    await p.procesoNegocio.upsert({
      where: { empresaId_codigo: { empresaId: e!.id, codigo } },
      create: { empresaId: e!.id, codigo, nombre }, update: { nombre },
    });
  }
  console.log(`procesos de prueba en UAT: ${await p.procesoNegocio.count()}`);
  await p.$disconnect();
})();
