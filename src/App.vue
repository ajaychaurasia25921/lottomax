<script setup>
import { computed, onMounted } from 'vue';
import { useLottoStore } from './stores/lottoStore';

const store = useLottoStore();

const statusText = computed(() => {
  const group = store.activeGroup;
  if (!group) return 'Select a group';
  if (group.status === 'OPEN') return `${group.size - group.players.length} funded seats left`;
  if (group.status === 'PICKING') return 'Funded group. Pick numbers to settle draw.';
  return `Winner: ${group.winnerName} · #${group.winnerNumber}`;
});

const payoutPreview = computed(() => {
  const pool = store.activeGroup?.escrowBalance || store.activeGroup?.prizePool || 0;
  const fee = Math.round(pool * 0.15);
  return {
    pool,
    fee,
    winner: pool - fee
  };
});

onMounted(() => {
  store.loadState();
});
</script>

<template>
  <main class="site-shell">
    <header class="topbar">
      <a class="brand" href="#home">
        <span>LM</span>
        <strong>LottoMax</strong>
      </a>
      <nav>
        <a href="#play">Play</a>
        <a href="#wallet">Wallet</a>
        <a href="#users">Users</a>
        <a href="#company">Company</a>
      </nav>
      <div class="wallet-pill">
        {{ store.user ? store.currency(store.wallet) : 'Sign in' }}
      </div>
    </header>

    <section id="home" class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Real-money wallet ledger</span>
        <h1>Fund wallet. Join a group. Win 85% of the pool.</h1>
        <p>
          LottoMax now uses backend-controlled users, payment orders, wallet ledger entries,
          draw escrow, and a company wallet. The winner receives the prize pool minus the
          15% platform fee credited to LottoMax.
        </p>
        <div class="hero-actions">
          <a class="primary" href="#wallet">Open Payment Portal</a>
          <a class="secondary" href="#play">Join Live Group</a>
        </div>
      </div>
      <aside class="hero-card">
        <span>COMPANY WALLET</span>
        <strong>{{ store.currency(store.companyWallet.balance) }}</strong>
        <p>15% platform revenue settles here after every completed draw.</p>
      </aside>
    </section>

    <section class="message-row" v-if="store.error || store.notice">
      <p v-if="store.error" class="error">{{ store.error }}</p>
      <p v-if="store.notice" class="notice">{{ store.notice }}</p>
    </section>

    <section class="stat-grid">
      <article><span>Total Prize Pools</span><strong>{{ store.currency(store.totalPrizePool) }}</strong></article>
      <article><span>Live Groups</span><strong>{{ store.openGroups.length }} Open</strong></article>
      <article><span>Your Wallet</span><strong>{{ store.currency(store.wallet) }}</strong></article>
    </section>

    <section class="account-grid">
      <article class="panel">
        <div class="section-title"><div><span>User Management</span><h2>Create player</h2></div></div>
        <form class="form-grid" @submit.prevent="store.register">
          <input v-model="store.authForm.name" placeholder="Full name" autocomplete="name" />
          <input v-model="store.authForm.email" placeholder="Email" autocomplete="email" />
          <input v-model="store.authForm.phone" placeholder="Phone" autocomplete="tel" />
          <input v-model="store.authForm.password" placeholder="Password" type="password" autocomplete="new-password" />
          <label class="check-row">
            <input v-model="store.authForm.ageConfirmed" type="checkbox" />
            <span>I confirm this player is 18+ and eligible to play.</span>
          </label>
          <button class="primary" :disabled="store.loading">Create account</button>
        </form>
      </article>

      <article class="panel">
        <div class="section-title"><div><span>Session</span><h2>Sign in</h2></div></div>
        <form class="form-grid" @submit.prevent="store.login">
          <input v-model="store.loginForm.email" placeholder="Email" autocomplete="email" />
          <input v-model="store.loginForm.password" placeholder="Password" type="password" autocomplete="current-password" />
          <button class="secondary-button" :disabled="store.loading">Sign in</button>
          <button class="ghost" type="button" @click="store.logout">Sign out</button>
        </form>
        <div v-if="store.user" class="identity-card">
          <strong>{{ store.user.name }}</strong>
          <span>{{ store.user.email }} · {{ store.user.kycStatus }} · {{ store.user.role }}</span>
        </div>
      </article>
    </section>

    <section id="wallet" class="dashboard-grid">
      <article class="panel">
        <div class="section-title"><div><span>Payment Portal</span><h2>Add real funds</h2></div></div>
        <form class="form-grid" @submit.prevent="store.createPaymentOrder">
          <input v-model.number="store.paymentForm.amount" min="100" step="50" type="number" placeholder="Amount" />
          <select v-model="store.paymentForm.method">
            <option>UPI</option>
            <option>Card</option>
            <option>NetBanking</option>
            <option>Wallet</option>
          </select>
          <button class="primary" :disabled="!store.user || store.loading">Create payment order</button>
        </form>
        <div v-if="store.pendingPayment" class="payment-order">
          <span>Provider order</span>
          <strong>{{ store.pendingPayment.id }}</strong>
          <p>
            Amount {{ store.currency(store.pendingPayment.amount) }} is pending provider confirmation.
            Paste the gateway payment reference after successful capture.
          </p>
          <form class="form-grid" @submit.prevent="store.confirmPayment">
            <input v-model="store.paymentForm.providerReference" placeholder="Gateway payment reference" />
            <button class="secondary-button" :disabled="store.loading">Verify and credit wallet</button>
          </form>
        </div>
      </article>

      <article class="panel">
        <div class="section-title"><div><span>Wallet Ledger</span><h2>Transactions</h2></div></div>
        <div class="txn-list">
          <article v-for="txn in store.transactions" :key="txn.id">
            <div><strong>{{ txn.note }}</strong><span>{{ new Date(txn.at).toLocaleString() }}</span></div>
            <b :class="txn.type.toLowerCase()">{{ txn.type === 'CREDIT' ? '+' : '-' }}{{ store.currency(txn.amount) }}</b>
          </article>
          <p v-if="!store.transactions.length" class="empty">No wallet transactions yet.</p>
        </div>
      </article>
    </section>

    <section v-if="store.activeGroup" id="play" class="play-layout">
      <section class="panel">
        <div class="section-title">
          <div>
            <span>Real-money groups</span>
            <h2>Live Groups</h2>
          </div>
        </div>
        <div class="group-list">
          <article
            v-for="group in store.groups"
            :key="group.id"
            :class="['group-card', { active: store.activeGroupId === group.id }]"
            @click="store.selectGroup(group.id)"
          >
            <div>
              <strong>{{ group.title }}</strong>
              <span>{{ group.players.length }}/{{ group.size }} players · {{ store.currency(group.entryFee) }} entry</span>
            </div>
            <b>{{ store.currency(group.prizePool) }}</b>
            <small>{{ group.status }}</small>
          </article>
        </div>
      </section>

      <section class="panel game-panel">
        <div class="section-title">
          <div>
            <span>Draw Room</span>
            <h2>{{ store.activeGroup?.title }}</h2>
          </div>
          <div class="status-pill">{{ statusText }}</div>
        </div>

        <div class="progress-line">
          <i :style="{ width: `${Math.min(100, (store.activeGroup.players.length / store.activeGroup.size) * 100)}%` }"></i>
        </div>

        <div class="payout-strip">
          <span>Escrow {{ store.currency(store.activeGroup.escrowBalance) }}</span>
          <span>Winner {{ store.currency(payoutPreview.winner) }}</span>
          <span>LottoMax fee {{ store.currency(payoutPreview.fee) }}</span>
        </div>

        <div class="game-actions">
          <button class="primary" :disabled="!store.user || store.activeGroup.status !== 'OPEN' || store.loading" @click="store.joinGroup(store.activeGroup.id)">Join with wallet</button>
          <button class="ghost" :disabled="!store.user || store.activeGroup.status === 'COMPLETED' || store.loading" @click="store.drawWinner(store.activeGroup.id)">Settle draw</button>
        </div>

        <div class="number-picker">
          <button
            v-for="item in store.availableNumbers"
            :key="item.number"
            :class="{ taken: item.taken && !item.mine, mine: item.mine }"
            :disabled="(item.taken && !item.mine) || !store.you || store.activeGroup.status === 'COMPLETED'"
            @click="store.pickNumber(item.number)"
          >
            {{ item.number }}
          </button>
        </div>

        <div class="player-grid">
          <article v-for="player in store.activeGroup.players" :key="player.userId" :class="{ you: player.userId === store.user?.id }">
            <strong>{{ player.name }}</strong>
            <span>{{ player.number ? `#${player.number}` : 'Awaiting pick' }}</span>
          </article>
          <p v-if="!store.activeGroup.players.length" class="empty">No funded players have joined yet.</p>
        </div>
      </section>
    </section>

    <section v-if="store.activeGroup" class="dashboard-grid">
      <article class="panel">
        <div class="section-title"><div><span>Draw Feed</span><h2>Settlement timeline</h2></div></div>
        <div class="log-list">
          <p v-for="entry in store.activeGroup.drawLog" :key="entry">{{ entry }}</p>
        </div>
      </article>
      <article id="company" class="panel">
        <div class="section-title"><div><span>Company Revenue</span><h2>LottoMax wallet</h2></div></div>
        <div class="company-card">
          <strong>{{ store.currency(store.companyWallet.balance) }}</strong>
          <span>Every completed draw credits 15% of escrow to the company wallet and 85% to the winning player.</span>
        </div>
      </article>
    </section>

    <section id="users" class="panel user-panel">
      <div class="section-title"><div><span>Users</span><h2>Registered players</h2></div></div>
      <div class="user-list">
        <article v-for="item in store.users" :key="item.id">
          <strong>{{ item.name }}</strong>
          <span>{{ item.email }}</span>
          <b>{{ store.currency(item.wallet.balance) }}</b>
        </article>
        <p v-if="!store.users.length" class="empty">Create the first player account to start.</p>
      </div>
    </section>

    <footer>
      <strong>Real-money mode requires licensed payment and gaming compliance.</strong>
      <p>
        Payment orders, provider references, wallet balances, escrow, 15% LottoMax revenue,
        and winner payouts are controlled by the backend. Play responsibly. Must be 18+.
      </p>
    </footer>
  </main>
</template>
