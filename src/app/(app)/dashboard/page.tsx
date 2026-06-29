import Link from "next/link";
import { requireSession, getCurrentUser, esStaffP360 } from "@/lib/session";
import { ROLE_LABELS, NIVEL_MADUREZ, ROLES, type Role } from "@/lib/constants";

type SessionLike = { user: { id: string; role: Role; empresaId: string | null } };
import { fmt } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { listarDiagnosticos, getDiagnosticoFull, madurezDeDiagnostico } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { NivelBadge, EstadoDiagnosticoBadge } from "@/components/badges";

export default async function DashboardPage() {
  const session = await requireSession();
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre?.split(" ")[0] ?? ""}`}
        subtitle={`${ROLE_LABELS[session.user.role]}${user?.empresa ? ` · ${user.empresa.razonSocial}` : ""}`}
      />
      {esStaffP360(session.user.role) ? (
        <DashboardP360 session={session} />
      ) : (
        <DashboardEmpresa empresaId={session.user.empresaId} />
      )}
    </>
  );
}

async function DashboardP360({ session }: { session: SessionLike }) {
  const [diagnosticos, empresas] = await Promise.all([
    listarDiagnosticos(session),
    prisma.empresa.count(),
  ]);
  const totalBrechas = diagnosticos.reduce((a, d) => a + d._count.brechas, 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Empresas" valor={empresas} />
        <Kpi label="Diagnósticos" valor={diagnosticos.length} />
        <Kpi label="Brechas totales" valor={totalBrechas} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diagnósticos recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {diagnosticos.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link href={`/diagnosticos/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.nombre}</p>
                    <p className="text-xs text-slate-400">{d.empresa.razonSocial}</p>
                  </div>
                  <EstadoDiagnosticoBadge estado={d.estado} />
                </Link>
              </li>
            ))}
            {diagnosticos.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">Sin diagnósticos.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

async function DashboardEmpresa({ empresaId }: { empresaId: string | null }) {
  if (!empresaId) return <Card className="p-8 text-sm text-slate-500">Tu usuario no tiene empresa asociada.</Card>;

  const diag = await prisma.diagnostico.findFirst({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!diag) {
    return <Card className="p-8 text-sm text-slate-500">Aún no hay diagnósticos para tu empresa.</Card>;
  }

  const full = await getDiagnosticoFull(diag.id, { user: { id: "", role: ROLES.ADMIN_EMPRESA, empresaId } });
  const madurez = madurezDeDiagnostico(full);
  const incluidos = full.dominios.filter((d) => d.incluido);
  const total = incluidos.reduce((a, d) => a + d.dominio._count.preguntas, 0);
  const respondidas = incluidos.reduce((a, d) => a + d.respuestas.filter((r) => r.valor != null).length, 0);
  const avance = total ? Math.round((respondidas / total) * 100) : 0;
  const brechasCount = await prisma.brecha.count({ where: { diagnosticoId: diag.id } });
  const brechasCriticas = await prisma.brecha.count({ where: { diagnosticoId: diag.id, criticidad: "CRITICA" } });

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Madurez global"
          valor={fmt(madurez.global)}
          color={madurez.nivelGlobal ? NIVEL_MADUREZ[madurez.nivelGlobal].color : undefined}
          extra={<NivelBadge nivel={madurez.nivelGlobal} />}
        />
        <Kpi label="Avance" valor={`${avance}%`} />
        <Kpi label="Brechas" valor={brechasCount} />
        <Kpi label="Brechas críticas" valor={brechasCriticas} color="#dc2626" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dominios críticos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {madurez.criticos.slice(0, 5).map((d) => (
                <li key={d.dominioId} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-700">D{d.orden} · {d.nombre}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{fmt(d.promedio)}</span>
                    <NivelBadge nivel={d.nivel} />
                  </span>
                </li>
              ))}
              {madurez.criticos.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">Sin dominios críticos evaluados.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/diagnosticos/${diag.id}`} className="block rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-brand-600 hover:bg-slate-50">
              Continuar diagnóstico →
            </Link>
            <Link href={`/diagnosticos/${diag.id}/madurez`} className="block rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Ver madurez y radar →
            </Link>
            <Link href={`/diagnosticos/${diag.id}/brechas`} className="block rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Ver brechas →
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({
  label,
  valor,
  color,
  extra,
}: {
  label: string;
  valor: React.ReactNode;
  color?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color: color ?? "#0f172a" }}>
          {valor}
        </span>
        {extra}
      </div>
    </div>
  );
}
