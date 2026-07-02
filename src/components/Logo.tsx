import Image from "next/image";
import { cn } from "@/lib/utils";

// Logotipo oficial de Procesos360 (public/logo-procesos360.png, 740×128).
// El tamaño se controla con una clase de altura (ej. "h-10"); el ancho se ajusta solo.

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-procesos360.png"
      alt="Procesos360"
      width={740}
      height={128}
      priority
      className={cn("w-auto", className ?? "h-8")}
    />
  );
}
