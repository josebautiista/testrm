"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { resolvePersonaEntry, type EntryState } from "@/actions/persona";

const initialState: EntryState = {
  error: null,
  redirectTo: null,
  submittedCC: "",
};

export default function HomePage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [state, formAction, isPending] = useActionState(
    resolvePersonaEntry,
    initialState,
  );

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state.redirectTo]);

  const displayedCedula = cedula || state.submittedCC;
  const isDisabled = displayedCedula.trim().length === 0 || isPending;

  return (
    <main className="min-h-screen py-10">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            App de fuerza clara
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Mide tu fuerza real en segundos.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Calcula tu peso máximo que puedes levantar una vez (1RM) y
              consigue cargas prácticas para tu próxima sesión.
            </p>
            <p className="text-base leading-7 text-slate-500 dark:text-slate-400">
              El peso máximo que puedes levantar una vez (1RM). Aquí lo
              convertimos en rutinas claras y prácticas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Carga más segura
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Entreno sin adivinar
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              Progreso medible
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              type="submit"
              form="rm-form"
              className="w-full sm:w-auto"
              disabled={isDisabled}
            >
              {isPending ? "Validando" : "Calcular mi repetición máxima (1RM)"}
            </Button>
            <a
              href="#como-funciona"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 sm:w-auto"
            >
              Aprender más
            </a>
          </div>
        </section>

        <aside className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Primer paso
            </p>
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
              Tu repetición máxima (1RM) - sin complicaciones
            </h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              No necesitas saber tu carga exacta. Empieza con un dato simple y
              descubre cuánto peso usar.
            </p>
          </div>

          <form
            id="rm-form"
            action={formAction}
            className="mt-6 space-y-4"
            noValidate
          >
            <label
              htmlFor="cedula"
              className="text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Cédula
            </label>
            <Input
              id="cedula"
              name="cc"
              placeholder="Ingresa tu cédula"
              value={displayedCedula}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCedula(event.target.value)
              }
              autoFocus
              inputMode="numeric"
              autoComplete="off"
            />

            {state.error ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No necesitas saber tu peso máximo exacto ahora. Solo un paso
                simple para comenzar.
              </p>
            )}

            <Button type="submit" disabled={isDisabled}>
              {isPending ? "Validando" : "Calcular mi repetición máxima (1RM)"}
            </Button>
          </form>

          <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              En tu primera vista:
            </p>
            <ul className="mt-3 space-y-2">
              <li>1. Ingresa tu cédula</li>
              <li>2. Revisa tu peso máximo (1RM) y las cargas sugeridas</li>
              <li>3. Usa el plan en tu próximo día de fuerza</li>
            </ul>
          </div>
        </aside>
      </div>

      <section
        id="como-funciona"
        className="mt-10 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300"
      >
        <p className="font-semibold">¿Cómo te ayuda esta app?</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-4 dark:bg-slate-900">
            <p className="font-semibold">Encontrar carga</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Usa tu peso máximo que puedes levantar una vez (1RM) para elegir
              el peso de entrenamiento.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-4 dark:bg-slate-900">
            <p className="font-semibold">Ahorrar tiempo</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Menos pruebas, más entreno sólido.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-4 dark:bg-slate-900">
            <p className="font-semibold">Seguir progreso</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Comparte tu fuerza y ajusta cada semana.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-10 text-center text-xs text-slate-500 dark:text-slate-400">
        Desarrollado por Juan Jose Salazar
      </footer>
    </main>
  );
}
