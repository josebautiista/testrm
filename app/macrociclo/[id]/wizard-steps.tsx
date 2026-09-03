"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AppDialog } from "@/components/ui/AppDialog";
import { MesocicloCargaEditor } from "@/components/macrociclo/MesocicloCargaEditor";
import {
  type ObjetivoTipo,
  type TipoEtapa,
  type SemanaCalculada,
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
import {
  calcularPeriodizacion,
  contarSemanas,
} from "@/lib/macrociclo-periodizacion";
import {
  construirEstructura,
  modoCalendarioDe,
  type PerfilDeportivo,
} from "@/lib/planificacion/perfil";
import type { CompetenciaPlan } from "@/lib/planificacion/taper";
import {
  estaSinConfigurar,
  sugerirConfiguracionSemana,
} from "@/lib/planificacion/sugerencia-semana";
import { type CargaMesocicloInputData } from "@/lib/mesociclo-carga";
import {
  guardarRmAction,
  guardarVo2maxAction,
  omitirVo2maxAction,
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
  rmMethod: string;
  resultados: Array<{
    ejercicioId: number;
    ejercicio: { nombre: string };
    repeticiones: number;
    carga: number;
    epley: number;
  }>;
};

function UsarSesionRmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" disabled={disabled || pending}>
      {pending ? "Guardando..." : "Usar sesión seleccionada"}
    </PrimaryButton>
  );
}

