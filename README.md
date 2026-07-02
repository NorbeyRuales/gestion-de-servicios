# Gestor de Servicios

Aplicación interna para administrar clientes, sedes, equipos, órdenes de trabajo, facturación, pagos y reportes. El frontend usa React y Vite; autenticación, base de datos y archivos se gestionan con Supabase.

## Requisitos

- Node.js 20.19.x
- npm
- Un proyecto Supabase
- Supabase CLI para aplicar migraciones y desplegar funciones

## Configuración local

```bash
npm ci
```

Copia `.env.example` como `.env.local` y completa las variables sin publicarlas. `VITE_SUPABASE_ANON_KEY` es una clave pública; nunca uses `service_role` en variables con prefijo `VITE_`.

```bash
npm run dev
```

Vite sirve la aplicación en `http://localhost:5173` por defecto.

## Controles de calidad

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run check` ejecuta todos los controles anteriores. GitHub Actions ejecuta además `npm audit --audit-level=high`.

## Supabase

Las migraciones están en `supabase/migrations`. Para un proyecto enlazado:

```bash
npx supabase db push
npx supabase functions deploy admin-create-user
```

El registro público debe permanecer desactivado en **Authentication > Providers > Email**. Crea el primer usuario desde el panel de Supabase; el trigger lo convierte en administrador inicial. Los usuarios posteriores se crean desde Administración mediante la Edge Function `admin-create-user`.

Configura en Supabase las URL permitidas de producción para inicio de sesión y recuperación de contraseña. No publiques `SUPABASE_DB_URL` ni `SUPABASE_SERVICE_ROLE_KEY`.

## Despliegue

El build de producción se genera en `dist`:

```bash
npm ci
npm run check
```

`vercel.json` incluye fallback para la SPA, caché de assets y cabeceras de seguridad. En el proveedor de despliegue configura solamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para el frontend.

## Estructura

- `src/auth`: sesión y recuperación de contraseña.
- `src/features`: módulos funcionales de la aplicación.
- `src/lib`: cliente Supabase y utilidades compartidas.
- `supabase/migrations`: esquema, RLS, funciones e índices.
- `supabase/functions`: funciones ejecutadas en el backend de Supabase.

El diseño original se creó en [Figma](https://www.figma.com/design/0UavQ6PO7yV6WbzIZfIhMf/Gestor-de-Servicios-app).
