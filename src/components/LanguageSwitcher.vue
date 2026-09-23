<script setup>
// 语言切换器：原生 select，跟随 vue-i18n，选择后写入 localStorage
import { useI18n } from 'vue-i18n'
import { LOCALES, setLocale } from '../i18n'

const { locale } = useI18n()
</script>

<template>
  <div class="relative inline-flex items-center">
    <select
      :value="locale"
      :aria-label="$t('lang.label')"
      @change="setLocale($event.target.value)"
      class="cursor-pointer appearance-none rounded-md border border-border bg-card py-1.5 pl-2.5 pr-7 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.label }}</option>
    </select>
    <svg class="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </div>
</template>
