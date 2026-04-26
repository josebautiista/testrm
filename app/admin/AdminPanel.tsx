"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminButton } from "@/components/ui/AdminButton";
import { Input } from "@/components/ui/Input";

type UserView = {
  id: string;
  username: string;
  createdAt: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    return "Ocurrio un error inesperado.";
  }
  return "Ocurrio un error inesperado.";
}

// ──────────────────────────────────────────────
// Sub-component: Expandable user row
// ──────────────────────────────────────────────
function UserRow({
  user,
  isBusy,
  passwordValue,
  onPasswordChange,
  onUpdatePassword,
  onDelete,
}: {
  user: UserView;
  isBusy: boolean;
  passwordValue: string;
  onPasswordChange: (val: string) => void;
  onUpdatePassword: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle/50"
      >
        {/* Avatar */}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold tracking-widest text-accent"
        >
          {getInitials(user.username)}
        </span>

        {/* Info */}
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-text-primary dark:text-white">
            {user.username}
          </span>
          <span className="block text-xs text-text-tertiary">
            {formatDateTime(user.createdAt)}
          </span>
        </span>

        {/* Chevron */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            "h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200",
            expanded ? "rotate-90" : "",
          ].join(" ")}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="border-t border-border-subtle bg-bg-subtle/30 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Cambiar contraseña
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={passwordValue}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Nueva contraseña (min. 8 caracteres)"
              autoComplete="new-password"
              className="py-2 text-sm"
            />
            <AdminButton
              type="button"
              variant="ghost"
              size="md"
              onClick={onUpdatePassword}
              disabled={isBusy}
              className="shrink-0"
            >
              {isBusy ? "..." : "Guardar"}
            </AdminButton>
          </div>

          <div className="mt-3 flex justify-end">
            <AdminButton
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={isBusy}
            >
              {isBusy ? "Eliminando..." : "Eliminar usuario"}
            </AdminButton>
          </div>
        </div>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────
// Main panel
// ──────────────────────────────────────────────
export default function AdminPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordByUser, setPasswordByUser] = useState<Record<string, string>>(
    {},
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        a.username.localeCompare(b.username, "es", { sensitivity: "base" }),
      ),
    [users],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as { users?: UserView[] };
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setNewUsername("");
      setNewPassword("");
      await loadUsers();
    } catch {
      setError("No se pudo crear el usuario.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdatePassword(userId: string) {
    const password = (passwordByUser[userId] ?? "").trim();

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setBusyUserId(userId);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setPasswordByUser((prev) => ({ ...prev, [userId]: "" }));
    } catch {
      setError("No se pudo actualizar la contraseña.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    setBusyUserId(userId);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError("No se pudo eliminar el usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

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

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 pb-16">
      {/* ── Header ── */}
      <header className="flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-soft px-5 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            Panel de administración
          </h1>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Gestión de usuarios · Autenticación JWT
          </p>
        </div>
        <AdminButton
          type="button"
          variant="ghost"
          size="md"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            "Saliendo..."
          ) : (
            <span className="flex items-center gap-1.5">
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
            </span>
          )}
        </AdminButton>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            aria-label="Cerrar error"
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Crear usuario ── */}
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-soft">
        <div className="border-b border-border-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary dark:text-white">
            Crear usuario
          </h2>
        </div>

        <form onSubmit={handleCreateUser} className="p-4">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Nombre de usuario"
              autoComplete="username"
              required
              className="py-2.5 text-sm"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="new-password"
              required
              className="py-2.5 text-sm"
            />
            <AdminButton
              type="submit"
              variant="primary"
              size="md"
              disabled={creating}
              className="h-full w-full sm:w-auto"
            >
              {creating ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 animate-spin"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Creando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Crear
                </span>
              )}
            </AdminButton>
          </div>
        </form>
      </section>

      {/* ── Lista de usuarios ── */}
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-soft">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary dark:text-white">
            Usuarios
            {!loading && (
              <span className="ml-2 rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-normal text-text-tertiary">
                {sortedUsers.length}
              </span>
            )}
          </h2>
          <AdminButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3 animate-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Cargando
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M1 4v6h6" />
                  <path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
                  <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
                </svg>
                Recargar
              </span>
            )}
          </AdminButton>
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-border-subtle">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-bg-subtle" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded-md bg-bg-subtle" />
                  <div className="h-2.5 w-20 animate-pulse rounded-md bg-bg-subtle" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-text-tertiary"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="text-sm text-text-secondary">
              No hay usuarios registrados.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {sortedUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isBusy={busyUserId === user.id}
                passwordValue={passwordByUser[user.id] ?? ""}
                onPasswordChange={(val) =>
                  setPasswordByUser((prev) => ({ ...prev, [user.id]: val }))
                }
                onUpdatePassword={() => void handleUpdatePassword(user.id)}
                onDelete={() => void handleDeleteUser(user.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
