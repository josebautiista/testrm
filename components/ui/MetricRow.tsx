type MetricRowTone = "positive" | "neutral" | "negative";

type MetricRowProps = {
  label: string;
  value: string;
  tone?: MetricRowTone;
  compact?: boolean;
};

const toneClass: Record<MetricRowTone, string> = {
  positive: "text-accent",
  neutral: "text-white",
  negative: "text-text-secondary",
};

export function MetricRow({
  label,
  value,
  tone = "neutral",
  compact = false,
}: MetricRowProps) {
  return (
    <div
      className={[
        "flex items-baseline justify-between gap-4",
        compact ? "py-1" : "py-2",
      ].join(" ")}
    >
      <span
        className={
          compact
            ? "text-sm text-text-secondary"
            : "text-base text-text-secondary"
        }
      >
        {label}
      </span>
      <span
        className={[compact ? "text-sm" : "text-base", toneClass[tone]].join(
          " ",
        )}
      >
        {value}
      </span>
    </div>
  );
}
