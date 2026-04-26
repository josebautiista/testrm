import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { createAuthToken, setAuthCookie } from "@/lib/auth";
import { ensureDefaultAdminUser } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function normalizeCredential(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  await ensureDefaultAdminUser();

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const username = normalizeCredential(body.username);
  const password = normalizeCredential(body.password);

  if (!username || !password) {
    return NextResponse.json(
      { error: "Usuario y contrasena son requeridos." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Credenciales invalidas." },
      { status: 401 },
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Credenciales invalidas." },
      { status: 401 },
    );
  }

  const token = await createAuthToken({
    userId: user.id,
    username: user.username,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
    },
  });

  setAuthCookie(response, token);
  return response;
}
