import { prisma } from "@/lib/db";
import { requireSession, sinAccesoAEmpresa } from "@/lib/session";
import { ratDeEmpresa } from "@/lib/data/rat";
import { CAMPOS_RAT, faltantesDe, type TratamientoPlano } from "@/lib/rat";

// Descarga del RAT como CSV.
//
// Separador punto y coma y BOM al inicio: es lo que Excel en español abre bien de un
// doble clic. Con coma, Excel mete todo en una sola columna y el cliente concluye que el
// archivo está malo.

function celda(v: string | boolean | null): string {
  if (v === true) return "Sí";
  if (v === false) return "No";
  const s = (v ?? "").toString().replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const diag = await prisma.diagnostico.findUnique({
    where: { id },
    select: { empresaId: true },
  });
  if (!diag) return new Response("No encontrado", { status: 404 });
  if (sinAccesoAEmpresa(session, diag.empresaId)) {
    return new Response("Sin acceso", { status: 403 });
  }

  const rat = await ratDeEmpresa(diag.empresaId);
  if (!rat) return new Response("No encontrado", { status: 404 });

  const encabezado = [
    "Área",
    ...CAMPOS_RAT.map((c) => c.etiqueta),
    "Datos sensibles",
    "Sale del país",
    "Estado",
    "Campos obligatorios pendientes",
  ];

  const filas = rat.tratamientos.map((t: TratamientoPlano) => {
    const faltan = faltantesDe(t);
    return [
      celda(t.areaNombre),
      ...CAMPOS_RAT.map((c) => celda(t[c.clave] as string | boolean | null)),
      celda(t.datosSensibles),
      celda(t.transferenciaInternacional),
      celda(t.estado),
      celda(faltan.length === 0 ? "" : faltan.map((c) => c.etiqueta).join(", ")),
    ].join(";");
  });

  const preliminar = rat.tratamientos.some(
    (t) => t.estado !== "VIGENTE" || faltantesDe(t).length > 0
  );

  const csv = [
    // La primera línea viaja con el archivo: si alguien lo reenvía suelto, sigue diciendo
    // de quién es, cuándo se sacó y si estaba terminado.
    `"${rat.empresa} — Registro de Actividades de Tratamiento (Ley 21.719)"`,
    `"Generado el ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}${
      preliminar ? " — PRELIMINAR: hay actividades en borrador o con campos sin llenar" : ""
    }"`,
    "",
    encabezado.map((h) => celda(h)).join(";"),
    ...filas,
  ].join("\r\n");

  const nombre = `RAT-${rat.empresa.replace(/[^a-zA-Z0-9]+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
