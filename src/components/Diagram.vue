<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import RouteLayer from './RouteLayer.vue';
import {
  geometry,
  minutes,
  moveTimePoint,
  shiftTrain,
  trainShiftBounds,
  timePointBounds,
  timeString,
  trainColor,
} from '../model';
import type {
  Point,
  Project,
  TimePointEdit,
  Train,
  TrainShift,
} from '../model';

const props = defineProps<{
  project: Project;
  selected: string;
  zoom: number;
  labels: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  editTime: [edit: TimePointEdit];
  shiftTrain: [edit: TrainShift];
}>();

const svg = ref<SVGSVGElement>();

defineExpose({ svg });

const viewport = ref<HTMLDivElement>();
const scroll = ref<HTMLDivElement>();
const viewportWidth = ref(1460);
const g = computed(() =>
  geometry(props.project, viewportWidth.value, props.zoom),
);

let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    viewportWidth.value = entry.contentRect.width;
  });
  if (viewport.value) resizeObserver.observe(viewport.value);
});

onUnmounted(() => {
  cancelDrag();
  resizeObserver?.disconnect();
});

const ticks = computed(() =>
  Array.from(
    { length: g.value.end - g.value.start + 1 },
    (_, i) => g.value.start + i,
  ),
);

interface PointerStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  moved: boolean;
}

type Gesture = PointerStart &
  (
    | { kind: 'pan'; scrollLeft: number }
    | { kind: 'train'; train: Train; startX: number; delta: number }
    | {
        kind: 'point';
        train: Train;
        point: Point;
        offset: number;
        minute: number;
      }
  );

const gesture = ref<Gesture | null>(null);
const drag = computed(() =>
  gesture.value?.kind === 'point' ? gesture.value : null,
);
const trainDrag = computed(() =>
  gesture.value?.kind === 'train' ? gesture.value : null,
);
const activeId = computed(() =>
  trainDrag.value?.moved ? trainDrag.value.train.id : props.selected,
);
const previewTrain = computed(() => {
  const current = gesture.value;
  if (current?.kind === 'point')
    return moveTimePoint(
      current.train,
      current.point.stopIndex,
      current.point.kind,
      current.minute,
    );
  if (current?.kind === 'train')
    return shiftTrain(current.train, current.delta);
  return null;
});

function svgX(event: PointerEvent): number {
  const bounds = svg.value!.getBoundingClientRect();
  return ((event.clientX - bounds.left) / bounds.width) * g.value.width;
}

function pointerStart(event: PointerEvent): PointerStart {
  return {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    moved: false,
  };
}

function capture(event: PointerEvent) {
  viewport.value!.focus({ preventScroll: true });
  viewport.value!.setPointerCapture(event.pointerId);
}

function beginPan(event: PointerEvent) {
  if (event.button !== 0 || gesture.value) return;
  event.preventDefault();
  gesture.value = {
    ...pointerStart(event),
    kind: 'pan',
    scrollLeft: scroll.value!.scrollLeft,
  };
  capture(event);
}

function beginTrainDrag(event: PointerEvent, train: Train) {
  if (event.button !== 0 || gesture.value) return;
  gesture.value = {
    ...pointerStart(event),
    kind: 'train',
    train,
    startX: svgX(event),
    delta: 0,
  };
  capture(event);
}

function beginDrag(event: PointerEvent, train: Train, point: Point) {
  if (event.button !== 0 || gesture.value) return;
  gesture.value = {
    ...pointerStart(event),
    kind: 'point',
    train,
    point,
    offset: svgX(event) - point.x,
    minute: minutes(point.time),
  };
  capture(event);
}

function updateDrag(event: PointerEvent) {
  const current = gesture.value;
  if (!current || event.pointerId !== current.pointerId) return;
  if (
    Math.hypot(
      event.clientX - current.clientX,
      event.clientY - current.clientY,
    ) >= 4
  )
    current.moved = true;
  if (!current.moved) return;

  if (current.kind === 'pan') {
    scroll.value!.scrollLeft =
      current.scrollLeft + current.clientX - event.clientX;
  } else if (current.kind === 'train') {
    const requested = Math.round(
      (svgX(event) - current.startX) / g.value.minuteWidth,
    );
    const bounds = trainShiftBounds(current.train);
    current.delta = Math.max(bounds.min, Math.min(bounds.max, requested));
  } else {
    const x = svgX(event) - current.offset;
    const requested = g.value.start + (x - g.value.left) / g.value.minuteWidth;
    const bounds = timePointBounds(
      current.train,
      current.point.stopIndex,
      current.point.kind,
    );
    current.minute = Math.max(
      bounds.min,
      Math.min(bounds.max, Math.round(requested)),
    );
  }
}

function finishDrag(event: PointerEvent) {
  if (!gesture.value || event.pointerId !== gesture.value.pointerId) return;
  updateDrag(event);
  const current = gesture.value;
  if (
    current.kind === 'point' &&
    current.minute !== minutes(current.point.time)
  ) {
    emit('editTime', {
      trainId: current.train.id,
      stopIndex: current.point.stopIndex,
      kind: current.point.kind,
      minute: current.minute,
    });
  } else if (current.kind === 'pan' && !current.moved) {
    emit('select', '');
  } else if (current.kind === 'train') {
    if (!current.moved) emit('select', current.train.id);
    else if (current.delta)
      emit('shiftTrain', { trainId: current.train.id, delta: current.delta });
  }
  releaseGesture();
}

function releaseGesture() {
  const current = gesture.value;
  // 先清状态，避免 releasePointerCapture 触发的事件把成功操作当作取消。
  gesture.value = null;
  if (current && viewport.value?.hasPointerCapture(current.pointerId))
    viewport.value.releasePointerCapture(current.pointerId);
}

