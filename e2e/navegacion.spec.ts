// Header global: identidad + rol visibles siempre, y acceso al panel admin
// por navegación (no requiere escribir /admin en la URL). Aterrizaje
// post-login distinto por rol.
import { expect, test } from "@playwright/test";

import { login, loginAs, prisma } from "./helpers";

test.describe("Navegación global y aterrizaje por rol", () => {
  let entrenadorUsername: string | null = null;

  test.afterAll(async () => {
    if (entrenadorUsername) {
      await prisma.user.deleteMany({ where: { username: entrenadorUsername } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("admin: aterriza en /admin y el header muestra usuario + rol", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/admin$/, { timeout: 10_000 });

    const userChip = page.locator("header").getByText("admin", { exact: true });
    await expect(userChip).toBeVisible();
    await expect(
      page.locator("header").getByText("Administrador", { exact: true }),
    ).toBeVisible();
  });

  test("entrenador: aterriza en /atletas (no en /admin), y llega al panel por navegación, sin escribir la URL", async ({
    page,
  }) => {
    entrenadorUsername = `e2e_nav_${Date.now()}`;
    await prisma.user.create({
      data: {
        username: entrenadorUsername,
        // hash de "entrenador1234" (bcrypt, costo 12)
        password: await (await import("bcrypt")).hash("entrenador1234", 12),
        role: "entrenador",
      },
    });

    await loginAs(page, entrenadorUsername, "entrenador1234");
    await page.waitForURL(/\/atletas$/, { timeout: 10_000 });

    await expect(
      page.locator("header").getByText("Entrenador", { exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Panel" }).click();
    await page.waitForURL(/\/admin$/, { timeout: 10_000 });
  });

  test("cerrar sesión desde el header redirige a /login", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/admin$/, { timeout: 10_000 });

    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
