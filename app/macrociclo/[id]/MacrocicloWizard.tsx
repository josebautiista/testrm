"use client";

import { useState } from "react";

import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import {
  type ObjetivoTipo,
  type TipoEtapa,
  type TipoMesociclo,
  type TipoMicrociclo,
  type TipoPeriodo,
  type Vo2maxSnapshot,
  OBJETIVOS,
  ETAPAS_POR_PERIODO,
  ORDEN_MESES,
  TIPOS_PERIODO,
  toISODate,
} from "@/lib/macrociclo";
import { calcularPeriodizacion } from "@/lib/macrociclo-periodizacion";
import { type CargaMesocicloInputData } from "@/lib/mesociclo-carga";
import { guardarPasoObjetivoFechasAction } from "@/actions/macrociclo";
import {
  PasoRm,
  PasoVo2max,
  PasoPeriodos,
  PasoEtapas,
  PasoMesociclos,
  PasoSemanas,
  PasoCarga,
  PasoRevision,
} from "./wizard-steps";

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

const PASOS = [
  { numero: 1, label: "Objetivo" },
  { numero: 2, label: "RM" },
  { numero: 3, label: "VO2Max" },
  { numero: 4, label: "Periodos" },
  { numero: 5, label: "Etapas" },
  { numero: 6, label: "Mesociclos" },
  { numero: 7, label: "Semanas" },
  { numero: 8, label: "Carga" },
  { numero: 9, label: "Revisión" },
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
  const [fechaCompetencia, setFechaCompetencia] = useState(
    macrociclo.fechaCompetencia ? toISODate(macrociclo.fechaCompetencia) : "",
  );

  const [sesionRmId, setSesionRmId] = useState<number | "">(
    macrociclo.sesionRmId ?? "",
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

  const [periodos, setPeriodos] = useState<Record<TipoPeriodo, number | "">>(() => {
    const saved: Partial<Record<TipoPeriodo, number>> = {};
    for (const p of macrociclo.periodos) {
      if (p.tipo === "preparatorio" || p.tipo === "competitivo") {
        saved[p.tipo] = p.porcentaje;
      }
    }
    return {
      preparatorio: saved.preparatorio ?? 50,
      competitivo: saved.competitivo ?? 50,
    };
  });

  const [etapas, setEtapas] = useState<Record<TipoPeriodo, Record<TipoEtapa, number | "">>>(() => {
    const saved: Record<TipoPeriodo, Partial<Record<TipoEtapa, number>>> = {
      preparatorio: {},
      competitivo: {},
    };
    for (const periodo of macrociclo.periodos) {
      const tipoPeriodo = periodo.tipo as TipoPeriodo;
      for (const etapa of periodo.etapas) {
        const tipoEtapa = etapa.tipo as TipoEtapa;
        saved[tipoPeriodo][tipoEtapa] = etapa.porcentaje;
      }
    }
    return {
      preparatorio: {
        general: saved.preparatorio.general ?? 50,
        especifica: saved.preparatorio.especifica ?? 50,
        precompetitiva: 0,
        competitiva: 0,
      },
      competitivo: {
        general: 0,
        especifica: 0,
        precompetitiva: saved.competitivo.precompetitiva ?? 50,
        competitiva: saved.competitivo.competitiva ?? 50,
      },
    };
  });

  const [mesociclos, setMesociclos] = useState<Record<TipoMesociclo, number | "">>(() => {
    const saved: Partial<Record<TipoMesociclo, number>> = {};
    for (const m of macrociclo.mesociclos) {
      const tipo = m.tipo as TipoMesociclo;
      saved[tipo] = m.porcentaje;
    }
    return {
      entrante: saved.entrante ?? 10,
      desarrollador: saved.desarrollador ?? 15,
      desarrollador_especifico: saved.desarrollador_especifico ?? 15,
      estabilizador: saved.estabilizador ?? 10,
      precompetitivo: saved.precompetitivo ?? 15,
      choque: saved.choque ?? 10,
      aproximacion: saved.aproximacion ?? 15,
      competencia: saved.competencia ?? 10,
    };
  });

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

  function buildPeriodizacionPayload() {
    const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
    const fechaFinDate = new Date(`${fechaFin}T00:00:00`);

    const periodosInput = TIPOS_PERIODO.map((p) => ({
      tipo: p.value,
      porcentaje: Number(periodos[p.value]),
    }));

    const etapasPorPeriodo: Record<
      TipoPeriodo,
      { tipo: TipoEtapa; porcentaje: number }[]
    > = {
      preparatorio: ETAPAS_POR_PERIODO.preparatorio.map((tipo) => ({
        tipo,
        porcentaje: Number(etapas.preparatorio[tipo]),
      })),
      competitivo: ETAPAS_POR_PERIODO.competitivo.map((tipo) => ({
        tipo,
        porcentaje: Number(etapas.competitivo[tipo]),
      })),
    };

    const mesociclosInput = ORDEN_MESES.map((tipo) => ({
      tipo,
      porcentaje: Number(mesociclos[tipo]),
    }));

    const calculado = calcularPeriodizacion({
      fechaInicio: fechaInicioDate,
      fechaFin: fechaFinDate,
      periodos: periodosInput,
      etapasPorPeriodo,
      mesociclos: mesociclosInput,
    });

    const semanasInput = calculado.semanas.map((s) => ({
      numeroSemana: s.numeroSemana,
      tipoMicrociclo: semanasConfig[s.numeroSemana]?.tipoMicrociclo ?? "corriente",
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

    return {
      periodos: periodosInput,
      etapasPorPeriodo,
      mesociclos: mesociclosInput,
      semanas: semanasInput,
    };
  }

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
            fechaCompetencia={fechaCompetencia}
            setFechaCompetencia={setFechaCompetencia}
            onSubmit={handleObjetivoSubmit}
          />
        );
      case 2:
        return (
          <PasoRm
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            sesionesRm={sesionesRm}
            sesionRmId={sesionRmId}
            setSesionRmId={setSesionRmId}
            objetivoTipo={objetivoTipo}
          />
        );
      case 3:
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
      case 4:
        return (
          <PasoPeriodos
            periodos={periodos}
            setPeriodos={setPeriodos}
            onContinuar={() => irAPaso(5)}
          />
        );
      case 5:
        return (
          <PasoEtapas
            etapas={etapas}
            setEtapas={setEtapas}
            onContinuar={() => irAPaso(6)}
          />
        );
      case 6:
        return (
          <PasoMesociclos
            mesociclos={mesociclos}
            setMesociclos={setMesociclos}
            onContinuar={() => irAPaso(7)}
          />
        );
      case 7:
        return (
          <PasoSemanas
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            fechaInicio={new Date(`${fechaInicio}T00:00:00`)}
            fechaFin={new Date(`${fechaFin}T00:00:00`)}
            periodos={TIPOS_PERIODO.map((p) => ({
              tipo: p.value,
              porcentaje: periodos[p.value],
            }))}
            etapasPorPeriodo={{
              preparatorio: ETAPAS_POR_PERIODO.preparatorio.map((tipo) => ({
                tipo,
                porcentaje: (etapas.preparatorio[tipo] ?? 0) as number,
              })),
              competitivo: ETAPAS_POR_PERIODO.competitivo.map((tipo) => ({
                tipo,
                porcentaje: (etapas.competitivo[tipo] ?? 0) as number,
              })),
            }}
            mesociclos={ORDEN_MESES.map((tipo) => ({
              tipo,
              porcentaje: mesociclos[tipo],
            }))}
            semanasConfig={semanasConfig}
            setSemanasConfig={setSemanasConfig}
            semanasSeleccionadas={semanasSeleccionadas}
            setSemanasSeleccionadas={setSemanasSeleccionadas}
            resultadosRm={macrociclo.sesionRm?.resultados ?? []}
            buildPeriodizacionPayload={buildPeriodizacionPayload}
            onContinuar={() => irAPaso(8)}
          />
        );
      case 8:
        return (
          <PasoCarga
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            mesociclos={macrociclo.mesociclos.map((m) => ({
              ...m,
              carga: m.carga as CargaMesocicloInputData | null,
            }))}
            onContinuar={() => irAPaso(9)}
          />
        );
      case 9:
        return (
          <PasoRevision
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            objetivoTipo={objetivoTipo}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            sesionRmId={sesionRmId}
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
  fechaCompetencia,
  setFechaCompetencia,
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
  fechaCompetencia: string;
  setFechaCompetencia: (value: string) => void;
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

        {objetivoTipo === "competencia" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              Fecha de competencia
            </span>
            <input
              type="date"
              name="fechaCompetencia"
              value={fechaCompetencia}
              onChange={(e) => {
                setFechaCompetencia(e.target.value);
                setFechaFin(e.target.value);
              }}
              required
              className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            />
          </label>
        ) : (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              Fecha final objetivo
            </span>
            <input
              type="date"
              name="fechaFin"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              required
              className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            />
          </label>
        )}
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

