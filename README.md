# ICSS Plaza

A multi-tenant ecommerce store-rental application for **iCreate Solutions & Services**, Jamaica. The proposed GitHub repository name is **ICSS-Plaza** (GitHub repository names do not contain spaces).

## Included

- Marketing landing page with a live mini designer and a complete no-login demo dashboard.
- Owner signup, 14-day trial, password login, sign-out, password changes and operator-issued reset tokens.
- A distinct tenant per merchant, isolated products, media, orders, payment configurations and data exports.
- `/s/store-name` storefronts with an editorial or minimal layout; colours, typography, logo, banners, headings, navigation labels, about story, contact information, footer message and policies can be edited.
- Up to ten additional merchant information pages, with safe plain-text editing.
- Product CRUD, categories, SKU, images, active/featured controls, service listings and price/stock variants.
- Uploads for PNG, JPEG and WebP (2 MB/image, 200 files / 100 MB per tenant).
- Cart, category filtering, search, price sorting, delivery/pickup, shipping rules and configurable tax.
- Server-priced orders, transactional inventory reservations, checkout idempotency, token-protected customer order status and payment retry.
- Order processing and fulfilment, manual payment confirmation and unpaid cancellation with stock release.
- Encrypted, per-tenant gateway secrets; no card-entry forms or stored card numbers.
- Platform operator controls for active, trial, suspended and cancelled rentals; requests, password-reset assistance and audit events.
- Terms, privacy, cancellation/refund, acceptable-use and cookie pages identifying iCreate Solutions & Services.
- Full JSON export of settings, catalogue, orders and media; cancellation and reviewed deletion-request workflows.

The demo uses fictional Island Studio products and original SVG illustrations. Demo changes are browser-local and cannot alter a merchant’s real store. Payment setup in the demo discards entered credentials. Do not enter real customer or payment information into it.

## Local start

Requires **Node.js 24** (built-in `node:sqlite`). No third-party runtime dependencies.

```sh
cp .env.example .env
# Edit .env as needed. If ENCRYPTION_KEY is blank, a private key is generated in DATA_DIR.
node --env-file=.env src/server.js
```

Open `http://localhost:3000`. The marketing page and `/demo` work without an operator account. An explicit ENCRYPTION_KEY remains supported. If it is absent, the server creates DATA_DIR/.encryption-key with owner-only permissions and reuses it on restart. Include this private file with protected database backups; it is never served publicly or committed.

```sh
npm run check
npm test
```

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page and mini demo |
| `/demo` | Complete editable sample dashboard |
| `/demo?view=store` | Sample storefront with simulated checkout |
| `/signup` | Merchant signup and draft trial store |
| `/login`, `/admin` | Merchant administration |
| `/operator` | Platform rental and request management |
| `/reset` | Use a verified, operator-issued one-time reset token |
| `/s/:slug` | Published merchant store |
| `/legal/terms` | Platform terms |
| `/legal/privacy` | Platform privacy notice |
| `/legal/refunds` | Rental cancellation/refund policy |
| `/legal/acceptable-use` | Acceptable-use policy |
| `/legal/cookies` | Essential cookie and browser-storage notice |

## Gateway support: exact scope

| Option | Included checkout behaviour | Confirmation |
| --- | --- | --- |
| Fygaro | Server-signed payment-button JWT with immutable order total/reference | Timestamped, signed raw-body hook; matching tenant, amount, currency and unique transaction |
| PayPal | Orders v2 creation and capture; USD stores only | Server-side capture/detail verification of order, amount and currency; stable idempotency keys |
| WiPay Jamaica | Hosted Payments API checkout using Jamaica live/sandbox hosts | Bound transaction ID and order ID, currency check and server-side response-hash validation |
| EzeePayments | Merchant-supplied hosted link or payment instructions | Manual verification in provider account |
| NCB eCommerce / Powertranz | Merchant-supplied hosted link or instructions | Manual verification; bank-specific API adapter is not implemented |
| Scotiabank eCommerce | Merchant-supplied hosted link or instructions | Manual verification; bank-specific API adapter is not implemented |
| Lynk Business | Merchant payment link / ID and instructions | Manual receipt verification |
| Bank transfer | Merchant bank instructions | Manual receipt verification |
| Cash on delivery / pickup | Merchant instructions | Merchant records collected payment |
| Other approved provider | Custom label, hosted HTTPS link and instructions | Manual reconciliation until a dedicated adapter is developed |

Gateway listings are not partnership claims. Provider eligibility, merchant approval, credentials, settlement, plan availability, currencies and fees must be confirmed with each provider. “Every gateway” cannot honestly mean automatic API support for every bank/provider without their technical specification and merchant access. The custom hosted-link option accommodates additional approved providers without inventing their API.

Automated adapters are implemented and tested with mocked provider responses, **not live-certified**. Complete provider sandbox and live acceptance testing with approved merchant accounts before launch. Sandbox gateways cannot accept live storefront orders. Do not treat a hosted-link redirect as proof of payment.

For Fygaro set the button’s hook to `https://YOUR-DOMAIN/api/payments/TENANT-ID/fygaro/hook` with matching key ID and signing secret. The dashboard displays the exact URL. JWT support may require a qualifying Fygaro plan. Gateway credential snapshots remain encrypted per order so changing a store’s active configuration does not break outstanding order verification.

## Railway deployment

This is prepared for Railway using `Dockerfile` and `railway.json`; it has **not been deployed** by preparing these files.

