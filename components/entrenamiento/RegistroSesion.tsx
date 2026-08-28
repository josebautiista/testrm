"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  completarSesionAction,
  iniciarOContinuarSesionAction,
  registrarSerieAction,
} from "@/actions/ejecucion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type Prescripcion = {
  id: number;
  orden: number;
  ejercicioId: number;
  ejercicioNombre: string;
  esDeTiempo: boolean;
  series: number;
  repeticionesObjetivo: number;
  cargaKg: number | null;
  rirObjetivo: number;
};

type SerieRegistrada = {
  numeroSerie: number;
  cargaKg: number;
  repeticiones: number;
  rir: number | null;
  e1rmKg: number | null;
};

function generarRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function EjercicioBloque({
  prescripcion,
  sesionRealizadaId,
  onSerieRegistrada,
  registradas,
}: {
  prescripcion: Prescripcion;
  sesionRealizadaId: number | null;
  onSerieRegistrada: (ejercicioId: number, serie: SerieRegistrada) => void;
  registradas: SerieRegistrada[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const siguienteSerie = registradas.length + 1;
  const [carga, setCarga] = useState(String(prescripcion.cargaKg ?? ""));
  const [reps, setReps] = useState(String(prescripcion.repeticionesObjetivo));
  const [rir, setRir] = useState(String(prescripcion.rirObjetivo));

  function registrar() {
    if (!sesionRealizadaId) return;
    setError(null);

    const cargaNum = Number(carga.replace(",", "."));
    const repsNum = Number(reps);
    const rirNum = rir.trim() === "" ? null : Number(rir);

    if (!Number.isFinite(cargaNum) || cargaNum < 0 || !Number.isFinite(repsNum) || repsNum <= 0) {
      setError("Carga y repeticiones deben ser números válidos.");
      return;
    }

    startTransition(async () => {
      const resultado = await registrarSerieAction({
        sesionRealizadaId,
        prescripcionId: prescripcion.id,
        ejercicioId: prescripcion.ejercicioId,
        numeroSerie: siguienteSerie,
        cargaKg: cargaNum,
        repeticiones: repsNum,
        rir: rirNum,
        fallo: false,
        requestId: generarRequestId(),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onSerieRegistrada(prescripcion.ejercicioId, {
        numeroSerie: siguienteSerie,
        cargaKg: cargaNum,
        repeticiones: repsNum,
        rir: rirNum,
        e1rmKg: resultado.e1rmKg,
      });
    });
  }

  const completo = registradas.length >= prescripcion.series;

  return (
    <article className="space-y-3 rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-text-primary dark:text-white">
          {prescripcion.ejercicioNombre}
        </h3>
        <p className="text-xs text-text-tertiary">
          {registradas.length}/{prescripcion.series} series ·{" "}
          {prescripcion.esDeTiempo
            ? `${prescripcion.repeticionesObjetivo} reps objetivo`
            : `${prescripcion.repeticionesObjetivo} reps @ ${
                prescripcion.cargaKg !== null ? `${prescripcion.cargaKg} kg` : "sin RM"
              } · RIR ${prescripcion.rirObjetivo}`}
        </p>
      </div>

      {registradas.length > 0 ? (
        <div className="space-y-1">
          {registradas.map((s) => (
            <p key={s.numeroSerie} className="text-xs text-text-secondary">
              Serie {s.numeroSerie}: {s.repeticiones} reps @ {s.cargaKg} kg
              {s.rir !== null ? ` · RIR ${s.rir}` : ""}
              {s.e1rmKg !== null ? ` · e1RM ${s.e1rmKg.toFixed(1)} kg` : ""}
            </p>
          ))}
        </div>
      ) : null}

      {!completo ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Carga (kg)</span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={carga}
              onChange={(e) => setCarga(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg-main px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Reps</span>
            <input
              type="number"
              step="1"
              min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg-main px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">RIR</span>
            <input
              type="number"
              step="1"
              min="0"
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg-main px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={registrar}
              disabled={isPending || !sesionRealizadaId}
              className="w-full rounded-xl border border-transparent bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "..." : `Serie ${siguienteSerie}`}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Ejercicio completo.
        </p>
      )}

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </article>
  );
}

export function RegistroSesion({
  cc,
  sesionPlanificadaId,
  prescripciones,
}: {
  cc: string;
  sesionPlanificadaId: number;
  prescripciones: Prescripcion[];
}) {
  const router = useRouter();
  const [sesionRealizadaId, setSesionRealizadaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const [registradasPorEjercicio, setRegistradasPorEjercicio] = useState<
    Record<number, SerieRegistrada[]>
  >({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    iniciarOContinuarSesionAction(sesionPlanificadaId).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setSesionRealizadaId(resultado.sesionRealizadaId);
    });
    return () => {
      cancelado = true;
    };
  }, [sesionPlanificadaId]);

  function onSerieRegistrada(ejercicioId: number, serie: SerieRegistrada) {
    setRegistradasPorEjercicio((prev) => ({
      ...prev,
      [ejercicioId]: [...(prev[ejercicioId] ?? []), serie],
    }));
  }

  const totalSeries = prescripciones.reduce((sum, p) => sum + p.series, 0);
  const totalRegistradas = Object.values(registradasPorEjercicio).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  function completar() {
    if (!sesionRealizadaId) return;
    setError(null);
    startTransition(async () => {
      const resultado = await completarSesionAction(sesionRealizadaId, cc);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setCompletada(true);
      router.refresh();
    });
  }

  if (completada) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
        Sesión completada. {totalRegistradas} de {totalSeries} series registradas.
        <div className="mt-4">
          <PrimaryButton href={`/dashboard?cc=${encodeURIComponent(cc)}`}>
            Volver al dashboard
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-sm text-text-secondary dark:border-white/10">
        {totalRegistradas}/{totalSeries} series registradas
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {prescripciones.map((p) => (
        <EjercicioBloque
          key={p.id}
          prescripcion={p}
          sesionRealizadaId={sesionRealizadaId}
          registradas={registradasPorEjercicio[p.ejercicioId] ?? []}
          onSerieRegistrada={onSerieRegistrada}
        />
      ))}

      <button
        type="button"
        onClick={completar}
        disabled={isPending || !sesionRealizadaId}
        className="w-full rounded-xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Completar sesión"}
      </button>
    </div>
  );
}
