"use client";

// Tutorial inicial tipo spotlight: oscurece la pantalla y recorta un hueco sobre el
// elemento real que se está explicando, con un globo al lado. Los pasos cuyo elemento
// no existe en la pantalla actual (por rol o por viewport) se descartan al iniciar.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PasoTour } from "@/lib/tour";
import { marcarTourVistoAction } from "@/app/(app)/actions";

type Recuadro = { top: number; left: number; width: number; height: number };

const PADDING = 8; // aire alrededor del elemento resaltado
const GLOBO_ANCHO = 340;
const MARGEN = 16;

function medir(target: string | null): Recuadro | null {
  if (!target) return null;
  const el = document.querySelector(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

/** Posición del globo: a la derecha del hueco si cabe, si no debajo, si no centrado. */
function posicionGlobo(hueco: Recuadro | null) {
  if (!hueco) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    } as const;
  }
  const { innerWidth: vw, innerHeight: vh } = window;

  const cabeDerecha = hueco.left + hueco.width + MARGEN + GLOBO_ANCHO < vw;
  if (cabeDerecha) {
    return {
      top: `${Math.min(Math.max(hueco.top, MARGEN), Math.max(vh - 260, MARGEN))}px`,
      left: `${hueco.left + hueco.width + MARGEN}px`,
    };
  }

  const cabeAbajo = hueco.top + hueco.height + MARGEN + 220 < vh;
  const left = Math.min(Math.max(hueco.left, MARGEN), Math.max(vw - GLOBO_ANCHO - MARGEN, MARGEN));
  if (cabeAbajo) {
    return { top: `${hueco.top + hueco.height + MARGEN}px`, left: `${left}px` };
  }

  return { top: `${Math.max(hueco.top - 220 - MARGEN, MARGEN)}px`, left: `${left}px` };
}

export function Tour({ pasos, activo }: { pasos: PasoTour[]; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [visibles, setVisibles] = useState<PasoTour[]>([]);
  const [i, setI] = useState(0);
  const [hueco, setHueco] = useState<Recuadro | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const iniciar = useCallback(() => {
    // Descarta pasos cuyo elemento no está en pantalla (rol sin esa sección, etc.).
    setVisibles(pasos.filter((p) => p.target === null || document.querySelector(p.target)));
    setI(0);
    setAbierto(true);
  }, [pasos]);

  useEffect(() => {
    if (activo) {
      // Espera un frame a que el layout esté pintado antes de medir.
      const t = setTimeout(iniciar, 400);
      return () => clearTimeout(t);
    }
  }, [activo, iniciar]);

  // Permite relanzar el tour desde otro punto de la app.
  useEffect(() => {
    const abrir = () => iniciar();
    window.addEventListener("p360:abrir-tour", abrir);
    return () => window.removeEventListener("p360:abrir-tour", abrir);
  }, [iniciar]);

  const paso = visibles[i];

  useLayoutEffect(() => {
    if (!abierto || !paso) return;
    const actualizar = () => setHueco(medir(paso.target));
    actualizar();
    window.addEventListener("resize", actualizar);
    window.addEventListener("scroll", actualizar, true);
    return () => {
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("scroll", actualizar, true);
    };
  }, [abierto, paso]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    // No bloquea la UI: si falla, el peor caso es que el tour reaparezca.
    marcarTourVistoAction().catch(() => {});
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, visibles.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, cerrar, visibles.length]);

  if (!montado || !abierto || !paso) return null;

  const ultimo = i === visibles.length - 1;
  const globo = posicionGlobo(hueco);

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutorial inicial">
      {/* Velo con recorte: 4 rectángulos alrededor del hueco (deja el elemento visible y nítido) */}
      {hueco ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-slate-900/70" style={{ height: Math.max(hueco.top, 0) }} />
          <div
            className="absolute inset-x-0 bottom-0 bg-slate-900/70"
            style={{ top: hueco.top + hueco.height }}
          />
          <div
            className="absolute left-0 bg-slate-900/70"
            style={{ top: hueco.top, height: hueco.height, width: Math.max(hueco.left, 0) }}
          />
          <div
            className="absolute right-0 bg-slate-900/70"
            style={{ top: hueco.top, height: hueco.height, left: hueco.left + hueco.width }}
          />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-white/90 transition-all duration-200"
            style={{ top: hueco.top, left: hueco.left, width: hueco.width, height: hueco.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-slate-900/70" />
      )}

      {/* Globo */}
      <div
        className="absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-5 shadow-2xl transition-all duration-200"
        style={globo}
      >
        <p className="text-xs font-medium text-brand">
          Paso {i + 1} de {visibles.length}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{paso.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{paso.texto}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={cerrar}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Omitir
          </button>

          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Atrás
              </button>
            )}
            <button
              onClick={() => (ultimo ? cerrar() : setI(i + 1))}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {ultimo ? "Comenzar" : "Siguiente"}
            </button>
          </div>
        </div>

        {/* Puntos de progreso */}
        <div className="mt-3 flex justify-center gap-1.5">
          {visibles.map((_, n) => (
            <span
              key={n}
              className={
                "h-1.5 rounded-full transition-all " +
                (n === i ? "w-4 bg-brand-600" : "w-1.5 bg-slate-200")
              }
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
