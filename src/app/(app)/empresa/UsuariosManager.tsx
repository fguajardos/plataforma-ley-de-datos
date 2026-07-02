"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Select } from "@/components/ui";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { guardarUsuarioAction } from "./actions";

export type UsuarioVM = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  cargo: string | null;
  activo: boolean;
};

const ROLES_EMPRESA = [ROLES.ADMIN_EMPRESA, ROLES.RESPONSABLE_DOMINIO, ROLES.ALTA_DIRECCION] as const;

type Editable = { id?: string; nombre: string; email: string; role: string; cargo: string; activo: boolean; password: string };

const VACIO: Editable = { nombre: "", email: "", role: ROLES.RESPONSABLE_DOMINIO, cargo: "", activo: true, password: "" };

export function UsuariosManager({ empresaId, usuarios }: { empresaId: string; usuarios: UsuarioVM[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Editable | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function guardar() {
    if (!editando) return;
    setMsg(null);
    startTransition(async () => {
      const res = await guardarUsuarioAction({
        empresaId,
        id: editando.id,
        nombre: editando.nombre,
        email: editando.email,
        role: editando.role as (typeof ROLES_EMPRESA)[number],
        cargo: editando.cargo,
        password: editando.password,
        activo: editando.activo,
      });
      if (res.ok) {
        setEditando(null);
        router.refresh();
      } else setMsg(res.error ?? "Error");
    });
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {usuarios.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {u.nombre} {!u.activo && <span className="text-xs text-slate-400">(inactivo)</span>}
              </p>
              <p className="text-xs text-slate-400">{u.email} · {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge color={u.activo ? "green" : "slate"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditando({ id: u.id, nombre: u.nombre, email: u.email, role: u.role, cargo: u.cargo ?? "", activo: u.activo, password: "" })}
              >
                Editar
              </Button>
            </div>
          </li>
        ))}
        {usuarios.length === 0 && <li className="py-3 text-sm text-slate-400">Sin usuarios internos.</li>}
      </ul>

      {editando ? (
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
          <Input placeholder="Nombre *" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
          <Input placeholder="Email *" type="email" value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} />
          <Select value={editando.role} onChange={(e) => setEditando({ ...editando, role: e.target.value })}>
            {ROLES_EMPRESA.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
          <Input placeholder="Cargo" value={editando.cargo} onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} />
          <Input
            placeholder={editando.id ? "Nueva contraseña (opcional)" : "Contraseña *"}
            type="password"
            value={editando.password}
            onChange={(e) => setEditando({ ...editando, password: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Activo
          </label>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button size="sm" onClick={guardar} disabled={pending || !editando.nombre || !editando.email}>
              {pending ? "Guardando…" : "Guardar usuario"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEditando({ ...VACIO })}>
          + Agregar usuario
        </Button>
      )}
    </div>
  );
}
