<script setup lang="ts">
import { ref, watch } from 'vue';
import { NInput } from 'naive-ui';

defineOptions({ inheritAttrs: false });

const value = defineModel<string>({ required: true });
const props = defineProps<{ label: string }>();
const buffer = ref(value.value);

// 输入过程不改工程；提交完整字段后才进入校验、保存与撤销记录。
watch(value, (next) => {
  buffer.value = next;
});

function commit() {
  value.value = buffer.value;
}
</script>

<template>
  <NInput
    v-bind="$attrs"
    v-model:value="buffer"
    size="small"
    :input-props="{ 'aria-label': props.label }"
    @change="commit"
    @keydown.enter="commit"
  />
</template>
