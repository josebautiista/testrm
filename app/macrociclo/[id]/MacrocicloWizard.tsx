"use client";

import { useState } from "react";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
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
import {
  guardarPasoObjetivoFechasAction,
  guardarMedidasAction,
  procesarPdfAntropometriaAction,
} from "@/actions/macrociclo";
import {
  PasoRm,
  PasoVo2max,
  PasoPeriodos,
  PasoEtapas,
  PasoMesociclos,
  PasoSemanas,
  PasoRevision,
} from "./wizard-steps";

type MacrocicloPeriodo = {
  tipo: string;
  porcentaje: number;
  etapas: Array<{ tipo: string; porcentaje: number }>;
};

type MacrocicloMesociclo = {
  tipo: string;
  porcentaje: number;
};

type MacrocicloSemana = {
  numeroSemana: number;
  tipoMicrociclo: string;
  frecuencia: number;
  volumen: number;
  intensidad: number;
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
};

type Persona = {
  id: number;
  nombre: string;
  cc: string;
};

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

const PASOS = [
  { numero: 1, label: "Objetivo" },
  { numero: 2, label: "PDF" },
  { numero: 3, label: "Medidas" },
  { numero: 4, label: "RM" },
  { numero: 5, label: "VO2Max" },
  { numero: 6, label: "Periodos" },
  { numero: 7, label: "Etapas" },
  { numero: 8, label: "Mesociclos" },
  { numero: 9, label: "Semanas" },
  { numero: 10, label: "Revisión" },
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
  const [paso, setPaso] = useState(Math.min(Math.max(pasoInicial, 1), 10));

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

  const [medidas, setMedidas] = useState<Record<string, unknown>>(
    (macrociclo.medidasSnapshot as Record<string, unknown>) ?? {},
  );
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const [sesionRmId, setSesionRmId] = useState<number | "">(
    macrociclo.sesionRmId ?? "",
  );

  const [vo2Metodo, setVo2Metodo] = useState<string>("cooper");
  const [vo2CooperDistancia, setVo2CooperDistancia] = useState("");
  const [vo2Directo, setVo2Directo] = useState("");
  const [vo2LegerEtapa, setVo2LegerEtapa] = useState("");

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
        volumen: number | "";
        intensidad: number | "";
      }
    >
  >(() => {
    const saved: Record<
      number,
      {
        tipoMicrociclo: TipoMicrociclo;
        frecuencia: number | "";
        volumen: number | "";
        intensidad: number | "";
      }
    > = {};
    for (const s of macrociclo.semanas) {
      const tipo = s.tipoMicrociclo as TipoMicrociclo;
      saved[s.numeroSemana] = {
        tipoMicrociclo: tipo,
        frecuencia: s.frecuencia,
        volumen: s.volumen,
        intensidad: s.intensidad,
      };
    }
    return saved;
  });

  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState<number[]>([]);

  function irAPaso(nuevoPaso: number) {
    setPaso(Math.min(Math.max(nuevoPaso, 1), 10));
  }

  async function handleObjetivoSubmit(formData: FormData) {
    await guardarPasoObjetivoFechasAction(formData);
  }

  async function handleProcesarPdf(formData: FormData) {
    setPdfProcessing(true);
    setPdfError("");
    const result = await procesarPdfAntropometriaAction(formData);
    setPdfProcessing(false);

    if (!result.success) {
      setPdfError(result.error);
      return;
    }

    setMedidas(result.medidas as Record<string, unknown>);
    irAPaso(3);
  }

  function sanitizeMedidas(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(sanitizeMedidas);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          sanitizeMedidas(v),
        ]),
      );
    }
    if (value === "") return undefined;
    return value;
  }

  function buildMedidasConfirmadas(): Record<string, unknown> {
    return sanitizeMedidas(medidas) as Record<string, unknown>;
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
      volumen: Number(semanasConfig[s.numeroSemana]?.volumen ?? 0),
      intensidad: Number(semanasConfig[s.numeroSemana]?.intensidad ?? 0),
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
          <PasoCargaPdf
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            processing={pdfProcessing}
            error={pdfError}
            onSubmit={handleProcesarPdf}
            onSaltar={() => irAPaso(4)}
          />
        );
      case 3:
        return (
          <PasoConfirmacionMedidas
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            medidas={medidas}
            setMedidas={setMedidas}
            buildMedidasConfirmadas={buildMedidasConfirmadas}
            onGuardar={() => irAPaso(4)}
          />
        );
      case 4:
        return (
          <PasoRm
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            sesionesRm={sesionesRm}
            sesionRmId={sesionRmId}
            setSesionRmId={setSesionRmId}
            onGuardar={() => irAPaso(5)}
          />
        );
      case 5:
        return (
          <PasoVo2max
            cc={persona.cc}
            macrocicloId={macrociclo.id}
            metodo={vo2Metodo}
            setMetodo={setVo2Metodo}
            cooperDistancia={vo2CooperDistancia}
            setCooperDistancia={setVo2CooperDistancia}
            directo={vo2Directo}
            setDirecto={setVo2Directo}
            legerEtapa={vo2LegerEtapa}
            setLegerEtapa={setVo2LegerEtapa}
            onGuardar={() => irAPaso(6)}
          />
        );
      case 6:
        return (
          <PasoPeriodos
            periodos={periodos}
            setPeriodos={setPeriodos}
            onContinuar={() => irAPaso(7)}
          />
        );
      case 7:
        return (
          <PasoEtapas
            etapas={etapas}
            setEtapas={setEtapas}
            onContinuar={() => irAPaso(8)}
          />
        );
      case 8:
        return (
          <PasoMesociclos
            mesociclos={mesociclos}
            setMesociclos={setMesociclos}
            onContinuar={() => irAPaso(9)}
          />
        );
      case 9:
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
            buildPeriodizacionPayload={buildPeriodizacionPayload}
            onContinuar={() => irAPaso(10)}
          />
        );
      case 10:
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
          Paso {paso} de 10
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

      <PrimaryButton type="submit">Continuar</PrimaryButton>
    </form>
  );
}