export function PasoRm({
  cc,
  macrocicloId,
  sesionesRm,
  sesionRmIds,
  setSesionRmIds,
  objetivoTipo,
}: {
  cc: string;
  macrocicloId: number;
  sesionesRm: SesionRm[];
  sesionRmIds: number[];
  setSesionRmIds: (value: number[]) => void;
  objetivoTipo: ObjetivoTipo;
}) {
  const sugerida = sesionesRm[0];
  const mostrarAvisoCompetencia =
    objetivoTipo === "competencia" &&
    sesionesRm.some(
      (sesion) =>
        sesionRmIds.includes(sesion.id) && sesion.rmMethod === "estimation",
    );

  function esDirecta(sesion: SesionRm) {
    return ["casas", "naclerio", "nacleiro"].includes(sesion.rmMethod);
  }

  function alternarSesion(sesion: SesionRm) {
    if (!esDirecta(sesion)) {
      setSesionRmIds([sesion.id]);
      return;
    }

    const directasSeleccionadas = sesionesRm
      .filter((item) => sesionRmIds.includes(item.id) && esDirecta(item))
      .map((item) => item.id);
    setSesionRmIds(
      directasSeleccionadas.includes(sesion.id)
        ? directasSeleccionadas.filter((id) => id !== sesion.id)
        : [...directasSeleccionadas, sesion.id],
    );
  }

  const formatFecha = (fecha: Date) =>
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(fecha);

  return (
    <form action={guardarRmAction} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      {sesionRmIds.map((sesionId) => (
        <input key={sesionId} type="hidden" name="sesionRmIds" value={sesionId} />
      ))}

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Sesión RM
        </h2>
        <p className="text-sm text-text-secondary">
          Selecciona una evaluación. Si son tests directos de Casas o
          Naclerio, puedes combinar varias sesiones; para un ejercicio
          repetido se usará siempre el resultado más reciente.
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
              sesionRmIds.includes(sesion.id)
                ? "border-accent bg-accent/5"
                : "border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle",
            ].join(" ")}
          >
            <input
              type={esDirecta(sesion) ? "checkbox" : "radio"}
              name="sesionRmOption"
              checked={sesionRmIds.includes(sesion.id)}
              onChange={() => alternarSesion(sesion)}
              className="h-4 w-4 accent-accent"
            />
            <div>
              <p className="font-medium text-text-primary dark:text-white">
                {formatFecha(sesion.createdAt)}
              </p>
              <p className="text-sm text-text-secondary">
                {sesion.rmMethod === "estimation"
                  ? "Estimación"
                  : sesion.rmMethod === "casas"
                    ? "Protocolo Casas"
                    : "Test de Naclerio"}{" "}
                · {sesion.resultados.length} ejercicio(s)
              </p>
            </div>
          </label>
        ))}
      </div>

      {mostrarAvisoCompetencia ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
          Tu objetivo es Competencia, pero esta sesión usa el método de
          Estimación (indirecto). Se recomienda validar tu fuerza máxima con
          el Protocolo Casas o el Test de Naclerio, que requieren experiencia
          previa, antes de competir.
        </div>
      ) : null}

      <div className="space-y-3">
        <UsarSesionRmButton disabled={sesionRmIds.length === 0} />

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
  legerEtapa,
  setLegerEtapa,
}: {
  cc: string;
  macrocicloId: number;
  metodo: string;
  setMetodo: (value: string) => void;
  cooperDistancia: string;
  setCooperDistancia: (value: string) => void;
  legerEtapa: string;
  setLegerEtapa: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
    <form action={guardarVo2maxAction} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="metodo" value={metodo} />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          VO2Max
        </h2>
        <p className="text-sm text-text-secondary">
          Registra el método de evaluación de capacidad aeróbica. Si prefieres
          conocer tu VO2Max más adelante, puedes omitir este paso.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {["cooper", "leger"].map((m) => (
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
        <div className="space-y-2">
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
          <p className="text-xs text-text-secondary">
            Cómo se hace: corre la mayor distancia posible durante 12 minutos
            continuos en una pista plana, sin detenerte, y registra la
            distancia total recorrida.
          </p>
        </div>
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
          <p className="text-xs text-text-secondary">
            Cómo se hace: test de ida y vuelta de 20 metros (course-navette).
            Corre siguiendo el ritmo de las señales sonoras, aumentando la
            velocidad en cada etapa, hasta que ya no puedas mantener el ritmo.
            Registra la última etapa completada.
          </p>

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

      <FormSubmitButton pendingLabel="Guardando...">
        Guardar VO2Max
      </FormSubmitButton>
    </form>

    <form action={omitirVo2maxAction}>
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <button
        type="submit"
        className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-center text-sm font-medium text-text-secondary transition hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-subtle"
      >
        Omitir este paso
      </button>
    </form>
    </div>
  );
}




function formatNumber(value: number): string {
  return Number(value).toLocaleString("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

type SemanaEjercicioConfig = {
  ejercicioId: number;
  formulaRm: string;
  rm: number;
  peso: number;
  volumen: number;
};

type SemanaConfig = {
  tipoMicrociclo: TipoMicrociclo;
  frecuencia: number | "";
  series: number | "";
  repeticiones: number | "";
  volumen: number | "";
  intensidad: number | "";
  ejercicios: SemanaEjercicioConfig[];
};

type ResultadoRmCompleto = {
  ejercicioId: number;
  ejercicio: { nombre: string };
  epley: number;
  brzycki: number;
  lombardi: number;
  lander: number;
  oconnor: number;
  mayhew: number;
  wathen: number;
  baechle: number;
  casas: number;
  nacleiro: number;
};

const FORMULAS_RM = [
  { value: "epley", label: "Epley" },
  { value: "brzycki", label: "Brzycki" },
  { value: "lombardi", label: "Lombardi" },
  { value: "lander", label: "Lander" },
  { value: "oconnor", label: "O'Connor" },
  { value: "mayhew", label: "Mayhew" },
  { value: "wathen", label: "Wathen" },
  { value: "baechle", label: "Baechle" },
  { value: "casas", label: "Casas" },
  { value: "nacleiro", label: "Nacleiro" },
] as const;

function getRmValue(resultado: ResultadoRmCompleto, formula: string): number {
  const value = (resultado as unknown as Record<string, unknown>)[formula];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function FormulaRmSelect({
  value,
  resultado,
  onChange,
  ariaLabel,
}: {
  value: string;
  resultado: ResultadoRmCompleto | undefined;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const options = FORMULAS_RM.map((f) => ({
    value: f.value,
    label: resultado
      ? `${f.label} — ${formatNumber(getRmValue(resultado, f.value))} kg`
      : f.label,
  }));

  return (
    <SearchableSelect
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  );
}

export function PasoSemanas({
  cc,
  macrocicloId,
  fechaInicio,
  fechaFin,
  perfil,
  competencias,
  diasDisponibles,
  semanasConfig,
  setSemanasConfig,
  semanasSeleccionadas,
  setSemanasSeleccionadas,
  resultadosRm,
  buildPeriodizacionPayload,
  onContinuar,
}: {
  cc: string;
  macrocicloId: number;
  fechaInicio: Date;
  fechaFin: Date;
  perfil: PerfilDeportivo;
  competencias: CompetenciaPlan[];
  /** ADR-43 · Base de la frecuencia propuesta. */
  diasDisponibles: number;
  semanasConfig: Record<number, SemanaConfig>;
  setSemanasConfig: (value: Record<number, SemanaConfig>) => void;
  semanasSeleccionadas: number[];
  setSemanasSeleccionadas: (value: number[]) => void;
  resultadosRm: ResultadoRmCompleto[];
  buildPeriodizacionPayload: () => {
    semanas: {
      numeroSemana: number;
      tipoMicrociclo: TipoMicrociclo;
      frecuencia: number;
      series: number;
      repeticiones: number;
      volumen: number;
      intensidad: number;
      ejercicios: SemanaEjercicioConfig[];
    }[];
  };
  onContinuar: () => void;
}) {
  const router = useRouter();
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const [avanzarAlRefrescar, setAvanzarAlRefrescar] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    if (avanzarAlRefrescar && !isRefreshPending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvanzarAlRefrescar(false);
      onContinuar();
    }
  }, [avanzarAlRefrescar, isRefreshPending, onContinuar]);

  function esAbdominal(nombre: string): boolean {
    return /abdominal/i.test(nombre);
  }

  function getSemanaConfigInicial(): SemanaConfig {
    return {
      tipoMicrociclo: "corriente",
      frecuencia: 0,
      series: 0,
      repeticiones: 0,
      volumen: 0,
      intensidad: 0,
      ejercicios: [],
    };
  }

  function crearEjerciciosIniciales(): SemanaEjercicioConfig[] {
    return resultadosRm
      .filter((r) => !esAbdominal(r.ejercicio.nombre))
      .map((r) => ({
        ejercicioId: r.ejercicioId,
        formulaRm: "epley",
        rm: r.epley,
        peso: 0,
        volumen: 0,
      }));
  }

  function calcularVolumenTotal(ejercicios: SemanaEjercicioConfig[]): number {
    return ejercicios.reduce((total, e) => total + e.volumen, 0);
  }

  function calcularEjercicioIndividual(
    ejercicioId: number,
    formulaRm: string,
    series: number,
    repeticiones: number,
    intensidad: number,
  ): { rm: number; peso: number; volumen: number } {
    const resultado = resultadosRm.find((r) => r.ejercicioId === ejercicioId);
    if (
      !resultado ||
      esAbdominal(resultado.ejercicio.nombre) ||
      series <= 0 ||
      repeticiones <= 0 ||
      intensidad <= 0
    ) {
      return { rm: 0, peso: 0, volumen: 0 };
    }
    const rm = getRmValue(resultado, formulaRm);
    const peso = rm * (intensidad / 100);
    const volumen = series * repeticiones * peso;
    return { rm, peso, volumen };
  }

  function recalcularEjercicios(
    current: SemanaConfig,
    series: number,
    repeticiones: number,
    intensidad: number,
  ): SemanaEjercicioConfig[] {
    const base =
      current.ejercicios.length > 0
        ? current.ejercicios
        : crearEjerciciosIniciales();
    return base.map((e) => ({
      ...e,
      ...calcularEjercicioIndividual(
        e.ejercicioId,
        e.formulaRm,
        series,
        repeticiones,
        intensidad,
      ),
    }));
  }

  /**
   * ADR-43 · Configuración propuesta para una semana, derivada de su bloque.
   * Reutiliza los mismos parámetros que el motor de planificación; aquí solo
   * se traducen al formato del formulario.
   */
  function sugerenciaDe(semana: SemanaCalculada) {
    return sugerirConfiguracionSemana({
      objetivoBloque: semana.objetivoBloque,
      indiceEnBloque: semana.indiceEnBloque,
      totalSemanasBloque: semana.totalSemanasBloque,
      factorVolumen: semana.factorVolumen,
      factorIntensidad: semana.factorIntensidad,
      tipoMicrociclo: semana.tipoMicrociclo,
      diasDisponibles,
    });
  }

  const calculado = useMemo(() => {
    return calcularPeriodizacion({
      fechaInicio,
      fechaFin,
      estructura: construirEstructura(
        perfil,
        contarSemanas(fechaInicio, fechaFin),
      ),
      competencias,
      modoCalendario: modoCalendarioDe(perfil),
      frecuenciaDeload: perfil.nivel === "advanced" ? 3 : 4,
    });
  }, [competencias, fechaFin, fechaInicio, perfil]);

  const semanasVacias = calculado.semanas.filter((semana) =>
    estaSinConfigurar(
      semanasConfig[semana.numeroSemana] ?? {
        frecuencia: 0,
        series: 0,
        repeticiones: 0,
        intensidad: 0,
      },
    ),
  );

  /**
   * ADR-43 · Rellena la configuración de carga a partir del plan. Con
   * `soloVacias` no toca ninguna semana que el entrenador ya haya ajustado:
   * una sugerencia nunca debe pisar una decisión.
   */
  function aplicarSugerencias(soloVacias: boolean) {
    const siguiente: Record<number, SemanaConfig> = { ...semanasConfig };

    for (const semana of calculado.semanas) {
      const actual = siguiente[semana.numeroSemana];
      if (soloVacias && actual && !estaSinConfigurar(actual)) {
        continue;
      }

      const sugerencia = sugerenciaDe(semana);
      const base: SemanaConfig = actual ?? getSemanaConfigInicial();
      const ejercicios = recalcularEjercicios(
        base,
        sugerencia.series,
        sugerencia.repeticiones,
        sugerencia.intensidad,
      );

      siguiente[semana.numeroSemana] = {
        ...base,
        tipoMicrociclo: semana.tipoMicrociclo,
        frecuencia: sugerencia.frecuencia,
        series: sugerencia.series,
        repeticiones: sugerencia.repeticiones,
        intensidad: sugerencia.intensidad,
        ejercicios,
        volumen: calcularVolumenTotal(ejercicios),
      };
    }

    setSemanasConfig(siguiente);
  }

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
    field: keyof SemanaConfig,
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
      const current = next[n] ?? getSemanaConfigInicial();
      const updated: SemanaConfig = { ...current, [field]: parsed };

      if (
        field === "series" ||
        field === "repeticiones" ||
        field === "intensidad"
      ) {
        const series =
          field === "series" ? Number(parsed || 0) : Number(current.series || 0);
        const repeticiones =
          field === "repeticiones"
            ? Number(parsed || 0)
            : Number(current.repeticiones || 0);
        const intensidad =
          field === "intensidad"
            ? Number(parsed || 0)
            : Number(current.intensidad || 0);

        const nuevosEjercicios = recalcularEjercicios(
          current,
          series,
          repeticiones,
          intensidad,
        );
        updated.ejercicios = nuevosEjercicios;
        updated.volumen = calcularVolumenTotal(nuevosEjercicios);
      }

      next = {
        ...next,
        [n]: updated,
      };
    }
    setSemanasConfig(next);
  }

  function updateFormulaEjercicio(
    numero: number,
    ejercicioId: number,
    formulaRm: string,
  ) {
    const objetivos = semanasSeleccionadas.includes(numero)
      ? seleccionadasActuales
      : [numero];

    let next = semanasConfig;
    for (const n of objetivos) {
      const current = next[n] ?? getSemanaConfigInicial();
      const series = Number(current.series || 0);
      const repeticiones = Number(current.repeticiones || 0);
      const intensidad = Number(current.intensidad || 0);

      const nuevosEjercicios = current.ejercicios.map((e) =>
        e.ejercicioId === ejercicioId
          ? {
              ...e,
              formulaRm,
              ...calcularEjercicioIndividual(
                e.ejercicioId,
                formulaRm,
                series,
                repeticiones,
                intensidad,
              ),
            }
          : e,
      );

      next = {
        ...next,
        [n]: {
          ...current,
          ejercicios: nuevosEjercicios,
          volumen: calcularVolumenTotal(nuevosEjercicios),
        },
      };
    }
    setSemanasConfig(next);
  }

  // Inicializa/recalcula ejercicios para semanas que ya tengan series/reps/intensidad
  // pero que aún no tengan el desglose por ejercicio (por ejemplo, datos antiguos).
  useEffect(() => {
    let changed = false;
    const next = { ...semanasConfig };
    for (const semana of calculado.semanas) {
      const config = next[semana.numeroSemana];
      if (!config) continue;
      const series = Number(config.series || 0);
      const repeticiones = Number(config.repeticiones || 0);
      const intensidad = Number(config.intensidad || 0);
      if (
        config.ejercicios.length === 0 &&
        resultadosRm.length > 0 &&
        (series > 0 || repeticiones > 0 || intensidad > 0)
      ) {
        const nuevosEjercicios = recalcularEjercicios(
          config,
          series,
          repeticiones,
          intensidad,
        );
        next[semana.numeroSemana] = {
          ...config,
          ejercicios: nuevosEjercicios,
          volumen: calcularVolumenTotal(nuevosEjercicios),
        };
        changed = true;
      }
    }
    if (changed) {
      setSemanasConfig(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div className="space-y-2 rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm font-semibold text-text-primary dark:text-white">
          Rellenar automáticamente
        </p>
        <p className="text-sm leading-6 text-text-secondary">
          Cada bloque del plan ya define a qué intensidad y con cuántas series
          y repeticiones se trabaja, y cada semana lleva su factor de carga
          (descarga, afinamiento, evaluación). Con eso se puede proponer la
          configuración de las {calculado.semanas.length} semanas sin que
          teclees nada. Puedes ajustar después lo que no cuadre.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => aplicarSugerencias(true)}
            className="rounded-2xl border border-transparent bg-text-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
          >
            Rellenar las semanas vacías ({semanasVacias.length})
          </button>
          <button
            type="button"
            onClick={() => aplicarSugerencias(false)}
            className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-main dark:border-white/10 dark:text-white"
          >
            Recalcular todas
          </button>
        </div>
        <p className="text-xs leading-5 text-text-tertiary">
          «Rellenar las vacías» no toca nada de lo que ya hayas puesto.
          «Recalcular todas» sí sobrescribe tus ajustes manuales, incluidos los
          tipos de semana que hayas cambiado.
        </p>
      </div>

      <div className="space-y-4">
        {calculado.semanas.map((semana) => {
          const config = semanasConfig[semana.numeroSemana] ?? {
            tipoMicrociclo: "corriente" as TipoMicrociclo,
            frecuencia: 0,
            series: 0,
            repeticiones: 0,
            volumen: 0,
            intensidad: 0,
            ejercicios: [],
          };
          // Sin override, se muestra el tipo que calculó el plan: antes se
          // mostraba "corriente" para todas las semanas.
          const tipoDeSemana =
            semanasConfig[semana.numeroSemana]?.tipoMicrociclo ??
            semana.tipoMicrociclo;
          const tipoModificado = tipoDeSemana !== semana.tipoMicrociclo;
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

              {semana.notas ? (
                <p className="mb-3 text-xs leading-5 text-text-tertiary">
                  {semana.notas}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="block space-y-1">
                  <span className="text-xs text-text-secondary">Tipo</span>
                  {/* ADR-44: el motor propone el tipo, pero el entrenador
                      puede cambiarlo — conoce contextos que el plan no. Lo que
                      elija manda al guardar, y los factores de carga se
                      recalculan según el tipo que quede. */}
                  <SearchableSelect
                    value={tipoDeSemana}
                    options={TIPOS_MICROCICLO}
                    onChange={(value) =>
                      updateSemana(semana.numeroSemana, "tipoMicrociclo", value)
                    }
                    ariaLabel={`Tipo de microciclo de la semana ${semana.numeroSemana}`}
                  />
                  {tipoModificado ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateSemana(
                          semana.numeroSemana,
                          "tipoMicrociclo",
                          semana.tipoMicrociclo,
                        )
                      }
                      className="text-xs text-accent underline-offset-2 hover:underline"
                    >
                      Volver a «
                      {TIPOS_MICROCICLO.find(
                        (t) => t.value === semana.tipoMicrociclo,
                      )?.label ?? semana.tipoMicrociclo}
                      », que es lo que propone el plan
                    </button>
                  ) : null}
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
                  <span className="text-xs text-text-secondary">Series</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.series}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updateSemana(semana.numeroSemana, "series", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none dark:border-white/10 dark:bg-bg-main dark:text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-text-secondary">Repeticiones</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.repeticiones}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updateSemana(
                        semana.numeroSemana,
                        "repeticiones",
                        e.target.value,
                      )
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
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-bg-soft dark:border-white/10 dark:bg-bg-main">
                {resultadosRm.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-text-tertiary">
                    Selecciona una sesión RM para calcular el volumen.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-bg-main dark:bg-bg-subtle">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">
                              Ejercicio
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">
                              Fórmula RM
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-text-secondary">
                              RM (kg)
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-text-secondary">
                              Peso (kg)
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-text-secondary">
                              Volumen (kg)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/8">
                          {config.ejercicios.map((ejercicio) => {
                            const resultado = resultadosRm.find(
                              (r) => r.ejercicioId === ejercicio.ejercicioId,
                            );
                            return (
                              <tr key={ejercicio.ejercicioId}>
                                <td className="px-3 py-2 text-text-primary dark:text-white">
                                  {resultado?.ejercicio.nombre ??
                                    `Ejercicio ${ejercicio.ejercicioId}`}
                                </td>
                                <td className="min-w-[11rem] px-3 py-2">
                                  <FormulaRmSelect
                                    value={ejercicio.formulaRm}
                                    resultado={resultado}
                                    onChange={(value) =>
                                      updateFormulaEjercicio(
                                        semana.numeroSemana,
                                        ejercicio.ejercicioId,
                                        value,
                                      )
                                    }
                                    ariaLabel={`Fórmula RM de ${resultado?.ejercicio.nombre ?? `ejercicio ${ejercicio.ejercicioId}`}`}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right text-text-secondary">
                                  {formatNumber(ejercicio.rm)} kg
                                </td>
                                <td className="px-3 py-2 text-right text-text-secondary">
                                  {formatNumber(ejercicio.peso)} kg
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-text-primary dark:text-white">
                                  {formatNumber(ejercicio.volumen)} kg
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-3 dark:border-white/8">
                      <p className="text-xs text-text-secondary">
                        Volumen total semanal
                      </p>
                      <p className="text-lg font-semibold text-text-primary dark:text-white">
                        {formatNumber(Number(config.volumen || 0))} kg
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        action={async (formData) => {
          const result = await guardarPeriodizacionSinRedirectAction(formData);
          if (result.success) {
            setAvanzarAlRefrescar(true);
            startRefreshTransition(() => {
              router.refresh();
            });
          } else {
            setErrorGuardado(result.error);
          }
        }}
        className="space-y-3"
      >
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        {/* ADR-37: la estructura la deriva el servidor del perfil deportivo;
            del formulario solo salen los valores de carga por semana. */}
        <input type="hidden" name="semanas" value={JSON.stringify(payload.semanas)} />

        <FormSubmitButton pendingLabel="Guardando periodización...">
          Guardar periodización y continuar
        </FormSubmitButton>
      </form>
      <AppDialog
        open={errorGuardado !== null}
        title="No se pudo guardar la periodización"
        onClose={() => setErrorGuardado(null)}
      >
        {errorGuardado}
      </AppDialog>
    </div>
  );
}

export function PasoCarga({
  cc,
  macrocicloId,
  mesociclos,
  perfil,
  onContinuar,
}: {
  cc: string;
  macrocicloId: number;
  perfil: PerfilDeportivo;
  mesociclos: Array<{
    id: number;
    tipo: string;
    fechaInicio: Date;
    fechaFin: Date;
    semanas: Array<{
      numeroSemana: number;
      frecuencia: number;
      fechaInicio: Date;
      fechaFin: Date;
    }>;
    carga: CargaMesocicloInputData | null;
  }>;
  onContinuar: () => void;
}) {
  const [selectedId, setSelectedId] = useState(mesociclos[0]?.id);
  const [guardados, setGuardados] = useState<Set<number>>(() => {
    const set = new Set<number>();
    for (const mesociclo of mesociclos) {
      if (mesociclo.carga) {
        set.add(mesociclo.id);
      }
    }
    return set;
  });

  const mesociclo = mesociclos.find((m) => m.id === selectedId);

  if (mesociclos.length === 0) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Dosificación de carga
          </h2>
          <p className="text-sm text-text-secondary">
            Primero debes guardar la periodización en el paso anterior.
          </p>
        </div>
        <PrimaryButton type="button" onClick={onContinuar}>
          Continuar a revisión
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Dosificación de carga
        </h2>
        <p className="text-sm text-text-secondary">
          Selecciona un mesociclo y distribuye sus minutos por dirección,
          microciclo y sesión.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {mesociclos.map((m) => {
          const activo = m.id === selectedId;
          const tieneCarga = guardados.has(m.id) || m.carga;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition",
                activo
                  ? "bg-accent text-white"
                  : tieneCarga
                    ? "bg-bg-subtle text-text-primary dark:text-white"
                    : "bg-bg-soft text-text-tertiary",
              ].join(" ")}
            >
              {MESES_POR_TIPO_LABEL[m.tipo as TipoMesociclo] ?? m.tipo}
              {tieneCarga ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      {mesociclo ? (
        <MesocicloCargaEditor
          cc={cc}
          macrocicloId={macrocicloId}
          mesocicloId={mesociclo.id}
          semanas={mesociclo.semanas.map((s) => ({
            numeroSemana: s.numeroSemana,
            frecuencia: s.frecuencia,
          }))}
          cargaInicial={mesociclo.carga}
          perfil={perfil}
          onGuardado={() =>
            setGuardados((prev) => new Set([...Array.from(prev), mesociclo.id]))
          }
        />
      ) : null}

      <PrimaryButton type="button" onClick={onContinuar}>
        Continuar a revisión
      </PrimaryButton>
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

function ActivarMacrocicloButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton
      type="submit"
      disabled={disabled || pending}
      className={disabled ? "opacity-50" : ""}
    >
      {pending ? "Activando..." : "Activar macrociclo"}
    </PrimaryButton>
  );
}

export function PasoRevision({
  cc,
  macrocicloId,
  objetivoTipo,
  fechaInicio,
  fechaFin,
  sesionesRmSeleccionadas,
  vo2maxSnapshot,
  mesociclos,
  buildPeriodizacionPayload,
}: {
  cc: string;
  macrocicloId: number;
  objetivoTipo: ObjetivoTipo;
  fechaInicio: string;
  fechaFin: string;
  sesionesRmSeleccionadas: SesionRm[];
  vo2maxSnapshot: Vo2maxSnapshot | null;
  mesociclos: Array<{ id: number; tipo: string; carga: CargaMesocicloInputData | null }>;
  buildPeriodizacionPayload: () => {
    semanas: {
      numeroSemana: number;
      tipoMicrociclo: TipoMicrociclo;
      frecuencia: number;
      series: number;
      repeticiones: number;
      volumen: number;
      intensidad: number;
    }[];
  };
}) {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error") ?? "";
  const payload = buildPeriodizacionPayload();
  const vo2maxInfo = describirVo2max(vo2maxSnapshot);

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
        <p className="mt-2 text-sm text-text-secondary">Sesiones RM</p>
        {sesionesRmSeleccionadas.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {sesionesRmSeleccionadas.map((sesion) => (
              <li key={sesion.id} className="font-medium text-text-primary dark:text-white">
                {new Intl.DateTimeFormat("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(sesion.createdAt)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-medium text-text-primary dark:text-white">Sin asignar</p>
        )}
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
        <p className="text-sm text-text-secondary">Estructura</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {payload.semanas.length} semanas planificadas. Los periodos, etapas y
          bloques se derivan del perfil deportivo y se pueden revisar en el paso
          de Estructura.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {(() => {
            const conteo = new Map<string, number>();
            for (const semana of payload.semanas) {
              conteo.set(
                semana.tipoMicrociclo,
                (conteo.get(semana.tipoMicrociclo) ?? 0) + 1,
              );
            }
            return [...conteo.entries()].map(([tipo, total]) => (
              <li key={tipo} className="flex items-center justify-between">
                <span className="text-text-secondary">{tipo}</span>
                <span className="font-medium tabular-nums text-text-primary dark:text-white">
                  {total} {total === 1 ? "semana" : "semanas"}
                </span>
              </li>
            ));
          })()}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <p className="text-sm text-text-secondary">Mesociclos</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {mesociclos.map((mesociclo) => {
            const tieneCarga = Boolean(mesociclo.carga);
            return (
              <li
                key={mesociclo.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-text-secondary">
                  {MESES_POR_TIPO_LABEL[mesociclo.tipo as TipoMesociclo] ??
                    mesociclo.tipo}
                </span>
                <span
                  className={
                    tieneCarga
                      ? "font-medium text-accent"
                      : "font-medium text-text-tertiary"
                  }
                >
                  {tieneCarga ? "✓ carga definida" : "carga pendiente"}
                </span>
              </li>
            );
          })}
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
                <th className="py-1 pr-2 font-medium">Series</th>
                <th className="py-1 pr-2 font-medium">Reps</th>
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
                    {semana.series}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {semana.repeticiones}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {formatNumber(semana.volumen)}
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

      <form action={guardarPeriodizacionAction} className="space-y-3">
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        {/* ADR-37: la estructura la deriva el servidor del perfil deportivo;
            del formulario solo salen los valores de carga por semana. */}
        <input type="hidden" name="semanas" value={JSON.stringify(payload.semanas)} />

        <FormSubmitButton pendingLabel="Guardando periodización...">
          Guardar periodización
        </FormSubmitButton>
      </form>

      <form action={activarMacrocicloAction}>
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        <ActivarMacrocicloButton disabled={sesionesRmSeleccionadas.length === 0} />
      </form>
    </div>
  );
}
