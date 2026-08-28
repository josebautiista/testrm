"use client";

import { useEffect, useMemo, useState } from "react";

import { Aviso, ComoFunciona } from "@/components/rm/ComoFunciona";
import { Select } from "@/components/ui/Select";
import {
  estimarRm,
  resolverTren,
  sugerirAjusteCarga,
  VENTANA_OPTIMA_TEST,
} from "@/lib/rm/estimacion";

export type EjercicioEstimacion = {
  id: number;
  nombre: string;
  patron: string;
  incrementoMinimoKg: number;
  esDeTiempo: boolean;
  cargaSugerida: number;
  nota?: string;
};

type EstadoEjercicio = {
  carga: string;
  pesoEquipo: string;
  reps: string;
  rir: string;
};

type Props = {
  ejercicios: EjercicioEstimacion[];
  formatWeight: (value: number) => string;
  /** Descanso recomendado entre tests de ejercicios distintos (NSCA: 3–5 min). */
  descansoEntreEjerciciosSeg?: number;
};

/** Opciones de RIR. Por encima de 4 la autopercepción deja de ser fiable. */
const OPCIONES_RIR = [
  { value: "0", label: "0 · No podía hacer ni una más" },
  { value: "1", label: "1 · Me quedaba 1" },
  { value: "2", label: "2 · Me quedaban 2" },
  { value: "3", label: "3 · Me quedaban 3" },
  { value: "4", label: "4 · Me quedaban 4 o más" },
];

