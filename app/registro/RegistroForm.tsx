"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createPersonaAction, guardarAtletaCompartidoAction, type RegistroState } from "@/actions/persona";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";

const initialState: RegistroState = {
  error: null,
  redirectTo: null,
};

export type FichaInicial = {
  nombre: string; sexo: string; masaCorporal: number; edad: number; talla: number;
  version: string; vinculado: boolean;
};

export default function RegistroForm({ cc, atleta }: { cc: string; atleta: FichaInicial | null }) {
  const [state, formAction, isPending] = useActionState(
    atleta ? guardarAtletaCompartidoAction : createPersonaAction,
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl items-center justify-center py-6">
      <div className="w-full space-y-8">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            {atleta ? "Ficha del atleta" : "Registro de atleta"}
          </h1>
          <p className="text-sm text-text-secondary">
            {atleta ? "Esta ficha es compartida. Los cambios serán visibles para todos los entrenadores del atleta." : "Completa los datos para registrar al atleta."}
          </p>
        </header>

        <form action={formAction} className="space-y-8">
          {atleta && <input type="hidden" name="version" value={atleta.version} />}
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
                defaultValue={atleta?.nombre}
                type="text"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <Section title="Sexo" className="space-y-2">
              <Select
                name="sexo"
                defaultValue={atleta?.sexo ?? ""}
                ariaLabel="Sexo"
                placeholder="Selecciona una opción"
                options={[
                  { value: "masculino", label: "Masculino" },
                  { value: "femenino", label: "Femenino" },
                ]}
              />
            </Section>

            <Section
              title="Masa corporal (peso)"
              hint={atleta ? "Peso en kilogramos." : "Ingresa kg o libras. Si el valor es mayor que 150, se interpreta como libras."}
              className="space-y-2"
            >
              <input
                id="masaCorporal"
                name="masaCorporal"
                defaultValue={atleta?.masaCorporal}
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
                defaultValue={atleta?.edad}
                type="number"
                min="1"
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>

            <Section
              title="Talla"
              hint={atleta ? "Talla en metros." : "Ingresa metros o centimetros. Si el valor es mayor que 3, se interpreta como centimetros."}
              className="space-y-2"
            >
              <input
                id="talla"
                name="talla"
                defaultValue={atleta?.talla}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-4 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/6 dark:text-white dark:focus:border-white/15"
                required
              />
            </Section>
          </div>

          {state.error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {state.error}
            </p>
          ) : null}

          <PrimaryButton type="submit" name="operacion" value="guardar" disabled={isPending}>
            {isPending ? "Guardando..." : atleta ? (atleta.vinculado ? "Guardar cambios" : "Guardar cambios y añadir") : "Crear usuario"}
          </PrimaryButton>
          {atleta && !atleta.vinculado && (
            <PrimaryButton type="submit" name="operacion" value="vincular" formNoValidate disabled={isPending}>
              Añadir a mis atletas sin modificar
            </PrimaryButton>
          )}
          {atleta?.vinculado && (
            <Link href={`/dashboard?cc=${encodeURIComponent(cc)}`} className="block text-accent underline">
              Abrir panel del atleta sin modificar
            </Link>
          )}
          {state.error && atleta && (
            <a href={`/registro?cc=${encodeURIComponent(cc)}`} className="block text-accent underline">
              Recargar datos actuales
            </a>
          )}
          <Link href="/atletas" className="block text-text-secondary underline">Volver a mis atletas</Link>
        </form>
      </div>
    </main>
  );
}
