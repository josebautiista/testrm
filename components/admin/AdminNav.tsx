"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Resumen", adminOnly: false },
  { href: "/admin/personas", label: "Personas", adminOnly: false },
  { href: "/admin/sesiones", label: "Sesiones", adminOnly: false },
  { href: "/admin/macrociclos", label: "Macrociclos", adminOnly: false },
  { href: "/admin/ejercicios", label: "Ejercicios", adminOnly: false },
  { href: "/admin/usuarios", label: "Usuarios", adminOnly: true },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || role === "admin",
  );

  return (
    <aside className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-soft">
      <p className="border-b border-border-subtle px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Administración
      </p>
      <nav className="p-2">
        <ul className="space-y-0.5">
          {visibleNavItems.map((item) => {
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
    </aside>
  );
}
