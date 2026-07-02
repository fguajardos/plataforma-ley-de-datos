import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ROLES, TIPO_DIAGNOSTICO, type Role } from "@/lib/constants";
import { listarDiagnosticos } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { EstadoDiagnosticoBadge } from "@/components/badges";

const PUEDE_CREAR: Role[] = [ROLES.ADMIN_P360, ROLES.CONSULTOR, ROLES.ADMIN_EMPRESA];

export default async function DiagnosticosPage() {
  const session = await requireRole([
    ROLES.ADMIN_P360,
    ROLES.CONSULTOR,
    ROLES.ADMIN_EMPRESA,
    ROLES.RESPONSABLE_DOMINIO,
  ]);
  const diagnosticos = await listarDiagnosticos(session);

  return (
    <>
      <PageHeader
        title="Diagnósticos"
        subtitle="Evaluaciones de cumplimiento LPDP"
        actions={
          PUEDE_CREAR.includes(session.user.role) ? (
            <Link
              href="/diagnosticos/nuevo"
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-600/90"
            >
              + Nuevo diagnóstico
            </Link>
          ) : undefined
        }
      />

      {diagnosticos.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No hay diagnósticos registrados.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Diagnóstico</th>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Brechas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diagnosticos.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/diagnosticos/${d.id}`} className="font-medium text-brand-600 hover:underline">
                      {d.nombre}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{d.empresa.razonSocial}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {TIPO_DIAGNOSTICO[d.tipo as keyof typeof TIPO_DIAGNOSTICO] ?? d.tipo}
                  </td>
                  <td className="px-5 py-3">
                    <EstadoDiagnosticoBadge estado={d.estado} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{d._count.brechas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
