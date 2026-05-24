"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function Wallet() {
  const wallet = useWallet();
  const [depositCents, setDepositCents] = useState(50000);
  const [withdrawCents, setWithdrawCents] = useState(499900);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Real-time wallet</p>
              <h1 className="text-3xl font-semibold">{wallet.balance ? formatMoney(wallet.balance.available.cents) : "Loading"}</h1>
            </div>
            <button onClick={() => void wallet.refreshBalance()} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold">Refresh</button>
          </header>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-zinc-300 bg-white p-4">
              <p className="text-xs text-zinc-600">Available</p>
              <p className="mt-2 text-xl font-semibold">{wallet.balance ? formatMoney(wallet.balance.available.cents) : "..."}</p>
            </div>
            <div className="rounded-md border border-zinc-300 bg-white p-4">
              <p className="text-xs text-zinc-600">Held</p>
              <p className="mt-2 text-xl font-semibold">{wallet.balance ? formatMoney(wallet.balance.held.cents) : "..."}</p>
            </div>
            <div className="rounded-md border border-rose-500 bg-rose-50 p-4">
              <p className="text-xs text-rose-700">Velocity alert</p>
              <p className="mt-2 text-sm font-medium">Step-up MFA after rapid funding attempts</p>
            </div>
          </section>
          <section className="rounded-md border border-zinc-300 bg-white">
            <div className="border-b border-zinc-300 px-4 py-3 font-semibold">Transactions</div>
            {wallet.transactions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-600">No session transactions yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {wallet.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between px-4 py-3">
                    <span>{transaction.reason}</span>
                    <span className={transaction.direction === "CREDIT" ? "text-emerald-700" : "text-rose-700"}>{transaction.direction === "CREDIT" ? "+" : "-"}{formatMoney(transaction.amount.cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <section className="rounded-md border border-zinc-300 bg-white p-4">
            <p className="font-semibold">Gateway capture</p>
            <input className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2" type="number" value={depositCents / 100} onChange={(event) => setDepositCents(Math.round(Number(event.target.value) * 100))} />
            <button onClick={() => void wallet.deposit(depositCents)} className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white">Mock capture deposit</button>
          </section>
          <section className="rounded-md border border-zinc-300 bg-white p-4">
            <p className="font-semibold">Withdrawal clearance</p>
            <input className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2" type="number" value={withdrawCents / 100} onChange={(event) => setWithdrawCents(Math.round(Number(event.target.value) * 100))} />
            <button onClick={() => void wallet.withdraw(withdrawCents)} className="mt-3 w-full rounded-md bg-zinc-950 px-4 py-2 font-semibold text-white">Request withdrawal</button>
            {wallet.lastWithdrawalDecision && <p className="mt-3 text-sm text-zinc-700">{wallet.lastWithdrawalDecision.reason}</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}
