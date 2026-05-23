import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const GROUP_PRESETS = [
  { size: 5, entryFee: 250 },
  { size: 10, entryFee: 500 },
  { size: 15, entryFee: 1000 },
  { size: 20, entryFee: 2500 }
];

const NAMES = ['Aarav', 'Isha', 'Kabir', 'Meera', 'Vihaan', 'Anaya', 'Rohan', 'Tara', 'Dev', 'Naina', 'Arjun', 'Kiara'];

function currency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createPlayers(count, maxSize) {
  return Array.from({ length: count }, (_, index) => ({
    id: `bot-${Date.now()}-${index}`,
    name: randomFrom(NAMES),
    number: index < maxSize ? index + 1 : null,
    isYou: false
  }));
}

function makeGroup(index, preset) {
  const playerCount = Math.max(1, Math.min(preset.size - 1, Math.floor(Math.random() * preset.size)));
  return {
    id: `group-${preset.size}-${index}`,
    title: `${preset.size} Player Rush`,
    size: preset.size,
    entryFee: preset.entryFee,
    prizePool: preset.entryFee * preset.size,
    status: 'OPEN',
    players: createPlayers(playerCount, preset.size),
    selectedNumber: null,
    pickEndsAt: null,
    graceEndsAt: null,
    winnerNumber: null,
    winnerName: '',
    drawLog: ['Group opened. Waiting for players.']
  };
}

export const useLottoStore = defineStore('lotto', () => {
  const wallet = ref(12500);
  const groups = ref(GROUP_PRESETS.map((preset, index) => makeGroup(index + 1, preset)));
  const activeGroupId = ref(groups.value[0].id);
  const transactions = ref([
    { id: 'txn-welcome', type: 'CREDIT', amount: 12500, note: 'Welcome wallet balance', at: new Date().toISOString() }
  ]);

  const activeGroup = computed(() => groups.value.find((group) => group.id === activeGroupId.value) ?? groups.value[0]);
  const openGroups = computed(() => groups.value.filter((group) => group.status !== 'COMPLETED'));
  const totalPrizePool = computed(() => groups.value.reduce((sum, group) => sum + group.prizePool, 0));
  const groupSizes = computed(() => GROUP_PRESETS.map((preset) => preset.size).join('-'));
  const you = computed(() => activeGroup.value?.players.find((player) => player.isYou));
  const availableNumbers = computed(() => {
    const group = activeGroup.value;
    if (!group) return [];
    const taken = new Set(group.players.map((player) => player.number).filter(Boolean));
    return Array.from({ length: group.size }, (_, index) => index + 1).map((number) => ({
      number,
      taken: taken.has(number),
      mine: you.value?.number === number
    }));
  });

  function addTransaction(type, amount, note) {
    transactions.value = [{
      id: `txn-${Date.now()}`,
      type,
      amount,
      note,
      at: new Date().toISOString()
    }, ...transactions.value].slice(0, 20);
  }

  function selectGroup(id) {
    activeGroupId.value = id;
  }

  function joinGroup(id) {
    const group = groups.value.find((item) => item.id === id);
    if (!group || group.players.some((player) => player.isYou) || group.status !== 'OPEN') return;
    if (wallet.value < group.entryFee) {
      group.drawLog = ['Insufficient wallet balance.', ...group.drawLog];
      return;
    }
    wallet.value -= group.entryFee;
    addTransaction('DEBIT', group.entryFee, `Joined ${group.title}`);
    group.players = [...group.players, { id: 'you', name: 'You', number: null, isYou: true }];
    group.drawLog = [`You joined. ${group.size - group.players.length} seats left.`, ...group.drawLog];
    activeGroupId.value = group.id;
    if (group.players.length >= group.size) startPicking(group);
  }

  function autoFillGroup(id) {
    const group = groups.value.find((item) => item.id === id);
    if (!group || group.status !== 'OPEN') return;
    while (group.players.length < group.size) {
      group.players.push({
        id: `bot-${Date.now()}-${group.players.length}`,
        name: randomFrom(NAMES),
        number: null,
        isYou: false
      });
    }
    startPicking(group);
  }

  function startPicking(group) {
    group.status = 'PICKING';
    group.pickEndsAt = Date.now() + 120_000;
    group.graceEndsAt = null;
    group.drawLog = ['Group is full. Pick your unique number card within 2 minutes.', ...group.drawLog];
    assignBotNumbers(group);
  }

  function assignBotNumbers(group) {
    const numbers = Array.from({ length: group.size }, (_, index) => index + 1);
    group.players = group.players.map((player) => {
      if (player.isYou || player.number) return player;
      const index = Math.floor(Math.random() * numbers.length);
      return { ...player, number: numbers.splice(index, 1)[0] };
    });
  }

  function pickNumber(number) {
    const group = activeGroup.value;
    if (!group || !you.value || !['PICKING', 'GRACE'].includes(group.status)) return;
    const ownedByOther = group.players.some((player) => !player.isYou && player.number === number);
    if (ownedByOther) return;
    group.players = group.players.map((player) => player.isYou ? { ...player, number } : player);
    group.selectedNumber = number;
    group.drawLog = [`You selected number ${number}.`, ...group.drawLog];
  }

  function advanceClock() {
    const now = Date.now();
    groups.value.forEach((group) => {
      if (group.status === 'PICKING' && group.pickEndsAt && now >= group.pickEndsAt) {
        group.status = 'GRACE';
        group.graceEndsAt = Date.now() + 30_000;
        group.drawLog = ['30-second grace period started. You can still change your number.', ...group.drawLog];
      }
      if (group.status === 'GRACE' && group.graceEndsAt && now >= group.graceEndsAt) {
        drawWinner(group.id);
      }
    });
  }

  function drawWinner(id) {
    const group = groups.value.find((item) => item.id === id);
    if (!group || !['PICKING', 'GRACE'].includes(group.status)) return;
    const chosen = group.players.filter((player) => player.number);
    const winner = randomFrom(chosen);
    group.status = 'COMPLETED';
    group.winnerNumber = winner.number;
    group.winnerName = winner.name;
    group.drawLog = [`Number ${winner.number} drawn. Winner: ${winner.name}.`, ...group.drawLog];
    if (winner.isYou) {
      wallet.value += group.prizePool;
      addTransaction('CREDIT', group.prizePool, `Won ${group.title}`);
    }
  }

  function resetCompleted() {
    groups.value = groups.value.map((group, index) => (
      group.status === 'COMPLETED' ? makeGroup(index + 1, { size: group.size, entryFee: group.entryFee }) : group
    ));
    activeGroupId.value = groups.value[0].id;
  }

  return {
    wallet,
    groups,
    activeGroupId,
    activeGroup,
    openGroups,
    totalPrizePool,
    groupSizes,
    transactions,
    you,
    availableNumbers,
    currency,
    selectGroup,
    joinGroup,
    autoFillGroup,
    pickNumber,
    drawWinner,
    advanceClock,
    resetCompleted
  };
});
