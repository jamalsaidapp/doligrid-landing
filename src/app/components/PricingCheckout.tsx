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

type BankAccount = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  rib?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency: string;
  instructions?: string | null;
};

type Props = {
  plans: CheckoutPlan[];
  /** When false, Acheter falls back to mailto (Manager plans unavailable). */
  checkoutEnabled: boolean;
};

export default function PricingCheckout({ plans, checkoutEnabled }: Props) {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "wire">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksLoaded, setBanksLoaded] = useState(false);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId],
  );

  function selectPlan(planId: string, method: "card" | "wire") {
    setActivePlanId(planId);
    setPaymentMethod(method);
    setError("");
    setSuccess("");
    setProof(null);
    if (method === "wire" && !banksLoaded && !banksLoading) {
      void loadBanks();
    }
  }

  async function loadBanks() {
    setBanksLoading(true);
    setError("");
    try {
      const res = await fetch("/api/banks");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Coordonnées bancaires indisponibles.");
      }
      setBanks(Array.isArray(data.banks) ? data.banks : []);
      setBanksLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Coordonnées bancaires indisponibles.",
      );
    } finally {
      setBanksLoading(false);
    }
  }

  async function onCardSubmit(e: FormEvent) {
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

  async function onWireSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activePlan || !checkoutEnabled || !proof || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const body = new FormData();
      body.set("planId", activePlan.id);
      body.set("email", email.trim());
      if (name.trim()) body.set("name", name.trim());
      if (company.trim()) body.set("company", company.trim());
      body.set("proof", proof);

      const res = await fetch("/api/wire", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || "Le justificatif n’a pas pu être envoyé.",
        );
      }
      setSuccess(
        data.message ||
          "Justificatif reçu. Votre accès sera activé après validation administrative.",
      );
      setProof(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Le justificatif n’a pas pu être envoyé.",
      );
    } finally {
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
              <div className="pricing-actions">
                <button
                  type="button"
                  className={`button ${plan.popular ? "button-accent" : "button-outline"}`}
                  onClick={() => selectPlan(plan.id, "card")}
                  disabled={busy}
                >
                  Acheter <i className="bi bi-arrow-right" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="wire-action"
                  onClick={() => selectPlan(plan.id, "wire")}
                  disabled={busy}
                >
                  <i className="bi bi-bank" aria-hidden="true" />
                  Virement bancaire
                </button>
              </div>
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
        <div className="pricing-checkout-panel">
          <div className="checkout-panel-heading">
            <div>
              <p className="plan-label">
                {paymentMethod === "wire"
                  ? "Virement bancaire"
                  : "Paiement sécurisé"}
              </p>
              <h3>Paiement — {activePlan.name}</h3>
            </div>
            <button
              type="button"
              className="checkout-close"
              onClick={() => setActivePlanId(null)}
              aria-label="Fermer le formulaire de paiement"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>

          {paymentMethod === "wire" ? (
            <div className="wire-bank-section" aria-live="polite">
              {banksLoading ? (
                <p className="form-status form-status-loading">
                  Chargement des coordonnées bancaires…
                </p>
              ) : null}
              {!banksLoading && banksLoaded && banks.length === 0 ? (
                <p className="form-status form-status-error">
                  Aucun compte bancaire n’est disponible actuellement.
                </p>
              ) : null}
              {banks.map((bank) => (
                <article className="wire-bank-card" key={bank.id}>
                  <div className="wire-bank-title">
                    <span>
                      <i className="bi bi-bank" aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{bank.label}</strong>
                      <small>{bank.bankName}</small>
                    </div>
                    <em>{bank.currency}</em>
                  </div>
                  <dl>
                    <div>
                      <dt>Titulaire</dt>
                      <dd>{bank.accountHolder}</dd>
                    </div>
                    {bank.rib ? (
                      <div>
                        <dt>RIB</dt>
                        <dd>{bank.rib}</dd>
                      </div>
                    ) : null}
                    {bank.iban ? (
                      <div>
                        <dt>IBAN</dt>
                        <dd>{bank.iban}</dd>
                      </div>
                    ) : null}
                    {bank.swift ? (
                      <div>
                        <dt>SWIFT</dt>
                        <dd>{bank.swift}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {bank.instructions ? (
                    <p className="wire-instructions">{bank.instructions}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="checkout-description">
              Vous serez redirigé vers la page de paiement sécurisée. L’accès
              s’active après confirmation du prestataire.
            </p>
          )}

          <form
            onSubmit={
              paymentMethod === "wire" ? onWireSubmit : onCardSubmit
            }
            className="checkout-form"
          >
            <label>
              <span>Email professionnel</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
              />
            </label>
            <label>
              <span>Nom (optionnel)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span>Société (optionnel)</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            {paymentMethod === "wire" ? (
              <label className="checkout-proof">
                <span>Justificatif de virement</span>
                <input
                  required
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                />
                <small>JPEG, PNG, WebP ou PDF — 8 Mo maximum.</small>
              </label>
            ) : null}
            {error ? (
              <p
                className="form-status form-status-error"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </p>
            ) : null}
            {success ? (
              <p
                className="form-status form-status-success"
                role="status"
                aria-live="polite"
              >
                <i className="bi bi-check-circle-fill" aria-hidden="true" />{" "}
                {success}
              </p>
            ) : null}
            <button
              type="submit"
              className="button button-accent"
              disabled={
                busy ||
                Boolean(success) ||
                (paymentMethod === "wire" &&
                  (banksLoading || banks.length === 0 || !proof))
              }
            >
              {busy
                ? paymentMethod === "wire"
                  ? "Envoi…"
                  : "Redirection…"
                : paymentMethod === "wire"
                  ? "Envoyer le justificatif"
                  : "Continuer vers le paiement"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
