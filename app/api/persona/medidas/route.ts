import { NextResponse } from "next/server";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { calculateICC, getICCClassification } from "@/helpers/calculations";
import { validatePersonaMedidasInput } from "@/helpers/validators";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cc = searchParams.get("cc")?.trim() ?? "";

    if (!cc) {
      return NextResponse.json(
        {
          error: "Debes enviar el CC de la persona.",
          fieldErrors: {
            form: "CC invalido.",
          },
        },
        { status: 400 },
      );
    }

    const payload = await request.json();
    const validated = validatePersonaMedidasInput(payload);

    if (!validated.ok) {
      return NextResponse.json(
        {
          error: "Revisa los datos ingresados.",
          fieldErrors: validated.errors,
        },
        { status: 422 },
      );
    }

    const persona = await prisma.persona.update({
      where: { cc },
      data: {
        cintura: validated.data.cintura,
        cadera: validated.data.cadera,
      },
      select: {
        cintura: true,
        cadera: true,
        sexo: true,
      },
    });

    const icc = calculateICC(persona.cintura ?? 0, persona.cadera ?? 0);
    const classification = getICCClassification(icc, persona.sexo);

    return NextResponse.json({
      icc,
      classification,
      cintura: persona.cintura,
      cadera: persona.cadera,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "JSON invalido en la solicitud.",
          fieldErrors: {
            form: "Formato de datos invalido.",
          },
        },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "No fue posible guardar las medidas.";

    if (message.includes("Record to update not found")) {
      return NextResponse.json(
        {
          error: "Persona no encontrada.",
          fieldErrors: {
            form: "No existe una persona con ese CC.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "No fue posible guardar las medidas.",
        fieldErrors: {
          form: message,
        },
      },
      { status: 500 },
    );
  }
}
