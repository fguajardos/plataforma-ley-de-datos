"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { actualizarEmpresaAction } from "./actions";

type Empresa = {
  id: string;
  razonSocial: string;
  rut: string;
  nombreComercial: string | null;
  industria: string | null;
  tamano: string | null;
  pais: string | null;
  region: string | null;
  numColaboradores: number | null;
  sitioWeb: string | null;
  responsablePrincipal: string | null;
  correoResponsable: string | null;
  telefono: string | null;
};

const CAMPOS: { key: keyof Empresa; label: string; type?: string }[] = [
  { key: "razonSocial", label: "Razón social" },
  { key: "rut", label: "RUT" },
  { key: "nombreComercial", label: "Nombre comercial" },
  { key: "industria", label: "Industria" },
  { key: "tamano", label: "Tamaño" },
  { key: "pais", label: "País" },
  { key: "region", label: "Región" },
  { key: "numColaboradores", label: "N° colaboradores", type: "number" },
  { key: "sitioWeb", label: "Sitio web" },
  { key: "responsablePrincipal", label: "Responsable principal" },
  { key: "correoResponsable", label: "Correo responsable", type: "email" },
  { key: "telefono", label: "Teléfono" },
];

export function EmpresaDatosForm({ empresa }: { empresa: Empresa }) {
  const [form, setForm] = useState(empresa);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await actualizarEmpresaAction({
        empresaId: empresa.id,
        razonSocial: form.razonSocial,
        rut: form.rut,
        nombreComercial: form.nombreComercial ?? "",
        industria: form.industria ?? "",
        tamano: form.tamano ?? "",
        pais: form.pais ?? "",
        region: form.region ?? "",
        numColaboradores: form.numColaboradores ?? undefined,
        sitioWeb: form.sitioWeb ?? "",
        responsablePrincipal: form.responsablePrincipal ?? "",
        correoResponsable: form.correoResponsable ?? "",
        telefono: form.telefono ?? "",
      });
      setMsg(res.ok ? { ok: true, text: "Datos guardados" } : { ok: false, text: res.error ?? "Error" });
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      {CAMPOS.map((c) => (
        <div key={c.key}>
          <Label>{c.label}</Label>
          <Input
            type={c.type ?? "text"}
            value={(form[c.key] ?? "") as string | number}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                [c.key]: c.type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value,
              }))
            }
          />
        </div>
      ))}
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar datos"}</Button>
        {msg && <span className={msg.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>{msg.text}</span>}
      </div>
    </form>
  );
}
