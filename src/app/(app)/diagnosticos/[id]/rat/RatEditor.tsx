"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Input, Textarea, Label, Select } from "@/components/ui";
import { CAMPOS_RAT, faltantesDe, type TratamientoPlano } from "@/lib/rat";
import {
  guardarTratamiento,
  crearTratamiento,
  eliminarTratamiento,
  generarBorradorRat,
} from "./actions";

const ESTADOS: Record<string, { label: string; color: "slate" | "yellow" | "green" }> = {
  BORRADOR: { label: "Borrador", color: "slate" },
  EN_REVISION: { label: "Por revisar", color: "yellow" },
  VIGENTE: { label: "Vigente", color: "green" },
};

type Area = { id: string; nombre: string };

export function RatEditor({
  empresaId,
  tratamientos,
  areas,
  puedeEditar,
}: {
  empresaId: string;
  tratamientos: TratamientoPlano[];
  areas: Area[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function correr(accion: () => Promise<{ ok: boolean; error?: string; creados?: number }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await accion();
      if (res.ok) {
        setMsg({
          ok: true,
          texto: res.creados
            ? `${res.creados} ${res.creados === 1 ? "actividad creada" : "actividades creadas"}.`
            : "Guardado.",
        });
        router.refresh();
      } else setMsg({ ok: false, texto: res.error ?? "No se pudo completar." });
    });
  }

  return (
    <>
      {puedeEditar && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => correr(() => generarBorradorRat(empresaId))}
            disabled={pending}
          >
            Generar borrador desde las áreas
          </Button>
          <Button onClick={() => correr(() => crearTratamiento(empresaId))} disabled={pending}>
            Agregar actividad
          </Button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.texto}
            </span>
          )}
        </div>
      )}

      {tratamientos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">El registro está vacío.</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
            Con <strong>Generar borrador desde las áreas</strong> se crea una actividad por cada
            área que declaró tratar datos en el levantamiento. Quedan sin llenar a propósito:
            la plataforma sabe qué áreas tratan datos, no para qué ni con qué base legal.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tratamientos.map((t) => {
            const faltan = faltantesDe(t);
            const est = ESTADOS[t.estado] ?? ESTADOS.BORRADOR;
            return (
              <li key={t.id} className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setAbierto(abierto === t.id ? null : t.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{t.nombre}</span>
                      <Badge color={est.color}>{est.label}</Badge>
                      {t.datosSensibles && <Badge color="orange">Datos sensibles</Badge>}
                      {t.transferenciaInternacional && (
                        <Badge color="blue">Transferencia internacional</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {t.areaNombre ?? "Sin área asignada"}
                      {faltan.length > 0
                        ? ` · faltan ${faltan.length} de ${
                            CAMPOS_RAT.filter((c) => c.obligatorio).length
                          } campos obligatorios`
                        : " · completa"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {abierto === t.id ? "Cerrar ▲" : "Abrir ▼"}
                  </span>
                </button>

                {abierto === t.id && (
                  <Formulario
                    t={t}
                    areas={areas}
                    puedeEditar={puedeEditar}
                    pending={pending}
                    onGuardar={(datos) => correr(() => guardarTratamiento(datos))}
                    onEliminar={() => correr(() => eliminarTratamiento(t.id))}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type Datos = Parameters<typeof guardarTratamiento>[0];

function Formulario({
  t,
  areas,
  puedeEditar,
  pending,
  onGuardar,
  onEliminar,
}: {
  t: TratamientoPlano;
  areas: Area[];
  puedeEditar: boolean;
  pending: boolean;
  onGuardar: (d: Datos) => void;
  onEliminar: () => void;
}) {
  const [f, setF] = useState<Datos>({
    id: t.id,
    nombre: t.nombre,
    areaId: t.areaId ?? "",
    finalidad: t.finalidad ?? "",
    categoriasTitulares: t.categoriasTitulares ?? "",
    categoriasDatos: t.categoriasDatos ?? "",
    datosSensibles: t.datosSensibles,
    baseLegal: t.baseLegal ?? "",
    origen: t.origen ?? "",
    destinatarios: t.destinatarios ?? "",
    encargados: t.encargados ?? "",
    sistemas: t.sistemas ?? "",
    transferenciaInternacional: t.transferenciaInternacional,
    paisesDestino: t.paisesDestino ?? "",
    garantiasTransferencia: t.garantiasTransferencia ?? "",
    plazoConservacion: t.plazoConservacion ?? "",
    medidasSeguridad: t.medidasSeguridad ?? "",
    estado: t.estado as Datos["estado"],
  });

  const set = (k: keyof Datos, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor={`area-${t.id}`}>Área responsable</Label>
          <Select
            id={`area-${t.id}`}
            value={f.areaId}
            disabled={!puedeEditar}
            onChange={(e) => set("areaId", e.target.value)}
          >
            <option value="">Sin área asignada</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label htmlFor={`estado-${t.id}`}>Estado</Label>
          <Select
            id={`estado-${t.id}`}
            value={f.estado}
            disabled={!puedeEditar}
            onChange={(e) => set("estado", e.target.value)}
          >
            <option value="BORRADOR">Borrador</option>
            <option value="EN_REVISION">Por revisar</option>
            <option value="VIGENTE">Vigente</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.datosSensibles}
            disabled={!puedeEditar}
            onChange={(e) => set("datosSensibles", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Trata datos sensibles
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.transferenciaInternacional}
            disabled={!puedeEditar}
            onChange={(e) => set("transferenciaInternacional", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Sale del país
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CAMPOS_RAT.map((c) => {
          // Los campos de transferencia solo aplican si la hay: mostrarlos siempre
          // invita a llenarlos con "no aplica", que ensucia el registro.
          const soloTransferencia =
            c.clave === "paisesDestino" || c.clave === "garantiasTransferencia";
          if (soloTransferencia && !f.transferenciaInternacional) return null;
          const valor = String(f[c.clave] ?? "");
          const vacioObligatorio = c.obligatorio && !valor.trim();
          return (
            <div key={c.clave} className={c.ancho === "largo" ? "md:col-span-2" : ""}>
              <Label htmlFor={`${c.clave}-${t.id}`}>
                {c.etiqueta} {c.obligatorio && <span className="text-red-600">*</span>}
              </Label>
              <p className="mb-1 text-xs text-slate-500">{c.ayuda}</p>
              {c.ancho === "largo" ? (
                <Textarea
                  id={`${c.clave}-${t.id}`}
                  rows={2}
                  value={valor}
                  disabled={!puedeEditar}
                  placeholder={c.ejemplo}
                  onChange={(e) => set(c.clave as keyof Datos, e.target.value)}
                />
              ) : (
                <Input
                  id={`${c.clave}-${t.id}`}
                  value={valor}
                  disabled={!puedeEditar}
                  placeholder={c.ejemplo}
                  onChange={(e) => set(c.clave as keyof Datos, e.target.value)}
                />
              )}
              {vacioObligatorio && (
                <p className="mt-1 text-xs text-orange-600">
                  Obligatorio: sin esto la actividad no queda documentada.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {puedeEditar && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Button onClick={() => onGuardar(f)} disabled={pending}>
            {pending ? "Guardando…" : "Guardar actividad"}
          </Button>
          <button
            type="button"
            onClick={onEliminar}
            disabled={pending}
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
