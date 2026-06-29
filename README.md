# Procesos360 LPDP

Plataforma SaaS de diagnóstico, cumplimiento y certificación frente a la **Ley N° 21.719** de
Protección de Datos Personales (Chile). Basada en el *Documento Funcional Base* y los 10 dominios
de evaluación.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Components + Server Actions)
- **Prisma 6** + **SQLite** (desarrollo; portable a PostgreSQL en producción)
- **Auth.js / NextAuth v5** (credenciales, sesión JWT, RBAC por rol)
- **Tailwind CSS v4** + componentes propios

## Puesta en marcha

```bash
npm install
npm run db:push      # crea la base SQLite (prisma/dev.db)
npm run db:seed      # carga catálogo, empresa demo y usuarios
npm run dev          # http://localhost:3000
```

Variables en `.env`:

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<cadena-aleatoria>"
```

## Usuarios de prueba (contraseña: `Demo1234`)

| Rol | Correo |
|-----|--------|
| Administrador Procesos360 | admin@procesos360.cl |
| Consultor | consultor@procesos360.cl |
| Administrador Empresa | admin@empresademo.cl |
| Responsable de Dominio | responsable@empresademo.cl |
| Alta Dirección | direccion@empresademo.cl |

## Funcionalidad implementada (slice vertical)

- **Autenticación + RBAC**: 5 roles, navegación y acceso a datos segmentados por rol/empresa.
- **Catálogo LPDP**: 10 dominios y 83 preguntas extraídas de los documentos de dominio.
- **Diagnóstico**: lista, detalle con avance por dominio, cuestionario con escala 0-5/N-A/Otro.
  - Reglas: comentario obligatorio para 0/1/2/N-A/Otro.
- **Motor de Madurez**: puntaje por dominio y global, niveles (Crítico→Avanzado), gráfico radar.
- **Motor de Brechas**: generación automática (respuestas 0/1/2, N/A sin justificación, falta de
  evidencia obligatoria) con criticidad.
- **Dashboard por rol** + **Reporte ejecutivo** imprimible (PDF).
- **Empresa**: perfil organizacional y áreas. **Admin**: empresas y catálogo.

## Estructura

```
prisma/schema.prisma   modelo de datos
prisma/seed.ts         carga inicial
src/lib/constants.ts   escala, niveles, reglas de negocio
src/lib/engines/       motores: madurez, brechas
src/lib/data/          capa de acceso a datos (con control de acceso)
src/app/(auth)/login   autenticación
src/app/(app)/         app autenticada (dashboard, diagnósticos, empresa, admin)
```

## Pendiente (siguientes iteraciones)

- Carga real de archivos de evidencia (hoy se modela metadata).
- Motor de riesgos, plan de tratamiento y roadmap (modelados en BD, falta UI).
- Validación consultiva de respuestas/evidencias e índice de preparación para certificación.
- Creación/edición de diagnósticos y empresas desde la UI (hoy vía seed).
- Migración a PostgreSQL para producción.

## Scripts

| Script | Acción |
|--------|--------|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm run db:push` | sincroniza el esquema con la BD |
| `npm run db:seed` | siembra datos |
| `npm run db:reset` | recrea la BD y resiembra |
| `npm run db:studio` | Prisma Studio |
