import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/apiUrl";

const PROTECTED_PREFIXES = ["/dashboard"];
const SUPER_ADMIN_PREFIX = "/super-admin";
const TOKEN_COOKIE = "orderdesk_token";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const isSuperAdminLogin = pathname === `${SUPER_ADMIN_PREFIX}/login`;
  const isSuperAdminRoute =
    pathname === SUPER_ADMIN_PREFIX ||
    pathname.startsWith(`${SUPER_ADMIN_PREFIX}/`);
  const isProtectedRoute =
    (!isSuperAdminLogin && isSuperAdminRoute) ||
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  let isAuthenticated = Boolean(token);
  let userRole = "";
  let shouldClearToken = false;
  const authRoutes = ["/login", "/register", "/forgot-password"];
  if (
    isAuthenticated &&
    (isProtectedRoute || authRoutes.includes(pathname) || isSuperAdminLogin)
  ) {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      isAuthenticated = response.ok;
      shouldClearToken = response.status === 401 || response.status === 403;
      if (response.ok) {
        const data = await response.json();
        userRole = data.user?.role || "";
      }
    } catch {
      isAuthenticated = false;
    }
  }

  if (isSuperAdminRoute && !isSuperAdminLogin) {
    if (!isAuthenticated) {
      const loginUrl = new URL(`${SUPER_ADMIN_PREFIX}/login`, request.url);
      const response = NextResponse.redirect(loginUrl);
      if (shouldClearToken) response.cookies.delete(TOKEN_COOKIE);
      return response;
    }
    if (userRole !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL(
      isSuperAdminRoute ? `${SUPER_ADMIN_PREFIX}/login` : "/login",
      request.url
    );
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
    if (userRole === "super_admin") {
      return NextResponse.redirect(new URL(SUPER_ADMIN_PREFIX, request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isSuperAdminLogin && isAuthenticated && userRole === "super_admin") {
    return NextResponse.redirect(new URL(SUPER_ADMIN_PREFIX, request.url));
  }
  if (
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    isAuthenticated &&
    userRole === "super_admin"
  ) {
    return NextResponse.redirect(new URL(SUPER_ADMIN_PREFIX, request.url));
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
