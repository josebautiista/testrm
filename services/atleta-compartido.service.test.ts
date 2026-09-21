import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { puedeAccederAPersona } from "@/lib/persona-access";
import { createPersona } from "./persona.service";
import { guardarYVincularAtleta, type FichaAtleta } from "./atleta-compartido.service";

describe("atletas compartidos — integración", () => {
  const suffix = `compartido-${Date.now()}`;
  const autorA = { userId: `${suffix}-a`, username: `${suffix}-a`, role: "entrenador" as const };
  const autorB = { userId: `${suffix}-b`, username: `${suffix}-b`, role: "entrenador" as const };
  const cc = suffix;
  const datos: FichaAtleta = { nombre: "Atleta compartido", sexo: "masculino", masaCorporal: 180, edad: 30, talla: 1.8 };
  let personaId: number;

  beforeAll(async () => {
    await prisma.user.createMany({ data: [autorA, autorB].map((a) => ({ id: a.userId, username: a.username, password: "unused" })) });
    const persona = await createPersona({ ...datos, masaCorporal: 80, cc, entrenado: true, entrenadorId: autorA.userId });
    personaId = persona.id;
  });

  afterAll(async () => {
    await prisma.persona.deleteMany({ where: { cc } });
    await prisma.user.deleteMany({ where: { id: { in: [autorA.userId, autorB.userId] } } });
    await prisma.$disconnect();
  });

  it("el registro vincula al creador; consultar no da permisos de edición", async () => {
    expect(await puedeAccederAPersona(autorA, personaId)).toBe(true);
    expect(await puedeAccederAPersona(autorB, personaId)).toBe(false);
    expect(await puedeAccederAPersona(null, personaId)).toBe(false);
    expect(await puedeAccederAPersona({ ...autorB, role: "admin" }, personaId)).toBe(true);
  });

  it("vincula sin editar ni duplicar, conservando al primer entrenador", async () => {
    const antes = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    await guardarYVincularAtleta({ cc, version: "", autor: autorB });
    await guardarYVincularAtleta({ cc, version: "", autor: autorB });
    expect(await prisma.persona.findUnique({ where: { cc } })).toEqual(antes);
    expect(await prisma.personaEntrenador.count({ where: { personaId } })).toBe(2);
    expect(await puedeAccederAPersona(autorA, personaId)).toBe(true);
    expect(await puedeAccederAPersona(autorB, personaId)).toBe(true);
  });

  it("comparte las modificaciones y conserva autoría y campos ajenos al formulario", async () => {
    const antes = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    await guardarYVincularAtleta({ cc, version: antes.updatedAt.toISOString(), datos, autor: autorB });
    const despues = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    expect(despues).toMatchObject({ ...datos, entrenado: true, entrenadorId: autorA.userId });
    const audit = await prisma.personaCambio.findFirstOrThrow({ where: { personaId } });
    expect(audit.autorId).toBe(autorB.userId);
    expect(audit.antes).toMatchObject({ masaCorporal: 80 });
    expect(audit.despues).toMatchObject({ masaCorporal: 180 });
  });

  it("solo permite un guardado cuando dos entrenadores editan la misma versión", async () => {
    const persona = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    const version = persona.updatedAt.toISOString();
    const resultados = await Promise.allSettled([
      guardarYVincularAtleta({ cc, version, datos: { ...datos, edad: 31 }, autor: autorA }),
      guardarYVincularAtleta({ cc, version, datos: { ...datos, edad: 32 }, autor: autorB }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason.message).toContain("Otro entrenador modificó");
    expect(await prisma.personaCambio.count({ where: { personaId } })).toBe(2);
  });

  it("una ficha inválida no se guarda", async () => {
    const persona = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    await expect(guardarYVincularAtleta({ cc, version: persona.updatedAt.toISOString(), datos: { ...datos, edad: -1 }, autor: autorA })).rejects.toThrow("edad");
    expect(await prisma.persona.findUnique({ where: { cc } })).toEqual(persona);
  });
});
