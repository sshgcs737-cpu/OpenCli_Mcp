<template>
  <el-dialog
    v-model="visible"
    title="仿真参数配置"
    width="380px"
    class="simulation-config-dialog"
    :before-close="handleClose"
    append-to-body
    :modal-append-to-body="false"
    :z-index="2000"
  >
    <div class="simulation-panel">
      <div class="simulation-section">
        <div class="section-header">
          <el-icon><Monitor /></el-icon>
          <span>仿真控制参数</span>
          <div class="tech-line"></div>
        </div>
        
        <div class="simulation-fields">
          <div class="simulation-field">
            <span class="simulation-label">当前会话ID</span>
            <el-input v-model="sessionId" disabled class="tech-input"></el-input>
          </div>
          
          <div class="simulation-field">
            <span class="simulation-label">步长 (ms)</span>
            <el-input-number 
              v-model="configParams.stepLength" 
              :min="100" 
              :step="100"
              controls-position="right"
              class="tech-input-number"
              :precision="0"
            ></el-input-number>
          </div>
          
          <div class="simulation-field">
            <span class="simulation-label">模式</span>
            <el-select 
              v-model="configParams.mode" 
              class="tech-select"
              popper-class="simu-select-dropdown"
              :teleport-to-body="false"
            >
              <el-option :value="0" label=" 后台未记录"></el-option>
              <el-option :value="2" label=" 后台记录"></el-option>
            </el-select>
          </div>

          <div class="simulation-field">
            <span class="simulation-label">开始时间</span>
            <div class="current-time-display">{{ currentBeijingTime }}</div>
          </div>

          <div class="simulation-field">
            <span class="simulation-label">持续时间（分钟）</span>
            <el-input-number 
              v-model="configParams.durationMinutes" 
              :min="1" 
              :max="10000"
              :step="1"
              controls-position="right"
              class="tech-input-number"
              :precision="0"
            ></el-input-number>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button class="tech-button-cancel" @click="handleClose">
          取消
        </el-button>
        <el-button type="primary" class="tech-button" @click="handleApply" :loading="isApplying">
          <el-icon class="start-icon" v-if="!isApplying"><VideoPlay /></el-icon>
          {{ isApplying ? '正在启动...' : '开始仿真' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Monitor, VideoPlay } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
  sessionId: string | null;
}>();

