import type { OnboardingState, WalletBalance, WalletTransaction, WithdrawalDecision } from "@/types/wallet";

const now = () => new Date().toISOString();

export async function submitMfaOnboarding(input: OnboardingState): Promise<OnboardingState> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { ...input, kycStatus: "pending" };
}

export async function fetchWalletBalance(): Promise<WalletBalance> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return {
    available: { cents: 842025, currency: "USD" },
    held: { cents: 125000, currency: "USD" },
    updatedAt: now()
  };
}

export async function captureDeposit(amountCents: number): Promise<WalletTransaction> {
  if (amountCents <= 0) {
    throw new Error("Deposit amount must be positive");
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    id: crypto.randomUUID(),
    direction: "CREDIT",
    amount: { cents: amountCents, currency: "USD" },
    reason: "DEPOSIT_CAPTURED",
    status: "POSTED",
    createdAt: now()
  };
}

export async function requestWithdrawal(amountCents: number): Promise<WithdrawalDecision> {
  if (amountCents <= 0) {
    throw new Error("Withdrawal amount must be positive");
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (amountCents < 500000) {
    return { status: "INSTANT_PROCESSING", reason: "Amount is under $5,000 and risk checks passed" };
  }
  return { status: "MANUAL_REVIEW", reason: "Withdrawals of $5,000 or more require operator clearance" };
}
