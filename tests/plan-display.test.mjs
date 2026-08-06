import assert from "node:assert/strict";
import { test } from "node:test";
import {
  currencyLabelForCode,
  formatAmountLabel,
  mapManagerPlansToCheckout,
  preferredRemotePlans,
  resolveDisplayPrice,
  resolvePeriodLabel,
  resolvePlanFeatures,
  toCheckoutPlan,
} from "../src/app/components/plan-display.js";

const SAMPLE = {
  id: "1",
  priceCents: 1200,
  currency: "USD",
  localPriceCents: 12000,
  localCurrency: "MAD",
};

test("Morocco display prefers local MAD price", () => {
  const display = resolveDisplayPrice(SAMPLE, { preferLocal: true });
  assert.deepEqual(display, { amount: 120, currencyLabel: "Dh" });
  assert.equal(formatAmountLabel(display.amount), "120");
});

test("non-Morocco display uses card USD/EUR price", () => {
  assert.deepEqual(resolveDisplayPrice(SAMPLE, { preferLocal: false }), {
    amount: 12,
    currencyLabel: "$",
  });
  assert.deepEqual(
    resolveDisplayPrice(
      { ...SAMPLE, currency: "EUR", priceCents: 4900 },
      { preferLocal: false },
    ),
    { amount: 49, currencyLabel: "€" },
  );
  assert.equal(currencyLabelForCode("EUR"), "€");
});

test("falls back across price sides when the preferred side is missing", () => {
  assert.deepEqual(
    resolveDisplayPrice(
      { id: "1", priceCents: 2400, currency: "USD", localPriceCents: 0 },
      { preferLocal: true },
    ),
    { amount: 24, currencyLabel: "$" },
  );
  assert.deepEqual(
    resolveDisplayPrice(
      { id: "1", priceCents: 0, currency: "USD", localPriceCents: 35000 },
      { preferLocal: false },
    ),
    { amount: 350, currencyLabel: "Dh" },
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
    { popular: true, preferLocal: true },
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

test("maps Manager catalog with regional currency", () => {
  const catalog = [
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
  ];

  const morocco = mapManagerPlansToCheckout(catalog, { preferLocal: true });
  assert.deepEqual(
    morocco.map((p) => ({
      name: p.name,
      price: p.priceLabel,
      currency: p.currencyLabel,
      popular: !!p.popular,
    })),
    [
      { name: "Auto-Entrepreneur", price: "120", currency: "Dh", popular: false },
      { name: "Pro", price: "350", currency: "Dh", popular: false },
      { name: "Entreprise", price: "240", currency: "Dh", popular: true },
      { name: "No Limit", price: "500", currency: "Dh", popular: false },
    ],
  );

  const abroad = mapManagerPlansToCheckout(catalog, { preferLocal: false });
  assert.deepEqual(
    abroad.map((p) => ({
      name: p.name,
      price: p.priceLabel,
      currency: p.currencyLabel,
    })),
    [
      { name: "Auto-Entrepreneur", price: "12", currency: "$" },
      { name: "Pro", price: "24", currency: "$" },
      { name: "Entreprise", price: "60", currency: "$" },
      { name: "No Limit", price: "100", currency: "$" },
    ],
  );
});
