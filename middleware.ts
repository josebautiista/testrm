import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Gestión de cuentas (crear/editar entrenadores) es exclusiva de admin —
  // el resto de /admin/** (personas, sesiones, macrociclos, ejercicios)
  // sigue siendo operado por cualquier entrenador.
  if (
    request.nextUrl.pathname.startsWith("/admin/usuarios") &&
    authUser.role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

// D-19/Q-06: antes solo /admin/** requería sesión — todo el flujo de
// persona viajaba como `?cc=` en la URL, así que conocer una cédula daba
// acceso completo de lectura y escritura a datos de salud de terceros. El
// producto ahora es operado por el entrenador (A1/Q-02): toda la app
// requiere la misma sesión, salvo login, la landing pública ("/") y los
// endpoints que sostienen el login.
export const config = {
  matcher: [
    "/((?!login$|api/auth|api/logout|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
