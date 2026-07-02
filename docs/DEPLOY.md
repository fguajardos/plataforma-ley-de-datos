# Despliegue — Supabase + Vercel

Pasos para dejar la plataforma en línea. Ejecuta los comandos dentro de la carpeta
`procesos360-lpdp/`.

## 1. Supabase (base de datos)

1. Crea un proyecto en https://supabase.com (anota la **Database Password**).
2. En el proyecto: botón **Connect** → pestaña **ORMs** → **Prisma**. Copia las dos URLs:
   - `DATABASE_URL` (pooler, puerto **6543**, incluye `?pgbouncer=true`)
   - `DIRECT_URL` (directo, puerto **5432**)
3. Pega ambas en el archivo `.env` (reemplaza `[REF]`, `[PASSWORD]`, `[REGION]`).

## 2. Secreto de Auth

Genera un secreto fuerte y ponlo en `.env` como `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Crear el esquema y sembrar datos (una vez)

```bash
npm install
npm run db:push     # crea las tablas en Supabase
npm run db:seed     # carga catálogo, empresa demo y usuarios
```

Verifica en Supabase → Table Editor que aparezcan las tablas y datos.

## 4. Subir a GitHub

```bash
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

## 5. Desplegar en Vercel

1. https://vercel.com → **Add New… → Project** → importa el repo de GitHub.
2. Framework: **Next.js** (autodetectado). Root directory: la raíz del repo.
3. En **Environment Variables** agrega (Production y Preview):
   - `DATABASE_URL` (la pooler, 6543)
   - `DIRECT_URL` (la directa, 5432)
   - `AUTH_SECRET` (el secreto generado)
   - `AUTH_URL` = la URL pública de Vercel (puedes dejarla vacía la primera vez y
     completarla luego con la URL final, ej. `https://tu-app.vercel.app`).
4. **Deploy**.

## 6. Verificación

- Abre la URL de Vercel → `/login`.
- Entra con `consultor@procesos360.cl` / `Demo1234`.
- Recorre: Diagnósticos → un dominio → Madurez → Brechas → Reporte.

## 7. Supabase Storage (evidencias)

1. Supabase → **Storage** → **New bucket** → nombre `evidencias`, **privado** (sin acceso público).
2. Copia la **service_role key** desde **Project Settings → API**.
3. Agrega a `.env` (local) y a Vercel (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://[REF].supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = la service_role (secreta)
4. Los archivos se sirven con URLs firmadas temporales; no se exponen públicamente.

## Notas

- El build en Vercel corre `prisma generate && next build` (ya configurado).
- El límite de subida de evidencias es 10 MB (`next.config.ts` → `serverActions.bodySizeLimit`).
- Cambios futuros: `git push` redepliega automáticamente.
- La carga de archivos de evidencia (pendiente) usará **Supabase Storage**, no el disco de
  Vercel (efímero).
- Si cambias el esquema, corre `npm run db:push` de nuevo (o migraciones con `prisma migrate`).
