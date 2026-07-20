import { requireAccesoSecciones } from "@/lib/session";
import { NIVEL_MADUREZ } from "@/lib/constants";
import { fmt } from "@/lib/utils";
import {
  getDiagnosticoFull,
  madurezDeDiagnostico,
  areaDeDominioMap,
  madurezDiagnosticoAnterior,
} from "@/lib/data/diagnosticos";
import { madurezPorArea, compararMadurez } from "@/lib/engines/madurez";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { NivelBadge } from "@/components/badges";
import { RadarChart } from "@/components/RadarChart";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";

export default async function MadurezPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);
  const diag = await getDiagnosticoFull(id, session);
  const madurez = madurezDeDiagnostico(diag);

  const radarData = madurez.dominios.map((d) => ({ label: d.nombre, value: d.promedio }));
  const areas = madurezPorArea(madurez, areaDeDominioMap(diag));
  const previa = await madurezDiagnosticoAnterior(diag, session);
  const comparacion = compararMadurez(madurez, previa);

  return (
    <>
      <DiagnosticoNav id={id} active="madurez" />
      <PageHeader title="Motor de Madurez" subtitle={`${diag.nombre} · nivel de cumplimiento por dominio, área y global`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gráfico radar de madurez</CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart data={radarData} />
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-slate-500">Madurez global:</span>
              <span
                className="text-2xl font-bold"
                style={{ color: madurez.nivelGlobal ? NIVEL_MADUREZ[madurez.nivelGlobal].color : "#94a3b8" }}
              >
                {fmt(madurez.global)}
              </span>
              <NivelBadge nivel={madurez.nivelGlobal} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado por dominio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {madurez.dominios.map((d) => (
                  <tr key={d.dominioId}>
                    <td className="px-5 py-2.5 text-slate-700">
                      <span className="mr-2 text-xs text-slate-400">D{d.orden}</span>
                      {d.nombre}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmt(d.promedio)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <NivelBadge nivel={d.nivel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Madurez por área (doc §9.4) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Madurez por área</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {areas.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Sin áreas asignadas a los dominios (configúralas en “Configurar”).</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {areas.map((a) => (
                  <tr key={a.areaId ?? "sin"}>
                    <td className="px-5 py-2.5 text-slate-700">{a.nombre}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-slate-400">{a.dominios} dominio(s)</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmt(a.promedio)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <NivelBadge nivel={a.nivel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Comparación con diagnóstico anterior (doc §9.4) */}
      {previa && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              Comparación con diagnóstico anterior · global {fmt(comparacion.globalPrevia)} →{" "}
              {fmt(comparacion.globalActual)}{" "}
              <DeltaTag delta={comparacion.delta} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Dominio</th>
                  <th className="px-3 py-2 text-right font-medium">Anterior</th>
                  <th className="px-3 py-2 text-right font-medium">Actual</th>
                  <th className="px-5 py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparacion.dominios.map((d) => (
                  <tr key={d.orden}>
                    <td className="px-5 py-2 text-slate-700">
                      <span className="mr-2 text-xs text-slate-400">D{d.orden}</span>
                      {d.nombre}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{fmt(d.previa)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(d.actual)}</td>
                    <td className="px-5 py-2 text-right">
                      <DeltaTag delta={d.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Escala de referencia */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Escala de niveles de madurez</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(NIVEL_MADUREZ) as Array<keyof typeof NIVEL_MADUREZ>).map((k) => {
              const n = NIVEL_MADUREZ[k];
              return (
                <div key={k} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: n.color }} />
                    <span className="text-sm font-semibold text-slate-700">{n.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {fmt(n.min)}–{fmt(n.max)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{n.estado}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DeltaTag({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-slate-400">—</span>;
  const color = delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400";
  const signo = delta > 0 ? "+" : "";
  return <span className={`text-xs font-semibold ${color}`}>{signo}{delta.toFixed(2)}</span>;
}
