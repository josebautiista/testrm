<!-- BEGIN:nextjs-agent-rules -->
# Proyecto APP_TEST_DE_RM

Este repositorio es una aplicación web construida con **Next.js 16 (App Router)**, **React 19**, **TypeScript** y **Tailwind CSS 4**.

> El archivo `AGENTS.md` se utiliza como guía para agentes y asistentes, no como documentación de usuario final.

## Tecnologías principales

- `next` 16.2.3
- `react` 19.2.4
- `typescript` 5
- `tailwindcss` 4
- `prisma` 7.7.0
- `@prisma/adapter-mariadb`, `mysql2`
- `bcrypt`, `jose`, `resend`

## Estructura relevante del proyecto

- `app/` — rutas del App Router de Next.js
  - `app/page.tsx` — página inicial pública
  - `app/login/page.tsx`, `app/registro/page.tsx` — autenticación
  - `app/dashboard/page.tsx` — panel de usuario principal
  - `app/admin/` — panel administrativo y gestión de recursos
  - `app/sesion/`, `app/nueva-sesion/` — gestión de sesiones
- `components/` — componentes UI reutilizables y específicos
- `actions/` — acciones del lado servidor para login, logout, OTP, etc.
- `lib/` — utilidades y clientes comunes (`auth.ts`, `prisma.ts`, `admin.ts`, `rm.ts`)
- `services/` — lógica de negocio y servicios, como `persona.service.ts`
- `prisma/` — esquema, seed y migraciones de la base de datos
- `public/` — assets estáticos

## Flujo y dominios principales

- Autenticación y sesiones mediante rutas API en `app/api/auth` y `app/api/logout`
- Administración de usuarios, personas, sesiones y ejercicios desde `app/admin`
- Cálculos y validaciones para indicadores ICC/IMC en `helpers/`
- Formularios y tablas enfocados en métricas corporales y datos de usuario

## Pautas para agentes

- Prioriza el uso de rutas `app/` y `components/` al modificar la UI o agregar páginas.
- Respeta el App Router y el uso de archivos `page.tsx` para cada ruta.
- Evita suponer que la aplicación usa el router basado en `pages/`.
- Cuando trabajes con persistencia, inspecciona `prisma/schema.prisma` y `services/`.
- Para cambios en la lógica de autenticación o datos, revisa `lib/auth.ts`, `actions/`, y `app/api/`.

## Sistema de colores y estilos (Tailwind CSS 4)

### Paleta de colores

Definida en `app/globals.css` con variables CSS personalizadas:

**Modo luz:**
- `--bg-main`: #ffffff (fondo principal)
- `--bg-soft`: #f8fafc (fondo suave)
- `--bg-subtle`: #eef2f7 (fondo sutil)
- `--text-primary`: #0f172a (texto principal, negro oscuro)
- `--text-secondary`: #475569 (texto secundario, gris)
- `--text-tertiary`: #64748b (texto terciario, gris claro)
- `--accent`: #22c55e (color de énfasis, verde)
- `--border-subtle`: rgba(15, 23, 42, 0.12) (bordes sutiles)

**Modo oscuro (.dark):**
- `--bg-main`: #0a0a0b (fondo principal, negro puro)
- `--bg-soft`: #111113 (fondo suave, negro oscuro)
- `--bg-subtle`: #161618 (fondo sutil, gris muy oscuro)
- `--text-primary`: #ffffff (texto principal, blanco)
- `--text-secondary`: #a1a1aa (texto secundario, gris claro)
- `--text-tertiary`: #6b7280 (texto terciario, gris)
- `--border-subtle`: rgba(255, 255, 255, 0.06) (bordes sutiles)

### Uso en componentes

Utiliza siempre las clases de color del sistema en lugar de colores hardcodeados:

**Texto:**
- Primario: `text-text-primary` (títulos, contenido principal)
- Secundario: `text-text-secondary` (subtítulos, descripciones)
- Terciario: `text-text-tertiary` (labels, información menor)

**Fondos:**
- Principal: `bg-bg-main` (fondo general de secciones)
- Suave: `bg-bg-soft` (fondos de inputs, cards)
- Sutil: `bg-bg-subtle` (fondos de hover)

**Énfasis:**
- Accent (verde): `text-accent`, `bg-accent`, `border-accent` para elementos interactivos

**Bordes:**
- Usar `border-gray-200 dark:border-white/6` o similar para mantener consistencia

### Ejemplo de componente correcto

```tsx
// ✅ CORRECTO
<div className="rounded-3xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10 dark:bg-bg-main">
  <h2 className="text-lg font-semibold text-text-primary dark:text-white">Título</h2>
  <p className="text-sm text-text-secondary">Descripción</p>
</div>

// ❌ INCORRECTO
<div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
  <h2 className="text-lg font-semibold text-slate-950">Título</h2>
  <p className="text-sm text-slate-600">Descripción</p>
</div>
```

### Notas específicas

- Evita colores hardcodeados como `slate-*`, `blue-*`, `gray-*` en colores de texto/fondo.
- Usa `dark:` para variaciones en modo oscuro.
- Los `border-gray-200 dark:border-white/10` son aceptables para bordes sutiles que complementan el sistema.
- El `accent` (#22c55e) se usa para estados interactivos, buttons primarios, y elementos destacados.

## Notas específicas

- `package.json` ejecuta `prisma generate` en `postinstall`.
- El proyecto usa una base de datos MariaDB/MySQL con Prisma.
- `middleware.ts` y `next.config.ts` pueden contener configuraciones importantes del router y redirecciones.

<!-- END:nextjs-agent-rules -->
