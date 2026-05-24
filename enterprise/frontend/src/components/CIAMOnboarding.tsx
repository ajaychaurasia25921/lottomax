"use client";

import { FormEvent, useState } from "react";
import { submitMfaOnboarding } from "@/lib/api";
import type { OnboardingState } from "@/types/wallet";

export function CIAMOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    email: "",
    phone: "",
    mfaChannel: "sms",
    kycStatus: "not_started"
  });
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await submitMfaOnboarding(state);
    setState(result);
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 rounded-md border border-zinc-300 bg-white p-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">CIAM onboarding</p>
        <h1 className="text-2xl font-semibold text-zinc-950">Secure wallet access</h1>
      </div>
      <label className="block text-sm font-medium text-zinc-800">
        Email
        <input className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2" value={state.email} onChange={(event) => setState({ ...state, email: event.target.value })} type="email" required />
      </label>
      <label className="block text-sm font-medium text-zinc-800">
        Phone
        <input className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2" value={state.phone} onChange={(event) => setState({ ...state, phone: event.target.value })} type="tel" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(["sms", "email"] as const).map((channel) => (
          <button key={channel} type="button" onClick={() => setState({ ...state, mfaChannel: channel })} className={`rounded-md border px-3 py-2 text-sm font-semibold ${state.mfaChannel === channel ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-zinc-300"}`}>
            MFA by {channel.toUpperCase()}
          </button>
        ))}
      </div>
      <button disabled={saving} className="w-full rounded-md bg-zinc-950 px-4 py-2 font-semibold text-white disabled:opacity-60">
        {saving ? "Starting verification" : "Continue to KYC"}
      </button>
      <p className="text-sm text-zinc-700">KYC status: {state.kycStatus}</p>
    </form>
  );
}
