import { HealthClassification } from "@/helpers/calculations";

type IMCCardProps = {
  imc: number;
  classification: HealthClassification;
};

const badgeColorClass: Record<HealthClassification["color"], string> = {
  verde: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  amarillo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  rojo: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function IMCCard({ imc, classification }: IMCCardProps) {
  const safeIMC = Number.isFinite(imc) && imc > 0 ? imc.toFixed(1) : "--";

  return (
    <section className="rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/8">
      <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">
        Indice de masa corporal
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-5xl font-semibold leading-none tracking-tight text-text-primary dark:text-white">
          {safeIMC}
        </p>
        <span
          className={[
            "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
            badgeColorClass[classification.color],
          ].join(" ")}
        >
          {classification.label}
        </span>
      </div>
    </section>
  );
}
