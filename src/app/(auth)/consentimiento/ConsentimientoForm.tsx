"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { aceptarConsentimientoAction, type ConsentimientoState } from "./actions";
import { DECLARACION } from "@/lib/consentimiento";

const initial: ConsentimientoState = {};

export function ConsentimientoForm() {
  const [state, action, pending] = useActionState(aceptarConsentimientoAction, initial);
  const [marcado, setMarcado] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4">
        <input
          type="checkbox"
          name="acepto"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-brand-600 focus:ring-brand-600/40"
        />
        <span className="text-sm leading-relaxed text-slate-700">{DECLARACION}</span>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <Button type="submit" disabled={!marcado || pending} className="w-full">
        {pending ? "Registrando…" : "Acepto y continúo"}
      </Button>
    </form>
  );
}
