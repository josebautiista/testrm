"use client";

import { useMemo, useState, useTransition } from "react";

import { Aviso, ComoFunciona } from "@/components/rm/ComoFunciona";
import {
  guardarCompetenciasAction,
  guardarPerfilDeportivoAction,
} from "@/actions/macrociclo";
import {
  CAPACIDADES,
  CAPACIDADES_SALUD,
  ESTRUCTURAS_CALENDARIO,
  modoCalendarioDe,
  NIVELES,
  semanasMinimasPara,
  type CapacidadDominante,
  type EstructuraCalendario,
  type PerfilDeportivo,
} from "@/lib/planificacion/perfil";
import { revisarEspacioTransitorio } from "@/lib/planificacion/taper";
import type { NivelAtleta } from "@/lib/planificacion/tipos";

export type CompetenciaEditable = {
  nombre: string;
  fecha: string;
  importancia: "principal" | "secundaria";
};

type Props = {
  cc: string;
  macrocicloId: number;
  /** Objetivo elegido en el paso 1. Preselecciona el calendario (ADR-39). */
  objetivoTipo: string;
  perfilInicial: PerfilDeportivo;
  competenciasIniciales: CompetenciaEditable[];
  totalSemanas: number;
  /** Fecha final del macrociclo, para comprobar que cabe el transitorio. */
  fechaFin: string;
  onGuardado?: (perfil: PerfilDeportivo, competencias: CompetenciaEditable[]) => void;
};

