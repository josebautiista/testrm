import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest, isRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateUserBody = {
  username?: unknown;
  password?: unknown;
  role?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado." }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json(
    { error: "Solo un administrador puede gestionar usuarios." },
    { status: 403 },
  );
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return unauthorizedResponse();
  }

  if (authUser.role !== "admin") {
    return forbiddenResponse();
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return unauthorizedResponse();
  }

  if (authUser.role !== "admin") {
    return forbiddenResponse();
  }

  let body: CreateUserBody;

  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const username = normalizeText(body.username).toLowerCase();
  const password = normalizeText(body.password);
  const role = isRole(body.role) ? body.role : "entrenador";

  if (username.length < 3) {
    return NextResponse.json(
      { error: "El usuario debe tener al menos 3 caracteres." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contrasena debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "El nombre de usuario ya existe." },
        { status: 409 },
      );
    }

    throw error;
  }
}
