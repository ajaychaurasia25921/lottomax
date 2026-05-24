export type Money = {
  cents: number;
  currency: "USD" | "CAD";
};

export type WalletBalance = {
  available: Money;
  held: Money;
  updatedAt: string;
};

export type WalletTransaction = {
  id: string;
  direction: "CREDIT" | "DEBIT";
  amount: Money;
  reason: "DEPOSIT_CAPTURED" | "TICKET_PURCHASE" | "WINNER_PAYOUT" | "WITHDRAWAL";
  status: "PENDING" | "POSTED" | "REVIEW" | "FAILED";
  createdAt: string;
};

export type WithdrawalDecision = {
  status: "INSTANT_PROCESSING" | "MANUAL_REVIEW";
  reason: string;
};

export type OnboardingState = {
  email: string;
  phone: string;
  mfaChannel: "sms" | "email";
  kycStatus: "not_started" | "pending" | "approved" | "rejected";
};
