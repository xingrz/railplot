<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NForm, NFormItem, NSelect, NTable, NTag } from 'naive-ui';
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2, X } from 'lucide-vue-next';
import CommitInput from './CommitInput.vue';
import CommitColorPicker from './CommitColorPicker.vue';
import { minutes, timeString, trainColor } from '../model';
import type { Project, Stop, Train } from '../model';

const props = defineProps<{ project: Project }>();
const train = defineModel<Train>('train', { required: true });
const emit = defineEmits<{
  duplicate: [];
  remove: [];
  shift: [delta: number];
}>();

const stationOptions = computed(() =>
  [...props.project.stations]
    .sort((a, b) => a.position - b.position)
    .map((station) => ({ label: station.name, value: station.id })),
);
const groupOptions = computed(() =>
  props.project.groups.map((group) => ({
    label: group.name,
    value: group.id,
  })),
);
const stationName = (id: string) =>
  props.project.stations.find((station) => station.id === id)?.name ?? '未知站';

function dwell(stop: Stop): string {
  const duration = minutes(stop.departure) - minutes(stop.arrival);
  if (!Number.isFinite(duration) || duration < 0) return '待修正';
  return duration === 0 ? '通过' : `${duration} 分钟`;
}

function addStop() {
  const last = train.value.stops.at(-1)!;
  const time = timeString(Math.min(minutes(last.departure) + 5, 4319));
  const link = props.project.links.find((link) => link.from === last.station);
  train.value.stops.push({
    station: link?.to ?? last.station,
    arrival: time,
    departure: time,
  });
}
</script>

<template>
  <div class="panel-heading schedule-heading">
    <div class="selected-title">
      <span
        class="train-color"
        :style="{ background: trainColor(project, train) }"
      />
      <h2>{{ train.name }}</h2>
      <span class="muted">
        {{ stationName(train.stops[0].station) }} →
        {{ stationName(train.stops.at(-1)!.station) }}
      </span>
    </div>
    <div class="toolbar-group">
      <NButton size="small" quaternary @click="emit('duplicate')">
        <template #icon><Copy :size="14" /></template>
        复制
      </NButton>
      <NButton
        size="small"
        quaternary
        type="error"
        aria-label="删除列车"
        title="删除列车，可撤销"
        @click="emit('remove')"
      >
        <template #icon><Trash2 :size="15" /></template>
      </NButton>
    </div>
  </div>
  <NForm class="train-properties" size="small" :show-feedback="false">
    <NFormItem label="车次" class="train-name-field">
      <CommitInput v-model="train.name" label="车次" :maxlength="100" />
    </NFormItem>
    <NFormItem label="分组" class="train-group-field">
      <NSelect
        filterable
        :value="train.group ?? null"
        :options="groupOptions"
        clearable
        placeholder="不分组"
        :input-props="{ 'aria-label': '分组' }"
        @update:value="train.group = $event ?? undefined"
      />
    </NFormItem>
    <NFormItem label="线条颜色" class="train-color-field">
      <CommitColorPicker
        :model-value="trainColor(project, train)"
        label="线条颜色"
        @update:model-value="train.color = $event"
      />
    </NFormItem>
    <NButton v-if="train.color" size="small" @click="delete train.color">
      {{ train.group ? '跟随分组' : '恢复默认' }}
    </NButton>
    <div class="shift-controls">
      <span class="muted">整趟平移</span>
      <NButton size="small" aria-label="提前 1 分钟" @click="emit('shift', -1)">
        <template #icon><ArrowLeft :size="13" /></template>
        1 分钟
      </NButton>
      <NButton size="small" aria-label="推迟 1 分钟" @click="emit('shift', 1)">
        <template #icon><ArrowRight :size="13" /></template>
        1 分钟
      </NButton>
    </div>
  </NForm>
  <div class="stop-table-wrap">
    <NTable
      size="small"
      :bordered="false"
      :single-line="true"
      class="stop-table"
    >
      <thead>
        <tr>
          <th>序</th>
          <th>车站</th>
          <th>到达</th>
          <th>出发</th>
          <th>停站</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(stop, index) in train.stops" :key="index">
          <td class="stop-index">{{ String(index + 1).padStart(2, '0') }}</td>
          <td class="station-cell">
            <NSelect
              filterable
              v-model:value="stop.station"
              :options="stationOptions"
              size="small"
              :input-props="{ 'aria-label': `第 ${index + 1} 站车站` }"
            />
          </td>
          <td>
            <CommitInput
              v-model="stop.arrival"
              class="time-input"
              :label="`第 ${index + 1} 站到达`"
              placeholder="00:00"
              :maxlength="5"
            />
          </td>
          <td>
            <CommitInput
              v-model="stop.departure"
              class="time-input"
              :label="`第 ${index + 1} 站出发`"
              placeholder="00:00"
              :maxlength="5"
            />
          </td>
          <td>
            <NTag
              size="small"
              :bordered="false"
              :type="stop.arrival === stop.departure ? 'default' : 'success'"
            >
              {{ dwell(stop) }}
            </NTag>
          </td>
          <td>
            <NButton
              size="small"
              quaternary
              :disabled="train.stops.length <= 2"
              :aria-label="`移除第 ${index + 1} 站`"
              @click="train.stops.splice(index, 1)"
            >
              <template #icon><X :size="14" /></template>
            </NButton>
          </td>
        </tr>
      </tbody>
    </NTable>
  </div>
  <div class="schedule-footer">
    <NButton text size="small" @click="addStop">
      <template #icon><Plus :size="14" /></template>
      添加到发站点
    </NButton>
    <span>到发相同即通过 · 跨日用 24:00、25:00</span>
  </div>
</template>
