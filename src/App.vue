<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Minus,
  Plus,
  Redo2,
  Save,
  Settings2,
  TrainFront,
  Trash2,
  Undo2,
  X,
} from 'lucide-vue-next';
import Diagram from './components/Diagram.vue';
import {
  clone,
  minutes,
  parseProject,
  shiftTrain,
  timeString,
  trainColor,
  validate,
} from './model';
import type { Project, Train } from './model';
import { demo } from './demo';
import { exportImage, saveProject } from './export';

const storageKey = 'railplot.project.v1';

const notice = ref('');

function load(): Project {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseProject(saved) : demo();
  } catch {
    notice.value =
      '本地记录无法读取，已载入示例；原记录未被覆盖，首次编辑后才会保存。';
    return demo();
  }
}

const draft = ref<Project>(load());

const valid = ref(clone(draft.value));

const errors = computed(() => validate(draft.value));

const selectedId = ref(draft.value.trains[0]?.id ?? '');

const selected = computed(() =>
  draft.value.trains.find((t) => t.id === selectedId.value),
);

const diagram = ref<InstanceType<typeof Diagram>>();

const zoom = ref(100);
const labels = ref(true);
const search = ref('');

const modal = ref<'network' | 'settings' | 'json' | null>(null);

const json = ref('');
const jsonError = ref('');

const exportMenu = ref(false);
const busy = ref(false);
const storageOK = ref(true);

const history = ref<string[]>([JSON.stringify(draft.value)]);
const historyIndex = ref(0);

let navigating = false;

watch(
  draft,
  () => {
    if (navigating) return;
    const snapshot = JSON.stringify(draft.value);
    history.value = history.value.slice(0, historyIndex.value + 1);
    history.value.push(snapshot);
    if (history.value.length > 100) history.value.shift();
    historyIndex.value = history.value.length - 1;
    if (!errors.value.length) {
      valid.value = clone(draft.value);
      try {
        localStorage.setItem(storageKey, snapshot);
        storageOK.value = true;
      } catch {
        storageOK.value = false;
      }
    }
  },
  { deep: true },
);

async function travel(delta: number) {
  const index = historyIndex.value + delta;
  if (index < 0 || index >= history.value.length) return;
  navigating = true;
  historyIndex.value = index;
  draft.value = JSON.parse(history.value[index]);
  if (!validate(draft.value).length) {
    valid.value = clone(draft.value);
    try {
      localStorage.setItem(storageKey, history.value[index]);
      storageOK.value = true;
    } catch {
      storageOK.value = false;
    }
  }
  await nextTick();

  navigating = false;
}

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

const stationName = (id: string) =>
  draft.value.stations.find((s) => s.id === id)?.name ?? '未知站';

function replace(project: Project) {
  draft.value = project;
  selectedId.value = project.trains[0]?.id ?? '';
  search.value = '';
  modal.value = null;
}

