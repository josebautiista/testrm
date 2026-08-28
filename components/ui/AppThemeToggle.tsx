"use client";

import { useLayoutEffect, useState } from "react";

import { ThemeToggle } from "./ThemeToggle";

export function AppThemeToggle() {
  // El servidor no puede leer localStorage, así que siempre asume "dark"
  // (igual que hacía el theme-script por defecto) — el primer render en el
  // cliente debe arrancar en el mismo valor o React marca un hydration
  // mismatch. useLayoutEffect corrige el valor real (ya aplicado al <html>
  // por ThemeScript antes del primer pintado) antes de que el navegador
  // pinte, así que no hay parpadeo visible.
  const [isDark, setIsDark] = useState(true);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function handleToggle() {
    setIsDark((prev) => {
      const next = !prev;
      const root = document.documentElement;
      root.classList.toggle("dark", next);
      window.localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  return <ThemeToggle isDark={isDark} onToggle={handleToggle} />;
}
