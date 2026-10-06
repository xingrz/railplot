<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import {
  ConnectionMode,
  Handle,
  Position,
  VueFlow,
  useVueFlow,
} from '@vue-flow/core';
import type { Connection, Edge, Node, NodeDragEvent } from '@vue-flow/core';
import { NAlert, NButton, NFormItem, NInput, NTooltip } from 'naive-ui';
import {
  ArrowDown,
  ArrowUp,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-vue-next';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { laneColors } from '../routeGeometry';
import {
  addNeighbor,
  addStationAt,
  connectStations,
  insertStation,
  moveStation,
  removeLink,
  removeStation,
  renameStation,
} from '../networkEditing';
import type { Link, Project } from '../model';
import RailEdge from './RailEdge.vue';
import NetworkGrid from './NetworkGrid.vue';
import {
  gridStep,
  laneWidth,
  nodeHeight,
  nodeCenter,
  nodeWidth,
  positionScale,
  snapGrid,
  nodeExtent,
  snapNetworkPoint,
} from '../networkGrid';
import type { GridDrag } from '../networkGrid';

const project = defineModel<Project>('project', { required: true });
const props = defineProps<{ canUndo: boolean; canRedo: boolean }>();
const emit = defineEmits<{ undo: []; redo: [] }>();
const {
  fitBounds,
  zoomIn,
  zoomOut,
  screenToFlowCoordinate,
  viewport,
  updateNodeInternals,
} = useVueFlow('network-editor');
const adding = ref(false);
// 首次加载和新增节点均等待图库测量后再显示完整线路列。
let fitWhenNodesReady = true;

const nodes = shallowRef<Node[]>([]);
const edges = shallowRef<Edge[]>([]);
const selection = ref<{ stationId: string } | { link: Link } | null>(null);
const connectingFrom = ref<string | null>(null);
const error = ref('');
const name = ref('');
const drag = ref<GridDrag | null>(null);

const selectedStation = computed(() => {
  const selected = selection.value;
  return selected && 'stationId' in selected
    ? project.value.stations.find(
        (station) => station.id === selected.stationId,
      )
    : undefined;
});
const selectedLink = computed(() => {
  const selected = selection.value;
  return selected && 'link' in selected
    ? project.value.links.find(
        (link) =>
          link.from === selected.link.from && link.to === selected.link.to,
      )
    : undefined;
});
const stationUsed = computed(
  () =>
    !!selectedStation.value &&
    project.value.trains.some((train) =>
      train.stops.some((stop) => stop.station === selectedStation.value!.id),
    ),
);
const stationName = (id: string) =>
  project.value.stations.find((station) => station.id === id)?.name ?? '';

// 弹窗入场带缩放动画，结束后重新测量端点，避免用动画中间态计算连线。
async function refresh() {
  await nextTick();
  updateNodeInternals();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await fitNetwork();
}

// 保留所有可吸附列的空间，即使当前只有主线，也能看到支线的落点。
function fitNetwork() {
  const positions = project.value.stations.map(
    (station) => station.position * positionScale,
  );
  const top = Math.min(...positions);
  const bottom = Math.max(...positions);
  return fitBounds(
    {
      x: -40,
      y: top - 50,
      width: laneWidth * 3 + nodeWidth + 80,
      height: bottom - top + nodeHeight + 100,
    },
    { padding: 0.08 },
  );
}

defineExpose({ refresh });

function syncGraph() {
  nodes.value = project.value.stations.map((station) => ({
    id: station.id,
    type: 'station',
    position: {
      x: station.lane * laneWidth,
      y: station.position * positionScale,
    },
    data: { name: station.name, lane: station.lane },
    selected: selectedStation.value?.id === station.id,
    ariaLabel: `车站 ${station.name}`,
    domAttributes: { role: 'group', 'data-station-id': station.id },
  }));
  edges.value = project.value.links.map((link) => ({
    id: JSON.stringify([link.from, link.to]),
    source: link.from,
    target: link.to,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'rail',
    selected:
      selectedLink.value?.from === link.from &&
      selectedLink.value?.to === link.to,
    data: {
      link,
      color:
        laneColors[
          Math.max(
            project.value.stations.find((station) => station.id === link.from)!
              .lane,
            project.value.stations.find((station) => station.id === link.to)!
              .lane,
          )
        ],
    },
    ariaLabel: `${stationName(link.from)} — ${stationName(link.to)}`,
    domAttributes: {
      'data-link-key': JSON.stringify([link.from, link.to]),
      tabindex: 0,
    },
  }));
}

watch(
  project,
  () => {
    if (selection.value && !selectedStation.value && !selectedLink.value)
      selection.value = null;
    syncGraph();
  },
  { deep: true, immediate: true },
);
watch(
  selectedStation,
  (station) => {
    name.value = station?.name ?? '';
  },
  { immediate: true },
);

function commit(action: () => Project) {
  try {
    project.value = action();
    error.value = '';
    return true;
  } catch (cause) {
    error.value = (cause as Error).message;
  }
  syncGraph();
  return false;
}

function selectStation(id: string) {
  adding.value = false;
  if (connectingFrom.value && connectingFrom.value !== id) {
    commit(() => connectStations(project.value, connectingFrom.value!, id));
    connectingFrom.value = null;
  }
  selection.value = { stationId: id };
  syncGraph();
}

function connect(connection: Connection) {
  commit(() =>
    connectStations(project.value, connection.source, connection.target),
  );
  connectingFrom.value = null;
}

function previewDrag({ node }: NodeDragEvent) {
  const station = project.value.stations.find(
    (station) => station.id === node.id,
  )!;
  const target = snapNetworkPoint(node.position);
  drag.value = {
    ...target,
    fromPosition: station.position,
    blocked: project.value.stations.some(
      (other) => other.id !== node.id && other.position === target.position,
    ),
  };
}

function finishDrag({ node }: NodeDragEvent) {
  const target = snapNetworkPoint(node.position);
  drag.value = null;
  selection.value = { stationId: node.id };
  commit(() =>
    moveStation(project.value, node.id, target.lane, target.position),
  );
}

function add(direction: 'up' | 'down', branch: boolean) {
  if (!selectedStation.value) return;
  fitWhenNodesReady = true;
  const success = commit(() => {
    const result = addNeighbor(
      project.value,
      selectedStation.value!.id,
      direction,
      branch,
    );
    selection.value = { stationId: result.stationId };
    return result.project;
  });
  if (!success) fitWhenNodesReady = false;
}

function insert() {
  if (!selectedLink.value) return;
  commit(() => {
    const result = insertStation(project.value, selectedLink.value!);
    selection.value = { stationId: result.stationId };
    return result.project;
  });
}

function remove() {
  commit(() =>
    selectedStation.value
      ? removeStation(project.value, selectedStation.value.id)
      : selectedLink.value
        ? removeLink(project.value, selectedLink.value)
        : project.value,
  );
  selection.value = null;
  connectingFrom.value = null;
  syncGraph();
}

function clearSelection() {
  selection.value = null;
  connectingFrom.value = null;
  syncGraph();
}

function placeStation(event: MouseEvent) {
  if (!adding.value && event.detail !== 2) {
    clearSelection();
    return;
  }
  // 点击位置对应车站圆心；图库按节点左上角吸附，先扣除圆心偏移。
  const point = screenToFlowCoordinate({
    x: event.clientX - nodeCenter * viewport.value.zoom,
    y: event.clientY - nodeCenter * viewport.value.zoom,
  });
  const target = snapNetworkPoint(point);
  fitWhenNodesReady = true;
  const success = commit(() => {
    const result = addStationAt(project.value, target.lane, target.position);
    selection.value = { stationId: result.stationId };
    return result.project;
  });
  if (success) {
    adding.value = false;
  } else {
    fitWhenNodesReady = false;
  }
}

// 新站尺寸由图库异步测量；等节点就绪再调整视野，不能仅等待 Vue 更新。
function nodesReady() {
  if (!fitWhenNodesReady) return;
  fitWhenNodesReady = false;
  void refresh();
}

// Vue Flow 的默认方向键只移动画布节点；这里提交领域坐标，保持保存与撤销一致。
function keyboardEdit(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement;
  const stationId =
    target.closest<HTMLElement>('[data-station-id]')?.dataset.stationId;
  const linkKey =
    target.closest<HTMLElement>('[data-link-key]')?.dataset.linkKey;
  if (!stationId && !linkKey) return;
  if (
    ![
      'Enter',
      ' ',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Delete',
      'Backspace',
    ].includes(event.key)
  )
    return;

  event.preventDefault();
  event.stopPropagation();
  if (stationId) {
    selectStation(stationId);
    const station = selectedStation.value!;
    const distance = gridStep * (event.shiftKey ? 5 : 1);
    const lane = Math.max(
      0,
      Math.min(
        3,
        station.lane +
          (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
      ),
    );
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const position = vertical
      ? Math.max(
          0,
          Math.min(
            10000,
            Math.round(station.position / gridStep) * gridStep +
              (event.key === 'ArrowDown'
                ? distance
                : event.key === 'ArrowUp'
                  ? -distance
                  : 0),
          ),
        )
      : station.position;
    if (event.key.startsWith('Arrow'))
      commit(() => moveStation(project.value, station.id, lane, position));
  } else {
    const edge = edges.value.find((item) => item.id === linkKey);
    if (edge) selection.value = { link: edge.data.link };
    syncGraph();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') remove();
}

function saveName() {
  if (selectedStation.value)
    commit(() =>
      renameStation(project.value, selectedStation.value!.id, name.value),
    );
}
</script>

<template>
  <div class="network-graph-toolbar">
    <div class="toolbar-group">
      <NButton
        size="small"
        :type="adding ? 'primary' : 'default'"
        :disabled="project.stations.length >= 60"
        @click="
          adding = !adding;
          connectingFrom = null;
        "
      >
        <template #icon><Plus :size="15" /></template>
        添加车站
      </NButton>
      <NButton
        size="small"
        quaternary
        :disabled="!props.canUndo"
        aria-label="撤销线路修改"
        @click="emit('undo')"
      >
        <template #icon><Undo2 :size="16" /></template>
      </NButton>
      <NButton
        size="small"
        quaternary
        :disabled="!props.canRedo"
        aria-label="重做线路修改"
        @click="emit('redo')"
      >
        <template #icon><Redo2 :size="16" /></template>
      </NButton>
    </div>
    <div class="toolbar-group">
      <NButton
        size="small"
        quaternary
        aria-label="缩小线路图"
        @click="zoomOut()"
      >
        <template #icon><Minus :size="15" /></template>
      </NButton>
      <NButton
        size="small"
        quaternary
        aria-label="放大线路图"
        @click="zoomIn()"
      >
        <template #icon><Plus :size="15" /></template>
      </NButton>
      <NButton size="small" quaternary @click="fitNetwork()">
        <template #icon><Maximize2 :size="15" /></template>
        适合画布
      </NButton>
    </div>
  </div>
  <NAlert
    v-if="error"
    type="warning"
    closable
    class="notice"
    @close="error = ''"
  >
    {{ error }}
  </NAlert>
  <NAlert v-if="connectingFrom" type="info" class="notice">
    从 {{ stationName(connectingFrom) }} 连接：点选另一座车站。
    <NButton text @click="connectingFrom = null">取消</NButton>
  </NAlert>
  <div class="graph-editor-layout">
    <div
      class="network-canvas"
      aria-label="图形化线路编辑器"
      @keydown.capture="keyboardEdit"
    >
      <VueFlow
        id="network-editor"
        :nodes="nodes"
        snap-to-grid
        :snap-grid="snapGrid"
        :node-extent="nodeExtent"
        :edges="edges"
        :connection-mode="ConnectionMode.Loose"
        :delete-key-code="null"
        :multi-selection-key-code="null"
        :selection-key-code="null"
        :nodes-connectable="true"
        :zoom-on-double-click="false"
        :min-zoom="0.15"
        :max-zoom="2"
        fit-view-on-init
        @nodes-initialized="nodesReady"
        @node-click="selectStation($event.node.id)"
        @node-drag-start="previewDrag"
        @node-drag="previewDrag"
        @node-drag-stop="finishDrag"
        @connect="connect"
        @edge-click="
          selection = { link: $event.edge.data.link };
          connectingFrom = null;
          syncGraph();
        "
        @pane-click="placeStation"
      >
        <NetworkGrid :drag="drag" />
        <template #node-station="{ data, selected }">
          <div
            class="rail-node"
            :class="{ 'rail-node-selected': selected }"
            :style="{
              '--station-color': laneColors[data.lane],
              width: `${nodeWidth}px`,
              height: `${nodeHeight}px`,
            }"
          >
            <Handle
              id="top"
              type="target"
              :position="Position.Top"
              :style="{ left: `${nodeCenter}px` }"
            />
            <span class="rail-node-dot" />
            <span class="rail-node-name">{{ data.name }}</span>
            <Handle
              id="bottom"
              type="source"
              :position="Position.Bottom"
              :style="{ left: `${nodeCenter}px` }"
            />
          </div>
        </template>
        <template #edge-rail="edge"><RailEdge v-bind="edge" /></template>
      </VueFlow>
    </div>
    <aside class="graph-inspector">
      <template v-if="selectedStation">
        <NFormItem label="站名" size="small" :show-feedback="false">
          <NInput
            v-model:value="name"
            size="small"
            :maxlength="100"
            :input-props="{ 'aria-label': '选中车站名称' }"
            @change="saveName"
            @keydown.enter="saveName"
          />
        </NFormItem>
        <div class="graph-action-pair">
          <NButton size="small" @click="add('up', false)">
            <template #icon><ArrowUp :size="14" /></template>
            向上延伸
          </NButton>
          <NButton size="small" @click="add('down', false)">
            <template #icon><ArrowDown :size="14" /></template>
            向下延伸
          </NButton>
        </div>
        <NButton
          size="small"
          :disabled="selectedStation.lane >= 3"
          @click="add('up', true)"
        >
          从上方汇入支线
        </NButton>
        <NButton
          size="small"
          :disabled="selectedStation.lane >= 3"
          @click="add('down', true)"
        >
          向下分出支线
        </NButton>
        <NButton
          size="small"
          :type="connectingFrom ? 'primary' : 'default'"
          @click="connectingFrom = connectingFrom ? null : selectedStation.id"
        >
          连接车站
        </NButton>
        <NTooltip :disabled="!stationUsed">
          <template #trigger>
            <span>
              <NButton
                size="small"
                block
                type="error"
                secondary
                :disabled="stationUsed || project.stations.length <= 2"
                @click="remove"
              >
                删除车站
              </NButton>
            </span>
          </template>
          这座车站仍有列车到发
        </NTooltip>
      </template>
      <template v-else-if="selectedLink">
        <h3>
          {{ stationName(selectedLink.from) }} —
          {{ stationName(selectedLink.to) }}
        </h3>
        <NButton size="small" @click="insert">在线路中插站</NButton>
        <NButton size="small" type="error" secondary @click="remove">
          删除连接
        </NButton>
      </template>
      <p v-else class="form-help">
        点选车站或连线编辑；拖动车站调整位置。拖动上下端点连接车站，双击空白新增车站。
      </p>
    </aside>
  </div>
</template>

<style scoped>
.network-graph-toolbar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.graph-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 20px;
}
.network-canvas {
  position: relative;
  overflow: hidden;
  height: 480px;
  min-height: 300px;
  border: 1px solid #dce3db;
  border-radius: 8px;
  background: #fafbf8;
}
.graph-inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.graph-action-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.rail-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 6px;
  border-radius: 6px;
}
.rail-node-selected {
  background: #e0eee4;
  outline: 1px solid #326b57;
}
.rail-node-dot {
  width: 16px;
  height: 16px;
  border: 3px solid var(--station-color);
  background: white;
  border-radius: 50%;
  flex-shrink: 0;
}
.rail-node-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rail-node :deep(.vue-flow__handle) {
  background: var(--station-color);
  border-color: white;
  width: 7px;
  height: 7px;
}
@media (max-width: 680px) {
  .graph-editor-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .network-canvas {
    height: 340px;
  }
}
</style>
