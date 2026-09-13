import InfoTooltip from "@/components/ui/InfoTooltip";
import type { ResumenMacrociclo as ResumenMacrocicloData } from "@/services/macrociclo.service";

function formatNumber(value: number, decimales = 1) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(value);
}

function formatFecha(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(
    value,
  );
}

/**
 * M9 mínimo viable (ver DECISIONES.md). ADR-51: se quitaron "tonelaje
 * registrado" y "ajustes propuestos" — dependían de series registradas por
 * ejercicio, que el flujo de WOD en texto libre (ADR-50) ya no genera por
 * defecto; mostrar siempre 0 era más confuso que útil.
 */
export function ResumenMacrociclo({ resumen }: { resumen: ResumenMacrocicloData }) {
  const { rm, adherencia, rango } = resumen;

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
      <div className="space-y-1">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Resumen del macrociclo
          </h2>
          <InfoTooltip text="Compara el RM vigente al arrancar este macrociclo con el RM vigente de hoy, y cuenta cuántas sesiones se completaron frente a las que ya deberían haberse hecho." />
        </div>
        <p className="text-sm text-text-secondary">
          {formatFecha(rango.desde)} – {formatFecha(rango.hasta)}
        </p>
      </div>

      <div>
        <div className="flex items-center">
          <h3 className="text-sm font-semibold text-text-primary dark:text-white">
            Evolución del RM
          </h3>
          <InfoTooltip text="'Al inicio' es el RM vigente el día que arrancó este macrociclo; 'hoy' es el vigente ahora mismo. Esto NO se actualiza solo con cada sesión: solo cambia cuando repites un test de RM (Nueva sesión) o registras una posible marca nueva en el campo opcional de la pantalla de la sesión. Si no has hecho ninguna de las dos cosas desde que arrancó el macrociclo, va a mostrar 0% aunque el atleta esté entrenando." />
        </div>
        {rm.length === 0 ? (
          <p className="mt-1 text-sm text-text-secondary">
            Aún no hay RM registrado para ejercicios de este macrociclo.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-text-tertiary">
                <tr>
                  <th className="px-3 py-2 font-medium">Ejercicio</th>
                  <th className="px-3 py-2 font-medium">Al inicio</th>
                  <th className="px-3 py-2 font-medium">Hoy</th>
                  <th className="px-3 py-2 font-medium">Cambio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {rm.map((r) => (
                  <tr key={r.ejercicioId}>
                    <td className="px-3 py-2 text-text-primary dark:text-white">
                      {r.ejercicioNombre}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {r.inicioKg !== null ? `${formatNumber(r.inicioKg)} kg` : "—"}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {r.actualKg !== null ? `${formatNumber(r.actualKg)} kg` : "—"}
                    </td>
                    <td
                      className={
                        r.deltaPct === null
                          ? "px-3 py-2 text-text-tertiary"
                          : r.deltaPct >= 0
                            ? "px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400"
                            : "px-3 py-2 font-medium text-red-600 dark:text-red-400"
                      }
                    >
                      {r.deltaPct !== null
                        ? `${r.deltaPct >= 0 ? "+" : ""}${formatNumber(r.deltaPct)}%`
                        : "sin dato de inicio"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-3 dark:border-white/10 dark:bg-bg-subtle">
        <div className="flex items-center">
          <p className="text-xs text-text-secondary">Adherencia</p>
          <InfoTooltip text="% de sesiones completadas sobre las que ya deberían haberse hecho a la fecha (no cuenta las que aún están en el futuro)." />
        </div>
        <p className="text-lg font-semibold text-text-primary dark:text-white">
          {adherencia.porcentajeAdherencia !== null
            ? `${formatNumber(adherencia.porcentajeAdherencia, 0)}%`
            : "sin datos"}
        </p>
        <p className="text-xs text-text-tertiary">
          {adherencia.realizadas} completas · {adherencia.parciales} parciales ·{" "}
          {adherencia.omitidas} omitidas · {adherencia.pendientes} pendientes
        </p>
      </div>
    </section>
  );
}
