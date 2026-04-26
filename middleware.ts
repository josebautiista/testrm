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

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
