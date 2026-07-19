import { NextResponse } from "next/server.js";
import {
  getCoreBankAccountsUrl,
  getLeadForwardHeaders,
} from "../leads/origin-policy.js";

export const runtime = "nodejs";

const SAFE_FIELDS = [
  "id",
  "label",
  "bankName",
  "accountHolder",
  "rib",
  "iban",
  "swift",
  "currency",
  "instructions",
];

function sanitizeBank(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const bank = {};
  for (const field of SAFE_FIELDS) {
    const raw = value[field];
    if (typeof raw === "string") {
      bank[field] = raw;
    } else if (raw === null && ["rib", "iban", "swift", "instructions"].includes(field)) {
      bank[field] = null;
    }
  }
  if (
    !bank.id ||
    !bank.label ||
    !bank.bankName ||
    !bank.accountHolder ||
    !bank.currency ||
    (!bank.rib && !bank.iban)
  ) {
    return null;
  }
  return bank;
}

/** Public bank details → same-origin BFF → authenticated Manager Core. */
export async function GET() {
  const apiKey = process.env.PLATFORM_API_KEY?.trim();
  let banksUrl;
  try {
    banksUrl = getCoreBankAccountsUrl(process.env.CORE_API_URL);
    if (!apiKey) throw new Error("Platform API key is not configured");
  } catch {
    return NextResponse.json(
      { message: "Les coordonnées bancaires sont temporairement indisponibles." },
      { status: 503 },
    );
  }

  let response;
  try {
    response = await fetch(banksUrl, {
      headers: getLeadForwardHeaders(apiKey),
      next: { revalidate: 60 },
    });
  } catch {
    return NextResponse.json(
      { message: "Les coordonnées bancaires sont momentanément indisponibles." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { message: "Les coordonnées bancaires n’ont pas pu être chargées." },
      { status: response.status },
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json(
      { message: "Les coordonnées bancaires n’ont pas pu être chargées." },
      { status: 502 },
    );
  }
  const banks = Array.isArray(data) ? data.map(sanitizeBank).filter(Boolean) : [];

  return NextResponse.json(
    { banks },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
