"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeCheckoutIntent } from "../../components/checkout-complete";

type Props = {
  txn: string;
  intentId: string;
  portalUrl: string;
};

type ActivationState = "idle" | "loading" | "success" | "error";

export default function CheckoutSuccessClient({
  txn,
  intentId,
  portalUrl,
}: Props) {
  const [state, setState] = useState<ActivationState>(
    intentId && txn ? "loading" : "idle",
  );
  const [message, setMessage] = useState("");
  const [provisioned, setProvisioned] = useState(false);
  const ran = useRef(false);

  async function activate() {
    if (!intentId || !txn) return;
    setState("loading");
    setMessage("");
    const result = await completeCheckoutIntent({
      intentId,
      providerRef: txn,
    });
    if (!result.ok) {
      setState("error");
      setMessage(result.message || "Activation impossible.");
      setProvisioned(false);
      return;
    }
    setProvisioned(Boolean(result.provisioned));
    setState("success");
    setMessage(
      result.provisioned
        ? "Abonnement activé. Votre instance est en cours de provisionnement."
        : "Paiement synchronisé avec SaaS Manager. L’activation se finalise sous peu.",
    );
  }

  useEffect(() => {
    if (ran.current) return;
    if (!intentId || !txn) return;
    ran.current = true;
    void (async () => {
      setState("loading");
      const result = await completeCheckoutIntent({
        intentId,
        providerRef: txn,
      });
      if (!result.ok) {
        setState("error");
        setMessage(result.message || "Activation impossible.");
        setProvisioned(false);
        return;
      }
      setProvisioned(Boolean(result.provisioned));
      setState("success");
      setMessage(
        result.provisioned
          ? "Abonnement activé. Votre instance est en cours de provisionnement."
          : "Paiement synchronisé avec SaaS Manager. L’activation se finalise sous peu.",
      );
    })();
  }, [intentId, txn]);

  return (
    <main className="container" style={{ padding: "4rem 1rem", maxWidth: 640 }}>
      <h1>Paiement reçu</h1>
      <p>
        Si le paiement a réussi, SaaS Manager active l’abonnement (webhook Paddle
        + synchronisation landing), puis démarre le provisionnement de
        l’instance.
      </p>

      {txn ? (
        <p>
          Référence transaction : <code>{txn}</code>
        </p>
      ) : null}
      {intentId ? (
        <p>
          Référence demande : <code>{intentId}</code>
        </p>
      ) : null}

      {state === "loading" ? (
        <p className="form-status form-status-loading" role="status">
          Activation de l’abonnement en cours…
        </p>
      ) : null}
      {state === "success" ? (
        <p className="form-status form-status-success" role="status">
          <i className="bi bi-check-circle-fill" aria-hidden="true" /> {message}
        </p>
      ) : null}
      {state === "error" ? (
        <div>
          <p className="form-status form-status-error" role="alert">
            {message}
          </p>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void activate()}
          >
            Réessayer l’activation
          </button>
        </div>
      ) : null}

      {portalUrl ? (
        <p style={{ marginTop: "1.5rem" }}>
          <a
            className="button button-accent"
            href={`${portalUrl}/portal/billing`}
          >
            Ouvrir le portail de facturation
          </a>
        </p>
      ) : null}

      {provisioned ? (
        <p>
          L’instance ERP sera disponible sur votre sous-domaine dès que le
          déploiement agent est terminé.
        </p>
      ) : null}

      <p>
        <Link href="/">Retour à l’accueil</Link>
      </p>
    </main>
  );
}
