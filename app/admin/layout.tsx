import { ReactNode } from "react";

import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5 pb-8">
      <header className="rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/8">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Dashboard Admin
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Vista completa de personas, sesiones, resultados, ejercicios y
          usuarios.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[250px_1fr] lg:items-start">
        <AdminNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
