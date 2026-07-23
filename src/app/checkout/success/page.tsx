import CheckoutSuccessClient from "./CheckoutSuccessClient";

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
    <CheckoutSuccessClient
      txn={txn}
      intentId={intent}
      portalUrl={portalUrl}
    />
  );
}
