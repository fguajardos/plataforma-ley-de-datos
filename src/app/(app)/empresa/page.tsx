import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmpresaDatosForm } from "./EmpresaDatosForm";
import { AreasManager } from "./AreasManager";
import { UsuariosManager } from "./UsuariosManager";

export default async function EmpresaPage() {
  const session = await requireRole([ROLES.ADMIN_EMPRESA]);
  const empresa = session.user.empresaId
    ? await prisma.empresa.findUnique({
        where: { id: session.user.empresaId },
        include: {
          areas: { orderBy: { nombre: "asc" } },
          usuarios: { orderBy: { nombre: "asc" } },
          diagnosticos: { select: { id: true, estado: true }, orderBy: { createdAt: "desc" } },
        },
      })
    : null;

  if (!empresa) {
    return <Card className="p-8 text-sm text-slate-500">No se encontró la empresa.</Card>;
  }

  const sinConfigurar = empresa.diagnosticos.every((d) => d.estado === "BORRADOR");

  return (
    <>
      <PageHeader title="Mi Empresa" subtitle="Perfil organizacional, áreas y usuarios" />

      {/* Onboarding / bienvenida (doc §5.3) */}
      {sinConfigurar && (
        <Card className="mb-6 border-brand-200 bg-brand-50/40">
          <CardContent className="flex flex-col items-start gap-2 py-5">
            <p className="text-sm font-semibold text-slate-800">Bienvenido al Diagnóstico LPDP Procesos360</p>
            <p className="text-sm text-slate-600">
              Evalúa el cumplimiento de tu organización frente a la Ley N° 21.719: completa tus datos y áreas,
              crea tus usuarios y configura tu diagnóstico para comenzar.
            </p>
            <Link
              href="/diagnosticos/nuevo"
              className="mt-1 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-600/90"
            >
              Iniciar configuración →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <EmpresaDatosForm empresa={empresa} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Áreas ({empresa.areas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <AreasManager empresaId={empresa.id} areas={empresa.areas} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usuarios internos ({empresa.usuarios.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <UsuariosManager empresaId={empresa.id} usuarios={empresa.usuarios} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
