import { getBMIInterpretation, type BMIInterpretation } from "@/helpers/calculations";
import { Tooltip } from "@/components/ui/Tooltip";

type BMIIndicatorProps = {
  bmi: number;
};

type BMIRow = {
  min: number;
  max: number | null;
  range: string;
  label: string;
  color: BMIInterpretation["color"];
};

const bmiRows: BMIRow[] = [
  { min: 0, max: 18.5, range: "< 18.5", label: "Bajo peso", color: "amarillo" },
  { min: 18.5, max: 25, range: "18.5 - 24.9", label: "Normal", color: "verde" },
  { min: 25, max: 30, range: "25.0 - 29.9", label: "Sobrepeso", color: "amarillo" },
  { min: 30, max: 35, range: "30.0 - 34.9", label: "Obesidad grado I", color: "rojo" },
  { min: 35, max: 40, range: "35.0 - 39.9", label: "Obesidad grado II", color: "rojo" },
  { min: 40, max: null, range: "≥ 40.0", label: "Obesidad grado III", color: "rojo" },
];

const badgeColorClass: Record<BMIInterpretation["color"], string> = {
  verde: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  amarillo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  rojo: "bg-red-500/20 text-red-300 border-red-500/30",
};

function getHighlightedIndex(bmi: number) {
  if (!Number.isFinite(bmi) || bmi <= 0) {
    return -1;
  }

  return bmiRows.findIndex((row) => {
    if (row.max === null) {
      return bmi >= row.min;
    }

    return bmi >= row.min && bmi < row.max;
  });
}

export function BMIIndicator({ bmi }: BMIIndicatorProps) {
  const safeBMI = Number.isFinite(bmi) && bmi > 0 ? bmi.toFixed(1) : "--";
  const interpretation = getBMIInterpretation(bmi);
  const highlightedIndex = getHighlightedIndex(bmi);

  return (
    <section
      data-tour="imc-card"
      className="space-y-4 rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/10"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            Índice de masa corporal (IMC)
          </h2>
          <Tooltip text="Es una referencia general basada en tu peso y estatura. Puede no ser preciso en personas con mucha masa muscular." />
        </div>
        <p className="text-sm text-text-secondary">
          El índice de masa corporal (IMC) relaciona tu peso con tu estatura
          para darte una idea general de tu estado corporal.
        </p>
        <p className="text-sm text-text-secondary">
          No mide directamente la grasa corporal, pero sirve como referencia
          inicial.
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
        <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">
          IMC = peso (kg) / altura² (m)
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <p className="text-5xl font-semibold leading-none tracking-tight text-text-primary dark:text-white">
            {safeBMI}
          </p>
          <span
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
              badgeColorClass[interpretation.color],
            ].join(" ")}
          >
            {interpretation.label}
          </span>
        </div>
        <p className="mt-3 text-sm text-text-secondary">
          {interpretation.message}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[360px] text-left text-sm">
          <thead className="bg-bg-subtle text-xs uppercase text-text-tertiary">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                Clasificación
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Rango IMC
              </th>
              <th scope="col" className="px-3 py-3 text-center font-medium">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {bmiRows.map((row, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <tr
                  key={row.label}
                  className={isHighlighted ? "bg-bg-subtle" : "bg-bg-main dark:bg-transparent"}
                >
                  <td className="px-3 py-3 font-medium text-text-primary dark:text-white">
                    {row.label}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-text-secondary">
                    {row.range}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                        isHighlighted
                          ? badgeColorClass[row.color]
                          : "border-gray-200 bg-bg-soft text-text-tertiary dark:border-white/10",
                      ].join(" ")}
                    >
                      {isHighlighted ? "Actual" : "Referencia"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-tertiary">
        Clasificación basada en la Organización Mundial de la Salud (OMS).
      </p>
    </section>
  );
}
