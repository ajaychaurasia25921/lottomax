<script setup>
import { computed } from 'vue';
import { useLottoStore } from './stores/lottoStore';
import NumberBall from './components/NumberBall.vue';
import TicketBuilder from './components/TicketBuilder.vue';

const store = useLottoStore();
const topNumbers = computed(() => store.frequency.slice(0, 10));
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span>LM</span>
        <div>
          <h1>LottoMax</h1>
          <p>Draw intelligence workspace</p>
        </div>
      </div>
      <nav>
        <a href="#dashboard">Dashboard</a>
        <a href="#tickets">Tickets</a>
        <a href="#analytics">Analytics</a>
      </nav>
      <button @click="store.simulateDraw()">Simulate Draw</button>
    </aside>

    <section class="workspace" id="dashboard">
      <header class="hero">
        <div>
          <span class="eyebrow">LottoMax</span>
          <h2>Build tickets, track draws, and compare your lines.</h2>
          <p>This starter app uses local simulated draw data until the exact Manus prompt/API requirements are available.</p>
        </div>
        <div class="jackpot-card">
          <span>Current Jackpot</span>
          <strong>${{ store.latestDraw.jackpotMillions }}M</strong>
        </div>
      </header>

      <section class="metrics">
        <article><span>Saved Tickets</span><strong>{{ store.savedTicketCount }}</strong></article>
        <article><span>Latest Draw</span><strong>{{ store.latestDraw.date }}</strong></article>
        <article><span>Best Match</span><strong>{{ store.bestMatch ? `${store.bestMatch.mainMatches}/7` : 'No tickets' }}</strong></article>
      </section>

      <section class="grid-layout">
        <article class="panel">
          <div class="section-title">
            <div>
              <h2>Latest Draw</h2>
              <p>Numbers from the most recent draw record.</p>
            </div>
          </div>
          <div class="ball-row">
            <NumberBall v-for="number in store.latestDraw.numbers" :key="number" :value="number" />
            <NumberBall :value="store.latestDraw.bonus" bonus />
          </div>
        </article>

        <TicketBuilder id="tickets" />
      </section>

      <section class="grid-layout">
        <article class="panel" id="analytics">
          <div class="section-title">
            <div>
              <h2>Frequency Watch</h2>
              <p>Most frequent numbers across local draw history.</p>
            </div>
          </div>
          <div class="frequency-list">
            <article v-for="item in topNumbers" :key="item.number">
              <NumberBall :value="item.number" muted />
              <div class="bar"><i :style="{ width: `${Math.max(8, item.count * 28)}%` }"></i></div>
              <span>{{ item.count }} hits</span>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-title">
            <div>
              <h2>Saved Tickets</h2>
              <p>Compare your tickets against the latest draw.</p>
            </div>
          </div>
          <div class="ticket-list">
            <article v-for="ticket in store.tickets" :key="ticket.id">
              <div>
                <strong>{{ ticket.label }}</strong>
                <span>{{ new Date(ticket.createdAt).toLocaleString() }}</span>
              </div>
              <div class="ball-row compact">
                <NumberBall v-for="number in ticket.numbers" :key="number" :value="number" />
                <NumberBall :value="ticket.bonus" bonus />
              </div>
              <button @click="store.removeTicket(ticket.id)">Remove</button>
            </article>
            <p v-if="!store.tickets.length" class="empty">No tickets saved yet. Try Quick Pick.</p>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>
