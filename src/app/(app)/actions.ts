"use server";

import { signOut, auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Marca el tutorial inicial como visto (al completarlo u omitirlo). */
export async function marcarTourVistoAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { tourVisto: true },
  });
}
