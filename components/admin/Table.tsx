import { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
  hasRows: boolean;
  emptyMessage?: string;
};

export function Table({
  headers,
  children,
  hasRows,
  emptyMessage = "Sin registros.",
}: TableProps) {
  if (!hasRows) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/8">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/8">
        <thead className="bg-bg-main">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-left font-medium text-text-secondary"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-bg-soft dark:divide-white/8">
          {children}
        </tbody>
      </table>
    </div>
  );
}
