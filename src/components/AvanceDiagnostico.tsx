import type { AvanceDiagnostico as Datos } from "@/lib/data/avance";

// Panel de avance del levantamiento. Se dibuja con barras HTML y no con un gráfico
// en SVG o JavaScript a propósito: el mismo diseño tiene que poder reproducirse en el
// correo de reporte, y los clientes de correo no ejecutan scripts.

/** Verde cuando el dominio está terminado, azul mientras avanza, gris si no ha partido. */
function colorBarra(porcentaje: number, cerrado: boolean): string {
  if (cerrado || porcentaje === 100) return "#16a34a";
  if (porcentaje === 0) return "#cbd5e1";
  return "#2563eb";
}

export function AvanceDiagnostico({ datos }: { datos: Datos }) {
  const sinIniciar = datos.dominios.filter((d) => d.porcentaje === 0).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      {/* ── Avance global ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Avance del levantamiento
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-slate-900">{datos.porcentaje}%</span>
            <span className="text-sm text-slate-500">
              {datos.completas} de {datos.total} preguntas completas
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Dato valor={`${datos.dominiosCerrados}/${datos.dominios.length}`} label="Dominios cerrados" />
          <Dato valor={datos.evidencias} label="Evidencias" />
          <Dato
            valor={`${datos.participantesActivos}/${datos.participantes}`}
            label="Activos en total"
            alerta={datos.participantesActivos < datos.participantes}
          />
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${datos.porcentaje}%` }}
        />
      </div>

      {/* ── Detalle por dominio ── */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Por dominio</p>
          {sinIniciar > 0 && (
            <p className="text-xs text-slate-400">
              {sinIniciar} {sinIniciar === 1 ? "dominio sin iniciar" : "dominios sin iniciar"}
            </p>
          )}
        </div>

        <ul className="space-y-2.5">
          {datos.dominios.map((d) => (
            <li key={d.orden} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
                  {d.orden}
                </span>
                <span className="truncate text-sm text-slate-700">{d.nombre}</span>
                {d.cerrado && (
                  <span className="shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                    Cerrado
                  </span>
                )}
              </div>
              {/* Dos lecturas distintas, y la segunda faltaba: un dominio puede marcar
                  5/5 porque una sola persona lo contestó entero. La barra mide cuánto se
                  respondió; el contador de personas, cuántas miradas hay detrás. */}
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {d.participantes > 0 && (
                  <span
                    className={
                      d.participantesActivos < d.participantes
                        ? "mr-2 font-medium text-orange-600"
                        : "mr-2 text-slate-400"
                    }
                    title={`${d.participantesActivos} de ${d.participantes} participantes han registrado su respuesta`}
                  >
                    {d.participantesActivos}/{d.participantes} pers.
                  </span>
                )}
                {d.completas}/{d.total}
              </span>
              <div className="col-span-2 ml-7 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(d.porcentaje, d.porcentaje > 0 ? 3 : 0)}%`,
                    backgroundColor: colorBarra(d.porcentaje, d.cerrado),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Dato({
  valor,
  label,
  alerta,
}: {
  valor: string | number;
  label: string;
  alerta?: boolean;
}) {
  return (
    <div className="text-right">
      <p className={`text-xl font-bold tabular-nums ${alerta ? "text-orange-600" : "text-slate-900"}`}>
        {valor}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
