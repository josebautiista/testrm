"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { sendAdminOtp } from "@/app/actions/sendAdminOtp";
import { verifyAdminOtp } from "@/app/actions/verifyAdminOtp";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { resolvePersonaEntry, type EntryState } from "@/actions/persona";

const initialState: EntryState = {
  error: null,
  redirectTo: null,
  submittedCC: "",
};

const sendAdminOtpInitialState = {
  success: false,
  sent: false,
  error: null as string | null,
};

const verifyAdminOtpInitialState = {
  success: false,
  error: null as string | null,
};

export default function HomePage() {
  const router = useRouter();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    resolvePersonaEntry,
    initialState,
  );
  const [sendState, sendAction, isSendingOtp] = useActionState(
    sendAdminOtp,
    sendAdminOtpInitialState,
  );
  const [verifyState, verifyAction, isVerifyingOtp] = useActionState(
    verifyAdminOtp,
    verifyAdminOtpInitialState,
  );

  const adminError = useMemo(
    () => verifyState.error ?? sendState.error,
    [sendState.error, verifyState.error],
  );

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state.redirectTo]);

  return (
    <>
      <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          <header className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Ingreso
            </h1>
            <p className="text-sm text-text-secondary">
              Escribe tu CC para continuar.
            </p>
          </header>

          <form action={formAction} className="space-y-8">
            <Section title="Identificacion">
              <label htmlFor="cc" className="sr-only">
                Numero de identificacion
              </label>
              <input
                id="cc"
                name="cc"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={state.submittedCC}
                className="w-full rounded-xl border border-white/6 bg-bg-soft px-4 py-4 text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-text-tertiary focus:border-white/15"
                placeholder="CC"
                required
              />

              {state.error ? (
                <p className="mt-3 text-sm text-text-secondary">
                  {state.error}
                </p>
              ) : null}
            </Section>

            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "Validando" : "Continuar"}
            </PrimaryButton>
          </form>
        </div>
      </main>

      <button
        type="button"
        aria-label="Abrir acceso admin"
        onClick={() => setIsAdminModalOpen(true)}
        className="fixed bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500/80 opacity-80"
      />

      {isAdminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/6 bg-bg-main p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Admin access
              </h2>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="text-sm text-text-secondary"
              >
                Cerrar
              </button>
            </div>

            {!sendState.sent ? (
              <form action={sendAction} className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Solicita un codigo temporal para acceso admin.
                </p>
                <PrimaryButton type="submit" disabled={isSendingOtp}>
                  {isSendingOtp ? "Enviando" : "Enviar OTP"}
                </PrimaryButton>
              </form>
            ) : (
              <form action={verifyAction} className="space-y-4">
                <label
                  htmlFor="admin-code"
                  className="block text-sm uppercase tracking-wide text-text-secondary"
                >
                  Enter code
                </label>
                <input
                  id="admin-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="w-full rounded-xl border border-white/6 bg-bg-soft px-4 py-4 text-center text-3xl font-semibold tracking-[0.45em] text-white outline-none placeholder:text-text-tertiary focus:border-white/15"
                  placeholder="000000"
                  required
                />
                <PrimaryButton type="submit" disabled={isVerifyingOtp}>
                  {isVerifyingOtp ? "Verificando" : "Verify"}
                </PrimaryButton>
              </form>
            )}

            {adminError ? (
              <p className="mt-3 text-sm text-text-secondary">{adminError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
