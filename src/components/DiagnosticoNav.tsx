import Link from "next/link";
import { cn } from "@/lib/utils";

// Sub-navegación horizontal para las secciones de un diagnóstico.
// El viaje del Documento Funcional Base: resumen → config → cuestionario → motores → reportes.

const TABS: { key: string; suffix: string; label: string }[] = [
  { key: "resumen", suffix: "", label: "Resumen" },
  { key: "configurar", suffix: "/configurar", label: "Configurar" },
  { key: "madurez", suffix: "/madurez", label: "Madurez" },
  { key: "brechas", suffix: "/brechas", label: "Brechas" },
  { key: "riesgos", suffix: "/riesgos", label: "Riesgos" },
  { key: "plan", suffix: "/plan", label: "Plan" },
  { key: "roadmap", suffix: "/roadmap", label: "Roadmap" },
  { key: "certificacion", suffix: "/certificacion", label: "Certificación" },
  { key: "reporte", suffix: "/reporte", label: "Reporte" },
  { key: "reporte-tecnico", suffix: "/reporte-tecnico", label: "Técnico" },
  { key: "expediente", suffix: "/expediente", label: "Expediente" },
];

export function DiagnosticoNav({ id, active }: { id: string; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px print:hidden">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/diagnosticos/${id}${t.suffix}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
