"use client";

import { useEffect, useMemo, useState } from "react";

import { Aviso, ComoFunciona } from "@/components/rm/ComoFunciona";
import { Select } from "@/components/ui/Select";
import {
  compararConRmVigente,
  CAMBIO_MINIMO_DETECTABLE,
} from "@/lib/rm/estimacion";
import {
  construirIntentosExtra,
  MAX_INTENTOS_MAXIMOS_RECOMENDADOS,
  OMNI_RES_ESCALA,
  PASOS_CASAS,
  PASOS_NACLERIO,
  repeticionesDelMejorIntento,
  resolverRmMedido,
  type PasoEjecutado,
  type PasoProtocolo,
} from "@/lib/rm/protocolo";

export type ProtocoloId = "casas" | "naclerio";

type EstadoPaso = {
  pesoReal: string;
  repsReales: string;
  completado: boolean;
  omniRes: string;
};

const ESTADO_VACIO: EstadoPaso = {
  pesoReal: "",
  repsReales: "",
  completado: false,
  omniRes: "",
};

type Props = {
  protocolo: ProtocoloId;
  formatWeight: (value: number) => string;
  onRmMedidoChange?: (rm: number) => void;
};

const DEFINICIONES: Record<
  ProtocoloId,
  {
    nombre: string;
    pasos: PasoProtocolo[];
    resumen: string;
    pasosGuia: { titulo: string; detalle: string }[];
    porQue: string;
    fuente: string;
    exigeOmniRes: boolean;
  }
> = {
  casas: {
    nombre: "Protocolo Casas",
    pasos: PASOS_CASAS,
    resumen:
      "Es un test directo: no calcula tu fuerza con una fórmula, la mide. Subes la carga por escalones hasta el peso más alto que puedas levantar una vez con técnica válida. Ese peso es tu RM.",
    pasosGuia: [
      {
        titulo: "Escribe el ejercicio y su RM previo",
        detalle:
          "Si ya tienes un RM registrado se rellena solo. Si no, pon tu mejor estimación: solo sirve para calcular los pesos de aproximación.",
      },
      {
        titulo: "Sigue los escalones en orden",
        detalle:
          "Cada paso te dice el peso sugerido, las repeticiones y el descanso. El cronómetro arranca cuando registras el paso.",
      },
      {
        titulo: "Anota siempre el peso real que pusiste",
        detalle:
          "Aunque no coincida con el sugerido. El RM sale de lo que levantaste, no de lo que la app propuso.",
      },
      {
        titulo: "Marca si completaste el levantamiento",
        detalle:
          "Un intento fallido también se registra, pero sin marcar. Solo los levantamientos completados pueden convertirse en tu RM.",
      },
      {
        titulo: "Para cuando falles un intento",
        detalle:
          "El test termina ahí. Tu RM es el peso más alto que completaste, no el que intentaste.",
      },
    ],
    porQue:
      "La app nunca deriva tu RM de un peso teórico. Si dejas los pesos reales en blanco, el test no se puede cerrar: es la única forma de garantizar que el número que después usa tu planificación corresponde a algo que de verdad levantaste.",
    fuente:
      "Los porcentajes y descansos son convención del proyecto (ADR-17, sin fuente bibliográfica aportada aún). La estructura de aproximaciones y el límite de intentos siguen las pautas de la NSCA.",
    exigeOmniRes: false,
  },
  naclerio: {
    nombre: "Test progresivo de Naclerio",
    pasos: PASOS_NACLERIO,
    resumen:
      "Ocho series de 2 a 3 repeticiones con cargas crecientes, ejecutando cada repetición a la máxima velocidad posible. Al terminar cada serie reportas cuánto esfuerzo te costó en una escala de 0 a 10. El RM es el peso más alto que completes.",
    pasosGuia: [
      {
        titulo: "Escribe el ejercicio y su RM previo",
        detalle:
          "Los porcentajes de cada serie se calculan sobre él. Si te equivocas por mucho, el test se alarga pero no se invalida: siempre manda el peso real.",
      },
      {
        titulo: "Acelera al máximo cada repetición",
        detalle:
          "No es levantar lento y controlado. La intención de mover rápido es parte del protocolo: es lo que hace comparables las series entre sí.",
      },
      {
        titulo: "Reporta el esfuerzo al terminar cada serie",
        detalle:
          "La escala OMNI-RES va de 0 (nada) a 10 (no podía más). Si llegas a 10 antes de la serie 7, el RM de referencia estaba alto y conviene parar.",
      },
      {
        titulo: "Registra peso real, repeticiones y si lo completaste",
        detalle:
          "Los pesos sugeridos son una guía. Lo que cuenta para tu RM es lo que quedó en la barra y salió completo.",
      },
      {
        titulo: "Como mucho, dos intentos extra",
        detalle:
          "Si completas la serie 8, aparecen hasta dos intentos más subiendo el incremento real del equipo. Más allá de eso la fatiga distorsiona la medida.",
      },
    ],
    porQue:
      "El protocolo original (Naclerio y Figueroa, 2004) define 8±2 series de 2-3 repeticiones con máxima aceleración y RPE OMNI-RES en cada una. La versión anterior de esta app no seguía ese protocolo y permitía cerrar el test con pesos que nadie había levantado; esto lo corrige.",
    fuente:
      "Naclerio & Figueroa (2004), test progresivo de cargas incrementales; escala OMNI-RES 0-10 de Robertson et al.",
    exigeOmniRes: true,
  },
};

