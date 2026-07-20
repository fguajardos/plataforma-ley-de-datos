import { requireAccesoSecciones } from "@/lib/session";
import { getDiagnosticoFull, getRiesgos } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { GenerarRiesgosButton } from "./GenerarRiesgosButton";
import { RiesgoRow } from "./RiesgoRow";

const ORDEN_NIVEL: Record<string, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAJO: 3 };

export default async function RiesgosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);
  const diag = await getDiagnosticoFull(id, session); // valida acceso
  const riesgos = await getRiesgos(id);
  riesgos.sort((a, b) => (ORDEN_NIVEL[a.nivel] ?? 9) - (ORDEN_NIVEL[b.nivel] ?? 9));

  const conteo = {
    CRITICO: riesgos.filter((r) => r.nivel === "CRITICO").length,
    ALTO: riesgos.filter((r) => r.nivel === "ALTO").length,
    MEDIO: riesgos.filter((r) => r.nivel === "MEDIO").length,
    BAJO: riesgos.filter((r) => r.nivel === "BAJO").length,
  };

  return (
    <>
      <DiagnosticoNav id={id} active="riesgos" />
      <PageHeader
        title="Motor de Riesgos"
        subtitle={`${diag.nombre} · exposición regulatoria derivada de las brechas`}
        actions={<GenerarRiesgosButton diagnosticoId={id} />}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Resumen label="Críticos" valor={conteo.CRITICO} color="text-red-700" />
        <Resumen label="Altos" valor={conteo.ALTO} color="text-orange-700" />
        <Resumen label="Medios" valor={conteo.MEDIO} color="text-yellow-700" />
        <Resumen label="Bajos" valor={conteo.BAJO} color="text-slate-600" />
      </div>

      {riesgos.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No hay riesgos. Genera brechas primero y pulsa “Generar riesgos”.
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {riesgos.map((r) => (
                <RiesgoRow
                  key={r.id}
                  riesgo={{
                    id: r.id,
                    descripcion: r.descripcion,
                    causa: r.causa,
                    consecuencia: r.consecuencia,
                    probabilidad: r.probabilidad,
                    impacto: r.impacto,
                    nivel: r.nivel,
                    controlExistente: r.controlExistente,
                    mitigacion: r.mitigacion,
                    codigo: r.brecha?.codigo ?? null,
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

function Resumen({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}
