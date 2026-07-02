"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { generarRiesgosAction } from "./actions";

export function GenerarRiesgosButton({ diagnosticoId }: { diagnosticoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await generarRiesgosAction(diagnosticoId);
      if (res.ok) {
        setMsg(`${res.count} riesgos generados`);
        router.refresh();
      } else {
        setMsg(res.error ?? "Error");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button size="sm" onClick={onClick} disabled={pending}>
        {pending ? "Generando…" : "Generar riesgos"}
      </Button>
    </div>
  );
}
