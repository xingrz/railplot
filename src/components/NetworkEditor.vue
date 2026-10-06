<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NFormItem, NInputNumber, NSelect, NTable } from 'naive-ui';
import { ArrowRight, GitBranch, Plus, Trash2, X } from 'lucide-vue-next';
import CommitInput from './CommitInput.vue';
import type { Project } from '../model';

const project = defineModel<Project>('project', { required: true });
const branchFrom = ref(
  project.value.stations[2]?.id ?? project.value.stations[0].id,
);
const stationOptions = computed(() =>
  project.value.stations.map((station) => ({
    label: station.name,
    value: station.id,
  })),
);
const laneOptions = [0, 1, 2, 3].map((lane) => ({
  label: `${lane} · ${lane === 0 ? '主线' : '支线'}`,
  value: lane,
}));

function stationInUse(id: string) {
  return project.value.trains.some((train) =>
    train.stops.some((stop) => stop.station === id),
  );
}

function addStation(branch: boolean) {
  const stations = [...project.value.stations].sort(
    (a, b) => a.position - b.position,
  );
  const anchor =
    stations.find((station) => station.id === branchFrom.value) ??
    stations.at(-1)!;
  let position = branch ? anchor.position + 8 : stations.at(-1)!.position + 15;
  while (stations.some((station) => station.position === position)) position++;

  const id = crypto.randomUUID();
  project.value.stations.push({
    id,
    name: branch ? '支线新站' : '新车站',
    position,
    lane: branch ? Math.min(anchor.lane + 1, 3) : anchor.lane,
  });
  project.value.links.push({ from: anchor.id, to: id });
}

function removeStation(id: string) {
  if (stationInUse(id) || project.value.stations.length <= 2) return;

  project.value.stations = project.value.stations.filter(
    (station) => station.id !== id,
  );
  project.value.links = project.value.links.filter(
    (link) => link.from !== id && link.to !== id,
  );
  if (branchFrom.value === id) branchFrom.value = project.value.stations[0].id;
}

function addLink() {
  const stations = [...project.value.stations].sort(
    (a, b) => a.position - b.position,
  );
  project.value.links.push({ from: stations[0].id, to: stations.at(-1)!.id });
}
</script>

<template>
  <p class="form-help">
    站位从上向下递增。主线放在第 0 列，支线放在第 1–3
    列；站位决定运行图纵向间距，不代表实际里程。
  </p>
  <div class="table-scroll">
    <NTable size="small" :bordered="false" class="network-table">
      <thead>
        <tr>
          <th>车站</th>
          <th>站位</th>
          <th>线路列</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="station in project.stations" :key="station.id">
          <td>
            <CommitInput
              v-model="station.name"
              label="车站名称"
              :maxlength="100"
            />
          </td>
          <td>
            <NInputNumber
              :value="station.position"
              size="small"
              :show-button="false"
              :update-value-on-input="false"
              :input-props="{ 'aria-label': '站位' }"
              @update:value="station.position = $event ?? 0"
            />
          </td>
          <td>
            <NSelect
              filterable
              v-model:value="station.lane"
              size="small"
              :options="laneOptions"
              :input-props="{ 'aria-label': '线路列' }"
            />
          </td>
          <td>
            <NButton
              size="small"
              quaternary
              type="error"
              :disabled="
                project.stations.length <= 2 || stationInUse(station.id)
              "
              :title="
                stationInUse(station.id) ? '这座车站仍有列车到发' : '删除车站'
              "
              :aria-label="`删除 ${station.name}`"
              @click="removeStation(station.id)"
            >
              <template #icon><Trash2 :size="14" /></template>
            </NButton>
          </td>
        </tr>
      </tbody>
    </NTable>
  </div>
  <div class="network-add">
    <NFormItem label="接轨站" size="small" :show-feedback="false">
      <NSelect
        filterable
        v-model:value="branchFrom"
        size="small"
        :options="stationOptions"
        :input-props="{ 'aria-label': '接轨站' }"
      />
    </NFormItem>
    <NButton
      size="small"
      :disabled="project.stations.length >= 60"
      @click="addStation(false)"
    >
      <template #icon><Plus :size="14" /></template>
      向下延伸
    </NButton>
    <NButton
      size="small"
      :disabled="project.stations.length >= 60"
      @click="addStation(true)"
    >
      <template #icon><GitBranch :size="14" /></template>
      引出支线
    </NButton>
  </div>
  <h3>线路连接</h3>
  <div
    v-for="(link, index) in project.links"
    :key="index"
    class="connection-row"
  >
    <NSelect
      filterable
      v-model:value="link.from"
      size="small"
      :options="stationOptions"
      :input-props="{ 'aria-label': '连接起站' }"
    />
    <ArrowRight :size="15" />
    <NSelect
      filterable
      v-model:value="link.to"
      size="small"
      :options="stationOptions"
      :input-props="{ 'aria-label': '连接终站' }"
    />
    <NButton
      size="small"
      quaternary
      aria-label="删除连接"
      @click="project.links.splice(index, 1)"
    >
      <template #icon><X :size="14" /></template>
    </NButton>
  </div>
  <NButton text size="small" @click="addLink">
    <template #icon><Plus :size="14" /></template>
    添加连接
  </NButton>
</template>
