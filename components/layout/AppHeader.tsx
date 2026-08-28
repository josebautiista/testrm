"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AppThemeToggle } from "@/components/ui/AppThemeToggle";
import type { Role } from "@/lib/auth";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/atletas", label: "Atletas" },
  { href: "/admin", label: "Panel" },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  entrenador: "Entrenador",
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function AppHeader({
  username,
  role,
}: {
  username: string;
  role: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  const homeHref = role === "admin" ? "/admin" : "/atletas";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-bg-main/95 backdrop-blur dark:border-white/8">
      <div className="mx-auto flex w-full max-w-105 items-center justify-between gap-3 px-4 py-3 lg:max-w-6xl">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-primary dark:text-white"
        >
          <span aria-hidden="true" className="text-lg">
            🏋️
          </span>
          <span className="hidden sm:inline">Entrena tu fuerza</span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary dark:hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <AppThemeToggle />

          <div className="hidden items-center gap-2.5 lg:flex">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 dark:border-white/10">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold tracking-widest text-accent"
              >
                {getInitials(username)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium text-text-primary dark:text-white">
                  {username}
                </span>
                <span className="block text-[11px] text-text-tertiary">
                  {ROLE_LABELS[role]}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-red-400/50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:text-red-400"
            >
              {loggingOut ? "Saliendo..." : "Salir"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-subtle hover:text-text-primary lg:hidden dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-gray-200 px-4 py-3 lg:hidden dark:border-white/8">
          <nav
            aria-label="Navegación principal (móvil)"
            className="flex flex-col gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary dark:hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-white/8">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold tracking-widest text-accent"
              >
                {getInitials(username)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium text-text-primary dark:text-white">
                  {username}
                </span>
                <span className="block text-xs text-text-tertiary">
                  {ROLE_LABELS[role]}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-red-400/50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:text-red-400"
            >
              {loggingOut ? "Saliendo..." : "Salir"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const onLogin = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-bg-main/95 backdrop-blur dark:border-white/8">
      <div className="mx-auto flex w-full max-w-105 items-center justify-between gap-3 px-4 py-3 lg:max-w-6xl">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-white"
        >
          <span aria-hidden="true" className="text-lg">
            🏋️
          </span>
          <span>Entrena tu fuerza</span>
        </Link>
        <div className="flex items-center gap-2">
          <AppThemeToggle />
          {onLogin ? null : (
            <Link
              href="/login"
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
