import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAmountLabel,
  preferredRemotePlans,
  resolveDisplayPrice,
  resolvePeriodLabel,
  resolvePlanFeatures,
  toCheckoutPlan,
} from "../src/app/components/plan-display.js";

test("prefers local MAD price for Morocco display", () => {
  const display = resolveDisplayPrice({
    id: "1",
    priceCents: 1200,
    currency: "EUR",
    localPriceCents: 12000,
    localCurrency: "MAD",
  });
  assert.deepEqual(display, { amount: 120, currencyLabel: "Dh" });
  assert.equal(formatAmountLabel(display.amount), "120");
});

test("falls back to card price only when currency is MAD", () => {
  assert.deepEqual(
    resolveDisplayPrice({
      id: "1",
      priceCents: 24000,
      currency: "MAD",
      localPriceCents: 0,
    }),
    { amount: 240, currencyLabel: "Dh" },
  );
  assert.equal(
    resolveDisplayPrice({
      id: "1",
      priceCents: 2400,
      currency: "EUR",
      localPriceCents: 0,
    }),
    null,
  );
});

test("maps Manager features and interval into checkout cards", () => {
  const plan = toCheckoutPlan(
    {
      id: "plan-uuid",
      title: "Agence",
      slug: "agence-monthly",
      tier: "agence",
      interval: "YEAR",
      priceCents: 2400,
      currency: "EUR",
      localPriceCents: 240000,
      localCurrency: "MAD",
      features: [
        { text: "2 utilisateurs", included: true },
        { text: "Support premium", included: false },
      ],
    },
    { popular: true },
  );

  assert.equal(plan.id, "plan-uuid");
  assert.equal(plan.priceLabel, "2 400");
  assert.equal(plan.currencyLabel, "Dh");
  assert.equal(plan.periodLabel, "an");
  assert.equal(plan.popular, true);
  assert.deepEqual(plan.features, [
    { text: "2 utilisateurs", included: true },
    { text: "Support premium", included: false },
  ]);
  assert.equal(resolvePeriodLabel("MONTH"), "mois");
});

test("derives feature bullets from limits when marketing list is empty", () => {
  const features = resolvePlanFeatures({
    id: "1",
    features: [],
    limits: {
      users_limit: 5,
      storage_limit_mb: 5120,
      clients_limit: 150,
      suppliers_limit: 100,
    },
  });
  assert.deepEqual(features, [
    { text: "Utilisateurs max : 5", included: true },
    { text: "Stockage max : 5 Go", included: true },
    { text: "Clients max : 150", included: true },
    { text: "Fournisseurs max : 100", included: true },
  ]);
});

test("prefers monthly plans when yearly twins exist", () => {
  const preferred = preferredRemotePlans([
    { id: "m", name: "Agence", interval: "MONTH", localPriceCents: 24000 },
    { id: "y", name: "Agence", interval: "YEAR", localPriceCents: 240000 },
  ]);
  assert.deepEqual(
    preferred.map((p) => p.id),
    ["m"],
  );
});
