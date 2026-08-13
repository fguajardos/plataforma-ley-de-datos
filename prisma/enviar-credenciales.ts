// Envia por correo (Resend) las credenciales de acceso a la plataforma LPDP.
// Lee las contrasenas de docs/credenciales-iniciales.csv y los dominios asignados
// desde la base. NO envia a nadie por defecto: hay que indicar destinatarios.
//
// Uso:
//   npx tsx prisma/enviar-credenciales.ts --dry-run --all-honda        (previsualiza los 9)
//   npx tsx prisma/enviar-credenciales.ts --test tucorreo@dominio.cl   (prueba a un correo)
//   npx tsx prisma/enviar-credenciales.ts correo1@honda.cl correo2@...  (envia a esos)
//   npx tsx prisma/enviar-credenciales.ts --all-honda                   (envia a los 9)
//
// Flags: --dry-run (no envia, solo muestra) · --all-honda (todos los RESPONSABLE_DOMINIO
// de Honda que esten en el CSV) · --test <correo> (envia a ti la version de un usuario demo).

import { readFileSync } from "fs";
import { join } from "path";
for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APP_URL = "https://lpdp.procesos360.cl";
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM!;

type Cred = { nombre: string; email: string; cargo: string; password: string };

// ── Parse simple del CSV (campos entre comillas) ────────────────────────────
function leerCSV(): Map<string, Cred> {
  const txt = readFileSync(join(__dirname, "..", "docs", "credenciales-iniciales.csv"), "utf-8");
  const map = new Map<string, Cred>();
  const lines = txt.split(/\r?\n/).slice(1); // salta encabezado
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.match(/"([^"]*)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    if (cols.length < 6) continue;
    const [nombre, email, cargo, , , password] = cols;
    map.set(email.toLowerCase(), { nombre, email, cargo, password });
  }
  return map;
}

