"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  extractTransactionId,
  getPaddleClientToken,
  openPaddleCheckout,
} from "./paddle-client";

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
  /** False when Manager has no active checkout plans. */
  checkoutEnabled: boolean;
};

type Step = "method" | "details";

export default function PricingCheckout({ plans, checkoutEnabled }: Props) {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("method");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "wire" | null>(
    null,
  );
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

  const paddleConfigured = Boolean(getPaddleClientToken());

  useEffect(() => {
    if (!activePlanId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) closeModal();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activePlanId, busy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const txn = params.get("_ptxn");
    if (!txn?.startsWith("txn_") || !paddleConfigured) return;

    void openPaddleCheckout({
      transactionId: txn,
      successUrl: `${window.location.origin}/checkout/success?txn=${encodeURIComponent(txn)}`,
      onEvent: (event) => {
        if (event.name === "checkout.completed") {
          const completedTxn =
            event.data?.transaction_id || event.data?.id || txn;
          window.location.assign(
            `/checkout/success?txn=${encodeURIComponent(completedTxn)}`,
          );
        }
      },
    }).catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’ouvrir le paiement Paddle.",
      );
    });
  }, [paddleConfigured]);

  function closeModal() {
    setActivePlanId(null);
    setStep("method");
    setPaymentMethod(null);
    setError("");
    setSuccess("");
    setProof(null);
  }

  function openBuyModal(planId: string) {
    if (!checkoutEnabled) {
      setError(
        "Le paiement en ligne est temporairement indisponible : aucune offre active n’est publiée dans SaaS Manager.",
      );
      return;
    }
    setActivePlanId(planId);
    setStep("method");
    setPaymentMethod(null);
    setError("");
    setSuccess("");
    setProof(null);
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
        err instanceof Error
          ? err.message
          : "Coordonnées bancaires indisponibles.",
      );
    } finally {
      setBanksLoading(false);
    }
  }

  function chooseMethod(method: "card" | "wire") {
    setPaymentMethod(method);
    setStep("details");
    setError("");
    setSuccess("");
    setProof(null);
    if (method === "wire" && !banksLoaded && !banksLoading) {
      void loadBanks();
    }
  }

  async function onCardSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activePlan || !checkoutEnabled || !paymentMethod) return;
    if (!paddleConfigured) {
      setError(
        "Le paiement par carte n’est pas configuré. Ajoutez NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.",
      );
      return;
    }

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

      const transactionId = extractTransactionId(data);
      const intentId =
        typeof data.id === "string" && data.id ? data.id : undefined;
      if (!transactionId) {
        throw new Error("Le Manager n’a pas renvoyé de transaction Paddle.");
      }

      const successUrl = new URL("/checkout/success", window.location.origin);
      successUrl.searchParams.set("txn", transactionId);
      if (intentId) successUrl.searchParams.set("intent", intentId);

      await openPaddleCheckout({
        transactionId,
        email: email.trim(),
        successUrl: successUrl.toString(),
        onEvent: (event) => {
          if (event.name === "checkout.completed") {
            const completedTxn =
              event.data?.transaction_id ||
              event.data?.id ||
              transactionId;
            const done = new URL(
              "/checkout/success",
              window.location.origin,
            );
            done.searchParams.set("txn", completedTxn);
            if (intentId) done.searchParams.set("intent", intentId);
            window.location.assign(done.toString());
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
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
      {!checkoutEnabled && error && !activePlan ? (
        <p
          className="form-status form-status-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}

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
            <button
              type="button"
              className={`button ${plan.popular ? "button-accent" : "button-outline"}`}
              onClick={() => openBuyModal(plan.id)}
              disabled={busy}
            >
              Acheter <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      {activePlan && checkoutEnabled ? (
        <div
          className="checkout-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!busy) closeModal();
          }}
        >
          <div
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="checkout-panel-heading">
              <div>
                <p className="plan-label">Paiement</p>
                <h3 id="checkout-modal-title">{activePlan.name}</h3>
                <p className="checkout-modal-price">
                  {activePlan.priceLabel} Dh / mois
                </p>
              </div>
              <button
                type="button"
                className="checkout-close"
                onClick={() => {
                  if (!busy) closeModal();
                }}
                aria-label="Fermer le formulaire de paiement"
                disabled={busy}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {step === "method" ? (
              <div className="payment-method-grid">
                <p className="checkout-description">
                  Choisissez votre mode de paiement pour continuer.
                </p>
                <button
                  type="button"
                  className="payment-method-card"
                  onClick={() => chooseMethod("card")}
                >
                  <span className="payment-method-icon">
                    <i className="bi bi-credit-card-2-front" aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Carte bancaire</strong>
                    <small>Paiement sécurisé via Paddle</small>
                  </span>
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="payment-method-card"
                  onClick={() => chooseMethod("wire")}
                >
                  <span className="payment-method-icon">
                    <i className="bi bi-bank" aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Virement bancaire</strong>
                    <small>Coordonnées + justificatif</small>
                  </span>
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </button>
                {!paddleConfigured ? (
                  <p className="form-status form-status-error" role="status">
                    Le paiement par carte nécessite NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="checkout-back"
                  onClick={() => {
                    if (!busy) {
                      setStep("method");
                      setError("");
                      setSuccess("");
                    }
                  }}
                  disabled={busy}
                >
                  <i className="bi bi-arrow-left" aria-hidden="true" />
                  Changer de mode de paiement
                </button>

                {paymentMethod === "wire" ? (
                  <div className="wire-bank-section" aria-live="polite">
                    {banksLoading ? (
                      <p className="form-status form-status-loading">
                        Chargement des coordonnées bancaires…
                      </p>
                    ) : null}
                    {!banksLoading && !banksLoaded ? (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => void loadBanks()}
                      >
                        Réessayer le chargement
                      </button>
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
                          <p className="wire-instructions">
                            {bank.instructions}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="checkout-description">
                    Une fenêtre Paddle s’ouvrira pour finaliser le paiement.
                    Après succès, SaaS Manager active l’abonnement via le webhook
                    Paddle.
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
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    <span>Nom (optionnel)</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>Société (optionnel)</span>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      autoComplete="organization"
                    />
                  </label>
                  {paymentMethod === "wire" ? (
                    <label className="checkout-proof">
                      <span>Justificatif de virement</span>
                      <input
                        required
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) =>
                          setProof(e.target.files?.[0] || null)
                        }
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
                      <i
                        className="bi bi-check-circle-fill"
                        aria-hidden="true"
                      />{" "}
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
                        (banksLoading || banks.length === 0 || !proof)) ||
                      (paymentMethod === "card" && !paddleConfigured)
                    }
                  >
                    {busy
                      ? paymentMethod === "wire"
                        ? "Envoi…"
                        : "Ouverture de Paddle…"
                      : paymentMethod === "wire"
                        ? "Envoyer le justificatif"
                        : "Payer par carte"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
