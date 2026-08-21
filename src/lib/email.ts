// Sin "server-only": este modulo lo comparten la aplicacion y los scripts de
// linea de comandos. La clave de Resend se lee de las variables de entorno del
// servidor, que nunca llegan al navegador.
import { queFalta, type PendientesUsuario } from "@/lib/data/pendientes";

// Envío de correo transaccional. Se usa la API REST de Resend directamente para no
// sumar una dependencia por tres llamadas.

const APP_URL = "https://lpdp.procesos360.cl";
// El remitente no recibe respuestas: todo correo debe ofrecer un contacto real.
const CONTACTO = "francisco.guajardo@procesos360.cl";

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function enviarCorreo(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Falta RESEND_API_KEY o EMAIL_FROM.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = (body as { message?: string })?.message ?? `error ${res.status}`;
    throw new Error(detalle);
  }
  return (body as { id?: string })?.id ?? "";
}

/** Recordatorio de lo que le falta a un participante. */
export function plantillaRecordatorio(u: PendientesUsuario) {
  const primerNombre = u.nombre.split(" ")[0];
  const porResponder = u.dominios.reduce((n, d) => n + d.sinResponder, 0);
  const sinMirada = u.dominios.reduce((n, d) => n + d.sinTuMirada, 0);
  const porEnviar = u.dominios.filter((d) => d.listoSinEnviar);
  const evidencias = u.dominios.reduce((n, d) => n + d.sinEvidencia, 0);
  const soloCuestionarioListo = porResponder === 0 && sinMirada === 0;

  const subject = !soloCuestionarioListo
    ? u.dominios.length === 1
      ? `Diagnóstico LPDP — te queda pendiente el dominio de ${u.dominios[0].nombre}`
      : `Diagnóstico LPDP — tienes ${u.dominios.length} dominios pendientes`
    : evidencias > 0
      ? `Diagnóstico LPDP — falta adjuntar ${evidencias === 1 ? "1 documento" : `${evidencias} documentos`}`
      : porEnviar.length > 0
        ? `Diagnóstico LPDP — solo falta que envíes ${porEnviar.length === 1 ? "tu dominio" : `tus ${porEnviar.length} dominios`}`
        : "Diagnóstico LPDP — te queda un paso pendiente";

  const intro = soloCuestionarioListo
    ? evidencias > 0
      ? "Ya respondiste todas las preguntas. Lo único que falta es adjuntar los documentos que respaldan tus respuestas."
      : "Buenas noticias: ya está todo respondido. Solo queda un paso para que podamos revisarlo."
    : `Para poder avanzar con el diagnóstico, esto es lo que queda pendiente en ${
        u.dominios.length === 1 ? "el dominio" : "los dominios"
      } a tu cargo:`;

  const filas = u.dominios
    .map(
      (d) => `<tr>
        <td style="padding:11px 14px;border-bottom:1px solid #eef1f5;font-weight:600;color:#111827">${d.orden}. ${d.nombre}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap;color:#374151">${queFalta(d)}</td>
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
  if (evidencias > 0) {
    notas.push(
      `Marcaste que el control existe, así que necesitamos el documento que lo demuestra: se adjunta
       en la misma pregunta, con <strong>“Subir evidencia”</strong>. Mientras falte, el dominio no se
       puede enviar a validación aunque el cuestionario se vea completo.`
    );
  }
  if (porEnviar.length > 0) {
    notas.push(
      `${porEnviar.length === 1 ? "Un dominio ya está completo" : `${porEnviar.length} dominios ya están completos`}:
       solo falta apretar <strong>“Enviar respuestas a validación”</strong> dentro del dominio.
       Mientras no lo hagas, no podemos empezar a revisarlo.`
    );
  }
  const nota = notas
    .map(
      (t) =>
        `<p style="margin:16px 0 0;line-height:1.6;background:#f7f9fb;border-left:3px solid #2f6df0;padding:12px 15px;font-size:14px;color:#3c4854">${t}</p>`
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Procesos360 · Ley 21.719 de Protección de Datos Personales</p>
      <h1 style="margin:0 0 14px;font-size:20px;color:#111827">Hola ${primerNombre},</h1>
      <p style="margin:0 0 14px;line-height:1.6">${intro}</p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px">
        <thead><tr style="background:#f7f9fb">
          <th style="text-align:left;padding:9px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Dominio</th>
          <th style="text-align:right;padding:9px 14px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Qué falta</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>

      ${
        porResponder + sinMirada > 0
          ? `<p style="margin:14px 0 0;line-height:1.6;font-size:14px;color:#374151">
               Son <strong>${porResponder + sinMirada} preguntas</strong> en total. Para cada una necesitamos
               la nota del 0 al 5, un comentario breve y, si existe, el documento que lo respalde.
               Se guarda solo, así que puedes hacerlo en varias veces.
             </p>`
          : ""
      }
      ${nota}

      <div style="text-align:center;margin:24px 0 8px">
        <a href="${APP_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Ir a responder</a>
      </div>
      <p style="margin:12px 0 0;line-height:1.55;font-size:13px;color:#374151">
        Ante cualquier problema, escríbeme directamente a
        <a href="mailto:${CONTACTO}" style="color:#2563eb;font-weight:600">${CONTACTO}</a>.
        Este correo es automático y no recibe respuestas.
      </p>
    </div>
    <p style="text-align:center;margin:14px 0 0;font-size:12px;color:#9ca3af">Procesos360 SpA · Diagnóstico LPDP Honda</p>
  </div></body></html>`;

  const text = `Hola ${primerNombre},

${intro}

${u.dominios.map((d) => `  - ${d.orden}. ${d.nombre}: ${queFalta(d)}`).join("\n")}
${porResponder + sinMirada > 0 ? `\nSon ${porResponder + sinMirada} preguntas en total. Para cada una necesitamos la nota del 0 al 5, un comentario breve y, si existe, el documento que lo respalde.` : ""}
${evidencias > 0 ? `\nFalta adjuntar ${evidencias === 1 ? "1 documento" : `${evidencias} documentos`}: se sube en la misma pregunta, con "Subir evidencia". Mientras falte, el dominio no se puede enviar a validación.` : ""}
${porEnviar.length > 0 ? `\n${porEnviar.length === 1 ? "Un dominio ya está completo" : `${porEnviar.length} dominios ya están completos`}: falta apretar "Enviar respuestas a validación" dentro del dominio.` : ""}

Ingresa en: ${APP_URL}

Ante cualquier problema, escríbeme directamente a ${CONTACTO}.
Este correo es automático y no recibe respuestas.

Procesos360 · Diagnóstico LPDP Honda`;

  return { subject, html, text };
}
