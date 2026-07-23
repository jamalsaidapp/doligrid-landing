export async function completeCheckoutIntent(options: {
  intentId: string;
  providerRef: string;
}): Promise<{
  ok: boolean;
  message?: string;
  intentStatus?: string;
  tenantId?: string | null;
  subscriptionId?: string | null;
  provisioned?: boolean;
}> {
  const res = await fetch("/api/checkout/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentId: options.intentId,
      providerRef: options.providerRef,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      message:
        (typeof data.message === "string" && data.message) ||
        "L’abonnement n’a pas pu être activé.",
    };
  }
  return {
    ok: true,
    intentStatus:
      typeof data.intentStatus === "string" ? data.intentStatus : undefined,
    tenantId: typeof data.tenantId === "string" ? data.tenantId : null,
    subscriptionId:
      typeof data.subscriptionId === "string" ? data.subscriptionId : null,
    provisioned: Boolean(data.provisioned),
  };
}
