"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";

export function useWallet() {
  const wallet = useWalletStore();

  useEffect(() => {
    if (!wallet.balance && !wallet.loading) {
      void wallet.refreshBalance();
    }
  }, [wallet]);

  return wallet;
}
