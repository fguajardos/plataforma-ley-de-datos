import { cn } from "@/lib/utils";

// Recreación vectorial del logotipo de Procesos360: wordmark en itálica + triple chevron.
// Colores de marca: azul claro #1A9BD7 (wordmark + 1er chevron), teal oscuro #1C6F8C (chevrons 2 y 3).
// El tamaño se controla con utilidades text-* en el contenedor; el chevron escala con la altura del texto.

const AZUL = "#1A9BD7";
const TEAL = "#1C6F8C";

export function Chevrons({ className }: { className?: string }) {
  // Tres chevrons "»" gruesos, ligeramente superpuestos.
  const chevron = (x: number) => `M${x},2 L${x + 13},2 L${x + 25},20 L${x + 13},38 L${x},38 L${x + 12},20 Z`;
  return (
    <svg viewBox="0 0 66 40" className={className} fill="none" aria-hidden="true">
      <path d={chevron(0)} fill={AZUL} />
      <path d={chevron(21)} fill={TEAL} />
      <path d={chevron(42)} fill={TEAL} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none items-center gap-[0.35em]", className)}>
      <span className="font-extrabold italic tracking-tight" style={{ color: AZUL }}>
        PROCESOS360
      </span>
      <Chevrons className="h-[0.78em] w-auto" />
    </span>
  );
}
