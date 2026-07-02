"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import { EstadoEvidenciaBadge } from "@/components/badges";
import { TIPO_DOCUMENTAL, ESTADO_EVIDENCIA } from "@/lib/constants";
import {
  subirEvidenciaAction,
  validarEvidenciaAction,
  eliminarEvidenciaAction,
  descargarEvidenciaAction,
} from "./evidencia-actions";

export type EvidenciaVM = {
  id: string;
  nombre: string;
  tipoDocumental: string | null;
  estado: string;
  archivoPath: string | null;
  observaciones: string | null;
};

export function EvidenciasPregunta({
  respuestaId,
  evidencias,
  puedeValidar,
}: {
  respuestaId: string;
  evidencias: EvidenciaVM[];
  puedeValidar: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [abrir, setAbrir] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("respuestaId", respuestaId);
    startTransition(async () => {
      const res = await subirEvidenciaAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        setAbrir(false);
        router.refresh();
      } else setMsg(res.error ?? "Error");
    });
  }

  function validar(id: string, estado: keyof typeof ESTADO_EVIDENCIA) {
    startTransition(async () => {
      const res = await validarEvidenciaAction(id, estado);
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Error");
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarEvidenciaAction(id);
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Error");
    });
  }

  async function descargar(id: string) {
    const res = await descargarEvidenciaAction(id);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else setMsg(res.error ?? "Sin archivo");
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Evidencias ({evidencias.length})
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAbrir((v) => !v)}>
          {abrir ? "Cerrar" : "+ Adjuntar"}
        </Button>
      </div>

      {evidencias.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-200">
          {evidencias.map((ev) => (
            <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{ev.nombre}</p>
                <p className="text-xs text-slate-400">
                  {ev.tipoDocumental ?? "Documento"}
                  {ev.observaciones ? ` · ${ev.observaciones}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EstadoEvidenciaBadge estado={ev.estado} />
                {ev.archivoPath && (
                  <Button size="sm" variant="secondary" onClick={() => descargar(ev.id)}>
                    Ver
                  </Button>
                )}
                {puedeValidar && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => validar(ev.id, "VALIDADA")} disabled={pending}>
                      Validar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => validar(ev.id, "OBSERVADA")} disabled={pending}>
                      Observar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="danger" onClick={() => eliminar(ev.id)} disabled={pending}>
                  ×
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {abrir && (
        <form ref={formRef} onSubmit={onSubmit} className="mt-3 grid gap-2 md:grid-cols-2">
          <Input name="nombre" placeholder="Nombre del documento *" required />
          <Select name="tipoDocumental" defaultValue="">
            <option value="">Tipo documental…</option>
            {TIPO_DOCUMENTAL.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <label className="text-xs text-slate-500">
            Vigencia (opcional)
            <Input name="vigencia" type="date" />
          </label>
          <label className="text-xs text-slate-500">
            Archivo (máx 10 MB)
            <Input name="file" type="file" />
          </label>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Subiendo…" : "Subir evidencia"}
            </Button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
          </div>
        </form>
      )}
      {!abrir && msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  );
}
