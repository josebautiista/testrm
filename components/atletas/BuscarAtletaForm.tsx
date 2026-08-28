"use client";

import { useActionState, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resolvePersonaEntry, type EntryState } from "@/actions/persona";

const initialState: EntryState = {
  error: null,
  redirectTo: null,
  submittedCC: "",
};

export function BuscarAtletaForm() {
  const [cedula, setCedula] = useState("");
  const [state, formAction, isPending] = useActionState(
    resolvePersonaEntry,
    initialState,
  );

  const displayedCedula = cedula || state.submittedCC;
  const isDisabled = displayedCedula.trim().length === 0 || isPending;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      noValidate
    >
      <div className="flex-1">
        <Input
          name="cc"
          placeholder="Cédula del atleta"
          value={displayedCedula}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setCedula(event.target.value)
          }
          inputMode="numeric"
          autoComplete="off"
          aria-label="Cédula del atleta"
          className="py-3"
        />
        {state.error ? (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isDisabled} className="sm:w-auto">
        {isPending ? "Buscando..." : "Buscar o registrar"}
      </Button>
    </form>
  );
}
