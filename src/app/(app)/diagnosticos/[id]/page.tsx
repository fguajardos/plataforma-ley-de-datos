import Link from "next/link";
import { requireSession } from "@/lib/session";
import { TIPO_DIAGNOSTICO, NIVEL_MADUREZ } from "@/lib/constants";
import { fmt } from "@/lib/utils";
import { getDiagnosticoFull, madurezDeDiagnostico } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EstadoDiagnosticoBadge, NivelBadge } from "@/components/badges";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";

export default async function DiagnosticoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session);
  const madurez = madurezDeDiagnostico(diag);

  const dominiosIncluidos = diag.dominios.filter((d) => d.incluido);
  const totalPreguntas = dominiosIncluidos.reduce((a, d) => a + d.dominio._count.preguntas, 0);
  const respondidas = dominiosIncluidos.reduce(
    (a, d) => a + d.respuestas.filter((r) => r.valor != null).length,
    0
  );
  const avanceGlobal = totalPreguntas ? Math.round((respondidas / totalPreguntas) * 100) : 0;

  return (
    <>
      <DiagnosticoNav id={id} active="resumen" />
      <PageHeader
        title={diag.nombre}
        subtitle={`${diag.empresa.razonSocial} · ${TIPO_DIAGNOSTICO[diag.tipo as keyof typeof TIPO_DIAGNOSTICO] ?? diag.tipo}`}
        actions={
          <Link
            href={`/diagnosticos/${id}/configurar`}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Configurar
          </Link>
        }
      />

      {/* Resumen */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Estado">
          <EstadoDiagnosticoBadge estado={diag.estado} />
        </StatCard>
        <StatCard label="Madurez global">
          <span
            className="text-2xl font-bold"
            style={{ color: madurez.nivelGlobal ? NIVEL_MADUREZ[madurez.nivelGlobal].color : "#94a3b8" }}
          >
            {fmt(madurez.global)}
          </span>
          <span className="ml-2">
            <NivelBadge nivel={madurez.nivelGlobal} />
          </span>
        </StatCard>
        <StatCard label="Avance">
          <span className="text-2xl font-bold text-slate-800">{avanceGlobal}%</span>
          <span className="ml-1 text-xs text-slate-400">
            ({respondidas}/{totalPreguntas})
          </span>
        </StatCard>
        <StatCard label="Consultor">
          <span className="text-sm font-medium text-slate-700">
            {diag.consultor?.nombre ?? "—"}
          </span>
        </StatCard>
      </div>

      {/* Dominios */}
      <Card>
        <CardHeader>
          <CardTitle>Dominios de evaluación ({dominiosIncluidos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {diag.dominios.map((d) => {
              const res = madurez.dominios.find((m) => m.dominioId === d.dominioId);
              return (
                <li key={d.id}>
                  <Link
                    href={`/diagnosticos/${id}/dominios/${d.dominio.orden}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand">
                      {d.dominio.orden}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{d.dominio.nombre}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-600"
                            style={{ width: `${res?.avance ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{res?.avance ?? 0}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">{fmt(res?.promedio ?? null)}</span>
                      <NivelBadge nivel={res?.nivel ?? null} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
