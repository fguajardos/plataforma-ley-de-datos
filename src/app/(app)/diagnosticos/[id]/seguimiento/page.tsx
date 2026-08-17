import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, esStaffP360 } from "@/lib/session";
import { pendientesDelDiagnostico, queFalta } from "@/lib/data/pendientes";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { BotonRecordatorio } from "./BotonRecordatorio";

export const metadata = { title: "Seguimiento · Procesos360" };

/** "hace 3 días", "hoy" — más legible que una fecha suelta en una tabla. */
function haceCuanto(f: Date | null): string {
  if (!f) return "nunca";
  const dias = Math.floor((Date.now() - f.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!esStaffP360(session.user.role)) notFound();

  const diag = await prisma.diagnostico.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });
  if (!diag) notFound();

  const participantes = await pendientesDelDiagnostico(id);
  const pendientes = participantes.filter((u) => !u.alDia);
  const alDia = participantes.filter((u) => u.alDia);
  const sinEntrar = participantes.filter((u) => !u.ultimaActividad);
  const preguntasPendientes = pendientes.reduce((n, u) => n + u.totalPreguntas, 0);

  return (
    <>
      <PageHeader
        title="Seguimiento de participantes"
        subtitle={`Qué le falta a cada uno en ${diag.nombre}`}
      />
      <DiagnosticoNav id={id} active="seguimiento" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Con pendientes" valor={pendientes.length} total={participantes.length} />
        <Kpi label="Preguntas por responder" valor={preguntasPendientes} />
        <Kpi label="Nunca han entrado" valor={sinEntrar.length} alerta={sinEntrar.length > 0} />
        <Kpi label="Al día" valor={alDia.length} bueno={alDia.length > 0} />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Participantes con pendientes</CardTitle>
          {pendientes.length > 0 && (
            <BotonRecordatorio diagnosticoId={id} cuantos={pendientes.length} variante="principal" />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {pendientes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Nadie tiene pendientes. Todos los dominios abiertos están cubiertos.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendientes.map((u) => (
                <li key={u.userId} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{u.nombre}</span>
                        {u.cargo && <span className="text-xs text-slate-400">{u.cargo}</span>}
                        {!u.ultimaActividad && <Badge color="orange">Nunca ha entrado</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {u.email} · {u.aportes} respuestas registradas · última actividad:{" "}
                        {haceCuanto(u.ultimaActividad)}
                        {u.ultimoRecordatorio && ` · recordado ${haceCuanto(u.ultimoRecordatorio)}`}
                      </p>

                      <ul className="mt-2 space-y-1">
                        {u.dominios.map((d) => (
                          <li key={d.orden} className="text-sm text-slate-600">
                            <span className="font-medium text-slate-700">
                              {d.orden}. {d.nombre}
                            </span>{" "}
                            <span className="text-slate-400">— {queFalta(d)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="shrink-0 text-right">
                      {u.totalPreguntas > 0 && (
                        <p className="mb-1 text-2xl font-bold tabular-nums text-slate-900">
                          {u.totalPreguntas}
                          <span className="ml-1 text-xs font-normal text-slate-400">preg.</span>
                        </p>
                      )}
                      <BotonRecordatorio diagnosticoId={id} userId={u.userId} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {alDia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Al día ({alDia.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {alDia.map((u) => (
                <li key={u.userId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{u.nombre}</span>
                    {u.cargo && <span className="ml-2 text-xs text-slate-400">{u.cargo}</span>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {u.aportes} respuestas · última actividad: {haceCuanto(u.ultimaActividad)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Kpi({
  label,
  valor,
  total,
  alerta,
  bueno,
}: {
  label: string;
  valor: number;
  total?: number;
  alerta?: boolean;
  bueno?: boolean;
}) {
  const color = alerta ? "text-orange-600" : bueno ? "text-green-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>
        {valor}
        {total != null && <span className="text-base font-normal text-slate-400"> / {total}</span>}
      </p>
    </div>
  );
}
