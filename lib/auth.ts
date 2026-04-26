import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "auth_token";
export const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

type AuthUser = {
  userId: string;
  username: string;
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
  return new SignJWT({ username: user.username })
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

    if (typeof userId !== "string" || typeof username !== "string") {
      return null;
    }

    return {
      userId,
      username,
    };
  } catch {
    return null;
  }
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
