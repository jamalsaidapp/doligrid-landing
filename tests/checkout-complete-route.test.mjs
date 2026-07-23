import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { POST } from "../src/app/api/checkout/complete/route.js";

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

function configure(overrides = {}) {
  Object.assign(process.env, {
    LANDING_PUBLIC_URL: "https://doligrid.com",
    ALLOWED_LANDING_ORIGINS: "",
    CORE_API_URL: "https://manager.frametoy.online/api/v1",
    PLATFORM_API_KEY: "test-platform-secret",
    ...overrides,
  });
}

function request(body, origin = "https://doligrid.com") {
  return new Request("https://doligrid.com/api/checkout/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

test("forwards reconcile to Manager with intent id and providerRef", async () => {
  configure();
  let calledUrl = "";
  let calledBody = null;
  global.fetch = async (url, init) => {
    calledUrl = String(url);
    calledBody = JSON.parse(String(init?.body || "{}"));
    return new Response(
      JSON.stringify({
        intentStatus: "COMPLETED",
        tenantId: "tenant-1",
        subscriptionId: "sub-1",
        provisioned: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const response = await POST(
    request({
      intentId: "intent-1",
      providerRef: "txn_01abc",
    }),
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    calledUrl,
    "https://manager.frametoy.online/api/v1/billing/checkout-intents/intent-1/reconcile",
  );
  assert.deepEqual(calledBody, { providerRef: "txn_01abc" });
  assert.equal(data.provisioned, true);
  assert.equal(data.tenantId, "tenant-1");
});

test("rejects foreign origins and invalid txn refs", async () => {
  configure();
  const foreign = await POST(
    request(
      { intentId: "intent-1", providerRef: "txn_01abc" },
      "https://evil.example",
    ),
  );
  assert.equal(foreign.status, 403);

  const invalid = await POST(
    request({ intentId: "intent-1", providerRef: "not-a-txn" }),
  );
  assert.equal(invalid.status, 400);
});
