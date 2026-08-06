import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getRequestCountry,
  isWireAllowedForRequest,
  WIRE_ALLOWED_COUNTRY,
} from "../src/app/api/leads/wire-region.js";

const ENV_KEYS = ["WIRE_FORCE_COUNTRY", "NODE_ENV"];
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("reads CDN geo headers and treats unknown codes as null", () => {
  delete process.env.WIRE_FORCE_COUNTRY;

  assert.equal(
    getRequestCountry(new Headers({ "x-vercel-ip-country": "ma" })),
    "MA",
  );
  assert.equal(
    getRequestCountry(new Headers({ "cf-ipcountry": "FR" })),
    "FR",
  );
  assert.equal(
    getRequestCountry(new Headers({ "x-country-code": "XX" })),
    null,
  );
  assert.equal(getRequestCountry(new Headers()), null);
});

test("WIRE_FORCE_COUNTRY overrides request headers", () => {
  process.env.WIRE_FORCE_COUNTRY = "ma";
  assert.equal(
    getRequestCountry(new Headers({ "cf-ipcountry": "FR" })),
    "MA",
  );
  assert.equal(isWireAllowedForRequest(new Headers()), true);
});

test("wire is allowed only for Morocco", () => {
  delete process.env.WIRE_FORCE_COUNTRY;
  assert.equal(WIRE_ALLOWED_COUNTRY, "MA");
  assert.equal(
    isWireAllowedForRequest(new Headers({ "x-vercel-ip-country": "MA" })),
    true,
  );
  assert.equal(
    isWireAllowedForRequest(new Headers({ "x-vercel-ip-country": "FR" })),
    false,
  );
  assert.equal(isWireAllowedForRequest(new Headers()), false);
});
