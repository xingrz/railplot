<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';
import {
  NAlert,
  NButton,
  NCheckbox,
  NDropdown,
  NInput,
  NModal,
  NTag,
  useDialog,
} from 'naive-ui';
import {
  Activity,
  ArrowDownToLine,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Minus,
  Plus,
  Redo2,
  Save,
  Settings2,
  TrainFront,
  Undo2,
} from 'lucide-vue-next';
import Diagram from './Diagram.vue';
import TrainEditor from './TrainEditor.vue';
import ProjectSettings from './ProjectSettings.vue';
import {
  clone,
  minutes,
  moveTimePoint,
  parseProject,
  shiftTrain,
  timeString,
  trainColor,
} from '../model';
import type { Project, TimePointEdit, Train, TrainShift } from '../model';
import { demo } from '../demo';
import { useProjectState } from '../composables/useProjectState';
import { exportImage, saveProject } from '../export';

const {
  draft,
  valid,
  errors,
  selectedId,
  selected,
  notice,
  storageOK,
  history,
  historyIndex,
  travel,
} = useProjectState();

const diagram = ref<InstanceType<typeof Diagram>>();
const NetworkGraph = defineAsyncComponent(() => import('./NetworkGraph.vue'));
const networkEditor = ref<{ refresh: () => Promise<void> }>();

const zoom = ref(100);
const labels = ref(true);
const search = ref('');

const modal = ref<'network' | 'settings' | 'json' | null>(null);

const json = ref('');
const jsonError = ref('');

const dialog = useDialog();
const exportOptions = [
  { label: 'PNG 图片', key: 'png' },
  { label: 'PDF 矢量文档', key: 'pdf' },
  { label: 'SVG 矢量图', key: 'svg' },
];
const modalTitle = computed(() =>
  modal.value === 'network'
    ? '编辑线路'
    : modal.value === 'settings'
      ? '图表设置'
      : '工程数据',
);
const busy = ref(false);
const visibleTrains = computed(() =>
  draft.value.trains.filter((t) =>
    t.name.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

const outside = computed(
  () =>
    valid.value.trains.filter((t) =>
      t.stops.some(
        (s) =>
          minutes(s.arrival) < minutes(valid.value.time.start) ||
          minutes(s.departure) > minutes(valid.value.time.end),
      ),
    ).length,
);

function toggleTrainSelection(id: string) {
  selectedId.value = selectedId.value === id ? '' : id;
}

function editTimePoint(edit: TimePointEdit) {
  const index = draft.value.trains.findIndex(
    (train) => train.id === edit.trainId,
  );
  if (index < 0 || errors.value.length) return;

  draft.value.trains[index] = moveTimePoint(
    draft.value.trains[index],
    edit.stopIndex,
    edit.kind,
    edit.minute,
  );
}

function replace(project: Project) {
  draft.value = project;
  selectedId.value = project.trains[0]?.id ?? '';
  search.value = '';
  modal.value = null;
}

function newProject() {
  dialog.warning({
    title: '新建工程',
    content: '当前内容可通过撤销恢复。需要保留的工程请先下载保存。',
    positiveText: '新建',
    negativeText: '取消',
    onPositiveClick: () =>
      replace({ ...demo(), name: '未命名运行图', trains: [] }),
  });
}

function addTrain() {
  const stations = [...draft.value.stations].sort(
    (a, b) => a.position - b.position,
  );
  const start = minutes(valid.value.time.start);
  const train: Train = {
    id: crypto.randomUUID(),
    name: `新车次 ${draft.value.trains.length + 1}`,
    group: draft.value.groups[0]?.id,
    stops: stations.slice(0, 2).map((s, i) => ({
      station: s.id,
      arrival: timeString(start + i * 5),
      departure: timeString(start + i * 5),
    })),
  };
  draft.value.trains.push(train);
  selectedId.value = train.id;
  search.value = '';
}

function duplicate() {
  if (!selected.value) return;

  const t = clone(selected.value);
  t.id = crypto.randomUUID();
  t.name += ' 副本';
  draft.value.trains.push(t);
  selectedId.value = t.id;
}

function removeTrain() {
  if (!selected.value) return;

  const i = draft.value.trains.findIndex((t) => t.id === selectedId.value);
  draft.value.trains.splice(i, 1);
  selectedId.value = draft.value.trains[Math.max(0, i - 1)]?.id ?? '';
}

function shiftById(edit: TrainShift) {
  const index = draft.value.trains.findIndex(
    (train) => train.id === edit.trainId,
  );
  if (index < 0 || errors.value.length) return;

  try {
    draft.value.trains[index] = shiftTrain(
      draft.value.trains[index],
      edit.delta,
    );
    selectedId.value = edit.trainId;
  } catch (e) {
    notice.value = (e as Error).message;
  }
}

function shift(delta: number) {
  if (selected.value) shiftById({ trainId: selected.value.id, delta });
}

function openJson() {
  json.value = JSON.stringify(draft.value, null, 2);
  jsonError.value = '';
  modal.value = 'json';
}

function applyJson() {
  try {
    replace(parseProject(json.value));
    notice.value = '工程数据已更新。';
  } catch (e) {
    jsonError.value = (e as Error).message;
  }
}

const fileInput = ref<HTMLInputElement>();

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (file.size > 5_000_000) throw new Error('工程文件不能超过 5 MB。');
    const project = parseProject(await file.text());
    replace(project);
    notice.value = `已打开 ${file.name}；可撤销返回之前的工程。`;
  } catch (e) {
    notice.value = (e as Error).message;
  } finally {
    input.value = '';
  }
}

