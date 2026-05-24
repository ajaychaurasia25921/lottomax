# LottoMax HLD and LLD

## Scope

LottoMax is a real-money lottery platform with CIAM onboarding, KYC/AML screening, wallet funding, ticket purchase, draw settlement, winner payout, company revenue capture, immutable ledgering, and administrator risk controls.

## High-Level Design

### Architecture Principles

| Principle | Decision |
| --- | --- |
| Identity | Auth0 or AWS Cognito with MFA, device risk, and KYC/AML vendor callbacks |
| Monetary precision | All balances use integer minor units; no floating-point arithmetic |
| Transaction integrity | PostgreSQL is the source of truth for wallet, tickets, draws, and append-only ledger entries |
| Low-latency reads | Redis caches draw state, hot wallet health, user session risk, and anti-abuse counters |
| Settlement | Draw pools are frozen before RNG selection; winner receives 85%, company receives 15% |
| Auditability | Admin and system actions record timestamp, IP, actor, correlation ID, and immutable payload hash |

### System Architecture

```mermaid
flowchart LR
  Web[Next.js Web App] --> APIGW[API Gateway / WAF]
  Admin[Admin Console] --> APIGW
  APIGW --> CIAM[Auth0 or AWS Cognito]
  CIAM --> KYC[KYC / AML Provider]
  APIGW --> Lottery[Lottery Group Engine]
  APIGW --> Wallet[Wallet Service]
  APIGW --> Risk[Risk & Velocity Service]
  APIGW --> AdminSvc[Admin Service]
  Lottery --> RNG[Cryptographic RNG Service]
  Lottery --> Settlement[Settlement Service]
  Settlement --> Wallet
  Wallet --> Payment[Payment Gateway]
  Wallet --> Ledger[(Append-only Ledger)]
  Lottery --> PG[(PostgreSQL)]
  Wallet --> PG
  AdminSvc --> PG
  Risk --> Redis[(Redis)]
  Lottery --> Redis
  Wallet --> Redis
  Ledger --> Audit[(Audit Store / WORM)]
  AdminSvc --> Audit
  Payment --> Webhook[Signed Webhooks]
  Webhook --> Wallet
```

### Core Services

| Service | Responsibilities | Storage |
| --- | --- | --- |
| Identity Gateway | Validates JWTs, enforces MFA claims, maps CIAM identities to internal users | PostgreSQL user profile cache |
| KYC/AML Orchestrator | Manages verification state, sanctions checks, PEP checks, enhanced due diligence | PostgreSQL, vendor evidence vault |
| Wallet Service | Deposits, withdrawals, holds, releases, balance projections, payment webhooks | PostgreSQL, append-only ledger |
| Lottery Group Engine | Broad group creation, pause/resume, ticket inventory, pool freeze, draw conclusion | PostgreSQL, Redis |
| Settlement Service | Calculates pot split, debits escrow, credits winner and master wallet atomically | PostgreSQL transaction |
| Risk Service | Velocity abuse checks, hot wallet liquidity thresholds, withdrawal rules | Redis, PostgreSQL |
| Admin Service | Operator actions, financial risk dashboard, group management, audit trails | PostgreSQL, WORM audit |

### Deposit and Withdrawal Data Flow

```mermaid
sequenceDiagram
  participant U as User
  participant Web as Web App
  participant API as API Gateway
  participant W as Wallet Service
  participant R as Risk Service
  participant P as Payment Gateway
  participant DB as PostgreSQL
  participant L as Append-only Ledger

  U->>Web: Request deposit or withdrawal
  Web->>API: Authenticated wallet command
  API->>W: Validate JWT, idempotency key
  W->>R: Velocity, KYC, AML, device checks
  R-->>W: Allow, review, or deny
  alt Deposit
    W->>P: Create payment intent
    P-->>W: Gateway reference
    P->>W: Signed capture webhook
    W->>DB: Transaction: credit wallet
    W->>L: Append CREDIT entry
    W-->>Web: Real-time balance update
  else Withdrawal
    W->>DB: Transaction: place debit hold
    W->>P: Create payout
    P-->>W: Payout accepted
    W->>DB: Transaction: finalize debit
    W->>L: Append DEBIT entry
    W-->>Web: Withdrawal status
  end
```

