import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAmountLabel,
  mapManagerPlansToCheckout,
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
      title: "Pro",
      slug: "pro-monthly",
      tier: "pro",
      interval: "YEAR",
      priceCents: 2400,
      currency: "USD",
      localPriceCents: 35000,
      localCurrency: "MAD",
      features: [
        { text: "2 Utilisateurs", included: true },
        { text: "Support premium", included: false },
      ],
    },
    { popular: true },
  );

  assert.equal(plan.id, "plan-uuid");
  assert.equal(plan.name, "Pro");
  assert.equal(plan.priceLabel, "350");
  assert.equal(plan.currencyLabel, "Dh");
  assert.equal(plan.periodLabel, "an");
  assert.equal(plan.popular, true);
  assert.deepEqual(plan.features, [
    { text: "2 Utilisateurs", included: true },
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
    { text: "5 Utilisateurs", included: true },
    { text: "150 Clients", included: true },
    { text: "100 Fournisseurs", included: true },
    { text: "5 Go Stockage", included: true },
  ]);
});

test("prefers monthly plans when yearly twins exist", () => {
  const preferred = preferredRemotePlans([
    { id: "m", name: "Pro", interval: "MONTH", localPriceCents: 35000 },
    { id: "y", name: "Pro", interval: "YEAR", localPriceCents: 350000 },
  ]);
  assert.deepEqual(
    preferred.map((p) => p.id),
    ["m"],
  );
});

test("maps Manager catalog without remapping stale local names", () => {
  const plans = mapManagerPlansToCheckout([
    {
      id: "id-ae",
      name: "Auto-Entrepreneur",
      sortOrder: 0,
      interval: "MONTH",
      priceCents: 1200,
      currency: "USD",
      localPriceCents: 12000,
      features: [{ text: "1 Utilisateur", included: true }],
    },
    {
      id: "id-pro",
      name: "Pro",
      sortOrder: 1,
      interval: "MONTH",
      priceCents: 2400,
      currency: "USD",
      localPriceCents: 35000,
      features: [{ text: "2 Utilisateur", included: true }],
    },
    {
      id: "id-ent",
      name: "Entreprise",
      sortOrder: 2,
      interval: "MONTH",
      priceCents: 6000,
      currency: "USD",
      localPriceCents: 24000,
      features: [{ text: "5 Utilisateur", included: true }],
    },
    {
      id: "id-nl",
      name: "No Limit",
      sortOrder: 3,
      interval: "MONTH",
      priceCents: 10000,
      currency: "USD",
      localPriceCents: 50000,
      features: [{ text: "Utilisateurs illimités", included: true }],
    },
  ]);

  assert.deepEqual(
    plans.map((p) => ({ id: p.id, name: p.name, price: p.priceLabel, popular: !!p.popular })),
    [
      { id: "id-ae", name: "Auto-Entrepreneur", price: "120", popular: false },
      { id: "id-pro", name: "Pro", price: "350", popular: false },
      { id: "id-ent", name: "Entreprise", price: "240", popular: true },
      { id: "id-nl", name: "No Limit", price: "500", popular: false },
    ],
  );
});
