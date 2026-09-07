"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VALORES, ESCALA, requiereComentario, type Valor } from "@/lib/constants";
import { Button, Textarea, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { corregirAporte } from "./actions";

// Corrección de lo que respondió un participante.
//
// Se abre desde su propio aporte, y no en un formulario aparte, para que quede claro qué
// se está tocando: la declaración de esa persona, no la respuesta oficial del dominio. Lo
// que se guarda queda firmado con quién lo corrigió, y eso se ve al lado del aporte.
//
// Sin guardado automático a propósito. El formulario de arriba lo tiene porque uno escribe
// lo suyo y no quiere perderlo; acá se está modificando lo que declaró otra persona, y eso
// merece un botón que se aprieta a conciencia.

const LABEL: Record<Valor, string> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", N_A: "N/A", OTRO: "Otro",
};

export function CorregirAporte({
  aporteId,
  autor,
  valorInicial,
  comentarioInicial,
  riesgoInicial,
  onListo,
}: {
  aporteId: string;
  autor: string;
  valorInicial: string | null;
  comentarioInicial: string | null;
  riesgoInicial: string | null;
  onListo: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState<string | null>(valorInicial);
  const [comentario, setComentario] = useState(comentarioInicial ?? "");
  const [riesgo, setRiesgo] = useState(riesgoInicial ?? "");
  const [error, setError] = useState<string | null>(null);

  const faltaComentario = requiereComentario(valor) && !comentario.trim();

  function guardar() {
    setError(null);
    if (!valor) return setError("Elige una nota.");
    if (faltaComentario) {
      return setError("Con esa nota el comentario es obligatorio.");
    }
    startTransition(async () => {
      const res = await corregirAporte({
        aporteId,
        valor: valor as Valor,
        comentario,
        riesgoIdentificado: riesgo,
      });
      if (res.ok) {
        router.refresh();
        onListo();
      } else setError(res.error ?? "No se pudo guardar.");
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
      <p className="text-xs text-slate-600">
        Estás corrigiendo la respuesta de <strong>{autor}</strong>. Va a quedar registrado
        que la corregiste tú, y el aporte sigue siendo de {autor.split(" ")[0]}.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {VALORES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValor(v)}
            disabled={pending}
            className={cn(
              "h-8 min-w-9 rounded-md border px-2 text-xs font-semibold",
              valor === v
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-brand-400"
            )}
            title={ESCALA[v as Valor]?.estado}
          >
            {LABEL[v as Valor]}
          </button>
        ))}
      </div>

      <div className="mt-2">
        <Label htmlFor={`cc-${aporteId}`}>
          Comentario {requiereComentario(valor) && <span className="text-red-600">*</span>}
        </Label>
        <Textarea
          id={`cc-${aporteId}`}
          rows={2}
          value={comentario}
          disabled={pending}
          onChange={(e) => setComentario(e.target.value)}
        />
      </div>

      <div className="mt-2">
        <Label htmlFor={`cr-${aporteId}`}>Riesgo identificado</Label>
        <Input
          id={`cr-${aporteId}`}
          value={riesgo}
          disabled={pending}
          placeholder="Opcional"
          onChange={(e) => setRiesgo(e.target.value)}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={guardar} disabled={pending}>
          {pending ? "Guardando…" : "Guardar corrección"}
        </Button>
        <button
          type="button"
          onClick={onListo}
          disabled={pending}
          className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
