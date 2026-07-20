import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { signOutAction } from "@/app/(app)/actions";
import {
  CONSENTIMIENTO_VERSION,
  CONSENTIMIENTO_VIGENCIA,
  SECCIONES,
} from "@/lib/consentimiento";
import { ConsentimientoForm } from "./ConsentimientoForm";

export const metadata = { title: "Consentimiento informado · Procesos360" };

export default async function ConsentimientoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.consentimientoVersion === CONSENTIMIENTO_VERSION) redirect("/dashboard");

  const esActualizacion = user.consentimientoVersion !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-3 h-11" />
          <p className="text-sm font-semibold text-slate-500">LPDP · Ley N° 21.719</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-8 py-6">
            <h1 className="text-lg font-semibold text-slate-900">
              Consentimiento informado para el tratamiento de sus datos personales
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Versión {CONSENTIMIENTO_VERSION} · vigente desde el {CONSENTIMIENTO_VIGENCIA}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {esActualizacion
                ? "Actualizamos este documento. Para seguir usando la plataforma, revise los cambios y otorgue nuevamente su consentimiento."
                : `Hola ${user.nombre.split(" ")[0]}: antes de usar la plataforma por primera vez, necesitamos su consentimiento. Predicamos con el ejemplo.`}
            </p>
          </div>

          <div className="max-h-[50vh] space-y-6 overflow-y-auto px-8 py-6">
            {SECCIONES.map((s) => (
              <section key={s.titulo}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">{s.titulo}</h2>
                {s.parrafos?.map((p) => (
                  <p key={p} className="mb-2 text-sm leading-relaxed text-slate-600">
                    {p}
                  </p>
                ))}
                {s.items && (
                  <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-slate-600">
                    {s.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="border-t border-slate-100 px-8 py-6">
            <ConsentimientoForm />
            <form action={signOutAction}>
              <button
                type="submit"
                className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                No acepto · cerrar sesión
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">Procesos360 © 2026</p>
      </div>
    </div>
  );
}
