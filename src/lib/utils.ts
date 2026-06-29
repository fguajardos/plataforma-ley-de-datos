/** Une clases condicionalmente (mini clsx). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Formatea un número con coma decimal (es-CL). */
export function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
