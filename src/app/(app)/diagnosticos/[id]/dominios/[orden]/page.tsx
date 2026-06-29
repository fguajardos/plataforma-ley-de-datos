import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getDiagnosticoDominio } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PreguntaItem } from "./PreguntaItem";

export default async function DominioPage({
  params,
}: {
  params: Promise<{ id: string; orden: string }>;
}) {
  const { id, orden } = await params;
  const session = await requireSession();
  const { diag, dd } = await getDiagnosticoDominio(id, Number(orden), session);

  const evidencias: string[] = JSON.parse(dd.dominio.evidenciasMinimas || "[]");
  const respondidas = dd.respuestas.filter((r) => r.valor != null).length;
  const total = dd.respuestas.length;

  return (
    <>
      <div className="mb-2">
        <Link href={`/diagnosticos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← {diag.nombre}
        </Link>
      </div>
      <PageHeader
        title={`Dominio ${dd.dominio.orden}: ${dd.dominio.nombre}`}
        subtitle={`${respondidas} de ${total} preguntas respondidas${dd.responsable ? ` · Responsable: ${dd.responsable.nombre}` : ""}`}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Objetivo del dominio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-600">{dd.dominio.objetivo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Evidencias mínimas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-slate-600">
              {evidencias.slice(0, 10).map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-slate-300">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preguntas del diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dd.respuestas.map((r) => (
            <PreguntaItem
              key={r.id}
              respuesta={{
                id: r.id,
                valor: r.valor,
                comentario: r.comentario,
                riesgoIdentificado: r.riesgoIdentificado,
                estado: r.estado,
              }}
              pregunta={{
                orden: r.pregunta.orden,
                texto: r.pregunta.texto,
                descripcion: r.pregunta.descripcion,
                evidenciaObligatoria: r.pregunta.evidenciaObligatoria,
              }}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
