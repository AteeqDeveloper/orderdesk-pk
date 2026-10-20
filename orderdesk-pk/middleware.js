import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
const TOKEN_COOKIE = "orderdesk_token";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  let isAuthenticated = Boolean(token);
  let shouldClearToken = false;
  if (isAuthenticated && (isProtectedRoute || ["/login", "/register", "/forgot-password"].includes(pathname))) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      isAuthenticated = response.ok;
      shouldClearToken = response.status === 401;
    } catch {
      isAuthenticated = false;
    }
  }

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (shouldClearToken) response.cookies.delete(TOKEN_COOKIE);
    return response;
  }

  // Signed-in users don't need to see the auth pages again.
  const isAuthRoute = ["/login", "/register", "/forgot-password"].includes(
    pathname
  );
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  if (shouldClearToken) response.cookies.delete(TOKEN_COOKIE);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimization files.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
