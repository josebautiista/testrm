type StatCardProps = {
  label: string;
  value: number | string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/8">
      <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary dark:text-white">
        {value}
      </p>
    </article>
  );
}