const emit = defineEmits(['update:modelValue', 'startSimulation']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 会话ID，支持number或string类型
const sessionId = computed(() => {
  if (props.sessionId === null) return "";
  return String(props.sessionId);
});

const configParams = ref({
  stepLength: 1000,
  mode: 0,
  durationMinutes: 10, // 默认持续时间为10分钟
  duration: 10 * 60 * 1000 // 计算的毫秒数
});

const isApplying = ref(false);

const currentBeijingTime = ref(formatDateBeijing(new Date()));
let beijingTimer: number;

function formatDateBeijing(date: Date): string {
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingDate.getUTCFullYear()}-${
    beijingDate.getUTCMonth() + 1
  }-${beijingDate.getUTCDate()} ${beijingDate.getUTCHours()}:${beijingDate.getUTCMinutes()}:${beijingDate.getUTCSeconds()}`;
}

onMounted(() => {
  beijingTimer = window.setInterval(() => {
    currentBeijingTime.value = formatDateBeijing(new Date());
  }, 1000);
});

onUnmounted(() => {
  clearInterval(beijingTimer);
});

const handleClose = () => {
  visible.value = false;
};

const handleApply = async () => {
  if (isApplying.value) {
    return;
    }

  isApplying.value = true;

  try {
    configParams.value.duration = configParams.value.durationMinutes * 60 * 1000;

    visible.value = false;

    emit('startSimulation', {
      ...configParams.value,
      sessionId: Number(sessionId.value),
      needsProtocolCheck: true,
    });

  } catch (error) {
    console.error('启动仿真失败:', error);
    ElMessage.error('启动仿真失败，请重试');
  } finally {
    isApplying.value = false;
  }
};
</script>

<style>
.el-dialog.simulation-config-dialog {
  --simu-blue-dark: #051022;
  --simu-blue-mid: #0a2044;
  --simu-blue-light: #00eaff;
  --simu-blue-glow: rgba(0, 234, 255, 0.3);
  --simu-text-primary: #4dd0ff;
  --simu-text-secondary: #b6eaff;
  --simu-border-light: rgba(0, 234, 255, 0.2);
  --simu-input-bg: rgba(7, 25, 50, 0.7);
  --simu-input-border: rgba(0, 174, 255, 0.3);
  --simu-input-focus-border: rgba(0, 234, 255, 0.5);
  margin: 0 !important;
}

.simu-select-dropdown {
  background: linear-gradient(135deg, #051022, #0a2044) !important;
  border: 1px solid rgba(0, 174, 255, 0.3) !important;
  box-shadow: 0 0 20px rgba(0, 140, 255, 0.2) !important;
}

.simu-select-dropdown .el-select-dropdown__item {
  color: #b6eaff !important;
  font-size: 13px !important;
  height: 34px !important;
  line-height: 34px !important;
}

.simu-select-dropdown .el-select-dropdown__item.hover, 
.simu-select-dropdown .el-select-dropdown__item:hover {
  background-color: rgba(0, 122, 255, 0.2) !important;
  color: #00eaff !important;
}

.simu-select-dropdown .el-select-dropdown__item.selected {
  background-color: rgba(0, 122, 255, 0.2) !important;
  color: #00eaff !important;
  font-weight: bold !important;
}

.simu-select-dropdown .el-scrollbar__bar {
  background-color: rgba(0, 122, 255, 0.1) !important;
}

.simu-select-dropdown .el-scrollbar__thumb {
  background-color: rgba(0, 174, 255, 0.3) !important;
}

.el-dialog.simulation-config-dialog {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  max-width: 90vw;
  max-height: 90vh;
  background: linear-gradient(135deg, var(--simu-blue-dark), var(--simu-blue-mid)) !important;
  border: 1px solid var(--simu-border-light) !important;
  box-shadow: 0 0 30px var(--simu-blue-glow) !important;
  backdrop-filter: blur(10px);
  border-radius: 8px !important;
  overflow: hidden;
  z-index: 2000 !important;
}

.el-dialog.simulation-config-dialog .el-dialog__header {
  background: linear-gradient(90deg, var(--simu-blue-dark), var(--simu-blue-mid)) !important;
  border-bottom: 1px solid var(--simu-border-light) !important;
  padding: 12px 16px !important;
  position: relative;
}

.el-dialog.simulation-config-dialog .el-dialog__header::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--simu-blue-light), transparent);
}

.el-dialog.simulation-config-dialog .el-dialog__title {
  color: var(--simu-text-primary) !important;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
  font-size: 16px !important;
  text-shadow: 0 0 8px var(--simu-blue-glow) !important;
  letter-spacing: 0.5px !important;
}

.el-dialog.simulation-config-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--simu-text-primary) !important;
  transition: all 0.3s;
}

.el-dialog.simulation-config-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: var(--simu-blue-light) !important;
  text-shadow: 0 0 8px var(--simu-blue-light) !important;
  transform: scale(1.1) !important;
}

.el-dialog.simulation-config-dialog .el-dialog__body {
  padding: 16px !important;
  background: linear-gradient(135deg, var(--simu-blue-dark), var(--simu-blue-mid)) !important;
  color: var(--simu-text-secondary) !important;
  max-height: 70vh !important;
  overflow-y: auto !important;
}

.el-dialog.simulation-config-dialog .el-dialog__footer {
  padding: 12px 16px !important;
  background: linear-gradient(90deg, var(--simu-blue-dark), var(--simu-blue-mid)) !important;
  border-top: 1px solid var(--simu-border-light) !important;
}

.el-dialog.simulation-config-dialog .tech-button-cancel {
  background: linear-gradient(to right, #1a2238, #2a3350) !important;
  border: 1px solid rgba(138, 180, 255, 0.3) !important;
  color: var(--simu-text-secondary) !important;
  position: relative;
  overflow: hidden;
  border-radius: 6px !important;
  padding: 8px 16px !important;
  transition: all 0.3s !important;
}

.el-dialog.simulation-config-dialog .tech-button-cancel:hover {
  background: linear-gradient(to right, #232f4e, #374a6e) !important;
  box-shadow: 0 0 12px rgba(138, 180, 255, 0.3) !important;
  transform: translateY(-2px) !important;
  color: #ffffff !important;
}

.el-dialog.simulation-config-dialog .tech-button {
  background: linear-gradient(to right, #0052cc, #0088ff) !important;
  border: 1px solid rgba(0, 136, 255, 0.3) !important;
  color: #ffffff !important;
  position: relative;
  overflow: hidden;
  border-radius: 6px !important;
  padding: 8px 16px !important;
  transition: all 0.3s !important;
}

.el-dialog.simulation-config-dialog .tech-button:hover {
  background: linear-gradient(to right, #0088ff, #00aaff) !important;
  box-shadow: 0 0 15px rgba(0, 136, 255, 0.4) !important;
  transform: translateY(-2px) !important;
}


.el-dialog.simulation-config-dialog .el-input .el-input__wrapper,
.el-dialog.simulation-config-dialog .el-input-number .el-input__wrapper,
.el-dialog.simulation-config-dialog .el-select .el-input__wrapper {
  background: var(--simu-input-bg) !important;
  border: 1px solid var(--simu-input-border) !important;
  box-shadow: none !important;
  border-radius: 4px !important;
  padding: 0 !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 0 0 1px transparent inset, 0 0 10px rgba(0, 110, 255, 0.1) inset !important;
}

.el-dialog.simulation-config-dialog .el-input .el-input__wrapper:hover,
.el-dialog.simulation-config-dialog .el-input-number .el-input__wrapper:hover,
.el-dialog.simulation-config-dialog .el-select .el-input__wrapper:hover {
  border-color: var(--simu-input-focus-border) !important;
  box-shadow: 0 0 0 1px transparent inset, 0 0 15px rgba(0, 110, 255, 0.15) inset !important;
}

.el-dialog.simulation-config-dialog .el-input .el-input__wrapper.is-focus,
.el-dialog.simulation-config-dialog .el-input-number .el-input__wrapper.is-focus,
.el-dialog.simulation-config-dialog .el-select .el-input__wrapper.is-focus {
  border-color: var(--simu-input-focus-border) !important;
  box-shadow: 0 0 0 1px transparent inset, 0 0 15px rgba(0, 130, 255, 0.2) inset !important;
}

.el-dialog.simulation-config-dialog .el-input__inner {
  height: 32px !important;
  color: var(--simu-text-secondary) !important;
  background: transparent !important;
  padding: 0 10px !important;
  font-family: "Consolas", monospace !important;
  font-size: 15px !important;
}

.el-dialog.simulation-config-dialog .el-input.is-disabled .el-input__wrapper {
  background: rgba(10, 30, 60, 0.4) !important;
  border-color: rgba(0, 140, 255, 0.15) !important;
}

.el-dialog.simulation-config-dialog .el-input.is-disabled .el-input__inner {
  color: rgba(182, 234, 255, 0.5) !important;
  text-shadow: 0 0 4px rgba(0, 234, 255, 0.3) !important;
}

.el-dialog.simulation-config-dialog .el-input-number__decrease,
.el-dialog.simulation-config-dialog .el-input-number__increase {
  background: rgba(0, 80, 150, 0.3) !important;
  color: var(--simu-text-secondary) !important;
  border-color: var(--simu-input-border) !important;
  transition: all 0.2s ease !important;
  width: 24px !important;
  height: 16px !important;
  line-height: 16px !important;
  padding: 0 !important;
}

.el-dialog.simulation-config-dialog .el-input-number__decrease:hover,
.el-dialog.simulation-config-dialog .el-input-number__increase:hover {
  background: rgba(0, 122, 255, 0.3) !important;
  color: var(--simu-blue-light) !important;
}

.el-dialog.simulation-config-dialog .el-input-number__decrease.is-disabled,
.el-dialog.simulation-config-dialog .el-input-number__increase.is-disabled {
  background: rgba(0, 40, 75, 0.2) !important;
  color: rgba(118, 185, 255, 0.3) !important;
}

.el-dialog.simulation-config-dialog .el-input-number .el-input__inner {
  padding-right: 28px !important;
  text-align: center !important;
}

.el-dialog.simulation-config-dialog .el-select .el-input .el-select__caret {
  color: rgba(118, 185, 255, 0.7) !important;
  transition: all 0.3s ease !important;
}

.el-dialog.simulation-config-dialog .el-select:hover .el-input .el-select__caret {
  color: var(--simu-blue-light) !important;
}
</style>

<style scoped>
.simulation-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.simulation-section {
  background: rgba(10, 30, 60, 0.3);
  border-radius: 8px;
  border: 1px solid var(--simu-border-light);
  padding: 12px;
  position: relative;
  overflow: hidden;
  margin-bottom: 10px;
}

.simulation-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--simu-blue-light), transparent);
  opacity: 0.5;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--simu-border-light);
  position: relative;
}

.section-header .el-icon {
  font-size: 18px;
  color: var(--simu-blue-light);
  text-shadow: 0 0 8px var(--simu-blue-glow);
}

.section-header span {
  color: var(--simu-text-primary);
  font-size: 15px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px var(--simu-blue-glow);
}

.tech-line {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--simu-blue-light), transparent);
  opacity: 0.6;
}

.simulation-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.simulation-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.simulation-label {
  color: var(--simu-text-secondary);
  font-size: 13px;
  letter-spacing: 0.5px;
}

.current-time-display {
  background: var(--simu-input-bg);
  border: 1px solid var(--simu-input-border);
  color: var(--simu-text-secondary);
  border-radius: 4px;
  padding: 7px 12px;
  font-family: "Consolas", monospace;
  font-size: 13px;
  position: relative;
  overflow: hidden;
  height: 32px;
  line-height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(0, 110, 255, 0.1) inset;
}

.current-time-display::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.1), transparent);
  animation: time-scan 4s linear infinite;
}

@keyframes time-scan {
  0% { left: -100%; }
  100% { left: 100%; }
}

.tech-input,
.tech-input-number,
.tech-select {
  width: 100%;
}

.tech-select :deep(.el-input__wrapper) {
  padding: 0 !important;
}

.tech-select :deep(.el-input__inner) {
  padding: 0 12px !important;
}

.tech-select :deep(.el-select__caret) {
  color: var(--simu-text-primary) !important;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.start-icon {
  margin-right: 5px;
  font-size: 14px;
}
</style> 