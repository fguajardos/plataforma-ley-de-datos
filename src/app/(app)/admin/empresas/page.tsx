import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, Badge } from "@/components/ui";

export default async function AdminEmpresasPage() {
  await requireRole([ROLES.ADMIN_P360]);
  const empresas = await prisma.empresa.findMany({
    include: { _count: { select: { diagnosticos: true, usuarios: true } } },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <>
      <PageHeader title="Empresas" subtitle="Clientes registrados en la plataforma" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Razón social</th>
              <th className="px-5 py-3 font-medium">RUT</th>
              <th className="px-5 py-3 font-medium">Industria</th>
              <th className="px-5 py-3 font-medium">Diagnósticos</th>
              <th className="px-5 py-3 font-medium">Usuarios</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empresas.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{e.razonSocial}</td>
                <td className="px-5 py-3 text-slate-600">{e.rut}</td>
                <td className="px-5 py-3 text-slate-600">{e.industria ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{e._count.diagnosticos}</td>
                <td className="px-5 py-3 text-slate-600">{e._count.usuarios}</td>
                <td className="px-5 py-3">
                  {e.activa ? <Badge color="green">Activa</Badge> : <Badge color="slate">Inactiva</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
