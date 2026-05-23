<script setup>
import { computed, onMounted } from 'vue';
import { useLottoStore } from './stores/lottoStore';

const store = useLottoStore();

const totalEscrow = computed(() => store.groups.reduce((sum, group) => sum + group.escrowBalance, 0));
const activeGroup = computed(() => store.activeGroup);
const payoutPreview = computed(() => {
  const pool = activeGroup.value?.escrowBalance || activeGroup.value?.prizePool || 0;
  const fee = Math.round(pool * 0.15);
  return { pool, fee, winner: pool - fee };
});

const steps = [
  ['STEP 01', 'Join a Group', 'Pick a 5, 10, 15, or 20 player group and pay the entry fee from your wallet.', 'users'],
  ['STEP 02', 'Pick Your Number', 'When the group fills, you get 2 minutes to pick a unique number card.', 'target'],
  ['STEP 03', '30s Grace Period', 'A 30-second grace period lets you change your number before the draw.', 'clock'],
  ['STEP 04', 'Watch & Win', 'All chosen numbers are shuffled live. One card is drawn. Winner takes the prize pool!', 'trophy']
];

const features = [
  ['bolt', 'Instant Draws', 'No waiting for scheduled times. Draws start the moment your group fills up.'],
  ['shield', 'Fair & Transparent', 'The winner is drawn from the actual numbers chosen by players. No hidden algorithms.'],
  ['trend', 'Instant Payouts', 'Win and get paid instantly to your wallet after backend settlement.']
];

onMounted(() => {
  store.loadState();
});
</script>

