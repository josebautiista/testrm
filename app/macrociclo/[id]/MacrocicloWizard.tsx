"use client";

import { useMemo, useState } from "react";

import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { WizardScrollControls } from "@/components/ui/WizardScrollControls";
import {
  type ObjetivoTipo,
  type TipoEtapa,
  type TipoMesociclo,
  type TipoMicrociclo,
  type TipoPeriodo,
  type Vo2maxSnapshot,
  OBJETIVOS,
  PASO_WIZARD,
  parseDateInput,
  toISODate,
} from "@/lib/macrociclo";
import {
  calcularPeriodizacion,
  contarSemanas,
} from "@/lib/macrociclo-periodizacion";
import {
  construirEstructura,
  isCapacidadDominante,
  isEstructuraCalendario,
  isNivelAtleta,
  modoCalendarioDe,
  PERFIL_POR_DEFECTO,
  type PerfilDeportivo,
} from "@/lib/planificacion/perfil";
import { type CargaMesocicloInputData } from "@/lib/mesociclo-carga";
import { guardarPasoObjetivoFechasAction } from "@/actions/macrociclo";
import {
  PasoRm,
  PasoVo2max,
  PasoSemanas,
  PasoCarga,
  PasoRevision,
} from "./wizard-steps";
import { PasoPerfil, type CompetenciaEditable } from "./PasoPerfil";
import { PasoEstructura } from "./PasoEstructura";

/**
 * ADR-37 · Perfil efectivo en cliente. Mismo criterio que
 * `services/macrociclo.service.ts resolverPerfil`: si falta un descriptor se
 * deriva del objetivo, para que el asistente nunca arranque sin perfil.
 */
function resolverPerfilCliente(macrociclo: {
  objetivoTipo: string;
  capacidadDominante?: string | null;
  estructuraCalendario?: string | null;
  nivelAtleta?: string | null;
}): PerfilDeportivo {
  return {
    capacidad: isCapacidadDominante(macrociclo.capacidadDominante)
      ? macrociclo.capacidadDominante
      : PERFIL_POR_DEFECTO.capacidad,
    calendario: isEstructuraCalendario(macrociclo.estructuraCalendario)
      ? macrociclo.estructuraCalendario
      : macrociclo.objetivoTipo === "competencia"
        ? "pico_unico"
        : "sin_competencia",
    nivel: isNivelAtleta(macrociclo.nivelAtleta)
      ? macrociclo.nivelAtleta
      : PERFIL_POR_DEFECTO.nivel,
  };
}

type MacrocicloCompetencia = {
  nombre: string;
  fecha: Date;
  importancia: string;
};

type MacrocicloPeriodo = {
  tipo: string;
  porcentaje: number;
  etapas: Array<{ tipo: string; porcentaje: number }>;
};

type MacrocicloMesociclo = {
  id: number;
  tipo: string;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  semanas: Array<{ numeroSemana: number; frecuencia: number; fechaInicio: Date; fechaFin: Date }>;
  carga: unknown;
};

type SemanaEjercicio = {
  ejercicioId: number;
  formulaRm: string;
  rm: number;
  peso: number;
  volumen: number;
};

type MacrocicloSemana = {
  numeroSemana: number;
  tipoMicrociclo: string;
  frecuencia: number;
  series: number;
  repeticiones: number;
  volumen: number;
  intensidad: number;
  ejercicios: SemanaEjercicio[];
};

