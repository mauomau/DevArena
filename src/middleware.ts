import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STAND_COOKIE_NAME = "stand_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 14;

/** Comparaison à temps constant compatible Edge Runtime (sans `node:crypto`). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isProtectedPath(pathname: string, method: string): boolean {
  if (pathname.startsWith("/play")) return true;
  if (pathname.startsWith("/api/scores")) {
    // Le projecteur (/leaderboard) reste en accès libre via GET /api/scores.
    return method !== "GET";
  }
  return pathname.startsWith("/api");
}

function unauthorizedResponse(pathname: string): NextResponse {
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Accès réservé aux PC du stand Club Dev ESGIS." },
      { status: 403 },
    );
  }

  return new NextResponse("Accès réservé aux PC du stand Club Dev ESGIS.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (!isProtectedPath(pathname, request.method)) {
    return NextResponse.next();
  }

  const secret = process.env.STAND_SECRET_KEY?.trim();

  if (!secret) {
    // En production, ne jamais laisser /play ou les écritures /api ouverts sans clé.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "STAND_SECRET_KEY manquante : accès au stand verrouillé.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  const standKey = searchParams.get("key");
  const cookieKey = request.cookies.get(STAND_COOKIE_NAME)?.value;
  const headerKey = request.headers.get("x-stand-key");

  if (standKey && safeEqual(standKey, secret)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("key");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(STAND_COOKIE_NAME, secret, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  }

  if (
    (cookieKey && safeEqual(cookieKey, secret)) ||
    (headerKey && safeEqual(headerKey, secret))
  ) {
    return NextResponse.next();
  }

  return unauthorizedResponse(pathname);
}

export const config = {
  matcher: ["/play/:path*", "/api/:path*"],
};
