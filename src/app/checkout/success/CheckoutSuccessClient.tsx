"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeCheckoutIntent } from "../../components/checkout-complete";

type Props = {
  txn: string;
  intentId: string;
  portalFallbackUrl: string;
};

type ActivationState = "idle" | "loading" | "success" | "error";

export default function CheckoutSuccessClient({
  txn,
  intentId,
  portalFallbackUrl,
}: Props) {
  const [state, setState] = useState<ActivationState>(
    intentId && txn ? "loading" : "idle",
  );
  const [message, setMessage] = useState("");
  const [signedPortalUrl, setSignedPortalUrl] = useState<string | null>(null);
  const ran = useRef(false);

  function redirectToPortal(url: string | null | undefined) {
    if (url) {
      window.location.assign(url);
      return;
    }
    if (portalFallbackUrl) {
      window.location.assign(`${portalFallbackUrl}/portal/billing`);
    }
  }

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
      return;
    }
    setSignedPortalUrl(result.portalUrl || null);
    setState("success");
    setMessage("Abonnement activé. Redirection vers le portail client…");
    redirectToPortal(result.portalUrl);
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
        return;
      }
      setSignedPortalUrl(result.portalUrl || null);
      setState("success");
      setMessage("Abonnement activé. Redirection vers le portail client…");
      redirectToPortal(result.portalUrl);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId, txn]);

  const portalHref =
    signedPortalUrl ||
    (portalFallbackUrl ? `${portalFallbackUrl}/portal/billing` : "");

  return (
    <main className="container" style={{ padding: "4rem 1rem", maxWidth: 640 }}>
      <h1>Paiement reçu</h1>
      <p>
        Si le paiement a réussi, vous êtes redirigé automatiquement vers le
        portail client pour suivre votre abonnement et votre instance.
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

      {portalHref ? (
        <p style={{ marginTop: "1.5rem" }}>
          <a className="button button-accent" href={portalHref}>
            Ouvrir le portail client
          </a>
        </p>
      ) : null}

      <p>
        <Link href="/">Retour à l’accueil</Link>
      </p>
    </main>
  );
}
