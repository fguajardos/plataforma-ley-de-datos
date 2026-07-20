import Link from "next/link";
import { requireAccesoSecciones } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  getDiagnosticoFull,
  madurezDeDiagnostico,
  getPreparacionInput,
} from "@/lib/data/diagnosticos";
import { calcularPreparacion } from "@/lib/engines/certificacion";
import { fmt } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { PreparacionBadge, NivelBadge, EstadoDiagnosticoBadge } from "@/components/badges";
import { ESTADO_DIAGNOSTICO, TIPO_DIAGNOSTICO } from "@/lib/constants";

export default async function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);
  const diag = await getDiagnosticoFull(id, session); // valida acceso
  const madurez = madurezDeDiagnostico(diag);
  const prep = calcularPreparacion(await getPreparacionInput(id, diag, madurez.global));

  const [empresa, brechasTotal, brechasCerradas, riesgos, accionesTotal, accionesCerradas, evidenciasValidadas, evidenciasTotal, ratDominio] =
    await Promise.all([
      prisma.empresa.findUnique({ where: { id: diag.empresaId }, include: { areas: true } }),
      prisma.brecha.count({ where: { diagnosticoId: id } }),
      prisma.brecha.count({ where: { diagnosticoId: id, estado: "CERRADA" } }),
      prisma.riesgo.count({ where: { diagnosticoId: id } }),
      prisma.accionTratamiento.count({ where: { diagnosticoId: id } }),
      prisma.accionTratamiento.count({ where: { diagnosticoId: id, estado: "CERRADA" } }),
      prisma.evidencia.count({ where: { estado: "VALIDADA", respuesta: { diagnosticoDominio: { diagnosticoId: id } } } }),
      prisma.evidencia.count({ where: { respuesta: { diagnosticoDominio: { diagnosticoId: id } } } }),
      prisma.diagnosticoDominio.findFirst({
        where: { diagnosticoId: id, dominio: { orden: 2 } },
        include: { dominio: { select: { orden: true, nombre: true } }, respuestas: { select: { valor: true } } },
      }),
    ]);

  const areasConDatos = empresa?.areas.filter((a) => a.trataDatos) ?? [];
  const ratRespondidas = ratDominio?.respuestas.filter((r) => r.valor != null).length ?? 0;
  const ratTotal = ratDominio?.respuestas.length ?? 0;

  return (
    <>
      <DiagnosticoNav id={id} active="expediente" />
      <PageHeader
        title="Expediente Digital de Cumplimiento"
        subtitle={`${diag.empresa.razonSocial} · ${diag.nombre}`}
      />

      {/* Cabecera del expediente */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Estado">
          <EstadoDiagnosticoBadge estado={diag.estado} />
        </Stat>
        <Stat label="Madurez global">
          <span className="text-xl font-bold text-slate-800">{fmt(madurez.global)}</span>{" "}
          <NivelBadge nivel={madurez.nivelGlobal} />
        </Stat>
        <Stat label="Preparación">
          <span className="text-xl font-bold text-slate-800">{prep.indice}</span>{" "}
          <PreparacionBadge estado={prep.estado} />
        </Stat>
        <Stat label="Tipo">
          <span className="text-sm text-slate-700">
            {TIPO_DIAGNOSTICO[diag.tipo as keyof typeof TIPO_DIAGNOSTICO] ?? diag.tipo}
          </span>
        </Stat>
      </div>

      {/* Contenido del expediente (doc §15.3) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contenido del expediente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 text-sm">
              <Fila label="Diagnóstico" valor={ESTADO_DIAGNOSTICO[diag.estado as keyof typeof ESTADO_DIAGNOSTICO] ?? diag.estado} />
              <Fila label="Dominios evaluados" valor={`${diag.dominios.filter((d) => d.incluido).length} de 10`} />
              <Fila label="Brechas (cerradas / total)" valor={`${brechasCerradas} / ${brechasTotal}`} />
              <Fila label="Riesgos identificados" valor={riesgos} />
              <Fila label="Plan (acciones cerradas / total)" valor={`${accionesCerradas} / ${accionesTotal}`} />
              <Fila label="Evidencias (validadas / total)" valor={`${evidenciasValidadas} / ${evidenciasTotal}`} />
            </ul>
          </CardContent>
        </Card>

        {/* RAT */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Actividades de Tratamiento (RAT)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-slate-500">
              Dominio 2 (RAT): {ratRespondidas}/{ratTotal} preguntas respondidas.{" "}
              {ratDominio && (
                <Link href={`/diagnosticos/${id}/dominios/2`} className="text-brand-600 hover:underline">
                  Ver dominio →
                </Link>
              )}
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Áreas que tratan datos personales ({areasConDatos.length})
            </p>
            <ul className="space-y-1.5">
              {areasConDatos.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{a.nombre}</span>
                  <span className="flex gap-1.5">
                    {a.trataDatosSensibles && <Badge color="red">Sensibles</Badge>}
                    {a.usaSistemas && <Badge color="blue">Sistemas</Badge>}
                  </span>
                </li>
              ))}
              {areasConDatos.length === 0 && (
                <li className="text-sm text-slate-400">No hay áreas marcadas como tratantes de datos.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Documentos generados */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Documentos generados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <DocLink href={`/diagnosticos/${id}/reporte`} label="Reporte ejecutivo" />
          <DocLink href={`/diagnosticos/${id}/reporte-tecnico`} label="Reporte técnico" />
          <DocLink href={`/diagnosticos/${id}/certificacion`} label="Índice de preparación" />
          <DocLink href={`/diagnosticos/${id}/roadmap`} label="Roadmap" />
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string | number }) {
  return (
    <li className="flex items-center justify-between px-5 py-2.5">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{valor}</span>
    </li>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {label} →
    </Link>
  );
}
