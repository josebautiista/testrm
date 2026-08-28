import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

export async function login(page: Page) {
  await loginAs(page, "admin", "admin1234");
}

export async function loginAs(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin|\/dashboard|\/atletas/, { timeout: 10_000 });
}

// El componente Select (components/ui/Select.tsx) es un listbox custom
// (botón + panel propio), no un <select> nativo — Playwright's
// selectOption() no aplica. Abre el trigger por su aria-label y clickea la
// opción por su texto visible.
export async function selectCustomOption(
  page: Page,
  triggerAriaLabel: string,
  optionLabel: string,
) {
  await page.getByRole("button", { name: triggerAriaLabel }).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

export async function crearPersonaDePrueba(prefijo: string) {
  const cc = `E2E-${prefijo}-${Date.now()}`;
  const persona = await prisma.persona.create({
    data: {
      cc,
      nombre: `Atleta ${prefijo}`,
      sexo: "masculino",
      masaCorporal: 80,
      edad: 28,
      talla: 1.8,
      entrenado: true,
      mesesEntrenamiento: 12,
      diasDisponibles: 4,
      minutosPorSesion: 60,
      equipamiento: ["barra", "maquina", "polea", "peso_corporal"],
    },
  });

  await prisma.rmVigente.createMany({
    data: [
      { personaId: persona.id, ejercicioId: 2, valorKg: 150, origen: "estimacion", confianza: "alta", validoDesde: new Date() },
      { personaId: persona.id, ejercicioId: 5, valorKg: 80, origen: "estimacion", confianza: "alta", validoDesde: new Date() },
    ],
  });

  return persona;
}

export async function crearMacrocicloBorrador(personaId: number, semanas = 12) {
  const fechaInicio = new Date();
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + semanas * 7 - 1);

  return prisma.macrociclo.create({
    data: {
      personaId,
      objetivoTipo: "salud",
      fechaInicio,
      fechaFin,
      estado: "borrador",
    },
  });
}

export async function limpiarPersonaDePrueba(personaId: number) {
  await prisma.ajustePropuesto.deleteMany({ where: { personaId } });
  await prisma.serieRealizada.deleteMany({ where: { sesionRealizada: { personaId } } });
  await prisma.sesionRealizada.deleteMany({ where: { personaId } });
  await prisma.rmVigente.deleteMany({ where: { personaId } });
  await prisma.macrociclo.deleteMany({ where: { personaId } });
  await prisma.sesion.deleteMany({ where: { personaId } });
  await prisma.persona.delete({ where: { id: personaId } }).catch(() => {});
}
