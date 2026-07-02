import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getDiagnosticoFull } from "@/lib/data/diagnosticos";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui";
import { DiagnosticoNav } from "@/components/DiagnosticoNav";
import { ConfigurarForm } from "./ConfigurarForm";

export default async function ConfigurarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diag = await getDiagnosticoFull(id, session); // valida acceso

  const [usuarios, areas] = await Promise.all([
    prisma.user.findMany({
      where: { empresaId: diag.empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.area.findMany({
      where: { empresaId: diag.empresaId },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const dominios = diag.dominios.map((d) => ({
    ddId: d.id,
    orden: d.dominio.orden,
    nombre: d.dominio.nombre,
    incluido: d.incluido,
    responsableId: d.responsable?.id ?? "",
    areaId: d.area?.id ?? "",
    justificacionNoAplica: d.justificacionNoAplica ?? "",
  }));

  return (
    <>
      <DiagnosticoNav id={id} active="configurar" />
      <PageHeader
        title="Configurar diagnóstico"
        subtitle={`${diag.nombre} · selecciona dominios, responsables y áreas`}
      />
      <ConfigurarForm
        diagnosticoId={id}
        dominios={dominios}
        responsables={usuarios}
        areas={areas}
      />
      {usuarios.length === 0 && (
        <Card className="mt-4">
          <CardContent className="py-4 text-sm text-slate-500">
            Aún no hay usuarios responsables en esta empresa. Créalos en “Mi Empresa”.
          </CardContent>
        </Card>
      )}
    </>
  );
}
