# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**`docs/PLAN-MAESTRO.md`** is the audited master plan for this codebase's ongoing rewrite (domain defects found, target architecture, exact task order `TASK-001..TASK-056`, migration phases). If you're touching RM calculation, macrociclo periodization, or planning/prescription logic, check it first — it explains *why* things are structured the way they are and what's still pending.

**`docs/DECISIONES.md`** is the ADR log for the domain (which formula is primary and why, RM immutability mechanisms, deload rules, which numeric constants have no documented scientific source yet, auth model). Read it before changing a rule or a constant in `lib/rm/**`, `lib/planificacion/**`, `lib/progresion/**`, or `lib/config/parametros.ts`.

## Commands

```bash
npm run dev          # start dev server (Next.js, Turbopack)
npm run dev:lan       # dev server bound to 0.0.0.0 for LAN access
npm run build         # production build
npm run start         # start production server
npm run lint          # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npm test              # vitest run — unit tests for lib/** plus integration tests that need DATABASE_URL (skipped automatically if unset)
npm run test:e2e      # playwright test — real browser e2e (e2e/**); requires the dev server running on :3000 and DATABASE_URL. Restart the dev server after any `prisma generate` — its long-lived process caches the old Prisma client and silently breaks new queries otherwise.
```

### Database (Prisma + MariaDB/MySQL)

**Migration naming rule:** follow the mandatory SQL migration section in `AGENTS.md` (reference commit `2bb0f845309e0002cf9ced2ce4a816e714772784`). Preserve the exact physical table-name casing from the Prisma schema in every SQL reference, including foreign keys and indexes (`Persona`, not `persona`; `ResultadoEjercicio`, not `resultadoejercicio`). Inspect generated SQL before applying it; success on Windows does not validate case-sensitive deployment databases. Do not rewrite already-applied migrations without explicit coordination.

```bash
npx prisma generate          # regenerate client (also runs automatically via postinstall)
npx prisma migrate dev       # create/apply a migration in development
npx prisma db seed           # run prisma/seed.ts (uses tsx)
npx prisma studio            # inspect data
```

Prisma config lives in `prisma.config.ts` (not `package.json#prisma.seed` alone — that key is legacy/duplicated). `DATABASE_URL` and other secrets are read from `.env` (`JWT_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`).

## Architecture

### Two separate auth systems

- **User auth + roles** (`lib/auth.ts`, `middleware.ts`): a `User` (username/password, bcrypt, `role: "admin" | "entrenador"`) signs in via `app/api/auth/login`, receives a JWT (`jose`, HS256, `JWT_SECRET`, carries `role` as a signed claim) stored in the `auth_token` cookie. `middleware.ts` guards the **whole app** (everything except `/login`, `/api/auth/**`, `/api/logout`), not just `/admin/:path*` (see ADR-25 in `docs/DECISIONES.md`). Only `role: "admin"` may manage `User` accounts — `middleware.ts` redirects non-admins away from `/admin/usuarios`, and `POST/GET/PUT/DELETE /api/users` return 403 for non-admins (ADR-26); any authenticated user (admin or entrenador) can do everything else, including registering atletas.
- **Admin OTP flow** (`app/actions/sendAdminOtp.ts`, `verifyAdminOtp.ts`, `AdminOtp` model): a secondary one-time-code flow gated by `ADMIN_EMAILS`, emailed via Resend. Used for sensitive admin actions distinct from the User/JWT session above.
- **Persona** is a separate concept entirely — it's the person being trained (client), not an authenticated principal. Persona records are looked up/created via `cc` (cédula) and have no password.

**Prisma client convention (changed, TASK-026 in `docs/PLAN-MAESTRO.md`):** new code should import the shared singleton from `lib/prisma.ts` rather than instantiating its own `PrismaMariaDb` adapter + `PrismaClient`. `actions/sesion.ts`, `actions/persona.ts`, `actions/macrociclo.ts`, `services/persona.service.ts`, `services/macrociclo.service.ts`, `services/rm.service.ts`, `services/ejercicio.service.ts` and `app/dashboard/page.tsx` already follow this. A few files have not been migrated yet and still instantiate locally — `app/sesion/[id]/page.tsx`, `app/nueva-sesion/page.tsx`, `app/api/persona/medidas/route.ts`, `app/actions/sendAdminOtp.ts`, `app/actions/verifyAdminOtp.ts` — follow the existing local pattern in those specific files unless you're deliberately migrating them too. One-off scripts (`prisma/seed.ts`, `prisma/backfill-*.ts`) legitimately instantiate their own client since they run outside the Next.js process.

### Domain model: RM → Macrociclo → Mesociclo → Semana

The app's core purpose is exercise-science training periodization, built in layers:

