import { NextResponse } from "next/server.js";
import {
  getAllowedLandingOrigins,
  getCoreLeadsUrl,
  getLeadForwardHeaders,
  isAllowedLandingOrigin,
} from "./origin-policy.js";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUEST_BODY_BYTES = 16_384;
const FIELD_LIMITS = {
  name: 200,
  email: 320,
  company: 200,
  message: 5_000,
};

function readString(body, field, required = false) {
  const value = body[field];
  if (value == null || value === "") {
    return required ? null : undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (
    (required && normalized.length === 0) ||
    normalized.length > FIELD_LIMITS[field]
  ) {
    return null;
  }

  return normalized || undefined;
}

class RequestBodyTooLargeError extends Error {}

async function readJsonBody(request) {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_REQUEST_BODY_BYTES)
  ) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) {
    throw new SyntaxError("Missing request body");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    byteLength += value.byteLength;
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text);
}

function safeUpstreamMessage() {
  return "La demande n’a pas pu être envoyée. Veuillez réessayer.";
}

/** Browser demo lead → same-origin BFF → authenticated Manager Core. */
export async function POST(request) {
  let allowedOrigins;
  let leadsUrl;
  const apiKey = process.env.PLATFORM_API_KEY?.trim();

  try {
    allowedOrigins = getAllowedLandingOrigins();
    leadsUrl = getCoreLeadsUrl(process.env.CORE_API_URL);
    if (!apiKey) {
      throw new Error("Platform API key is not configured");
    }
  } catch {
    return NextResponse.json(
      { message: "Les demandes de démo sont temporairement indisponibles." },
      { status: 503 },
    );
  }

  // Authorization is based only on the exact Origin header. Host, forwarded
  // host, and Referer headers are intentionally not trusted.
  if (!isAllowedLandingOrigin(request.headers.get("origin"), allowedOrigins)) {
    return NextResponse.json(
      { message: "Origine de la demande non autorisée." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { message: "Le corps de la demande est trop volumineux." },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { message: "Le corps de la demande doit être un JSON valide." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Les données de la demande sont invalides." },
      { status: 400 },
    );
  }

  const name = readString(body, "name", true);
  const email = readString(body, "email", true);
  const company = readString(body, "company");
  const message = readString(body, "message");

  if (
    !name ||
    !email ||
    !EMAIL_PATTERN.test(email) ||
    company === null ||
    message === null
  ) {
    return NextResponse.json(
      { message: "Un nom et une adresse email valide sont requis." },
      { status: 400 },
    );
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(leadsUrl, {
      method: "POST",
      headers: getLeadForwardHeaders(apiKey),
      body: JSON.stringify({
        productSlug: process.env.PRODUCT_SLUG?.trim() || "doligrid",
        source: "landing",
        name,
        email,
        ...(company ? { company } : {}),
        ...(message ? { message } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Le service de demandes est momentanément inaccessible." },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON upstream bodies are never returned to the browser.
  }

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { message: safeUpstreamMessage() },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(
    data && typeof data === "object"
      ? data
      : { message: "Votre demande a bien été envoyée." },
    { status: upstreamResponse.status || 201 },
  );
}
