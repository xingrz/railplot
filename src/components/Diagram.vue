<script setup lang="ts">
import { computed, ref } from 'vue';
import { geometry, timeString, trainColor } from '../model';
import type { Project, Train } from '../model';

const props = defineProps<{
  project: Project;
  selected: string;
  zoom: number;
  labels: boolean;
}>();

const emit = defineEmits<{ select: [id: string] }>();

const svg = ref<SVGSVGElement>();

defineExpose({ svg });

const g = computed(() => geometry(props.project));

const ticks = computed(() =>
  Array.from(
    { length: g.value.end - g.value.start + 1 },
    (_, i) => g.value.start + i,
  ),
);

const laneColors = ['#337563', '#bd925c', '#6b8cae', '#a286ad'];

const laneX = (lane: number) => 44 + lane * 34;

function route(link: { from: string; to: string }) {
  const a = props.project.stations.find((s) => s.id === link.from)!;
  const b = props.project.stations.find((s) => s.id === link.to)!;
  const x1 = laneX(a.lane);
  const x2 = laneX(b.lane);
  const y1 = g.value.y(a.id);
  const y2 = g.value.y(b.id);
  return x1 === x2
    ? `M${x1},${y1}V${y2}`
    : `M${x1},${y1}L${x2},${Math.min(y1 + 26, y2 - 8)}V${y2}`;
}

const plots = computed(() =>
  props.project.trains.map((train) => {
    const points = g.value.points(train);
    let label = points.find((p) => p.x >= g.value.left && p.x <= g.value.right);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const x = (a.x + b.x) / 2;
      if (a.y !== b.y && x >= g.value.left + 15 && x <= g.value.right - 15) {
        label = { ...a, x, y: (a.y + b.y) / 2 };
        break;
      }
    }
    return {
      train,
      points,
      path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '),
      label,
    };
  }),
);

function description(train: Train) {
  return `${train.name}，${train.stops.map((s) => `${props.project.stations.find((p) => p.id === s.station)?.name} ${s.arrival} 到 / ${s.departure} 发`).join('；')}`;
}
</script>
<template>
  <div class="diagram-scroll">
    <svg
      ref="svg"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 1460 ${g.height}`"
      :style="{ width: `${zoom}%`, minWidth: '1000px' }"
      role="img"
      aria-label="线路与列车运行图"
      font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    >
      <title>{{ project.name }} · Railplot 列车运行图</title>
      <rect width="1460" :height="g.height" fill="#ffffff" />
      <rect width="232" :height="g.height" fill="#fafbf8" />
      <line x1="232" x2="232" y1="0" :y2="g.height" stroke="#e4e9e3" />
      <text x="264" y="33" font-size="15" font-weight="600" fill="#33483f">
        {{ project.name }}
      </text>
      <g
        v-for="(group, i) in project.groups"
        :key="group.id"
        :transform="`translate(${264 + (i % 6) * 190},${53 + Math.floor(i / 6) * 20})`"
      >
        <line
          x1="0"
          x2="17"
          y1="0"
          y2="0"
          :stroke="group.color"
          stroke-width="2.5"
        />
        <text x="24" y="4" font-size="11" fill="#66776c">
          {{ group.name }}
        </text>
      </g>
      <defs>
        <clipPath id="plot-clip">
          <rect
            :x="g.left"
            :y="g.top - 14"
            :width="g.right - g.left"
            :height="g.bottom - g.top + 28"
          />
        </clipPath>
      </defs>
      <g v-for="t in ticks" :key="t">
        <line
          :x1="g.x(timeString(t))"
          :x2="g.x(timeString(t))"
          :y1="g.top - 22"
          :y2="g.bottom + 22"
          :stroke="
            (t - g.start) % project.time.grid === 0 ? '#d0d9d4' : '#f0f3f0'
          "
          :stroke-dasharray="
            (t - g.start) % project.time.grid === 0 ? '3 4' : undefined
          "
        />
        <template v-if="(t - g.start) % project.time.grid === 0">
          <text
            :x="g.x(timeString(t))"
            :y="g.top - 34"
            text-anchor="middle"
            font-size="11"
            fill="#718077"
            font-family="monospace"
          >
            {{ timeString(t) }}
          </text>
          <text
            :x="g.x(timeString(t))"
            :y="g.bottom + 44"
            text-anchor="middle"
            font-size="10"
            fill="#9aa59e"
            font-family="monospace"
          >
            {{ timeString(t) }}
          </text>
        </template>
      </g>
      <g v-for="station in g.sorted" :key="station.id">
        <line
          :x1="g.left"
          :x2="g.right"
          :y1="g.y(station.id)"
          :y2="g.y(station.id)"
          stroke="#bdc9c1"
          stroke-dasharray="4 4"
        />
        <text
          x="212"
          :y="g.y(station.id) + 4"
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
          :y1="g.y(station.id)"
          :y2="g.y(station.id)"
          stroke="#bdc9c1"
        />
      </g>
      <g v-for="(link, i) in project.links" :key="i">
        <path
          :d="route(link)"
          fill="none"
          :stroke="
            laneColors[project.stations.find((s) => s.id === link.to)!.lane]
          "
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <g v-for="station in g.sorted" :key="station.id">
        <circle
          :cx="laneX(station.lane)"
          :cy="g.y(station.id)"
          r="5.5"
          fill="white"
          :stroke="laneColors[station.lane]"
          stroke-width="2.5"
        />
      </g>
      <g clip-path="url(#plot-clip)">
        <g
          v-for="plot in plots"
          :key="plot.train.id"
          :data-train="plot.train.id"
          :opacity="selected && selected !== plot.train.id ? 0.6 : 1"
          @click="emit('select', plot.train.id)"
          @keydown.enter="emit('select', plot.train.id)"
          @keydown.space.prevent="emit('select', plot.train.id)"
          tabindex="0"
          role="button"
          :aria-label="`编辑 ${plot.train.name}`"
          style="cursor: pointer"
        >
          <title>{{ description(plot.train) }}</title>
          <path
            data-interactive="hit"
            :d="plot.path"
            fill="none"
            stroke="transparent"
            stroke-width="15"
          />
          <path
            :d="plot.path"
            fill="none"
            :stroke="trainColor(project, plot.train)"
            stroke-width="2.2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <g v-if="selected === plot.train.id" data-interactive="handles">
            <circle
              v-for="(point, i) in plot.points"
              :key="i"
              :cx="point.x"
              :cy="point.y"
              r="3.3"
              fill="white"
              :stroke="trainColor(project, plot.train)"
              stroke-width="1.8"
            >
              <title>
                {{ project.stations.find((s) => s.id === point.station)?.name }}
                {{ point.time }}
              </title>
            </circle>
          </g>
          <text
            v-if="labels && plot.label"
            :x="plot.label.x"
            :y="plot.label.y - 5"
            font-family="monospace"
            font-weight="600"
            font-size="12"
            text-anchor="middle"
            :fill="trainColor(project, plot.train)"
            stroke="white"
            stroke-width="5"
            stroke-linejoin="round"
            paint-order="stroke"
          >
            {{ plot.train.name }}
          </text>
        </g>
      </g>
      <text x="264" :y="g.height - 23" font-size="10" fill="#9ca79f">
        {{ project.time.start }} — {{ project.time.end }} · 主网格
        {{ project.time.grid }} 分钟
      </text>
      <text
        x="1428"
        :y="g.height - 23"
        text-anchor="end"
        font-size="10"
        letter-spacing="2"
        fill="#779386"
      >
        RAILPLOT
      </text>
    </svg>
  </div>
</template>
