<script setup>
import { computed, reactive } from 'vue';
import { useLottoStore } from '../stores/lottoStore';
import NumberBall from './NumberBall.vue';

const store = useLottoStore();
const form = reactive({
  label: 'My LottoMax line',
  numbers: [],
  bonus: 1
});

const canSave = computed(() => form.numbers.length === 7 && form.bonus >= 1 && form.bonus <= 50);

function toggleNumber(number) {
  if (form.numbers.includes(number)) {
    form.numbers = form.numbers.filter((item) => item !== number);
    return;
  }
  if (form.numbers.length < 7) {
    form.numbers = [...form.numbers, number].sort((a, b) => a - b);
  }
}

function save() {
  if (!canSave.value) return;
  store.saveTicket({ label: form.label, numbers: form.numbers, bonus: Number(form.bonus) });
  form.numbers = [];
  form.bonus = 1;
}
</script>

<template>
  <section class="panel ticket-builder">
    <div class="section-title">
      <div>
        <h2>Ticket Builder</h2>
        <p>Select 7 numbers and one bonus number.</p>
      </div>
      <button @click="store.quickPick()">Quick Pick</button>
    </div>
    <label>
      Ticket Label
      <input v-model="form.label" />
    </label>
    <div class="selected-row">
      <NumberBall v-for="number in form.numbers" :key="number" :value="number" />
      <span v-if="!form.numbers.length" class="empty-chip">No numbers selected</span>
    </div>
    <div class="number-grid">
      <button
        v-for="number in 50"
        :key="number"
        :class="{ active: form.numbers.includes(number) }"
        @click="toggleNumber(number)"
      >
        {{ number }}
      </button>
    </div>
    <label>
      Bonus Number
      <input v-model.number="form.bonus" type="number" min="1" max="50" />
    </label>
    <button class="primary" :disabled="!canSave" @click="save">Save Ticket</button>
  </section>
</template>
