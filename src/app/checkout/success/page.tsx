import Link from "next/link";

export default function CheckoutSuccessPage() {
  const portalUrl = (
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    process.env.PORTAL_URL ||
    ""
  ).replace(/\/$/, "");

  return (
    <main className="container" style={{ padding: "4rem 1rem", maxWidth: 640 }}>
      <h1>Paiement reçu</h1>
      <p>
        Si le paiement a réussi, l’accès s’active après confirmation du
        prestataire (généralement en moins d’une minute). Cette page seule
        n’active pas l’abonnement.
      </p>
      {portalUrl ? (
        <p>
          <a className="button button-accent" href={`${portalUrl}/portal/billing`}>
            Ouvrir le portail de facturation
          </a>
        </p>
      ) : null}
      <p>
        <Link href="/">Retour à l’accueil</Link>
      </p>
    </main>
  );
}
