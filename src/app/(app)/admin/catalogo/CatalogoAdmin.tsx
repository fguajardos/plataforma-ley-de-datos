"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, Input, Textarea } from "@/components/ui";
import { actualizarDominioAction, guardarPreguntaAction, eliminarPreguntaAction } from "./actions";

type Pregunta = { id: string; orden: number; texto: string; descripcion: string; evidenciaObligatoria: boolean };
type Dominio = { id: string; orden: number; nombre: string; objetivo: string; preguntas: Pregunta[] };

export function CatalogoAdmin({ dominios }: { dominios: Dominio[] }) {
  return (
    <div className="space-y-4">
      {dominios.map((d) => (
        <DominioCard key={d.id} dominio={d} />
      ))}
    </div>
  );
}

function DominioCard({ dominio }: { dominio: Dominio }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editDom, setEditDom] = useState(false);
  const [nombre, setNombre] = useState(dominio.nombre);
  const [objetivo, setObjetivo] = useState(dominio.objetivo);
  const [nuevaPregunta, setNuevaPregunta] = useState<{ texto: string; descripcion: string; evidenciaObligatoria: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function guardarDom() {
    startTransition(async () => {
      const res = await actualizarDominioAction({ dominioId: dominio.id, nombre, objetivo });
      if (res.ok) { setEditDom(false); router.refresh(); } else setMsg(res.error ?? "Error");
    });
  }

  function crearPregunta() {
    if (!nuevaPregunta) return;
    startTransition(async () => {
      const res = await guardarPreguntaAction({ dominioId: dominio.id, ...nuevaPregunta });
      if (res.ok) { setNuevaPregunta(null); router.refresh(); } else setMsg(res.error ?? "Error");
    });
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand">
            {dominio.orden}
          </div>
          <div className="min-w-0 flex-1">
            {editDom ? (
              <div className="space-y-2">
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <Textarea rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={guardarDom} disabled={pending}>Guardar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditDom(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{dominio.nombre}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditDom(true)}>Editar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setAbierto((v) => !v)}>
                      {abierto ? "Ocultar" : `${dominio.preguntas.length} preguntas`}
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{dominio.objetivo}</p>
              </>
            )}
          </div>
        </div>

        {abierto && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {dominio.preguntas.map((p) => (
              <PreguntaEditor key={p.id} pregunta={p} dominioId={dominio.id} />
            ))}

            {nuevaPregunta ? (
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3">
                <Input placeholder="Texto de la pregunta *" value={nuevaPregunta.texto} onChange={(e) => setNuevaPregunta({ ...nuevaPregunta, texto: e.target.value })} />
                <Textarea rows={2} placeholder="Descripción (qué se busca identificar)" value={nuevaPregunta.descripcion} onChange={(e) => setNuevaPregunta({ ...nuevaPregunta, descripcion: e.target.value })} />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" checked={nuevaPregunta.evidenciaObligatoria} onChange={(e) => setNuevaPregunta({ ...nuevaPregunta, evidenciaObligatoria: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                  Requiere evidencia obligatoria
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={crearPregunta} disabled={pending || !nuevaPregunta.texto}>Agregar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setNuevaPregunta(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setNuevaPregunta({ texto: "", descripcion: "", evidenciaObligatoria: false })}>
                + Agregar pregunta
              </Button>
            )}
            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreguntaEditor({ pregunta, dominioId }: { pregunta: Pregunta; dominioId: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [texto, setTexto] = useState(pregunta.texto);
  const [descripcion, setDescripcion] = useState(pregunta.descripcion);
  const [evid, setEvid] = useState(pregunta.evidenciaObligatoria);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await guardarPreguntaAction({ id: pregunta.id, dominioId, texto, descripcion, evidenciaObligatoria: evid });
      if (res.ok) { setEdit(false); router.refresh(); }
    });
  }
  function eliminar() {
    startTransition(async () => {
      const res = await eliminarPreguntaAction(pregunta.id);
      if (res.ok) router.refresh();
    });
  }

  if (edit) {
    return (
      <div className="grid gap-2 rounded-lg bg-slate-50 p-3">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={evid} onChange={(e) => setEvid(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Requiere evidencia obligatoria
        </label>
        <div className="flex gap-2">
          <Button size="sm" onClick={guardar} disabled={pending}>Guardar</Button>
          <Button size="sm" variant="secondary" onClick={() => setEdit(false)}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="text-sm text-slate-700">
          <span className="mr-2 text-xs text-slate-400">{pregunta.orden}</span>
          {pregunta.texto}
          {pregunta.evidenciaObligatoria && <Badge color="orange" className="ml-2">Evidencia</Badge>}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>Editar</Button>
        <Button size="sm" variant="danger" onClick={eliminar} disabled={pending}>×</Button>
      </div>
    </div>
  );
}
