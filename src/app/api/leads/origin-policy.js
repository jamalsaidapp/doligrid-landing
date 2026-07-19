const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeOrigin(value) {
  const url = new URL(value.trim());
  if (
    !HTTP_PROTOCOLS.has(url.protocol) ||
    url.username ||
    url.password ||
    url.origin === "null"
  ) {
    throw new Error("Origin must be an HTTP(S) URL without credentials");
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
    throw new Error("Landing origin allowlist is not configured correctly");
  }

  try {
    return new Set(values.map(normalizeOrigin));
  } catch {
    throw new Error("Landing origin allowlist is not configured correctly");
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

function resolveCoreApiOrigin(value) {
  if (!value?.trim()) {
    throw new Error("Core API URL is not configured");
  }

  const url = new URL(value.trim());
  if (
    !HTTP_PROTOCOLS.has(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Core API URL is invalid");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (
    pathname !== "" &&
    pathname !== "/api/v1" &&
    !pathname.startsWith("/api/v1/")
  ) {
    throw new Error("Core API URL must be an origin or end in /api/v1");
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
