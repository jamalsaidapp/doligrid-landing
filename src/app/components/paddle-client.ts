export type PaddleCheckoutEvent = {
  name?: string;
  data?: {
    id?: string;
    transaction_id?: string;
  };
};

type PaddleCheckoutOpenOptions = {
  transactionId: string;
  customer?: { email?: string };
  settings?: {
    displayMode?: "overlay" | "inline";
    theme?: "light" | "dark";
    locale?: string;
    successUrl?: string;
    allowLogout?: boolean;
  };
};

type PaddleApi = {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: PaddleCheckoutEvent) => void;
  }) => void;
  Checkout: {
    open: (options: PaddleCheckoutOpenOptions) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleApi;
  }
}

const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let paddleReady: Promise<PaddleApi> | null = null;
let initializedToken: string | null = null;
let activeEventHandler: ((event: PaddleCheckoutEvent) => void) | null = null;

function loadPaddleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paddle is only available in the browser."));
  }
  if (window.Paddle) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${PADDLE_SCRIPT_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Impossible de charger Paddle.js.")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Impossible de charger Paddle.js."));
    document.head.appendChild(script);
  });
}

export function getPaddleClientToken(): string {
  return (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "").trim();
}

export function getPaddleEnvironment(): "sandbox" | "production" {
  const value = (process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox")
    .trim()
    .toLowerCase();
  return value === "production" || value === "live" ? "production" : "sandbox";
}

export async function ensurePaddle(): Promise<PaddleApi> {
  const token = getPaddleClientToken();
  if (!token) {
    throw new Error(
      "Le paiement par carte n’est pas configuré (jeton Paddle manquant).",
    );
  }

  if (!paddleReady || initializedToken !== token) {
    paddleReady = (async () => {
      await loadPaddleScript();
      if (!window.Paddle) {
        throw new Error("Paddle.js n’est pas disponible.");
      }

      const env = getPaddleEnvironment();
      if (env === "sandbox") {
        window.Paddle.Environment.set("sandbox");
      }

      window.Paddle.Initialize({
        token,
        eventCallback: (event) => {
          activeEventHandler?.(event);
        },
      });
      initializedToken = token;
      return window.Paddle;
    })();
  }

  return paddleReady;
}

export function extractTransactionId(payload: {
  providerRef?: unknown;
  transactionId?: unknown;
  url?: unknown;
  checkoutUrl?: unknown;
}): string | null {
  if (
    typeof payload.providerRef === "string" &&
    payload.providerRef.startsWith("txn_")
  ) {
    return payload.providerRef;
  }
  if (
    typeof payload.transactionId === "string" &&
    payload.transactionId.startsWith("txn_")
  ) {
    return payload.transactionId;
  }

  for (const candidate of [payload.url, payload.checkoutUrl]) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate, window.location.origin);
      const txn = url.searchParams.get("_ptxn");
      if (txn?.startsWith("txn_")) return txn;
    } catch {
      const match = candidate.match(/[?&]_ptxn=(txn_[a-z0-9]+)/i);
      if (match?.[1]) return match[1];
    }
  }

  return null;
}

export async function openPaddleCheckout(options: {
  transactionId: string;
  email?: string;
  successUrl: string;
  onEvent?: (event: PaddleCheckoutEvent) => void;
}): Promise<void> {
  activeEventHandler = options.onEvent || null;
  const paddle = await ensurePaddle();
  paddle.Checkout.open({
    transactionId: options.transactionId,
    ...(options.email ? { customer: { email: options.email } } : {}),
    settings: {
      displayMode: "overlay",
      theme: "light",
      locale: "fr",
      allowLogout: false,
      successUrl: options.successUrl,
    },
  });
}