function plantilla(nombre: string, email: string, password: string, dominios: string[]): { subject: string; html: string; text: string } {
  const primerNombre = nombre.split(" ")[0];
  const subject = "Acceso a la plataforma de diagnóstico LPDP — Honda";
  const listaDominios = dominios.length
    ? `<p style="margin:16px 0 6px">Tienes asignada la respuesta de ${dominios.length === 1 ? "el siguiente dominio" : "los siguientes dominios"}:</p>
       <ul style="margin:0 0 8px 0;padding-left:20px;color:#111">${dominios.map((d) => `<li style="margin:2px 0">${d}</li>`).join("")}</ul>`
    : "";
  const listaDominiosText = dominios.length ? `\nDominios asignados:\n${dominios.map((d) => `  - ${d}`).join("\n")}\n` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Procesos360 · Ley 21.719 de Protección de Datos Personales</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827">Hola ${primerNombre},</h1>
      <p style="margin:0 0 12px;line-height:1.55">Te damos acceso a la plataforma con la que Honda está realizando su <strong>diagnóstico de cumplimiento de la Ley de Protección de Datos Personales (LPDP)</strong>. Desde ahí responderás las preguntas de los dominios a tu cargo y adjuntarás la evidencia correspondiente.</p>
      ${listaDominios}
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:18px 0">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Tus credenciales</p>
        <p style="margin:0 0 4px"><strong>Usuario:</strong> ${email}</p>
        <p style="margin:0"><strong>Contraseña:</strong> <span style="font-family:monospace;font-size:15px">${password}</span></p>
      </div>
      <div style="text-align:center;margin:22px 0">
        <a href="${APP_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Ingresar a la plataforma</a>
      </div>
      <p style="margin:0 0 12px;line-height:1.55;font-size:14px;color:#374151">Al ingresar por primera vez se te pedirá <strong>aceptar el consentimiento informado</strong> antes de comenzar. La dirección es <a href="${APP_URL}" style="color:#2563eb">${APP_URL.replace("https://", "")}</a>.</p>
      <p style="margin:16px 0 0;line-height:1.55;font-size:13px;color:#6b7280">Si tienes dudas sobre cómo responder, responde este correo o contacta a tu consultor de Procesos360.</p>
    </div>
    <p style="text-align:center;margin:14px 0 0;font-size:12px;color:#9ca3af">Este es un correo automático de notificación. Procesos360 SpA.</p>
  </div></body></html>`;

  const text = `Hola ${primerNombre},

Te damos acceso a la plataforma del diagnóstico de la Ley de Protección de Datos Personales (LPDP) de Honda.
${listaDominiosText}
Tus credenciales:
  Usuario: ${email}
  Contraseña: ${password}

Ingresa en: ${APP_URL}
Al entrar por primera vez se te pedirá aceptar el consentimiento informado.

Si tienes dudas, responde este correo o contacta a tu consultor de Procesos360.`;

  return { subject, html, text };
}

async function enviarResend(to: string, subject: string, html: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
  return body?.id as string;
}

async function dominiosDe(email: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      participaciones: {
        select: { diagnosticoDominio: { select: { dominio: { select: { orden: true, nombre: true } } } } },
      },
    },
  });
  if (!user) return [];
  return user.participaciones
    .map((p) => p.diagnosticoDominio.dominio)
    .sort((a, b) => a.orden - b.orden)
    .map((d) => `${d.orden}. ${d.nombre}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const allHonda = args.includes("--all-honda");
  const testIdx = args.indexOf("--test");
  const testTo = testIdx >= 0 ? args[testIdx + 1] : null;

  if (!RESEND_API_KEY || !EMAIL_FROM) throw new Error("Falta RESEND_API_KEY o EMAIL_FROM en .env");

  const cred = leerCSV();

  // Determina destinatarios (emails de usuarios).
  let objetivos: string[] = [];
  if (allHonda) {
    const honda = await prisma.user.findMany({
      where: { role: "RESPONSABLE_DOMINIO", empresa: { rut: "11.111.111-1" } },
      select: { email: true },
      orderBy: { email: "asc" },
    });
    objetivos = honda.map((u) => u.email);
  } else {
    objetivos = args.filter((a) => a.includes("@") && a !== testTo);
  }

  if (testTo) {
    // Prueba: usa los datos del primer objetivo (o de jeannette) pero envia a testTo.
    const modeloEmail = objetivos[0] ?? "jeannette_gaete@honda.cl";
    const c = cred.get(modeloEmail.toLowerCase());
    if (!c) throw new Error(`No hay credencial en el CSV para ${modeloEmail}`);
    const doms = await dominiosDe(modeloEmail);
    const { subject, html, text } = plantilla(c.nombre, c.email, c.password, doms);
    console.log(`[TEST] Enviando a ${testTo} la version de ${c.nombre} (${modeloEmail})...`);
    if (dryRun) { console.log("  (dry-run: no se envio)"); return; }
    const id = await enviarResend(testTo, `[PRUEBA] ${subject}`, html, text);
    console.log(`  Enviado. id=${id}`);
    return;
  }

  if (!objetivos.length) {
    console.log("Sin destinatarios. Usa --all-honda, o pasa correos, o --test <correo>.");
    console.log("Agrega --dry-run para previsualizar sin enviar.");
    return;
  }

  console.log(`${dryRun ? "[DRY-RUN] " : ""}Destinatarios: ${objetivos.length}\n`);
  for (const email of objetivos) {
    const c = cred.get(email.toLowerCase());
    if (!c) { console.log(`  SALTADO ${email}: sin credencial en el CSV`); continue; }
    const doms = await dominiosDe(email);
    const { subject, html, text } = plantilla(c.nombre, c.email, c.password, doms);
    if (dryRun) {
      console.log(`  → ${c.nombre} <${email}>  | dominios: ${doms.join(" · ") || "(ninguno)"}  | pass: ${c.password}`);
      continue;
    }
    try {
      const id = await enviarResend(email, subject, html, text);
      console.log(`  ✓ ${email}  id=${id}`);
    } catch (e) {
      console.log(`  ✗ ${email}  ERROR: ${(e as Error).message}`);
    }
  }
  if (dryRun) console.log("\n(dry-run: no se envió ningún correo)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
