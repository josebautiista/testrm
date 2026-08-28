// Roles: admin crea entrenadores; entrenadores no pueden gestionar usuarios
// pero sí pueden registrar atletas.
import { expect, test } from "@playwright/test";

import { login, loginAs, prisma, selectCustomOption } from "./helpers";

test.describe("Roles (admin / entrenador)", () => {
  let entrenadorUsername: string | null = null;

  test.afterAll(async () => {
    if (entrenadorUsername) {
      await prisma.user.deleteMany({ where: { username: entrenadorUsername } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("un admin puede crear un entrenador desde /admin/usuarios", async ({ page }) => {
    await login(page);
    await page.goto("/admin/usuarios");

    entrenadorUsername = `e2e_entrenador_${Date.now()}`;

    await page.getByPlaceholder("Nombre de usuario").fill(entrenadorUsername);
    await page.getByPlaceholder("Contraseña").fill("entrenador1234");
    await selectCustomOption(page, "Rol del nuevo usuario", "Entrenador");
    await page.getByRole("button", { name: "Crear" }).click();

    const userRow = page.locator("li").filter({ hasText: entrenadorUsername });
    await expect(userRow).toBeVisible();
    await expect(userRow.getByText("Entrenador", { exact: true })).toBeVisible();

    const created = await prisma.user.findUniqueOrThrow({
      where: { username: entrenadorUsername },
    });
    expect(created.role).toBe("entrenador");
  });

  test("un entrenador no puede ver /admin/usuarios ni crear usuarios, pero sí puede registrar un atleta", async ({
    page,
  }) => {
    expect(entrenadorUsername).not.toBeNull();

    await loginAs(page, entrenadorUsername!, "entrenador1234");

    // Redirigido lejos de la gestión de usuarios.
    await page.goto("/admin/usuarios");
    await page.waitForURL(/\/admin$/, { timeout: 10_000 });

    // El enlace "Usuarios" no aparece en la navegación admin para este rol.
    await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

    // La API rechaza la creación de usuarios para este rol.
    const apiResponse = await page.request.post("/api/users", {
      data: { username: "otro", password: "12345678", role: "entrenador" },
    });
    expect(apiResponse.status()).toBe(403);

    // Pero sí puede registrar un atleta nuevo.
    const cc = `E2E-ROL-${Date.now()}`;
    await page.goto(`/registro?cc=${encodeURIComponent(cc)}`);
    await page.locator("#nombre").fill("Atleta de prueba roles");
    await selectCustomOption(page, "Sexo", "Masculino");
    await page.locator("#masaCorporal").fill("80");
    await page.locator("#edad").fill("28");
    await page.locator("#talla").fill("1.8");
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const persona = await prisma.persona.findUnique({ where: { cc } });
    expect(persona).not.toBeNull();
    await prisma.persona.delete({ where: { cc } }).catch(() => {});
  });
});
