// Sin overflow horizontal en las rutas principales a varios anchos de
// viewport (móvil/tablet/desktop), y el login se centra correctamente
// dentro del alto disponible bajo el header global.
import { expect, test } from "@playwright/test";

import {
  crearMacrocicloBorrador,
  crearPersonaDePrueba,
  limpiarPersonaDePrueba,
  login,
} from "./helpers";

const VIEWPORTS = [
  { name: "mobile-sm", width: 320, height: 700 },
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

test("sin overflow horizontal en rutas principales, en ningún viewport", async ({
  page,
}) => {
  await login(page);

  const persona = await crearPersonaDePrueba("responsive");
  const macrociclo = await crearMacrocicloBorrador(persona.id);

  const routes = [
    "/",
    `/dashboard?cc=${encodeURIComponent(persona.cc)}`,
    `/macrociclo/${macrociclo.id}?cc=${encodeURIComponent(persona.cc)}`,
    "/admin",
    "/admin/ejercicios",
  ];

  const problems: string[] = [];

  try {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        await page.goto(route, { waitUntil: "networkidle" });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        if (scrollWidth > innerWidth + 1) {
          problems.push(
            `${viewport.name} (${viewport.width}px) ${route}: overflow ${scrollWidth - innerWidth}px`,
          );
        }
      }
    }
  } finally {
    await limpiarPersonaDePrueba(persona.id);
  }

  expect(problems, problems.join("\n")).toHaveLength(0);
});

test("el login se centra verticalmente bajo el header (sin doble min-h-screen)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");

  const gaps = await page.evaluate(() => {
    const main = document.querySelector("main")?.getBoundingClientRect();
    const section = document.querySelector("section")?.getBoundingClientRect();
    if (!main || !section) return null;
    return {
      top: section.top - main.top,
      bottom: main.bottom - section.bottom,
    };
  });

  expect(gaps).not.toBeNull();
  expect(Math.abs(gaps!.top - gaps!.bottom)).toBeLessThan(2);
});