export function PasoPerfil({
  cc,
  macrocicloId,
  objetivoTipo,
  perfilInicial,
  competenciasIniciales,
  totalSemanas,
  fechaFin,
  onGuardado,
}: Props) {
  const [capacidad, setCapacidad] = useState<CapacidadDominante>(
    perfilInicial.capacidad,
  );
  const [calendario, setCalendario] = useState<EstructuraCalendario>(
    perfilInicial.calendario,
  );
  // Si el objetivo del paso 1 es Salud, lo normal es no competir. Se
  // preselecciona pero no se bloquea: alguien puede entrenar por salud y aun
  // así tener una carrera popular en el calendario.
  const objetivoEsSalud = objetivoTipo === "salud";
  const [nivel, setNivel] = useState<NivelAtleta>(perfilInicial.nivel);
  const [competencias, setCompetencias] = useState<CompetenciaEditable[]>(
    competenciasIniciales,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const perfil: PerfilDeportivo = useMemo(
    () => ({ capacidad, calendario, nivel }),
    [calendario, capacidad, nivel],
  );

  const minimo = semanasMinimasPara(perfil);
  const duracionInsuficiente = totalSemanas > 0 && totalSemanas < minimo;
  // ADR-39: el calendario se muestra siempre. Lo que cambia es qué son esas
  // fechas: competencias a defender, o hitos que quieres medir.
  const modo = modoCalendarioDe(perfil);
  const esObjetivo = modo === "objetivo";
  const sinPrincipal =
    competencias.length > 0 &&
    !competencias.some((competencia) => competencia.importancia === "principal");

  // M-04: el transitorio va después de competir. Si el macrociclo termina el
  // mismo día de la última competencia principal, no cabe.
  const espacioTransitorio = useMemo(() => {
    const fin = fechaFin ? new Date(`${fechaFin}T00:00:00`) : null;
    if (!fin || Number.isNaN(fin.getTime())) return null;

    return revisarEspacioTransitorio(
      fin,
      competencias
        .map((competencia) => {
          const fecha = competencia.fecha
            ? new Date(`${competencia.fecha}T00:00:00`)
            : null;
          return fecha && !Number.isNaN(fecha.getTime())
            ? {
                fecha,
                importancia: competencia.importancia,
                nombre: competencia.nombre || undefined,
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      modo,
    );
  }, [competencias, fechaFin, modo]);

  function actualizarCompetencia(
    indice: number,
    cambios: Partial<CompetenciaEditable>,
  ) {
    setCompetencias((actuales) =>
      actuales.map((competencia, i) =>
        i === indice ? { ...competencia, ...cambios } : competencia,
      ),
    );
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const datosPerfil = new FormData();
      datosPerfil.set("cc", cc);
      datosPerfil.set("id", String(macrocicloId));
      datosPerfil.set("capacidadDominante", capacidad);
      datosPerfil.set("estructuraCalendario", calendario);
      datosPerfil.set("nivelAtleta", nivel);

      const resultadoPerfil = await guardarPerfilDeportivoAction(datosPerfil);
      if ("error" in resultadoPerfil) {
        setError(resultadoPerfil.error ?? "No fue posible guardar el perfil.");
        return;
      }

      const datosCompetencias = new FormData();
      datosCompetencias.set("cc", cc);
      datosCompetencias.set("id", String(macrocicloId));
      datosCompetencias.set("competencias", JSON.stringify(competencias));

      const resultadoCompetencias =
        await guardarCompetenciasAction(datosCompetencias);
      if ("error" in resultadoCompetencias) {
        setError(
          resultadoCompetencias.error ??
            "No fue posible guardar las competencias.",
        );
        return;
      }

      setGuardado(true);
      onGuardado?.(perfil, competencias);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Perfil del atleta y del deporte
        </h2>
        <p className="text-sm text-text-secondary">
          Tres preguntas que definen la forma de todo el plan.
        </p>
      </div>

      <ComoFunciona
        titulo="Por qué no te preguntamos qué deporte practicas"
        resumen="Porque el nombre del deporte no dice cómo hay que entrenar —un lanzador de peso y un halterófilo entrenan parecido aunque sean deportes distintos— y porque puede que no practiques ninguno. Estas tres preguntas son las que de verdad cambian la forma del plan, y funcionan igual entrenes para competir o para estar mejor."
        pasos={[
          {
            titulo: "Si compites y con qué frecuencia",
            detalle:
              "Decide cuánto del plan se dedica a construir y cuánto a llegar en forma a un día concreto. Si no compites, todo el tiempo va a construir.",
          },
          {
            titulo: "Qué quieres priorizar",
            detalle:
              "Define en qué se gasta ese tiempo: bloques de fuerza, de base o repartidos. Si practicas un deporte, lo marca la capacidad que ese deporte exige.",
          },
          {
            titulo: "Tu nivel de entrenamiento",
            detalle:
              "Decide si conviene concentrar la carga en bloques duros o repartirla. En principiantes cualquier plan ordenado funciona, así que se evita el riesgo innecesario.",
          },
        ]}
        porQue="La investigación reciente no encuentra un modelo de periodización superior a los demás: lineal, ondulante y por bloques dan resultados parecidos, con ventaja pequeña de los bloques en atletas avanzados. Lo que sí determina el resultado es que la estructura encaje con tus demandas y tu calendario. Por eso el motor es el mismo para todos y lo que cambia son estos tres parámetros."
        fuente="Meta-análisis comparativos de modelos de periodización (2019-2025); needs analysis de la NSCA."
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-text-primary dark:text-white">
          1 · ¿Compites en algo?
        </legend>
        <p className="text-sm leading-6 text-text-secondary">
          Esta respuesta decide cuánto del plan se dedica a construir y cuánto a
          llegar en forma a un día concreto. Si no compites, todo el tiempo se
          dedica a construir.
        </p>
        {objetivoEsSalud && calendario !== "sin_competencia" ? (
          <Aviso tono="alerta">
            En el paso 1 elegiste objetivo{" "}
            <strong className="text-text-primary dark:text-white">Salud</strong>
            , y has marcado una estructura con competencias. Es posible —hay
            quien entrena por salud y corre una carrera popular— pero revisa que
            sea lo que quieres.
          </Aviso>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {ESTRUCTURAS_CALENDARIO.map((opcion) => (
            <OpcionTarjeta
              key={opcion.value}
              nombre="calendario"
              checked={calendario === opcion.value}
              label={opcion.label}
              descripcion={opcion.descripcion}
              ejemplos={opcion.ejemplos}
              onSelect={() => {
                setCalendario(opcion.value);
                setGuardado(false);
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-text-primary dark:text-white">
          {esObjetivo
            ? "2 · ¿Qué quieres priorizar?"
            : "2 · ¿Qué capacidad domina en tu deporte?"}
        </legend>
        {esObjetivo ? (
          <p className="text-sm leading-6 text-text-secondary">
            No hace falta que practiques un deporte. Elige hacia dónde quieres
            inclinar el plan; si no lo tienes claro,{" "}
            <strong className="text-text-primary dark:text-white">
              Mixto o equilibrado
            </strong>{" "}
            reparte el tiempo de forma pareja y es la opción segura. Sin
            competencias, la diferencia entre las cuatro es de una o dos semanas
            por bloque.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(esObjetivo ? CAPACIDADES_SALUD : CAPACIDADES).map((opcion) => (
            <OpcionTarjeta
              key={opcion.value}
              nombre="capacidad"
              checked={capacidad === opcion.value}
              label={opcion.label}
              descripcion={opcion.descripcion}
              ejemplos={opcion.ejemplos}
              onSelect={() => {
                setCapacidad(opcion.value);
                setGuardado(false);
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-text-primary dark:text-white">
          3 · ¿Cuál es tu nivel de entrenamiento?
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {NIVELES.map((opcion) => (
            <OpcionTarjeta
              key={opcion.value}
              nombre="nivel"
              checked={nivel === opcion.value}
              label={opcion.label}
              descripcion={opcion.descripcion}
              onSelect={() => {
                setNivel(opcion.value);
                setGuardado(false);
              }}
            />
          ))}
        </div>
      </fieldset>

      {duracionInsuficiente ? (
        <Aviso tono="alerta" titulo="El macrociclo es corto para este perfil">
          Con este perfil hacen falta al menos {minimo} semanas para que quepan
          los bloques esenciales. Tu rango actual tiene {totalSemanas}. Puedes
          continuar: se omitirán los bloques accesorios y te diremos cuáles, pero
          alargar las fechas daría un plan mejor.
        </Aviso>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary dark:text-white">
            {esObjetivo ? "Fechas objetivo" : "Calendario de competencias"}
          </h3>
          <p className="text-sm leading-6 text-text-secondary">
            {esObjetivo ? (
              <>
                Un chequeo médico, un viaje, una caminata larga, una fecha en la
                que quieres sentirte de cierta forma. No son competencias, pero
                son hitos reales y el plan puede organizarse alrededor de ellos.
                Cada fecha coloca una{" "}
                <strong className="text-text-primary dark:text-white">
                  semana de evaluación
                </strong>{" "}
                ahí, para que midas justo cuando te importa. Si además marcas
                una como{" "}
                <strong className="text-text-primary dark:text-white">
                  principal
                </strong>
                , se recorta el volumen la semana previa para que llegues
                descansado.
              </>
            ) : (
              <>
                Añade las fechas que ya conoces. Marca como{" "}
                <strong className="text-text-primary dark:text-white">
                  principal
                </strong>{" "}
                solo aquellas en las que quieres estar en tu mejor momento: cada
                una recibirá dos semanas de afinamiento antes. Las secundarias
                reciben una sola, porque afinar para todas las fechas de una
                temporada equivale a no entrenar nunca.
              </>
            )}
          </p>
        </div>

        {competencias.length === 0 ? (
          <Aviso tono="info">
            {esObjetivo
              ? "Sin fechas, el plan sigue funcionando: coloca evaluaciones al principio, cada 10 semanas y al final. Añade fechas propias solo si tienes hitos concretos."
              : "Sin fechas no se puede planificar el afinamiento previo a competir. Puedes añadirlas ahora o volver a este paso cuando las conozcas."}
          </Aviso>
        ) : null}

        <div className="space-y-3">
          {competencias.map((competencia, indice) => (
            <div
              key={indice}
              className="grid gap-3 rounded-2xl border border-gray-200 bg-bg-main p-3 sm:grid-cols-[1fr_10rem_9rem_auto] sm:items-end dark:border-white/10 dark:bg-bg-subtle"
            >
              <label className="block">
                <span className="text-xs font-medium text-text-tertiary">
                  Nombre
                </span>
                <input
                  type="text"
                  value={competencia.nombre}
                  onChange={(evento) =>
                    actualizarCompetencia(indice, {
                      nombre: evento.target.value,
                    })
                  }
                  placeholder={
                    esObjetivo ? "Ej. Chequeo médico" : "Ej. Campeonato nacional"
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-text-tertiary">
                  Fecha
                </span>
                <input
                  type="date"
                  value={competencia.fecha}
                  onChange={(evento) =>
                    actualizarCompetencia(indice, {
                      fecha: evento.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={competencia.importancia === "principal"}
                  onChange={(evento) =>
                    actualizarCompetencia(indice, {
                      importancia: evento.target.checked
                        ? "principal"
                        : "secundaria",
                    })
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-sm text-text-secondary">Principal</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setCompetencias((actuales) =>
                    actuales.filter((_, i) => i !== indice),
                  );
                  setGuardado(false);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-soft dark:border-white/10"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setCompetencias((actuales) => [
              ...actuales,
              {
                nombre: "",
                fecha: "",
                importancia: actuales.length === 0 ? "principal" : "secundaria",
              },
            ]);
            setGuardado(false);
          }}
          className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-soft dark:border-white/10 dark:text-white"
        >
          {esObjetivo ? "Añadir fecha objetivo" : "Añadir competencia"}
        </button>

        {espacioTransitorio ? (
          <Aviso tono="alerta" titulo="No cabe el periodo transitorio">
            {espacioTransitorio.aviso} Vuelve al paso 1 para cambiar la fecha
            final.
          </Aviso>
        ) : null}

        {sinPrincipal ? (
          <Aviso tono="alerta">
            {esObjetivo
              ? "Ninguna fecha está marcada como principal. Se evaluarán todas, pero no se recortará volumen antes de ninguna."
              : "Ninguna competencia está marcada como principal. Sin una fecha principal no se planifica el afinamiento completo de dos semanas."}
          </Aviso>
        ) : null}
      </section>

      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {guardado && !error ? (
        <Aviso tono="exito">
          Perfil guardado. La estructura del plan se recalculó con estos datos.
        </Aviso>
      ) : null}

      <button
        type="button"
        onClick={guardar}
        disabled={pendiente}
        className="rounded-2xl border border-transparent bg-text-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pendiente ? "Guardando..." : "Guardar y continuar"}
      </button>
    </div>
  );
}

function OpcionTarjeta({
  nombre,
  checked,
  label,
  descripcion,
  ejemplos,
  onSelect,
}: {
  nombre: string;
  checked: boolean;
  label: string;
  descripcion: string;
  ejemplos?: string;
  onSelect: () => void;
}) {
  return (
    <label className="cursor-pointer rounded-2xl border border-gray-200 bg-bg-main p-4 transition has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/20 dark:border-white/10 dark:bg-bg-subtle">
      <input
        type="radio"
        name={nombre}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="block text-sm font-semibold text-text-primary dark:text-white">
        {label}
      </span>
      <span className="mt-1 block text-sm leading-6 text-text-secondary">
        {descripcion}
      </span>
      {ejemplos ? (
        <span className="mt-2 block text-xs leading-5 text-text-tertiary">
          Por ejemplo: {ejemplos}
        </span>
      ) : null}
    </label>
  );
}
