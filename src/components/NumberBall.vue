<script setup>
defineProps({
  value: {
    type: Number,
    required: true
  },
  bonus: {
    type: Boolean,
    default: false
  },
  muted: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <span :class="['number-ball', { bonus, muted }]">{{ value }}</span>
</template>
