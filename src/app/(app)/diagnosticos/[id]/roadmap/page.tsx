import { requireSession } from "@/lib/session";
import { getDiagnosticoFull, getAcciones } from "@/lib/data/diagnosticos";
import { construirRoadmap, type AccionRoadmapInput } from "@/lib/engines/roadmap";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { PrioridadBadge, EstadoAccionBadge } from "@/components/badges";

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session); // valida acceso
  const acciones = await getAcciones(id);

  const base = diag.fechaInicio ?? new Date();
  const inputs: AccionRoadmapInput[] = acciones.map((a) => ({
    id: a.id,
    descripcion: a.descripcion,
    prioridad: a.prioridad,
    estado: a.estado,
    avance: a.avance,
    plazo: a.plazo,
    responsable: a.responsable,
  }));
  const roadmap = construirRoadmap(inputs, base);

  return (
    <>
      <DiagnosticoNav id={id} active="roadmap" />
      <PageHeader
        title="Roadmap de Cumplimiento"
        subtitle={`${diag.nombre} · hoja de ruta por horizontes (base: ${base.toLocaleDateString("es-CL")})`}
      />

      {roadmap.total === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No hay acciones para ordenar. Genera el plan de tratamiento primero.
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <Resumen label="Acciones" valor={roadmap.total} color="text-slate-700" />
            <Resumen label="Críticas abiertas" valor={roadmap.criticas.length} color="text-red-700" />
            <Resumen label="Vencidas" valor={roadmap.vencidas.length} color="text-orange-700" />
          </div>

          <div className="space-y-4">
            {roadmap.horizontes.map((h) => (
              <Card key={h.key}>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>
                    {h.label} — <span className="font-normal text-slate-500">{h.objetivo}</span>
                  </CardTitle>
                  <Badge color="blue">{h.acciones.length}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {h.acciones.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-400">Sin acciones en este horizonte.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {h.acciones.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800">{a.descripcion}</p>
                            <p className="text-xs text-slate-400">
                              {a.responsable ?? "Sin responsable"} ·{" "}
                              {a.plazo ? a.plazo.toLocaleDateString("es-CL") : "sin plazo"} · avance {a.avance}%
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <PrioridadBadge prioridad={a.prioridad} />
                            <EstadoAccionBadge estado={a.estado} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Resumen({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
