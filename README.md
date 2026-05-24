# LottoMax

Production-shaped LottoMax instant group draw platform inspired by the Manus reference experience.

- Vue 3 + Pinia + Vite
- Node HTTP backend with persistent wallet ledger storage
- User registration and sign-in
- Payment order portal with provider reference confirmation
- Direct UPI payment deep links and scannable QR codes for pending payment orders
- Wallet-based real-money group entry
- 5/10/15/20-player live groups
- Entry fee, prize pool, and draw escrow calculation
- Unique number-card selection
- Backend-settled draw lifecycle
- Winner payout receives 85% of escrow
- LottoMax company wallet receives 15% platform revenue
- Transaction history
- Docker Compose deployment

Actual money capture should be connected to a licensed payment provider such as Razorpay,
Stripe, Cashfree, or a bank gateway through `LOTTOMAX_PAYMENT_PROVIDER` and a secure webhook.
The included portal creates backend payment orders and requires a provider reference before
crediting the wallet, so balance changes are no longer browser-only demo state. Configure
`LOTTOMAX_COMPANY_UPI_ID` and `LOTTOMAX_COMPANY_PAYEE_NAME` to generate the production QR.

## Development

```bash
npm install
npm run dev
```

For local API development in another terminal:

```bash
PORT=5181 LOTTOMAX_DATA_DIR=./data npm run server
```

## Docker

```bash
docker compose up --build -d
```

The app runs at `http://localhost:5180`.

## Public Hosting

The repository includes `render.yaml` for a GitHub-connected Render deployment.

1. Push `main` to GitHub.
2. In Render, create a new Blueprint from `ajaychaurasia25921/lottomax`.
3. Set `LOTTOMAX_PAYMENT_PROVIDER` and payment gateway secrets from `.env.production.example`.
4. Configure a persistent data disk or replace the JSON ledger with a managed database before accepting public real-money traffic.
5. Enable provider webhooks for payment capture verification.

Free web services can sleep after inactivity. For public launch, move the wallet ledger to a managed database and run on a paid always-on instance before processing real payments.

## Enterprise Artifacts

This branch adds a production-oriented enterprise package alongside the existing Vue/Vite app:

```text
docs/
  hld-lld.md
  confluence-prd.md
  investor-pitch-deck.md
  ui-ux-wireframes.md
  openapi/lottomax-enterprise.yaml
  database/postgres-schema.sql
enterprise/
  backend-java/
    build.gradle.kts
    settings.gradle.kts
    src/main/java/com/lottomax/enterprise
    src/main/resources/application.properties
    src/test/java/com/lottomax/enterprise
  frontend/
    src/app/onboarding/page.tsx
    src/app/wallet/page.tsx
    src/components/CIAMOnboarding.tsx
    src/components/Wallet.tsx
    src/hooks/useWallet.ts
    src/lib/api.ts
    src/store/walletStore.ts
```

The enterprise backend is a Gradle/Quarkus service. It contains CIAM onboarding endpoints, wallet deposit and withdrawal flows, payment webhook handling, lottery broad group controls, ticket purchase, automated settlement, admin audit logging, a risk dashboard, and tests for exact 15%/85% payout math plus the under-$5,000 instant withdrawal rule.

OpenAPI specification:

```bash
docs/openapi/lottomax-enterprise.yaml
```

Gradle backend verification:

```bash
cd enterprise/backend-java
gradle test
```

No Maven project files are used for the enterprise Java backend.
