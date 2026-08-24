import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAccesoSecciones, sinAccesoAEmpresa } from "@/lib/session";
import { ratDeEmpresa } from "@/lib/data/rat";
import { CAMPOS_RAT, faltantesDe } from "@/lib/rat";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { RatEditor } from "./RatEditor";
import { PropuestaRat } from "./PropuestaRat";

export const metadata = { title: "RAT · Procesos360" };

export default async function RatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAccesoSecciones(id);

  const diag = await prisma.diagnostico.findUnique({
    where: { id },
    select: { empresaId: true },
  });
  if (!diag) notFound();
  if (sinAccesoAEmpresa(session, diag.empresaId)) notFound();

  const [rat, areas] = await Promise.all([
    ratDeEmpresa(diag.empresaId),
    prisma.area.findMany({
      where: { empresaId: diag.empresaId },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  if (!rat) notFound();

  const puedeEditar = session.user.role !== ROLES.RESPONSABLE_DOMINIO;
  const obligatorios = CAMPOS_RAT.filter((c) => c.obligatorio);
  const faltantesTotales = rat.tratamientos.reduce((n, t) => n + faltantesDe(t).length, 0);

  return (
    <>
      <DiagnosticoNav id={id} active="rat" />
      <PageHeader
        title="Registro de Actividades de Tratamiento"
        subtitle={`${rat.empresa} · el registro que la Ley 21.719 obliga a mantener`}
      />

      {/* ── Estado del registro ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Actividades registradas" valor={rat.tratamientos.length} />
        <Kpi
          label="Completas"
          valor={`${rat.completos}/${rat.tratamientos.length}`}
          alerta={rat.completos < rat.tratamientos.length}
        />
        <Kpi label="Campos por llenar" valor={faltantesTotales} alerta={faltantesTotales > 0} />
        <Kpi label="Con datos sensibles" valor={rat.conSensibles} />
        <Kpi
          label="Áreas sin actividad"
          valor={`${rat.areasSinTratamiento.length}/${rat.areasQueTratanDatos}`}
          alerta={rat.areasSinTratamiento.length > 0}
        />
      </div>

      {/* ── Requisitos: qué hay que reunir ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Qué exige el registro</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">
            Por <strong>cada</strong> actividad de tratamiento. Los marcados con{" "}
            <span className="text-red-600">*</span> son los que no pueden faltar: sin ellos la
            actividad no queda documentada.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {CAMPOS_RAT.map((c) => (
              <li key={c.clave} className="text-sm">
                <span className="font-medium text-slate-800">{c.etiqueta}</span>
                {c.obligatorio && <span className="ml-1 text-red-600">*</span>}
                <p className="text-slate-600">{c.ayuda}</p>
                <p className="mt-0.5 text-xs italic text-slate-400">Ej: {c.ejemplo}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Son {obligatorios.length} campos obligatorios por actividad. Los países de destino y
            sus garantías aparecen solo cuando la actividad declara que los datos salen del país.
          </p>
        </CardContent>
      </Card>

      {/* ── Áreas que declararon tratar datos y aún no aparecen ── */}
      {rat.areasSinTratamiento.length > 0 && (
        <Card className="mb-6 border-orange-200">
          <CardHeader>
            <CardTitle>Áreas que tratan datos y no están en el registro</CardTitle>
            <p className="mt-0.5 text-sm text-slate-500">
              Lo declararon en el levantamiento. Mientras no tengan al menos una actividad, el
              registro está incompleto.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1.5">
              {rat.areasSinTratamiento.map((a) => (
                <li
                  key={a.id}
                  className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                >
                  {a.nombre}
                  {a.sensibles && " · sensibles"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── El registro preliminar, editable ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Registro preliminar</h2>
        <a
          href={`/diagnosticos/${id}/rat/descargar`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-600 hover:text-brand-600"
        >
          Descargar el registro
        </a>
      </div>

      {puedeEditar && <PropuestaRat diagnosticoId={id} empresaId={diag.empresaId} />}

      <RatEditor
        empresaId={diag.empresaId}
        tratamientos={rat.tratamientos}
        areas={areas}
        puedeEditar={puedeEditar}
      />

      <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        Este registro se marca como <strong>preliminar</strong> mientras haya actividades en
        borrador o campos obligatorios sin llenar. La plataforma no completa los campos por su
        cuenta: sabe qué áreas tratan datos porque lo declararon, pero no para qué, con qué base
        legal ni por cuánto tiempo. Eso lo responde la empresa, y por eso el registro sirve
        después como prueba.
      </p>
    </>
  );
}

function Kpi({
  label,
  valor,
  alerta,
}: {
  label: string;
  valor: string | number;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          alerta ? "text-orange-600" : "text-slate-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
