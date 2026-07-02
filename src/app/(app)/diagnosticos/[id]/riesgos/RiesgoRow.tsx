"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Select, Textarea, Label } from "@/components/ui";
import { NivelRiesgoBadge } from "@/components/badges";
import { PROBABILIDAD, IMPACTO } from "@/lib/constants";
import { editarRiesgoAction } from "./actions";

type Riesgo = {
  id: string;
  descripcion: string;
  causa: string | null;
  consecuencia: string | null;
  probabilidad: string;
  impacto: string;
  nivel: string;
  controlExistente: string | null;
  mitigacion: string | null;
  codigo?: string | null;
};

export function RiesgoRow({ riesgo }: { riesgo: Riesgo }) {
  const [edit, setEdit] = useState(false);
  const [probabilidad, setProbabilidad] = useState(riesgo.probabilidad);
  const [impacto, setImpacto] = useState(riesgo.impacto);
  const [control, setControl] = useState(riesgo.controlExistente ?? "");
  const [mitigacion, setMitigacion] = useState(riesgo.mitigacion ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await editarRiesgoAction({
        riesgoId: riesgo.id,
        probabilidad: probabilidad as (typeof PROBABILIDAD)[number],
        impacto: impacto as (typeof IMPACTO)[number],
        controlExistente: control,
        mitigacion,
      });
      if (res.ok) {
        setEdit(false);
        setMsg("Guardado");
      } else setMsg(res.error ?? "Error");
    });
  }

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {riesgo.codigo && <span className="font-mono text-xs text-slate-400">{riesgo.codigo}</span>}
            <Badge color="slate">{probabilidad.toLowerCase()} prob.</Badge>
            <Badge color="slate">impacto {impacto.toLowerCase()}</Badge>
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-800">{riesgo.descripcion}</p>
          {riesgo.consecuencia && (
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-medium">Consecuencia:</span> {riesgo.consecuencia}
            </p>
          )}
          {!edit && riesgo.mitigacion && (
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-medium">Mitigación:</span> {riesgo.mitigacion}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <NivelRiesgoBadge nivel={riesgo.nivel} />
          {!edit && (
            <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {edit && (
        <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
          <div>
            <Label>Probabilidad</Label>
            <Select value={probabilidad} onChange={(e) => setProbabilidad(e.target.value)}>
              {PROBABILIDAD.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Impacto</Label>
            <Select value={impacto} onChange={(e) => setImpacto(e.target.value)}>
              {IMPACTO.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Control existente</Label>
            <Textarea rows={2} value={control} onChange={(e) => setControl(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Mitigación</Label>
            <Textarea rows={2} value={mitigacion} onChange={(e) => setMitigacion(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button size="sm" onClick={onSave} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEdit(false)}>
              Cancelar
            </Button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
