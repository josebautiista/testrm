"use client";

import { use, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createPersonaAction, type RegistroState } from "@/actions/persona";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";

const initialState: RegistroState = {
  error: null,
  redirectTo: null,
};

export default function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const resolvedSearchParams = use(searchParams);
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC : "";

  const [state, formAction, isPending] = useActionState(
    createPersonaAction,
    initialState,
  );

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state.redirectTo]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl items-center justify-center py-6">
      <div className="w-full space-y-8">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            Registro de usuario
          </h1>
          <p className="text-sm text-text-secondary">
            Completa los datos para crear tu perfil.
          </p>
        </header>

        <form action={formAction} className="space-y-8">
          <Section title="Identificacion">
            <input
              id="cc"
              name="cc"
              type="text"
              defaultValue={cc}
              readOnly={Boolean(cc)}
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-3xl font-semibold tracking-tight text-text-primary outline-none placeholder:text-text-tertiary read-only:cursor-default read-only:opacity-80 dark:border-white/6 dark:text-white"
              required
            />
          </Section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Nombre" className="space-y-2 sm:col-span-2">
              <input
                id="nombre"
                name="nombre"
                type="text"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <Section title="Sexo" className="space-y-2">
              <select
                id="sexo"
                name="sexo"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona una opcion
                </option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </Section>

            <Section
              title="Masa corporal"
              hint="Ingresa kg o libras. Si el valor es mayor que 150, se interpreta como libras."
              className="space-y-2"
            >
              <input
                id="masaCorporal"
                name="masaCorporal"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <Section title="Edad" className="space-y-2">
              <input
                id="edad"
                name="edad"
                type="number"
                min="1"
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <Section
              title="Talla"
              hint="Ingresa metros o centimetros. Si el valor es mayor que 3, se interpreta como centimetros."
              className="space-y-2"
            >
              <input
                id="talla"
                name="talla"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-sm text-text-secondary dark:border-white/6">
                <input
                  id="entrenado"
                  name="entrenado"
                  type="checkbox"
                  value="true"
                  className="mt-1 h-4 w-4 rounded border-gray-300 bg-bg-main dark:border-white/10"
                />
                <span>He entrenado por al menos 2 meses</span>
              </label>
            </div>
          </div>

          {state.error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {state.error}
            </p>
          ) : null}

          <PrimaryButton type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Crear usuario"}
          </PrimaryButton>
        </form>
      </div>
    </main>
  );
}
