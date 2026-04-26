"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    return "No se pudo iniciar sesion.";
  }

  return "No se pudo iniciar sesion.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const fromPath = searchParams.get("from");
      const destination =
        fromPath && fromPath.startsWith("/") ? fromPath : "/admin";

      router.replace(destination);
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-gray-200 bg-bg-soft p-6 shadow-sm dark:border-white/8 dark:shadow-none">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary dark:text-white">
          Iniciar sesion
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Ingresa con tus credenciales para administrar usuarios.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-text-primary dark:text-white"
            >
              Usuario
            </label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-text-primary dark:text-white"
            >
              Contrasena
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="rounded-xl">
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
