export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-bg-soft dark:border-white/8" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-bg-soft dark:border-white/8"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-bg-soft dark:border-white/8" />
    </div>
  );
}
