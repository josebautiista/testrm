import { PrimaryButton } from "@/components/ui/PrimaryButton";

export type RmCaducadoInfo = {
  ejercicioNombre: string;
  semanasTranscurridas: number;
};

type RetestReminderBannerProps = {
  /** TASK-052/R-15: por ejercicio, no por días desde la última sesión. */
  rmsCaducados: RmCaducadoInfo[];
  newSessionHref: string;
};

export function RetestReminderBanner({
  rmsCaducados,
  newSessionHref,
}: RetestReminderBannerProps) {
  if (rmsCaducados.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">
        {rmsCaducados.length === 1
          ? "1 ejercicio con RM caducado (R-15)"
          : `${rmsCaducados.length} ejercicios con RM caducado (R-15)`}
      </p>
      <ul className="space-y-1">
        {rmsCaducados.map((rm) => (
          <li key={rm.ejercicioNombre}>
            {rm.ejercicioNombre} — hace {Math.round(rm.semanasTranscurridas)} semanas
          </li>
        ))}
      </ul>
      <p>
        Repite el test en estos ejercicios para que las cargas prescritas
        sigan siendo confiables.
      </p>
      <PrimaryButton href={newSessionHref}>Repetir prueba de fuerza</PrimaryButton>
    </div>
  );
}