function save() {
  if (errors.value.length) return;

  saveProject(valid.value);
  notice.value = '工程文件已交给浏览器下载。';
}

async function render(format: string) {
  if (format !== 'png' && format !== 'pdf' && format !== 'svg') return;
  if (errors.value.length || !diagram.value?.svg) return;
  busy.value = true;
  try {
    await exportImage(diagram.value.svg, valid.value, format);
    notice.value = `${format.toUpperCase()} 已导出。`;
  } catch (e) {
    notice.value = `导出失败：${(e as Error).message}`;
  } finally {
    busy.value = false;
  }
}

function shortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
  const editing = (e.target as HTMLElement)?.matches('input,textarea,select');
  if (!editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    void travel(e.shiftKey ? 1 : -1);
  }
}

onMounted(() => window.addEventListener('keydown', shortcut));

onUnmounted(() => window.removeEventListener('keydown', shortcut));
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a
        class="brand"
        href="#"
        @click.prevent="selectedId = ''"
        aria-label="Railplot 总览"
      >
        <span class="brand-icon"><Activity :size="23" /></span>
        <strong>
          Railplot
          <span>列车谱</span>
        </strong>
      </a>
      <div class="header-divider" />
      <span class="project-name">{{ draft.name }}</span>
      <span v-if="errors.length || !storageOK" class="save-state warning">
        {{ errors.length ? '修改待修正' : '自动保存失败，请下载工程' }}
      </span>
      <nav class="header-actions" aria-label="工程操作">
        <NButton
          size="small"
          quaternary
          title="新建工程"
          aria-label="新建工程"
          @click="newProject"
        >
          <template #icon><FilePlus2 :size="17" /></template>
        </NButton>
        <NButton size="small" quaternary @click="fileInput?.click()">
          <template #icon><FolderOpen :size="16" /></template>
          打开
        </NButton>
        <NButton size="small" :disabled="!!errors.length" @click="save">
          <template #icon><Save :size="16" /></template>
          保存工程
        </NButton>
        <NDropdown
          trigger="click"
          :options="exportOptions"
          :disabled="busy || !!errors.length"
          @select="render"
        >
          <NButton
            type="primary"
            :loading="busy"
            :disabled="busy || !!errors.length"
          >
            <template #icon><ArrowDownToLine :size="16" /></template>
            {{ busy ? '正在渲染…' : '导出图表' }}
          </NButton>
        </NDropdown>
      </nav>
      <input
        ref="fileInput"
        hidden
        type="file"
        accept=".railplot,.json,application/json"
        @change="importFile"
      />
    </header>
    <main>
      <NAlert v-if="notice" closable class="notice" @close="notice = ''">
        {{ notice }}
      </NAlert>
      <NAlert
        v-if="errors.length"
        type="warning"
        title="暂未应用这次修改，图表保留最近有效版本。"
        class="error-banner"
      >
        <div v-for="error in errors.slice(0, 4)" :key="error">{{ error }}</div>
        <small>请修正输入或撤销；修正前不会覆盖本地保存。</small>
      </NAlert>
      <section class="workspace">
        <div class="workspace-toolbar">
          <div class="toolbar-group">
            <span class="workspace-title">
              <Activity :size="16" />
              运行图
            </span>
            <NTag size="small" :bordered="false">
              {{ valid.time.start }} — {{ valid.time.end }}
            </NTag>
            <span v-if="outside" class="outside">
              {{ outside }} 趟列车超出图幅
            </span>
          </div>
          <div class="toolbar-group">
            <NButton size="small" quaternary @click="modal = 'network'">
              <template #icon><GitBranch :size="15" /></template>
              编辑线路
            </NButton>
            <NButton size="small" quaternary @click="modal = 'settings'">
              <template #icon><Settings2 :size="15" /></template>
              图表设置
            </NButton>
            <div class="toolbar-divider" />
            <NButton
              size="small"
              quaternary
              :disabled="historyIndex === 0"
              @click="travel(-1)"
              aria-label="撤销"
              title="撤销"
            >
              <template #icon><Undo2 :size="16" /></template>
            </NButton>
            <NButton
              size="small"
              quaternary
              :disabled="historyIndex === history.length - 1"
              @click="travel(1)"
              aria-label="重做"
              title="重做"
            >
              <template #icon><Redo2 :size="16" /></template>
            </NButton>
            <div class="toolbar-divider" />
            <NCheckbox
              v-model:checked="labels"
              size="small"
              class="display-option"
            >
              车次标签
            </NCheckbox>
            <NButton
              size="small"
              quaternary
              :disabled="zoom <= 100"
              @click="zoom -= 25"
              aria-label="缩小"
            >
              <template #icon><Minus :size="14" /></template>
            </NButton>
            <NButton
              size="small"
              quaternary
              @click="zoom = 100"
              title="恢复缩放"
            >
              {{ zoom }}%
            </NButton>
            <NButton
              size="small"
              quaternary
              :disabled="zoom >= 250"
              @click="zoom += 25"
              aria-label="放大"
            >
              <Plus :size="14" />
            </NButton>
          </div>
        </div>
        <Diagram
          ref="diagram"
          :project="valid"
          :selected="selectedId"
          :zoom="zoom"
          :labels="labels"
          @select="toggleTrainSelection"
          @edit-time="editTimePoint"
          @shift-train="shiftById"
        />
      </section>
      <section class="editor-grid">
        <aside class="train-panel">
          <div class="panel-heading">
            <h2>
              <TrainFront :size="16" />
              列车
            </h2>
            <NButton
              size="small"
              quaternary
              @click="addTrain"
              aria-label="添加列车"
              title="添加列车"
            >
              <template #icon><Plus :size="16" /></template>
            </NButton>
          </div>
          <div class="search">
            <NInput
              v-model:value="search"
              size="small"
              clearable
              placeholder="查找车次…"
              :input-props="{ 'aria-label': '查找车次' }"
            />
          </div>
          <div class="train-list">
            <NButton
              size="small"
              block
              :type="selectedId === train.id ? 'primary' : 'default'"
              :tertiary="selectedId === train.id"
              :quaternary="selectedId !== train.id"
              class="train-item"
              v-for="train in visibleTrains"
              :key="train.id"
              :aria-pressed="selectedId === train.id"
              @click="toggleTrainSelection(train.id)"
            >
              <span class="train-item-content">
                <span
                  class="train-color"
                  :style="{ background: trainColor(draft, train) }"
                />
                <strong>{{ train.name }}</strong>
                <span>
                  {{ draft.groups.find((c) => c.id === train.group)?.name }}
                </span>
                <span class="train-time">{{ train.stops[0]?.departure }}</span>
              </span>
            </NButton>
            <p v-if="!visibleTrains.length" class="empty-small">
              {{ search ? '没有匹配的车次' : '添加第一趟列车，开始编排。' }}
            </p>
          </div>
        </aside>
        <section class="schedule-panel">
          <TrainEditor
            v-if="selected"
            :key="selected.id"
            :project="draft"
            v-model:train="selected"
            @duplicate="duplicate"
            @remove="removeTrain"
            @shift="shift"
          />
          <div v-else class="empty-state">
            <TrainFront :size="32" />
            <h2>未选择列车</h2>
            <p>点选上方运行线或左侧车次，编辑到发时刻。</p>
            <NButton size="small" type="primary" @click="addTrain">
              <template #icon><Plus :size="15" /></template>
              添加列车
            </NButton>
          </div>
        </section>
      </section>
      <footer class="page-footer">
        <NButton size="small" text @click="openJson">工程数据</NButton>
      </footer>
    </main>
    <NModal
      :show="modal !== null"
      preset="card"
      :title="modalTitle"
      :aria-label="modalTitle"
      :style="{
        width:
          modal === 'settings'
            ? '460px'
            : modal === 'network'
              ? '1040px'
              : '740px',
        maxWidth: 'calc(100vw - 32px)',
      }"
      :content-style="{ maxHeight: '65vh', overflow: 'auto' }"
      @update:show="!$event && (modal = null)"
      @after-enter="networkEditor?.refresh()"
    >
      <ProjectSettings v-if="modal === 'settings'" v-model:project="draft" />
      <NetworkGraph
        ref="networkEditor"
        v-else-if="modal === 'network'"
        v-model:project="draft"
        :can-undo="historyIndex > 0"
        :can-redo="historyIndex < history.length - 1"
        @undo="travel(-1)"
        @redo="travel(1)"
      />
      <template v-else>
        <p class="form-help">
          .railplot 是带版本号的 JSON 文件。可在这里批量编辑，校验通过后再应用。
        </p>
        <NInput
          v-model:value="json"
          type="textarea"
          :rows="20"
          :input-props="{ 'aria-label': '工程 JSON', spellcheck: false }"
          class="json-editor"
        />
        <NAlert v-if="jsonError" type="error" class="json-error">
          {{ jsonError }}
        </NAlert>
      </template>
      <template #footer>
        <div class="modal-footer">
          <span v-if="modal !== 'json' && errors.length" class="json-error">
            {{ errors[0] }}
          </span>
          <NButton v-if="modal === 'json'" type="primary" @click="applyJson">
            应用数据
          </NButton>
          <NButton
            v-else
            :type="modal === 'network' ? 'default' : 'primary'"
            @click="modal = null"
          >
            {{ modal === 'network' ? '关闭' : '完成' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
