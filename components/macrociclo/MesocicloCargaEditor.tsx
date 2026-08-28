"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";

import { guardarCargaMesocicloAction } from "@/actions/macrociclo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  calcularMinutosPorDireccion,
  calcularMinutosPorSemana,
  calcularMinutosPorSesion,
  crearCargaInicial,
  esSuma100,
  sumaPorcentajes,
  type CargaMesocicloInputData,
  type DireccionCarga,
  type PorcentajeInput,
  type SemanaCargaInfo,
} from "@/lib/mesociclo-carga";

type MesocicloCargaEditorProps = {
  cc: string;
  macrocicloId: number;
  mesocicloId: number;
  semanas: SemanaCargaInfo[];
  cargaInicial: CargaMesocicloInputData | null;
  /** M-01: decide con qué direcciones arranca el editor. */
  perfil?: { capacidad: string; calendario: string };
  onGuardado?: () => void;
  textoExito?: string;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function IndicadorSuma({
  valores,
  label,
}: {
  valores: PorcentajeInput[];
  label?: string;
}) {
  const suma = sumaPorcentajes(valores);
  const ok = esSuma100(valores);

  return (
    <span
      className={[
        "text-xs font-medium",
        ok ? "text-accent" : "text-red-300",
      ].join(" ")}
    >
      {label ? `${label}: ` : ""}
      {formatNumber(suma)}%{ok ? " ✓" : ""}
    </span>
  );
}

function PercentInput({
  value,
  onChange,
  onBlur,
  className = "",
  ...props
}: {
  value: PorcentajeInput;
  onChange: (value: PorcentajeInput) => void;
  onBlur?: (value: PorcentajeInput) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "type">) {
  return (
    <input
      type="number"
      min="0"
      max="100"
      step="0.01"
      inputMode="decimal"
      value={value}
      onChange={(e) =>
        onChange(e.target.value === "" ? "" : Number(e.target.value))
      }
      onBlur={() => {
        if (value === "") {
          onBlur?.(0);
        }
      }}
      className={[
        "w-full rounded-xl border border-gray-200 bg-bg-soft px-2 py-2 text-center text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:bg-bg-main dark:text-white dark:focus:border-white/15",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function MesocicloCargaEditor({
  cc,
  macrocicloId,
  mesocicloId,
  semanas,
  cargaInicial,
  perfil,
  onGuardado,
  textoExito = "Carga guardada correctamente.",
}: MesocicloCargaEditorProps) {
  const [data, setData] = useState<CargaMesocicloInputData>(
    cargaInicial ?? crearCargaInicial(semanas, perfil),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const minutosPorDireccion = useMemo(
    () => calcularMinutosPorDireccion(data, semanas),
    [data, semanas],
  );
  const minutosPorSemana = useMemo(
    () => calcularMinutosPorSemana(data, semanas),
    [data, semanas],
  );
  const minutosPorSesion = useMemo(
    () => calcularMinutosPorSesion(data, semanas),
    [data, semanas],
  );

  const totalMinutos = useMemo(
    () =>
      semanas.reduce(
        (acc, semana) =>
          acc +
          (data.tiempoSesionMin === "" ? 0 : data.tiempoSesionMin) *
            Math.max(0, semana.frecuencia),
        0,
      ),
    [data.tiempoSesionMin, semanas],
  );

  function setTiempoSesionMin(value: PorcentajeInput) {
    setData((prev) => ({
      ...prev,
      tiempoSesionMin: value,
    }));
  }

  function sanitizarTiempoSesionMin() {
    setData((prev) => ({
      ...prev,
      tiempoSesionMin: prev.tiempoSesionMin === "" ? 0 : prev.tiempoSesionMin,
    }));
  }

  function setDireccionNombre(id: string, nombre: string) {
    setData((prev) => ({
      ...prev,
      direcciones: prev.direcciones.map((d) => (d.id === id ? { ...d, nombre } : d)),
    }));
  }

  function addDireccion() {
    setData((prev) => {
      const idsExistentes = new Set(prev.direcciones.map((d) => d.id));
      let contador = 1;
      let id = `nueva${contador}`;
      while (idsExistentes.has(id)) {
        contador++;
        id = `nueva${contador}`;
      }

      const nueva: DireccionCarga = { id, nombre: `Nueva dirección ${contador}` };
      const volumen: Record<string, PorcentajeInput> = { ...prev.volumen, [id]: 0 };
      const microciclos: Record<string, Record<string, PorcentajeInput>> = {
        ...prev.microciclos,
        [id]: {},
      };
      const sesiones: Record<
        string,
        Record<string, Record<string, PorcentajeInput>>
      > = {
        ...prev.sesiones,
        [id]: {},
      };

      for (const semana of semanas) {
        microciclos[id][String(semana.numeroSemana)] = 0;
        const porSesion: Record<string, PorcentajeInput> = {};
        for (let idx = 0; idx < Math.max(0, semana.frecuencia); idx++) {
          porSesion[String(idx)] = 0;
        }
        sesiones[id][String(semana.numeroSemana)] = porSesion;
      }

      return {
        ...prev,
        direcciones: [...prev.direcciones, nueva],
        volumen,
        microciclos,
        sesiones,
      };
    });
  }

  function removeDireccion(id: string) {
    setData((prev) => {
      if (prev.direcciones.length <= 1) return prev;
      const direcciones = prev.direcciones.filter((d) => d.id !== id);
      const volumen = { ...prev.volumen };
      const microciclos = { ...prev.microciclos };
      const sesiones = { ...prev.sesiones };
      delete volumen[id];
      delete microciclos[id];
      delete sesiones[id];
      return { ...prev, direcciones, volumen, microciclos, sesiones };
    });
  }

  function setVolumen(direccionId: string, value: PorcentajeInput) {
    setData((prev) => ({
      ...prev,
      volumen: { ...prev.volumen, [direccionId]: value },
    }));
  }

  function sanitizarVolumen(direccionId: string) {
    setData((prev) => ({
      ...prev,
      volumen: {
        ...prev.volumen,
        [direccionId]:
          prev.volumen[direccionId] === "" ? 0 : prev.volumen[direccionId],
      },
    }));
  }

  function setMicrociclo(
    direccionId: string,
    numeroSemana: number,
    value: PorcentajeInput,
  ) {
    setData((prev) => ({
      ...prev,
      microciclos: {
        ...prev.microciclos,
        [direccionId]: {
          ...prev.microciclos[direccionId],
          [String(numeroSemana)]: value,
        },
      },
    }));
  }

  function sanitizarMicrociclo(direccionId: string, numeroSemana: number) {
    setData((prev) => {
      const actual = prev.microciclos[direccionId]?.[String(numeroSemana)];
      if (actual !== "") return prev;
      return {
        ...prev,
        microciclos: {
          ...prev.microciclos,
          [direccionId]: {
            ...prev.microciclos[direccionId],
            [String(numeroSemana)]: 0,
          },
        },
      };
    });
  }

  function setSesion(
    direccionId: string,
    numeroSemana: number,
    sesionIdx: number,
    value: PorcentajeInput,
  ) {
    setData((prev) => ({
      ...prev,
      sesiones: {
        ...prev.sesiones,
        [direccionId]: {
          ...prev.sesiones[direccionId],
          [String(numeroSemana)]: {
            ...prev.sesiones[direccionId]?.[String(numeroSemana)],
            [String(sesionIdx)]: value,
          },
        },
      },
    }));
  }

  function sanitizarSesion(
    direccionId: string,
    numeroSemana: number,
    sesionIdx: number,
  ) {
    setData((prev) => {
      const actual =
        prev.sesiones[direccionId]?.[String(numeroSemana)]?.[String(sesionIdx)];
      if (actual !== "") return prev;
      return {
        ...prev,
        sesiones: {
          ...prev.sesiones,
          [direccionId]: {
            ...prev.sesiones[direccionId],
            [String(numeroSemana)]: {
              ...prev.sesiones[direccionId]?.[String(numeroSemana)],
              [String(sesionIdx)]: 0,
            },
          },
        },
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGuardado(false);

    startTransition(async () => {
      const formData = new FormData(event.currentTarget);
      const result = await guardarCargaMesocicloAction(formData);

      if (result.success) {
        setGuardado(true);
        onGuardado?.();
      } else {
        setError(result.error);
      }
    });
  }

  const inputBaseClass =
    "w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:bg-bg-main dark:text-white dark:focus:border-white/15";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="cc" value={cc} />
      <input type="hidden" name="id" value={macrocicloId} />
      <input type="hidden" name="mesocicloId" value={mesocicloId} />
      <input type="hidden" name="carga" value={JSON.stringify(data)} />

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <h3 className="text-base font-semibold text-text-primary dark:text-white">
          Parámetros
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-text-secondary">
              Tiempo de sesión (min)
            </span>
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              inputMode="numeric"
              value={data.tiempoSesionMin}
              onChange={(e) =>
                setTiempoSesionMin(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              onBlur={sanitizarTiempoSesionMin}
              className={inputBaseClass}
            />
          </label>
          <div>
            <p className="text-sm text-text-secondary">Volumen total estimado</p>
            <p className="text-lg font-semibold text-text-primary dark:text-white">
              {formatNumber(totalMinutos)} min
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary dark:text-white">
          Direcciones de entrenamiento
        </h3>
        <div className="space-y-2">
          {data.direcciones.map((direccion) => (
            <div key={direccion.id} className="flex items-center gap-2">
              <input
                type="text"
                value={direccion.nombre}
                onChange={(e) => setDireccionNombre(direccion.id, e.target.value)}
                className={inputBaseClass}
              />
              <button
                type="button"
                onClick={() => removeDireccion(direccion.id)}
                disabled={data.direcciones.length <= 1}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-text-secondary"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDireccion}
          className="text-sm text-text-secondary underline-offset-4 hover:underline"
        >
          + Agregar dirección
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text-primary dark:text-white">
            Distribución de volumen
          </h3>
          <IndicadorSuma
            valores={data.direcciones.map((d) => data.volumen[d.id] ?? 0)}
            label="Total"
          />
        </div>
        <div className="space-y-2">
          {data.direcciones.map((direccion) => (
            <div
              key={direccion.id}
              className="grid grid-cols-[1fr_80px_1fr] items-center gap-3"
            >
              <span className="text-sm text-text-secondary">{direccion.nombre}</span>
              <PercentInput
                value={data.volumen[direccion.id] ?? 0}
                onChange={(value) => setVolumen(direccion.id, value)}
                onBlur={() => sanitizarVolumen(direccion.id)}
              />
              <span className="text-right text-sm text-text-secondary">
                {formatNumber(minutosPorDireccion[direccion.id] ?? 0)} min
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary dark:text-white">
          Distribución por microciclos
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-soft">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-soft dark:bg-bg-subtle">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">
                  Dirección
                </th>
                {semanas.map((semana) => (
                  <th
                    key={semana.numeroSemana}
                    className="px-3 py-2 text-center font-medium text-text-secondary"
                  >
                    Sem {semana.numeroSemana}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-text-secondary">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/8">
              {data.direcciones.map((direccion) => {
                const microValores = semanas.map(
                  (s) => data.microciclos[direccion.id]?.[String(s.numeroSemana)] ?? 0,
                );
                return (
                  <tr key={direccion.id}>
                    <td className="px-3 py-2 text-text-primary dark:text-white">
                      {direccion.nombre}
                      <div className="mt-1">
                        <IndicadorSuma valores={microValores} />
                      </div>
                    </td>
                    {semanas.map((semana) => (
                      <td key={semana.numeroSemana} className="px-3 py-2 align-top">
                        <PercentInput
                          value={
                            data.microciclos[direccion.id]?.[String(semana.numeroSemana)] ?? 0
                          }
                          onChange={(value) =>
                            setMicrociclo(direccion.id, semana.numeroSemana, value)
                          }
                          onBlur={() =>
                            sanitizarMicrociclo(direccion.id, semana.numeroSemana)
                          }
                        />
                        <p className="mt-1 text-center text-xs text-text-tertiary">
                          {formatNumber(
                            minutosPorSemana[direccion.id]?.[String(semana.numeroSemana)] ?? 0,
                          )}{" "}
                          min
                        </p>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right align-top text-text-secondary">
                      {formatNumber(minutosPorDireccion[direccion.id] ?? 0)} min
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary dark:text-white">
          Distribución por sesiones
        </h3>
        <div className="space-y-4">
          {semanas.map((semana) => (
            <div
              key={semana.numeroSemana}
              className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="font-medium text-text-primary dark:text-white">
                  Semana {semana.numeroSemana}
                </h4>
                <span className="text-xs text-text-secondary">
                  {semana.frecuencia} sesiones
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-bg-soft dark:bg-bg-subtle">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-text-secondary">
                        Dirección
                      </th>
                      {Array.from({ length: Math.max(0, semana.frecuencia) }).map(
                        (_, idx) => (
                          <th
                            key={idx}
                            className="px-2 py-2 text-center font-medium text-text-secondary"
                          >
                            Sesión {idx + 1}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/8">
                    {data.direcciones.map((direccion) => {
                      const valoresSesion = Array.from({
                        length: Math.max(0, semana.frecuencia),
                      }).map(
                        (_, idx) =>
                          data.sesiones[direccion.id]?.[String(semana.numeroSemana)]?.[
                            String(idx)
                          ] ?? 0,
                      );
                      return (
                        <tr key={direccion.id}>
                          <td className="px-2 py-2 text-text-primary dark:text-white">
                            {direccion.nombre}
                            <div className="mt-1">
                              <IndicadorSuma valores={valoresSesion} />
                            </div>
                          </td>
                          {Array.from({ length: Math.max(0, semana.frecuencia) }).map(
                            (_, idx) => (
                              <td key={idx} className="px-2 py-2 align-top">
                                <PercentInput
                                  value={
                                    data.sesiones[direccion.id]?.[
                                      String(semana.numeroSemana)
                                    ]?.[String(idx)] ?? 0
                                  }
                                  onChange={(value) =>
                                    setSesion(
                                      direccion.id,
                                      semana.numeroSemana,
                                      idx,
                                      value,
                                    )
                                  }
                                  onBlur={() =>
                                    sanitizarSesion(
                                      direccion.id,
                                      semana.numeroSemana,
                                      idx,
                                    )
                                  }
                                />
                                <p className="mt-1 text-center text-xs text-text-tertiary">
                                  {formatNumber(
                                    minutosPorSesion[direccion.id]?.[
                                      String(semana.numeroSemana)
                                    ]?.[String(idx)] ?? 0,
                                  )}{" "}
                                  min
                                </p>
                              </td>
                            ),
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
        {isPending ? "Guardando..." : "Guardar carga del mesociclo"}
      </PrimaryButton>
    </form>
  );
}
