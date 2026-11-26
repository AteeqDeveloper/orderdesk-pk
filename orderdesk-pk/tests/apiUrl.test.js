import test from "node:test";
import assert from "node:assert/strict";
import { getApiUrl } from "../lib/apiUrl.js";

test("getApiUrl returns localhost:5000 in development when NEXT_PUBLIC_API_URL is unset", () => {
  const url = getApiUrl({ NODE_ENV: "development" });
  assert.equal(url, "http://localhost:5000");
});

test("getApiUrl normalizes exact HTTPS origin", () => {
  const url = getApiUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://backend.up.railway.app",
  });
  assert.equal(url, "https://backend.up.railway.app");
});

test("getApiUrl strips trailing slash from backend URL", () => {
  const url = getApiUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://backend.up.railway.app/",
  });
  assert.equal(url, "https://backend.up.railway.app");
});

test("getApiUrl strips /api or /api/ subpath from backend URL", () => {
  const urlWithApi = getApiUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://backend.up.railway.app/api",
  });
  assert.equal(urlWithApi, "https://backend.up.railway.app");

  const urlWithApiSlash = getApiUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://backend.up.railway.app/api/",
  });
  assert.equal(urlWithApiSlash, "https://backend.up.railway.app");
});

test("getApiUrl auto-prepends https:// if protocol was omitted", () => {
  const url = getApiUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "backend.up.railway.app",
  });
  assert.equal(url, "https://backend.up.railway.app");
});

test("getApiUrl throws in production if variable is missing or placeholder", () => {
  assert.throws(
    () => getApiUrl({ NODE_ENV: "production", NEXT_PUBLIC_API_URL: "" }),
    /NEXT_PUBLIC_API_URL/
  );
  assert.throws(
    () =>
      getApiUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://<backend-domain>",
      }),
    /NEXT_PUBLIC_API_URL/
  );
});

test("getApiUrl rejects credentials in URL", () => {
  assert.throws(
    () =>
      getApiUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://user:pass@backend.up.railway.app",
      }),
    /credentials/
  );
});

test("getApiUrl rejects insecure http in production for external hosts", () => {
  assert.throws(
    () =>
      getApiUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "http://backend.up.railway.app",
      }),
    /HTTPS/
  );
});
