"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { pendientesDelDiagnostico } from "@/lib/data/pendientes";
import { enviarCorreo, plantillaRecordatorio, correoConfigurado } from "@/lib/email";

export type EnvioRecordatorio = {
  ok: boolean;
  enviados?: number;
  fallidos?: { nombre: string; motivo: string }[];
  error?: string;
};

/**
 * Envía el recordatorio de lo pendiente. Sin `userIds` va a todos los que tengan algo
 * pendiente; con ellos, solo a esos. Nunca escribe a quien está al día.
 */
export async function enviarRecordatorios(
  diagnosticoId: string,
  userIds?: string[]
): Promise<EnvioRecordatorio> {
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) {
    return { ok: false, error: "Solo el equipo consultor puede enviar recordatorios." };
  }
  if (!correoConfigurado()) {
    return { ok: false, error: "El envío de correo no está configurado en el servidor." };
  }

  const todos = await pendientesDelDiagnostico(diagnosticoId);
  const objetivo = todos.filter(
    (u) => !u.alDia && (!userIds?.length || userIds.includes(u.userId))
  );
  if (objetivo.length === 0) {
    return { ok: false, error: "No hay a quién recordarle: todos están al día." };
  }

  let enviados = 0;
  const fallidos: { nombre: string; motivo: string }[] = [];

  for (const u of objetivo) {
    const { subject, html, text } = plantillaRecordatorio(u);
    try {
      await enviarCorreo(u.email, subject, html, text);
      await prisma.user.update({
        where: { id: u.userId },
        data: { ultimoRecordatorio: new Date() },
      });
      enviados++;
    } catch (e) {
      // Un rechazo del servidor de correo del destinatario no debe cortar el resto.
      fallidos.push({ nombre: u.nombre, motivo: (e as Error).message.slice(0, 120) });
    }
  }

  revalidatePath(`/diagnosticos/${diagnosticoId}/seguimiento`);
  return { ok: true, enviados, fallidos };
}
