<template>
  <div class="alert-notification-container">
    <!-- 告警通知会通过 ElMessageBox 显示 -->
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { alertService } from '../services/alertService';
import websocketService from '../services/websocket';

// 组件挂载时注册告警处理器
onMounted(() => {
  // 注册全局告警处理器
  alertService.onAlert('global', (alert) => {
    console.log('全局告警处理器收到告警:', alert);
  });

  // 确保 WebSocket 连接
  websocketService.connect('alert-notification');
});

// 组件卸载时移除告警处理器
onUnmounted(() => {
  alertService.offAlert('global');
  websocketService.disconnect('alert-notification');
});
</script>

<style scoped>
.alert-notification-container {
  /* 容器样式 */
}
</style>
