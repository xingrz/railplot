<script setup lang="ts">
import { NConfigProvider, NDialogProvider, dateZhCN, zhCN } from 'naive-ui';
import RailplotWorkspace from './components/RailplotWorkspace.vue';
import { theme } from './theme';
</script>

<template>
  <NConfigProvider
    :theme-overrides="theme"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NDialogProvider>
      <RailplotWorkspace />
    </NDialogProvider>
  </NConfigProvider>
</template>
