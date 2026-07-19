"use client";

import { FormEvent, useMemo, useState } from "react";

export type CheckoutPlan = {
  id: string;
  name: string;
  slug?: string;
  priceLabel: string;
  features: string[];
  popular?: boolean;
};

type Props = {
  plans: CheckoutPlan[];
  /** When false, Acheter falls back to mailto (Manager plans unavailable). */
  checkoutEnabled: boolean;
};

export default function PricingCheckout({ plans, checkoutEnabled }: Props) {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activePlan || !checkoutEnabled) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: activePlan.id,
          email: email.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Checkout failed (${res.status})`);
      }
      const url = data.url || data.checkoutUrl;
      if (typeof url !== "string") {
        throw new Error("Checkout did not return a URL");
      }
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article
            className={`pricing-card ${plan.popular ? "popular" : ""}`}
            key={plan.id}
          >
            {plan.popular && (
              <span className="popular-badge">Le plus populaire</span>
            )}
            <p className="plan-label">Service</p>
            <h3>{plan.name}</h3>
            <p className="price">
              <strong>{plan.priceLabel}</strong>
              <span>Dh / mois</span>
            </p>
            <div className="pricing-divider" />
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>{feature}</span>
                  <span className="visually-hidden">Inclus</span>
                </li>
              ))}
            </ul>
            {checkoutEnabled ? (
              <button
                type="button"
                className={`button ${plan.popular ? "button-accent" : "button-outline"}`}
                onClick={() => {
                  setActivePlanId(plan.id);
                  setError("");
                }}
                disabled={busy}
              >
                Acheter <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            ) : (
              <a
                className={`button ${plan.popular ? "button-accent" : "button-outline"}`}
                href={`mailto:commercial@doligrid.com?subject=Offre%20${encodeURIComponent(plan.name)}`}
              >
                Acheter <i className="bi bi-arrow-right" aria-hidden="true" />
              </a>
            )}
          </article>
        ))}
      </div>

      {activePlan && checkoutEnabled ? (
        <div
          className="pricing-checkout-panel"
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            border: "1px solid rgba(15,23,42,.12)",
            borderRadius: "12px",
            background: "rgba(255,255,255,.7)",
            maxWidth: "32rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Paiement — {activePlan.name}</h3>
              <p style={{ margin: "0.5rem 0 0", opacity: 0.75 }}>
                Vous serez redirigé vers la page de paiement sécurisée. L’accès
                s’active après confirmation du prestataire.
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setActivePlanId(null)}
            >
              Fermer
            </button>
          </div>
          <form
            onSubmit={onSubmit}
            style={{
              display: "grid",
              gap: "0.75rem",
              marginTop: "1.25rem",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Email professionnel</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Nom (optionnel)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Société (optionnel)</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            {error ? (
              <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>
            ) : null}
            <button
              type="submit"
              className="button button-accent"
              disabled={busy}
              style={{ justifySelf: "start" }}
            >
              {busy ? "Redirection…" : "Continuer vers le paiement"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
