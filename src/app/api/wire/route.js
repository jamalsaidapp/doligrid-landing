import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";
import {
  getAllowedLandingOrigins,
  getCoreWireCheckoutIntentsUrl,
  getCoreWirePaymentsUrl,
  getLeadForwardHeaders,
  isAllowedLandingOrigin,
} from "../leads/origin-policy.js";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROOF_MAX_BYTES = 8 * 1024 * 1024;
const REQUEST_MAX_BYTES = PROOF_MAX_BYTES + 128 * 1024;
const ALLOWED_PROOF_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const FIELD_LIMITS = { planId: 200, email: 320, name: 200, company: 200 };

class RequestBodyTooLargeError extends Error {}

async function readLimitedBody(request) {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > REQUEST_MAX_BYTES)
  ) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("Missing request body");

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > REQUEST_MAX_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function stringField(form, field, required = false) {
  const value = form.get(field);
  if (value == null || value === "") return required ? null : undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    (required && !normalized) ||
    normalized.length > FIELD_LIMITS[field]
  ) {
    return null;
  }
  return normalized || undefined;
}

function safeError(message, status) {
  return NextResponse.json({ message }, { status });
}

/**
 * Client portal base (Manager FRONTEND_URL). Prefer explicit PORTAL_URL,
 * then fall back to the CORE_API_URL origin (strip /api/v1).
 */
function resolvePortalBaseUrl() {
  const explicit = (
    process.env.PORTAL_URL ||
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (explicit) return explicit;

  const core = (process.env.CORE_API_URL || "").trim();
  if (!core) return null;
  try {
    const url = new URL(core);
    return url.origin;
  } catch {
    return null;
  }
}

function buildWirePortalLoginUrl(email) {
  const base = resolvePortalBaseUrl();
  if (!base) return null;
  const login = new URL("/login", `${base}/`);
  login.searchParams.set("email", email);
  login.searchParams.set("wire", "pending");
  return login.toString();
}

/** Browser wire form → wire CheckoutIntent → linked proof submission. */
export async function POST(request) {
  const apiKey = process.env.PLATFORM_API_KEY?.trim();
  let allowedOrigins;
  let intentUrl;
  let paymentsUrl;
  try {
    allowedOrigins = getAllowedLandingOrigins();
    intentUrl = getCoreWireCheckoutIntentsUrl(process.env.CORE_API_URL);
    paymentsUrl = getCoreWirePaymentsUrl(process.env.CORE_API_URL);
    if (!apiKey) throw new Error("Platform API key is not configured");
  } catch {
    return safeError("Le virement bancaire est temporairement indisponible.", 503);
  }

  if (!isAllowedLandingOrigin(request.headers.get("origin"), allowedOrigins)) {
    return safeError("Origine de la demande non autorisée.", 403);
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return safeError("Le formulaire de virement est invalide.", 415);
  }

  let form;
  try {
    const body = await readLimitedBody(request);
    form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }).formData();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return safeError("Le formulaire ou le justificatif est trop volumineux.", 413);
    }
    return safeError("Le formulaire de virement est invalide.", 400);
  }

  if (form.has("tenantId")) {
    return safeError("Le formulaire contient un champ non autorisé.", 400);
  }

  const planId = stringField(form, "planId", true);
  const email = stringField(form, "email", true);
  const name = stringField(form, "name");
  const company = stringField(form, "company");
  const proof = form.get("proof");

  if (
    !planId ||
    !email ||
    !EMAIL_PATTERN.test(email) ||
    name === null ||
    company === null
  ) {
    return safeError("Un plan et une adresse email valide sont requis.", 400);
  }
  if (
    !proof ||
    typeof proof !== "object" ||
    typeof proof.arrayBuffer !== "function" ||
    typeof proof.size !== "number"
  ) {
    return safeError("Un justificatif de virement est requis.", 400);
  }
  if (proof.size === 0 || proof.size > PROOF_MAX_BYTES) {
    return safeError("Le justificatif doit faire au maximum 8 Mo.", 413);
  }
  if (!ALLOWED_PROOF_TYPES.has(proof.type)) {
    return safeError("Le justificatif doit être un fichier JPEG, PNG, WebP ou PDF.", 415);
  }

  let intentResponse;
  try {
    intentResponse = await fetch(intentUrl, {
      method: "POST",
      headers: getLeadForwardHeaders(apiKey),
      body: JSON.stringify({
        planId,
        email,
        ...(name ? { contactName: name } : {}),
        ...(company ? { company } : {}),
        source: "LANDING",
        idempotencyKey: `landing-wire-${randomUUID()}`,
      }),
      cache: "no-store",
    });
  } catch {
    return safeError("Le service de paiement est momentanément inaccessible.", 502);
  }

  let intent;
  try {
    intent = await intentResponse.json();
  } catch {
    intent = null;
  }
  if (!intentResponse.ok || !intent || typeof intent.id !== "string") {
    return safeError(
      "La demande de virement n’a pas pu être créée. Veuillez réessayer.",
      intentResponse.ok ? 502 : intentResponse.status,
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.set("checkoutIntentId", intent.id);
  upstreamForm.set("planId", planId);
  upstreamForm.set("proof", proof, proof.name || "justificatif");

  let proofResponse;
  try {
    proofResponse = await fetch(paymentsUrl, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: upstreamForm,
      cache: "no-store",
    });
  } catch {
    return safeError("Le justificatif n’a pas pu être envoyé. Veuillez réessayer.", 502);
  }

  let payment;
  try {
    payment = await proofResponse.json();
  } catch {
    payment = null;
  }
  if (!proofResponse.ok || !payment || typeof payment.id !== "string") {
    return safeError(
      "Le justificatif n’a pas pu être envoyé. Veuillez réessayer.",
      proofResponse.ok ? 502 : proofResponse.status,
    );
  }

  return NextResponse.json(
    {
      id: payment.id,
      checkoutIntentId: intent.id,
      status: "PENDING",
      message:
        "Votre justificatif a été reçu. Votre accès sera activé après validation administrative.",
      portalUrl: buildWirePortalLoginUrl(email),
    },
    { status: 201 },
  );
}
