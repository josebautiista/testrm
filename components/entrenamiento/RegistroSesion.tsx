"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  completarSesionAction,
  guardarWodAction,
  iniciarOContinuarSesionAction,
  omitirSesionAction,
  registrarSerieAction,
} from "@/actions/ejecucion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { MOTIVOS_OMISION_SESION } from "@/lib/ejecucion";

type EjercicioCatalogo = {
  id: number;
  nombre: string;
};

function generarRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** ADR-49/ADR-50: lo que el entrenador necesita para decidir el WOD de esta sesión. */
export type ContextoSesion = {
  numeroSemana: number;
  tipoMicrociclo: string;
  esDeload: boolean;
  factorVolumen: number;
  factorIntensidad: number;
  objetivoBloqueLabel: string;
  intensidadMinPct: number;
  intensidadMaxPct: number;
  repsMin: number;
  repsMax: number;
  rirObjetivo: number;
  progresionLabel: string;
  seriesMinReferencia: number;
  seriesMaxReferencia: number;
  seriesSemanalesPorPatron: Record<string, number>;
};

function ContextoPanel({ contexto }: { contexto: ContextoSesion }) {
  const entradasSeries = Object.entries(contexto.seriesSemanalesPorPatron).filter(
    ([, series]) => series > 0,
  );

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10">
      <div className="flex items-center">
        <h2 className="text-base font-semibold text-text-primary dark:text-white">
          Contexto para programar el WOD
        </h2>
        <InfoTooltip text="Esto es lo que calcula el mesociclo: tú eliges los ejercicios y escribes el WOD; usa esta zona de %1RM/RIR como referencia de a qué esfuerzo entrenar." />
      </div>
      <p className="text-sm text-text-secondary">
        Semana {contexto.numeroSemana} · {contexto.objetivoBloqueLabel} ·{" "}
        <span className="capitalize">{contexto.tipoMicrociclo}</span>
        {contexto.esDeload ? " (descarga)" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-text-tertiary">%1RM</p>
          <p className="text-sm font-medium text-text-primary dark:text-white">
            {contexto.intensidadMinPct}–{contexto.intensidadMaxPct}%
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">Reps</p>
          <p className="text-sm font-medium text-text-primary dark:text-white">
            {contexto.repsMin}–{contexto.repsMax}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">RIR</p>
          <p className="text-sm font-medium text-text-primary dark:text-white">
            {contexto.rirObjetivo}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">Series/patrón</p>
          <p className="text-sm font-medium text-text-primary dark:text-white">
            {contexto.seriesMinReferencia}–{contexto.seriesMaxReferencia}
          </p>
        </div>
      </div>
      {contexto.esDeload ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Semana de descarga: recorta el volumen (factor ×{contexto.factorVolumen.toFixed(2)}),
          mantén o baja un poco la intensidad (factor ×{contexto.factorIntensidad.toFixed(2)}).
        </p>
      ) : null}
      <p className="text-xs text-text-tertiary">
        Progresión del bloque: {contexto.progresionLabel}
      </p>
      {entradasSeries.length > 0 ? (
        <p className="text-xs text-text-tertiary">
          Series semanales objetivo por patrón:{" "}
          {entradasSeries.map(([patron, series]) => `${patron} (${series})`).join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function WodEditor({
  sesionPlanificadaId,
  cc,
  wodInicial,
}: {
  sesionPlanificadaId: number;
  cc: string;
  wodInicial: string | null;
}) {
  const [wod, setWod] = useState(wodInicial ?? "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const resultado = await guardarWodAction(sesionPlanificadaId, cc, wod);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setGuardado(true);
    });
  }

  return (
    <section className="space-y-2 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10">
      <div className="flex items-center">
        <h2 className="text-base font-semibold text-text-primary dark:text-white">WOD</h2>
        <InfoTooltip text="Escribe aquí los ejercicios de la sesión, en el orden que quieras, con el esquema que decidas (series×reps, carga, AMRAP, EMOM, etc.). Es el registro de lo que se hizo: no hay un registro numérico aparte por serie." />
      </div>
      <textarea
        value={wod}
        onChange={(e) => {
          setWod(e.target.value);
          setGuardado(false);
        }}
        rows={8}
        placeholder="Ej.: A) Sentadilla 5x3 @ 100kg · B) Press militar 4x6 @ 40kg · C) Remo con barra 4x8 @ 50kg"
        className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:bg-bg-subtle dark:text-white"
      />
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-xl border border-transparent bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar WOD"}
        </button>
        {guardado && !isPending ? (
          <span className="text-xs text-accent">Guardado.</span>
        ) : null}
      </div>
    </section>
  );
}

function MarcaPersonalPanel({
  catalogo,
  sesionRealizadaId,
}: {
  catalogo: EjercicioCatalogo[];
  sesionRealizadaId: number | null;
}) {
  const [ejercicioId, setEjercicioId] = useState<number | "">("");
  const [carga, setCarga] = useState("");
  const [reps, setReps] = useState("");
  const [numeroSerie, setNumeroSerie] = useState(1);
  const [resultado, setResultado] = useState<{ e1rmKg: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (catalogo.length === 0) return null;

  function registrar() {
    if (!sesionRealizadaId || ejercicioId === "") return;
    setError(null);
    setResultado(null);

    const cargaNum = Number(carga.replace(",", "."));
    const repsNum = Number(reps);

    if (!Number.isFinite(cargaNum) || cargaNum <= 0 || !Number.isFinite(repsNum) || repsNum <= 0) {
      setError("Peso y repeticiones deben ser números válidos.");
      return;
    }

    startTransition(async () => {
      const resultadoAction = await registrarSerieAction({
        sesionRealizadaId,
        prescripcionId: null,
        ejercicioId,
        numeroSerie,
        cargaKg: cargaNum,
        repeticiones: repsNum,
        rir: null,
        fallo: false,
        requestId: generarRequestId(),
      });

      if (!resultadoAction.ok) {
        setError(resultadoAction.error);
        return;
      }

      setResultado({ e1rmKg: resultadoAction.e1rmKg });
      setNumeroSerie((n) => n + 1);
      setCarga("");
      setReps("");
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10">
      <div className="flex items-center">
        <h2 className="text-base font-semibold text-text-primary dark:text-white">
          Posible marca nueva (opcional)
        </h2>
        <InfoTooltip text="Solo para uno de los 6 ejercicios del catálogo de RM (no para variantes del WOD). Pon el peso y las repeticiones de la serie más pesada o más cercana al fallo que hizo el atleta hoy en ese ejercicio: cuantas menos repeticiones, más precisa la estimación (ideal: entre 1 y 10). Con eso se calcula un posible 1RM (fórmula de Epley) y, si es más alto que el registrado actualmente, se actualiza solo, nunca lo baja. Déjalo vacío si hoy no hizo nada cerca de su máximo." />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 space-y-1 sm:col-span-1">
          <span className="text-xs text-text-secondary">Ejercicio</span>
          <select
            value={ejercicioId}
            onChange={(e) => setEjercicioId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          >
            <option value="">Selecciona…</option>
            {catalogo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Peso (kg)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Repeticiones</span>
          <input
            type="number"
            step="1"
            min="1"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={registrar}
            disabled={isPending || !sesionRealizadaId || ejercicioId === ""}
            className="w-full rounded-xl border border-transparent bg-text-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {isPending ? "..." : "Registrar"}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {resultado ? (
        resultado.e1rmKg !== null ? (
          <p className="text-xs text-accent">
            1RM estimado: ~{resultado.e1rmKg.toFixed(1)} kg. Si es más alto que el RM vigente
            de ese ejercicio, ya se actualizó.
          </p>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Con esas repeticiones no se puede estimar un RM confiable (demasiadas para que la
            fórmula sea precisa). No se actualizó nada, puedes intentarlo con una serie más
            cercana al fallo.
          </p>
        )
      ) : null}
    </section>
  );
}

function OmitirSesionPanel({
  sesionRealizadaId,
  cc,
  onOmitida,
}: {
  sesionRealizadaId: number | null;
  cc: string;
  onOmitida: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivoCodigo, setMotivoCodigo] = useState<string>(MOTIVOS_OMISION_SESION[0].codigo);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-subtle dark:border-white/10 dark:text-text-secondary"
      >
        No se pudo entrenar hoy
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/30">
      <div className="flex items-center">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Marcar sesión como no realizada
        </p>
        <InfoTooltip text="Esto no es un fallo del atleta: el sistema usa esta información para distinguir 'no pudo' de 'no vino'. Si se acumulan varias sesiones omitidas, se te avisará para revisar disponibilidad en vez de bajar la carga a lo tonto." />
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-amber-900 dark:text-amber-200">Motivo</span>
        <select
          value={motivoCodigo}
          onChange={(e) => setMotivoCodigo(e.target.value)}
          className="w-full rounded-xl border border-amber-200 bg-white px-2 py-1.5 text-sm text-text-primary dark:border-amber-500/30 dark:bg-bg-main dark:text-white"
        >
          {MOTIVOS_OMISION_SESION.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-amber-900 dark:text-amber-200">Detalle (opcional)</span>
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-amber-200 bg-white px-2 py-1.5 text-sm text-text-primary dark:border-amber-500/30 dark:bg-bg-main dark:text-white"
        />
      </label>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || !sesionRealizadaId}
          onClick={() => {
            if (!sesionRealizadaId) return;
            setError(null);
            startTransition(async () => {
              const resultado = await omitirSesionAction(
                sesionRealizadaId,
                cc,
                motivoCodigo,
                detalle,
              );
              if (!resultado.ok) {
                setError(resultado.error);
                return;
              }
              onOmitida();
            });
          }}
          className="flex-1 rounded-xl border border-transparent bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl border border-amber-200 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:text-amber-200"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function RegistroSesion({
  cc,
  sesionPlanificadaId,
  wodInicial,
  contexto,
  catalogo,
}: {
  cc: string;
  sesionPlanificadaId: number;
  wodInicial: string | null;
  contexto: ContextoSesion;
  catalogo: EjercicioCatalogo[];
}) {
  const router = useRouter();
  const [sesionRealizadaId, setSesionRealizadaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const [omitida, setOmitida] = useState(false);
  const [rpeSesion, setRpeSesion] = useState("");
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

  function completar(event: FormEvent) {
    event.preventDefault();
    if (!sesionRealizadaId) return;
    setError(null);
    const rpe = rpeSesion.trim() === "" ? null : Number(rpeSesion);
    if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
      setError("El RPE de sesión debe ser un número entre 1 y 10.");
      return;
    }
    startTransition(async () => {
      const resultado = await completarSesionAction(sesionRealizadaId, cc, rpe);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setCompletada(true);
      router.refresh();
    });
  }

  if (omitida) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
        Sesión marcada como no realizada.
        <div className="mt-4">
          <PrimaryButton href={`/dashboard?cc=${encodeURIComponent(cc)}`}>
            Volver al dashboard
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (completada) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
        Sesión completada.
        <div className="mt-4">
          <PrimaryButton href={`/dashboard?cc=${encodeURIComponent(cc)}`}>
            Volver al dashboard
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={completar} className="space-y-4">
      <ContextoPanel contexto={contexto} />

      <WodEditor sesionPlanificadaId={sesionPlanificadaId} cc={cc} wodInicial={wodInicial} />

      <MarcaPersonalPanel catalogo={catalogo} sesionRealizadaId={sesionRealizadaId} />

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <label className="block space-y-1 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10">
        <span className="flex items-center text-sm text-text-secondary">
          RPE de la sesión (opcional)
          <InfoTooltip text="Qué tan dura sintió el atleta la sesión COMPLETA, de 1 (muy suave) a 10 (al límite). Sirve para detectar fatiga acumulada antes de que baje el rendimiento." />
        </span>
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          value={rpeSesion}
          onChange={(e) => setRpeSesion(e.target.value)}
          placeholder="1-10"
          className="w-full max-w-[120px] rounded-xl border border-gray-200 bg-bg-soft px-2 py-1.5 text-sm text-text-primary dark:border-white/10 dark:bg-bg-subtle dark:text-white"
        />
      </label>

      <button
        type="submit"
        disabled={isPending || !sesionRealizadaId}
        className="w-full rounded-xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Completar sesión"}
      </button>

      <OmitirSesionPanel
        sesionRealizadaId={sesionRealizadaId}
        cc={cc}
        onOmitida={() => {
          setOmitida(true);
          router.refresh();
        }}
      />
    </form>
  );
}
