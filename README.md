# DoliGrid landing

Next.js landing site for `https://doligrid.com`.

## Local development

Copy `.env.example` to `.env.local`, then configure an exact local browser
origin such as:

```dotenv
LANDING_PUBLIC_URL=http://localhost:3000
# Either the Core origin or its /api/v1 URL is accepted.
CORE_API_URL=https://manager.frametoy.online/api/v1
PRODUCT_SLUG=doligrid
PLATFORM_API_KEY=<server-only-platform-api-key>
```

Install dependencies and run `npm run dev`.

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

## Wire-transfer checkout

The pricing cards offer both hosted card checkout and **Virement bancaire**.
Bank details are loaded through `GET /api/banks`; the server forwards its
Platform API key to Manager Core and returns only the public fields of active
accounts.

`POST /api/wire` accepts multipart form data with `planId`, required `email`,
optional `name` / `company`, and required `proof`. The route enforces the exact
browser origin, rejects any `tenantId`, limits the request and proof to the
Manager 8 MiB ceiling, and accepts only JPEG, PNG, WebP, or PDF. It first
creates a LANDING/WIRE CheckoutIntent and then uploads the proof linked to that
intent. Tenant creation and provisioning happen only after an administrator
approves the payment in Manager.

## Production configuration

Set these server environment variables in the deployment platform:

```dotenv
LANDING_PUBLIC_URL=https://doligrid.com
CORE_API_URL=https://manager.frametoy.online/api/v1
PRODUCT_SLUG=doligrid
PLATFORM_API_KEY=<same value as Manager Admin → Settings>
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
Core URL or API key configuration returns HTTP 503 without exposing the
missing value. Requests with a missing or unapproved `Origin` return HTTP 403,
including in production.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
