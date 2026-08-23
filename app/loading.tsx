export default function GlobalLoading() {
  return (
    <div className="space-y-4 pb-10">
      <div className="h-20 animate-pulse rounded-3xl border border-gray-200 bg-bg-soft dark:border-white/10" />
      <div className="h-40 animate-pulse rounded-3xl border border-gray-200 bg-bg-soft dark:border-white/10" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-bg-soft dark:border-white/10" />
        <div className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-bg-soft dark:border-white/10" />
      </div>
      <div className="h-56 animate-pulse rounded-3xl border border-gray-200 bg-bg-soft dark:border-white/10" />
    </div>
  );
}
