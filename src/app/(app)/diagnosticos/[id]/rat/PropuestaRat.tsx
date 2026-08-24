"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { CAMPOS_RAT } from "@/lib/rat";
import type { ActividadPropuesta } from "@/lib/engines/extraccion-rat";
import { proponerDesdeElLevantamiento, aceptarPropuesta } from "./actions";

/**
 * Revisión de lo que el análisis propuso.
 *
 * Nada entra al registro sin pasar por aquí. Cada campo se muestra junto a la frase del
 * material de donde salió, porque la única forma de revisar una propuesta automática es
 * poder contrastarla con la fuente sin salir de la pantalla.
 */
export function PropuestaRat({
  diagnosticoId,
  empresaId,
}: {
  diagnosticoId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [propuestas, setPropuestas] = useState<ActividadPropuesta[] | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [fuentes, setFuentes] = useState<{ documentos: number; comentarios: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function analizar() {
    setMsg(null);
    setPropuestas(null);
    startTransition(async () => {
      const res = await proponerDesdeElLevantamiento(diagnosticoId);
      if (!res.ok) {
        setMsg({ ok: false, texto: res.error ?? "No se pudo analizar." });
        return;
      }
      setPropuestas(res.actividades ?? []);
      setFuentes(res.fuentes ?? null);
      setElegidas(new Set((res.actividades ?? []).map((_, i) => i)));
    });
  }

  function aceptar() {
    if (!propuestas) return;
    setMsg(null);
    const seleccion = propuestas.filter((_, i) => elegidas.has(i));
    startTransition(async () => {
      const res = await aceptarPropuesta({ empresaId, actividades: seleccion });
      if (res.ok) {
        setMsg({
          ok: true,
          texto: `${res.creados} ${res.creados === 1 ? "actividad agregada" : "actividades agregadas"} al registro, como borrador.`,
        });
        setPropuestas(null);
        router.refresh();
      } else setMsg({ ok: false, texto: res.error ?? "No se pudo agregar." });
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Proponer actividades desde lo que entregó el cliente
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Lee <strong>todo el levantamiento</strong> —los comentarios de los diez dominios
            y los documentos cargados— y propone las actividades de tratamiento que se
            desprenden. Cruza dominios: la base legal suele estar en el 3, las medidas de
            seguridad en el 5, los encargados en el 7 y los plazos en el 9. <strong>Nada entra al registro sin que lo revises</strong>: cada campo
            viene con la frase de donde salió.
          </p>
        </div>
        <Button onClick={analizar} disabled={pending}>
          {pending && !propuestas ? "Analizando…" : "Analizar y proponer"}
        </Button>
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.texto}</p>
      )}

      {propuestas && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {propuestas.length}{" "}
              {propuestas.length === 1 ? "actividad propuesta" : "actividades propuestas"}
              {fuentes && (
                <span className="text-slate-400">
                  {" "}
                  · leyó {fuentes.comentarios} respuestas
                  {fuentes.documentos > 0 && ` y ${fuentes.documentos} documentos`}
                </span>
              )}
            </p>
            <Button onClick={aceptar} disabled={pending || elegidas.size === 0}>
              {pending ? "Agregando…" : `Agregar ${elegidas.size} al registro`}
            </Button>
          </div>

          <ul className="mt-3 space-y-3">
            {propuestas.map((a, i) => (
              <li
                key={i}
                className={`rounded-lg border p-3 ${
                  elegidas.has(i) ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={elegidas.has(i)}
                    onChange={() =>
                      setElegidas((prev) => {
                        const s = new Set(prev);
                        if (s.has(i)) s.delete(i);
                        else s.add(i);
                        return s;
                      })
                    }
                    disabled={pending}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{a.nombre}</span>
                      {a.area && <span className="text-xs text-slate-500">{a.area}</span>}
                      {a.datosSensibles && <Badge color="orange">Datos sensibles</Badge>}
                      {a.transferenciaInternacional && (
                        <Badge color="blue">Sale del país</Badge>
                      )}
                    </span>

                    <dl className="mt-2 space-y-1.5">
                      {CAMPOS_RAT.filter((c) => c.clave !== "nombre").map((c) => {
                        const campo = a[c.clave as keyof ActividadPropuesta];
                        if (!campo || typeof campo !== "object" || !("valor" in campo)) return null;
                        return (
                          <div key={c.clave} className="text-sm">
                            <dt className="inline font-medium text-slate-600">{c.etiqueta}: </dt>
                            <dd className="inline text-slate-800">{campo.valor}</dd>
                            <p className="mt-0.5 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">
                              “{campo.cita}”
                            </p>
                          </div>
                        );
                      })}
                    </dl>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-slate-500">
            Lo que agregues entra como <strong>borrador</strong>. Los campos que el análisis no
            pudo sustentar quedan vacíos a propósito, y hay que completarlos con el cliente
            antes de dar el registro por vigente.
          </p>
        </div>
      )}
    </div>
  );
}
