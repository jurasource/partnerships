import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth/session";
import { SESSION_OPTIONS } from "@/lib/auth/constants";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

  if (!session.isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login (the auth page itself)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt, /sitemap.xml
     * - Static files in /public (images, fonts, etc.)
     */
    "/((?!login|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