1. Create a **private** GitHub repository named `ICSS-Plaza` and push this project.
2. Connect that repository to a new Railway service. Railway builds the Dockerfile.
3. Attach a persistent volume at `/data`. Set `DATA_DIR=/data`.
4. Use **one replica**. SQLite is a durable single-service database here. Do not horizontally scale this build or place its database on an ephemeral filesystem. A managed Postgres migration is needed for multi-instance scaling.
5. Set `NODE_ENV=production`. The server uses `BASE_URL` when provided, otherwise it derives its HTTPS origin from Railway’s `RAILWAY_PUBLIC_DOMAIN`. If neither URL variable exists, the container still starts and serves health checks, the landing page and administration; browser writes retain same-origin and CSRF checks. Automated provider checkout waits for a configured canonical public origin, while manual payment methods remain available. A code push cannot provision a public domain by itself. An optional `ENCRYPTION_KEY` must be 64 hexadecimal characters. If absent on a fresh database, the server securely generates `DATA_DIR/.encryption-key` and reuses it. Keep `/data` on the persistent volume and protect the key file in backups. An invalid explicit URL/key still stops startup with a specific error; the application never replaces a missing key when encrypted records already exist.
6. Set `OPERATOR_EMAIL` and a strong `OPERATOR_PASSWORD` before first boot. The operator is bootstrapped only if that email does not already exist. After creation, remove `OPERATOR_PASSWORD` from the deployment environment; keep `OPERATOR_EMAIL` as the operator identity. Change passwords using the account flow or an identity-verified recovery process.
7. Set `TRUST_PROXY=1` only when the service is behind Railway’s trusted proxy. Keep direct origin access restricted; the rate limiter uses the trusted proxy’s client-address header.
8. Railway’s `/api/health` check verifies database responsiveness. Confirm deployment health, production cookie flags and the configured public origin.
9. Arrange the merchant rental and provider onboarding, then activate the tenant in `/operator`. New trials do not automatically become paid subscriptions.

A single persistent volume stores the SQLite database, uploaded media, audit records and automatically generated encryption key. Without this volume, container replacement loses both the database and its generated key. If an existing deployment used an explicit ENCRYPTION_KEY, retain that original value: removing or changing it can make existing records unreadable. See [Railway’s provided variables](https://docs.railway.com/variables/reference) for RAILWAY_PUBLIC_DOMAIN. Use SQLite’s backup API or a consistent volume snapshot, not a blind live copy of only the main WAL database file. Schedule off-service encrypted backups and test restore. Do not commit production data or credentials.

## Business operation and limits

- **Rental billing is manual.** The owner agrees on pricing/billing and the operator activates the rental. No unapproved prices, recurring debits, invoices or provider charges are invented.
- Trial duration is 14 days. Expired trials, suspended tenants and cancelled rentals are not publicly accessible. Owners retain dashboard and export access unless their account is separately disabled by an operational process.
- Public stores require seller contact/address, delivery, returns, privacy, terms, at least one active product and an enabled default payment method.
- “Sell anything” means lawful permitted products/services. Regulated goods and provider-prohibited categories are not automatically allowed.
- Services use manual fulfilment. Automated appointment booking, digital-file delivery, real-time courier rates and email/SMS notifications are not included in this version.
- Custom domains, recurring subscription billing, automatic email verification and email password recovery are not integrated. Store routing is path-based. Password recovery is operator-assisted after identity verification.
- Refunds and chargebacks are handled with the payment provider and reconciled operationally. This version does not call provider refund APIs or automatically ingest later refund/chargeback webhooks.
- Unpaid orders reserve stock until the merchant cancels them. Operators should monitor abandoned/pending orders; no hidden auto-cancellation is performed.
- The dashboard displays the latest 500 orders; aggregate revenue/order counts and exports use the full history. Confirmed revenue does not subtract externally issued refunds until those are reconciled.
- Tenant owners cannot edit rental status. There is no unauthorised tenant impersonation or platform backdoor.
- Legal pages are starting operational policies, not a claim of guaranteed legal compliance. Before paid launch, confirm the operator’s business identity/address, data-controller/processor responsibilities, retention schedule, hosting/subprocessor arrangements, any required registrations and gateway acceptance with appropriate Jamaican advisers. Merchant policies must accurately describe each merchant’s own practices.

## Validation

`npm test` covers tenant isolation, CSRF, draft/public access, checkout totals and idempotency, inventory reservations/cancellation, order access tokens, media ownership/type validation, encrypted/redacted credentials, authenticated Fygaro hooks, trial expiry/operator controls, mocked PayPal/WiPay behaviour, and frontend route/template rendering. These are automated integration and template tests. **No real-browser layout QA or live gateway transaction was performed in this environment.**

## Template provenance

The requested source was inspected at [`Shamzbruv/Foryou-Skin-Bar`](https://github.com/Shamzbruv/Foryou-Skin-Bar), commit `74291a0cf860fafbff3a65ddffd9153d0322ab97`.

Its cream/gold palette, editorial hero, product cards, cart and editable-content patterns informed the tenant storefront. The original single-merchant backend was rebuilt around tenant ownership instead of copying its global merchant settings. No client account, customer record, existing gateway destination, tracking ID, logo or private key was copied into ICSS Plaza. See `docs/payment-sources.md` for provider references.

## Ownership

Prepared for iCreate Solutions & Services. No open-source licence is granted by this repository. All rights reserved unless the owner specifies otherwise.

## Brand assets

The ICSS Plaza logo family, favicon, app icons, social graphics and interface illustrations are in `public/assets/brand/`. See [the brand guide](docs/BRAND.md) for the asset inventory, usage and export instructions.
