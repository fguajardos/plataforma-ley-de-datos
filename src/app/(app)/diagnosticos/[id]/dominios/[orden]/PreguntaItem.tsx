"use client";

import { useEffect, useRef, useState } from "react";
import { guardarRespuesta } from "./actions";
import { VALORES, ESCALA, requiereComentario, type Valor } from "@/lib/constants";
import { Badge, Textarea, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EvidenciasPregunta, type EvidenciaVM } from "./EvidenciasPregunta";

type Props = {
  respuesta: {
    id: string;
    valor: string | null;
    comentario: string | null;
    riesgoIdentificado: string | null;
    estado: string;
  };
  pregunta: { orden: number; texto: string; descripcion: string; evidenciaObligatoria: boolean };
  evidencias?: EvidenciaVM[];
  puedeValidar?: boolean;
  /** Dominio ya enviado a validación: solo lectura, salvo que el consultor la haya observado. */
  bloqueado?: boolean;
};

const LABEL_CORTO: Record<Valor, string> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", N_A: "N/A", OTRO: "Otro",
};

/** Espera a que el usuario deje de escribir antes de guardar. */
const RETARDO_GUARDADO = 800;

export function PreguntaItem({
  respuesta,
  pregunta,
  evidencias,
  puedeValidar,
  bloqueado,
}: Props) {
  const [valor, setValor] = useState<string | null>(respuesta.valor);
  const [comentario, setComentario] = useState(respuesta.comentario ?? "");
  const [riesgo, setRiesgo] = useState(respuesta.riesgoIdentificado ?? "");
  const [estado, setEstado] = useState(respuesta.estado);
  const [guardado, setGuardado] = useState<"limpio" | "guardando" | "ok" | "error">("limpio");
  const [error, setError] = useState<string | null>(null);

  const comentarioRequerido = requiereComentario(valor);
  // Solo lectura si el dominio ya se envió, salvo que el consultor haya observado ESTA pregunta.
  const soloLectura = Boolean(bloqueado) && estado !== "OBSERVADA";

  // Guardado automático: se dispara cuando el usuario deja de editar. Acepta respuestas
  // incompletas (quedan como borrador) para no perder nunca lo avanzado; la exigencia de
  // completitud se aplica al enviar el dominio.
  const primeraCarga = useRef(true);
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    if (soloLectura || valor == null) return;

    setGuardado("guardando");
    const t = setTimeout(async () => {
      const res = await guardarRespuesta({
        respuestaId: respuesta.id,
        valor: valor as Valor,
        comentario,
        riesgoIdentificado: riesgo,
      });
      if (res.ok) {
        setEstado(!requiereComentario(valor) || comentario.trim() ? "RESPONDIDA" : "PENDIENTE");
        setGuardado("ok");
        setError(null);
      } else {
        setGuardado("error");
        setError(res.error ?? "No se pudo guardar");
      }
    }, RETARDO_GUARDADO);
    return () => clearTimeout(t);
  }, [valor, comentario, riesgo, respuesta.id, soloLectura]);

  return (
    <div className="border-b border-slate-100 px-5 py-5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
          {pregunta.orden}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-800">{pregunta.texto}</p>
            <span className="flex shrink-0 items-center gap-2">
              {guardado === "guardando" && (
                <span className="text-xs text-slate-400">Guardando…</span>
              )}
              {guardado === "ok" && <span className="text-xs text-green-600">Guardado</span>}
              {estado === "OBSERVADA" ? (
                <Badge color="orange">Observada</Badge>
              ) : estado === "VALIDADA" ? (
                <Badge color="blue">Validada</Badge>
              ) : estado === "RESPONDIDA" && valor != null ? (
                <Badge color="green">Respondida</Badge>
              ) : (
                <Badge color="slate">Pendiente</Badge>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{pregunta.descripcion}</p>
          {pregunta.evidenciaObligatoria && (
            <p className="mt-1 text-xs font-medium text-orange-600">Requiere evidencia documental</p>
          )}

          {/* Escala */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {VALORES.map((v) => (
              <button
                key={v}
                type="button"
                title={`${ESCALA[v].estado}: ${ESCALA[v].descripcion}`}
                onClick={() => setValor(v)}
                disabled={soloLectura}
                className={cn(
                  "h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition-colors",
                  valor === v
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-brand-600 hover:text-brand-600",
                  soloLectura && "cursor-not-allowed opacity-60 hover:border-slate-300 hover:text-slate-600"
                )}
              >
                {LABEL_CORTO[v]}
              </button>
            ))}
          </div>
          {valor != null && (
            <p className="mt-1.5 text-xs text-slate-400">
              {ESCALA[valor as Valor].estado} — {ESCALA[valor as Valor].descripcion}
            </p>
          )}

          {/* Comentario */}
          <div className="mt-3">
            <Label htmlFor={`c-${respuesta.id}`}>
              Comentario {comentarioRequerido && <span className="text-red-600">*</span>}
            </Label>
            <Textarea
              id={`c-${respuesta.id}`}
              rows={2}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              disabled={soloLectura}
              placeholder={comentarioRequerido ? "Obligatorio: describe la situación actual" : "Opcional"}
            />
            {comentarioRequerido && !comentario.trim() && !soloLectura && (
              <p className="mt-1 text-xs text-orange-600">
                Con esta respuesta el comentario es obligatorio para poder enviar el dominio.
              </p>
            )}
          </div>

          {/* Riesgo */}
          <div className="mt-3">
            <Label htmlFor={`r-${respuesta.id}`}>Riesgo identificado</Label>
            <Input
              id={`r-${respuesta.id}`}
              value={riesgo}
              onChange={(e) => setRiesgo(e.target.value)}
              disabled={soloLectura}
              placeholder="Opcional"
            />
          </div>

          {guardado === "error" && error && (
            <p className="mt-3 text-xs text-red-600">{error}</p>
          )}

          <EvidenciasPregunta
            respuestaId={respuesta.id}
            evidencias={evidencias ?? []}
            puedeValidar={!!puedeValidar}
          />
        </div>
      </div>
    </div>
  );
}
