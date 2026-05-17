<template>
  <div class="resource-reminder">
    <div class="scrolling-text">
      系统资源提醒:      当前可用节点数 {{ displayCount }} 
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { websocketService } from '../services/websocket';

const count = ref<number>(0);
const displayCount = ref<string>('0');

// WebSocket message listener
const handleResourceUpdate = (message: any) => {
  try {
    if (message.action === 9 && message.count !== undefined) {
      count.value = message.count;
      displayCount.value = message.count >= 300 ? '300+' : message.count.toString();
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
  }
};

onMounted(() => {
  // Register message handler for action 9
  websocketService.onMessage('action_9', handleResourceUpdate);
});

onUnmounted(() => {
  // Remove message handler
  websocketService.offMessage('action_9', handleResourceUpdate);
});
</script>

<style scoped>
.resource-reminder {
  position: fixed;
  bottom: 0;
  width: 100%;
  background: linear-gradient(180deg, rgba(5, 22, 52, 0.8) 0%, rgba(8, 28, 68, 0.85) 48%, rgba(10, 20, 54, 0.9) 100%);
  color: var(--primary-text-color, #d6e5ff);
  padding: 5px 0;
  font-size: 12px;
  text-align: center;
  z-index: 1000;
  overflow: hidden;
  border-top: 1px solid rgba(0, 170, 255, 0.16);
  box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.2);
}

.scrolling-text {
  display: inline-block;
  white-space: nowrap;
  animation: scroll 15s linear infinite;
}

@keyframes scroll {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
</style>
