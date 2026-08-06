/**
 * Morocco landing plan display helpers (CONNECT_SAAS_APP.md).
 * Prefer Manager `localPrice*` (MAD / DH); card `priceCents` is gateway-only.
 * When Core is up, render Manager plans as-is (names, features, sortOrder).
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
 *   sortOrder?: number,
 *   features?: unknown,
 *   limits?: Record<string, number>,
 *   tier?: string | null,
 *   customProperties?: Record<string, unknown> | null,
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

function formatCountLabel(count, singular, plural) {
  if (count < 0) return `${plural} : ∞`;
  const noun = count === 1 ? singular : plural;
  return `${count} ${noun}`;
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
        text: formatCountLabel(users, "Utilisateur", "Utilisateurs"),
        included: true,
      });
    }
    if (typeof clients === "number") {
      fromLimits.push({
        text: formatCountLabel(clients, "Client", "Clients"),
        included: true,
      });
    }
    if (typeof suppliers === "number") {
      fromLimits.push({
        text: formatCountLabel(suppliers, "Fournisseur", "Fournisseurs"),
        included: true,
      });
    }
    if (typeof storage === "number") {
      const go =
        storage >= 1024
          ? `${Math.round((storage / 1024) * 10) / 10} Go`
          : `${storage} Mo`;
      fromLimits.push({ text: `${go} Stockage`, included: true });
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

/** Stable Admin drag order (sortOrder), then local MAD price. */
export function sortRemotePlans(remote) {
  return [...remote].sort((a, b) => {
    const orderA = Number(a.sortOrder ?? 0);
    const orderB = Number(b.sortOrder ?? 0);
    if (orderA !== orderB) return orderA - orderB;
    return (
      Number(a.localPriceCents ?? a.priceCents ?? 0) -
      Number(b.localPriceCents ?? b.priceCents ?? 0)
    );
  });
}

/**
 * Pick one “popular” card: customProperties.popular, else Entreprise tier/name, else mid index.
 * @param {ManagerPublicPlan[]} remote
 * @returns {number}
 */
export function resolvePopularIndex(remote) {
  if (!remote.length) return -1;
  const flagged = remote.findIndex((p) => {
    const props = p.customProperties;
    return !!(props && typeof props === "object" && props.popular);
  });
  if (flagged >= 0) return flagged;

  const entreprise = remote.findIndex((p) => {
    const keys = [p.tier, p.slug, p.name, p.title]
      .filter((v) => typeof v === "string")
      .map((v) => normalizePlanKey(/** @type {string} */ (v)));
    return keys.some((k) => k === "entreprise");
  });
  if (entreprise >= 0) return entreprise;

  return Math.min(2, remote.length - 1);
}

/**
 * Map Manager public plans → landing cards. Manager is the source of truth.
 * @param {ManagerPublicPlan[]} remoteAll
 * @returns {CheckoutPlan[]}
 */
export function mapManagerPlansToCheckout(remoteAll) {
  const remote = sortRemotePlans(preferredRemotePlans(remoteAll));
  const popularIndex = resolvePopularIndex(remote);
  return remote.map((plan, index) =>
    toCheckoutPlan(plan, { popular: index === popularIndex }),
  );
}
