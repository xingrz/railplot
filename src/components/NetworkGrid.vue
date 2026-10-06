<script setup lang="ts">
import { computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import { laneColors } from '../routeGeometry';
import { gridStep, laneWidth, nodeCenter, positionScale } from '../networkGrid';
import type { GridDrag } from '../networkGrid';

const props = defineProps<{ drag: GridDrag | null }>();
const { viewport, dimensions } = useVueFlow('network-editor');
const x = (lane: number) =>
  viewport.value.x + (lane * laneWidth + nodeCenter) * viewport.value.zoom;
const y = (position: number) =>
  viewport.value.y +
  (position * positionScale + nodeCenter) * viewport.value.zoom;
const columnWidth = computed(() => laneWidth * viewport.value.zoom);
const rows = computed(() => {
  const height = gridStep * positionScale * viewport.value.zoom;
  const first = Math.max(0, Math.ceil(-y(0) / height));
  const last = Math.min(
    10000 / gridStep,
    Math.floor((dimensions.value.height - y(0)) / height),
  );
  return Array.from(
    { length: Math.max(0, last - first + 1) },
    (_, index) => first + index,
  );
});
const movement = computed(() => {
  if (!props.drag) return '';
  const delta = (props.drag.position - props.drag.fromPosition) / gridStep;
  if (!delta) return '原站位';
  return `${delta < 0 ? '上移' : '下移'} ${Number(Math.abs(delta).toFixed(2))} 格`;
});
</script>

<template>
  <svg class="network-grid" aria-hidden="true">
    <g v-for="lane in 4" :key="lane">
      <rect
        :x="x(lane - 1) - columnWidth / 2"
        y="0"
        :width="columnWidth"
        height="100%"
        :fill="laneColors[lane - 1]"
        :opacity="drag?.lane === lane - 1 ? 0.09 : 0.025"
      />
      <line
        :x1="x(lane - 1)"
        :x2="x(lane - 1)"
        y1="0"
        y2="100%"
        :stroke="laneColors[lane - 1]"
        stroke-opacity="0.35"
        stroke-dasharray="4 5"
      />
    </g>
    <g v-for="row in rows" :key="row">
      <line
        x1="0"
        x2="100%"
        :y1="y(row * gridStep)"
        :y2="y(row * gridStep)"
        stroke="#839587"
        :stroke-opacity="row % 5 === 0 ? 0.26 : 0.12"
      />
      <text
        v-if="row % 5 === 0 && y(row * gridStep) > 40"
        x="8"
        :y="y(row * gridStep) - 4"
        class="grid-number"
      >
        {{ row }}
      </text>
    </g>
    <g v-if="drag" :stroke="drag.blocked ? '#b44e43' : '#326b57'">
      <line x1="0" x2="100%" :y1="y(drag.position)" :y2="y(drag.position)" />
      <line
        :x1="x(drag.lane) - 24"
        :x2="x(drag.lane) - 24"
        :y1="y(drag.fromPosition)"
        :y2="y(drag.position)"
      />
      <line
        :x1="x(drag.lane) - 30"
        :x2="x(drag.lane) - 18"
        :y1="y(drag.fromPosition)"
        :y2="y(drag.fromPosition)"
      />
      <line
        :x1="x(drag.lane) - 30"
        :x2="x(drag.lane) - 18"
        :y1="y(drag.position)"
        :y2="y(drag.position)"
      />
    </g>
    <rect width="100%" height="30" fill="#fafbf8" fill-opacity="0.94" />
    <text
      v-for="lane in 4"
      :key="lane"
      :x="x(lane - 1)"
      y="20"
      text-anchor="middle"
      :fill="laneColors[lane - 1]"
      class="grid-heading"
    >
      {{ lane === 1 ? '主线' : `支线 ${lane - 1}` }}
    </text>
  </svg>
  <div
    v-if="drag"
    class="drag-measure"
    :class="{ blocked: drag.blocked }"
    role="status"
  >
    {{ movement }} · {{ drag.lane === 0 ? '主线' : `支线 ${drag.lane}` }}
    <span v-if="drag.blocked">· 站位已占用</span>
  </div>
</template>

<style scoped>
.network-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.grid-number {
  font-size: 10px;
  fill: #89978a;
  font-variant-numeric: tabular-nums;
}
.grid-heading {
  font-size: 12px;
  font-weight: 500;
}
.drag-measure {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  padding: 6px 10px;
  border: 1px solid #a9c1b2;
  border-radius: 6px;
  background: #fafbf8;
  color: #326b57;
  font-size: 12px;
  pointer-events: none;
}
.drag-measure.blocked {
  border-color: #d8aaa3;
  color: #a44439;
}
</style>
