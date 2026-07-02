"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input } from "@/components/ui";
import { guardarAreaAction, eliminarAreaAction } from "./actions";

export type AreaVM = {
  id: string;
  nombre: string;
  responsable: string | null;
  cargo: string | null;
  correo: string | null;
  participaDiagnostico: boolean;
  trataDatos: boolean;
  trataDatosSensibles: boolean;
  usaSistemas: boolean;
};

const VACIA: Omit<AreaVM, "id"> = {
  nombre: "",
  responsable: "",
  cargo: "",
  correo: "",
  participaDiagnostico: true,
  trataDatos: false,
  trataDatosSensibles: false,
  usaSistemas: false,
};

export function AreasManager({ empresaId, areas }: { empresaId: string; areas: AreaVM[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<AreaVM | (Omit<AreaVM, "id"> & { id?: string }) | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function guardar() {
    if (!editando) return;
    setMsg(null);
    startTransition(async () => {
      const res = await guardarAreaAction({
        empresaId,
        id: editando.id,
        nombre: editando.nombre,
        responsable: editando.responsable ?? "",
        cargo: editando.cargo ?? "",
        correo: editando.correo ?? "",
        participaDiagnostico: editando.participaDiagnostico,
        trataDatos: editando.trataDatos,
        trataDatosSensibles: editando.trataDatosSensibles,
        usaSistemas: editando.usaSistemas,
      });
      if (res.ok) {
        setEditando(null);
        router.refresh();
      } else setMsg(res.error ?? "Error");
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarAreaAction(id);
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Error");
    });
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {areas.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-800">{a.nombre}</p>
              <p className="text-xs text-slate-400">{a.responsable ?? "—"} {a.cargo ? `· ${a.cargo}` : ""}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {a.trataDatos && <Badge color="blue">Datos</Badge>}
              {a.trataDatosSensibles && <Badge color="red">Sensibles</Badge>}
              {a.usaSistemas && <Badge color="slate">Sistemas</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setEditando(a)}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => eliminar(a.id)} disabled={pending}>×</Button>
            </div>
          </li>
        ))}
        {areas.length === 0 && <li className="py-3 text-sm text-slate-400">Sin áreas registradas.</li>}
      </ul>

      {editando ? (
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
          <Input placeholder="Nombre del área *" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
          <Input placeholder="Responsable" value={editando.responsable ?? ""} onChange={(e) => setEditando({ ...editando, responsable: e.target.value })} />
          <Input placeholder="Cargo" value={editando.cargo ?? ""} onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} />
          <Input placeholder="Correo" value={editando.correo ?? ""} onChange={(e) => setEditando({ ...editando, correo: e.target.value })} />
          <div className="flex flex-wrap gap-4 md:col-span-2">
            <Check label="Participa" v={editando.participaDiagnostico} on={(v) => setEditando({ ...editando, participaDiagnostico: v })} />
            <Check label="Trata datos" v={editando.trataDatos} on={(v) => setEditando({ ...editando, trataDatos: v })} />
            <Check label="Datos sensibles" v={editando.trataDatosSensibles} on={(v) => setEditando({ ...editando, trataDatosSensibles: v })} />
            <Check label="Usa sistemas" v={editando.usaSistemas} on={(v) => setEditando({ ...editando, usaSistemas: v })} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button size="sm" onClick={guardar} disabled={pending || !editando.nombre}>{pending ? "Guardando…" : "Guardar área"}</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditando({ ...VACIA })}>
          + Agregar área
        </Button>
      )}
    </div>
  );
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-4 w-4 accent-brand-600" />
      {label}
    </label>
  );
}