function PasoCargaPdf({
  cc,
  macrocicloId,
  processing,
  error,
  onSubmit,
  onSaltar,
}: {
  cc: string;
  macrocicloId: number;
  processing: boolean;
  error: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onSaltar: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Evaluación antropométrica
        </h2>
        <p className="text-sm text-text-secondary">
          Carga un PDF de ISAK con tu evaluación antropométrica. No guardaremos el
          archivo, solo extraeremos los datos para que los confirmes. 
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="id" value={macrocicloId} />
        <input
          type="file"
          name="archivo"
          accept="application/pdf"
          required
          className="block w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-sm text-text-primary file:mr-4 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white dark:border-white/10 dark:bg-bg-subtle dark:text-white"
        />
        <PrimaryButton type="submit" disabled={processing}>
          {processing ? "Procesando PDF..." : "Extraer datos del PDF"}
        </PrimaryButton>
      </form>

      <button
        type="button"
        onClick={onSaltar}
        className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-subtle dark:text-text-secondary"
      >
        Omitir este paso
      </button>
    </div>
  );
}

function PasoConfirmacionMedidas({
  cc,
  macrocicloId,
  medidas,
  setMedidas,
  buildMedidasConfirmadas,
  onGuardar,
}: {
  cc: string;
  macrocicloId: number;
  medidas: Record<string, unknown>;
  setMedidas: (value: Record<string, unknown>) => void;
  buildMedidasConfirmadas: () => Record<string, unknown>;
  onGuardar: () => void;
}) {
  const [actualizarPersona, setActualizarPersona] = useState(true);
  const [pending, setPending] = useState(false);

  function updatePath(path: string, value: string) {
    const keys = path.split(".");
    const next = { ...medidas };
    let current: Record<string, unknown> = next;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
      current = current[keys[i]] as Record<string, unknown>;
    }
    const parsed = value === "" ? "" : Number(value.replace(",", "."));
    current[keys[keys.length - 1]] = parsed;
    setMedidas(next);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    await guardarMedidasAction(formData);
    setPending(false);
    onGuardar();
  }

  function getByPath(
    obj: Record<string, unknown>,
    path: string,
  ): Record<string, number | string> {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else {
        return {};
      }
    }
    return (current as Record<string, number | string>) ?? {};
  }

  const grupos = [
    { path: "medidasBasicas", label: "Medidas básicas" },
    { path: "pliegues", label: "Pliegues" },
    { path: "perimetros", label: "Perímetros" },
    { path: "diametros", label: "Diámetros" },
    { path: "composicionCorporal", label: "Composición corporal" },
    { path: "adiposidad", label: "Adiposidad" },
    {
      path: "distribucionAdiposoMuscular.masaGrasa",
      label: "Masa grasa — distribución (%)",
    },
    {
      path: "distribucionAdiposoMuscular.tejidoMuscular",
      label: "Tejido muscular — distribución (%)",
    },
    { path: "indicesSalud", label: "Índices de salud" },
  ];

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input
        type="hidden"
        name="medidas"
        value={JSON.stringify(buildMedidasConfirmadas())}
      />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Confirmar medidas extraídas
        </h2>
        <p className="text-sm text-text-secondary">
          Revisa y corrige los datos antes de guardarlos.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="actualizarPersona"
          checked={actualizarPersona}
          onChange={(e) => setActualizarPersona(e.target.checked)}
          value={actualizarPersona ? "true" : "false"}
          className="h-4 w-4 accent-accent"
        />
        Actualizar peso, talla, cintura y cadera en el perfil
      </label>
      <input type="hidden" name="actualizarPersona" value={actualizarPersona ? "true" : "false"} />

      {grupos.map((grupo) => {
        const datos = getByPath(medidas, grupo.path);
        const entries = Object.entries(datos).filter(
          ([, value]) => value !== undefined && value !== null,
        );
        if (entries.length === 0) return null;

        return (
          <section key={grupo.path} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
              {grupo.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {entries.map(([key, value]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-sm text-text-secondary">{key}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={value ?? ""}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      updatePath(`${grupo.path}.${key}`, e.target.value)
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar y continuar"}
      </PrimaryButton>
    </form>
  );
}
