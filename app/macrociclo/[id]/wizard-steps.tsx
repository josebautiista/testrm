"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  type ObjetivoTipo,
  type TipoEtapa,
  type TipoMesociclo,
  type TipoMicrociclo,
  type TipoPeriodo,
  type Vo2maxSnapshot,
  ETAPAS_POR_PERIODO,
  MESES_POR_ETAPA_LABEL,
  MESES_POR_TIPO_LABEL,
  ORDEN_MESES,
  TIPOS_MICROCICLO,
  TIPOS_PERIODO,
  calcularVo2maxLeger,
  toISODate,
  velocidadLegerKmh,
} from "@/lib/macrociclo";
import { calcularPeriodizacion } from "@/lib/macrociclo-periodizacion";
import {
  guardarRmAction,
  guardarVo2maxAction,
  guardarPeriodizacionAction,
  guardarPeriodizacionSinRedirectAction,
  activarMacrocicloAction,
} from "@/actions/macrociclo";

type SesionRm = {
  id: number;
  createdAt: Date;
  peso: number | null;
  estimatedRM: number | null;
  finalRM: number | null;
  resultados: Array<{
    ejercicioId: number;
    ejercicio: { nombre: string };
    repeticiones: number;
    carga: number;
    epley: number;
  }>;
};

