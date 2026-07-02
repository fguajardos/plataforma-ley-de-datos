import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NIVEL_MADUREZ, TIPO_DIAGNOSTICO, ESTADO_DIAGNOSTICO } from "@/lib/constants";
import { fmt } from "@/lib/utils";
import { getDiagnosticoFull, madurezDeDiagnostico } from "@/lib/data/diagnosticos";
import { RadarChart } from "@/components/RadarChart";
import { NivelBadge, CriticidadBadge } from "@/components/badges";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { PrintButton } from "./PrintButton";

export default async function ReportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session);
  const madurez = madurezDeDiagnostico(diag);

  const brechas = await prisma.brecha.findMany({
    where: { diagnosticoId: id },
    include: {
      respuesta: {
        select: { diagnosticoDominio: { select: { dominio: { select: { orden: true, nombre: true } } } } },
      },
    },
  });
  const criticas = brechas.filter((b) => b.criticidad === "CRITICA" || b.criticidad === "ALTA");
  const radarData = madurez.dominios.map((d) => ({ label: d.nombre, value: d.promedio }));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden">
        <DiagnosticoNav id={id} active="reporte" />
      </div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/diagnosticos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← Volver
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:shadow-none">
        {/* Encabezado */}
        <div className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Reporte Ejecutivo · Procesos360 LPDP
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{diag.empresa.razonSocial}</h1>
            <p className="text-sm text-slate-500">
              {diag.nombre} · {TIPO_DIAGNOSTICO[diag.tipo as keyof typeof TIPO_DIAGNOSTICO] ?? diag.tipo}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Estado: {ESTADO_DIAGNOSTICO[diag.estado as keyof typeof ESTADO_DIAGNOSTICO] ?? diag.estado} · Ley N° 21.719
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Madurez global</p>
            <p
              className="text-4xl font-bold"
              style={{ color: madurez.nivelGlobal ? NIVEL_MADUREZ[madurez.nivelGlobal].color : "#94a3b8" }}
            >
              {fmt(madurez.global)}
            </p>
            <NivelBadge nivel={madurez.nivelGlobal} />
          </div>
        </div>

        {/* Radar + resumen */}
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Madurez por dominio</h2>
            <RadarChart data={radarData} size={360} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Indicadores clave</h2>
            <ul className="space-y-2 text-sm">
              <Indicador label="Brechas totales" valor={brechas.length} />
              <Indicador label="Brechas críticas" valor={brechas.filter((b) => b.criticidad === "CRITICA").length} />
              <Indicador label="Brechas altas" valor={brechas.filter((b) => b.criticidad === "ALTA").length} />
              <Indicador label="Dominios evaluados" valor={madurez.dominios.filter((d) => d.promedio != null).length} />
              <Indicador label="Dominios críticos" valor={madurez.criticos.length} />
            </ul>

            <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Dominios críticos</h2>
            <ul className="space-y-1 text-sm">
              {madurez.criticos.slice(0, 5).map((d) => (
                <li key={d.dominioId} className="flex justify-between">
                  <span className="text-slate-600">D{d.orden} · {d.nombre}</span>
                  <span className="font-semibold">{fmt(d.promedio)}</span>
                </li>
              ))}
              {madurez.criticos.length === 0 && <li className="text-slate-400">Sin dominios críticos.</li>}
            </ul>
          </div>
        </div>

        {/* Brechas prioritarias */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Brechas prioritarias ({criticas.length})
          </h2>
          {criticas.length === 0 ? (
            <p className="text-sm text-slate-400">No hay brechas críticas o altas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {criticas.slice(0, 12).map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400">{b.codigo}</span>{" "}
                    <span className="text-slate-700">{b.descripcion}</span>
                  </div>
                  <CriticidadBadge criticidad={b.criticidad} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          Documento generado por la plataforma Procesos360 LPDP. La clasificación de madurez sigue la
          escala 0–5 del diagnóstico (Crítico, Bajo, Medio, Alto, Avanzado).
        </p>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-900">{valor}</span>
    </li>
  );
}
