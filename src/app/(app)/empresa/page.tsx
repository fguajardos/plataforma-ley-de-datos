import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";

export default async function EmpresaPage() {
  const session = await requireRole([ROLES.ADMIN_EMPRESA]);
  const empresa = session.user.empresaId
    ? await prisma.empresa.findUnique({
        where: { id: session.user.empresaId },
        include: { areas: true },
      })
    : null;

  if (!empresa) {
    return <Card className="p-8 text-sm text-slate-500">No se encontró la empresa.</Card>;
  }

  const datos: [string, string | number | null][] = [
    ["Razón social", empresa.razonSocial],
    ["RUT", empresa.rut],
    ["Nombre comercial", empresa.nombreComercial],
    ["Industria", empresa.industria],
    ["Tamaño", empresa.tamano],
    ["País", empresa.pais],
    ["Región", empresa.region],
    ["N° colaboradores", empresa.numColaboradores],
    ["Sitio web", empresa.sitioWeb],
    ["Responsable", empresa.responsablePrincipal],
    ["Correo responsable", empresa.correoResponsable],
    ["Teléfono", empresa.telefono],
  ];

  return (
    <>
      <PageHeader title="Mi Empresa" subtitle="Perfil organizacional y áreas" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {datos.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="text-slate-800">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Áreas ({empresa.areas.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {empresa.areas.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {a.responsable} {a.cargo ? `· ${a.cargo}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {a.trataDatos && <Badge color="blue">Datos</Badge>}
                      {a.trataDatosSensibles && <Badge color="red">Sensibles</Badge>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
