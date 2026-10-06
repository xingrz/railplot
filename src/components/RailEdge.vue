<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';
import { railPath } from '../routeGeometry';

const props = defineProps<EdgeProps>();
const path = computed(() => {
  const { sourceX: x1, sourceY: y1, targetX: x2, targetY: y2 } = props;
  return railPath(x1, y1, x2, y2, 40);
});
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :interaction-width="20"
    :style="{
      stroke: selected ? '#264f41' : data.color,
      strokeWidth: selected ? 6 : 4,
    }"
  />
</template>
