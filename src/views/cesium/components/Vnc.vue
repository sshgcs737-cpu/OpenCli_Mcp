<template>
  <div class="vnc-container" ref="vncContainer">
    <div class="vnc-header">
      <div class="vnc-status">
        <el-icon class="status-icon" :class="statusClass">
          <component :is="statusIcon" />
        </el-icon>
        <span class="status-text">{{ statusText }}</span>
      </div>
      <div class="vnc-controls">
        <div class="scale-controls" v-if="showScaleControls && isConnected">
          <el-button
            size="small"
            @click="zoomOut"
            :disabled="!isConnected"
            class="zoom-btn"
            title="缩小"
          >
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <span class="scale-display">{{ Math.round(currentScale * 100) }}%</span>
          <el-button
            size="small"
            @click="zoomIn"
            :disabled="!isConnected"
            class="zoom-btn"
            title="放大"
          >
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button
            size="small"
            @click="resetZoom"
            :disabled="!isConnected"
            class="zoom-btn"
            title="重置缩放"
          >
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button
            size="small"
            @click="toggleScaleMode"
            :disabled="!isConnected"
            class="scale-btn"
            :title="scaleViewport ? '固定尺寸' : '自适应缩放'"
          >
            <el-icon><component :is="scaleViewport ? 'Lock' : 'Unlock'" /></el-icon>
          </el-button>
        </div>

        <div class="action-controls">
          <el-button
            size="small"
            type="primary"
            @click="sendCtrlAltDel"
            :disabled="!isConnected"
            class="ctrl-btn"
          >
            <el-icon><Monitor /></el-icon>
            Ctrl+Alt+Del
          </el-button>
          <el-button
            size="small"
            type="warning"
            @click="toggleFullscreen"
            :disabled="!isConnected"
            class="fullscreen-btn"
          >
            <el-icon><FullScreen /></el-icon>
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="disconnect"
            class="disconnect-btn"
          >
            <el-icon><Close /></el-icon>
            断开连接
          </el-button>
        </div>
      </div>
    </div>
    <div
      class="vnc-screen"
      ref="vncScreen"
      v-loading="isLoading"
      element-loading-text="正在连接虚拟机..."
      element-loading-background="rgba(24, 29, 40, 0.8)"
    >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineProps, defineEmits, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Monitor, Close, FullScreen, Loading, CircleCheck, CircleClose, Warning, ZoomOut, ZoomIn, Refresh, Lock, Unlock } from '@element-plus/icons-vue';
import RFB from '@novnc/novnc/core/rfb.js';

const props = defineProps<{
  wsUrl: string;
  visible?: boolean;
}>();

const emit = defineEmits<{
  disconnect: [];
  connected: [];
  error: [message: string];
}>();

const vncContainer = ref<HTMLElement | null>(null);
const vncScreen = ref<HTMLElement | null>(null);
const isLoading = ref(true);
const isConnected = ref(false);
const isFullscreen = ref(false);
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
const errorMessage = ref('');

const scaleViewport = ref(true); // 默认开启缩放
const currentScale = ref(1.0);
const showScaleControls = ref(true);

let rfb: any = null;

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return '正在连接...';
    case 'connected':
      return '已连接';
    case 'disconnected':
      return '已断开';
    case 'error':
      return errorMessage.value || '连接错误';
    default:
      return '未知状态';
  }
});

const statusIcon = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return Loading;
    case 'connected':
      return CircleCheck;
    case 'disconnected':
      return CircleClose;
    case 'error':
      return Warning;
    default:
      return CircleClose;
  }
});

const statusClass = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return 'status-connecting';
    case 'connected':
      return 'status-connected';
    case 'disconnected':
      return 'status-disconnected';
    case 'error':
      return 'status-error';
    default:
      return 'status-disconnected';
  }
});

