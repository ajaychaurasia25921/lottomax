CREATE TABLE users (
  id uuid PRIMARY KEY,
  ciam_subject text NOT NULL UNIQUE,
  email text NOT NULL,
  phone text NOT NULL,
  kyc_status text NOT NULL CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  available_cents bigint NOT NULL CHECK (available_cents >= 0),
  held_cents bigint NOT NULL CHECK (held_cents >= 0),
  currency char(3) NOT NULL,
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE broad_groups (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN', 'PAUSED', 'FROZEN', 'SETTLED', 'VOID')),
  max_players integer NOT NULL CHECK (max_players > 0),
  ticket_price_cents bigint NOT NULL CHECK (ticket_price_cents > 0),
  currency char(3) NOT NULL
);

CREATE TABLE draws (
  id uuid PRIMARY KEY,
  broad_group_id uuid NOT NULL REFERENCES broad_groups(id),
  status text NOT NULL CHECK (status IN ('OPEN', 'PAUSED', 'FROZEN', 'SETTLED', 'VOID')),
  frozen_pool_cents bigint NOT NULL DEFAULT 0 CHECK (frozen_pool_cents >= 0),
  winning_ticket_id uuid,
  closed_at timestamptz
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  draw_id uuid NOT NULL REFERENCES draws(id),
  number_set jsonb NOT NULL,
  price_cents bigint NOT NULL CHECK (price_cents > 0),
  idempotency_key text NOT NULL UNIQUE,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settlements (
  id uuid PRIMARY KEY,
  draw_id uuid NOT NULL UNIQUE REFERENCES draws(id),
  winner_user_id uuid NOT NULL REFERENCES users(id),
  winner_ticket_id uuid NOT NULL REFERENCES tickets(id),
  company_amount_cents bigint NOT NULL CHECK (company_amount_cents >= 0),
  winner_amount_cents bigint NOT NULL CHECK (winner_amount_cents >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('POSTED', 'REVERSED')),
  settled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  settlement_id uuid REFERENCES settlements(id),
  direction text NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload_hash bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY,
  ciam_subject text NOT NULL UNIQUE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  admin_user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  source_ip inet NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION reject_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_no_update
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
