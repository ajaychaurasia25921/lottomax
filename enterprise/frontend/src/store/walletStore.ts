"use client";

import { create } from "zustand";
import { captureDeposit, fetchWalletBalance, requestWithdrawal } from "@/lib/api";
import type { WalletBalance, WalletTransaction, WithdrawalDecision } from "@/types/wallet";

type WalletStore = {
  balance: WalletBalance | null;
  transactions: WalletTransaction[];
  loading: boolean;
  lastWithdrawalDecision: WithdrawalDecision | null;
  refreshBalance: () => Promise<void>;
  deposit: (amountCents: number) => Promise<void>;
  withdraw: (amountCents: number) => Promise<void>;
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: null,
  transactions: [],
  loading: false,
  lastWithdrawalDecision: null,
  refreshBalance: async () => {
    set({ loading: true });
    const balance = await fetchWalletBalance();
    set({ balance, loading: false });
  },
  deposit: async (amountCents) => {
    set({ loading: true });
    const transaction = await captureDeposit(amountCents);
    const current = get().balance;
    set({
      loading: false,
      transactions: [transaction, ...get().transactions],
      balance: current
        ? {
            ...current,
            available: { ...current.available, cents: current.available.cents + amountCents },
            updatedAt: new Date().toISOString()
          }
        : current
    });
  },
  withdraw: async (amountCents) => {
    set({ loading: true });
    const decision = await requestWithdrawal(amountCents);
    const transaction: WalletTransaction = {
      id: crypto.randomUUID(),
      direction: "DEBIT",
      amount: { cents: amountCents, currency: "USD" },
      reason: "WITHDRAWAL",
      status: decision.status === "INSTANT_PROCESSING" ? "PENDING" : "REVIEW",
      createdAt: new Date().toISOString()
    };
    set({
      loading: false,
      lastWithdrawalDecision: decision,
      transactions: [transaction, ...get().transactions]
    });
  }
}));
