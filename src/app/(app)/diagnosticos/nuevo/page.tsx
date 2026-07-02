import { requireRole, esStaffP360 } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ROLES, ROLES_P360 } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { NuevoDiagnosticoForm } from "./NuevoDiagnosticoForm";

export default async function NuevoDiagnosticoPage() {
  const session = await requireRole([ROLES.ADMIN_P360, ROLES.CONSULTOR, ROLES.ADMIN_EMPRESA]);

  const empresas = esStaffP360(session.user.role)
    ? await prisma.empresa.findMany({ where: { activa: true }, select: { id: true, razonSocial: true }, orderBy: { razonSocial: "asc" } })
    : await prisma.empresa.findMany({ where: { id: session.user.empresaId ?? "__none__" }, select: { id: true, razonSocial: true } });

  const consultores = await prisma.user.findMany({
    where: { role: { in: ROLES_P360 }, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <PageHeader title="Nuevo diagnóstico" subtitle="Crea un diagnóstico LPDP y configura su alcance" />
      <Card className="max-w-2xl">
        <CardContent className="py-6">
          {empresas.length === 0 ? (
            <p className="text-sm text-slate-500">No hay empresas disponibles.</p>
          ) : (
            <NuevoDiagnosticoForm
              empresas={empresas.map((e) => ({ id: e.id, nombre: e.razonSocial }))}
              consultores={consultores}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
