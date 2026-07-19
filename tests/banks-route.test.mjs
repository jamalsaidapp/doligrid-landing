import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { GET } from "../src/app/api/banks/route.js";

const originalFetch = global.fetch;
const originalCore = process.env.CORE_API_URL;
const originalKey = process.env.PLATFORM_API_KEY;

function configure() {
  process.env.CORE_API_URL = "https://manager.example.com/api/v1";
  process.env.PLATFORM_API_KEY = "server-secret";
}

afterEach(() => {
  global.fetch = originalFetch;
  if (originalCore === undefined) delete process.env.CORE_API_URL;
  else process.env.CORE_API_URL = originalCore;
  if (originalKey === undefined) delete process.env.PLATFORM_API_KEY;
  else process.env.PLATFORM_API_KEY = originalKey;
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

  const response = await GET();
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

test("sanitizes upstream bank failures", async () => {
  configure();
  global.fetch = async () =>
    new Response("internal server-secret database detail", { status: 500 });

  const response = await GET();
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.doesNotMatch(text, /server-secret|database detail/);
});
