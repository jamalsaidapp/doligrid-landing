# DoliGrid landing

Next.js landing site for `https://doligrid.com`.

## Brand assets

Logo SVGs live in `public/brand/`:

| File | Use |
|------|-----|
| `doligrid-logo-dark.svg` | Full logo on light backgrounds (header) |
| `doligrid-logo-white.svg` | Full logo on dark backgrounds (footer) |
| `doligrid-mark-dark.svg` | Icon / mark on light UI |
| `doligrid-mark-white.svg` | Icon / mark on dark UI |
| `../favicon.svg` | Site favicon |

The site uses these via `src/app/components/BrandLogo.tsx`.

### Brand colors

CSS variables in `src/app/globals.css` (`:root`):

| Token | Hex | Role |
|-------|-----|------|
| `--ink` | `#172c27` | Primary text / dark logo wordmark |
| `--muted` | `#60716c` | Secondary text |
| `--green-950` | `#013228` | Logo mark plate (dark green) |
| `--green-900` | `#073e32` | Deep green surfaces |
| `--green-700` | `#117b55` | “ERP” accent on dark logo / links |
| `--green-500` | `#1ad079` | Logo mark cells / brand green |
| `--green-100` | `#dff9ec` | Soft green backgrounds |
| `--lime` | `#c9f36a` | Logo mark accent cells / light accents |
| `--cream` | `#f6f6ed` | Warm page backgrounds |
| `--white` | `#ffffff` | Page / white logo wordmark |
| `--line` | `#dce6e2` | Borders / dividers |
| `--purple` | `#7341f1` | Accent (UI highlights) |
| `--orange` | `#f79552` | Focus / CTA accent |

Typography: **Sora** (headings / brand), **DM Sans** (body).

## Local development

Copy `.env.example` to `.env` or `.env.local`, then configure origins and Core:

```dotenv
LANDING_PUBLIC_URL=https://doligrid.com
# Exact Origins only — localhost and 127.0.0.1 are different; list both if needed.
ALLOWED_LANDING_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
# Either the Core origin or its /api/v1 URL is accepted.
CORE_API_URL=https://manager.frametoy.online/api/v1
PRODUCT_SLUG=doligrid
# Must match Manager Admin → Settings → Platform API Key (DB value, not env on Manager).
PLATFORM_API_KEY=<server-only-platform-api-key>
```

Install dependencies and run `npm run dev`. **Restart the Next.js process after
any `.env` / `.env.local` change** — env is read at process start.

In development, checkout/wire/banks/leads `503`/`403` responses include a
`code` and `detail` field (never the API key) so misconfiguration is visible in
the UI instead of only “temporairement indisponible”.

## Demo request integration

The browser sends `POST /api/leads` to this app. The route validates the
request's exact `Origin`, validates the submitted fields, adds
`productSlug` and `source`, then forwards the request to Manager Core with
the server-only Platform API key.

Required browser fields:

- `name`: non-empty string
- `email`: valid email address

Optional browser fields:

- `company`: string
- `message`: string

The server always supplies `productSlug` (default `doligrid`) and
`source: "landing"`; browser values cannot override them.

## Checkout (card + wire)

Clicking **Acheter** opens a modal to choose:

1. **Carte bancaire** — the landing creates a CheckoutIntent through
   `POST /api/checkout` (Manager → Paddle transaction), then opens the Paddle.js
   overlay with `providerRef` / `transactionId`. After `checkout.completed`,
   the landing calls `POST /api/checkout/complete`, which asks Manager
   `POST /billing/checkout-intents/:id/reconcile` to create the tenant,
   activate the subscription, and start instance provisioning. Paddle webhooks
   remain the primary async path; reconcile is the idempotent safety net.
2. **Virement bancaire** — bank details come from `GET /api/banks`. Submitting
   proof uses `POST /api/wire` (CheckoutIntent + proof upload). Tenant access
   is activated only after an administrator approves the payment in Manager.

Required browser env for card checkout:

```dotenv
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<paddle-client-side-token>
NEXT_PUBLIC_PADDLE_ENV=sandbox
```

Set `NEXT_PUBLIC_PADDLE_ENV=production` for live payments. Approve
`LANDING_PUBLIC_URL` (and localhost if needed) as a Paddle checkout domain, and
point Paddle’s default payment link at the landing origin so `_ptxn` recovery
works.

`POST /api/wire` accepts multipart form data with `planId`, required `email`,
optional `name` / `company`, and required `proof`. The route enforces the exact
browser origin, rejects any `tenantId`, limits the request and proof to the
Manager 8 MiB ceiling, and accepts only JPEG, PNG, WebP, or PDF.

## Production configuration

Set these server environment variables in the deployment platform:

```dotenv
LANDING_PUBLIC_URL=https://doligrid.com
CORE_API_URL=https://manager.frametoy.online/api/v1
PRODUCT_SLUG=doligrid
PLATFORM_API_KEY=<same value as Manager Admin → Settings>
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<paddle-client-side-token>
NEXT_PUBLIC_PADDLE_ENV=production
# Optional exact, comma-separated aliases or preview origins:
ALLOWED_LANDING_ORIGINS=
```

`LANDING_PUBLIC_URL` and every `ALLOWED_LANDING_ORIGINS` entry are normalized
to scheme, hostname, and port. Wildcards are rejected. Localhost is not
implicitly trusted and must be explicitly configured. The route does not use
`Host`, `X-Forwarded-Host`, or `Referer` for authorization.

`CORE_API_URL` may be the Core origin or end in `/api/v1` (an existing
`/api/v1/leads` endpoint is also accepted). Other paths, credentials, query
strings, and fragments are rejected.

`PLATFORM_API_KEY` must remain server-only: do not use a `NEXT_PUBLIC_` name,
embed it in client code, log it, or return it in an API response. Missing
Core URL or API key configuration returns HTTP 503 with a stable `code`
(`MISSING_PLATFORM_API_KEY`, `MISSING_CORE_API_URL`, …). Production keeps a
generic French `message`; development also returns actionable `detail`.
Requests with a missing or unapproved `Origin` return HTTP 403
(`ORIGIN_NOT_ALLOWED`), including in production.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