function newProject() {
  if (confirm('新建工程？当前内容可通过撤销恢复，建议先保存工程文件。'))
    replace({ ...demo(), name: '未命名运行图', trains: [] });
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

function shift(delta: number) {
  if (!selected.value) return;

  try {
    const i = draft.value.trains.indexOf(selected.value);
    draft.value.trains[i] = shiftTrain(selected.value, delta);
  } catch (e) {
    notice.value = (e as Error).message;
  }
}

function addStop() {
  if (!selected.value) return;

  const last = selected.value.stops.at(-1)!;
  const t = Math.min(minutes(last.departure) + 5, 4319);
  const link = draft.value.links.find((l) => l.from === last.station);
  selected.value.stops.push({
    station: link?.to ?? last.station,
    arrival: timeString(t),
    departure: timeString(t),
  });
}

function addStation(branch = false) {
  const sorted = [...draft.value.stations].sort(
    (a, b) => a.position - b.position,
  );
  const anchor =
    draft.value.stations.find((s) => s.id === branchFrom.value) ??
    sorted.at(-1)!;
  let position = branch
    ? anchor.position + 8
    : Math.max(...sorted.map((s) => s.position)) + 15;
  while (sorted.some((s) => s.position === position)) position++;
  const id = crypto.randomUUID();
  draft.value.stations.push({
    id,
    name: branch ? '支线新站' : '新车站',
    position,
    lane: branch ? Math.min(anchor.lane + 1, 3) : anchor.lane,
  });
  draft.value.links.push({ from: anchor.id, to: id });
}

const branchFrom = ref(
  draft.value.stations[2]?.id ?? draft.value.stations[0].id,
);

function removeStation(id: string) {
  if (draft.value.trains.some((t) => t.stops.some((s) => s.station === id))) {
    notice.value = '这座车站仍有列车到发，请先修改相关列车。';
    return;
  }
  if (draft.value.stations.length <= 2) {
    notice.value = '至少保留两个车站。';
    return;
  }
  draft.value.stations = draft.value.stations.filter((s) => s.id !== id);
  draft.value.links = draft.value.links.filter(
    (l) => l.from !== id && l.to !== id,
  );
}

function addGroup() {
  draft.value.groups.push({
    id: crypto.randomUUID(),
    name: '新分组',
    color: '#587eaf',
  });
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

async function render(format: 'png' | 'pdf' | 'svg') {
  if (errors.value.length || !diagram.value?.svg) return;
  exportMenu.value = false;
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
  if (e.key === 'Escape') {
    modal.value = null;
    exportMenu.value = false;
  }
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
        <button
          class="icon-button"
          title="新建工程"
          aria-label="新建工程"
          @click="newProject"
        >
          <FilePlus2 :size="17" />
        </button>
        <button class="button quiet" @click="fileInput?.click()">
          <FolderOpen :size="16" />
          打开
        </button>
        <button class="button" :disabled="!!errors.length" @click="save">
          <Save :size="16" />
          保存工程
        </button>
        <div class="dropdown">
          <button
            class="button primary"
            :disabled="busy || !!errors.length"
            @click="exportMenu = !exportMenu"
          >
            <ArrowDownToLine :size="16" />
            {{ busy ? '正在渲染…' : '导出图表' }}
            <ChevronDown :size="13" />
          </button>
          <div v-if="exportMenu" class="dropdown-menu">
            <button @click="render('png')">
              PNG 图片
              <small>3× 高清</small>
            </button>
            <button @click="render('pdf')">
              PDF 文档
              <small>矢量图表</small>
            </button>
            <button @click="render('svg')">
              SVG 矢量图
              <small>可继续编辑</small>
            </button>
          </div>
        </div>
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
      <div v-if="notice" class="notice" role="status">
        <span>{{ notice }}</span>
        <button class="icon-button" @click="notice = ''" aria-label="关闭提示">
          <X :size="15" />
        </button>
      </div>
      <div v-if="errors.length" class="error-banner" role="alert">
        <strong>暂未应用这次修改，图表保留最近有效版本。</strong>
        <div v-for="error in errors.slice(0, 4)" :key="error">{{ error }}</div>
        <small>请修正输入或撤销；修正前不会覆盖本地保存。</small>
      </div>
      <section class="workspace">
        <div class="workspace-toolbar">
          <div class="toolbar-group">
            <span class="workspace-title">
              <Activity :size="16" />
              运行图
            </span>
            <span class="pill">
              {{ valid.time.start }} — {{ valid.time.end }}
            </span>
          </div>
          <div class="toolbar-group">
            <button class="button quiet compact" @click="modal = 'network'">
              <GitBranch :size="15" />
              编辑线路
            </button>
            <button class="button quiet compact" @click="modal = 'settings'">
              <Settings2 :size="15" />
              图表设置
            </button>
            <div class="toolbar-divider" />
            <button
              class="icon-button"
              :disabled="historyIndex === 0"
              @click="travel(-1)"
              aria-label="撤销"
              title="撤销"
            >
              <Undo2 :size="16" />
            </button>
            <button
              class="icon-button"
              :disabled="historyIndex === history.length - 1"
              @click="travel(1)"
              aria-label="重做"
              title="重做"
            >
              <Redo2 :size="16" />
            </button>
            <div class="toolbar-divider" />
            <button
              class="icon-button"
              :disabled="zoom <= 100"
              @click="zoom -= 25"
              aria-label="缩小"
            >
              <Minus :size="14" />
            </button>
            <button class="zoom-label" @click="zoom = 100" title="恢复缩放">
              {{ zoom }}%
            </button>
            <button
              class="icon-button"
              :disabled="zoom >= 250"
              @click="zoom += 25"
              aria-label="放大"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>
        <Diagram
          ref="diagram"
          :project="valid"
          :selected="selectedId"
          :zoom="zoom"
          :labels="labels"
          @select="selectedId = $event"
        />
        <div class="diagram-footer">
          <span v-if="outside" class="outside">
            {{ outside }} 趟列车超出图幅
          </span>
          <button class="text-button" @click="selectedId = ''">
            查看全部列车
          </button>
          <label class="checkbox">
            <input type="checkbox" v-model="labels" />
            车次标签
          </label>
        </div>
      </section>
      <section class="editor-grid">
        <aside class="train-panel">
          <div class="panel-heading">
            <h2>
              <TrainFront :size="16" />
              列车
            </h2>
            <button
              class="icon-button outlined"
              @click="addTrain"
              aria-label="添加列车"
              title="添加列车"
            >
              <Plus :size="16" />
            </button>
          </div>
          <input
            class="search"
            v-model="search"
            placeholder="查找车次…"
            aria-label="查找车次"
          />
          <div class="train-list">
            <button
              v-for="train in visibleTrains"
              :key="train.id"
              class="train-item"
              :class="{ active: selectedId === train.id }"
              @click="selectedId = train.id"
            >
              <span
                class="train-color"
                :style="{ background: trainColor(draft, train) }"
              />
              <strong>{{ train.name }}</strong>
              <span>
                {{ draft.groups.find((c) => c.id === train.group)?.name }}
              </span>
              <span class="train-time">{{ train.stops[0]?.departure }}</span>
            </button>
            <p v-if="!visibleTrains.length" class="empty-small">
              {{ search ? '没有匹配的车次' : '添加第一趟列车，开始编排。' }}
            </p>
          </div>
        </aside>
        <section class="schedule-panel">
          <template v-if="selected">
            <div class="panel-heading schedule-heading">
              <div class="selected-title">
                <span
                  class="train-color"
                  :style="{ background: trainColor(draft, selected) }"
                />
                <h2>{{ selected.name }}</h2>
                <span class="muted">
                  {{ stationName(selected.stops[0].station) }} →
                  {{ stationName(selected.stops.at(-1)!.station) }}
                </span>
              </div>
              <div class="toolbar-group">
                <button class="button quiet compact" @click="duplicate">
                  <Copy :size="14" />
                  复制
                </button>
                <button
                  class="icon-button danger"
                  @click="removeTrain"
                  aria-label="删除列车"
                  title="删除列车，可撤销"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>
            <div class="train-properties">
              <label>
                车次
                <input
                  v-model.lazy="selected.name"
                  aria-label="车次"
                  maxlength="100"
                />
              </label>
              <label>
                分组
                <select v-model="selected.group" aria-label="分组">
                  <option :value="undefined">不分组</option>
                  <option
                    v-for="group in draft.groups"
                    :key="group.id"
                    :value="group.id"
                  >
                    {{ group.name }}
                  </option>
                </select>
              </label>
              <label class="color-field">
                线条颜色
                <input
                  type="color"
                  :value="trainColor(draft, selected)"
                  @input="
                    selected.color = ($event.target as HTMLInputElement).value
                  "
                  aria-label="线条颜色"
                />
              </label>
              <button
                v-if="selected.color"
                class="button compact color-reset"
                @click="delete selected.color"
              >
                {{ selected.group ? '跟随分组' : '恢复默认' }}
              </button>
              <div class="shift-controls">
                <span>整趟平移</span>
                <button class="button compact" @click="shift(-1)">
                  <ArrowLeft :size="13" />
                  1 分钟
                </button>
                <button class="button compact" @click="shift(1)">
                  1 分钟
                  <ArrowRight :size="13" />
                </button>
              </div>
            </div>
            <div class="stop-table-wrap">
              <table class="stop-table">
                <thead>
                  <tr>
                    <th class="stop-index">序</th>
                    <th>车站</th>
                    <th>到达</th>
                    <th>出发</th>
                    <th>停站</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(stop, i) in selected.stops" :key="i">
                    <td class="stop-index">
                      {{ String(i + 1).padStart(2, '0') }}
                    </td>
                    <td>
                      <select
                        v-model="stop.station"
                        :aria-label="`第 ${i + 1} 站车站`"
                      >
                        <option
                          v-for="station in [...draft.stations].sort(
                            (a, b) => a.position - b.position,
                          )"
                          :key="station.id"
                          :value="station.id"
                        >
                          {{ station.name }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <input
                        v-model.lazy="stop.arrival"
                        class="time-input"
                        :aria-label="`第 ${i + 1} 站到达`"
                        placeholder="00:00"
                        maxlength="5"
                      />
                    </td>
                    <td>
                      <input
                        v-model.lazy="stop.departure"
                        class="time-input"
                        :aria-label="`第 ${i + 1} 站出发`"
                        placeholder="00:00"
                        maxlength="5"
                      />
                    </td>
                    <td>
                      <span
                        class="dwell"
                        :class="{ passing: stop.arrival === stop.departure }"
                      >
                        {{
                          stop.arrival === stop.departure
                            ? '通过'
                            : Number.isFinite(
                                  minutes(stop.departure) -
                                    minutes(stop.arrival),
                                )
                              ? `${minutes(stop.departure) - minutes(stop.arrival)} 分钟`
                              : '待修正'
                        }}
                      </span>
                    </td>
                    <td>
                      <button
                        class="icon-button"
                        :disabled="selected.stops.length <= 2"
                        @click="selected.stops.splice(i, 1)"
                        :aria-label="`移除第 ${i + 1} 站`"
                      >
                        <X :size="14" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="schedule-footer">
              <button class="text-button" @click="addStop">
                <Plus :size="14" />
                添加到发站点
              </button>
              <span>到发相同即通过 · 跨日用 24:00、25:00</span>
            </div>
          </template>
          <div v-else class="empty-state">
            <TrainFront :size="32" />
            <h2>未选择列车</h2>
            <p>点选上方运行线或左侧车次，编辑到发时刻。</p>
            <button class="button primary" @click="addTrain">
              <Plus :size="15" />
              添加列车
            </button>
          </div>
        </section>
      </section>
      <footer class="page-footer">
        <button class="text-button" @click="openJson">工程数据</button>
      </footer>
    </main>
    <div v-if="modal" class="modal-backdrop" @click.self="modal = null">
      <section
        class="modal"
        :class="{ 'wide-modal': modal !== 'settings' }"
        role="dialog"
        aria-modal="true"
        :aria-label="
          modal === 'network'
            ? '编辑线路'
            : modal === 'json'
              ? '工程数据'
              : '图表设置'
        "
      >
        <div class="panel-heading">
          <h2>
            {{
              modal === 'network'
                ? '编辑线路'
                : modal === 'json'
                  ? '工程数据'
                  : '图表设置'
            }}
          </h2>
          <button
            class="icon-button"
            aria-label="关闭面板"
            @click="modal = null"
          >
            <X :size="19" />
          </button>
        </div>
        <div v-if="modal === 'settings'" class="modal-content settings-form">
          <label>
            工程名称
            <input v-model.lazy="draft.name" />
          </label>
          <div class="form-row">
            <label>
              开始时间
              <input v-model.lazy="draft.time.start" placeholder="00:00" />
            </label>
            <label>
              结束时间
              <input v-model.lazy="draft.time.end" placeholder="01:12" />
            </label>
          </div>
          <label>
            主网格间隔（分钟）
            <input
              type="number"
              v-model.number.lazy="draft.time.grid"
              min="1"
              max="60"
            />
          </label>
          <h3>列车分组</h3>
          <div v-for="c in draft.groups" :key="c.id" class="group-row">
            <input v-model.lazy="c.name" aria-label="分组名称" />
            <input type="color" v-model="c.color" aria-label="分组颜色" />
          </div>
          <button class="text-button" @click="addGroup">
            <Plus :size="14" />
            添加分组
          </button>
          <p class="form-help">
            时间支持跨日，例如 23:00 —
            25:00。图幅之外的列车会被裁切，工程仍保留完整时刻。
          </p>
        </div>
        <div v-else-if="modal === 'network'" class="modal-content">
          <p class="form-help">
            站位从上向下递增。主线放在第 0 列，支线放在第 1–3
            列；站位决定运行图纵向间距，不代表实际里程。
          </p>
          <table class="network-table">
            <thead>
              <tr>
                <th>车站</th>
                <th>站位</th>
                <th>线路列</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in draft.stations" :key="s.id">
                <td><input v-model.lazy="s.name" aria-label="车站名称" /></td>
                <td>
                  <input
                    type="number"
                    v-model.number.lazy="s.position"
                    aria-label="站位"
                  />
                </td>
                <td>
                  <select v-model.number="s.lane" aria-label="线路列">
                    <option :value="0">0 · 主线</option>
                    <option v-for="i in 3" :key="i" :value="i">
                      {{ i }} · 支线
                    </option>
                  </select>
                </td>
                <td>
                  <button
                    class="icon-button danger"
                    @click="removeStation(s.id)"
                    :aria-label="`删除 ${s.name}`"
                  >
                    <Trash2 :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="network-add">
            <label>
              接轨站
              <select v-model="branchFrom">
                <option v-for="s in draft.stations" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </label>
            <button class="button" @click="addStation(false)">
              <Plus :size="14" />
              向下延伸
            </button>
            <button class="button" @click="addStation(true)">
              <GitBranch :size="14" />
              引出支线
            </button>
          </div>
          <h3>线路连接</h3>
          <div v-for="(link, i) in draft.links" :key="i" class="connection-row">
            <select v-model="link.from" aria-label="连接起站">
              <option v-for="s in draft.stations" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
            <ArrowRight :size="15" />
            <select v-model="link.to" aria-label="连接终站">
              <option v-for="s in draft.stations" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
            <button
              class="icon-button"
              @click="draft.links.splice(i, 1)"
              aria-label="删除连接"
            >
              <X :size="14" />
            </button>
          </div>
          <button
            class="text-button"
            @click="
              draft.links.push({
                from: [...draft.stations].sort(
                  (a, b) => a.position - b.position,
                )[0].id,
                to: [...draft.stations]
                  .sort((a, b) => a.position - b.position)
                  .at(-1)!.id,
              })
            "
          >
            <Plus :size="14" />
            添加连接
          </button>
        </div>
        <div v-else class="modal-content">
          <p class="form-help">
            .railplot 是带版本号的 JSON
            文件。可在这里批量编辑，校验通过后再应用。
          </p>
          <textarea
            class="json-editor"
            v-model="json"
            aria-label="工程 JSON"
            spellcheck="false"
          />
          <p v-if="jsonError" class="json-error" role="alert">
            {{ jsonError }}
          </p>
        </div>
        <div class="modal-footer">
          <span v-if="modal !== 'json' && errors.length" class="json-error">
            {{ errors[0] }}
          </span>
          <span v-else class="muted">
            {{ modal === 'json' ? '格式版本 1' : '修改即时生效，可随时撤销' }}
          </span>
          <button
            v-if="modal === 'json'"
            class="button primary"
            @click="applyJson"
          >
            <Check :size="15" />
            应用数据
          </button>
          <button v-else class="button primary" @click="modal = null">
            完成
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