function toNumber(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function redondear(peso: number, incremento: number) {
  const paso = Number.isFinite(incremento) && incremento > 0 ? incremento : 2.5;
  if (!Number.isFinite(peso) || peso <= 0) return 0;
  return Math.round(peso / paso) * paso;
}

export function ProtocoloDirecto({
  protocolo,
  formatWeight,
  onRmMedidoChange,
}: Props) {
  const definicion = DEFINICIONES[protocolo];

  const [ejercicioNombre, setEjercicioNombre] = useState("");
  const [rmReferencia, setRmReferencia] = useState("");
  const [pasoActivo, setPasoActivo] = useState(0);
  // Indexado por número de paso, no por posición: así aparecer o desaparecer
  // intentos extra no obliga a re-sincronizar un array en un efecto.
  const [estados, setEstados] = useState<Record<number, EstadoPaso>>({});
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [segundosTotales, setSegundosTotales] = useState(0);
  const [etiquetaTemporizador, setEtiquetaTemporizador] = useState("");

  const nombreNormalizado = ejercicioNombre.trim();
  const incremento = 2.5;
  const referencia = toNumber(rmReferencia);

  useEffect(() => {
    if (segundosRestantes <= 0) return;

    const intervalo = window.setInterval(() => {
      setSegundosRestantes((actual) => Math.max(actual - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [segundosRestantes]);

  function estadoDe(numero: number): EstadoPaso {
    return estados[numero] ?? ESTADO_VACIO;
  }

  function actualizarPaso(numero: number, cambios: Partial<EstadoPaso>) {
    setEstados((actuales) => ({
      ...actuales,
      [numero]: { ...(actuales[numero] ?? ESTADO_VACIO), ...cambios },
    }));
  }

  const pasosBase = definicion.pasos;
  const ultimoBase = pasosBase[pasosBase.length - 1];
  const estadoUltimoBase = estados[ultimoBase.numero] ?? ESTADO_VACIO;
  const pesoUltimoBaseReal = toNumber(estadoUltimoBase.pesoReal);
  const ultimoBaseCompletado =
    estadoUltimoBase.completado && pesoUltimoBaseReal > 0;

  // ADR-32: los intentos extra suben el incremento real del equipo sobre el
  // peso realmente levantado, no un porcentaje compuesto sobre un RM teórico.
  const pasosExtra = useMemo(() => {
    if (!ultimoBaseCompletado || referencia <= 0) return [];

    return construirIntentosExtra(pesoUltimoBaseReal, incremento).map(
      (paso, indice) => ({
        ...paso,
        numero: pasosBase.length + indice + 1,
        porcentaje:
          (pesoUltimoBaseReal + incremento * (indice + 1)) / referencia,
      }),
    );
  }, [
    incremento,
    pasosBase.length,
    pesoUltimoBaseReal,
    referencia,
    ultimoBaseCompletado,
  ]);

  const pasos = useMemo(
    () => [...pasosBase, ...pasosExtra],
    [pasosBase, pasosExtra],
  );

  const ejecutados: PasoEjecutado[] = useMemo(
    () =>
      pasos.map((paso) => {
        const estado = estados[paso.numero] ?? ESTADO_VACIO;
        const objetivo = redondear(referencia * paso.porcentaje, incremento);
        const objetivoMax = redondear(
          referencia * (paso.porcentajeMax ?? paso.porcentaje),
          incremento,
        );

        return {
          ...paso,
          pesoObjetivo: objetivo,
          pesoObjetivoMax: objetivoMax,
          pesoObjetivoLabel:
            objetivo === objetivoMax
              ? formatWeight(objetivo)
              : `${formatWeight(objetivo)}–${formatWeight(objetivoMax)}`,
          pesoReal: toNumber(estado.pesoReal),
          repsReales: Number.isFinite(Number(estado.repsReales))
            ? Math.max(0, Math.floor(Number(estado.repsReales)))
            : 0,
          completado: estado.completado,
          omniRes: estado.omniRes === "" ? null : Number(estado.omniRes),
        };
      }),
    [estados, formatWeight, incremento, pasos, referencia],
  );

  const rmMedido = useMemo(() => resolverRmMedido(ejecutados), [ejecutados]);
  const repsMejorIntento = useMemo(
    () => repeticionesDelMejorIntento(ejecutados),
    [ejecutados],
  );
  const comparacion = useMemo(
    () => compararConRmVigente(rmMedido.valorKg, referencia || null),
    [referencia, rmMedido.valorKg],
  );

  useEffect(() => {
    onRmMedidoChange?.(rmMedido.valorKg);
  }, [onRmMedidoChange, rmMedido.valorKg]);

  const datosProtocolo = {
    metodo: protocolo,
    ejercicioNombre: nombreNormalizado,
    rmReferencia: referencia,
    rmMedido: rmMedido.valorKg,
    repeticionesMejorIntento: repsMejorIntento,
    intentosMaximos: rmMedido.intentosMaximos,
    pasos: ejecutados.map((paso) => ({
      numero: paso.numero,
      nombre: paso.nombre,
      fase: paso.fase,
      porcentaje: Math.round(paso.porcentaje * 1000) / 1000,
      pesoObjetivo: paso.pesoObjetivo,
      pesoReal: paso.pesoReal,
      repsObjetivo: paso.reps,
      repsReales: paso.repsReales,
      completado: paso.completado,
      omniRes: paso.omniRes,
    })),
  };

  const indiceActivo = Math.min(pasoActivo, ejecutados.length - 1);
  const actual = ejecutados[indiceActivo];
  const estadoActual = actual ? estadoDe(actual.numero) : ESTADO_VACIO;
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");
  const progresoTemporizador =
    segundosTotales > 0 ? (segundosRestantes / segundosTotales) * 100 : 0;

  function iniciarDescanso(paso: PasoEjecutado) {
    setSegundosRestantes(paso.descansoSeg);
    setSegundosTotales(paso.descansoSeg);
    setEtiquetaTemporizador(paso.nombre);
  }

  function registrarYAvanzar() {
    if (!actual) return;
    if (actual.pesoReal > 0) {
      iniciarDescanso(actual);
    }
    setPasoActivo(Math.min(indiceActivo + 1, ejecutados.length - 1));
  }

  return (
    <div className="space-y-5">
      <input
        type="hidden"
        name="protocolData"
        value={JSON.stringify(datosProtocolo)}
      />
      <input
        type="hidden"
        name="protocoloEjercicioNombre"
        value={nombreNormalizado}
      />
      <input type="hidden" name="estimatedRM" value={referencia} />
      <input type="hidden" name="finalRM" value={rmMedido.valorKg} />
      <input
        type="hidden"
        name="protocoloRepeticiones"
        value={repsMejorIntento}
      />

      <ComoFunciona
        titulo={`Cómo funciona el ${definicion.nombre}`}
        resumen={definicion.resumen}
        pasos={definicion.pasosGuia}
        porQue={definicion.porQue}
        fuente={definicion.fuente}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Ejercicio evaluado
          </span>
          <span className="mt-1 block text-xs leading-5 text-text-tertiary sm:min-h-10">
            El RM queda registrado para este ejercicio y solo para este.
          </span>
          <input
            type="text"
            value={ejercicioNombre}
            onChange={(evento) => setEjercicioNombre(evento.target.value)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            placeholder="Ej. Press banca con barra"
            maxLength={120}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            1RM previo de este ejercicio (kg)
          </span>
          <span className="mt-1 block text-xs leading-5 text-text-tertiary sm:min-h-10">
            Escríbelo manualmente. Solo se usa para calcular los pesos de
            aproximación del ejercicio indicado.
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={rmReferencia}
            onChange={(evento) => setRmReferencia(evento.target.value)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            placeholder="Ej. 100"
          />
        </label>
      </div>

      {!nombreNormalizado || referencia <= 0 ? (
        <Aviso tono="info">
          Escribe el ejercicio y su RM previo para generar los
          pesos de cada paso.
        </Aviso>
      ) : null}

      {nombreNormalizado && referencia > 0 && actual ? (
        <article className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
              Paso {indiceActivo + 1} de {ejecutados.length}
              {actual.fase === "maxima" || actual.fase === "intento_extra"
                ? " · intento máximo"
                : ""}
            </p>
            <p className="text-base font-semibold text-text-primary dark:text-white">
              {actual.nombre}
            </p>
            <p className="text-sm text-text-secondary">
              Peso sugerido: {actual.pesoObjetivoLabel} kg · Repeticiones
              objetivo: {actual.reps} · Descanso después:{" "}
              {Math.round(actual.descansoSeg / 60)} min
            </p>
            <p className="text-sm leading-6 text-text-secondary">
              {actual.indicacion}
            </p>
          </header>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Peso real levantado (kg)
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={estadoActual.pesoReal}
                onChange={(evento) =>
                  actualizarPaso(actual.numero, {
                    pesoReal: evento.target.value,
                  })
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                placeholder={String(actual.pesoObjetivo)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Repeticiones completadas
              </span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={estadoActual.repsReales}
                onChange={(evento) =>
                  actualizarPaso(actual.numero, {
                    repsReales: evento.target.value,
                  })
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                placeholder={String(actual.reps)}
              />
            </label>
          </div>

          {definicion.exigeOmniRes ? (
            <label className="mt-3 block">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Esfuerzo percibido (OMNI-RES 0–10)
              </span>
              <span className="mt-1 block text-xs text-text-tertiary">
                Cómo se sintió la serie al terminarla. 10 significa que no
                habrías podido hacer una repetición más.
              </span>
              <div className="mt-2">
                <Select
                  options={OMNI_RES_ESCALA.map((nivel) => ({
                    value: String(nivel.valor),
                    label: nivel.etiqueta,
                  }))}
                  value={estadoActual.omniRes}
                  onChange={(valor) =>
                    actualizarPaso(actual.numero, { omniRes: valor })
                  }
                  placeholder="Selecciona el esfuerzo"
                  ariaLabel="Esfuerzo percibido OMNI-RES"
                />
              </div>
            </label>
          ) : null}

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 dark:border-white/10 dark:bg-bg-main">
            <input
              type="checkbox"
              checked={estadoActual.completado}
              onChange={(evento) =>
                actualizarPaso(actual.numero, {
                  completado: evento.target.checked,
                })
              }
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-text-primary dark:text-white">
                Completé el levantamiento con técnica válida
              </span>
              <span className="block text-xs leading-5 text-text-tertiary">
                Déjalo sin marcar si fallaste el intento o si necesitaste ayuda.
                Solo los pasos marcados pueden convertirse en tu RM.
              </span>
            </span>
          </label>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setPasoActivo(Math.max(indiceActivo - 1, 0))}
              disabled={indiceActivo === 0}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={registrarYAvanzar}
              disabled={indiceActivo >= ejecutados.length - 1}
              className="rounded-2xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
            >
              Registrar y descansar
            </button>
            <p className="text-sm text-text-secondary sm:ml-auto">
              RM medido:{" "}
              <span className="font-semibold text-text-primary dark:text-white">
                {rmMedido.valorKg > 0
                  ? `${formatWeight(rmMedido.valorKg)} kg`
                  : "pendiente"}
              </span>
            </p>
          </div>
        </article>
      ) : null}

      {nombreNormalizado && referencia > 0 ? (
        <div className="space-y-3">
          {rmMedido.valorKg <= 0 ? (
            <Aviso tono="alerta" titulo="Todavía no hay un RM medido">
              Registra el peso real y marca al menos un levantamiento como
              completado. El test no se puede guardar con el RM de referencia
              que escribiste a mano: ese número no lo levantó nadie.
            </Aviso>
          ) : null}

          {comparacion ? (
            <Aviso tono={comparacion.esCambioReal ? "exito" : "alerta"}>
              {comparacion.mensaje}
              {!comparacion.esCambioReal ? (
                <>
                  {" "}
                  Dos tests del mismo atleta difieren típicamente un{" "}
                  {(CAMBIO_MINIMO_DETECTABLE * 100).toFixed(1)} % por puro error
                  de medición.
                </>
              ) : null}
            </Aviso>
          ) : null}

          {rmMedido.excedeIntentosRecomendados ? (
            <Aviso tono="error" titulo="Demasiados intentos máximos">
              Llevas {rmMedido.intentosMaximos} intentos por encima de los{" "}
              {MAX_INTENTOS_MAXIMOS_RECOMENDADOS} recomendados. A partir de aquí
              la fatiga baja tu rendimiento y el test mide cansancio, no fuerza.
              Cierra la sesión con el mejor intento válido.
            </Aviso>
          ) : null}

          {pasosExtra.length > 0 ? (
            <Aviso tono="info" titulo="Intentos extra desbloqueados">
              Completaste la última serie del protocolo. Se añadieron{" "}
              {pasosExtra.length} intentos más, subiendo {incremento} kg reales
              cada uno. Haz solo los que puedas completar con técnica limpia.
            </Aviso>
          ) : null}
        </div>
      ) : null}

      {segundosRestantes > 0 ? (
        <div
          className="fixed bottom-5 right-5 z-50 grid h-24 w-24 place-items-center rounded-full shadow-2xl shadow-accent/30"
          style={{
            background: `conic-gradient(var(--accent) ${progresoTemporizador}%, var(--bg-subtle) 0)`,
          }}
          aria-label={`Descanso ${etiquetaTemporizador}: ${minutos}:${segundos}`}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-bg-main ring-1 ring-black/5 dark:bg-bg-soft dark:ring-white/10">
            <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary dark:text-white">
              {minutos}:{segundos}
            </span>
          </div>
        </div>
      ) : null}

      {nombreNormalizado && referencia > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="px-4 pt-4 text-left text-xs text-text-tertiary">
              Todos los pasos del protocolo. Puedes editarlos en cualquier
              orden; el paso activo de arriba es solo una ayuda para no
              perderte.
            </caption>
            <thead className="text-xs uppercase tracking-[0.16em] text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Paso</th>
                <th className="px-4 py-3 font-medium">Sugerido</th>
                <th className="px-4 py-3 font-medium">Reps obj.</th>
                <th className="px-4 py-3 font-medium">Peso real</th>
                <th className="px-4 py-3 font-medium">Reps reales</th>
                <th className="px-4 py-3 font-medium">¿Completado?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {ejecutados.map((paso, indice) => (
                <tr
                  key={paso.numero}
                  className={indice === indiceActivo ? "bg-accent/5" : undefined}
                >
                  <td className="px-4 py-3">
                    <span className="block text-text-primary dark:text-white">
                      {paso.nombre}
                    </span>
                    <span className="block text-xs text-text-tertiary">
                      {Math.round(paso.porcentaje * 100)} % del RM de referencia
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-secondary">
                    {paso.pesoObjetivoLabel} kg
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-secondary">
                    {paso.reps}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      aria-label={`Peso real del paso ${paso.numero}`}
                      value={estadoDe(paso.numero).pesoReal}
                      onChange={(evento) =>
                        actualizarPaso(paso.numero, {
                          pesoReal: evento.target.value,
                        })
                      }
                      className="w-24 rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-label={`Repeticiones reales del paso ${paso.numero}`}
                      value={estadoDe(paso.numero).repsReales}
                      onChange={(evento) =>
                        actualizarPaso(paso.numero, {
                          repsReales: evento.target.value,
                        })
                      }
                      className="w-20 rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-right tabular-nums text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Paso ${paso.numero} completado`}
                      checked={estadoDe(paso.numero).completado}
                      onChange={(evento) =>
                        actualizarPaso(paso.numero, {
                          completado: evento.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
