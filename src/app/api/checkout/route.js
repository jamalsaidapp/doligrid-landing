import { NextResponse } from "next/server";
import {
  getAllowedLandingOrigins,
  getCoreCheckoutIntentsUrl,
  getLeadForwardHeaders,
  isAllowedLandingOrigin,
} from "../leads/origin-policy.js";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUEST_BODY_BYTES = 16_384;

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
    if (done) break;
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

/** Browser checkout → same-origin BFF → Manager CheckoutIntent (API key server-side). */
export async function POST(request) {
  let allowedOrigins;
  let checkoutUrl;
  const apiKey = process.env.PLATFORM_API_KEY?.trim();

  try {
    allowedOrigins = getAllowedLandingOrigins();
    checkoutUrl = getCoreCheckoutIntentsUrl(process.env.CORE_API_URL);
    if (!apiKey) {
      throw new Error("Platform API key is not configured");
    }
  } catch {
    return NextResponse.json(
      { message: "Le paiement est temporairement indisponible." },
      { status: 503 },
    );
  }

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

  const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const company =
    typeof body?.company === "string" ? body.company.trim() : undefined;
  const contactName =
    typeof body?.contactName === "string"
      ? body.contactName.trim()
      : typeof body?.name === "string"
        ? body.name.trim()
        : undefined;

  if (!planId || !email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { message: "Un plan et une adresse email valide sont requis." },
      { status: 400 },
    );
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(checkoutUrl, {
      method: "POST",
      headers: getLeadForwardHeaders(apiKey),
      body: JSON.stringify({
        planId,
        email,
        ...(company ? { company } : {}),
        ...(contactName ? { contactName } : {}),
        source: "LANDING",
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Le service de paiement est momentanément inaccessible." },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        message:
          (data && typeof data.message === "string" && data.message) ||
          "Le paiement n’a pas pu démarrer. Veuillez réessayer.",
      },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(data && typeof data === "object" ? data : {});
}
