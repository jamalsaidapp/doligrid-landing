import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAllowedLandingOrigins,
  isAllowedLandingOrigin,
  isBrowserSafePortalOrigin,
  requirePlatformApiKey,
  serviceUnavailableBody,
} from "../src/app/api/leads/origin-policy.js";

test("allowlist accepts localhost and 127.0.0.1 as distinct origins", () => {
  const allowed = getAllowedLandingOrigins({
    LANDING_PUBLIC_URL: "https://doligrid.com",
    ALLOWED_LANDING_ORIGINS:
      "http://localhost:3000,http://127.0.0.1:3000",
  });

  assert.equal(
    isAllowedLandingOrigin("http://localhost:3000", allowed),
    true,
  );
  assert.equal(
    isAllowedLandingOrigin("http://127.0.0.1:3000", allowed),
    true,
  );
  assert.equal(
    isAllowedLandingOrigin("https://evil.example", allowed),
    false,
  );
});

test("requirePlatformApiKey throws a typed config error", () => {
  assert.throws(
    () => requirePlatformApiKey({ PLATFORM_API_KEY: "  " }),
    (error) => error.code === "MISSING_PLATFORM_API_KEY",
  );
});

test("serviceUnavailableBody never echoes secrets and adds detail in development", () => {
  let thrown;
  try {
    requirePlatformApiKey({});
  } catch (e) {
    thrown = e;
  }

  const prod = serviceUnavailableBody("Unavailable.", thrown, {
    NODE_ENV: "production",
  });
  assert.equal(prod.message, "Unavailable.");
  assert.equal(prod.code, "MISSING_PLATFORM_API_KEY");
  assert.equal(prod.detail, undefined);
  assert.doesNotMatch(JSON.stringify(prod), /secret|aiDLF/);

  const dev = serviceUnavailableBody("Unavailable.", thrown, {
    NODE_ENV: "development",
  });
  assert.equal(dev.code, "MISSING_PLATFORM_API_KEY");
  assert.match(dev.message, /PLATFORM_API_KEY/);
  assert.match(dev.detail, /PLATFORM_API_KEY/);
  assert.doesNotMatch(JSON.stringify(dev), /aiDLF/);
});

test("isBrowserSafePortalOrigin rejects bind-all hosts", () => {
  assert.equal(isBrowserSafePortalOrigin("https://manager.example.com"), true);
  assert.equal(isBrowserSafePortalOrigin("http://0.0.0.0:3001"), false);
  assert.equal(isBrowserSafePortalOrigin("http://[::]:3001"), false);
});
