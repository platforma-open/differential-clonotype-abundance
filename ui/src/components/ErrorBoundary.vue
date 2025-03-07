<script lang="ts" setup>
import type { ComponentPublicInstance } from 'vue';
import { onErrorCaptured, reactive } from 'vue';

const data = reactive({
  error: null as unknown,
  errorMessage: '',
});

onErrorCaptured((
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string,
) => {
  console.log('boundary error', err);
  data.error = err;
  data.errorMessage = info;
  return false;
});
</script>

<template>
  <div v-if="data.error">{{ data.error }}</div>
  <template v-else><slot/></template>
</template>
