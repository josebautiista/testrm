"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "./ThemeToggle";

export function AppThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const prefersDark = savedTheme !== "light";
    setIsDark(prefersDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      window.localStorage.setItem("theme", "dark");
      return;
    }

    root.classList.remove("dark");
    window.localStorage.setItem("theme", "light");
  }, [isDark]);

  return (
    <ThemeToggle isDark={isDark} onToggle={() => setIsDark((prev) => !prev)} />
  );
}
