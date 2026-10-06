<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NAlert,
  NButton,
  NCheckbox,
  NFormItem,
  NInput,
  NSelect,
  NTag,
} from 'naive-ui';
import RouteLayer from './RouteLayer.vue';
import { geometry } from '../model';
import type { Project } from '../model';
import { planRoute } from '../network';

const props = defineProps<{ project: Project }>();
const emit = defineEmits<{ apply: [project: Project] }>();
const input = ref('');
const lane = ref(0);
const replaceNetwork = ref(false);
const laneOptions = [0, 1, 2, 3].map((value) => ({
  value,
  label: value === 0 ? '主线' : `支线 ${value}`,
}));

const preview = computed(() => {
  if (!input.value.trim()) return { plan: null, error: '' };
  try {
    return {
      plan: planRoute(
        props.project,
        input.value,
        lane.value,
        replaceNetwork.value,
      ),
      error: '',
    };
  } catch (error) {
    return { plan: null, error: (error as Error).message };
  }
});
const layout = computed(() =>
  preview.value.plan ? geometry(preview.value.plan.project) : null,
);
const changed = computed(
  () =>
    preview.value.plan &&
    (replaceNetwork.value ||
      preview.value.plan.addedStationIds.length ||
      preview.value.plan.addedLinkCount),
);

function apply() {
  if (preview.value.plan && changed.value)
    emit('apply', preview.value.plan.project);
}
</script>

<template>
  <div class="route-builder">
    <div class="route-builder-form">
      <p class="form-help">
        按图上从上到下输入站名，一行一个或用 →
        分隔。已有站名会复用，放在首尾即可接入支线。
      </p>
      <NFormItem label="站名顺序" size="small" :show-feedback="false">
        <NInput
          v-model:value="input"
          type="textarea"
          :rows="7"
          placeholder="广州北 → 长岗 → 大田 → 白云 → 广州西"
          :input-props="{ 'aria-label': '批量站名', spellcheck: false }"
        />
      </NFormItem>
      <NFormItem label="新增车站所在列" size="small" :show-feedback="false">
        <NSelect
          v-model:value="lane"
          :options="laneOptions"
          size="small"
          filterable
          :input-props="{ 'aria-label': '新增车站所在列' }"
        />
      </NFormItem>
      <NCheckbox
        v-model:checked="replaceNetwork"
        size="small"
        :disabled="project.trains.length > 0"
        :title="
          project.trains.length
            ? '工程仍有列车，可追加线路；新建工程后可替换线路'
            : undefined
        "
      >
        替换现有线路
      </NCheckbox>
      <NAlert v-if="preview.error" type="warning">{{ preview.error }}</NAlert>
      <template v-if="preview.plan">
        <div class="route-preview-stations">
          <template
            v-for="(station, index) in preview.plan.route"
            :key="station.id"
          >
            <span v-if="index" aria-hidden="true">→</span>
            <NTag
              size="small"
              :bordered="false"
              :type="
                preview.plan.addedStationIds.includes(station.id)
                  ? 'success'
                  : 'default'
              "
            >
              {{ station.name }}
            </NTag>
          </template>
        </div>
        <p class="muted">
          {{ preview.plan.addedStationIds.length }} 座新站，{{
            preview.plan.addedLinkCount
          }}
          条新连接；其余车站沿用现有站位。
        </p>
        <p v-if="preview.plan.shiftedPositions" class="muted">
          为容纳上方新站，站位将整体平移，已有站间距保持不变。
        </p>
      </template>
      <NButton type="primary" :disabled="!changed" @click="apply">
        {{ replaceNetwork ? '替换线路' : '添加线路' }}
      </NButton>
    </div>
    <svg
      v-if="preview.plan && layout"
      class="route-preview"
      :viewBox="`0 0 232 ${layout.height}`"
      role="img"
      aria-label="线路预览"
    >
      <RouteLayer :project="preview.plan.project" :layout="layout" />
    </svg>
  </div>
</template>
