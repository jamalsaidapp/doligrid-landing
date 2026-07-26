import { NextResponse } from "next/server.js";
import {
  getAllowedLandingOrigins,
  getCoreCheckoutIntentReconcileUrl,
  getLeadForwardHeaders,
  isAllowedLandingOrigin,
  requirePlatformApiKey,
  serviceUnavailableBody,
  upstreamFailureBody,
} from "../../leads/origin-policy.js";

export const runtime = "nodejs";

const MAX_REQUEST_BODY_BYTES = 4_096;

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

/**
 * Browser checkout.completed → same-origin BFF → Manager reconcile.
 * Creates tenant + subscription + provision when webhooks are delayed/missing.
 */
export async function POST(request) {
  let allowedOrigins;
  let apiKey;

  try {
    allowedOrigins = getAllowedLandingOrigins();
    apiKey = requirePlatformApiKey();
  } catch (error) {
    return NextResponse.json(
      serviceUnavailableBody(
        "La finalisation du paiement est temporairement indisponible.",
        error,
      ),
      { status: 503 },
    );
  }

  if (!isAllowedLandingOrigin(request.headers.get("origin"), allowedOrigins)) {
    return NextResponse.json(
      {
        message: "Origine de la demande non autorisée.",
        code: "ORIGIN_NOT_ALLOWED",
        ...(process.env.NODE_ENV === "development"
          ? {
              detail: `Origin "${request.headers.get("origin") || "(missing)"}" is not in LANDING_PUBLIC_URL / ALLOWED_LANDING_ORIGINS.`,
            }
          : {}),
      },
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

  const intentId =
    typeof body?.intentId === "string" ? body.intentId.trim() : "";
  const providerRef =
    typeof body?.providerRef === "string"
      ? body.providerRef.trim()
      : typeof body?.transactionId === "string"
        ? body.transactionId.trim()
        : "";

  if (!intentId || !providerRef.startsWith("txn_")) {
    return NextResponse.json(
      {
        message:
          "Une référence d’intention et une transaction Paddle valide sont requises.",
      },
      { status: 400 },
    );
  }

  let reconcileUrl;
  try {
    reconcileUrl = getCoreCheckoutIntentReconcileUrl(
      process.env.CORE_API_URL,
      intentId,
    );
  } catch (error) {
    return NextResponse.json(
      serviceUnavailableBody(
        "La finalisation du paiement est temporairement indisponible.",
        error,
      ),
      { status: 503 },
    );
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(reconcileUrl, {
      method: "POST",
      headers: getLeadForwardHeaders(apiKey),
      body: JSON.stringify({ providerRef }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Le service de finalisation est momentanément inaccessible." },
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
    const fallback =
      (data && typeof data.message === "string" && data.message) ||
      "L’abonnement n’a pas pu être activé. Veuillez réessayer.";
    return NextResponse.json(
      upstreamFailureBody(upstreamResponse.status, fallback),
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json({
    intentStatus:
      data && typeof data.intentStatus === "string"
        ? data.intentStatus
        : undefined,
    tenantId:
      data && typeof data.tenantId === "string" ? data.tenantId : null,
    subscriptionId:
      data && typeof data.subscriptionId === "string"
        ? data.subscriptionId
        : null,
    provisioned: Boolean(data?.provisioned),
    portalUrl:
      data && typeof data.portalUrl === "string" ? data.portalUrl : null,
  });
}
