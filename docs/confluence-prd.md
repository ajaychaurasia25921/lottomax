# LottoMax Confluence PRD

## Product Summary

LottoMax enables verified users to fund a wallet, join lottery broad groups, receive real-time settlement, and withdraw winnings. The financial engine routes 15% of each settled pot to the Company Master Wallet and 85% to the winning user without manual intervention.

## Goals

| Goal | Metric |
| --- | --- |
| Reduce onboarding abandonment | 80% KYC completion within first session |
| Preserve financial correctness | Zero wallet balance drift between ledger and wallet projection |
| Accelerate payouts | Instant automated withdrawals under $5,000 when risk checks pass |
| Detect abuse | Real-time velocity alerts within 5 seconds |

## User Journey

| Step | User Action | System Behavior | Acceptance Criteria |
| --- | --- | --- | --- |
| Sign up | User enters email and phone | CIAM creates identity and requires MFA via SMS/email | MFA challenge is mandatory before wallet access |
| Verify identity | User submits KYC data | KYC/AML provider screens identity, sanctions, and PEP status | User cannot deposit until KYC status is approved or conditionally approved |
| Deposit | User selects amount and payment method | Gateway tokenizes payment and sends signed capture webhook | Balance updates only after verified capture |
| Buy ticket | User selects broad group and number set | Wallet debits ticket price and group pool increases | Ticket purchase is idempotent and creates a ledger debit |
| Draw settlement | Draw closes | Engine freezes pool, calls RNG, credits winner 85%, master wallet 15% | Settlement records are immutable and tied to draw ID |
| Withdrawal | User requests payout | Risk checks KYC, AML, velocity, and threshold | Under $5,000 clears instantly when checks pass; otherwise manual review |

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Support Auth0 or AWS Cognito identity integration with MFA claims | P0 |
| FR-2 | Persist wallet balance through append-only ledger entries | P0 |
| FR-3 | Freeze pool before selecting a winner | P0 |
| FR-4 | Route 15% to Company Master Wallet and 85% to winner | P0 |
| FR-5 | Allow admins to create, pause, and resume broad groups | P0 |
| FR-6 | Show ticket sales and hot wallet liquidity in admin dashboard | P1 |
| FR-7 | Trigger real-time alerts for velocity abuse | P0 |

## Compliance Requirements

| Area | Requirement |
| --- | --- |
| PCI-DSS | Payment data is handled through hosted fields or gateway tokens; LottoMax never stores PAN or CVV |
| PII Encryption | PII is encrypted with AES-256 using envelope encryption and KMS-managed keys |
| Audit | Every admin and settlement action records timestamp, IP, actor ID, action, and payload hash |
| AML | Deposits, withdrawals, and cumulative activity are screened for suspicious activity |

## Acceptance Criteria

| Scenario | Given | When | Then |
| --- | --- | --- | --- |
| MFA onboarding | A new user signs up | Email and phone are submitted | SMS/email MFA challenge is required |
| Captured deposit | Gateway sends signed webhook | Signature and idempotency key are valid | Wallet balance increases and ledger credit is appended |
| Failed deposit | Gateway webhook is invalid | Wallet service validates signature | No wallet balance mutation occurs |
| Draw settlement | A draw has sold tickets | Admin or scheduler closes draw | Pool freezes and payout split is exactly 15%/85% in cents |
| Instant withdrawal | Verified user withdraws $4,999.99 | Risk score is low | Payout is submitted automatically |
| Reviewed withdrawal | User withdraws $5,000 or more | Request is submitted | Withdrawal enters manual review queue |

## Non-Functional Requirements

| Category | Target |
| --- | --- |
| Availability | 99.95% for wallet and draw APIs |
| RPO/RTO | RPO under 5 minutes, RTO under 30 minutes |
| Latency | p95 wallet reads under 150 ms; p95 ticket purchase under 400 ms |
| Observability | Structured logs, traces, metrics, settlement reconciliation dashboards |
