"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";
import { TIPO_DIAGNOSTICO } from "@/lib/constants";
import { crearDiagnosticoAction } from "../actions";

type Opcion = { id: string; nombre: string };

export function NuevoDiagnosticoForm({
  empresas,
  consultores,
}: {
  empresas: Opcion[];
  consultores: Opcion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [nombre, setNombre] = useState("Diagnóstico LPDP 2026");
  const [tipo, setTipo] = useState("COMPLETO");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaCierre, setFechaCierre] = useState("");
  const [consultorId, setConsultorId] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearDiagnosticoAction({ empresaId, nombre, tipo, fechaInicio, fechaCierre, consultorId });
      if (res.ok && res.id) router.push(`/diagnosticos/${res.id}/configurar`);
      else setError(res.error ?? "Error");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label>Empresa</Label>
        <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} disabled={empresas.length <= 1}>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Nombre del diagnóstico</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPO_DIAGNOSTICO).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Consultor responsable</Label>
        <Select value={consultorId} onChange={(e) => setConsultorId(e.target.value)}>
          <option value="">Sin asignar</option>
          {consultores.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Fecha de inicio</Label>
        <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
      </div>
      <div>
        <Label>Fecha de cierre</Label>
        <Input type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending || !empresaId}>
          {pending ? "Creando…" : "Crear diagnóstico"}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
