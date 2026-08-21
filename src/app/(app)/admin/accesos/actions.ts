"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminGlobal } from "@/lib/session";
import {
  enviarCorreo,
  correoConfigurado,
  plantillaActivacion,
  plantillaCredenciales,
  DIAS_VIGENCIA_ENLACE,
} from "@/lib/email";

export type ResultadoEnvio = {
  ok: boolean;
  error?: string;
  enviados?: number;
  fallidos?: { nombre: string; motivo: string }[];
};

const APP_URL = "https://lpdp.procesos360.cl";

/** Token de un solo uso. Reemplaza cualquier enlace anterior de esa persona. */
async function nuevoEnlace(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenActivacion: token,
      tokenExpira: new Date(Date.now() + DIAS_VIGENCIA_ENLACE * 24 * 60 * 60 * 1000),
    },
  });
  return `${APP_URL}/activar?token=${token}`;
}

/**
 * Contraseña legible pero no adivinable. Se evitan los caracteres que se confunden al
 * dictarla por teléfono o al copiarla de un correo (l/1/I, O/0), porque este camino se
 * usa justamente cuando la persona no logró entrar por el enlace.
 */
function passwordTemporal(): string {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
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

async function destinatarios(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds }, activo: true },
    select: { id: true, nombre: true, email: true },
    orderBy: { nombre: "asc" },
  });
}

/** Manda el enlace para que cada persona defina su propia contraseña. */
export async function enviarEnlaceActivacion(userIds: string[]): Promise<ResultadoEnvio> {
  const session = await requireAdminGlobal();
  if (!correoConfigurado()) {
    return { ok: false, error: "El envío de correo no está configurado en el servidor." };
  }
  if (userIds.length === 0) return { ok: false, error: "No seleccionaste a nadie." };

  const users = await destinatarios(userIds);
  if (users.length === 0) return { ok: false, error: "Ninguna de esas cuentas está activa." };

  let enviados = 0;
  const fallidos: { nombre: string; motivo: string }[] = [];

  for (const u of users) {
    try {
      const enlace = await nuevoEnlace(u.id);
      const { subject, html, text } = plantillaActivacion(u.nombre, enlace, await dominiosDe(u.id));
      await enviarCorreo(u.email, subject, html, text);
      await prisma.user.update({
        where: { id: u.id },
        data: { ultimoAccesoEnviado: new Date() },
      });
      enviados++;
    } catch (e) {
      // El rechazo del servidor de correo de uno no puede cortar el envío al resto.
      fallidos.push({ nombre: u.nombre, motivo: (e as Error).message.slice(0, 120) });
    }
  }

  console.log(
    `[accesos] ${session.user.email} envió ${enviados} enlace(s) de activación` +
      (fallidos.length ? `, ${fallidos.length} fallidos` : "")
  );
  revalidatePath("/admin/accesos");
  return { ok: true, enviados, fallidos };
}

/**
 * Genera una contraseña nueva y la manda escrita.
 *
 * Es un reemplazo, no un reenvío: la contraseña original no se puede recuperar porque
 * en la base solo vive su hash. Quien reciba este correo pierde la clave que tuviera.
 */
export async function enviarPasswordNueva(userIds: string[]): Promise<ResultadoEnvio> {
  const session = await requireAdminGlobal();
  if (!correoConfigurado()) {
    return { ok: false, error: "El envío de correo no está configurado en el servidor." };
  }
  if (userIds.length === 0) return { ok: false, error: "No seleccionaste a nadie." };
  // Restablecer la propia contraseña desde aquí solo genera confusión: para eso está
  // el flujo normal de la cuenta, y de paso evita dejarse fuera por accidente.
  if (userIds.includes(session.user.id)) {
    return { ok: false, error: "No puedes generarte una contraseña nueva a ti mismo desde aquí." };
  }

  const users = await destinatarios(userIds);
  if (users.length === 0) return { ok: false, error: "Ninguna de esas cuentas está activa." };

  let enviados = 0;
  const fallidos: { nombre: string; motivo: string }[] = [];

  for (const u of users) {
    const password = passwordTemporal();
    try {
      const { subject, html, text } = plantillaCredenciales(
        u.nombre,
        u.email,
        password,
        await dominiosDe(u.id),
        true
      );
      // Primero se envía y después se guarda: si el correo no sale, la persona conserva
      // la contraseña que tenía en vez de quedarse con una que nadie conoce.
      await enviarCorreo(u.email, subject, html, text);
      await prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: bcrypt.hashSync(password, 10),
          // Un enlace de activación pendiente ya no tiene sentido y sería una segunda
          // puerta abierta sobre la misma cuenta.
          tokenActivacion: null,
          tokenExpira: null,
          ultimoAccesoEnviado: new Date(),
        },
      });
      enviados++;
    } catch (e) {
      fallidos.push({ nombre: u.nombre, motivo: (e as Error).message.slice(0, 120) });
    }
  }

  console.log(
    `[accesos] ${session.user.email} generó ${enviados} contraseña(s) nueva(s)` +
      (fallidos.length ? `, ${fallidos.length} fallidos` : "")
  );
  revalidatePath("/admin/accesos");
  return { ok: true, enviados, fallidos };
}
