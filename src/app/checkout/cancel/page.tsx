import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="container" style={{ padding: "4rem 1rem", maxWidth: 640 }}>
      <h1>Paiement annulé</h1>
      <p>Aucun prélèvement n’a été effectué. Vous pouvez choisir une offre à tout moment.</p>
      <p>
        <a className="button button-accent" href="/#tarifs">
          Voir les tarifs
        </a>
      </p>
      <p>
        <Link href="/">Retour à l’accueil</Link>
      </p>
    </main>
  );
}