export function PasoRm({
  cc,
  macrocicloId,
  sesionesRm,
  sesionRmId,
  setSesionRmId,
  onGuardar,
}: {
  cc: string;
  macrocicloId: number;
  sesionesRm: SesionRm[];
  sesionRmId: number | "";
  setSesionRmId: (value: number | "") => void;
  onGuardar: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    await guardarRmAction(formData);
    setPending(false);
    onGuardar();
  }

  const sugerida = sesionesRm[0];

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="sesionRmId" value={sesionRmId} />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Sesión RM
        </h2>
        <p className="text-sm text-text-secondary">
          Selecciona una sesión RM existente o realiza una nueva evaluación.
        </p>
      </div>

      {sugerida ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-text-primary dark:text-white">
            Sesión sugerida
          </p>
          <p className="text-sm text-text-secondary">
            {new Intl.DateTimeFormat("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(sugerida.createdAt)}{" "}
            · {sugerida.resultados.length} ejercicios
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {sesionesRm.map((sesion) => (
          <label
            key={sesion.id}
            className={[
              "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition",
              sesionRmId === sesion.id
                ? "border-accent bg-accent/5"
                : "border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle",
            ].join(" ")}
          >
            <input
              type="radio"
              name="sesionRmOption"
              checked={sesionRmId === sesion.id}
              onChange={() => setSesionRmId(sesion.id)}
              className="h-4 w-4 accent-accent"
            />
            <div>
              <p className="font-medium text-text-primary dark:text-white">
                Sesión #{sesion.id}
              </p>
              <p className="text-sm text-text-secondary">
                {new Intl.DateTimeFormat("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(sesion.createdAt)}{" "}
                · {sesion.resultados.length} ejercicios
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <PrimaryButton type="submit" disabled={pending || !sesionRmId}>
          {pending ? "Guardando..." : "Usar sesión seleccionada"}
        </PrimaryButton>

        <a
          href={`/nueva-sesion?cc=${encodeURIComponent(cc)}&macrocicloId=${macrocicloId}&returnTo=macrociclo`}
          className="block w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-center text-sm font-medium text-text-secondary transition hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-subtle dark:text-text-secondary"
        >
          Realizar nueva sesión RM
        </a>
      </div>
    </form>
  );
}

export function PasoVo2max({
  cc,
  macrocicloId,
  metodo,
  setMetodo,
  cooperDistancia,
  setCooperDistancia,
  directo,
  setDirecto,
  legerEtapa,
  setLegerEtapa,
  onGuardar,
}: {
  cc: string;
  macrocicloId: number;
  metodo: string;
  setMetodo: (value: string) => void;
  cooperDistancia: string;
  setCooperDistancia: (value: string) => void;
  directo: string;
  setDirecto: (value: string) => void;
  legerEtapa: string;
  setLegerEtapa: (value: string) => void;
  onGuardar: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    await guardarVo2maxAction(formData);
    setPending(false);
    onGuardar();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="metodo" value={metodo} />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          VO2Max
        </h2>
        <p className="text-sm text-text-secondary">
          Registra el método de evaluación de capacidad aeróbica.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {["cooper", "directo", "leger"].map((m) => (
          <label
            key={m}
            className={[
              "cursor-pointer rounded-2xl border p-4 text-center transition",
              metodo === m
                ? "border-accent bg-accent/5"
                : "border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle",
            ].join(" ")}
          >
            <input
              type="radio"
              name="metodoOption"
              value={m}
              checked={metodo === m}
              onChange={(e) => setMetodo(e.target.value)}
              className="sr-only"
            />
            <span className="font-medium capitalize text-text-primary dark:text-white">
              {m === "leger" ? "Léger" : m}
            </span>
          </label>
        ))}
      </div>

      {metodo === "cooper" ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Distancia en metros
          </span>
          <input
            type="number"
            name="distanciaMetros"
            value={cooperDistancia}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setCooperDistancia(e.target.value)}
            required
            min="0"
            step="1"
            className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>
      ) : metodo === "directo" ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            VO2Max relativo (ml/kg/min)
          </span>
          <input
            type="number"
            name="valor"
            value={directo}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setDirecto(e.target.value)}
            required
            min="0"
            step="0.01"
            className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              Etapa (palier) alcanzada
            </span>
            <input
              type="number"
              name="etapa"
              value={legerEtapa}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => setLegerEtapa(e.target.value)}
              required
              min="1"
              step="1"
              className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            />
          </label>

          {Number(legerEtapa) >= 1 ? (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm font-medium text-text-primary dark:text-white">
                Resultados estimados
              </p>
              <p className="text-sm text-text-secondary">
                Velocidad final:{" "}
                {velocidadLegerKmh(Number(legerEtapa)).toFixed(1)} km/h
              </p>
              <p className="text-sm text-text-secondary">
                VO2Max estimado:{" "}
                {calcularVo2maxLeger(Number(legerEtapa)).toFixed(2)} ml/kg/min
              </p>
            </div>
          ) : null}
        </div>
      )}

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar VO2Max"}
      </PrimaryButton>
    </form>
  );
}

export function PasoPeriodos({
  periodos,
  setPeriodos,
  onContinuar,
}: {
  periodos: Record<TipoPeriodo, number | "">;
  setPeriodos: (value: Record<TipoPeriodo, number | "">) => void;
  onContinuar: () => void;
}) {
  const total = TIPOS_PERIODO.reduce((sum, p) => sum + (periodos[p.value] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Periodos
        </h2>
        <p className="text-sm text-text-secondary">
          Define el porcentaje del periodo preparatorio y competitivo. Deben sumar
          100%.
        </p>
      </div>

      <div className="space-y-4">
        {TIPOS_PERIODO.map((p) => (
          <label key={p.value} className="block space-y-2">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              {p.label}
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={periodos[p.value]}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) =>
                setPeriodos({
                  ...periodos,
                  [p.value]: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            />
          </label>
        ))}
      </div>

      <div
        className={[
          "rounded-2xl px-4 py-3 text-sm font-medium",
          total === 100
            ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-200"
            : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200",
        ].join(" ")}
      >
        Total: {total.toFixed(1)}%{" "}
        {total === 100 ? "✓ Correcto" : `Faltan ${(100 - total).toFixed(1)}%`}
      </div>

      <PrimaryButton
        type="button"
        onClick={onContinuar}
        disabled={total !== 100}
      >
        Continuar
      </PrimaryButton>
    </div>
  );
}

export function PasoEtapas({
  etapas,
  setEtapas,
  onContinuar,
}: {
  etapas: Record<TipoPeriodo, Record<TipoEtapa, number | "">>;
  setEtapas: (value: Record<TipoPeriodo, Record<TipoEtapa, number | "">>) => void;
  onContinuar: () => void;
}) {
  const totales = useMemo(() => {
    return TIPOS_PERIODO.map((p) => ({
      tipo: p.value,
      total: ETAPAS_POR_PERIODO[p.value].reduce(
        (sum, e) => sum + (etapas[p.value][e] || 0),
        0,
      ),
    }));
  }, [etapas]);

  const valido = totales.every((t) => t.total === 100);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Etapas
        </h2>
        <p className="text-sm text-text-secondary">
          Distribuye cada periodo en sus etapas. Cada periodo debe sumar 100%.
        </p>
      </div>

      {TIPOS_PERIODO.map((p) => {
        const total = totales.find((t) => t.tipo === p.value)?.total ?? 0;
        return (
          <section key={p.value} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
              {p.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ETAPAS_POR_PERIODO[p.value].map((etapa) => (
                <label key={etapa} className="block space-y-2">
                  <span className="text-sm font-medium text-text-primary dark:text-white capitalize">
                    {etapa}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={etapas[p.value][etapa]}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      setEtapas({
                        ...etapas,
                        [p.value]: {
                          ...etapas[p.value],
                          [etapa]: e.target.value === "" ? "" : Number(e.target.value),
                        },
                      })
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
                  />
                </label>
              ))}
            </div>
            <p
              className={[
                "text-sm font-medium",
                total === 100 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400",
              ].join(" ")}
            >
              Total {p.label.toLowerCase()}: {total.toFixed(1)}%
            </p>
          </section>
        );
      })}

      <PrimaryButton type="button" onClick={onContinuar} disabled={!valido}>
        Continuar
      </PrimaryButton>
    </div>
  );
}

export function PasoMesociclos({
  mesociclos,
  setMesociclos,
  onContinuar,
}: {
  mesociclos: Record<TipoMesociclo, number | "">;
  setMesociclos: (value: Record<TipoMesociclo, number | "">) => void;
  onContinuar: () => void;
}) {
  const total = ORDEN_MESES.reduce((sum, m) => sum + (mesociclos[m] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Mesociclos
        </h2>
        <p className="text-sm text-text-secondary">
          Asigna el porcentaje de duración a cada mesociclo. La suma debe ser
          100%.
        </p>
      </div>

      <div className="space-y-4">
        {ORDEN_MESES.map((tipo) => (
          <label key={tipo} className="block space-y-2">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              {MESES_POR_TIPO_LABEL[tipo]}
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={mesociclos[tipo]}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) =>
                setMesociclos({
                  ...mesociclos,
                  [tipo]: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            />
          </label>
        ))}
      </div>

      <div
        className={[
          "rounded-2xl px-4 py-3 text-sm font-medium",
          total === 100
            ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-200"
            : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200",
        ].join(" ")}
      >
        Total: {total.toFixed(1)}%{" "}
        {total === 100 ? "✓ Correcto" : `Faltan ${(100 - total).toFixed(1)}%`}
      </div>

      <PrimaryButton type="button" onClick={onContinuar} disabled={total !== 100}>
        Continuar
      </PrimaryButton>
    </div>
  );
}

export function PasoSemanas({
  cc,
  macrocicloId,
  fechaInicio,
  fechaFin,
  periodos,
  etapasPorPeriodo,
  mesociclos,
  semanasConfig,
  setSemanasConfig,
  semanasSeleccionadas,
  setSemanasSeleccionadas,
  buildPeriodizacionPayload,
  onContinuar,
}: {
  cc: string;
  macrocicloId: number;
  fechaInicio: Date;
  fechaFin: Date;
  periodos: { tipo: TipoPeriodo; porcentaje: number | "" }[];
  etapasPorPeriodo: Record<TipoPeriodo, { tipo: TipoEtapa; porcentaje: number | "" }[]>;
  mesociclos: { tipo: TipoMesociclo; porcentaje: number | "" }[];
  semanasConfig: Record<
    number,
    {
      tipoMicrociclo: TipoMicrociclo;
      frecuencia: number | "";
      volumen: number | "";
      intensidad: number | "";
    }
  >;
  setSemanasConfig: (
    value: Record<
      number,
      {
        tipoMicrociclo: TipoMicrociclo;
        frecuencia: number | "";
        volumen: number | "";
        intensidad: number | "";
      }
    >,
  ) => void;
  semanasSeleccionadas: number[];
  setSemanasSeleccionadas: (value: number[]) => void;
  buildPeriodizacionPayload: () => {
    periodos: { tipo: TipoPeriodo; porcentaje: number }[];
    etapasPorPeriodo: Record<TipoPeriodo, { tipo: TipoEtapa; porcentaje: number }[]>;
    mesociclos: { tipo: TipoMesociclo; porcentaje: number }[];
    semanas: {
      numeroSemana: number;
      tipoMicrociclo: TipoMicrociclo;
      frecuencia: number;
      volumen: number;
      intensidad: number;
    }[];
  };
  onContinuar: () => void;
}) {
  const calculado = useMemo(() => {
    return calcularPeriodizacion({
      fechaInicio,
      fechaFin,
      periodos: periodos.map((p) => ({ ...p, porcentaje: Number(p.porcentaje) })),
      etapasPorPeriodo: {
        preparatorio: etapasPorPeriodo.preparatorio.map((e) => ({
          ...e,
          porcentaje: Number(e.porcentaje),
        })),
        competitivo: etapasPorPeriodo.competitivo.map((e) => ({
          ...e,
          porcentaje: Number(e.porcentaje),
        })),
      },
      mesociclos: mesociclos.map((m) => ({ ...m, porcentaje: Number(m.porcentaje) })),
    });
  }, [fechaInicio, fechaFin, periodos, etapasPorPeriodo, mesociclos]);

  const payload = buildPeriodizacionPayload();

  const numerosSemanas = calculado.semanas.map((s) => s.numeroSemana);
  const seleccionadasActuales = semanasSeleccionadas.filter((n) =>
    numerosSemanas.includes(n),
  );
  const todasSeleccionadas =
    numerosSemanas.length > 0 &&
    seleccionadasActuales.length === numerosSemanas.length;

  function toggleSemana(numero: number) {
    setSemanasSeleccionadas(
      semanasSeleccionadas.includes(numero)
        ? semanasSeleccionadas.filter((n) => n !== numero)
        : [...semanasSeleccionadas, numero],
    );
  }

  function toggleTodas() {
    setSemanasSeleccionadas(todasSeleccionadas ? [] : numerosSemanas);
  }

  function updateSemana(
    numero: number,
    field: keyof (typeof semanasConfig)[number],
    value: string,
  ) {
    const parsed =
      field === "tipoMicrociclo" ? value : value === "" ? "" : Number(value);

    // Si la semana editada está seleccionada, el cambio se propaga a todas
    // las semanas seleccionadas; si no, solo se modifica ella.
    const objetivos = semanasSeleccionadas.includes(numero)
      ? seleccionadasActuales
      : [numero];

    let next = semanasConfig;
    for (const n of objetivos) {
      const current = next[n] ?? {
        tipoMicrociclo: "corriente",
        frecuencia: 0,
        volumen: 0,
        intensidad: 0,
      };
      next = {
        ...next,
        [n]: {
          ...current,
          [field]: parsed,
        },
      };
    }
    setSemanasConfig(next);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Microciclos semanales
        </h2>
        <p className="text-sm text-text-secondary">
          Configura cada semana del macrociclo. Selecciona varias semanas para
          editarlas en grupo.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 dark:border-white/10 dark:bg-bg-main">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={todasSeleccionadas}
            onChange={toggleTodas}
            className="h-4 w-4 accent-accent"
          />
          Seleccionar todas
        </label>
        <p className="text-xs text-text-secondary">
          {seleccionadasActuales.length > 0
            ? `${seleccionadasActuales.length} seleccionada${
                seleccionadasActuales.length === 1 ? "" : "s"
              }: los cambios se aplican a todas las seleccionadas`
            : "Ninguna semana seleccionada"}
        </p>
      </div>

      <div className="space-y-4">
        {calculado.semanas.map((semana) => {
          const config = semanasConfig[semana.numeroSemana] ?? {
            tipoMicrociclo: "corriente" as TipoMicrociclo,
            frecuencia: 0,
            volumen: 0,
            intensidad: 0,
          };
          const seleccionada = semanasSeleccionadas.includes(
            semana.numeroSemana,
          );
          return (
            <div
              key={semana.numeroSemana}
              className={[
                "rounded-2xl border p-4 transition",
                seleccionada
                  ? "border-accent bg-accent/5 dark:border-accent dark:bg-accent/10"
                  : "border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle",
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={seleccionada}
                    onChange={() => toggleSemana(semana.numeroSemana)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="font-medium text-text-primary dark:text-white">
                    Semana {semana.numeroSemana}
                  </span>
                </label>
                <p className="text-xs text-text-secondary">
                  {toISODate(semana.fechaInicio)} - {toISODate(semana.fechaFin)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="block space-y-1">
                  <span className="text-xs text-text-secondary">Tipo</span>
                  <SearchableSelect
                    value={config.tipoMicrociclo}
                    options={TIPOS_MICROCICLO}
                    onChange={(value) =>
                      updateSemana(semana.numeroSemana, "tipoMicrociclo", value)
                    }
                    ariaLabel={`Tipo de microciclo de la semana ${semana.numeroSemana}`}
                  />
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-text-secondary">Frecuencia</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.frecuencia}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updateSemana(semana.numeroSemana, "frecuencia", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none dark:border-white/10 dark:bg-bg-main dark:text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-text-secondary">Volumen (kg)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.volumen}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updateSemana(semana.numeroSemana, "volumen", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none dark:border-white/10 dark:bg-bg-main dark:text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-text-secondary">Intensidad (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={config.intensidad}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updateSemana(semana.numeroSemana, "intensidad", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none dark:border-white/10 dark:bg-bg-main dark:text-white"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <form
        action={async (formData) => {
          const result = await guardarPeriodizacionSinRedirectAction(formData);
          if (result.success) {
            onContinuar();
          } else {
            alert(result.error);
          }
        }}
        className="space-y-3"
      >
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        <input type="hidden" name="periodos" value={JSON.stringify(payload.periodos)} />
        <input type="hidden" name="etapas" value={JSON.stringify(payload.etapasPorPeriodo)} />
        <input
          type="hidden"
          name="mesociclos"
          value={JSON.stringify(payload.mesociclos)}
        />
        <input type="hidden" name="semanas" value={JSON.stringify(payload.semanas)} />

        <PrimaryButton type="submit">Guardar periodización y continuar</PrimaryButton>
      </form>
    </div>
  );
}

function describirVo2max(
  vo2max: Vo2maxSnapshot | null,
): { metodo: string; detalles: string[] } | null {
  if (!vo2max) return null;
  switch (vo2max.metodo) {
    case "cooper":
      return {
        metodo: "Cooper",
        detalles: [
          `Distancia: ${vo2max.distanciaMetros} m`,
          `VO2Max: ${vo2max.valor.toFixed(2)} ml/kg/min`,
        ],
      };
    case "directo":
      return {
        metodo: "Directo",
        detalles: [`VO2Max: ${vo2max.valor.toFixed(2)} ml/kg/min`],
      };
    case "leger":
      return {
        metodo: "Léger",
        detalles: [
          `Etapa (palier): ${vo2max.etapa}`,
          `Velocidad final: ${vo2max.velocidadKmh.toFixed(1)} km/h`,
          `VO2Max: ${vo2max.valor.toFixed(2)} ml/kg/min`,
        ],
      };
    default:
      return {
        metodo: String((vo2max as { metodo?: unknown }).metodo ?? ""),
        detalles: [],
      };
  }
}

export function PasoRevision({
  cc,
  macrocicloId,
  objetivoTipo,
  fechaInicio,
  fechaFin,
  sesionRmId,
  vo2maxSnapshot,
  buildPeriodizacionPayload,
}: {
  cc: string;
  macrocicloId: number;
  objetivoTipo: ObjetivoTipo;
  fechaInicio: string;
  fechaFin: string;
  sesionRmId: number | "";
  vo2maxSnapshot: Vo2maxSnapshot | null;
  buildPeriodizacionPayload: () => {
    periodos: { tipo: TipoPeriodo; porcentaje: number }[];
    etapasPorPeriodo: Record<TipoPeriodo, { tipo: TipoEtapa; porcentaje: number }[]>;
    mesociclos: { tipo: TipoMesociclo; porcentaje: number }[];
    semanas: {
      numeroSemana: number;
      tipoMicrociclo: TipoMicrociclo;
      frecuencia: number;
      volumen: number;
      intensidad: number;
    }[];
  };
}) {
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error") ?? "";
  const payload = buildPeriodizacionPayload();
  const vo2maxInfo = describirVo2max(vo2maxSnapshot);

  async function handleGuardarPeriodizacion(formData: FormData) {
    setPending(true);
    await guardarPeriodizacionAction(formData);
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Revisión y activación
        </h2>
        <p className="text-sm text-text-secondary">
          Revisa la información antes de activar el macrociclo.
        </p>
      </div>

      {urlError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
          {urlError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">Objetivo</p>
        <p className="font-medium capitalize text-text-primary dark:text-white">
          {objetivoTipo}
        </p>
        <p className="mt-2 text-sm text-text-secondary">Rango</p>
        <p className="font-medium text-text-primary dark:text-white">
          {fechaInicio} - {fechaFin}
        </p>
        <p className="mt-2 text-sm text-text-secondary">Sesión RM</p>
        <p className="font-medium text-text-primary dark:text-white">
          {sesionRmId ? `Sesión #${sesionRmId}` : "Sin asignar"}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">VO2Max</p>
        {vo2maxInfo ? (
          <div className="mt-1 space-y-0.5">
            <p className="font-medium text-text-primary dark:text-white">
              {vo2maxInfo.metodo}
            </p>
            {vo2maxInfo.detalles.map((detalle) => (
              <p key={detalle} className="text-sm text-text-secondary">
                {detalle}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1 font-medium text-text-primary dark:text-white">
            Sin registrar
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">Periodos y etapas</p>
        <div className="mt-2 space-y-3">
          {payload.periodos.map((periodo) => (
            <div key={periodo.tipo}>
              <p className="font-medium text-text-primary dark:text-white">
                {TIPOS_PERIODO.find((t) => t.value === periodo.tipo)?.label ??
                  periodo.tipo}
                : {periodo.porcentaje}%
              </p>
              <ul className="mt-1 space-y-0.5">
                {payload.etapasPorPeriodo[periodo.tipo].map((etapa) => (
                  <li
                    key={etapa.tipo}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-text-secondary">
                      {MESES_POR_ETAPA_LABEL[etapa.tipo]}
                    </span>
                    <span className="font-medium text-text-primary dark:text-white">
                      {etapa.porcentaje}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">Mesociclos</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {payload.mesociclos.map((mesociclo) => (
            <li
              key={mesociclo.tipo}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-text-secondary">
                {MESES_POR_TIPO_LABEL[mesociclo.tipo]}
              </span>
              <span className="font-medium text-text-primary dark:text-white">
                {mesociclo.porcentaje}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">
          Semanas ({payload.semanas.length})
        </p>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-tertiary">
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Tipo</th>
                <th className="py-1 pr-2 font-medium">Frec.</th>
                <th className="py-1 pr-2 font-medium">Vol. (kg)</th>
                <th className="py-1 font-medium">Int. (%)</th>
              </tr>
            </thead>
            <tbody>
              {payload.semanas.map((semana) => (
                <tr
                  key={semana.numeroSemana}
                  className="border-t border-gray-100 dark:border-white/5"
                >
                  <td className="py-1 pr-2 font-medium text-text-primary dark:text-white">
                    {semana.numeroSemana}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {TIPOS_MICROCICLO.find(
                      (t) => t.value === semana.tipoMicrociclo,
                    )?.label ?? semana.tipoMicrociclo}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {semana.frecuencia}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {semana.volumen}
                  </td>
                  <td className="py-1 text-text-secondary">
                    {semana.intensidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form action={handleGuardarPeriodizacion} className="space-y-3">
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        <input type="hidden" name="periodos" value={JSON.stringify(payload.periodos)} />
        <input type="hidden" name="etapas" value={JSON.stringify(payload.etapasPorPeriodo)} />
        <input
          type="hidden"
          name="mesociclos"
          value={JSON.stringify(payload.mesociclos)}
        />
        <input type="hidden" name="semanas" value={JSON.stringify(payload.semanas)} />

        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Guardando periodización..." : "Guardar periodización"}
        </PrimaryButton>
      </form>

      <form action={activarMacrocicloAction}>
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        <PrimaryButton
          type="submit"
          disabled={!sesionRmId}
          className={!sesionRmId ? "opacity-50" : ""}
        >
          Activar macrociclo
        </PrimaryButton>
      </form>
    </div>
  );
}
