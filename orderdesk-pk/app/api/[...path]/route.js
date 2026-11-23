import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const TOKEN_COOKIE = "orderdesk_token";
const TOKEN_MAX_AGE = 60 * 60 * 24;
const MAX_BACKUP_UPLOAD_BYTES = 10 * 1024 * 1024 + 64 * 1024;
const MAX_PRODUCT_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024 + 64 * 1024;

async function readLimitedBody(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

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

  try {
    let body;
    if (!["GET", "HEAD"].includes(request.method)) {
      const isBackupUpload =
        request.method === "POST" &&
        /^data-management\/backup\/(validate|restore)$/.test(endpoint);
      const isProductImageUpload =
        request.method === "POST" && endpoint === "uploads/product-image";
      const maxUploadBytes = isBackupUpload
        ? MAX_BACKUP_UPLOAD_BYTES
        : isProductImageUpload
          ? MAX_PRODUCT_IMAGE_UPLOAD_BYTES
          : null;

      if (maxUploadBytes !== null) {
        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
          return NextResponse.json(
            {
              success: false,
              message: isBackupUpload
                ? "Backup files must be 10 MB or smaller."
                : "Image must be 5 MB or smaller.",
            },
            { status: 413 }
          );
        }
        body = await readLimitedBody(request, maxUploadBytes);
        if (body === null) {
          return NextResponse.json(
            {
              success: false,
              message: isBackupUpload
                ? "Backup files must be 10 MB or smaller."
                : "Image must be 5 MB or smaller.",
            },
            { status: 413 }
          );
        }
      } else {
        body = await request.arrayBuffer();
      }
    }
    const upstream = await fetch(`${apiUrl}/api/${endpoint}${query}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const isLogin =
      ["auth/login", "auth/super-admin/login"].includes(endpoint) &&
      request.method === "POST";
    const payload = isLogin ? await upstream.text() : null;
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
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) {
      responseHeaders.set("content-disposition", contentDisposition);
    }

    let response = new NextResponse(isLogin ? payload : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

    if (isLogin && upstream.ok) {
      const data = JSON.parse(payload);
      if (data.token) {
        const tokenValue = data.token;
        response.cookies.set(TOKEN_COOKIE, data.token, cookieOptions);
        delete data.token;
        response = NextResponse.json(data, { status: upstream.status });
        response.cookies.set(TOKEN_COOKIE, tokenValue, cookieOptions);
      }
    }

    if (endpoint === "auth/super-admin/logout" && upstream.ok) {
      response.cookies.set(TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
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