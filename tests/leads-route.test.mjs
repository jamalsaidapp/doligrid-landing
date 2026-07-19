import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { POST } from "../src/app/api/leads/route.js";

const ENV_KEYS = [
  "LANDING_PUBLIC_URL",
  "ALLOWED_LANDING_ORIGINS",
  "CORE_API_URL",
  "PRODUCT_SLUG",
  "PLATFORM_API_KEY",
  "NODE_ENV",
];
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
const originalFetch = global.fetch;

function configure(overrides = {}) {
  Object.assign(process.env, {
    LANDING_PUBLIC_URL: "https://doligrid.com",
    ALLOWED_LANDING_ORIGINS: "",
    CORE_API_URL: "https://manager.frametoy.online/api/v1",
    PRODUCT_SLUG: "doligrid",
    PLATFORM_API_KEY: "test-platform-secret",
    NODE_ENV: "production",
    ...overrides,
  });
}

function request(body, origin = "https://doligrid.com") {
  const headers = { "Content-Type": "application/json" };
  if (origin !== null) {
    headers.Origin = origin;
  }

  return new Request("https://doligrid.com/api/leads", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function successfulUpstream() {
  global.fetch = async () =>
    new Response(JSON.stringify({ id: "lead-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  global.fetch = originalFetch;
});

test("accepts the configured exact origin after normalization", async () => {
  configure({ LANDING_PUBLIC_URL: "https://doligrid.com/request-demo" });
  successfulUpstream();

  const response = await POST(
    request({ name: "Jane Doe", email: "jane@example.com" }),
  );

  assert.equal(response.status, 201);
});

test("rejects a foreign origin", async () => {
  configure();

  const response = await POST(
    request(
      { name: "Jane Doe", email: "jane@example.com" },
      "https://evil.example",
    ),
  );

  assert.equal(response.status, 403);
});

test("rejects a missing Origin header", async () => {
  configure();

  const response = await POST(
    request({ name: "Jane Doe", email: "jane@example.com" }, null),
  );

  assert.equal(response.status, 403);
});

test("validates required name and email fields", async () => {
  configure();

  const missingName = await POST(request({ email: "jane@example.com" }));
  const invalidEmail = await POST(
    request({ name: "Jane Doe", email: "not-an-email" }),
  );

  assert.equal(missingName.status, 400);
  assert.equal(invalidEmail.status, 400);
});

test("rejects oversized request bodies before forwarding", async () => {
  configure();
  let forwarded = false;
  global.fetch = async () => {
    forwarded = true;
    return new Response(null, { status: 201 });
  };

  const response = await POST(
    request({
      name: "Jane Doe",
      email: "jane@example.com",
      message: "x".repeat(20_000),
    }),
  );

  assert.equal(response.status, 413);
  assert.equal(forwarded, false);
});

test("adds product and source and forwards the server API key", async () => {
  configure();
  let forwardedUrl;
  let forwardedOptions;
  global.fetch = async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;
    return new Response(JSON.stringify({ id: "lead-1" }), { status: 201 });
  };

  const response = await POST(
    request({
      name: " Jane Doe ",
      email: " jane@example.com ",
      company: "Acme",
      message: "A demo, please",
      productSlug: "attacker-value",
      source: "attacker-value",
    }),
  );
  const forwardedBody = JSON.parse(forwardedOptions.body);

  assert.equal(response.status, 201);
  assert.equal(
    forwardedUrl,
    "https://manager.frametoy.online/api/v1/leads",
  );
  assert.equal(forwardedOptions.headers["X-API-Key"], "test-platform-secret");
  assert.deepEqual(forwardedBody, {
    productSlug: "doligrid",
    source: "landing",
    name: "Jane Doe",
    email: "jane@example.com",
    company: "Acme",
    message: "A demo, please",
  });
});

test("normalizes Core origin and endpoint URLs without duplicating api/v1", async () => {
  for (const coreApiUrl of [
    "https://manager.frametoy.online",
    "https://manager.frametoy.online/",
    "https://manager.frametoy.online/api/v1/",
    "https://manager.frametoy.online/api/v1/leads",
  ]) {
    configure({ CORE_API_URL: coreApiUrl });
    let forwardedUrl;
    global.fetch = async (url) => {
      forwardedUrl = url;
      return new Response(JSON.stringify({ id: "lead-1" }), { status: 201 });
    };

    const response = await POST(
      request({ name: "Jane Doe", email: "jane@example.com" }),
    );

    assert.equal(response.status, 201);
    assert.equal(
      forwardedUrl,
      "https://manager.frametoy.online/api/v1/leads",
    );
  }
});

test("allows only explicitly configured additional origins", async () => {
  configure({
    ALLOWED_LANDING_ORIGINS:
      "https://preview.doligrid.com, http://localhost:3000",
  });
  successfulUpstream();

  const preview = await POST(
    request(
      { name: "Jane Doe", email: "jane@example.com" },
      "https://preview.doligrid.com",
    ),
  );
  const localhost = await POST(
    request(
      { name: "Jane Doe", email: "jane@example.com" },
      "http://localhost:3000",
    ),
  );

  assert.equal(preview.status, 201);
  assert.equal(localhost.status, 201);
});

test("configuration and upstream failures never expose the API key", async () => {
  configure({ CORE_API_URL: "" });
  const configurationResponse = await POST(
    request({ name: "Jane Doe", email: "jane@example.com" }),
  );
  assert.equal(configurationResponse.status, 503);
  assert.doesNotMatch(await configurationResponse.text(), /test-platform-secret/);

  configure();
  global.fetch = async () =>
    new Response("internal failure: test-platform-secret", { status: 502 });
  const upstreamResponse = await POST(
    request({ name: "Jane Doe", email: "jane@example.com" }),
  );
  assert.equal(upstreamResponse.status, 502);
  assert.doesNotMatch(await upstreamResponse.text(), /test-platform-secret/);
});

test("does not reflect JSON error details from Core", async () => {
  configure();
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        message: "database detail containing test-platform-secret",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

  const response = await POST(
    request({ name: "Jane Doe", email: "jane@example.com" }),
  );
  const responseText = await response.text();

  assert.equal(response.status, 500);
  assert.doesNotMatch(responseText, /database detail|test-platform-secret/);
});
