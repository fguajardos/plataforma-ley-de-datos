import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui";

export default async function CatalogoPage() {
  await requireRole([ROLES.ADMIN_P360]);
  const dominios = await prisma.dominio.findMany({
    include: { _count: { select: { preguntas: true } } },
    orderBy: { orden: "asc" },
  });
  const totalPreguntas = dominios.reduce((a, d) => a + d._count.preguntas, 0);

  return (
    <>
      <PageHeader
        title="Catálogo LPDP"
        subtitle={`10 dominios · ${totalPreguntas} preguntas · Ley N° 21.719`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {dominios.map((d) => (
          <Card key={d.id}>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand">
                  {d.orden}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{d.nombre}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-slate-500">{d.objetivo}</p>
                  <p className="mt-2 text-xs font-medium text-brand-600">
                    {d._count.preguntas} preguntas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
