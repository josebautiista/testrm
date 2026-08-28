// P-10: catálogo de ejercicios editable (antes solo lectura).
import { expect, test } from "@playwright/test";

import { login, prisma, selectCustomOption } from "./helpers";

test.describe("Catálogo de ejercicios editable (P-10)", () => {
  let creadoId: number | null = null;
  let musculosSecundariosOriginal: unknown = null;

  test.afterAll(async () => {
    if (creadoId) {
      await prisma.ejercicio.delete({ where: { id: creadoId } }).catch(() => {});
    }
    if (musculosSecundariosOriginal !== null) {
      await prisma.ejercicio
        .update({ where: { id: 1 }, data: { musculosSecundarios: musculosSecundariosOriginal as never } })
        .catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("crear un ejercicio nuevo desde el admin", async ({ page }) => {
    await login(page);
    await page.goto("/admin/ejercicios");
    await page.getByRole("link", { name: "Nuevo ejercicio" }).click();

    await expect(page.getByRole("heading", { name: "Nuevo ejercicio" })).toBeVisible();

    const nombre = `Ejercicio E2E ${Date.now()}`;
    await page.locator('input[name="nombre"]').fill(nombre);
    await selectCustomOption(page, "Patrón de movimiento", "empuje vertical");
    await page.locator('input[name="musculoPrimario"]').fill("deltoides");
    await selectCustomOption(page, "Equipamiento", "mancuerna");
    await page.locator('input[name="incrementoMinimoKg"]').fill("2.5");
    await page.locator('input[name="porcentajeMasaHombre"]').fill("0.4");
    await page.locator('input[name="porcentajeMasaMujer"]').fill("0.3");

    await page.getByRole("button", { name: "Crear ejercicio" }).click();
    await page.waitForURL(/\/admin\/ejercicios$/, { timeout: 10_000 });

    await expect(page.getByText(nombre)).toBeVisible();

    const creado = await prisma.ejercicio.findFirstOrThrow({ where: { nombre } });
    creadoId = creado.id;
    expect(creado.patron).toBe("empuje_vertical");
    expect(creado.musculoPrimario).toBe("deltoides");
    // Ids >6 confirma que el autoincrement (C-02) preservó 1..6 y sigue desde ahí.
    expect(creado.id).toBeGreaterThan(6);
  });

  test("editar un ejercicio existente del seed", async ({ page }) => {
    const original = await prisma.ejercicio.findUniqueOrThrow({ where: { id: 1 } });
    musculosSecundariosOriginal = original.musculosSecundarios;

    await login(page);
    await page.goto("/admin/ejercicios");
    await page.getByRole("link", { name: "Editar" }).first().click();

    await expect(page.getByRole("heading", { name: /^Editar:/ })).toBeVisible();

    const notaUnica = `nota-e2e-${Date.now()}`;
    await page.locator('input[name="musculosSecundarios"]').fill(notaUnica);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.waitForURL(/\/admin\/ejercicios$/, { timeout: 10_000 });

    const ejercicioActualizado = await prisma.ejercicio.findFirstOrThrow({
      where: { id: 1 },
    });
    expect(ejercicioActualizado.musculosSecundarios).toEqual([notaUnica]);
  });
});
