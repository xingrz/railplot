<script setup lang="ts">
import { NButton, NForm, NFormItem, NInputNumber } from 'naive-ui';
import { Plus } from 'lucide-vue-next';
import CommitInput from './CommitInput.vue';
import CommitColorPicker from './CommitColorPicker.vue';
import type { Project } from '../model';

const project = defineModel<Project>('project', { required: true });

function addGroup() {
  project.value.groups.push({
    id: crypto.randomUUID(),
    name: '新分组',
    color: '#587eaf',
  });
}
</script>

<template>
  <NForm size="small" :show-feedback="false" class="settings-form">
    <NFormItem label="工程名称">
      <CommitInput v-model="project.name" label="工程名称" :maxlength="100" />
    </NFormItem>
    <div class="form-row">
      <NFormItem label="开始时间">
        <CommitInput
          v-model="project.time.start"
          label="开始时间"
          placeholder="00:00"
          :maxlength="5"
        />
      </NFormItem>
      <NFormItem label="结束时间">
        <CommitInput
          v-model="project.time.end"
          label="结束时间"
          placeholder="02:00"
          :maxlength="5"
        />
      </NFormItem>
    </div>
    <NFormItem label="主网格间隔（分钟）">
      <NInputNumber
        :value="project.time.grid"
        :min="1"
        :max="60"
        :precision="0"
        :update-value-on-input="false"
        :input-props="{ 'aria-label': '主网格间隔（分钟）' }"
        @update:value="project.time.grid = $event ?? 1"
      />
    </NFormItem>
    <section>
      <h3>列车分组</h3>
      <div v-for="group in project.groups" :key="group.id" class="group-row">
        <CommitInput v-model="group.name" label="分组名称" :maxlength="100" />
        <CommitColorPicker v-model="group.color" label="分组颜色" />
      </div>
      <NButton
        text
        size="small"
        :disabled="project.groups.length >= 20"
        @click="addGroup"
      >
        <template #icon><Plus :size="14" /></template>
        添加分组
      </NButton>
    </section>
    <p class="form-help">
      时间支持跨日，例如 23:00 —
      25:00。图幅之外的列车会被裁切，工程仍保留完整时刻。
    </p>
  </NForm>
</template>
