import { requireAccesoSecciones } from "@/lib/session";
import { ESCALA, type Valor } from "@/lib/constants";
import {
  getDiagnosticoFull,
  getRespuestasPorDominio,
  getRiesgos,
  getAcciones,
  getTrazabilidad,
} from "@/lib/data/diagnosticos";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { CriticidadBadge, NivelRiesgoBadge, EstadoAccionBadge, PrioridadBadge } from "@/components/badges";
import { PrintButton } from "../reporte/PrintButton";

function valorLabel(v: string | null): string {
  if (v == null) return "—";
  return `${v === "N_A" ? "N/A" : v === "OTRO" ? "Otro" : v} · ${ESCALA[v as Valor]?.estado ?? ""}`;
}

export default async function ReporteTecnicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);
  const diag = await getDiagnosticoFull(id, session); // valida acceso
  const [dominios, riesgos, acciones, traza] = await Promise.all([
    getRespuestasPorDominio(id),
    getRiesgos(id),
    getAcciones(id),
    getTrazabilidad(id),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="print:hidden">
        <DiagnosticoNav id={id} active="reporte-tecnico" />
        <div className="mb-4 flex justify-end">
          <PrintButton />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Reporte Técnico · Procesos360 LPDP
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{diag.empresa.razonSocial}</h1>
          <p className="text-sm text-slate-500">{diag.nombre} · Ley N° 21.719</p>
        </div>

        {/* Respuestas por dominio */}
        <Section title="1. Respuestas por dominio">
          <div className="space-y-6">
            {dominios.map((dd) => (
              <div key={dd.id}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  D{dd.dominio.orden} · {dd.dominio.nombre}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {dd.area ? `Área: ${dd.area.nombre}` : "Sin área"}
                    {dd.participantes.length > 0
                      ? ` · Participantes: ${dd.participantes.map((p) => p.user.nombre).join(", ")}`
                      : ""}
                  </span>
                </h3>
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 text-left text-slate-400">
                    <tr>
                      <th className="py-1.5 font-medium">#</th>
                      <th className="py-1.5 font-medium">Pregunta</th>
                      <th className="py-1.5 font-medium">Valor</th>
                      <th className="py-1.5 font-medium">Comentario</th>
                      <th className="py-1.5 font-medium">Obs. consultor</th>
                      <th className="py-1.5 font-medium">Ev.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dd.respuestas.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="py-1.5 pr-2 text-slate-400">{r.pregunta.orden}</td>
                        <td className="py-1.5 pr-2 text-slate-700">{r.pregunta.texto}</td>
                        <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">{valorLabel(r.valor)}</td>
                        <td className="py-1.5 pr-2 text-slate-500">{r.comentario ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-slate-500">{r.observacionConsultor ?? "—"}</td>
                        <td className="py-1.5 text-slate-500">{r.evidencias.length || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Section>

        {/* Riesgos */}
        <Section title={`2. Riesgos (${riesgos.length})`}>
          <ul className="space-y-2 text-sm">
            {riesgos.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3">
                <span className="text-slate-700">{r.descripcion}</span>
                <NivelRiesgoBadge nivel={r.nivel} />
              </li>
            ))}
            {riesgos.length === 0 && <li className="text-slate-400">Sin riesgos generados.</li>}
          </ul>
        </Section>

        {/* Plan */}
        <Section title={`3. Plan de tratamiento (${acciones.length})`}>
          <ul className="space-y-2 text-sm">
            {acciones.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <span className="text-slate-700">{a.descripcion}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <PrioridadBadge prioridad={a.prioridad} />
                  <EstadoAccionBadge estado={a.estado} />
                </span>
              </li>
            ))}
            {acciones.length === 0 && <li className="text-slate-400">Sin plan generado.</li>}
          </ul>
        </Section>

        {/* Matriz de trazabilidad */}
        <Section title="4. Matriz de trazabilidad">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-100 text-left text-slate-400">
              <tr>
                <th className="py-1.5 font-medium">Brecha</th>
                <th className="py-1.5 font-medium">Dominio</th>
                <th className="py-1.5 font-medium">Pregunta origen</th>
                <th className="py-1.5 font-medium">Criticidad</th>
                <th className="py-1.5 font-medium">Riesgo</th>
                <th className="py-1.5 font-medium">Acciones</th>
                <th className="py-1.5 font-medium">Evidencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {traza.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-1.5 pr-2 font-mono text-slate-400">{b.codigo}</td>
                  <td className="py-1.5 pr-2 text-slate-600">
                    {b.respuesta?.diagnosticoDominio.dominio
                      ? `D${b.respuesta.diagnosticoDominio.dominio.orden}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-600">{b.respuesta?.pregunta.texto ?? "—"}</td>
                  <td className="py-1.5 pr-2"><CriticidadBadge criticidad={b.criticidad} /></td>
                  <td className="py-1.5 pr-2">{b.riesgo ? <NivelRiesgoBadge nivel={b.riesgo.nivel} /> : "—"}</td>
                  <td className="py-1.5 pr-2 text-slate-600">
                    {b.acciones.length ? `${b.acciones.filter((a) => a.estado === "CERRADA").length}/${b.acciones.length} cerradas` : "—"}
                  </td>
                  <td className="py-1.5 text-slate-600">{b.respuesta?.evidencias.length || "—"}</td>
                </tr>
              ))}
              {traza.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-slate-400">Sin brechas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {children}
    </section>
  );
}
