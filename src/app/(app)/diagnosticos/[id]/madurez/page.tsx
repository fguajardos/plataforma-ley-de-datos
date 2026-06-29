import Link from "next/link";
import { requireSession } from "@/lib/session";
import { NIVEL_MADUREZ } from "@/lib/constants";
import { fmt } from "@/lib/utils";
import { getDiagnosticoFull, madurezDeDiagnostico } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { NivelBadge } from "@/components/badges";
import { RadarChart } from "@/components/RadarChart";

export default async function MadurezPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session);
  const madurez = madurezDeDiagnostico(diag);

  const radarData = madurez.dominios.map((d) => ({ label: d.nombre, value: d.promedio }));

  return (
    <>
      <div className="mb-2">
        <Link href={`/diagnosticos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← {diag.nombre}
        </Link>
      </div>
      <PageHeader
        title="Motor de Madurez"
        subtitle="Nivel de cumplimiento por dominio y global"
      />

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
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                      {fmt(d.promedio)}
                    </td>
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
