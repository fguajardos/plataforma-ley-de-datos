// Configura y verifica Supabase Storage para las evidencias.
//
// Crea el bucket privado "evidencias" (si no existe) y prueba el ciclo completo que usa
// la app: subir → URL firmada → descargar → borrar. No deja basura.
//
// Requiere en .env: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (Supabase → Project Settings → API → service_role. Es secreta: solo servidor.)
//
// Uso: npx tsx prisma/configurar-storage.ts
//
// OJO en la red de Curifor: el proxy corporativo rompe la verificación TLS y el fetch de
// Node falla con "fetch failed" (a Vercel no le pasa: ahí la app funciona normal). Si te
// topas con eso, haz lo mismo por REST con curl --ssl-no-revoke:
//   GET    /storage/v1/bucket                      (listar)
//   POST   /storage/v1/bucket                      {"id":"evidencias","public":false}
//   POST   /storage/v1/object/evidencias/<path>    (subir)
//   POST   /storage/v1/object/sign/evidencias/<p>  {"expiresIn":60}
//   DELETE /storage/v1/object/evidencias/<path>
// con cabeceras: Authorization: Bearer <service_role> y apikey: <service_role>.

import { readFileSync } from "fs";
import { join } from "path";

for (const line of readFileSync(join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "evidencias";
// Debe coincidir con el límite de la app (evidencia-actions.ts: 10 MB).
const MAX_BYTES = 10 * 1024 * 1024;

async function main() {
  if (!URL) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env");
  if (!KEY) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.\n" +
        "Cópiala de Supabase → Project Settings → API → service_role."
    );
  }

  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  // ── 1. Bucket ──
  const { data: buckets, error: errList } = await supabase.storage.listBuckets();
  if (errList) throw errList;

  const existente = buckets.find((b) => b.name === BUCKET);
  if (existente) {
    console.log(`Bucket "${BUCKET}" ya existe (público: ${existente.public}).`);
    if (existente.public) {
      console.warn("  OJO: el bucket es PÚBLICO. Las evidencias deben ser privadas.");
      const { error } = await supabase.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
      });
      if (error) throw error;
      console.log("  Corregido a privado.");
    }
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    });
    if (error) throw error;
    console.log(`Bucket privado "${BUCKET}" creado (límite ${MAX_BYTES / 1024 / 1024} MB).`);
  }

  // ── 2. Prueba del ciclo real: subir → firmar → descargar → borrar ──
  const path = `_verificacion/prueba-${Date.now()}.txt`;
  const contenido = "Verificación de Storage de Procesos360. Este archivo se borra solo.";

  const { error: errUp } = await supabase.storage
    .from(BUCKET)
    .upload(path, new TextEncoder().encode(contenido), { contentType: "text/plain", upsert: true });
  if (errUp) throw new Error(`Fallo al subir: ${errUp.message}`);
  console.log("Subida: OK");

  const { data: firmada, error: errSign } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);
  if (errSign) throw new Error(`Fallo al firmar URL: ${errSign.message}`);
  console.log("URL firmada: OK");

  const res = await fetch(firmada.signedUrl);
  const texto = await res.text();
  if (texto !== contenido) throw new Error("El contenido descargado no coincide con el subido.");
  console.log("Descarga con URL firmada: OK");

  // El bucket debe ser privado: sin firma no se puede leer.
  const publica = `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
  const resPub = await fetch(publica);
  if (resPub.ok) {
    console.warn("OJO: el archivo es accesible SIN firma. Revisa que el bucket sea privado.");
  } else {
    console.log(`Acceso sin firma bloqueado (HTTP ${resPub.status}): OK`);
  }

  const { error: errDel } = await supabase.storage.from(BUCKET).remove([path]);
  if (errDel) throw new Error(`Fallo al borrar: ${errDel.message}`);
  console.log("Borrado: OK");

  console.log("\nStorage operativo. Falta que SUPABASE_SERVICE_ROLE_KEY esté también en Vercel.");
}

main().catch((e) => {
  console.error("\nERROR:", e.message ?? e);
  process.exit(1);
});