### PostgreSQL ER Model

```mermaid
erDiagram
  users ||--|| wallets : owns
  users ||--o{ kyc_cases : has
  users ||--o{ tickets : buys
  wallets ||--o{ ledger_entries : records
  broad_groups ||--o{ draws : schedules
  draws ||--o{ tickets : contains
  draws ||--o{ settlements : settles
  settlements ||--o{ ledger_entries : posts
  admin_users ||--o{ audit_events : performs

  users {
    uuid id PK
    text ciam_subject UK
    text email
    text phone
    text kyc_status
    timestamptz created_at
  }
  wallets {
    uuid id PK
    uuid user_id FK
    bigint available_cents
    bigint held_cents
    text currency
    bigint version
  }
  ledger_entries {
    uuid id PK
    uuid wallet_id FK
    uuid settlement_id FK
    text direction
    bigint amount_cents
    text currency
    text reason
    text idempotency_key UK
    bytea payload_hash
    timestamptz created_at
  }
  broad_groups {
    uuid id PK
    text name
    text status
    integer max_players
    bigint ticket_price_cents
  }
  draws {
    uuid id PK
    uuid broad_group_id FK
    text status
    bigint frozen_pool_cents
    uuid winning_ticket_id
    timestamptz closed_at
  }
  tickets {
    uuid id PK
    uuid user_id FK
    uuid draw_id FK
    text number_set
    bigint price_cents
    timestamptz purchased_at
  }
  settlements {
    uuid id PK
    uuid draw_id FK
    uuid winner_user_id FK
    bigint company_amount_cents
    bigint winner_amount_cents
    text status
    timestamptz settled_at
  }
  audit_events {
    uuid id PK
    uuid admin_user_id FK
    text action
    inet source_ip
    jsonb payload
    timestamptz created_at
  }
```

## Low-Level Design

### Settlement Algorithm

1. Start a serializable PostgreSQL transaction.
2. Lock the draw row and all tickets with `SELECT ... FOR UPDATE`.
3. Verify draw status is `OPEN` or `CLOSING`, group is not paused, and ticket count is valid.
4. Freeze pool as `ticket_count * ticket_price_cents`.
5. Request winning entropy from the RNG service with draw ID, ticket IDs, and a nonce.
6. Select the winning ticket by deterministic modulo over the sorted ticket list.
7. Calculate `company_amount = floor(pool * 15 / 100)` and `winner_amount = pool - company_amount`.
8. Insert settlement and two ledger entries in the same transaction.
9. Credit winner wallet and company master wallet.
10. Mark draw `SETTLED`, persist audit event, publish balance events.

### Tables and Constraints

| Table | Key Constraints |
| --- | --- |
| `wallets` | `CHECK (available_cents >= 0)`, optimistic `version` |
| `ledger_entries` | Append-only by policy and DB trigger; unique `idempotency_key` |
| `draws` | Status enum: `OPEN`, `PAUSED`, `FROZEN`, `SETTLED`, `VOID` |
| `settlements` | Unique `draw_id`; `company_amount_cents + winner_amount_cents = frozen_pool_cents` |
| `audit_events` | No update/delete privileges for app role |

### Security Controls

| Area | Control |
| --- | --- |
| CIAM | MFA via SMS/email, step-up auth for withdrawals and admin functions |
| PII | AES-256 encryption at rest, envelope keys in KMS, tokenized logs |
| PCI-DSS | Hosted payment fields, gateway tokenization, no raw PAN storage |
| Abuse | Redis velocity counters by user, device, card fingerprint, IP, and payout account |
| Admin | Least privilege roles, just-in-time elevation, immutable admin audit |

### Availability and Recovery

PostgreSQL uses multi-AZ deployment with point-in-time recovery. Redis uses clustered mode with replicas and conservative TTLs because it is a cache, not the ledger source of truth. Settlement jobs are idempotent and can be replayed using draw ID and settlement idempotency keys.
