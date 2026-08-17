// Avisa a un participante qué dominios tiene pendientes, calculándolo desde la base:
// solo los dominios en los que participa, que estén abiertos, y donde le falten
// preguntas por responder. Nunca pide algo que la plataforma no le deje hacer.
//
// Uso:
//   npx tsx prisma/enviar-pendientes.ts --dry-run correo@honda.cl
//   npx tsx prisma/enviar-pendientes.ts --test tucorreo@x.cl correo@honda.cl
//   npx tsx prisma/enviar-pendientes.ts correo@honda.cl
//
// --migracion  añade el párrafo que explica que algunas respuestas del levantamiento
//              anterior no se conservaron al cambiar la estructura de la plataforma.

import { readFileSync } from "fs";
import { join } from "path";
for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
import { PrismaClient } from "@prisma/client";
import { respuestaCompleta } from "../src/lib/constants";

const prisma = new PrismaClient();
const APP_URL = "https://lpdp.procesos360.cl";
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM!;
// El remitente es una casilla que no recibe respuestas: hay que dar un contacto real.
const CONTACTO = "francisco.guajardo@procesos360.cl";
const BLOQUEADOS = ["EN_VALIDACION", "COMPLETADO"];

// Lo que le falta a una persona en un dominio no es una sola cosa. Distinguirlas
// evita pedirle a alguien que responda lo que ya está respondido, o darle por cerrado
// un dominio que en realidad falta enviar.
type Pendiente = {
  orden: number;
  nombre: string;
  total: number;
  sinResponder: number; // nadie las ha respondido todavía
  sinTuMirada: number; // otro las respondió, pero esta persona aún no
  listoSinEnviar: boolean; // el dominio está completo y solo falta mandarlo a validación
};

