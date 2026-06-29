"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarBrechasAction } from "./actions";
import { Button } from "@/components/ui";

export function GenerarBrechasButton({ diagnosticoId }: { diagnosticoId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await generarBrechasAction(diagnosticoId);
      if (res.ok) {
        setMsg(`${res.count} brecha(s) generada(s).`);
        router.refresh();
      } else {
        setMsg(res.error ?? "Error");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={pending}>
        {pending ? "Generando…" : "Generar / actualizar brechas"}
      </Button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
