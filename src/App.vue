<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import OpenCliPanel from '@/opencli/OpenCliPanel.vue'

// 保留路由功能
const DESIGN_WIDTH = 2560
const DESIGN_HEIGHT = 1440
const MAIN_CONTENT_HEIGHT = DESIGN_HEIGHT * 0.9 - 90
const SYSTEM_LOG_TABLE_HEIGHT = DESIGN_HEIGHT - 330

const route = useRoute()
const shouldUseAdaptiveStage = computed(() => route.path.startsWith('/simu'))
const shouldShowOpenCli = computed(() => {
  return route.path !== '/login' && route.query.mode !== 'playback'
})
const adaptiveStageStyle = ref<Record<string, string>>({})

const clearAdaptiveStage = () => {
  adaptiveStageStyle.value = {}
}

const applyAdaptiveStage = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (!shouldUseAdaptiveStage.value) {
    clearAdaptiveStage()
    return
  }

  const viewportWidth = window.innerWidth || DESIGN_WIDTH
  const viewportHeight = window.innerHeight || DESIGN_HEIGHT
  const scale = Math.max(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT)
  const scaledWidth = DESIGN_WIDTH * scale
  const scaledHeight = DESIGN_HEIGHT * scale
  const offsetX = (viewportWidth - scaledWidth) / 2
  const offsetY = scaledHeight > viewportHeight ? 0 : (viewportHeight - scaledHeight) / 2
  const visibleDesignHeight = Math.min(DESIGN_HEIGHT, viewportHeight / scale)
  const adaptiveMainContentHeight = Math.max(0, visibleDesignHeight * 0.9 - 90)
  const adaptiveSystemLogTableHeight = Math.max(0, visibleDesignHeight - 330)

  adaptiveStageStyle.value = {
    '--app-stage-width': `${DESIGN_WIDTH}px`,
    '--app-stage-height': `${DESIGN_HEIGHT}px`,
    '--app-main-content-height': `${adaptiveMainContentHeight || MAIN_CONTENT_HEIGHT}px`,
    '--system-log-table-height': `${adaptiveSystemLogTableHeight || SYSTEM_LOG_TABLE_HEIGHT}px`,
    '--app-scale': `${scale}`,
    '--app-offset-x': `${offsetX}px`,
    '--app-offset-y': `${offsetY}px`
  }
}

watch(shouldUseAdaptiveStage, () => {
  applyAdaptiveStage()
}, { immediate: true })

onMounted(() => {
  applyAdaptiveStage()
  window.addEventListener('resize', applyAdaptiveStage)
})

onUnmounted(() => {
  window.removeEventListener('resize', applyAdaptiveStage)
  clearAdaptiveStage()
})
</script>

<template>
  <div class="app-shell" :class="{ 'adaptive-layout-shell': shouldUseAdaptiveStage }">
    <div
      v-if="shouldUseAdaptiveStage"
      class="adaptive-layout-stage"
      :style="adaptiveStageStyle"
    >
      <RouterView class="router-view-container" />
    </div>
    <RouterView v-else class="router-view-container" />
    <OpenCliPanel v-if="shouldShowOpenCli" />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: black;
}

#app {
  width: 100%;
  height: 100%;
}

.app-shell {
  width: 100%;
  height: 100%;
}

.app-shell.adaptive-layout-shell {
  overflow: hidden;
  background-image: url('./assets/image/bg.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  background-color: #001a3a;
}

.adaptive-layout-stage {
  width: var(--app-stage-width);
  height: var(--app-stage-height);
  overflow: hidden;
  transform-origin: top left;
  transform: translate(var(--app-offset-x), var(--app-offset-y)) scale(var(--app-scale));
}

/* 确保router-view内容不会有边框问题 */
.router-view-container {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