function toNumber(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toEntero(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * H-14: `Intl.NumberFormat("es-CO")` devuelve "39,3", que un
 * `<input type="number">` rechaza y renderiza vacío. El valor inicial de un
 * campo numérico tiene que ir siempre con punto decimal.
 */
function valorNumericoInicial(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return "";
  return String(Math.round(valor * 10) / 10);
}

export function EstimacionEjercicios({
  ejercicios,
  formatWeight,
  descansoEntreEjerciciosSeg = 180,
}: Props) {
  const [estados, setEstados] = useState<Record<number, EstadoEjercicio>>(() =>
    Object.fromEntries(
      ejercicios.map((ejercicio) => [
        ejercicio.id,
        {
          carga: ejercicio.esDeTiempo
            ? "0"
            : valorNumericoInicial(ejercicio.cargaSugerida),
          pesoEquipo: "0",
          reps: "",
          rir: "",
        },
      ]),
    ),
  );

  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [segundosTotales, setSegundosTotales] = useState(0);

  useEffect(() => {
    if (segundosRestantes <= 0) return;

    const intervalo = window.setInterval(() => {
      setSegundosRestantes((actual) => Math.max(actual - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [segundosRestantes]);

  function actualizar(id: number, cambios: Partial<EstadoEjercicio>) {
    setEstados((actuales) => ({
      ...actuales,
      [id]: { ...actuales[id], ...cambios },
    }));
  }

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");
  const progreso =
    segundosTotales > 0 ? (segundosRestantes / segundosTotales) * 100 : 0;

  const resumen = useMemo(() => {
    let validos = 0;
    let porAjustar = 0;

    for (const ejercicio of ejercicios) {
      if (ejercicio.esDeTiempo) continue;

      const estado = estados[ejercicio.id];
      if (!estado) continue;

      const carga = toNumber(estado.carga) + toNumber(estado.pesoEquipo);
      const reps = toEntero(estado.reps);
      if (carga <= 0 || reps <= 0) continue;

      const ajuste = sugerirAjusteCarga(carga, reps, {
        tren: resolverTren(ejercicio.patron),
        incrementoMinimoKg: ejercicio.incrementoMinimoKg,
        rirReportado: estado.rir === "" ? null : Number(estado.rir),
      });

      if (ajuste.accion === "ninguno") validos += 1;
      else porAjustar += 1;
    }

    return { validos, porAjustar };
  }, [ejercicios, estados]);

  return (
    <div className="space-y-5">
      <ComoFunciona
        titulo="Cómo funciona la estimación de fuerza"
        resumen={`No levantas tu peso máximo: levantas un peso submáximo tantas veces como puedas y una fórmula calcula tu 1RM a partir de ahí. Para que ese cálculo sea preciso, cada intento tiene que quedar entre ${VENTANA_OPTIMA_TEST.min} y ${VENTANA_OPTIMA_TEST.max} repeticiones.`}
        pasos={[
          {
            titulo: "Carga el peso sugerido",
            detalle:
              "Es un punto de partida calculado desde tu masa corporal, no una prescripción. Ajústalo si sabes que te queda corto o largo.",
          },
          {
            titulo: "Haz repeticiones hasta que no puedas mantener la técnica",
            detalle:
              "No hasta el agotamiento total: hasta la última repetición que puedas hacer bien. Si tienes con quién, hazlo acompañado.",
          },
          {
            titulo: "Anota cuántas hiciste y cuántas te quedaban",
            detalle:
              "Ese segundo dato (las repeticiones en reserva) es lo que separa una estimación decente de una mala. Si paraste con 3 en el tanque y no lo dices, la app te calcula un 1RM más bajo del real.",
          },
          {
            titulo: "Si el intento sale de la ventana, repítelo",
            detalle:
              `La app te dice exactamente cuánto peso poner y te da el descanso. Un intento de 15 repeticiones no sirve por más que lo guardes: la fórmula pierde precisión rápido a partir de ${VENTANA_OPTIMA_TEST.max}.`,
          },
          {
            titulo: "Descansa entre ejercicios",
            detalle:
              "Tres minutos como mínimo. Encadenar ejercicios sin pausa hace que los últimos midan tu cansancio, no tu fuerza.",
          },
        ]}
        porQue={`La precisión de estas fórmulas cae aproximadamente un 1,5 % por cada repetición por encima de 8, y el 5RM es el mejor predictor individual del 1RM. Fuera de la ventana ${VENTANA_OPTIMA_TEST.min}–${VENTANA_OPTIMA_TEST.max} el número que sale es una cifra con apariencia de dato.`}
        fuente="Reynolds, Gordon & Robergs (2006), JSCR · Fórmula primaria: Epley (ADR-01), con banda de dispersión entre las 8 fórmulas de referencia (ADR-02)."
      />

      <Aviso tono="info" titulo="Orden de los ejercicios">
        Están ordenados de más a menos exigentes. Hazlos en ese orden: un test
        de sentadilla después de veinte minutos de trabajo de brazo mide otra
        cosa.
      </Aviso>

      <div className="space-y-4">
        {ejercicios.map((ejercicio, indice) => {
          const estado = estados[ejercicio.id] ?? {
            carga: "",
            pesoEquipo: "0",
            reps: "",
            rir: "",
          };

          const cargaTotal =
            toNumber(estado.carga) + toNumber(estado.pesoEquipo);
          const reps = toEntero(estado.reps);
          const rir = estado.rir === "" ? null : Number(estado.rir);

          const estimacion =
            !ejercicio.esDeTiempo && cargaTotal > 0 && reps > 0
              ? estimarRm(cargaTotal, reps, { rirReportado: rir })
              : null;

          const ajuste =
            !ejercicio.esDeTiempo && cargaTotal > 0 && reps > 0
              ? sugerirAjusteCarga(cargaTotal, reps, {
                  tren: resolverTren(ejercicio.patron),
                  incrementoMinimoKg: ejercicio.incrementoMinimoKg,
                  rirReportado: rir,
                })
              : null;

          return (
            <article
              key={ejercicio.id}
              className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle"
            >
              <input type="hidden" name="ejercicioIds" value={ejercicio.id} />
              <input
                type="hidden"
                name={`carga_${ejercicio.id}`}
                value={ejercicio.esDeTiempo ? 0 : toNumber(estado.carga)}
              />
              <input
                type="hidden"
                name={`pesoEquipo_${ejercicio.id}`}
                value={ejercicio.esDeTiempo ? 0 : toNumber(estado.pesoEquipo)}
              />
              <input
                type="hidden"
                name={`repeticiones_${ejercicio.id}`}
                value={reps}
              />
              <input
                type="hidden"
                name={`rir_${ejercicio.id}`}
                value={estado.rir}
              />

              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-text-primary dark:text-white">
                    <span className="mr-2 text-xs tabular-nums text-text-tertiary">
                      {indice + 1}.
                    </span>
                    {ejercicio.nombre}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                    {ejercicio.esDeTiempo
                      ? "Repeticiones en 1 minuto · no produce RM"
                      : `Sugerido: ${formatWeight(ejercicio.cargaSugerida)} kg`}
                  </p>
                  {ejercicio.nota ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      {ejercicio.nota}
                    </p>
                  ) : null}
                </div>
              </header>

              {ejercicio.esDeTiempo ? (
                <div className="mt-3">
                  <label className="block sm:max-w-xs">
                    <span className="text-sm font-medium text-text-primary dark:text-white">
                      Repeticiones en 1 minuto
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={estado.reps}
                      onChange={(evento) =>
                        actualizar(ejercicio.id, { reps: evento.target.value })
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                      placeholder="0"
                    />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-text-tertiary">
                    Este ejercicio se mide por tiempo, así que no genera un 1RM.
                    Se guarda como registro de resistencia muscular.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-sm font-medium text-text-primary dark:text-white">
                        Peso levantado (kg)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={estado.carga}
                        onChange={(evento) =>
                          actualizar(ejercicio.id, {
                            carga: evento.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-text-primary dark:text-white">
                        Peso de barra/equipo (kg)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={estado.pesoEquipo}
                        onChange={(evento) =>
                          actualizar(ejercicio.id, {
                            pesoEquipo: evento.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-text-primary dark:text-white">
                        Repeticiones
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={estado.reps}
                        onChange={(evento) =>
                          actualizar(ejercicio.id, {
                            reps: evento.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-sm font-medium text-text-primary dark:text-white">
                      ¿Cuántas repeticiones más habrías podido hacer?
                    </span>
                    <span className="mt-1 block text-xs text-text-tertiary">
                      Responde pensando en el momento en que paraste. Si llegaste
                      al límite real, elige 0.
                    </span>
                    <div className="mt-2 sm:max-w-sm">
                      <Select
                        options={OPCIONES_RIR}
                        value={estado.rir}
                        onChange={(valor) =>
                          actualizar(ejercicio.id, { rir: valor })
                        }
                        placeholder="Selecciona"
                        ariaLabel={`Repeticiones en reserva en ${ejercicio.nombre}`}
                      />
                    </div>
                  </label>

                  {estimacion && ajuste ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-bg-soft p-3 sm:grid-cols-3 dark:border-white/10 dark:bg-bg-main">
                        <Metrica
                          etiqueta="1RM estimado"
                          valor={
                            estimacion.valor > 0
                              ? `${formatWeight(estimacion.valor)} kg`
                              : "-"
                          }
                        />
                        <Metrica
                          etiqueta="Banda entre fórmulas"
                          valor={
                            estimacion.valor > 0
                              ? `${formatWeight(estimacion.min)} – ${formatWeight(estimacion.max)} kg`
                              : "-"
                          }
                        />
                        <Metrica
                          etiqueta="Confianza"
                          valor={
                            estimacion.confianza === "alta"
                              ? "Alta"
                              : estimacion.confianza === "media"
                                ? "Media"
                                : "Baja"
                          }
                        />
                      </div>

                      {ajuste.accion === "ninguno" ? (
                        <Aviso tono="exito">{ajuste.mensaje}</Aviso>
                      ) : (
                        <Aviso tono="alerta" titulo="Repite este intento">
                          {ajuste.mensaje}
                          <button
                            type="button"
                            onClick={() => {
                              actualizar(ejercicio.id, {
                                carga: String(
                                  Math.max(
                                    0,
                                    ajuste.cargaSugerida -
                                      toNumber(estado.pesoEquipo),
                                  ),
                                ),
                                reps: "",
                                rir: "",
                              });
                              setSegundosRestantes(180);
                              setSegundosTotales(180);
                            }}
                            className="mt-2 block rounded-xl border border-transparent bg-text-primary px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
                          >
                            Usar {formatWeight(ajuste.cargaSugerida)} kg y
                            empezar descanso
                          </button>
                        </Aviso>
                      )}

                      {estimacion.repeticionesEfectivas !== reps ? (
                        <p className="text-xs leading-5 text-text-tertiary">
                          El cálculo usa {estimacion.repeticionesEfectivas}{" "}
                          repeticiones: las {reps} que hiciste más las {rir} que
                          te quedaban.
                        </p>
                      ) : null}

                      {estimacion.noUtilizable ? (
                        <Aviso tono="error">
                          Con estas repeticiones la estimación no sirve para
                          prescribir carga. Se guardará como registro histórico,
                          pero no actualizará tu RM de trabajo.
                        </Aviso>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              {indice < ejercicios.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSegundosRestantes(descansoEntreEjerciciosSeg);
                    setSegundosTotales(descansoEntreEjerciciosSeg);
                  }}
                  className="mt-4 rounded-2xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-text-primary transition hover:bg-bg-soft dark:border-white/10 dark:text-white"
                >
                  Descansar {Math.round(descansoEntreEjerciciosSeg / 60)} min
                  antes del siguiente ejercicio
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {resumen.validos + resumen.porAjustar > 0 ? (
        <Aviso tono={resumen.porAjustar > 0 ? "alerta" : "exito"}>
          {resumen.validos} {resumen.validos === 1 ? "intento" : "intentos"}{" "}
          dentro de la ventana precisa
          {resumen.porAjustar > 0 ? (
            <>
              {" "}
              y {resumen.porAjustar} fuera. Puedes guardar igualmente: los que
              queden fuera se registran marcados como poco fiables y no
              reemplazan tu RM de trabajo.
            </>
          ) : (
            <>. Puedes guardar la sesión.</>
          )}
        </Aviso>
      ) : null}

      {segundosRestantes > 0 ? (
        <div
          className="fixed bottom-5 right-5 z-50 grid h-24 w-24 place-items-center rounded-full shadow-2xl shadow-accent/30"
          style={{
            background: `conic-gradient(var(--accent) ${progreso}%, var(--bg-subtle) 0)`,
          }}
          aria-label={`Descanso: ${minutos}:${segundos}`}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-bg-main ring-1 ring-black/5 dark:bg-bg-soft dark:ring-white/10">
            <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary dark:text-white">
              {minutos}:{segundos}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
        {etiqueta}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-text-primary dark:text-white">
        {valor}
      </p>
    </div>
  );
}