<template>
  <main class="page">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="LottoMax home">
        <span class="brand-mark">L</span>
        <strong>LottoMax</strong>
      </a>
      <nav>
        <a href="#how">How It Works</a>
        <a class="nav-cta" href="#play">Play Now</a>
      </nav>
    </header>

    <section id="home" class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><i>+</i> Instant Draws. Real Winners.</span>
        <h1>Pick a Number. <span>Win Instantly.</span></h1>
        <p>
          Join a group, pick your lucky number, and watch the live draw unfold.
          When the group fills up, the draw starts automatically. No waiting, no schedules.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#play">Start Playing Now <b>-></b></a>
          <a class="button secondary" href="#how">How It Works</a>
        </div>
      </div>

      <aside class="live-card">
        <div class="live-card-top">
          <span>LIVE GROUPS</span>
          <strong>5 Open</strong>
          <p>Groups waiting for players</p>
        </div>
        <div class="mini-stats">
          <article>
            <span>Total Prize Pools</span>
            <strong>₹18,50,500</strong>
          </article>
          <article>
            <span>Group Sizes</span>
            <strong>5-20</strong>
          </article>
        </div>
        <a class="button join-button" href="#play">Join a Group Now</a>
      </aside>
    </section>

    <section id="how" class="how">
      <div class="section-heading">
        <h2>How It Works</h2>
        <p>Four simple steps to win big</p>
      </div>
      <div class="steps">
        <article v-for="step in steps" :key="step[0]" :class="['step-card', step[3]]">
          <div>
            <span>{{ step[0] }}</span>
            <strong>{{ step[1] }}</strong>
            <p>{{ step[2] }}</p>
          </div>
          <b>{{ step[3] === 'users' ? 'oo' : step[3] === 'target' ? '@' : step[3] === 'clock' ? 'o' : 'Y' }}</b>
        </article>
      </div>
    </section>

    <section class="feature-grid">
      <article v-for="feature in features" :key="feature[1]" :class="feature[0]">
        <b>{{ feature[0] === 'bolt' ? 'Z' : feature[0] === 'shield' ? 'S' : '/' }}</b>
        <strong>{{ feature[1] }}</strong>
        <p>{{ feature[2] }}</p>
      </article>
    </section>

    <section class="proof-strip">
      <article><strong>Instant</strong><span>Draw When Full</span></article>
      <article><strong>5-20</strong><span>Players Per Group</span></article>
      <article><strong>100%</strong><span>Fair & Transparent</span></article>
    </section>

    <section class="cta-band">
      <h2>Ready to Win?</h2>
      <p>Join a group, pick your number, and watch the draw unfold live. Your next win is just one game away.</p>
      <a class="button cta-button" href="#play">Start Playing Now</a>
    </section>

    <section id="play" class="play-console">
      <div class="section-heading">
        <h2>Play Now</h2>
        <p>Real-money wallet, payment portal, escrow, and 15% LottoMax platform settlement.</p>
      </div>

      <div v-if="store.error || store.notice" class="message-row">
        <p v-if="store.error" class="error">{{ store.error }}</p>
        <p v-if="store.notice" class="notice">{{ store.notice }}</p>
      </div>

      <div class="console-grid">
        <article class="glass-panel">
          <span>User Management</span>
          <h3>{{ store.user ? store.user.name : 'Create player' }}</h3>
          <form v-if="!store.user" class="form-grid" @submit.prevent="store.register">
            <input v-model="store.authForm.name" placeholder="Full name" />
            <input v-model="store.authForm.email" placeholder="Email" />
            <input v-model="store.authForm.phone" placeholder="Phone" />
            <input v-model="store.authForm.password" type="password" placeholder="Password" />
            <label><input v-model="store.authForm.ageConfirmed" type="checkbox" /> I confirm this player is 18+</label>
            <button class="button primary" :disabled="store.loading">Create account</button>
          </form>
          <form v-else class="form-grid compact" @submit.prevent="store.logout">
            <p>{{ store.user.email }} · {{ store.user.kycStatus }} · {{ store.user.role }}</p>
            <button class="button secondary" type="submit">Sign out</button>
          </form>
        </article>

        <article class="glass-panel">
          <span>Payment Portal</span>
          <h3>{{ store.currency(store.wallet) }}</h3>
          <form class="form-grid" @submit.prevent="store.createPaymentOrder">
            <input v-model.number="store.paymentForm.amount" min="100" step="50" type="number" placeholder="Amount" />
            <select v-model="store.paymentForm.method">
              <option>UPI</option>
              <option>Card</option>
              <option>NetBanking</option>
              <option>Wallet</option>
            </select>
            <button class="button primary" :disabled="!store.user || store.loading">Create payment order</button>
          </form>
          <form v-if="store.pendingPayment" class="form-grid confirm" @submit.prevent="store.confirmPayment">
            <small>Order {{ store.pendingPayment.id }} · {{ store.currency(store.pendingPayment.amount) }}</small>
            <div class="qr-payment">
              <img :src="store.pendingPayment.qrCodeUrl" alt="UPI payment QR code" />
              <div>
                <strong>Scan and pay</strong>
                <span>{{ store.pendingPayment.upiPayee }}</span>
                <a :href="store.pendingPayment.upiPayload">Open UPI app</a>
              </div>
            </div>
            <input v-model="store.paymentForm.providerReference" placeholder="Gateway payment reference" />
            <button class="button secondary" :disabled="store.loading">Verify and credit wallet</button>
          </form>
        </article>
      </div>

      <div class="game-layout" v-if="activeGroup">
        <section class="glass-panel groups-panel">
          <span>Live Groups</span>
          <h3>Join a Group Now</h3>
          <div class="group-list">
            <button
              v-for="group in store.groups"
              :key="group.id"
              :class="{ active: store.activeGroupId === group.id }"
              @click="store.selectGroup(group.id)"
            >
              <strong>{{ group.title }}</strong>
              <span>{{ group.players.length }}/{{ group.size }} players · {{ store.currency(group.entryFee) }}</span>
              <b>{{ group.status }}</b>
            </button>
          </div>
        </section>

        <section class="glass-panel draw-panel">
          <span>Live Draw Room</span>
          <h3>{{ activeGroup.title }}</h3>
          <div class="draw-stats">
            <article><span>Escrow</span><b>{{ store.currency(activeGroup.escrowBalance) }}</b></article>
            <article><span>Winner</span><b>{{ store.currency(payoutPreview.winner) }}</b></article>
            <article><span>LottoMax</span><b>{{ store.currency(payoutPreview.fee) }}</b></article>
          </div>
          <div class="draw-actions">
            <button class="button primary" :disabled="!store.user || activeGroup.status !== 'OPEN' || store.loading" @click="store.joinGroup(activeGroup.id)">Join with wallet</button>
            <button class="button secondary" :disabled="!store.user || activeGroup.status === 'COMPLETED' || store.loading" @click="store.drawWinner(activeGroup.id)">Settle draw</button>
          </div>
          <div class="number-grid">
            <button
              v-for="item in store.availableNumbers"
              :key="item.number"
              :class="{ taken: item.taken && !item.mine, mine: item.mine }"
              :disabled="(item.taken && !item.mine) || !store.you || activeGroup.status === 'COMPLETED'"
              @click="store.pickNumber(item.number)"
            >
              {{ item.number }}
            </button>
          </div>
        </section>
      </div>

      <div class="ledger-grid">
        <article class="glass-panel">
          <span>Company Wallet</span>
          <h3>{{ store.currency(store.companyWallet.balance) }}</h3>
          <p>LottoMax receives 15% of settled escrow. Current active escrow is {{ store.currency(totalEscrow) }}.</p>
        </article>
        <article class="glass-panel">
          <span>Wallet Ledger</span>
          <h3>Transactions</h3>
          <div class="ledger-list">
            <p v-for="txn in store.transactions" :key="txn.id">
              <strong>{{ txn.note }}</strong>
              <b :class="txn.type.toLowerCase()">{{ txn.type === 'CREDIT' ? '+' : '-' }}{{ store.currency(txn.amount) }}</b>
            </p>
            <small v-if="!store.transactions.length">No wallet transactions yet.</small>
          </div>
        </article>
      </div>
    </section>

    <footer class="footer">
      <a class="brand" href="#home">
        <span class="brand-mark">L</span>
        <strong>LottoMax</strong>
      </a>
      <nav>
        <a href="#how">How It Works</a>
        <a class="nav-cta" href="#play">Play Now</a>
      </nav>
    </footer>
  </main>
</template>
