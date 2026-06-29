import { Badge } from "@/components/ui";
import { ESTADO_DIAGNOSTICO, NIVEL_MADUREZ, type NivelMadurez } from "@/lib/constants";

export function NivelBadge({ nivel }: { nivel: NivelMadurez | null }) {
  if (!nivel) return <Badge color="slate">Sin datos</Badge>;
  const map: Record<NivelMadurez, "red" | "orange" | "yellow" | "green" | "blue"> = {
    CRITICO: "red",
    BAJO: "orange",
    MEDIO: "yellow",
    ALTO: "green",
    AVANZADO: "green",
  };
  return <Badge color={map[nivel]}>{NIVEL_MADUREZ[nivel].label}</Badge>;
}

export function EstadoDiagnosticoBadge({ estado }: { estado: string }) {
  const label = ESTADO_DIAGNOSTICO[estado as keyof typeof ESTADO_DIAGNOSTICO] ?? estado;
  const color =
    estado === "CERRADO" || estado === "PREPARADO_CERT"
      ? "green"
      : estado === "BORRADOR"
        ? "slate"
        : "blue";
  return <Badge color={color}>{label}</Badge>;
}

export function CriticidadBadge({ criticidad }: { criticidad: string }) {
  const map: Record<string, "red" | "orange" | "yellow" | "slate"> = {
    CRITICA: "red",
    ALTA: "orange",
    MEDIA: "yellow",
    BAJA: "slate",
  };
  const label = criticidad.charAt(0) + criticidad.slice(1).toLowerCase();
  return <Badge color={map[criticidad] ?? "slate"}>{label}</Badge>;
}
