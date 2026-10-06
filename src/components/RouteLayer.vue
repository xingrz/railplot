<script setup lang="ts">
import type { Project, geometry } from '../model';
import { laneColors, laneX, routeSegment } from '../routeGeometry';

const props = defineProps<{
  project: Project;
  layout: ReturnType<typeof geometry>;
}>();

function segment(link: { from: string; to: string }) {
  const from = props.project.stations.find(
    (station) => station.id === link.from,
  )!;
  const to = props.project.stations.find((station) => station.id === link.to)!;
  return routeSegment(from, to, props.layout.y(from.id), props.layout.y(to.id));
}
</script>

<template>
  <g>
    <rect width="232" :height="layout.height" fill="#fafbf8" />
    <line x1="232" x2="232" y1="0" :y2="layout.height" stroke="#e4e9e3" />
    <g v-for="station in layout.sorted" :key="station.id">
      <text
        x="212"
        :y="layout.y(station.id) + 4"
        text-anchor="end"
        font-size="13"
        font-weight="500"
        fill="#40594c"
      >
        {{ station.name }}
      </text>
      <line
        x1="220"
        x2="232"
        :y1="layout.y(station.id)"
        :y2="layout.y(station.id)"
        stroke="#bdc9c1"
      />
    </g>
    <path
      v-for="(link, index) in project.links"
      :key="index"
      :d="segment(link).path"
      :data-route-from="link.from"
      :data-route-to="link.to"
      fill="none"
      :stroke="segment(link).color"
      stroke-width="5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      v-for="station in layout.sorted"
      :key="station.id"
      :cx="laneX(station.lane)"
      :cy="layout.y(station.id)"
      r="5.5"
      fill="white"
      :stroke="laneColors[station.lane]"
      stroke-width="2.5"
    />
  </g>
</template>
