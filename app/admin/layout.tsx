import { ReactNode } from "react";

import { AdminNav } from "@/components/admin/AdminNav";
import { getAuthUserFromCookies } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authUser = await getAuthUserFromCookies();

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

      <div className="grid min-w-0 gap-4 lg:grid-cols-[250px_1fr] lg:items-start">
        <AdminNav role={authUser?.role ?? "entrenador"} />
        {/* min-w-0: sin esto, un grid item no se encoge por debajo del
            ancho intrínseco de su contenido (p. ej. una tabla ancha), así
            que el overflow-x-auto de <Table> nunca llega a activarse y
            toda la página se estira en vez de la tabla scrollear sola. */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