function cancelDrag() {
  if (gesture.value?.kind === 'pan' && scroll.value)
    scroll.value.scrollLeft = gesture.value.scrollLeft;
  releaseGesture();
}

// 导入、撤销或缩放发生在手势中时，不用过期快照覆盖新的工程。
watch([() => props.project, () => props.zoom], cancelDrag);

function nudgePoint(event: KeyboardEvent, train: Train, point: Point) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  event.preventDefault();
  emit('editTime', {
    trainId: train.id,
    stopIndex: point.stopIndex,
    kind: point.kind,
    minute: minutes(point.time) + (event.key === 'ArrowLeft' ? -1 : 1),
  });
}

const plots = computed(() =>
  props.project.trains
    .map((source) => {
      const train =
        previewTrain.value?.id === source.id ? previewTrain.value : source;
      const points = g.value.points(train);
      let label = points.find(
        (p) => p.x >= g.value.left && p.x <= g.value.right,
      );
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
    })
    .sort(
      (a, b) =>
        Number(a.train.id === activeId.value) -
        Number(b.train.id === activeId.value),
    ),
);

function description(train: Train) {
  return `${train.name}，${train.stops.map((s) => `${props.project.stations.find((p) => p.id === s.station)?.name} ${s.arrival} 到 / ${s.departure} 发`).join('；')}`;
}
</script>
<template>
  <div
    ref="viewport"
    class="diagram-viewport"
    :class="{ 'diagram-dragging': gesture?.moved }"
    tabindex="-1"
    @pointerdown="beginPan"
    @pointermove="updateDrag"
    @pointerup="finishDrag"
    @pointercancel="cancelDrag"
    @lostpointercapture="cancelDrag"
    @keydown.esc.capture.prevent.stop="cancelDrag"
  >
    <div
      ref="scroll"
      class="diagram-scroll"
      tabindex="0"
      aria-label="横向滚动运行图"
    >
      <svg
        ref="svg"
        xmlns="http://www.w3.org/2000/svg"
        :viewBox="`0 0 ${g.width} ${g.height}`"
        :width="g.width"
        :height="g.height"
        :style="{ width: `${g.width}px`, height: `${g.height}px` }"
        role="img"
        aria-label="线路与列车运行图"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      >
        <title>{{ project.name }} · Railplot 列车运行图</title>
        <rect :width="g.width" :height="g.height" fill="#ffffff" />
        <RouteLayer :project="project" :layout="g" />
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
          <template v-if="(t - g.start) % g.labelEvery === 0">
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
        </g>
        <g clip-path="url(#plot-clip)">
          <g
            v-for="plot in plots"
            :key="plot.train.id"
            :data-train="plot.train.id"
            class="train-plot"
            :opacity="activeId && activeId !== plot.train.id ? 0.6 : 1"
            @pointerdown.stop.prevent="beginTrainDrag($event, plot.train)"
            @click="if ($event.detail === 0) emit('select', plot.train.id);"
            @keydown.enter="emit('select', plot.train.id)"
            @keydown.space.prevent="emit('select', plot.train.id)"
            tabindex="0"
            role="button"
            :aria-label="`编辑 ${plot.train.name}`"
            :aria-pressed="activeId === plot.train.id"
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
            <g v-if="activeId === plot.train.id" data-interactive="handles">
              <circle
                v-for="(point, i) in plot.points"
                :key="i"
                class="time-handle"
                :data-stop-index="point.stopIndex"
                :data-time-kind="point.kind"
                role="slider"
                tabindex="0"
                :aria-label="`${project.stations.find((s) => s.id === point.station)?.name} ${point.kind === 'arrival' ? '到达' : point.kind === 'departure' ? '出发' : '通过'}时间`"
                :aria-valuenow="minutes(point.time)"
                :aria-valuetext="point.time"
                :aria-valuemin="
                  timePointBounds(plot.train, point.stopIndex, point.kind).min
                "
                :aria-valuemax="
                  timePointBounds(plot.train, point.stopIndex, point.kind).max
                "
                @pointerdown.stop.prevent="beginDrag($event, plot.train, point)"
                @click.stop
                @keydown.stop="nudgePoint($event, plot.train, point)"
                :cx="point.x"
                :cy="point.y"
                r="4.5"
                fill="white"
                :stroke="trainColor(project, plot.train)"
                stroke-width="1.8"
              >
                <title>
                  {{
                    project.stations.find((s) => s.id === point.station)?.name
                  }}
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
        <g v-if="drag" data-interactive="drag-time" pointer-events="none">
          <rect
            :x="g.x(timeString(drag.minute)) - 27"
            :y="drag.point.y - 34"
            width="54"
            height="22"
            rx="4"
            fill="#326b57"
          />
          <text
            :x="g.x(timeString(drag.minute))"
            :y="drag.point.y - 19"
            text-anchor="middle"
            font-size="12"
            font-family="monospace"
            fill="white"
          >
            {{ timeString(drag.minute) }}
          </text>
        </g>
        <text x="264" :y="g.height - 23" font-size="10" fill="#9ca79f">
          {{ project.time.start }} — {{ project.time.end }} · 主网格
          {{ project.time.grid }} 分钟
        </text>
        <text
          :x="g.right"
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
    <div v-if="trainDrag?.moved" class="diagram-drag-status" role="status">
      {{ trainDrag.train.name }} · {{ trainDrag.delta < 0 ? '提前' : '推迟' }}
      {{ Math.abs(trainDrag.delta) }} 分钟
    </div>
    <svg
      class="route-overlay"
      width="232"
      :height="g.height"
      :viewBox="`0 0 232 ${g.height}`"
      aria-hidden="true"
      font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    >
      <RouteLayer :project="project" :layout="g" />
    </svg>
  </div>
</template>
