<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLottoStore } from './stores/lottoStore';

const store = useLottoStore();
const now = ref(Date.now());
let timer;

const countdown = computed(() => {
  const group = store.activeGroup;
  if (!group) return '00:00';
  const target = group.status === 'PICKING' ? group.pickEndsAt : group.status === 'GRACE' ? group.graceEndsAt : null;
  if (!target) return '00:00';
  const remaining = Math.max(0, Math.ceil((target - now.value) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

const statusText = computed(() => {
  const group = store.activeGroup;
  if (!group) return 'Select a group';
  if (group.status === 'OPEN') return `${group.size - group.players.length} seats left`;
  if (group.status === 'PICKING') return `Pick phase ends in ${countdown.value}`;
  if (group.status === 'GRACE') return `Grace period ends in ${countdown.value}`;
  return `Winner: ${group.winnerName} · #${group.winnerNumber}`;
});

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
    store.advanceClock();
  }, 1000);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
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
        <a href="#how">How It Works</a>
        <a href="#play">Play Now</a>
        <a href="#wallet">Wallet</a>
      </nav>
      <div class="wallet-pill">{{ store.currency(store.wallet) }}</div>
    </header>

    <section id="home" class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Instant Draws. Real Winners.</span>
        <h1>Pick a Number. Win Instantly.</h1>
        <p>
          Join a group, pick your lucky number, and watch the live draw unfold.
          When the group fills up, the draw starts automatically. No waiting, no schedules.
        </p>
        <div class="hero-actions">
          <a class="primary" href="#play">Start Playing Now</a>
          <a class="secondary" href="#how">How It Works</a>
        </div>
      </div>
      <aside class="hero-card">
        <span>LIVE GROUPS</span>
        <strong>{{ store.openGroups.length }} Open</strong>
        <p>Groups waiting for players</p>
      </aside>
    </section>

    <section class="stat-grid">
      <article><span>Total Prize Pools</span><strong>{{ store.currency(store.totalPrizePool) }}</strong></article>
      <article><span>Group Sizes</span><strong>{{ store.groupSizes }}</strong></article>
      <article><span>Wallet Balance</span><strong>{{ store.currency(store.wallet) }}</strong></article>
    </section>

    <section id="play" class="play-layout">
      <section class="panel">
        <div class="section-title">
          <div>
            <span>Join a Group Now</span>
            <h2>Live Groups</h2>
          </div>
          <button class="ghost" @click="store.resetCompleted">Reset Completed</button>
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
            <span>Live Draw Room</span>
            <h2>{{ store.activeGroup.title }}</h2>
          </div>
          <div class="status-pill">{{ statusText }}</div>
        </div>

        <div class="progress-line">
          <i :style="{ width: `${Math.min(100, (store.activeGroup.players.length / store.activeGroup.size) * 100)}%` }"></i>
        </div>

        <div class="game-actions">
          <button class="primary" :disabled="store.activeGroup.status !== 'OPEN'" @click="store.joinGroup(store.activeGroup.id)">Join Group</button>
          <button class="secondary-button" :disabled="store.activeGroup.status !== 'OPEN'" @click="store.autoFillGroup(store.activeGroup.id)">Auto Fill Demo</button>
          <button class="ghost" :disabled="!['PICKING', 'GRACE'].includes(store.activeGroup.status)" @click="store.drawWinner(store.activeGroup.id)">Draw Now</button>
        </div>

        <div class="number-picker">
          <button
            v-for="item in store.availableNumbers"
            :key="item.number"
            :class="{ taken: item.taken && !item.mine, mine: item.mine }"
            :disabled="item.taken && !item.mine"
            @click="store.pickNumber(item.number)"
          >
            {{ item.number }}
          </button>
        </div>

        <div class="player-grid">
          <article v-for="player in store.activeGroup.players" :key="player.id" :class="{ you: player.isYou }">
            <strong>{{ player.name }}</strong>
            <span>{{ player.number ? `#${player.number}` : 'Choosing...' }}</span>
          </article>
        </div>
      </section>
    </section>

    <section id="how" class="how-section">
      <div class="section-title centered">
        <span>How It Works</span>
        <h2>Four simple steps to win big</h2>
      </div>
      <div class="steps">
        <article><span>STEP 01</span><strong>Join a Group</strong><p>Pick a 5, 10, 15, or 20 player group and pay the entry fee from your wallet.</p></article>
        <article><span>STEP 02</span><strong>Pick Your Number</strong><p>When the group fills, you get 2 minutes to pick a unique number card.</p></article>
        <article><span>STEP 03</span><strong>30s Grace Period</strong><p>A 30-second grace period lets you change your number before the draw.</p></article>
        <article><span>STEP 04</span><strong>Watch & Win</strong><p>All chosen numbers are shuffled live. One card is drawn. Winner takes the prize pool.</p></article>
      </div>
    </section>

    <section class="feature-grid">
      <article><strong>Instant Draws</strong><span>No scheduled wait. Draws start when your group fills.</span></article>
      <article><strong>Fair & Transparent</strong><span>The winner is drawn from actual numbers selected by players.</span></article>
      <article><strong>Instant Payouts</strong><span>Win and get credited to your wallet immediately.</span></article>
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="section-title"><div><span>Draw Feed</span><h2>Live Timeline</h2></div></div>
        <div class="log-list">
          <p v-for="entry in store.activeGroup.drawLog" :key="entry">{{ entry }}</p>
        </div>
      </article>
      <article id="wallet" class="panel">
        <div class="section-title"><div><span>Wallet</span><h2>Transactions</h2></div></div>
        <div class="txn-list">
          <article v-for="txn in store.transactions" :key="txn.id">
            <div><strong>{{ txn.note }}</strong><span>{{ new Date(txn.at).toLocaleString() }}</span></div>
            <b :class="txn.type.toLowerCase()">{{ txn.type === 'CREDIT' ? '+' : '-' }}{{ store.currency(txn.amount) }}</b>
          </article>
        </div>
      </article>
    </section>

    <footer>
      <strong>Ready to Win?</strong>
      <p>Join a group, pick your number, and watch the draw unfold live. Play responsibly. Must be 18+ to participate.</p>
    </footer>
  </main>
</template>
