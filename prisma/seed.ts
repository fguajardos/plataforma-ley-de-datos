import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dominiosData from "../src/data/dominios.json";

const prisma = new PrismaClient();

type DominioJson = {
  orden: number;
  nombre: string;
  objetivo: string;
  evidenciasMinimas: string[];
  riesgos: string[];
  preguntas: { orden: number; texto: string; descripcion: string }[];
};

const dominios = dominiosData as DominioJson[];

// Heurística: la pregunta exige evidencia documental si menciona un artefacto verificable.
const KEYWORDS_EVIDENCIA = [
  "política",
  "politica",
  "procedimiento",
  "contrato",
  "registro",
  "inventario",
  "documenta",
  "cláusula",
  "clausula",
  "acta",
  "informe",
  "matriz",
  "roadmap",
];

function exigeEvidencia(texto: string): boolean {
  const t = texto.toLowerCase();
  return KEYWORDS_EVIDENCIA.some((k) => t.includes(k));
}

async function main() {
  console.log("Limpiando datos...");
  await prisma.accionTratamiento.deleteMany();
  await prisma.riesgo.deleteMany();
  await prisma.brecha.deleteMany();
  await prisma.evidencia.deleteMany();
  await prisma.respuesta.deleteMany();
  await prisma.diagnosticoDominio.deleteMany();
  await prisma.diagnostico.deleteMany();
  await prisma.pregunta.deleteMany();
  await prisma.dominio.deleteMany();
  await prisma.area.deleteMany();
  await prisma.user.deleteMany();
  await prisma.empresa.deleteMany();

  // ── Catálogo de dominios y preguntas ──
  console.log("Sembrando catálogo de dominios...");
  const dominioIds: Record<number, string> = {};
  for (const d of dominios) {
    const dom = await prisma.dominio.create({
      data: {
        orden: d.orden,
        nombre: d.nombre,
        objetivo: d.objetivo,
        evidenciasMinimas: JSON.stringify(d.evidenciasMinimas),
        riesgos: JSON.stringify(d.riesgos),
        preguntas: {
          create: d.preguntas.map((p) => ({
            orden: p.orden,
            texto: p.texto,
            descripcion: p.descripcion,
            evidenciaObligatoria: exigeEvidencia(p.texto),
          })),
        },
      },
    });
    dominioIds[d.orden] = dom.id;
  }
  const totalPreguntas = await prisma.pregunta.count();
  console.log(`  ${dominios.length} dominios, ${totalPreguntas} preguntas.`);

  // ── Empresa demo ──
  console.log("Creando empresa demo...");
  const empresa = await prisma.empresa.create({
    data: {
      razonSocial: "Empresa Demo S.A.",
      rut: "76.123.456-7",
      nombreComercial: "Demo",
      industria: "Servicios",
      tamano: "MEDIANA",
      pais: "Chile",
      region: "Metropolitana",
      numColaboradores: 250,
      sitioWeb: "https://demo.cl",
      responsablePrincipal: "María Pérez",
      correoResponsable: "maria.perez@empresademo.cl",
      telefono: "+56 2 2345 6789",
      areas: {
        create: [
          { nombre: "Legal", responsable: "Juan Soto", cargo: "Gerente Legal", participaDiagnostico: true, trataDatos: true, trataDatosSensibles: true, usaSistemas: true },
          { nombre: "TI", responsable: "Ana Díaz", cargo: "Jefa de TI", participaDiagnostico: true, trataDatos: true, trataDatosSensibles: false, usaSistemas: true },
          { nombre: "Recursos Humanos", responsable: "Pedro Rojas", cargo: "Jefe RR.HH.", participaDiagnostico: true, trataDatos: true, trataDatosSensibles: true, usaSistemas: true },
          { nombre: "Comercial", responsable: "Laura Vega", cargo: "Gerente Comercial", participaDiagnostico: true, trataDatos: true, trataDatosSensibles: false, usaSistemas: true },
          { nombre: "Compliance", responsable: "Carla Núñez", cargo: "Oficial de Cumplimiento", participaDiagnostico: true, trataDatos: false, trataDatosSensibles: false, usaSistemas: false },
        ],
      },
    },
  });

  // ── Usuarios (uno por rol) ──
  console.log("Creando usuarios...");
  const passwordHash = bcrypt.hashSync("Demo1234", 10);
  const mk = (nombre: string, email: string, role: string, empresaId: string | null, cargo?: string) =>
    prisma.user.create({ data: { nombre, email, passwordHash, role, empresaId, cargo } });

  await mk("Admin Procesos360", "admin@procesos360.cl", "ADMIN_P360", null, "Administrador");
  const consultor = await mk("Consultor Procesos360", "consultor@procesos360.cl", "CONSULTOR", null, "Consultor LPDP");
  await mk("Admin Empresa Demo", "admin@empresademo.cl", "ADMIN_EMPRESA", empresa.id, "Gerente de Operaciones");
  const responsable = await mk("Responsable Dominio", "responsable@empresademo.cl", "RESPONSABLE_DOMINIO", empresa.id, "Analista de Cumplimiento");
  await mk("Alta Dirección", "direccion@empresademo.cl", "ALTA_DIRECCION", empresa.id, "Gerente General");

  // ── Diagnóstico demo (los 10 dominios) ──
  console.log("Creando diagnóstico demo...");
  const diagnostico = await prisma.diagnostico.create({
    data: {
      empresaId: empresa.id,
      nombre: "Diagnóstico LPDP 2026",
      tipo: "COMPLETO",
      estado: "EN_EJECUCION",
      fechaInicio: new Date("2026-01-15"),
      fechaCierre: new Date("2026-03-31"),
      consultorId: consultor.id,
    },
  });

  // Áreas de la empresa (para asignar a los dominios y calcular madurez por área).
  const areas = await prisma.area.findMany({ where: { empresaId: empresa.id }, orderBy: { nombre: "asc" } });

  // DiagnosticoDominio + respuestas (pendientes) para cada pregunta
  for (const d of dominios) {
    const dd = await prisma.diagnosticoDominio.create({
      data: {
        diagnosticoId: diagnostico.id,
        dominioId: dominioIds[d.orden],
        responsableId: responsable.id,
        areaId: areas.length ? areas[(d.orden - 1) % areas.length].id : null,
        estado: "PENDIENTE",
      },
    });
    const preguntas = await prisma.pregunta.findMany({
      where: { dominioId: dominioIds[d.orden] },
      orderBy: { orden: "asc" },
    });
    await prisma.respuesta.createMany({
      data: preguntas.map((p) => ({
        diagnosticoDominioId: dd.id,
        preguntaId: p.id,
        estado: "PENDIENTE",
      })),
    });
  }

  // ── Respuestas de ejemplo en Dominio 1 (para mostrar motores en acción) ──
  console.log("Sembrando respuestas de ejemplo en Dominio 1...");
  const dd1 = await prisma.diagnosticoDominio.findFirstOrThrow({
    where: { diagnosticoId: diagnostico.id, dominioId: dominioIds[1] },
  });
  const valoresEjemplo = ["0", "1", "2", "3", "4", "2", "1", "0", "3", "2", "1", "0", "2", "3", "1", "2"];
  const respuestas1 = await prisma.respuesta.findMany({
    where: { diagnosticoDominioId: dd1.id },
    include: { pregunta: true },
    orderBy: { pregunta: { orden: "asc" } },
  });
  for (let i = 0; i < respuestas1.length; i++) {
    const valor = valoresEjemplo[i] ?? "2";
    await prisma.respuesta.update({
      where: { id: respuestas1[i].id },
      data: {
        valor,
        estado: "RESPONDIDA",
        comentario: ["0", "1", "2"].includes(valor) ? "Control no formalizado; en implementación." : null,
        respondidoPorId: responsable.id,
      },
    });
  }
  await prisma.diagnosticoDominio.update({ where: { id: dd1.id }, data: { estado: "EN_EJECUCION" } });

  console.log("\n✅ Seed completado.");
  console.log("Usuarios (contraseña: Demo1234):");
  console.log("  admin@procesos360.cl       — Admin Procesos360");
  console.log("  consultor@procesos360.cl   — Consultor");
  console.log("  admin@empresademo.cl       — Admin Empresa");
  console.log("  responsable@empresademo.cl — Responsable de Dominio");
  console.log("  direccion@empresademo.cl   — Alta Dirección");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
