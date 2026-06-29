"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return {};
  } catch (e) {
    // signIn lanza un redirect (NEXT_REDIRECT) en caso de éxito: hay que re-lanzarlo.
    if (e instanceof AuthError) {
      return { error: "Credenciales inválidas. Verifica tu correo y contraseña." };
    }
    throw e;
  }
}
