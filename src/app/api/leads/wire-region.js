/** ISO 3166-1 alpha-2 code for Morocco — wire transfer is MA-only. */
export const WIRE_ALLOWED_COUNTRY = "MA";

const UNKNOWN_COUNTRY_CODES = new Set(["XX", "T1", "A1", "A2"]);

/**
 * Resolve request country from CDN / platform geo headers, or WIRE_FORCE_COUNTRY.
 * @param {Headers | { get: (name: string) => string | null }} headers
 * @returns {string | null} Uppercase ISO country code, or null when unknown.
 */
export function getRequestCountry(headers) {
  const forced = process.env.WIRE_FORCE_COUNTRY?.trim();
  if (forced) {
    return forced.toUpperCase();
  }

  const raw =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    headers.get("x-geo-country") ||
    "";
  const country = raw.trim().toUpperCase();
  if (!country || UNKNOWN_COUNTRY_CODES.has(country)) {
    return null;
  }
  return country;
}

/**
 * Wire transfer is available only for Morocco (MA).
 * @param {Headers | { get: (name: string) => string | null }} headers
 */
export function isWireAllowedForRequest(headers) {
  return getRequestCountry(headers) === WIRE_ALLOWED_COUNTRY;
}

/**
 * Stable 403 body when wire/banks are blocked outside Morocco.
 * @param {Headers | { get: (name: string) => string | null }} [headers]
 */
export function wireRegionForbiddenBody(headers) {
  const country = headers ? getRequestCountry(headers) : null;
  return {
    message: "Le virement bancaire n’est disponible qu’au Maroc.",
    code: "WIRE_NOT_AVAILABLE_IN_REGION",
    ...(process.env.NODE_ENV === "development"
      ? {
          detail: country
            ? `Detected country "${country}"; wire requires "${WIRE_ALLOWED_COUNTRY}". Set WIRE_FORCE_COUNTRY=MA for local testing.`
            : `No geo country header detected. Set WIRE_FORCE_COUNTRY=MA for local testing.`,
        }
      : {}),
  };
}
