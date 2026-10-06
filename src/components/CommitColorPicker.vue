<script setup lang="ts">
import { ref, watch } from 'vue';
import { NColorPicker } from 'naive-ui';

const value = defineModel<string>({ required: true });
defineProps<{ label: string }>();
const buffer = ref(value.value);

watch(value, (next) => {
  buffer.value = next;
});

// 拖动期间只预览控件颜色，完成一次选择后才写入工程历史。
function commit() {
  value.value = buffer.value;
}
</script>

<template>
  <NColorPicker
    v-model:value="buffer"
    size="small"
    :modes="['hex']"
    :show-alpha="false"
    :actions="['confirm']"
    :aria-label="label"
    @complete="commit"
    @confirm="commit"
  />
</template>
