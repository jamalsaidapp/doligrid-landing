const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/** Typed configuration failures for landing → Manager BFF bootstrap. */
export class LandingConfigError extends Error {
  /**
   * @param {string} code Stable machine-readable code (safe for clients).
   * @param {string} message Safe human detail (never secrets).
   */
  constructor(code, message) {
    super(message);
    this.name = "LandingConfigError";
    this.code = code;
  }
}

export function normalizeOrigin(value) {
  const url = new URL(value.trim());
  if (
    !HTTP_PROTOCOLS.has(url.protocol) ||
    url.username ||
    url.password ||
    url.origin === "null"
  ) {
    throw new LandingConfigError(
      "INVALID_ORIGIN",
      "Origin must be an HTTP(S) URL without credentials",
    );
  }

  return url.origin;
}

export function getAllowedLandingOrigins(env = process.env) {
  const values = [
    env.LANDING_PUBLIC_URL,
    ...(env.ALLOWED_LANDING_ORIGINS?.split(",") ?? []),
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (
    values.length === 0 ||
    values.some((value) => value === "*" || value.includes("*"))
  ) {
    throw new LandingConfigError(
      "INVALID_ORIGIN_ALLOWLIST",
      "Set LANDING_PUBLIC_URL and/or ALLOWED_LANDING_ORIGINS to exact origins (no wildcards). Include http://localhost:3000 and http://127.0.0.1:3000 for local dev.",
    );
  }

  try {
    return new Set(values.map(normalizeOrigin));
  } catch (error) {
    if (error instanceof LandingConfigError) throw error;
    throw new LandingConfigError(
      "INVALID_ORIGIN_ALLOWLIST",
      "Landing origin allowlist is not configured correctly",
    );
  }
}

export function isAllowedLandingOrigin(originHeader, allowedOrigins) {
  if (!originHeader) {
    return false;
  }

  try {
    return allowedOrigins.has(normalizeOrigin(originHeader));
  } catch {
    return false;
  }
}

export function requirePlatformApiKey(env = process.env) {
  const apiKey = env.PLATFORM_API_KEY?.trim();
  if (!apiKey) {
    throw new LandingConfigError(
      "MISSING_PLATFORM_API_KEY",
      "PLATFORM_API_KEY is not set. Add it to .env (or .env.local) to match Manager Admin → Settings, then restart Next.js.",
    );
  }
  return apiKey;
}

function resolveCoreApiOrigin(value) {
  if (!value?.trim()) {
    throw new LandingConfigError(
      "MISSING_CORE_API_URL",
      "CORE_API_URL is not set. Example: https://manager.frametoy.online/api/v1",
    );
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new LandingConfigError(
      "INVALID_CORE_API_URL",
      "CORE_API_URL is not a valid URL",
    );
  }

  if (
    !HTTP_PROTOCOLS.has(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new LandingConfigError(
      "INVALID_CORE_API_URL",
      "CORE_API_URL must be an HTTP(S) origin or /api/v1 URL without credentials, query, or hash",
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (
    pathname !== "" &&
    pathname !== "/api/v1" &&
    !pathname.startsWith("/api/v1/")
  ) {
    throw new LandingConfigError(
      "INVALID_CORE_API_URL",
      "CORE_API_URL must be an origin or end in /api/v1",
    );
  }

  return url.origin;
}

export function getCoreLeadsUrl(value) {
  return new URL("/api/v1/leads", resolveCoreApiOrigin(value)).toString();
}

export function getCoreCheckoutIntentsUrl(value) {
  return new URL(
    "/api/v1/billing/checkout-intents",
    resolveCoreApiOrigin(value),
  ).toString();
}

export function getCoreCheckoutIntentReconcileUrl(value, intentId) {
  if (!intentId || typeof intentId !== "string") {
    throw new LandingConfigError(
      "INVALID_CHECKOUT_INTENT_ID",
      "Checkout intent id is required",
    );
  }
  const id = encodeURIComponent(intentId.trim());
  return new URL(
    `/api/v1/billing/checkout-intents/${id}/reconcile`,
    resolveCoreApiOrigin(value),
  ).toString();
}

export function getCoreWireCheckoutIntentsUrl(value) {
  return new URL(
    "/api/v1/billing/checkout-intents/wire",
    resolveCoreApiOrigin(value),
  ).toString();
}

export function getCoreBankAccountsUrl(value) {
  const url = new URL(
    "/api/v1/billing/bank-accounts",
    resolveCoreApiOrigin(value),
  );
  url.searchParams.set("activeOnly", "true");
  return url.toString();
}

export function getCoreWirePaymentsUrl(value) {
  return new URL(
    "/api/v1/billing/wire-payments",
    resolveCoreApiOrigin(value),
  ).toString();
}

export function getCoreLandingUrl(value, productSlug) {
  const slug = encodeURIComponent(productSlug || "doligrid");
  return new URL(
    `/api/v1/products/${slug}/landing`,
    resolveCoreApiOrigin(value),
  ).toString();
}

export function getLeadForwardHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
}

function isDevRuntime(env = process.env) {
  return env.NODE_ENV === "development";
}

/**
 * Safe JSON body for HTTP 503 config failures.
 * Never includes API keys or env values — only codes + short detail.
 * @param {string} userMessage French user-facing fallback
 * @param {unknown} error
 * @param {NodeJS.ProcessEnv} [env]
 */
export function serviceUnavailableBody(userMessage, error, env = process.env) {
  const code =
    error instanceof LandingConfigError
      ? error.code
      : error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "CONFIG_ERROR";
  const detail =
    error instanceof Error
      ? error.message
      : "Payment configuration is incomplete";

  console.error(`[landing-bff] ${code}: ${detail}`);

  /** @type {{ message: string, code: string, detail?: string }} */
  const body = { message: userMessage, code };
  if (isDevRuntime(env)) {
    body.detail = detail;
    // Prefer actionable detail as the primary message while developing.
    body.message = detail;
  }
  return body;
}

/**
 * Map upstream Manager auth failures to a clear, secret-safe message.
 * @param {number} status
 * @param {string} fallbackMessage
 * @param {NodeJS.ProcessEnv} [env]
 */
export function upstreamFailureBody(status, fallbackMessage, env = process.env) {
  if (status === 401 || status === 403) {
    const detail =
      "Manager rejected the platform API key. Confirm PLATFORM_API_KEY matches Admin → Settings, then restart Next.js.";
    console.error(`[landing-bff] UPSTREAM_UNAUTHORIZED: HTTP ${status}`);
    return {
      message: isDevRuntime(env)
        ? detail
        : "Authentification plateforme refusée. Vérifiez la clé API côté serveur.",
      code: "UPSTREAM_UNAUTHORIZED",
      ...(isDevRuntime(env) ? { detail } : {}),
    };
  }
  return { message: fallbackMessage };
}

/**
 * Reject bind-all / non-browser hosts that break client redirects.
 * @param {string} origin
 */
export function isBrowserSafePortalOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "0.0.0.0" || host === "::" || host === "[::]") {
      return false;
    }
    return HTTP_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
