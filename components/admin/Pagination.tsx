import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
};

function hrefFor(basePath: string, page: number) {
  if (page <= 1) {
    return basePath;
  }

  return `${basePath}?page=${page}`;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <Link
        href={hrefFor(basePath, Math.max(1, currentPage - 1))}
        className={[
          "rounded-xl border px-3 py-2",
          currentPage <= 1
            ? "pointer-events-none border-gray-200 text-text-tertiary dark:border-white/8"
            : "border-gray-200 text-text-primary hover:bg-bg-main dark:border-white/10 dark:text-white",
        ].join(" ")}
      >
        Anterior
      </Link>

      <p className="text-text-secondary">
        Pagina {currentPage} de {totalPages}
      </p>

      <Link
        href={hrefFor(basePath, Math.min(totalPages, currentPage + 1))}
        className={[
          "rounded-xl border px-3 py-2",
          currentPage >= totalPages
            ? "pointer-events-none border-gray-200 text-text-tertiary dark:border-white/8"
            : "border-gray-200 text-text-primary hover:bg-bg-main dark:border-white/10 dark:text-white",
        ].join(" ")}
      >
        Siguiente
      </Link>
    </div>
  );
}
