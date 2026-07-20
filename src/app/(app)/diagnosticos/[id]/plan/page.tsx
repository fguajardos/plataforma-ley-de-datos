import { requireAccesoSecciones, esStaffP360 } from "@/lib/session";
import { getDiagnosticoFull, getAcciones } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { GenerarPlanButton } from "./GenerarPlanButton";
import { AccionRow } from "./AccionRow";

const ORDEN_PRIO: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);
  const diag = await getDiagnosticoFull(id, session); // valida acceso
  const puedeValidar = esStaffP360(session.user.role);

  const acciones = await getAcciones(id);
  acciones.sort((a, b) => (ORDEN_PRIO[a.prioridad] ?? 9) - (ORDEN_PRIO[b.prioridad] ?? 9));

  const total = acciones.length;
  const cerradas = acciones.filter((a) => a.estado === "CERRADA").length;
  const avanceMedio = total ? Math.round(acciones.reduce((s, a) => s + a.avance, 0) / total) : 0;

  return (
    <>
      <DiagnosticoNav id={id} active="plan" />
      <PageHeader
        title="Plan de Tratamiento"
        subtitle={`${diag.nombre} · acciones correctivas derivadas de las brechas`}
        actions={<GenerarPlanButton diagnosticoId={id} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Acciones" valor={total} />
        <Kpi label="Cerradas" valor={cerradas} />
        <Kpi label="Avance medio" valor={`${avanceMedio}%`} />
        <Kpi label="Prioridad alta" valor={acciones.filter((a) => a.prioridad === "ALTA").length} />
      </div>

      {total === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No hay acciones. Genera brechas y pulsa “Generar plan”.
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {acciones.map((a) => (
                <AccionRow
                  key={a.id}
                  puedeValidar={puedeValidar}
                  accion={{
                    id: a.id,
                    descripcion: a.descripcion,
                    responsable: a.responsable,
                    prioridad: a.prioridad,
                    esfuerzo: a.esfuerzo,
                    estado: a.estado,
                    avance: a.avance,
                    validacionConsultor: a.validacionConsultor,
                    plazoLabel: a.plazo ? a.plazo.toLocaleDateString("es-CL") : null,
                    codigo: a.brecha?.codigo ?? null,
                  }}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Kpi({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{valor}</p>
    </div>
  );
}
