"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Select } from "@/components/ui";
import { PrioridadBadge, EstadoAccionBadge } from "@/components/badges";
import { ESTADO_ACCION } from "@/lib/constants";
import { actualizarAccionAction } from "./actions";

type Accion = {
  id: string;
  descripcion: string;
  responsable: string | null;
  prioridad: string;
  esfuerzo: string | null;
  estado: string;
  avance: number;
  validacionConsultor: boolean;
  plazoLabel: string | null;
  codigo: string | null;
};

export function AccionRow({ accion, puedeValidar }: { accion: Accion; puedeValidar: boolean }) {
  const [estado, setEstado] = useState(accion.estado);
  const [avance, setAvance] = useState(accion.avance);
  const [validacion, setValidacion] = useState(accion.validacionConsultor);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    estado !== accion.estado || avance !== accion.avance || validacion !== accion.validacionConsultor;

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await actualizarAccionAction({
        accionId: accion.id,
        estado,
        avance: estado === "CERRADA" ? 100 : avance,
        validacionConsultor: puedeValidar ? validacion : undefined,
      });
      if (res.ok) {
        if (estado === "CERRADA") setAvance(100);
        setMsg("Guardado");
      } else setMsg(res.error ?? "Error");
    });
  }

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {accion.codigo && <span className="font-mono text-xs text-slate-400">{accion.codigo}</span>}
            <PrioridadBadge prioridad={accion.prioridad} />
            {accion.esfuerzo && <Badge color="slate">esfuerzo {accion.esfuerzo.toLowerCase()}</Badge>}
            {accion.plazoLabel && <Badge color="blue">plazo {accion.plazoLabel}</Badge>}
            {accion.validacionConsultor && <Badge color="green">validada</Badge>}
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-800">{accion.descripcion}</p>
          {accion.responsable && (
            <p className="mt-1 text-xs text-slate-500">Responsable: {accion.responsable}</p>
          )}
        </div>
        <EstadoAccionBadge estado={estado} />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
          <Select value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 w-40">
            {Object.entries(ESTADO_ACCION).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Avance: {avance}%</label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={avance}
            disabled={estado === "CERRADA"}
            onChange={(e) => setAvance(Number(e.target.value))}
            className="w-48 accent-brand-600"
          />
        </div>
        {puedeValidar && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={validacion}
              onChange={(e) => setValidacion(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Validada por consultor
          </label>
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
      </div>
    </li>
  );
}
