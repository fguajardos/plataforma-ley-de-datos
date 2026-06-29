import Link from "next/link";
import { requireSession, esStaffP360 } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getDiagnosticoFull } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Badge } from "@/components/ui";
import { CriticidadBadge } from "@/components/badges";
import { GenerarBrechasButton } from "./GenerarBrechasButton";

const ORDEN_CRIT: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

export default async function BrechasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session); // valida acceso

  const brechas = await prisma.brecha.findMany({
    where: { diagnosticoId: id },
    include: {
      respuesta: {
        select: {
          pregunta: { select: { texto: true } },
          diagnosticoDominio: { select: { dominio: { select: { orden: true, nombre: true } } } },
        },
      },
    },
  });
  brechas.sort((a, b) => (ORDEN_CRIT[a.criticidad] ?? 9) - (ORDEN_CRIT[b.criticidad] ?? 9));

  const conteo = {
    CRITICA: brechas.filter((b) => b.criticidad === "CRITICA").length,
    ALTA: brechas.filter((b) => b.criticidad === "ALTA").length,
    MEDIA: brechas.filter((b) => b.criticidad === "MEDIA").length,
    BAJA: brechas.filter((b) => b.criticidad === "BAJA").length,
  };

  return (
    <>
      <div className="mb-2">
        <Link href={`/diagnosticos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← {diag.nombre}
        </Link>
      </div>
      <PageHeader
        title="Motor de Brechas"
        subtitle="Incumplimientos detectados frente a la Ley N° 21.719"
        actions={<GenerarBrechasButton diagnosticoId={id} />}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Resumen label="Críticas" valor={conteo.CRITICA} color="red" />
        <Resumen label="Altas" valor={conteo.ALTA} color="orange" />
        <Resumen label="Medias" valor={conteo.MEDIA} color="yellow" />
        <Resumen label="Bajas" valor={conteo.BAJA} color="slate" />
      </div>

      {brechas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No hay brechas generadas. Responde el cuestionario y pulsa “Generar brechas”.
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {brechas.map((b) => (
                <li key={b.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{b.codigo}</span>
                        {b.respuesta?.diagnosticoDominio.dominio && (
                          <Badge color="blue">
                            D{b.respuesta.diagnosticoDominio.dominio.orden} ·{" "}
                            {b.respuesta.diagnosticoDominio.dominio.nombre}
                          </Badge>
                        )}
                        <Badge color="slate">{b.tipo.toLowerCase()}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-slate-800">{b.descripcion}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-medium">Acción recomendada:</span> {b.accionRecomendada}
                      </p>
                    </div>
                    <CriticidadBadge criticidad={b.criticidad} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Resumen({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: "red" | "orange" | "yellow" | "slate";
}) {
  const text = {
    red: "text-red-700",
    orange: "text-orange-700",
    yellow: "text-yellow-700",
    slate: "text-slate-600",
  }[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{valor}</p>
    </div>
  );
}
