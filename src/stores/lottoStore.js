import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const MAIN_MAX = 50;
const MAIN_COUNT = 7;
const BONUS_MAX = 50;

function drawUnique(count, max) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  const result = [];
  while (result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

function matchTicket(ticket, draw) {
  const mainMatches = ticket.numbers.filter((number) => draw.numbers.includes(number)).length;
  const bonusMatch = ticket.bonus === draw.bonus;
  return { mainMatches, bonusMatch };
}

export const useLottoStore = defineStore('lotto', () => {
  const tickets = ref([]);
  const draws = ref([
    { id: 'draw-001', date: '2026-05-22', numbers: [4, 11, 18, 23, 29, 36, 45], bonus: 7, jackpotMillions: 60 },
    { id: 'draw-002', date: '2026-05-15', numbers: [2, 9, 17, 25, 31, 38, 49], bonus: 12, jackpotMillions: 55 },
    { id: 'draw-003', date: '2026-05-08', numbers: [6, 14, 19, 28, 34, 41, 50], bonus: 3, jackpotMillions: 50 }
  ]);

  const latestDraw = computed(() => draws.value[0]);
  const savedTicketCount = computed(() => tickets.value.length);
  const bestMatch = computed(() => {
    const latest = latestDraw.value;
    if (!latest || !tickets.value.length) return null;
    return tickets.value
      .map((ticket) => ({ ticket, ...matchTicket(ticket, latest) }))
      .sort((a, b) => b.mainMatches - a.mainMatches || Number(b.bonusMatch) - Number(a.bonusMatch))[0];
  });

  const frequency = computed(() => {
    const counts = new Map();
    draws.value.forEach((draw) => draw.numbers.forEach((number) => counts.set(number, (counts.get(number) ?? 0) + 1)));
    return Array.from({ length: MAIN_MAX }, (_, index) => ({
      number: index + 1,
      count: counts.get(index + 1) ?? 0
    })).sort((a, b) => b.count - a.count || a.number - b.number);
  });

  function quickPick(label = 'Quick Pick') {
    const ticket = {
      id: `ticket-${Date.now()}`,
      label,
      numbers: drawUnique(MAIN_COUNT, MAIN_MAX),
      bonus: drawUnique(1, BONUS_MAX)[0],
      createdAt: new Date().toISOString()
    };
    tickets.value = [ticket, ...tickets.value];
    return ticket;
  }

  function saveTicket(ticket) {
    const normalized = {
      ...ticket,
      id: `ticket-${Date.now()}`,
      numbers: [...ticket.numbers].sort((a, b) => a - b),
      createdAt: new Date().toISOString()
    };
    tickets.value = [normalized, ...tickets.value];
    return normalized;
  }

  function simulateDraw() {
    const draw = {
      id: `draw-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      numbers: drawUnique(MAIN_COUNT, MAIN_MAX),
      bonus: drawUnique(1, BONUS_MAX)[0],
      jackpotMillions: Math.floor(Math.random() * 40) + 30
    };
    draws.value = [draw, ...draws.value].slice(0, 24);
    return draw;
  }

  function removeTicket(id) {
    tickets.value = tickets.value.filter((ticket) => ticket.id !== id);
  }

  return {
    tickets,
    draws,
    latestDraw,
    savedTicketCount,
    bestMatch,
    frequency,
    quickPick,
    saveTicket,
    simulateDraw,
    removeTicket
  };
});
