"use client";

// Cierre del cuestionario del dominio. Las respuestas se guardan solas mientras el
// usuario responde; este botón solo ENVÍA el dominio al consultor, exigiendo las reglas
// del §7.5 (todo respondido, comentarios obligatorios, evidencias obligatorias).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { enviarDominio, type Faltante } from "./actions";

export function EnviarDominio({
  diagnosticoDominioId,
  totalPreguntas,
  respondidas,
  enviado,
}: {
  diagnosticoDominioId: string;
  totalPreguntas: number;
  respondidas: number;
  enviado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [faltantes, setFaltantes] = useState<Faltante[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (enviado) {
    return (
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-900">Dominio enviado a validación</p>
        <p className="mt-1 text-sm text-blue-800">
          El consultor está revisando tus respuestas. Quedan en solo lectura hasta que las
          valide; si observa alguna, podrás corregir esa pregunta.
        </p>
      </div>
    );
  }

  function onEnviar() {
    setError(null);
    setFaltantes(null);
    startTransition(async () => {
      const res = await enviarDominio(diagnosticoDominioId);
      if (res.ok) {
        router.refresh();
      } else if (res.faltantes) {
        setFaltantes(res.faltantes);
      } else {
        setError(res.error ?? "No se pudo enviar.");
      }
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            ¿Terminaste de responder este dominio?
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Tus respuestas se guardan automáticamente. Al enviar, el dominio pasa al
            consultor y queda en solo lectura.
          </p>
        </div>
        <Button onClick={onEnviar} disabled={pending}>
          {pending ? "Enviando…" : "Enviar respuestas a validación"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {respondidas} de {totalPreguntas} preguntas completas.
      </p>

      {faltantes && faltantes.length > 0 && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-900">
            Falta completar {faltantes.length}{" "}
            {faltantes.length === 1 ? "pregunta" : "preguntas"} antes de enviar:
          </p>
          <ul className="mt-2 space-y-1">
            {faltantes.map((f) => (
              <li key={f.orden} className="text-sm text-orange-800">
                <a
                  href={`#pregunta-${f.orden}`}
                  className="font-semibold underline underline-offset-2 hover:text-orange-900"
                >
                  Pregunta {f.orden}
                </a>{" "}
                — {f.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
