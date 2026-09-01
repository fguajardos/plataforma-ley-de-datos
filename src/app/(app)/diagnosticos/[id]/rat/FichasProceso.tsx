"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { MAX_EVIDENCIA_MB, MAX_EVIDENCIA_BYTES } from "@/lib/constants";
import { prepararSubidaFicha, registrarFicha, eliminarFicha } from "./fichas-actions";

export type FichaVM = {
  id: string;
  nombre: string;
  descripcion: string | null;
  areaNombre: string | null;
  mimeType: string | null;
  tamano: number | null;
  subidoPor: string | null;
  createdAt: string;
};

type Area = { id: string; nombre: string };

function peso(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Qué puede leer el análisis. PDF e imágenes van tal cual al modelo; de Word y Excel se
 * extrae el texto en el servidor. Quedan fuera los formatos antiguos y las presentaciones.
 */
function legible(mime: string | null): boolean {
  return (
    mime === "application/pdf" ||
    Boolean(mime?.startsWith("image/")) ||
    mime === DOCX ||
    mime === XLSX
  );
}

export function FichasProceso({
  empresaId,
  fichas,
  areas,
}: {
  empresaId: string;
  fichas: FichaVM[];
  areas: Area[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abrir, setAbrir] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", areaId: "" });
  const archivoRef = useRef<HTMLInputElement>(null);

  async function subir() {
    const archivo = archivoRef.current?.files?.[0];
    setMsg(null);
    if (!archivo) return setMsg({ ok: false, texto: "Elige un archivo." });
    if (form.nombre.trim().length < 3) {
      return setMsg({ ok: false, texto: "Ponle un nombre a la ficha." });
    }
    if (archivo.size > MAX_EVIDENCIA_BYTES) {
      return setMsg({ ok: false, texto: `El archivo supera ${MAX_EVIDENCIA_MB} MB.` });
    }

    setSubiendo(true);
    try {
      const prep = await prepararSubidaFicha(empresaId, archivo.name, archivo.size);
      if (!prep.ok || !prep.signedUrl || !prep.path) {
        setMsg({ ok: false, texto: prep.error ?? "No se pudo preparar la subida." });
        return;
      }
      // El archivo va del navegador directo a Storage: el servidor rechaza cuerpos
      // grandes, así que pasar por él limitaría las fichas a unos pocos megas.
      const res = await fetch(prep.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": archivo.type || "application/octet-stream" },
        body: archivo,
      });
      if (!res.ok) {
        setMsg({ ok: false, texto: `No se pudo subir el archivo (${res.status}).` });
        return;
      }
      const reg = await registrarFicha({
        empresaId,
        nombre: form.nombre,
        descripcion: form.descripcion,
        areaId: form.areaId || undefined,
        archivoPath: prep.path,
        mimeType: archivo.type || undefined,
        tamano: archivo.size,
      });
      if (!reg.ok) {
        setMsg({ ok: false, texto: reg.error ?? "No se pudo registrar la ficha." });
        return;
      }
      setForm({ nombre: "", descripcion: "", areaId: "" });
      if (archivoRef.current) archivoRef.current.value = "";
      setAbrir(false);
      setMsg({ ok: true, texto: "Ficha cargada." });
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  }

  function borrar(id: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await eliminarFicha(id);
      if (res.ok) router.refresh();
      else setMsg({ ok: false, texto: res.error ?? "No se pudo eliminar." });
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Fichas de proceso</p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            El levantamiento de campo del equipo consultor: entrevistas por área, flujos de
            datos, inventarios de sistemas. <strong>No son evidencias del cliente</strong> —
            estas las levantamos nosotros— y el análisis del RAT las prefiere por sobre los
            comentarios del cuestionario, porque describen el proceso en vez de opinar sobre él.
          </p>
        </div>
        <Button onClick={() => setAbrir(!abrir)} disabled={subiendo}>
          {abrir ? "Cancelar" : "Subir ficha"}
        </Button>
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.texto}</p>
      )}

      {abrir && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="ficha-nombre">Nombre de la ficha</Label>
              <Input
                id="ficha-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ficha de proceso — Reclutamiento y selección"
              />
            </div>
            <div>
              <Label htmlFor="ficha-area">Área levantada</Label>
              <Select
                id="ficha-area"
                value={form.areaId}
                onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}
              >
                <option value="">Sin área específica</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ficha-desc">Contexto (opcional)</Label>
            <Textarea
              id="ficha-desc"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="De qué sesión salió, con quién se levantó, qué alcance tiene."
            />
          </div>
          <div>
            <Label htmlFor="ficha-archivo">Archivo</Label>
            <input
              id="ficha-archivo"
              ref={archivoRef}
              type="file"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              Hasta {MAX_EVIDENCIA_MB} MB. El análisis lee <strong>PDF, imágenes, Word (.docx) y
              Excel (.xlsx)</strong>. Los formatos antiguos (.doc, .xls) y las presentaciones hay
              que exportarlos a PDF.
            </p>
          </div>
          <Button onClick={subir} disabled={subiendo}>
            {subiendo ? "Subiendo…" : "Cargar ficha"}
          </Button>
        </div>
      )}

      {fichas.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {fichas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{f.nombre}</span>
                  {!legible(f.mimeType) && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      el análisis no lo lee
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {f.areaNombre ?? "Sin área"} · {peso(f.tamano)}
                  {f.subidoPor && ` · subió ${f.subidoPor}`} · {f.createdAt}
                </p>
                {f.descripcion && (
                  <p className="mt-0.5 text-xs text-slate-500">{f.descripcion}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => borrar(f.id)}
                disabled={pending || subiendo}
                className="shrink-0 text-xs text-slate-500 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
