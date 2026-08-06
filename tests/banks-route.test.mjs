import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { GET } from "../src/app/api/banks/route.js";

const ENV_KEYS = ["CORE_API_URL", "PLATFORM_API_KEY", "WIRE_FORCE_COUNTRY"];
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
const originalFetch = global.fetch;

function configure() {
  process.env.CORE_API_URL = "https://manager.example.com/api/v1";
  process.env.PLATFORM_API_KEY = "server-secret";
  process.env.WIRE_FORCE_COUNTRY = "MA";
}

function banksRequest({ country } = {}) {
  const headers = {};
  if (country) headers["x-vercel-ip-country"] = country;
  return new Request("https://doligrid.com/api/banks", { headers });
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("forwards the API key and returns only sanitized active bank fields", async () => {
  configure();
  let forwardedUrl;
  let forwardedOptions;
  global.fetch = async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;
    return new Response(
      JSON.stringify([
        {
          id: "bank-1",
          label: "Compte MAD",
          bankName: "Banque",
          accountHolder: "DoliGrid",
          rib: "123",
          iban: null,
          swift: "ABC",
          currency: "MAD",
          instructions: "Référence: société",
          active: true,
          createdAt: "internal",
          secret: "do-not-return",
        },
        { id: "invalid", label: "Missing required fields" },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const response = await GET(banksRequest());
  const data = await response.json();

  assert.equal(
    forwardedUrl,
    "https://manager.example.com/api/v1/billing/bank-accounts?activeOnly=true",
  );
  assert.equal(forwardedOptions.headers["X-API-Key"], "server-secret");
  assert.equal(data.banks.length, 1);
  assert.deepEqual(data.banks[0], {
    id: "bank-1",
    label: "Compte MAD",
    bankName: "Banque",
    accountHolder: "DoliGrid",
    rib: "123",
    iban: null,
    swift: "ABC",
    currency: "MAD",
    instructions: "Référence: société",
  });
  assert.doesNotMatch(JSON.stringify(data), /secret|createdAt|server-secret/);
});

test("rejects bank listing outside Morocco", async () => {
  configure();
  delete process.env.WIRE_FORCE_COUNTRY;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response();
  };

  const response = await GET(banksRequest({ country: "US" }));
  const data = await response.json();

  assert.equal(response.status, 403);
  assert.equal(data.code, "WIRE_NOT_AVAILABLE_IN_REGION");
  assert.equal(calls, 0);
});

test("sanitizes upstream bank failures", async () => {
  configure();
  global.fetch = async () =>
    new Response("internal server-secret database detail", { status: 500 });

  const response = await GET(banksRequest());
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.doesNotMatch(text, /server-secret|database detail/);
});