1. **RM (repetición máxima / one-rep max)** — the 8 estimation formulas (Epley, Brzycki, Lombardi, Lander, O'Connor, Mayhew, Wathen, Baechle) live in `lib/rm/formulas.ts`; `lib/rm.ts` re-exports them plus session-level helpers (strength index, `calculateRMForSession`) for backward compatibility. `lib/rm/estimacion.ts` is the primary estimator: `estimarRm()` returns a single point estimate (Epley — never `max()` across formulas), a confidence level, and range validation (repetitions ≥30 are hard-blocked; see `docs/PLAN-MAESTRO.md` D-04). Formulas do **not** differentiate by sex despite the `sexo` parameter (documented gap, see ADR-22). Direct protocols live in `lib/rm/protocolo.ts`. A `Sesion` records one RM-testing session for a `Persona`, with per-exercise `ResultadoEjercicio` rows storing formula outputs plus the primary estimate and confidence (`rm1Estimado`, `confianza`, `fueraDeRango`). `lib/training-flow.ts` gates which RM methods are available by `trainingMonths` (direct protocols require ≥4 months of training history).
   - **`RmVigente`** (`services/rm.service.ts`, `lib/rm/vigente.ts`) is the source of truth for "what is this athlete's current 1RM on this exercise" — one row per (persona, ejercicio) with `validoHasta = null`; a new estimation closes the previous row and opens a new one (append-only, never `UPDATE`s the value in place). This is what makes a later RM change non-retroactive: anything computed from the old value keeps pointing at the closed row. There is intentionally **no single "global RM"** per session/persona — that concept (`Sesion.finalRM`/`estimatedRM` derived via `Math.max` across different exercises) was the app's most severe bug (D-01) and is being phased out; those two `Sesion` columns are now only populated when unambiguous (a single-exercise session, or a Casas/Nacleiro protocol).
2. **Macrociclo** — a training macrocycle for a `Persona`, created via a multi-step wizard (`app/macrociclo/nuevo`, `components/macrociclo/MacrocicloWizard*`). Only one non-closed macrociclo per persona is allowed (see `services/macrociclo.service.ts`). A macrociclo snapshots the persona's RM, anthropometric measurements, and VO2max at creation time (`rmSnapshot`, `medidasSnapshot`, `vo2maxSnapshot` JSON columns) so historical plans stay stable even if the source data later changes.
3. **Periodización** (`lib/macrociclo-periodizacion.ts`) — splits the macrociclo's date range into `MacrocicloPeriodo` (preparatorio/competitivo) → `MacrocicloEtapa` (general/especifica/precompetitiva/competitiva) → `MacrocicloMesociclo` (entrante/desarrollador/estabilizador/choque/competencia/etc.) by percentage weighting, then into weekly `MacrocicloSemana` rows with computed volume/intensity per `tipoMicrociclo`.
4. **Mesociclo carga** (`lib/mesociclo-carga.ts`, `MesocicloCarga` model) — per-mesociclo training-load configuration: session duration, training "directions" (`direcciones`), and nested percentage distributions across microciclos and sessions that must each sum to 100 (`volumen`, `microciclos`, `sesiones` JSON columns).
5. **Semana ejercicios** — `MacrocicloSemanaEjercicio` links a specific exercise to a week with the RM formula used, computed RM, target weight, and volume, feeding the weekly training prescription shown in the UI.

`actions/macrociclo.ts`, `actions/persona.ts`, `actions/sesion.ts` are the server actions orchestrating this; `services/macrociclo.service.ts` and `services/persona.service.ts` hold the shared business logic/queries they call into. All macrociclo state changes are recorded to `MacrocicloAuditLog` (before/after JSON, actor type persona vs admin).

### Anthropometric PDF import

`lib/pdf-antropometria.ts` (largest lib file) parses uploaded anthropometry report PDFs (via `pdfjs-dist`) to extract body measurements used to prefill `Persona`/`Macrociclo` measurement snapshots — see `procesarPdfAntropometriaAction` in `actions/macrociclo.ts`.

### Route structure

- `app/(public)` — `app/page.tsx`, `app/login`, `app/registro`: public/auth entry points.
- `app/dashboard`, `app/macrociclo/**`, `app/sesion/**`, `app/nueva-sesion`: persona-facing flows (RM sessions, macrociclo wizard/detail/edit).
- `app/admin/**`: JWT-protected admin panel (personas, sesiones, macrociclos, ejercicios, usuarios) — protected globally by `middleware.ts`, not per-route.
- `app/api/**`: route handlers for login/logout and a couple of REST-ish endpoints (`persona/medidas`, `users/[id]`); most mutations otherwise go through server actions in `actions/` and `app/actions/`, not API routes.
