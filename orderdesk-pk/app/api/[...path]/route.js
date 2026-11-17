import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const TOKEN_COOKIE = "orderdesk_token";
const TOKEN_MAX_AGE = 60 * 60 * 24;

async function proxyRequest(request, context) {
  const { path = [] } = await context.params;
  const endpoint = path.join("/");
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  };

  if (endpoint === "auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ success: true });
    response.cookies.set(TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const query = new URL(request.url).search;
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  try {
    const upstream = await fetch(`${apiUrl}/api/${endpoint}${query}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const payload = await upstream.text();
    if (upstream.ok) {
      if (
        (request.method === "POST" && endpoint === "orders") ||
        (request.method === "PATCH" && /^orders\/[^/]+$/.test(endpoint))
      ) {
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/orders");
        revalidatePath("/dashboard/orders/[id]", "page");
        revalidatePath("/dashboard/customers");
        revalidatePath("/dashboard/customers/[id]", "page");
        revalidatePath("/dashboard/inventory");
      } else if (
        ((request.method === "POST" || request.method === "PATCH" || request.method === "DELETE") &&
          /^products(\/.*)?$/.test(endpoint)) ||
        (request.method === "PATCH" && /^inventory(\/.*)?$/.test(endpoint))
      ) {
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/products");
        revalidatePath("/dashboard/inventory");
      }
    }

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    let response = new NextResponse(payload, {
      status: upstream.status,
      headers: responseHeaders,
    });

    if (endpoint === "auth/login" && upstream.ok) {
      const data = JSON.parse(payload);
      if (data.token) {
        const tokenValue = data.token;
        response.cookies.set(TOKEN_COOKIE, data.token, cookieOptions);
        delete data.token;
        response = NextResponse.json(data, { status: upstream.status });
        response.cookies.set(TOKEN_COOKIE, tokenValue, cookieOptions);
      }
    }

    if (upstream.status === 401) {
      response.cookies.set(TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    }

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "The backend API is unavailable." },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;