const connectVnc = () => {
  if (!props.wsUrl) {
    console.error('WebSocket URL 未提供');
    connectionStatus.value = 'error';
    errorMessage.value = 'WebSocket URL 未提供';
    isLoading.value = false;
    return;
  }

  if (!vncScreen.value) {
    console.error('VNC屏幕容器未找到');
    return;
  }

  if (rfb) {
    try {
      rfb.disconnect();
    } catch (e) {
      console.error('连接错误:', e);
    }
    rfb = null;
  }

  if (vncScreen.value) {
    vncScreen.value.innerHTML = '';
  }

  try {
    connectionStatus.value = 'connecting';
    isLoading.value = true;
    isConnected.value = false;

    console.log('Creating new VNC connection to:', props.wsUrl);
    rfb = new RFB(vncScreen.value, props.wsUrl, {
      credentials: { password: ''},
    });

    rfb.scaleViewport = scaleViewport.value;
    rfb.resizeSession = true;

    updateRFBScale();

    rfb.addEventListener('connect', onConnected);
    rfb.addEventListener('disconnect', onDisconnected);
    rfb.addEventListener('securityfailure', onSecurityFailure);

  } catch (error: any) {
    console.error('VNC连接失败:', error);
    connectionStatus.value = 'error';
    errorMessage.value = error.message || '连接失败';
    isLoading.value = false;
    emit('error', errorMessage.value);
  }
};

const onConnected = () => {
  connectionStatus.value = 'connected';
  isConnected.value = true;
  isLoading.value = false;
  emit('connected');
  ElMessage.success('虚拟机连接成功');
};

const onDisconnected = (e: any) => {
  connectionStatus.value = 'disconnected';
  isConnected.value = false;
  isLoading.value = false;

  if (e.detail.clean) {
    ElMessage.info('虚拟机连接已断开');
  } else {
    ElMessage.warning('虚拟机连接异常断开');
  }

  emit('disconnect');
};

const onSecurityFailure = (e: any) => {
  console.error('VNC安全验证失败:', e);
  connectionStatus.value = 'error';
  errorMessage.value = '安全验证失败';
  isConnected.value = false;
  isLoading.value = false;
  emit('error', errorMessage.value);
  ElMessage.error('虚拟机安全验证失败');
};

const sendCtrlAltDel = () => {
  if (rfb && isConnected.value) {
    rfb.sendCtrlAltDel();
  }
};

const toggleFullscreen = () => {
  if (!vncContainer.value) return;

  if (!isFullscreen.value) {
    if (vncContainer.value.requestFullscreen) {
      vncContainer.value.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const disconnect = () => {
  if (rfb) {
    rfb.disconnect();
    rfb = null;
  }
  connectionStatus.value = 'disconnected';
  isConnected.value = false;
  isLoading.value = false;
  emit('disconnect');
};

const updateRFBScale = () => {
  if (rfb && isConnected.value) {
    rfb.scaleViewport = scaleViewport.value;
    if (!scaleViewport.value) {
      const screenElement = vncScreen.value?.querySelector('canvas');
      if (screenElement) {
        screenElement.style.transform = `scale(${currentScale.value})`;
        screenElement.style.transformOrigin = 'top left';
      }
    }
  }
};

const zoomIn = () => {
  if (currentScale.value < 3.0) {
    currentScale.value = Math.min(3.0, currentScale.value + 0.25);
    updateRFBScale();
    ElMessage.success(`缩放: ${Math.round(currentScale.value * 100)}%`);
  }
};

const zoomOut = () => {
  if (currentScale.value > 0.25) {
    currentScale.value = Math.max(0.25, currentScale.value - 0.25);
    updateRFBScale();
    ElMessage.success(`缩放: ${Math.round(currentScale.value * 100)}%`);
  }
};

const resetZoom = () => {
  currentScale.value = 1.0;
  updateRFBScale();
  ElMessage.success('缩放已重置为100%');
};

const toggleScaleMode = () => {
  scaleViewport.value = !scaleViewport.value;
  updateRFBScale();

  if (scaleViewport.value) {
    ElMessage.success('已切换到自适应缩放模式');
    const screenElement = vncScreen.value?.querySelector('canvas');
    if (screenElement) {
      screenElement.style.transform = '';
      screenElement.style.transformOrigin = '';
    }
  } else {
    ElMessage.success('已切换到固定尺寸模式');
  }
};

watch(() => props.wsUrl, (newUrl, oldUrl) => {
  if (newUrl && newUrl !== oldUrl && props.visible !== false) {
    console.log('WebSocket URL changed from', oldUrl, 'to', newUrl);
    connectVnc();
  }
});

watch(() => props.visible, (visible) => {
  if (visible && props.wsUrl) {
    connectVnc();
  } else if (!visible && rfb) {
    disconnect();
  }
});

onMounted(() => {
  if (props.wsUrl && props.visible !== false) {
    connectVnc();
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);

  if (rfb) {
    rfb.disconnect();
    rfb = null;
  }
});

</script>


<style scoped lang="scss">
.vnc-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.95) 0%,
    rgba(17, 23, 64, 0.95) 100%
  );
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:fullscreen {
    border-radius: 0;
    .vnc-screen {
      border-radius: 0;
    }
  }
}

