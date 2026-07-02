"use client";

import { useState, useTransition } from "react";
import { guardarRespuesta } from "./actions";
import { VALORES, ESCALA, requiereComentario, type Valor } from "@/lib/constants";
import { Badge, Button, Textarea, Input, Label } from "@/components/ui";
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
};

const LABEL_CORTO: Record<Valor, string> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", N_A: "N/A", OTRO: "Otro",
};

export function PreguntaItem({ respuesta, pregunta, evidencias, puedeValidar }: Props) {
  const [valor, setValor] = useState<string | null>(respuesta.valor);
  const [comentario, setComentario] = useState(respuesta.comentario ?? "");
  const [riesgo, setRiesgo] = useState(respuesta.riesgoIdentificado ?? "");
  const [estado, setEstado] = useState(respuesta.estado);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const comentarioRequerido = requiereComentario(valor);
  const dirty =
    valor !== respuesta.valor ||
    comentario !== (respuesta.comentario ?? "") ||
    riesgo !== (respuesta.riesgoIdentificado ?? "");

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await guardarRespuesta({
        respuestaId: respuesta.id,
        valor: (valor ?? "0") as Valor,
        comentario,
        riesgoIdentificado: riesgo,
      });
      if (res.ok) {
        setEstado("RESPONDIDA");
        setMsg({ ok: true, text: "Guardado" });
      } else {
        setMsg({ ok: false, text: res.error ?? "Error" });
      }
    });
  }

  return (
    <div className="border-b border-slate-100 px-5 py-5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
          {pregunta.orden}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-800">{pregunta.texto}</p>
            {estado === "RESPONDIDA" && valor != null ? (
              <Badge color="green">Respondida</Badge>
            ) : estado === "VALIDADA" ? (
              <Badge color="blue">Validada</Badge>
            ) : (
              <Badge color="slate">Pendiente</Badge>
            )}
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
                className={cn(
                  "h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition-colors",
                  valor === v
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-brand-600 hover:text-brand-600"
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
              placeholder={comentarioRequerido ? "Obligatorio: describe la situación actual" : "Opcional"}
            />
          </div>

          {/* Riesgo */}
          <div className="mt-3">
            <Label htmlFor={`r-${respuesta.id}`}>Riesgo identificado</Label>
            <Input
              id={`r-${respuesta.id}`}
              value={riesgo}
              onChange={(e) => setRiesgo(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={onSave} disabled={pending || !dirty || valor == null}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            {msg && (
              <span className={cn("text-xs", msg.ok ? "text-green-600" : "text-red-600")}>
                {msg.text}
              </span>
            )}
          </div>

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