type ResultadoRm = {
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

type MacrocicloWithRelations = {
  id: number;
  personaId: number;
  objetivoTipo: string;
  objetivoDetalle: string | null;
  capacidadDominante: string | null;
  estructuraCalendario: string | null;
  nivelAtleta: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  fechaCompetencia: Date | null;
  estado: string;
  pasoActual: number;
  sesionRmId: number | null;
  rmSnapshot: unknown;
  medidasSnapshot: unknown;
  vo2maxSnapshot: unknown;
  periodos: MacrocicloPeriodo[];
  mesociclos: MacrocicloMesociclo[];
  semanas: MacrocicloSemana[];
  competencias: MacrocicloCompetencia[];
  sesionRm?: {
    id: number;
    resultados: ResultadoRm[];
  } | null;
};

type Persona = {
  id: number;
  nombre: string;
  cc: string;
  masaCorporal: number;
  talla: number;
  cintura: number | null;
  cadera: number | null;
  /** ADR-43 · Base de la frecuencia semanal propuesta (C-12). */
  diasDisponibles?: number;
};

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

function leerRmSnapshot(value: unknown): {
  sesionIds: number[];
  resultados: ResultadoRm[];
} {
  if (!value || typeof value !== "object") {
    return { sesionIds: [], resultados: [] };
  }
  const snapshot = value as { sesionIds?: unknown; resultados?: unknown };
  const sesionIds = Array.isArray(snapshot.sesionIds)
    ? snapshot.sesionIds.filter(
        (id): id is number => Number.isInteger(id) && Number(id) > 0,
      )
    : [];
  const resultados = Array.isArray(snapshot.resultados)
    ? (snapshot.resultados as ResultadoRm[])
    : [];
  return { sesionIds, resultados };
}

/**
 * ADR-37: los tres pasos de porcentajes (Periodos, Etapas, Mesociclos) se
 * sustituyen por un único paso de Estructura, que ya no se rellena a mano
 * sino que se deriva del perfil deportivo. Antes el entrenador tenía que
 * cuadrar tres conjuntos de porcentajes que debían sumar 100 cada uno y que
 * podían no alinearse entre sí.
 */
const PASOS = [
  { numero: 1, label: "Objetivo" },
  { numero: 2, label: "Perfil" },
  { numero: 3, label: "RM" },
  { numero: 4, label: "VO2Max" },
  { numero: 5, label: "Estructura" },
  { numero: 6, label: "Semanas" },
  { numero: 7, label: "Carga" },
  { numero: 8, label: "Revisión" },
];

export function MacrocicloWizard({
  macrociclo,
  persona,
  sesionesRm,
  pasoInicial,
}: {
  macrociclo: MacrocicloWithRelations;
  persona: Persona;
  sesionesRm: SesionRm[];
  pasoInicial: number;
}) {
  const rmSnapshot = leerRmSnapshot(macrociclo.rmSnapshot);
  const [paso, setPaso] = useState(
    Math.min(Math.max(pasoInicial, 1), PASOS.length),
  );

  const [objetivoTipo, setObjetivoTipo] = useState<ObjetivoTipo>(
    (macrociclo.objetivoTipo as ObjetivoTipo) || "salud",
  );
  const [objetivoDetalle, setObjetivoDetalle] = useState(
    macrociclo.objetivoDetalle ?? "",
  );
  const [fechaInicio, setFechaInicio] = useState(
    toISODate(macrociclo.fechaInicio),
  );
  const [fechaFin, setFechaFin] = useState(toISODate(macrociclo.fechaFin));

  const [sesionRmIds, setSesionRmIds] = useState<number[]>(
    rmSnapshot.sesionIds.length > 0
      ? rmSnapshot.sesionIds
      : macrociclo.sesionRmId
        ? [macrociclo.sesionRmId]
        : [],
  );

  const vo2maxInicial =
    (macrociclo.vo2maxSnapshot as Vo2maxSnapshot | null) ?? null;

  const [vo2Metodo, setVo2Metodo] = useState<string>(
    vo2maxInicial?.metodo ?? "cooper",
  );
  const [vo2CooperDistancia, setVo2CooperDistancia] = useState(
    vo2maxInicial?.metodo === "cooper"
      ? String(vo2maxInicial.distanciaMetros)
      : "",
  );
  const [vo2LegerEtapa, setVo2LegerEtapa] = useState(
    vo2maxInicial?.metodo === "leger" ? String(vo2maxInicial.etapa) : "",
  );

  const [perfil, setPerfil] = useState<PerfilDeportivo>(() =>
    resolverPerfilCliente(macrociclo),
  );

  const [competencias, setCompetencias] = useState<CompetenciaEditable[]>(() =>
    (macrociclo.competencias ?? []).map((competencia) => ({
      nombre: competencia.nombre,
      fecha: toISODate(competencia.fecha),
      importancia:
        competencia.importancia === "principal" ? "principal" : "secundaria",
    })),
  );

  const [semanasConfig, setSemanasConfig] = useState<
    Record<
      number,
      {
        tipoMicrociclo: TipoMicrociclo;
        frecuencia: number | "";
        series: number | "";
        repeticiones: number | "";
        volumen: number | "";
        intensidad: number | "";
        ejercicios: SemanaEjercicio[];
      }
    >
  >(() => {
    const saved: Record<
      number,
      {
        tipoMicrociclo: TipoMicrociclo;
        frecuencia: number | "";
        series: number | "";
        repeticiones: number | "";
        volumen: number | "";
        intensidad: number | "";
        ejercicios: SemanaEjercicio[];
      }
    > = {};
    for (const s of macrociclo.semanas) {
      saved[s.numeroSemana] = {
        tipoMicrociclo: s.tipoMicrociclo as TipoMicrociclo,
        frecuencia: s.frecuencia,
        series: s.series,
        repeticiones: s.repeticiones,
        volumen: s.volumen,
        intensidad: s.intensidad,
        ejercicios: (s.ejercicios ?? []).map((e) => ({
          ejercicioId: e.ejercicioId,
          formulaRm: e.formulaRm,
          rm: e.rm,
          peso: e.peso,
          volumen: e.volumen,
        })),
      };
    }
    return saved;
  });

  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState<number[]>([]);

  function irAPaso(nuevoPaso: number) {
    setPaso(Math.min(Math.max(nuevoPaso, 1), PASOS.length));
  }

  async function handleObjetivoSubmit(formData: FormData) {
    await guardarPasoObjetivoFechasAction(formData);
  }

  const competenciasPlan = useMemo(
    () =>
      competencias
        .map((competencia) => {
          const fecha = parseDateInput(competencia.fecha);
          return fecha
            ? {
                fecha,
                importancia: competencia.importancia,
                nombre: competencia.nombre || "la competencia",
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [competencias],
  );

  function buildPeriodizacionPayload() {
    const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
    const fechaFinDate = new Date(`${fechaFin}T00:00:00`);

    // ADR-37: la estructura ya no se arma desde el formulario. Solo se
    // recalcula aquí para poder emparejar cada semana con su configuración
    // de carga; periodos y mesociclos los deriva el servidor del perfil.
    const calculado = calcularPeriodizacion({
      fechaInicio: fechaInicioDate,
      fechaFin: fechaFinDate,
      estructura: construirEstructura(
        perfil,
        contarSemanas(fechaInicioDate, fechaFinDate),
      ),
      competencias: competenciasPlan,
      modoCalendario: modoCalendarioDe(perfil),
      frecuenciaDeload: perfil.nivel === "advanced" ? 3 : 4,
    });

    const semanasInput = calculado.semanas.map((s) => ({
      numeroSemana: s.numeroSemana,
      // ADR-44: si el entrenador cambió el tipo a mano, se envía el suyo; si
      // no, el que propuso el motor.
      tipoMicrociclo:
        semanasConfig[s.numeroSemana]?.tipoMicrociclo ?? s.tipoMicrociclo,
      frecuencia: Number(semanasConfig[s.numeroSemana]?.frecuencia ?? 0),
      series: Number(semanasConfig[s.numeroSemana]?.series ?? 0),
      repeticiones: Number(semanasConfig[s.numeroSemana]?.repeticiones ?? 0),
      volumen: Number(semanasConfig[s.numeroSemana]?.volumen ?? 0),
      intensidad: Number(semanasConfig[s.numeroSemana]?.intensidad ?? 0),
      ejercicios: (semanasConfig[s.numeroSemana]?.ejercicios ?? []).map((e) => ({
        ejercicioId: e.ejercicioId,
        formulaRm: e.formulaRm,
        rm: e.rm,
        peso: e.peso,
        volumen: e.volumen,
      })),
    }));

    return { semanas: semanasInput };
  }

  const totalSemanas = useMemo(() => {
    const inicio = parseDateInput(fechaInicio);
    const fin = parseDateInput(fechaFin);
    return inicio && fin ? contarSemanas(inicio, fin) : 0;
  }, [fechaFin, fechaInicio]);

  function renderPaso() {
    switch (paso) {
      case 1:
        return (
          <PasoObjetivoFechas
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            objetivoTipo={objetivoTipo}
            setObjetivoTipo={setObjetivoTipo}
            objetivoDetalle={objetivoDetalle}
            setObjetivoDetalle={setObjetivoDetalle}
            fechaInicio={fechaInicio}
            setFechaInicio={setFechaInicio}
            fechaFin={fechaFin}
            setFechaFin={setFechaFin}
            onSubmit={handleObjetivoSubmit}
          />
        );
      case 2:
        return (
          <PasoPerfil
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            objetivoTipo={objetivoTipo}
            perfilInicial={perfil}
            competenciasIniciales={competencias}
            totalSemanas={totalSemanas}
            fechaFin={fechaFin}
            onGuardado={(nuevoPerfil, nuevasCompetencias) => {
              setPerfil(nuevoPerfil);
              setCompetencias(nuevasCompetencias);
              irAPaso(PASO_WIZARD.rm);
            }}
          />
        );
      case 3:
        return (
          <PasoRm
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            sesionesRm={sesionesRm}
            sesionRmIds={sesionRmIds}
            setSesionRmIds={setSesionRmIds}
            objetivoTipo={objetivoTipo}
          />
        );
      case 4:
        return (
          <PasoVo2max
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            metodo={vo2Metodo}
            setMetodo={setVo2Metodo}
            cooperDistancia={vo2CooperDistancia}
            setCooperDistancia={setVo2CooperDistancia}
            legerEtapa={vo2LegerEtapa}
            setLegerEtapa={setVo2LegerEtapa}
          />
        );
      case 5:
        return (
          <div className="space-y-5">
            <PasoEstructura
              perfil={perfil}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              competencias={competencias}
            />
            <button
              type="button"
              onClick={() => irAPaso(PASO_WIZARD.semanas)}
              className="rounded-2xl border border-transparent bg-text-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              Continuar
            </button>
          </div>
        );
      case 6:
        return (
          <PasoSemanas
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            fechaInicio={new Date(`${fechaInicio}T00:00:00`)}
            fechaFin={new Date(`${fechaFin}T00:00:00`)}
            perfil={perfil}
            competencias={competenciasPlan}
            diasDisponibles={persona.diasDisponibles ?? 3}
            semanasConfig={semanasConfig}
            setSemanasConfig={setSemanasConfig}
            semanasSeleccionadas={semanasSeleccionadas}
            setSemanasSeleccionadas={setSemanasSeleccionadas}
            resultadosRm={
              rmSnapshot.resultados.length > 0
                ? rmSnapshot.resultados
                : macrociclo.sesionRm?.resultados ?? []
            }
            buildPeriodizacionPayload={buildPeriodizacionPayload}
            onContinuar={() => irAPaso(PASO_WIZARD.carga)}
          />
        );
      case 7:
        return (
          <PasoCarga
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            perfil={perfil}
            mesociclos={macrociclo.mesociclos.map((m) => ({
              ...m,
              carga: m.carga as CargaMesocicloInputData | null,
            }))}
            onContinuar={() => irAPaso(PASO_WIZARD.revision)}
          />
        );
      case 8:
        return (
          <PasoRevision
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            objetivoTipo={objetivoTipo}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            sesionesRmSeleccionadas={sesionesRm.filter((sesion) =>
              sesionRmIds.includes(sesion.id),
            )}
            vo2maxSnapshot={
              (macrociclo.vo2maxSnapshot as Vo2maxSnapshot | null) ?? null
            }
            mesociclos={macrociclo.mesociclos.map((m) => ({
              ...m,
              carga: m.carga as CargaMesocicloInputData | null,
            }))}
            buildPeriodizacionPayload={buildPeriodizacionPayload}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <WizardScrollControls />
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Macrociclo de entrenamiento
        </h1>
        <p className="text-sm text-text-secondary">
          Persona: {persona.nombre}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Pasos del wizard">
        {PASOS.map((p) => {
          const active = p.numero === paso;
          const completed = p.numero < paso;
          return (
            <button
              key={p.numero}
              type="button"
              onClick={() => irAPaso(p.numero)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition",
                active
                  ? "bg-accent text-white"
                  : completed
                    ? "bg-bg-subtle text-text-primary dark:text-white"
                    : "bg-bg-soft text-text-tertiary",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => irAPaso(paso - 1)}
          disabled={paso <= 1}
          className={[
            "rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium transition",
            paso <= 1
              ? "cursor-not-allowed bg-bg-soft text-text-tertiary dark:border-white/6 dark:bg-bg-subtle"
              : "bg-bg-main text-text-primary hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-subtle dark:text-white",
          ].join(" ")}
        >
          ← Atrás
        </button>
        <span className="text-sm text-text-secondary">
          Paso {paso} de {PASOS.length}
        </span>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
        {renderPaso()}
      </div>
    </div>
  );
}

function PasoObjetivoFechas({
  cc,
  macrocicloId,
  objetivoTipo,
  setObjetivoTipo,
  objetivoDetalle,
  setObjetivoDetalle,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
  onSubmit,
}: {
  cc: string;
  macrocicloId: number;
  objetivoTipo: ObjetivoTipo;
  setObjetivoTipo: (value: ObjetivoTipo) => void;
  objetivoDetalle: string;
  setObjetivoDetalle: (value: string) => void;
  fechaInicio: string;
  setFechaInicio: (value: string) => void;
  fechaFin: string;
  setFechaFin: (value: string) => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  function handleChangeObjetivo(value: string) {
    if (value === "salud" || value === "competencia") {
      setObjetivoTipo(value);
    }
  }

  const sugerenciasDetalle = [
    "Perder grasa",
    "Mejorar masa muscular",
    "Mejorar fuerza",
    "Mejorar resistencia cardiovascular",
    "Mantenimiento y salud general",
    ...(objetivoTipo === "competencia"
      ? ["Prepararme para una competencia"]
      : []),
  ];

  const mesesRango =
    fechaInicio && fechaFin
      ? (new Date(`${fechaFin}T00:00:00`).getTime() -
          new Date(`${fechaInicio}T00:00:00`).getTime()) /
        (1000 * 60 * 60 * 24 * 30.44)
      : null;
  const rangoMenorASeisMeses = mesesRango !== null && mesesRango < 6;

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="objetivoTipo" value={objetivoTipo} />
      <input type="hidden" name="fechaFin" value={fechaFin} />

      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-primary dark:text-white">
          Objetivo del macrociclo
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {OBJETIVOS.map((obj) => (
            <label
              key={obj.value}
              className={[
                "cursor-pointer rounded-2xl border p-4 transition",
                objetivoTipo === obj.value
                  ? "border-accent bg-accent/5"
                  : "border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle",
              ].join(" ")}
            >
              <input
                type="radio"
                name="objetivoTipoOption"
                value={obj.value}
                checked={objetivoTipo === obj.value}
                onChange={(e) => handleChangeObjetivo(e.target.value)}
                className="sr-only"
              />
              <span className="font-medium text-text-primary dark:text-white">
                {obj.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Detalle del objetivo
          </span>
          <input
            type="text"
            name="objetivoDetalle"
            value={objetivoDetalle}
            onChange={(e) => setObjetivoDetalle(e.target.value)}
            placeholder="Ej. Mejorar composición corporal para competencia regional"
            className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {sugerenciasDetalle.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => setObjetivoDetalle(sugerencia)}
              className="rounded-full border border-gray-200 bg-bg-main px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent dark:border-white/10 dark:bg-bg-subtle"
            >
              {sugerencia}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Fecha de inicio
          </span>
          <input
            type="date"
            name="fechaInicio"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
            className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Fecha final del macrociclo
          </span>
          <input
            type="date"
            name="fechaFin"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            required
            className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
          />
          <span className="block text-xs leading-5 text-text-tertiary">
            {objetivoTipo === "competencia"
              ? "Si vas a competir, deja entre 2 y 4 semanas después de tu última competencia: el periodo transitorio de descanso activo va justo después de competir, no antes. Las fechas de competencia se añaden en el paso siguiente."
              : "El plan termina con 2 a 4 semanas de transitorio (descanso activo), que ya van incluidas en este rango."}
          </span>
        </label>
      </div>

      <p className="text-xs text-text-tertiary">
        Se recomienda un mínimo de 6 a 8 meses para una adaptación adecuada.
      </p>
      {rangoMenorASeisMeses ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          El periodo elegido es menor a 6 meses; esto puede limitar la
          adaptación.
        </p>
      ) : null}

      <FormSubmitButton pendingLabel="Guardando...">Continuar</FormSubmitButton>
    </form>
  );
}