.vnc-header {
  background: linear-gradient(
    90deg,
    rgba(24, 29, 40, 0.9) 0%,
    rgba(31, 38, 54, 0.9) 100%
  );
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(5px);
}

.vnc-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;

  .status-icon {
    font-size: 16px;

    &.status-connecting {
      color: #409eff;
      animation: spin 1s linear infinite;
    }

    &.status-connected {
      color: #67c23a;
    }

    &.status-disconnected {
      color: #909399;
    }

    &.status-error {
      color: #f56c6c;
    }
  }

  .status-text {
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  }
}

.vnc-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.scale-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.scale-display {
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.action-controls {
  display: flex;
  gap: 8px;
  align-items: center;

  .el-button {
    height: 32px;
    font-size: 12px;
    border-radius: 6px;
    transition: all 0.3s ease;

    &.ctrl-btn {
      background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
      border: none;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #337ecc 0%, #2b6cb0 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
      }
    }

    &.fullscreen-btn {
      background: linear-gradient(135deg, #e6a23c 0%, #cf9236 100%);
      border: none;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #cf9236 0%, #b8832f 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(230, 162, 60, 0.3);
      }
    }

    &.disconnect-btn {
      background: linear-gradient(135deg, #f56c6c 0%, #e85656 100%);
      border: none;

      &:hover {
        background: linear-gradient(135deg, #e85656 0%, #d94545 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3);
      }
    }

    &.zoom-btn {
      background: linear-gradient(135deg, #909399 0%, #7d7d7d 100%);
      border: none;
      width: 28px;
      height: 28px;
      padding: 0;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #7d7d7d 0%, #6a6a6a 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(144, 147, 153, 0.3);
      }
    }

    &.scale-btn {
      background: linear-gradient(135deg, #67c23a 0%, #5daf34 100%);
      border: none;
      width: 28px;
      height: 28px;
      padding: 0;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #5daf34 0%, #529b2e 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }
  }
}

.vnc-screen {
  flex: 1;
  background: #000000;
  position: relative;
  overflow: hidden;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;

  :deep(.el-loading-mask) {
    background-color: rgba(24, 29, 40, 0.8) !important;
    backdrop-filter: blur(5px);
  }

  :deep(.el-loading-text) {
    color: #ffffff !important;
    font-size: 14px;
    font-weight: 500;
  }

  :deep(.el-loading-spinner) {
    .circular {
      stroke: #409eff;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .vnc-header {
    padding: 8px 12px;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .vnc-controls {
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .scale-controls {
    order: 1;
    width: 100%;
    justify-content: center;
  }

  .action-controls {
    order: 2;
    justify-content: center;
    flex-wrap: wrap;
  }

  .vnc-status {
    justify-content: center;
  }

  .scale-display {
    min-width: 50px;
  }
}
</style>

