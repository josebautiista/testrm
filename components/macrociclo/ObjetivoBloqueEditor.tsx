"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { guardarObjetivoBloqueMesocicloAction } from "@/actions/macrociclo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { type TipoMesociclo } from "@/lib/macrociclo";
import {
  OBJETIVO_BLOQUE_LABEL,
  PROGRESION_LABEL,
  PROGRESION_POR_OBJETIVO,
  RANGOS_VOLUMEN,
  ZONAS_INTENSIDAD,
  type ObjetivoBloque,
  type ProgresionBloque,
} from "@/lib/config/parametros";
import { resolverObjetivoBloque } from "@/lib/planificacion/fase";
import {
  PATRONES_FUERZA,
  esObjetivoBloque,
  esProgresionBloque,
  type ObjetivoBloqueInputData,
} from "@/lib/planificacion/objetivo-bloque";

const PATRON_LABEL: Record<string, string> = {
  sentadilla: "Sentadilla",
  bisagra: "Bisagra de cadera",
  empuje_horizontal: "Empuje horizontal",
  empuje_vertical: "Empuje vertical",
  traccion_horizontal: "Tracción horizontal",
  traccion_vertical: "Tracción vertical",
  core: "Core",
  accesorio: "Accesorio",
};

/**
 * Explicación en lenguaje llano de cada objetivo de bloque, para un
 * entrenador que no conoce necesariamente el vocabulario académico
 * (cubano-soviético) que usa el resto de la app. Copia de UI, no constante
 * de dominio — por eso vive aquí y no en lib/config/parametros.ts.
 */
const OBJETIVO_BLOQUE_DESCRIPCION: Record<ObjetivoBloque, string> = {
  fuerza_maxima:
    "Levantar el máximo peso posible en pocas repeticiones. Cargas altas, descansos largos.",
  hipertrofia:
    "Aumentar el tamaño muscular. Cargas medias y más repeticiones por serie que en fuerza máxima.",
  resistencia_fuerza:
    "Aguantar el esfuerzo en el tiempo. Cargas bajas y muchas repeticiones.",
  potencia:
    "Mover el peso lo más rápido posible, no necesariamente el peso máximo. Repeticiones explosivas.",
  acumulacion:
    "Fase de construcción: se acumula volumen de series antes de subir la intensidad en el siguiente bloque.",
  realizacion:
    "Puesta a punto antes de un test o competencia: baja el volumen pero se mantiene la intensidad alta.",
  recuperacion:
    "Descarga: baja mucho el esfuerzo para que el atleta recupere antes del siguiente bloque.",
};

const OBJETIVOS_BLOQUE: ObjetivoBloque[] = [
  "fuerza_maxima",
  "hipertrofia",
  "resistencia_fuerza",
  "potencia",
  "acumulacion",
  "realizacion",
  "recuperacion",
];

const PROGRESIONES: ProgresionBloque[] = [
  "lineal_intensidad",
  "lineal_volumen",
  "ondulante",
  "mantenimiento",
];

export type ObjetivoBloqueValorInicial = {
  objetivoBloque: string | null;
  intensidadMinPct: number | null;
  intensidadMaxPct: number | null;
  repsMin: number | null;
  repsMax: number | null;
  rirObjetivo: number | null;
  progresion: string | null;
  seriesSemanalesPorPatron: unknown;
};

type ObjetivoBloqueEditorProps = {
  cc: string;
  macrocicloId: number;
  mesocicloId: number;
  tipoMesociclo: TipoMesociclo;
  valorInicial: ObjetivoBloqueValorInicial;
  onGuardado?: () => void;
  textoExito?: string;
};

function normalizarSeriesPorPatron(
  valor: unknown,
  rango: { seriesMin: number },
): Record<string, number> {
  const resultado: Record<string, number> = {};
  const objeto =
    valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  for (const patron of PATRONES_FUERZA) {
    const existente = objeto[patron];
    resultado[patron] =
      typeof existente === "number" && Number.isFinite(existente)
        ? existente
        : rango.seriesMin;
  }
  return resultado;
}

function estadoInicialDesde(
  objetivoBloque: ObjetivoBloque,
  valorInicial: ObjetivoBloqueValorInicial,
): ObjetivoBloqueInputData {
  const zona = ZONAS_INTENSIDAD[objetivoBloque];
  const rango = RANGOS_VOLUMEN[objetivoBloque];

  return {
    objetivoBloque,
    intensidadMinPct: valorInicial.intensidadMinPct ?? zona.intensidadMinPct,
    intensidadMaxPct: valorInicial.intensidadMaxPct ?? zona.intensidadMaxPct,
    repsMin: valorInicial.repsMin ?? zona.repsMin,
    repsMax: valorInicial.repsMax ?? zona.repsMax,
    rirObjetivo:
      valorInicial.rirObjetivo ??
      Math.round((zona.rirMin + zona.rirMax) / 2),
    progresion: esProgresionBloque(valorInicial.progresion)
      ? valorInicial.progresion
      : PROGRESION_POR_OBJETIVO[objetivoBloque],
    seriesSemanalesPorPatron: normalizarSeriesPorPatron(
      valorInicial.seriesSemanalesPorPatron,
      rango,
    ),
  };
}

