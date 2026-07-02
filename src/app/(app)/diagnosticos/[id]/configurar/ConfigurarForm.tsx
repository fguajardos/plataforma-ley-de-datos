"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { configurarDiagnosticoAction } from "../../actions";

type Opcion = { id: string; nombre: string };
type DomCfg = {
  ddId: string;
  orden: number;
  nombre: string;
  incluido: boolean;
  responsableId: string;
  areaId: string;
  justificacionNoAplica: string;
};

export function ConfigurarForm({
  diagnosticoId,
  dominios: dominiosInit,
  responsables,
  areas,
}: {
  diagnosticoId: string;
  dominios: DomCfg[];
  responsables: Opcion[];
  areas: Opcion[];
}) {
  const router = useRouter();
  const [dominios, setDominios] = useState(dominiosInit);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set(ddId: string, patch: Partial<DomCfg>) {
    setDominios((prev) => prev.map((d) => (d.ddId === ddId ? { ...d, ...patch } : d)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await configurarDiagnosticoAction({
        diagnosticoId,
        dominios: dominios.map((d) => ({
          diagnosticoDominioId: d.ddId,
          incluido: d.incluido,
          responsableId: d.responsableId,
          areaId: d.areaId,
          justificacionNoAplica: d.justificacionNoAplica,
        })),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Configuración guardada" });
        router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "Error" });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Incl.</th>
              <th className="px-4 py-3 font-medium">Dominio</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dominios.map((d) => (
              <tr key={d.ddId} className={d.incluido ? "" : "bg-slate-50/50"}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={d.incluido}
                    onChange={(e) => set(d.ddId, { incluido: e.target.checked })}
                    className="h-4 w-4 accent-brand-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="mr-2 text-xs text-slate-400">D{d.orden}</span>
                  <span className="text-slate-800">{d.nombre}</span>
                  {!d.incluido && (
                    <Input
                      value={d.justificacionNoAplica}
                      onChange={(e) => set(d.ddId, { justificacionNoAplica: e.target.value })}
                      placeholder="Justificación de no aplicabilidad"
                      className="mt-2 h-8 text-xs"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={d.responsableId}
                    onChange={(e) => set(d.ddId, { responsableId: e.target.value })}
                    className="h-9"
                    disabled={!d.incluido}
                  >
                    <option value="">—</option>
                    {responsables.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={d.areaId}
                    onChange={(e) => set(d.ddId, { areaId: e.target.value })}
                    className="h-9"
                    disabled={!d.incluido}
                  >
                    <option value="">—</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
        {msg && <span className={msg.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>{msg.text}</span>}
      </div>
    </form>
  );
}
