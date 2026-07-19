import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { POST } from "../src/app/api/wire/route.js";

const ENV_KEYS = [
  "LANDING_PUBLIC_URL",
  "ALLOWED_LANDING_ORIGINS",
  "CORE_API_URL",
  "PLATFORM_API_KEY",
];
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
const originalFetch = global.fetch;

function configure() {
  Object.assign(process.env, {
    LANDING_PUBLIC_URL: "https://doligrid.com",
    ALLOWED_LANDING_ORIGINS: "",
    CORE_API_URL: "https://manager.example.com/api/v1",
    PLATFORM_API_KEY: "server-secret",
  });
}

function wireRequest({
  origin = "https://doligrid.com",
  type = "application/pdf",
  size = 8,
  tenantId,
} = {}) {
  const form = new FormData();
  form.set("planId", "plan-1");
  form.set("email", "buyer@example.com");
  form.set("name", "Buyer");
  form.set("company", "Acme");
  form.set("proof", new Blob([new Uint8Array(size)], { type }), "proof.pdf");
  if (tenantId !== undefined) form.set("tenantId", tenantId);
  return new Request("https://doligrid.com/api/wire", {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

test("rejects missing or foreign origins before forwarding", async () => {
  configure();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response();
  };

  const foreign = await POST(wireRequest({ origin: "https://evil.example" }));
  const noOriginRequest = wireRequest();
  noOriginRequest.headers.delete("origin");
  const missing = await POST(noOriginRequest);

  assert.equal(foreign.status, 403);
  assert.equal(missing.status, 403);
  assert.equal(calls, 0);
});

test("rejects tenantId and invalid proof types without forwarding", async () => {
  configure();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response();
  };

  const tenant = await POST(wireRequest({ tenantId: "attacker-tenant" }));
  const executable = await POST(
    wireRequest({ type: "application/x-msdownload" }),
  );

  assert.equal(tenant.status, 400);
  assert.equal(executable.status, 415);
  assert.equal(calls, 0);
});

test("creates a wire intent then submits proof without any tenantId", async () => {
  configure();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/checkout-intents/wire")) {
      return new Response(
        JSON.stringify({
          id: "intent-1",
          provider: "WIRE",
          status: "PENDING",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ id: "wire-1", status: "PENDING" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  };

  const response = await POST(wireRequest());
  const data = await response.json();
  const intentBody = JSON.parse(calls[0].options.body);
  const proofForm = calls[1].options.body;

  assert.equal(response.status, 201);
  assert.equal(data.checkoutIntentId, "intent-1");
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://manager.example.com/api/v1/billing/checkout-intents/wire",
      "https://manager.example.com/api/v1/billing/wire-payments",
    ],
  );
  assert.equal(calls[0].options.headers["X-API-Key"], "server-secret");
  assert.equal(calls[1].options.headers["X-API-Key"], "server-secret");
  assert.equal(intentBody.planId, "plan-1");
  assert.equal(intentBody.source, "LANDING");
  assert.equal("tenantId" in intentBody, false);
  assert.equal(proofForm.get("checkoutIntentId"), "intent-1");
  assert.equal(proofForm.get("planId"), "plan-1");
  assert.equal(proofForm.has("tenantId"), false);
});

test("rejects proofs over the Manager 8 MiB limit", async () => {
  configure();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response();
  };

  const response = await POST(wireRequest({ size: 8 * 1024 * 1024 + 1 }));

  assert.equal(response.status, 413);
  assert.equal(calls, 0);
});

test("never reflects upstream internals or API keys", async () => {
  configure();
  global.fetch = async () =>
    new Response(
      JSON.stringify({ message: "database server-secret internal detail" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

  const response = await POST(wireRequest());
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.doesNotMatch(text, /server-secret|database|internal detail/);
});
