import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "auth_token";
export const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export const ROLES = ["admin", "entrenador"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

type AuthUser = {
  userId: string;
  username: string;
  role: Role;
};

function getJwtSecretKey() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(jwtSecret);
}

function cookieSecureFlag() {
  return process.env.NODE_ENV === "production";
}

export async function createAuthToken(user: AuthUser) {
  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getJwtSecretKey());
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ["HS256"],
    });

    const userId = payload.sub;
    const username = payload.username;
    const role = payload.role;

    if (typeof userId !== "string" || typeof username !== "string" || !isRole(role)) {
      return null;
    }

    return {
      userId,
      username,
      role,
    };
  } catch {
    return null;
  }
}

/**
 * Rechaza si no hay sesión o el rol no está en `allowed`. Usar en Server
 * Actions/rutas que deban restringirse (p. ej. crear entrenadores = solo
 * admin). Lanza en vez de devolver null para que el llamador no olvide
 * comprobar el resultado.
 */
export async function requireRole(allowed: readonly Role[]): Promise<AuthUser> {
  const authUser = await getAuthUserFromCookies();

  if (!authUser || !allowed.includes(authUser.role)) {
    throw new Error("No autorizado.");
  }

  return authUser;
}

export function getTokenFromRequest(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getAuthUserFromRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

/**
 * Igual que getAuthUserFromRequest, pero para Server Actions y Server
 * Components, que no reciben un NextRequest — usa next/headers cookies().
 * Útil para atribuir quién (qué entrenador) hizo una acción en
 * MacrocicloAuditLog, ahora que toda la app requiere sesión (D-19/Q-06).
 */
export async function getAuthUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecureFlag(),
    sameSite: "lax",
    maxAge: AUTH_TOKEN_MAX_AGE_SECONDS,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieSecureFlag(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
