"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AdminButton } from "@/components/ui/AdminButton";

const navItems = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/personas", label: "Personas" },
  { href: "/admin/sesiones", label: "Sesiones" },
  { href: "/admin/ejercicios", label: "Ejercicios" },
  { href: "/admin/usuarios", label: "Usuarios" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-soft">
      <p className="border-b border-border-subtle px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Administración
      </p>
      <nav className="p-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-150",
                    active
                      ? "bg-bg-subtle font-medium text-text-primary dark:text-white"
                      : "text-text-secondary hover:bg-bg-subtle/60 hover:text-text-primary dark:hover:text-white",
                  ].join(" ")}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border-subtle p-3">
        <AdminButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleLogout()}
          className="w-full justify-center gap-1.5"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </AdminButton>
      </div>
    </aside>
  );
}