async function pendientesDe(email: string) {
  const u = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, nombre: true,
      participaciones: {
        select: {
          diagnosticoDominio: {
            select: {
              estado: true,
              dominio: { select: { orden: true, nombre: true } },
              respuestas: {
                select: {
                  valor: true, comentario: true,
                  pregunta: { select: { evidenciaObligatoria: true } },
                  evidencias: { select: { archivoPath: true } },
                  aportes: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!u) return null;

  const pendientes: Pendiente[] = [];
  for (const p of u.participaciones) {
    const dd = p.diagnosticoDominio;
    if (BLOQUEADOS.includes(dd.estado)) continue; // ya enviado: nada que pedir
    const total = dd.respuestas.length;

    const sinResponder = dd.respuestas.filter((r) => r.valor == null).length;
    const sinTuMirada = dd.respuestas.filter(
      (r) => r.valor != null && !r.aportes.some((a) => a.userId === u.id)
    ).length;
    const completas = dd.respuestas.filter((r) =>
      respuestaCompleta({
        valor: r.valor,
        comentario: r.comentario,
        evidenciaObligatoria: r.pregunta.evidenciaObligatoria,
        tieneEvidencia: r.evidencias.some((e) => e.archivoPath),
      })
    ).length;
    const listoSinEnviar = total > 0 && completas === total;

    if (sinResponder === 0 && sinTuMirada === 0 && !listoSinEnviar) continue;
    pendientes.push({
      orden: dd.dominio.orden,
      nombre: dd.dominio.nombre,
      total,
      sinResponder,
      sinTuMirada,
      listoSinEnviar,
    });
  }
  pendientes.sort((a, b) => a.orden - b.orden);
  return { nombre: u.nombre, pendientes };
}

/** Qué hay que hacer en este dominio, dicho en una línea. */
function queFalta(p: Pendiente): string {
  const partes: string[] = [];
  if (p.sinResponder > 0) partes.push(`${p.sinResponder} por responder`);
  if (p.sinTuMirada > 0) partes.push(`${p.sinTuMirada} sin tu mirada`);
  if (p.listoSinEnviar) partes.push("falta enviarlo");
  return partes.join(" · ");
}

function plantilla(nombre: string, pendientes: Pendiente[], conMigracion: boolean) {
  const primerNombre = nombre.split(" ")[0];
  const porResponder = pendientes.reduce((n, p) => n + p.sinResponder, 0);
  const sinMirada = pendientes.reduce((n, p) => n + p.sinTuMirada, 0);
  const porEnviar = pendientes.filter((p) => p.listoSinEnviar);
  // El asunto dice lo más urgente: responder pesa más que enviar.
  const subject =
    porResponder === 0 && sinMirada === 0 && porEnviar.length > 0
      ? `Diagnóstico LPDP — solo falta que envíes ${porEnviar.length === 1 ? "tu dominio" : `tus ${porEnviar.length} dominios`}`
      : pendientes.length === 1
        ? `Diagnóstico LPDP — te queda pendiente el dominio de ${pendientes[0].nombre}`
        : `Diagnóstico LPDP — tienes ${pendientes.length} dominios pendientes`;

  const parrafoMigracion = conMigracion
    ? `<p style="margin:0 0 12px;line-height:1.6">Antes que nada, una disculpa: <strong>cambiamos la estructura con la que la plataforma guarda las respuestas</strong> para que cada participante tenga su propio registro y no se sobrescriban entre sí. Al hacer ese cambio, <strong>algunas respuestas del levantamiento anterior no pudieron conservarse</strong>. Es un problema nuestro, no tuyo, y ya está resuelto: de ahora en adelante lo que respondas queda guardado a tu nombre.</p>`
    : "";
  const parrafoMigracionTxt = conMigracion
    ? `Antes que nada, una disculpa: cambiamos la estructura con la que la plataforma guarda las respuestas para que cada participante tenga su propio registro y no se sobrescriban entre si. Al hacer ese cambio, algunas respuestas del levantamiento anterior no pudieron conservarse. Es un problema nuestro, no tuyo, y ya esta resuelto.\n\n`
    : "";

  const filas = pendientes
    .map(
      (p) => `<tr>
        <td style="padding:11px 14px;border-bottom:1px solid #eef1f5;font-weight:600;color:#111827">${p.orden}. ${p.nombre}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;color:#374151">${queFalta(p)}</td>
      </tr>`
    )
    .join("");

  const notas: string[] = [];
  if (sinMirada > 0) {
    notas.push(
      `Donde dice <em>“sin tu mirada”</em> ya respondió un colega. <strong>Registra igual la tuya</strong>,
       aunque no coincida: cada uno conoce una parte distinta de la operación y esas diferencias son
       justamente lo que necesitamos ver.`
    );
  }
  if (porEnviar.length > 0) {
    notas.push(
      `${porEnviar.length === 1 ? "Un dominio ya está" : `${porEnviar.length} dominios ya están`} completo${porEnviar.length === 1 ? "" : "s"}:
       solo falta apretar <strong>“Enviar respuestas a validación”</strong> dentro del dominio para que nos llegue.
       Mientras no lo hagas, no podemos empezar a revisarlo.`
    );
  }
  const nota = notas
    .map(
      (t) =>
        `<p style="margin:16px 0 0;line-height:1.6;background:#f7f9fb;border-left:3px solid #2f6df0;padding:12px 15px;font-size:14px;color:#3c4854">${t}</p>`
    )
    .join("");

  // Si no falta responder nada, el correo no debe sonar a reproche: solo falta enviar.
  const intro =
    porResponder === 0 && sinMirada === 0
      ? "Buenas noticias: ya está todo respondido. Solo queda un paso para que podamos revisarlo."
      : `Para poder avanzar con el diagnóstico, esto es lo que queda pendiente en ${
          pendientes.length === 1 ? "el dominio" : "los dominios"
        } a tu cargo:`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Procesos360 · Ley 21.719 de Protección de Datos Personales</p>
      <h1 style="margin:0 0 14px;font-size:20px;color:#111827">Hola ${primerNombre},</h1>
      ${parrafoMigracion}
      <p style="margin:0 0 14px;line-height:1.6">${intro}</p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px">
        <thead><tr style="background:#f7f9fb">
          <th style="text-align:left;padding:9px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Dominio</th>
          <th style="text-align:right;padding:9px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Qué falta</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>

      ${porResponder + sinMirada > 0 ? `<p style="margin:14px 0 0;line-height:1.6;font-size:14px;color:#374151">
        Son <strong>${porResponder + sinMirada} preguntas</strong> en total. Para cada una necesitamos
        la nota del 0 al 5, un comentario breve y, si existe, el documento que lo respalde.
        Se guarda solo, así que puedes hacerlo en varias veces.
      </p>` : ""}
      ${nota}

      <div style="text-align:center;margin:24px 0 8px">
        <a href="${APP_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Ir a responder</a>
      </div>
      <p style="margin:12px 0 0;line-height:1.55;font-size:13px;color:#6b7280">
        Ingresas con el mismo usuario y contraseña que ya recibiste.
      </p>
      <p style="margin:10px 0 0;line-height:1.55;font-size:13px;color:#374151">
        Ante cualquier problema —no puedes entrar, algo no carga, una pregunta no se entiende—
        escríbeme directamente a
        <a href="mailto:${CONTACTO}" style="color:#2563eb;font-weight:600">${CONTACTO}</a>
        y lo vemos. Este correo es automático y no recibe respuestas.
      </p>
    </div>
    <p style="text-align:center;margin:14px 0 0;font-size:12px;color:#9ca3af">Procesos360 SpA · Diagnóstico LPDP Honda</p>
  </div></body></html>`;

  const text = `Hola ${primerNombre},

${parrafoMigracionTxt}${intro}

${pendientes.map((p) => `  - ${p.orden}. ${p.nombre}: ${queFalta(p)}`).join("\n")}
${porResponder + sinMirada > 0 ? `
Son ${porResponder + sinMirada} preguntas en total. Para cada una necesitamos la nota del 0 al 5, un comentario breve y, si existe, el documento que lo respalde. Se guarda solo, así que puedes hacerlo en varias veces.` : ""}${porEnviar.length > 0 ? `
${porEnviar.length === 1 ? "Un dominio ya está completo" : `${porEnviar.length} dominios ya están completos`}: falta apretar "Enviar respuestas a validación" dentro del dominio para que nos llegue.` : ""}

Ingresa en: ${APP_URL}
Con el mismo usuario y contraseña que ya recibiste.

Ante cualquier problema escríbeme directamente a ${CONTACTO}.
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const conMigracion = args.includes("--migracion");
  const testIdx = args.indexOf("--test");
  const testTo = testIdx >= 0 ? args[testIdx + 1] : null;
  const destinos = args.filter((a) => a.includes("@") && a !== testTo);

  if (destinos.length === 0) {
    console.log("Indica al menos un correo. Añade --dry-run para previsualizar.");
    return;
  }

  for (const email of destinos) {
    const datos = await pendientesDe(email);
    if (!datos) { console.log(`  ${email}: no existe`); continue; }
    if (datos.pendientes.length === 0) {
      console.log(`  ${datos.nombre}: sin pendientes en dominios abiertos. No se envía.`);
      continue;
    }
    const { subject, html, text } = plantilla(datos.nombre, datos.pendientes, conMigracion);

    console.log(`\n${datos.nombre} <${email}>`);
    console.log(`  asunto: ${subject}`);
    for (const p of datos.pendientes) console.log(`    ${p.orden}. ${p.nombre} (${p.total} preg.): ${queFalta(p)}`);

    if (dryRun) { console.log("  (dry-run: no se envió)"); continue; }
    const to = testTo ?? email;
    const id = await enviarResend(to, testTo ? `[PRUEBA] ${subject}` : subject, html, text);
    console.log(`  ✓ enviado a ${to} · id=${id}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
