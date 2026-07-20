"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CONSENTIMIENTO_VERSION } from "@/lib/consentimiento";

export type ConsentimientoState = { error?: string };

export async function aceptarConsentimientoAction(
  _prev: ConsentimientoState,
  formData: FormData
): Promise<ConsentimientoState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (formData.get("acepto") !== "on") {
    return { error: "Debe marcar la casilla para otorgar su consentimiento." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");

  const fecha = new Date();

  await prisma.$transaction([
    prisma.aceptacionConsentimiento.create({
      data: {
        userId: session.user.id,
        version: CONSENTIMIENTO_VERSION,
        fecha,
        ip,
        userAgent,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { consentimientoVersion: CONSENTIMIENTO_VERSION, consentimientoFecha: fecha },
    }),
  ]);

  redirect("/dashboard");
}
