import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-3 h-11" />
          <p className="text-sm font-semibold text-slate-500">LPDP · Ley N° 21.719</p>
          <p className="mt-1 text-sm text-slate-500">
            Diagnóstico y cumplimiento de datos personales
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoginForm />
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white/60 p-4 text-xs text-slate-500">
          <p className="mb-1 font-semibold text-slate-600">Usuarios de prueba (contraseña: Demo1234)</p>
          <ul className="space-y-0.5">
            <li>admin@procesos360.cl · consultor@procesos360.cl</li>
            <li>admin@empresademo.cl · responsable@empresademo.cl · direccion@empresademo.cl</li>
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/">Procesos360 © 2026</Link>
        </p>
      </div>
    </div>
  );
}
