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
    <main
      className={[
        "-mx-4 -my-6 flex min-h-screen justify-center px-5 pb-24 pt-5 text-gray-900 transition-colors duration-300 dark:text-white",
      ].join(" ")}
    >
      <div className="flex w-full max-w-sm flex-col">
        <header className="h-10" aria-hidden="true" />

        <section className="flex flex-1 items-center">
          <div className="w-full p-6">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
              Test de RM
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-text-secondary">
              La repeticion maxima ayuda a medir tu fuerza y definir cargas de
              entrenamiento con precision.
            </p>

            <form action={formAction} className="mt-7 space-y-4" noValidate>
              <label htmlFor="cedula" className="sr-only">
                Cedula
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
                <p className="text-sm text-gray-600 dark:text-text-secondary">
                  {state.error}
                </p>
              ) : null}

              <Button type="submit" disabled={isDisabled}>
                {isPending ? "Validando" : "Continuar"}
              </Button>
            </form>
          </div>
        </section>
      </div>

      <footer
        className={[
          "fixed inset-x-0 bottom-5 text-center text-xs",
          "text-gray-500 dark:text-text-tertiary",
        ].join(" ")}
      >
        Desarrollado por Juan Jose Salazar
      </footer>
    </main>
  );
}
