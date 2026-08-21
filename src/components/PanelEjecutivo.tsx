import { NIVEL_MADUREZ } from "@/lib/constants";
import type { PanelEjecutivo as Datos, EstadoDominio, FilaPanel } from "@/lib/data/panel";

// Vista de gerencia. Tres bloques, en el orden en que se leen:
//
//   1. Un titular. Uno solo — tres números compitiendo obligan a elegir, y quien elige
//      se queda con el más halagador.
//   2. El semáforo por dominio, coloreado por completitud del levantamiento y no por
//      avance: un dominio contestado por una sola persona de cinco no está verde.
//   3. Lo que requiere una decisión, con nombre y apellido. Un informe a gerencia que no
//      termina en peticiones concretas no sirve para nada.
//
// La madurez aparece solo donde el levantamiento está completo. Publicarla antes es
// mostrar un número que se va a mover, y cuando se mueva el informe pierde autoridad.

const ESTADO: Record<
  EstadoDominio,
  { label: string; barra: string; texto: string; fondo: string }
> = {
  COMPLETO: {
    label: "Completo",
    barra: "bg-green-500",
    texto: "text-green-700",
    fondo: "bg-green-50",
  },
  EN_CURSO: {
    label: "En curso",
    barra: "bg-blue-500",
    texto: "text-blue-700",
    fondo: "bg-blue-50",
  },
  CERRADO_INCOMPLETO: {
    label: "Cerrado sin todos",
    barra: "bg-orange-500",
    texto: "text-orange-700",
    fondo: "bg-orange-50",
  },
  SIN_INICIAR: {
    label: "Sin iniciar",
    barra: "bg-slate-300",
    texto: "text-slate-500",
    fondo: "bg-slate-100",
  },
};

function fecha(f: Date | null): string {
  if (!f) return "sin definir";
  return new Date(f).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/** La frase del titular cambia según qué es lo que de verdad está frenando. */
function veredicto(d: Datos): string {
  if (d.dominiosCompletos === d.dominiosTotal) {
    return "El levantamiento está completo. El resultado del diagnóstico ya puede calcularse.";
  }
  const faltan = d.dominiosTotal - d.dominiosCompletos;
  const base = `${faltan === 1 ? "Queda 1 dominio" : `Quedan ${faltan} dominios`} esperando la opinión de al menos una persona.`;
  if (d.personasSinIngresar > 0) {
    return `${base} ${
      d.personasSinIngresar === 1
        ? "Una de esas personas todavía no ha entrado a la plataforma."
        : `${d.personasSinIngresar} de esas personas todavía no han entrado a la plataforma.`
    }`;
  }
  return base;
}

export function PanelEjecutivo({ datos }: { datos: Datos }) {
  const altas = datos.peticiones.filter((p) => p.severidad === "alta").length;

  return (
    <div className="space-y-6">
      {/* ───────────────── 1 · Titular ───────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {datos.empresa} · {datos.diagnostico}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums text-slate-900">
                {datos.dominiosCompletos}
              </span>
              <span className="text-xl text-slate-400">de {datos.dominiosTotal}</span>
              <span className="text-base text-slate-600">
                dominios con el levantamiento completo
              </span>
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {veredicto(datos)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Inicio: {fecha(datos.fechaInicio)}</p>
            <p className={datos.fechaCierre ? "" : "font-medium text-orange-600"}>
              Cierre: {fecha(datos.fechaCierre)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-4">
          <Dato
            valor={`${datos.personasTotal - datos.personasSinIngresar}/${datos.personasTotal}`}
            label="Personas que ya entraron"
            alerta={datos.personasSinIngresar > 0}
          />
          <Dato
            valor={datos.documentos}
            label="Documentos recibidos"
            nota={
              datos.documentosSinRevisar > 0
                ? `${datos.documentosSinRevisar} pendientes de revisión nuestra`
                : undefined
            }
          />
          <Dato
            valor={datos.evidenciaFaltante}
            label="Documentos por recibir"
            nota="afirman un control sin respaldo"
            alerta={datos.evidenciaFaltante > 0}
          />
          <Dato
            valor={altas}
            label="Requieren su decisión"
            alerta={altas > 0}
          />
        </div>
      </div>

      {/* ───────────────── 2 · Semáforo por dominio ───────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Estado por dominio
          </p>
          <p className="text-xs text-slate-400">
            El color mide si el levantamiento está completo, no cuánto se avanzó.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 pl-3 font-medium">Dominio</th>
                <th className="pb-2 pr-3 text-right font-medium">Personas</th>
                <th className="pb-2 pr-3 text-right font-medium">Preguntas</th>
                <th className="pb-2 pr-3 text-right font-medium">Documentos</th>
                <th className="pb-2 pr-3 text-right font-medium">Madurez</th>
                <th className="pb-2 pr-3 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map((f) => (
                <Fila key={f.orden} f={f} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <p>
            <strong>Personas</strong>: cuántos de los responsables del dominio registraron
            todas sus respuestas. <strong>Preguntas</strong>: cuántas quedaron completas, con
            su comentario y su respaldo.
          </p>
          <p>
            <strong>Madurez</strong> se publica solo donde el levantamiento está completo. En
            el resto sería un número provisorio, y de él dependen después las brechas y el
            plan de acción.
          </p>
        </div>
      </div>

      {/* ───────────────── 3 · Lo que requiere decisión ───────────────── */}
      {datos.peticiones.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Requiere una decisión
          </p>
          <ul className="mt-3 space-y-3">
            {datos.peticiones.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    p.severidad === "alta" ? "bg-red-500" : "bg-orange-400"
                  }`}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {p.severidad === "alta" && (
                      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                        Urgente
                      </span>
                    )}
                    {p.titulo}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{p.detalle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Fila({ f }: { f: FilaPanel }) {
  const e = ESTADO[f.estado];
  const nivel = f.nivel ? NIVEL_MADUREZ[f.nivel] : null;

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2.5 pl-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-8 w-1 shrink-0 rounded-full ${e.barra}`} aria-hidden />
          <span>
            <span className="text-xs tabular-nums text-slate-400">{f.orden}.</span>{" "}
            <span className="text-slate-800">{f.nombre}</span>
          </span>
        </div>
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        <span
          className={
            f.personasCompletas < f.personas ? "font-medium text-orange-600" : "text-slate-600"
          }
        >
          {f.personasCompletas}/{f.personas}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">
        {f.preguntasCompletas}/{f.preguntas}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        <span className="text-slate-600">{f.documentos}</span>
        {f.evidenciaFaltante > 0 && (
          <span className="ml-1.5 text-xs font-medium text-red-600">
            faltan {f.evidenciaFaltante}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right">
        {f.madurez != null && nivel ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tabular-nums font-medium text-slate-800">
              {f.madurez.toFixed(1)}
            </span>
            <span className="text-xs" style={{ color: nivel.color }}>
              {nivel.label}
            </span>
          </span>
        ) : (
          <span className="text-xs text-slate-400" title="Aún no concluyente: falta gente por responder">
            —
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${e.fondo} ${e.texto}`}
        >
          {e.label}
        </span>
      </td>
    </tr>
  );
}

function Dato({
  valor,
  label,
  nota,
  alerta,
}: {
  valor: string | number;
  label: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-2xl font-bold tabular-nums ${alerta ? "text-orange-600" : "text-slate-900"}`}
      >
        {valor}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {nota && <p className="mt-0.5 text-[11px] text-slate-400">{nota}</p>}
    </div>
  );
}
