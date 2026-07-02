"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, Input } from "@/components/ui";
import { crearEmpresaAction, toggleEmpresaActivaAction } from "./actions";

export type EmpresaRow = {
  id: string;
  razonSocial: string;
  rut: string;
  industria: string | null;
  activa: boolean;
  diagnosticos: number;
  usuarios: number;
};

export function EmpresasAdmin({ empresas }: { empresas: EmpresaRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ razonSocial: "", rut: "", industria: "", adminNombre: "", adminEmail: "", adminPassword: "" });

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await crearEmpresaAction(form);
      if (res.ok) {
        setForm({ razonSocial: "", rut: "", industria: "", adminNombre: "", adminEmail: "", adminPassword: "" });
        setAbrir(false);
        router.refresh();
      } else setMsg(res.error ?? "Error");
    });
  }

  function toggle(id: string) {
    startTransition(async () => {
      const res = await toggleEmpresaActivaAction(id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAbrir((v) => !v)}>{abrir ? "Cerrar" : "+ Nueva empresa"}</Button>
      </div>

      {abrir && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <form onSubmit={crear} className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Razón social *" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} required />
              <Input placeholder="RUT *" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} required />
              <Input placeholder="Industria" value={form.industria} onChange={(e) => setForm({ ...form, industria: e.target.value })} />
              <div />
              <p className="text-xs font-medium text-slate-500 md:col-span-2">Usuario administrador inicial (opcional)</p>
              <Input placeholder="Nombre admin" value={form.adminNombre} onChange={(e) => setForm({ ...form, adminNombre: e.target.value })} />
              <Input placeholder="Email admin" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              <Input placeholder="Contraseña admin" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Creando…" : "Crear empresa"}</Button>
                {msg && <span className="text-xs text-red-600">{msg}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Razón social</th>
              <th className="px-5 py-3 font-medium">RUT</th>
              <th className="px-5 py-3 font-medium">Industria</th>
              <th className="px-5 py-3 font-medium">Diag.</th>
              <th className="px-5 py-3 font-medium">Usuarios</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empresas.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{e.razonSocial}</td>
                <td className="px-5 py-3 text-slate-600">{e.rut}</td>
                <td className="px-5 py-3 text-slate-600">{e.industria ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{e.diagnosticos}</td>
                <td className="px-5 py-3 text-slate-600">{e.usuarios}</td>
                <td className="px-5 py-3">
                  {e.activa ? <Badge color="green">Activa</Badge> : <Badge color="slate">Inactiva</Badge>}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => toggle(e.id)} disabled={pending}>
                    {e.activa ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
