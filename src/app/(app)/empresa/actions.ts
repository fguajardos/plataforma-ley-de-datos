"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { ROLES, type Role } from "@/lib/constants";

export type Result = { ok: boolean; error?: string };

function puedeGestionar(
  session: { user: { role: Role; empresaId: string | null } },
  empresaId: string
): boolean {
  return (
    esStaffP360(session.user.role) ||
    (session.user.role === ROLES.ADMIN_EMPRESA && session.user.empresaId === empresaId)
  );
}

// ───────────── Datos de la empresa ─────────────

const empresaSchema = z.object({
  empresaId: z.string().min(1),
  razonSocial: z.string().min(2).max(200),
  rut: z.string().min(3).max(20),
  nombreComercial: z.string().max(200).optional().default(""),
  industria: z.string().max(120).optional().default(""),
  tamano: z.string().max(20).optional().default(""),
  pais: z.string().max(60).optional().default(""),
  region: z.string().max(80).optional().default(""),
  numColaboradores: z.coerce.number().int().min(0).optional(),
  sitioWeb: z.string().max(200).optional().default(""),
  responsablePrincipal: z.string().max(120).optional().default(""),
  correoResponsable: z.string().max(120).optional().default(""),
  telefono: z.string().max(40).optional().default(""),
});

export async function actualizarEmpresaAction(input: z.input<typeof empresaSchema>): Promise<Result> {
  const session = await requireSession();
  const parsed = empresaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const d = parsed.data;
  if (!puedeGestionar(session, d.empresaId)) return { ok: false, error: "Sin acceso." };

  await prisma.empresa.update({
    where: { id: d.empresaId },
    data: {
      razonSocial: d.razonSocial,
      rut: d.rut,
      nombreComercial: d.nombreComercial || null,
      industria: d.industria || null,
      tamano: d.tamano || null,
      pais: d.pais || null,
      region: d.region || null,
      numColaboradores: d.numColaboradores ?? null,
      sitioWeb: d.sitioWeb || null,
      responsablePrincipal: d.responsablePrincipal || null,
      correoResponsable: d.correoResponsable || null,
      telefono: d.telefono || null,
    },
  });
  revalidatePath("/empresa");
  return { ok: true };
}

// ───────────── Áreas ─────────────

const areaSchema = z.object({
  id: z.string().optional(),
  empresaId: z.string().min(1),
  nombre: z.string().min(2).max(120),
  responsable: z.string().max(120).optional().default(""),
  cargo: z.string().max(120).optional().default(""),
  correo: z.string().max(120).optional().default(""),
  participaDiagnostico: z.boolean().optional().default(true),
  trataDatos: z.boolean().optional().default(false),
  trataDatosSensibles: z.boolean().optional().default(false),
  usaSistemas: z.boolean().optional().default(false),
});

export async function guardarAreaAction(input: z.input<typeof areaSchema>): Promise<Result> {
  const session = await requireSession();
  const parsed = areaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const d = parsed.data;
  if (!puedeGestionar(session, d.empresaId)) return { ok: false, error: "Sin acceso." };

  const payload = {
    nombre: d.nombre,
    responsable: d.responsable || null,
    cargo: d.cargo || null,
    correo: d.correo || null,
    participaDiagnostico: d.participaDiagnostico,
    trataDatos: d.trataDatos,
    trataDatosSensibles: d.trataDatosSensibles,
    usaSistemas: d.usaSistemas,
  };

  if (d.id) {
    const area = await prisma.area.findUnique({ where: { id: d.id }, select: { empresaId: true } });
    if (!area || area.empresaId !== d.empresaId) return { ok: false, error: "Área no encontrada." };
    await prisma.area.update({ where: { id: d.id }, data: payload });
  } else {
    await prisma.area.create({ data: { empresaId: d.empresaId, ...payload } });
  }
  revalidatePath("/empresa");
  return { ok: true };
}

export async function eliminarAreaAction(areaId: string): Promise<Result> {
  const session = await requireSession();
  const area = await prisma.area.findUnique({ where: { id: areaId }, select: { empresaId: true } });
  if (!area) return { ok: false, error: "Área no encontrada." };
  if (!puedeGestionar(session, area.empresaId)) return { ok: false, error: "Sin acceso." };
  await prisma.area.delete({ where: { id: areaId } });
  revalidatePath("/empresa");
  return { ok: true };
}

// ───────────── Usuarios internos de la empresa ─────────────

const ROLES_EMPRESA: Role[] = [ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO, ROLES.ALTA_DIRECCION];

const usuarioSchema = z.object({
  id: z.string().optional(),
  empresaId: z.string().min(1),
  nombre: z.string().min(2).max(120),
  email: z.string().email().max(160),
  role: z.enum([ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO, ROLES.ALTA_DIRECCION]),
  cargo: z.string().max(120).optional().default(""),
  password: z.string().min(6).max(100).optional().or(z.literal("")),
  activo: z.boolean().optional().default(true),
});

export async function guardarUsuarioAction(input: z.input<typeof usuarioSchema>): Promise<Result> {
  const session = await requireSession();
  const parsed = usuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos (revisa email y rol)." };
  const d = parsed.data;
  if (!puedeGestionar(session, d.empresaId)) return { ok: false, error: "Sin acceso." };
  if (!ROLES_EMPRESA.includes(d.role)) return { ok: false, error: "Rol no permitido." };

  if (d.id) {
    const u = await prisma.user.findUnique({ where: { id: d.id }, select: { empresaId: true } });
    if (!u || u.empresaId !== d.empresaId) return { ok: false, error: "Usuario no encontrado." };
    await prisma.user.update({
      where: { id: d.id },
      data: {
        nombre: d.nombre,
        email: d.email,
        role: d.role,
        cargo: d.cargo || null,
        activo: d.activo,
        ...(d.password ? { passwordHash: bcrypt.hashSync(d.password, 10) } : {}),
      },
    });
  } else {
    if (!d.password) return { ok: false, error: "La contraseña es obligatoria para un usuario nuevo." };
    const existe = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
    if (existe) return { ok: false, error: "Ya existe un usuario con ese correo." };
    await prisma.user.create({
      data: {
        nombre: d.nombre,
        email: d.email,
        role: d.role,
        cargo: d.cargo || null,
        activo: d.activo,
        empresaId: d.empresaId,
        passwordHash: bcrypt.hashSync(d.password, 10),
      },
    });
  }
  revalidatePath("/empresa");
  return { ok: true };
}