function inputBaseClass() {
  return "w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:bg-bg-main dark:text-white dark:focus:border-white/15";
}

export function ObjetivoBloqueEditor({
  cc,
  macrocicloId,
  mesocicloId,
  tipoMesociclo,
  valorInicial,
  onGuardado,
  textoExito = "Objetivo de bloque guardado correctamente.",
}: ObjetivoBloqueEditorProps) {
  const router = useRouter();
  const objetivoBloqueInicial = useMemo(
    () =>
      resolverObjetivoBloque({
        tipo: tipoMesociclo,
        objetivoBloque: esObjetivoBloque(valorInicial.objetivoBloque)
          ? valorInicial.objetivoBloque
          : null,
      }) ?? "hipertrofia",
    [tipoMesociclo, valorInicial.objetivoBloque],
  );

  const [data, setData] = useState<ObjetivoBloqueInputData>(() =>
    estadoInicialDesde(objetivoBloqueInicial, valorInicial),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const zonaActual = ZONAS_INTENSIDAD[data.objetivoBloque];
  const rangoActual = RANGOS_VOLUMEN[data.objetivoBloque];

  function cambiarObjetivoBloque(objetivoBloque: ObjetivoBloque) {
    // El objetivo de bloque selecciona la plantilla (R-04): cambia todos los
    // valores por defecto de la zona. Si el entrenador ya había ajustado algo
    // a mano, ese ajuste se pierde al cambiar de objetivo — es intencional,
    // evita combinaciones sin sentido (p.ej. reps de fuerza con RIR de
    // hipertrofia) que un merge parcial dejaría inconsistentes.
    setData(estadoInicialDesde(objetivoBloque, {
      objetivoBloque,
      intensidadMinPct: null,
      intensidadMaxPct: null,
      repsMin: null,
      repsMax: null,
      rirObjetivo: null,
      progresion: null,
      seriesSemanalesPorPatron: null,
    }));
  }

  function setCampo<K extends keyof ObjetivoBloqueInputData>(
    campo: K,
    valor: ObjetivoBloqueInputData[K],
  ) {
    setData((prev) => ({ ...prev, [campo]: valor }));
  }

  function setSeriesPatron(patron: string, valor: number) {
    setData((prev) => ({
      ...prev,
      seriesSemanalesPorPatron: {
        ...prev.seriesSemanalesPorPatron,
        [patron]: valor,
      },
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGuardado(false);

    startTransition(async () => {
      const formData = new FormData(event.currentTarget);
      const result = await guardarObjetivoBloqueMesocicloAction(formData);

      if (result.success) {
        setGuardado(true);
        onGuardado?.();
        // Sin esto, el paso "Revisión" (y cualquier otra pantalla que lea
        // macrociclo.mesociclos desde el servidor) seguía mostrando
        // "objetivo pendiente" hasta que alguna otra acción disparara un
        // refresh — este guardado nunca actualizaba los datos que el resto
        // del wizard ya tenía cargados.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="mesocicloId" value={mesocicloId} />
      <input type="hidden" name="objetivoBloque" value={JSON.stringify(data)} />

      <div className="space-y-1.5 rounded-2xl border border-gray-200 bg-bg-main p-4 text-sm text-text-secondary dark:border-white/10 dark:bg-bg-soft">
        <p>
          Aquí defines <strong>cómo debe entrenar</strong> este mesociclo: para
          qué objetivo (fuerza, hipertrofia, etc.), con qué peso relativo al
          máximo del atleta (%1RM), cuántas repeticiones, qué tan cerca del
          fallo (RIR) y cuánto volumen semanal por tipo de movimiento. No
          hace falta que lo calcules a mano: cada objetivo trae valores
          sugeridos por defecto — solo confirma o ajusta lo que tu criterio
          te diga.
        </p>
        <p>
          Estos valores alimentan el generador de plan y las recomendaciones
          de fase. No recalculan solas las semanas que ya hayas configurado
          en el paso anterior: si las cambias, vuelve a
          &ldquo;Semanas&rdquo; y aplica sugerencias otra vez para que se
          reflejen ahí.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <div className="flex items-center">
          <h3 className="text-base font-semibold text-text-primary dark:text-white">
            Objetivo de bloque
          </h3>
          <InfoTooltip text="Para qué está entrenando el atleta en este mesociclo (ganar fuerza, tamaño muscular, resistencia, etc.). De esto se derivan automáticamente el %1RM, las repeticiones, el RIR y las series por semana de abajo — puedes ajustarlos después si lo necesitas." />
        </div>
        <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
          {OBJETIVOS_BLOQUE.map((objetivo) => {
            const activo = objetivo === data.objetivoBloque;
            return (
              <button
                key={objetivo}
                type="button"
                onClick={() => cambiarObjetivoBloque(objetivo)}
                className={[
                  "rounded-xl border px-3 py-2 text-left text-sm transition",
                  activo
                    ? "border-accent bg-accent/10 font-medium text-accent"
                    : "border-gray-200 text-text-secondary hover:bg-bg-subtle dark:border-white/10",
                ].join(" ")}
              >
                {OBJETIVO_BLOQUE_LABEL[objetivo]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-tertiary">
          {OBJETIVO_BLOQUE_DESCRIPCION[data.objetivoBloque]}
        </p>
        <p className="text-xs text-text-tertiary">
          Sugerido para este mesociclo por su tipo: {OBJETIVO_BLOQUE_LABEL[objetivoBloqueInicial]}.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <div className="flex items-center">
          <h3 className="text-base font-semibold text-text-primary dark:text-white">
            Zona de intensidad
          </h3>
          <InfoTooltip text="%1RM: porcentaje del peso máximo que el atleta levanta una sola vez (su 1RM). Si el 1RM son 100 kg y la zona dice 80%, la carga a usar es 80 kg. Reps: cuántas repeticiones por serie con esa carga. RIR (repeticiones en reserva): cuántas repeticiones más podría hacer antes de fallar — RIR 2 significa que, al terminar la serie, todavía podría hacer 2 más." />
        </div>
        <p className="text-xs text-text-tertiary">
          Rango de referencia para {OBJETIVO_BLOQUE_LABEL[data.objetivoBloque]}:{" "}
          {zonaActual.intensidadMinPct}-{zonaActual.intensidadMaxPct}% 1RM ·{" "}
          {zonaActual.repsMin}-{zonaActual.repsMax} reps · RIR {zonaActual.rirMin}-
          {zonaActual.rirMax}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">%1RM mínimo</span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={data.intensidadMinPct}
              onChange={(e) => setCampo("intensidadMinPct", Number(e.target.value))}
              className={inputBaseClass()}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">%1RM máximo</span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={data.intensidadMaxPct}
              onChange={(e) => setCampo("intensidadMaxPct", Number(e.target.value))}
              className={inputBaseClass()}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">Reps mínimas</span>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={data.repsMin}
              onChange={(e) => setCampo("repsMin", Number(e.target.value))}
              className={inputBaseClass()}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">Reps máximas</span>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={data.repsMax}
              onChange={(e) => setCampo("repsMax", Number(e.target.value))}
              className={inputBaseClass()}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">RIR objetivo</span>
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={data.rirObjetivo}
              onChange={(e) => setCampo("rirObjetivo", Number(e.target.value))}
              className={inputBaseClass()}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <div className="flex items-center">
          <h3 className="text-base font-semibold text-text-primary dark:text-white">
            Progresión intra-mesociclo
          </h3>
          <InfoTooltip text="Cómo sube la exigencia semana a semana dentro de este mesociclo: 'ola de intensidad' sube el %1RM cada semana (bloques de fuerza), 'ola de volumen' sube las series cada semana (bloques de hipertrofia), 'ondulante' alterna semanas más y menos exigentes, y 'mantenimiento' no sube nada (bloques de descarga)." />
        </div>
        <select
          value={data.progresion}
          onChange={(e) =>
            setCampo("progresion", e.target.value as ProgresionBloque)
          }
          className={inputBaseClass()}
        >
          {PROGRESIONES.map((progresion) => (
            <option key={progresion} value={progresion}>
              {PROGRESION_LABEL[progresion]}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <div>
          <div className="flex items-center">
            <h3 className="text-base font-semibold text-text-primary dark:text-white">
              Series semanales por patrón de movimiento
            </h3>
            <InfoTooltip text="Un patrón de movimiento agrupa ejercicios que trabajan el mismo movimiento base (ej.: sentadilla libre y prensa de pierna son ambos del patrón 'sentadilla'). El número es cuántas series efectivas de ese patrón debe hacer el atleta en total durante la semana, sumando todas las sesiones. Déjalo en 0 si ese patrón no aplica a este bloque." />
          </div>
          <p className="text-xs text-text-tertiary">
            Rango de referencia para {OBJETIVO_BLOQUE_LABEL[data.objetivoBloque]}:{" "}
            {rangoActual.seriesMin}-{rangoActual.seriesMax} series efectivas por
            semana. El bloque suele empezar cerca del mínimo y progresar hacia
            el máximo.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PATRONES_FUERZA.map((patron) => (
            <label key={patron} className="block space-y-1">
              <span className="text-sm text-text-secondary">
                {PATRON_LABEL[patron] ?? patron}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={data.seriesSemanalesPorPatron[patron] ?? 0}
                onChange={(e) =>
                  setSeriesPatron(patron, Number(e.target.value))
                }
                className={inputBaseClass()}
              />
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {guardado ? (
        <p className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
          {textoExito}
        </p>
      ) : null}

      <PrimaryButton type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar objetivo de bloque"}
      </PrimaryButton>
    </form>
  );
}
