import Link from "next/link";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const txn = first(params.txn);
  const intent = first(params.intent);

  const portalUrl = (
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    process.env.PORTAL_URL ||
    ""
  ).replace(/\/$/, "");

  return (
    <main className="container" style={{ padding: "4rem 1rem", maxWidth: 640 }}>
      <h1>Paiement reçu</h1>
      <p>
        Si le paiement a réussi, SaaS Manager active l’abonnement après
        confirmation Paddle (webhook), généralement en moins d’une minute.
        Cette page seule n’active pas l’accès.
      </p>
      {txn ? (
        <p>
          Référence transaction : <code>{txn}</code>
        </p>
      ) : null}
      {intent ? (
        <p>
          Référence demande : <code>{intent}</code>
        </p>
      ) : null}
      {portalUrl ? (
        <p>
          <a
            className="button button-accent"
            href={`${portalUrl}/portal/billing`}
          >
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
