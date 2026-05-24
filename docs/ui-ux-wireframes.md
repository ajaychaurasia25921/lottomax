# LottoMax UI/UX Prototype Mockups

## Design System

| Token | Value | Usage |
| --- | --- | --- |
| Primary | Emerald | Positive wallet state, successful capture, payout complete |
| Risk | Rose | Velocity abuse, failed KYC, low liquidity |
| Warning | Amber | Manual review, pending capture, threshold alerts |
| Neutral | Zinc | Text, borders, dense dashboard surfaces |
| Font | Inter | Product UI and operational dashboards |

## `tailwind.config.js`

```js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,vue}", "./enterprise/frontend/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          900: "#064e3b"
        },
        risk: {
          50: "#fff1f2",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c"
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706"
        },
        ink: {
          50: "#fafafa",
          100: "#f4f4f5",
          300: "#d4d4d8",
          700: "#3f3f46",
          900: "#18181b"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(16, 185, 129, 0.25)"
      }
    }
  },
  plugins: []
};
```

## User Wallet Dashboard Wireframe

```html
<main class="min-h-screen bg-ink-50 text-ink-900">
  <section class="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr]">
    <div class="space-y-6">
      <header class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-brand-700">Verified wallet</p>
          <h1 class="text-2xl font-semibold">Balance $8,420.25</h1>
        </div>
        <button class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-focus">Deposit</button>
      </header>
      <section class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-md border border-ink-300 bg-white p-4">
          <p class="text-xs text-ink-700">Available</p>
          <p class="mt-2 text-xl font-semibold">$8,420.25</p>
        </div>
        <div class="rounded-md border border-ink-300 bg-white p-4">
          <p class="text-xs text-ink-700">Pending withdrawals</p>
          <p class="mt-2 text-xl font-semibold">$1,250.00</p>
        </div>
        <div class="rounded-md border border-warning-500 bg-warning-50 p-4">
          <p class="text-xs text-warning-600">Review threshold</p>
          <p class="mt-2 text-xl font-semibold">$5,000</p>
        </div>
      </section>
      <section class="rounded-md border border-ink-300 bg-white">
        <div class="border-b border-ink-300 px-4 py-3 font-semibold">Recent wallet activity</div>
        <div class="divide-y divide-ink-100">
          <div class="flex items-center justify-between px-4 py-3">
            <span>Gateway capture</span><span class="font-mono text-brand-700">+$500.00</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3">
            <span>Ticket purchase</span><span class="font-mono text-risk-600">-$20.00</span>
          </div>
          <div class="flex items-center justify-between px-4 py-3">
            <span>Winner payout</span><span class="font-mono text-brand-700">+$1,700.00</span>
          </div>
        </div>
      </section>
    </div>
    <aside class="space-y-4">
      <section class="rounded-md border border-risk-500 bg-risk-50 p-4">
        <p class="text-sm font-semibold text-risk-700">Velocity alert</p>
        <p class="mt-2 text-sm">Three deposit attempts from two devices in 4 minutes. Step-up MFA required.</p>
      </section>
      <section class="rounded-md border border-ink-300 bg-white p-4">
        <p class="font-semibold">Withdrawal</p>
        <input class="mt-3 w-full rounded-md border border-ink-300 px-3 py-2" value="$4,999.00" />
        <button class="mt-3 w-full rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white">Request instant payout</button>
      </section>
    </aside>
  </section>
</main>
```

## Admin Financial Risk Dashboard Wireframe

```html
<main class="min-h-screen bg-white text-ink-900">
  <header class="border-b border-ink-300 px-6 py-4">
    <h1 class="text-xl font-semibold">Financial Risk Dashboard</h1>
  </header>
  <section class="grid gap-4 px-6 py-6 md:grid-cols-4">
    <div class="rounded-md border border-ink-300 p-4"><p class="text-xs">Ticket sales</p><p class="text-2xl font-semibold">$128,420</p></div>
    <div class="rounded-md border border-ink-300 p-4"><p class="text-xs">Hot wallet liquidity</p><p class="text-2xl font-semibold">42%</p></div>
    <div class="rounded-md border border-risk-500 bg-risk-50 p-4"><p class="text-xs text-risk-700">Velocity alerts</p><p class="text-2xl font-semibold">17</p></div>
    <div class="rounded-md border border-warning-500 bg-warning-50 p-4"><p class="text-xs text-warning-600">Manual reviews</p><p class="text-2xl font-semibold">9</p></div>
  </section>
  <section class="grid gap-6 px-6 pb-8 lg:grid-cols-[1fr_1fr]">
    <div class="rounded-md border border-ink-300">
      <div class="flex items-center justify-between border-b border-ink-300 px-4 py-3">
        <p class="font-semibold">Broad groups</p>
        <button class="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Create group</button>
      </div>
      <div class="divide-y divide-ink-100">
        <div class="flex items-center justify-between px-4 py-3"><span>Prime 20</span><button class="rounded-md border border-warning-500 px-3 py-1 text-sm">Pause</button></div>
        <div class="flex items-center justify-between px-4 py-3"><span>Fast 10</span><button class="rounded-md border border-brand-500 px-3 py-1 text-sm">Resume</button></div>
      </div>
    </div>
    <div class="rounded-md border border-risk-500">
      <div class="border-b border-risk-500 bg-risk-50 px-4 py-3 font-semibold text-risk-700">Real-time velocity abuse</div>
      <div class="divide-y divide-ink-100">
        <div class="px-4 py-3"><p class="font-medium">IP burst on deposits</p><p class="text-sm text-ink-700">12 attempts, 5 users, same device fingerprint</p></div>
        <div class="px-4 py-3"><p class="font-medium">Withdrawal routing anomaly</p><p class="text-sm text-ink-700">4 payout accounts added after winner settlement</p></div>
      </div>
    </div>
  </section>
</main>
```
