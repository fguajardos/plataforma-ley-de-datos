// Invita a un participante a activar su cuenta.
//
// Reemplaza al correo de credenciales: en vez de mandar la contraseña escrita, manda
// un enlace de un solo uso para que la persona defina la suya. Los filtros de
// seguridad corporativos leen "aquí va tu usuario y contraseña" como phishing —de
// hecho Honda bloqueó al remitente por eso—, y este formato además es más seguro:
// la contraseña nunca viaja ni queda archivada en una bandeja de entrada.
//
// Uso:
//   npx tsx prisma/enviar-activacion.ts --dry-run --all-honda
//   npx tsx prisma/enviar-activacion.ts --test tucorreo@x.cl correo@honda.cl
//   npx tsx prisma/enviar-activacion.ts correo@honda.cl [otro@honda.cl ...]
//   npx tsx prisma/enviar-activacion.ts --all-honda
//
// --solo-enlaces  no envía nada: imprime los enlaces para repartirlos por otro medio
//                 (útil mientras el remitente siga bloqueado).

import { readFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APP_URL = "https://lpdp.procesos360.cl";
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM!;
const CONTACTO = "francisco.guajardo@procesos360.cl";
const DIAS_VIGENCIA = 7;

/** Genera y guarda un token de un solo uso. Reemplaza cualquier anterior. */
async function nuevoEnlace(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { tokenActivacion: token, tokenExpira: expira },
  });
  return `${APP_URL}/activar?token=${token}`;
}

function plantilla(nombre: string, enlace: string, dominios: string[]) {
  const primerNombre = nombre.split(" ")[0];
  const subject = "Activa tu cuenta — Diagnóstico LPDP Honda";

  const lista = dominios.length
    ? `<p style="margin:16px 0 6px;line-height:1.6">Vas a responder ${
        dominios.length === 1 ? "el siguiente dominio" : "los siguientes dominios"
      }:</p>
       <ul style="margin:0 0 8px;padding-left:20px;line-height:1.6;color:#111827">${dominios
         .map((d) => `<li style="margin:2px 0">${d}</li>`)
         .join("")}</ul>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Procesos360 · Ley 21.719 de Protección de Datos Personales</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827">Hola ${primerNombre},</h1>
      <p style="margin:0 0 12px;line-height:1.6">Honda está realizando su <strong>diagnóstico de cumplimiento de la Ley de Protección de Datos Personales</strong> junto a Procesos360, y te hemos habilitado una cuenta para participar.</p>
      ${lista}
      <p style="margin:16px 0 12px;line-height:1.6">Para empezar, activa tu cuenta y <strong>define tu propia contraseña</strong>:</p>

      <div style="text-align:center;margin:22px 0">
        <a href="${enlace}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:600">Activar mi cuenta</a>
      </div>

      <p style="margin:0 0 12px;line-height:1.55;font-size:13px;color:#6b7280">
        El enlace sirve una sola vez y vence en ${DIAS_VIGENCIA} días. Si el botón no funciona,
        copia esta dirección en tu navegador:<br>
        <span style="word-break:break-all;color:#374151">${enlace}</span>
      </p>
      <p style="margin:14px 0 0;line-height:1.6;font-size:14px;color:#374151">
        Al entrar por primera vez se te pedirá aceptar el <strong>consentimiento informado</strong>.
      </p>
      <p style="margin:14px 0 0;line-height:1.55;font-size:13px;color:#374151">
        Ante cualquier duda o problema, escríbeme directamente a
        <a href="mailto:${CONTACTO}" style="color:#2563eb;font-weight:600">${CONTACTO}</a>.
        Este correo es automático y no recibe respuestas.
      </p>
    </div>
    <p style="text-align:center;margin:14px 0 0;font-size:12px;color:#9ca3af">Procesos360 SpA · Diagnóstico LPDP Honda</p>
  </div></body></html>`;

  const text = `Hola ${primerNombre},

Honda está realizando su diagnóstico de cumplimiento de la Ley de Protección de Datos Personales junto a Procesos360, y te hemos habilitado una cuenta para participar.
${dominios.length ? `\nVas a responder:\n${dominios.map((d) => `  - ${d}`).join("\n")}\n` : ""}
Para empezar, activa tu cuenta y define tu propia contraseña en este enlace:

${enlace}

El enlace sirve una sola vez y vence en ${DIAS_VIGENCIA} días.
Al entrar por primera vez se te pedirá aceptar el consentimiento informado.

Ante cualquier duda o problema, escríbeme directamente a ${CONTACTO}.
Este correo es automático y no recibe respuestas.

Procesos360 · Diagnóstico LPDP Honda`;

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

async function dominiosDe(userId: string): Promise<string[]> {
  const p = await prisma.participanteDominio.findMany({
    where: { userId },
    select: { diagnosticoDominio: { select: { dominio: { select: { orden: true, nombre: true } } } } },
  });
  return p
    .map((x) => x.diagnosticoDominio.dominio)
    .sort((a, b) => a.orden - b.orden)
    .map((d) => `${d.orden}. ${d.nombre}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const soloEnlaces = args.includes("--solo-enlaces");
  const allHonda = args.includes("--all-honda");
  const testIdx = args.indexOf("--test");
  const testTo = testIdx >= 0 ? args[testIdx + 1] : null;

  let objetivos: string[];
  if (allHonda) {
    const honda = await prisma.user.findMany({
      where: { role: "RESPONSABLE_DOMINIO", empresa: { rut: "11.111.111-1" } },
      select: { email: true }, orderBy: { email: "asc" },
    });
    objetivos = honda.map((u) => u.email);
  } else {
    objetivos = args.filter((a) => a.includes("@") && a !== testTo);
  }
  if (objetivos.length === 0) {
    console.log("Indica correos, o usa --all-honda. Añade --dry-run para previsualizar.");
    return;
  }

  for (const email of objetivos) {
    const u = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, nombre: true, email: true },
    });
    if (!u) { console.log(`  ${email}: no existe`); continue; }

    if (dryRun) {
      console.log(`  → ${u.nombre} <${u.email}>  (no se generó token)`);
      continue;
    }

    const enlace = await nuevoEnlace(u.id);
    if (soloEnlaces) {
      console.log(`\n${u.nombre} <${u.email}>\n${enlace}`);
      continue;
    }

    const { subject, html, text } = plantilla(u.nombre, enlace, await dominiosDe(u.id));
    const to = testTo ?? u.email;
    try {
      const id = await enviarResend(to, testTo ? `[PRUEBA] ${subject}` : subject, html, text);
      console.log(`  ✓ ${to} (${u.nombre})  id=${id}`);
    } catch (e) {
      console.log(`  ✗ ${to}  ERROR: ${(e as Error).message.slice(0, 120)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
