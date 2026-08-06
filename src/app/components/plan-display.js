/**
 * Morocco landing plan display helpers (CONNECT_SAAS_APP.md).
 * Prefer Manager `localPrice*` (MAD / DH); card `priceCents` is gateway-only.
 */

/**
 * @typedef {{ text: string, included: boolean }} PlanFeatureBullet
 * @typedef {{
 *   id: string,
 *   name: string,
 *   slug?: string,
 *   tier?: string,
 *   priceLabel: string,
 *   currencyLabel?: string,
 *   periodLabel?: string,
 *   features: PlanFeatureBullet[],
 *   popular?: boolean,
 * }} CheckoutPlan
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   slug?: string,
 *   title?: string,
 *   interval?: string,
 *   priceCents?: number,
 *   priceNum?: number,
 *   currency?: string,
 *   localPriceCents?: number,
 *   localPriceNum?: number,
 *   localCurrency?: string,
 *   features?: unknown,
 *   limits?: Record<string, number>,
 *   tier?: string | null,
 * }} ManagerPublicPlan
 */

/** Format an integer currency amount with French grouping spaces. */
export function formatAmountLabel(amount) {
  const whole = Math.round(Number(amount) || 0);
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Morocco landing display: prefer Manager local MAD price.
 * Legacy fallback: card price only when it was already stored as MAD.
 * @param {ManagerPublicPlan} plan
 * @returns {{ amount: number, currencyLabel: string } | null}
 */
export function resolveDisplayPrice(plan) {
  const localCents = Number(plan.localPriceCents ?? 0);
  if (Number.isFinite(localCents) && localCents > 0) {
    return { amount: localCents / 100, currencyLabel: "Dh" };
  }

  const localNum = Number(plan.localPriceNum ?? 0);
  if (Number.isFinite(localNum) && localNum > 0) {
    return { amount: localNum, currencyLabel: "Dh" };
  }

  const cardCurrency = (plan.currency || "").trim().toUpperCase();
  const cardCents = Number(plan.priceCents ?? 0);
  if (cardCurrency === "MAD" && Number.isFinite(cardCents) && cardCents > 0) {
    return { amount: cardCents / 100, currencyLabel: "Dh" };
  }

  const cardNum = Number(plan.priceNum ?? 0);
  if (cardCurrency === "MAD" && Number.isFinite(cardNum) && cardNum > 0) {
    return { amount: cardNum, currencyLabel: "Dh" };
  }

  return null;
}

/** French period label from Manager plan interval. */
export function resolvePeriodLabel(interval) {
  switch ((interval || "MONTH").toUpperCase()) {
    case "YEAR":
      return "an";
    case "ONE_TIME":
      return "une fois";
    case "MONTH":
    default:
      return "mois";
  }
}

/**
 * @param {unknown} features
 * @returns {PlanFeatureBullet[]}
 */
export function featureItems(features) {
  if (Array.isArray(features)) {
    const out = [];
    for (const f of features) {
      if (typeof f === "string" && f.trim()) {
        out.push({ text: f.trim(), included: true });
        continue;
      }
      if (f && typeof f === "object" && typeof f.text === "string") {
        const text = f.text.trim();
        if (!text) continue;
        out.push({
          text,
          included: f.included !== false,
        });
      }
    }
    return out;
  }
  if (features && typeof features === "object") {
    const obj = features;
    const merged = [
      ...featureItems(obj.marketingFeatures),
      ...featureItems(obj.features),
    ];
    const seen = new Set();
    return merged.filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return [];
}

/**
 * Prefer human marketing bullets; otherwise derive short lines from limits.
 * @param {ManagerPublicPlan} plan
 * @param {PlanFeatureBullet[]} [fallback]
 */
export function resolvePlanFeatures(plan, fallback = []) {
  const fromFeatures = featureItems(plan.features);
  if (fromFeatures.length) return fromFeatures;

  const limits = plan.limits && typeof plan.limits === "object" ? plan.limits : null;
  if (limits) {
    const fromLimits = [];
    const users = limits.users_limit;
    const storage = limits.storage_limit_mb;
    const clients = limits.clients_limit;
    const suppliers = limits.suppliers_limit;
    if (typeof users === "number") {
      fromLimits.push({
        text: users < 0 ? "Utilisateurs max : ∞" : `Utilisateurs max : ${users}`,
        included: true,
      });
    }
    if (typeof storage === "number") {
      const go =
        storage >= 1024
          ? `${Math.round((storage / 1024) * 10) / 10} Go`
          : `${storage} Mo`;
      fromLimits.push({ text: `Stockage max : ${go}`, included: true });
    }
    if (typeof clients === "number") {
      fromLimits.push({
        text: clients < 0 ? "Clients max : ∞" : `Clients max : ${clients}`,
        included: true,
      });
    }
    if (typeof suppliers === "number") {
      fromLimits.push({
        text:
          suppliers < 0
            ? "Fournisseurs max : ∞"
            : `Fournisseurs max : ${suppliers}`,
        included: true,
      });
    }
    if (fromLimits.length) return fromLimits;
  }

  return fallback;
}

export function normalizePlanKey(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * @param {ManagerPublicPlan} remote
 * @param {{ fallback?: CheckoutPlan, popular?: boolean }} [options]
 * @returns {CheckoutPlan}
 */
export function toCheckoutPlan(remote, options = {}) {
  const { fallback, popular } = options;
  const display = resolveDisplayPrice(remote);
  const priceLabel = display
    ? formatAmountLabel(display.amount)
    : fallback?.priceLabel || "—";
  const currencyLabel = display?.currencyLabel || fallback?.currencyLabel || "Dh";
  const periodLabel = resolvePeriodLabel(remote.interval);
  const features = resolvePlanFeatures(remote, fallback?.features || []);

  return {
    id: remote.id,
    name: remote.title || remote.name || fallback?.name || "Offre",
    slug: remote.slug || fallback?.slug,
    tier: remote.tier || fallback?.tier,
    priceLabel,
    currencyLabel,
    periodLabel,
    popular: popular ?? fallback?.popular,
    features: features.length ? features : fallback?.features || [],
  };
}

/** Prefer monthly catalog rows when Manager also has yearly twins. */
export function preferredRemotePlans(remote) {
  const monthly = remote.filter(
    (p) => (p.interval || "MONTH").toUpperCase() === "MONTH",
  );
  return monthly.length ? monthly : remote;
}
