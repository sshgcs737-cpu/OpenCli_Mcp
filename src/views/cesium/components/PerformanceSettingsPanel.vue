<template>
  <el-dialog
    v-model="visible"
    title="渲染性能设置"
    width="550px"
    class="perf-panel-dialog"
    :before-close="handleClose"
    append-to-body
    :modal-append-to-body="false"
    :z-index="2000"
  >
    <div class="perf-panel">
      <div class="perf-section">
        <div class="perf-section-header">
          <el-icon><Setting /></el-icon>
          <span>选择渲染品质</span>
          <div class="tech-line"></div>
        </div>
        
        <div class="perf-options">
          <div 
            :class="['perf-option', { 'perf-option-active': selectedMode === 'high' }]" 
            @click="handleSelectMode('high')"
          >
            <div class="perf-option-icon perf-option-icon-high">
              <el-icon><PictureFilled /></el-icon>
            </div>
            <div class="perf-option-content">
              <div class="perf-option-title">高质量渲染</div>
              <div class="perf-option-desc">加载地形和高清影像，启用高级视觉效果</div>
            </div>
          </div>
          
          <div 
            :class="['perf-option', { 'perf-option-active': selectedMode === 'medium' }]" 
            @click="handleSelectMode('medium')"
          >
            <div class="perf-option-icon perf-option-icon-medium">
              <el-icon><Picture /></el-icon>
            </div>
            <div class="perf-option-content">
              <div class="perf-option-title">中质量渲染</div>
              <div class="perf-option-desc">加载地形和标准影像，禁用高级视觉效果</div>
            </div>
          </div>
          
          <div 
            :class="['perf-option', { 'perf-option-active': selectedMode === 'low' }]" 
            @click="handleSelectMode('low')"
          >
            <div class="perf-option-icon perf-option-icon-low">
              <el-icon><PictureRounded /></el-icon>
            </div>
            <div class="perf-option-content">
              <div class="perf-option-title">低质量渲染</div>
              <div class="perf-option-desc">仅加载基础影像，不加载地形数据</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="perf-actions">
        <button class="perf-btn perf-btn-cancel" @click="handleClose">
          取消
        </button>
        <button class="perf-btn perf-btn-apply" @click="handleApply">
          应用设置
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PictureFilled, Picture, PictureRounded, Setting } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import eventBus from '../../../utils/eventBus';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const selectedMode = ref('medium');

const handleSelectMode = (mode: string) => {
  selectedMode.value = mode;
};

const handleClose = () => {
  visible.value = false;
};

const handleApply = () => {
  eventBus.emit('setRenderPerformance', selectedMode.value);
  
  let message = '';
  switch(selectedMode.value) {
    case 'high':
      message = '已切换到高质量渲染模式';
      break;
    case 'medium':
      message = '已切换到中质量渲染模式';
      break;
    case 'low':
      message = '已切换到低质量渲染模式';
      break;
  }
  
  ElMessage.success(message);
  visible.value = false;
};

onMounted(() => {
});
</script>

<style>
.el-dialog.perf-panel-dialog {
  --perf-blue-dark: #051022;
  --perf-blue-mid: #0a2044;
  --perf-blue-light: #00eaff;
  --perf-blue-glow: rgba(0, 234, 255, 0.3);
  --perf-text-primary: #4dd0ff;
  --perf-text-secondary: #b6eaff;
  --perf-border-light: rgba(0, 234, 255, 0.2);
  --perf-green-light: #0a6277;
  --perf-green-dark: #053d4d;
  --perf-blue-mid-light: #0a4677;
  --perf-blue-mid-dark: #052c4d;
  --perf-purple-light: #0a2c77;
  --perf-purple-dark: #05194d;
  margin: 0 !important;
}

.el-dialog.perf-panel-dialog {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  max-width: 90vw;
  max-height: 90vh;
  background: linear-gradient(135deg, var(--perf-blue-dark), var(--perf-blue-mid)) !important;
  border: 1px solid var(--perf-border-light) !important;
  box-shadow: 0 0 30px var(--perf-blue-glow) !important;
  backdrop-filter: blur(10px);
  border-radius: 8px !important;
  overflow: hidden;
  z-index: 2000 !important;
}

.el-dialog.perf-panel-dialog .el-dialog__header {
  background: linear-gradient(90deg, var(--perf-blue-dark), var(--perf-blue-mid)) !important;
  border-bottom: 1px solid var(--perf-border-light) !important;
  padding: 12px 16px !important; /* 减小头部内边距 */
  position: relative;
}

.el-dialog.perf-panel-dialog .el-dialog__header::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--perf-blue-light), transparent);
}

.el-dialog.perf-panel-dialog .el-dialog__title {
  color: var(--perf-text-primary) !important;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
  font-size: 16px !important; /* 减小标题字体 */
  text-shadow: 0 0 8px var(--perf-blue-glow) !important;
  letter-spacing: 0.5px !important;
}

.el-dialog.perf-panel-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--perf-text-primary) !important;
  transition: all 0.3s;
}

.el-dialog.perf-panel-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: var(--perf-blue-light) !important;
  text-shadow: 0 0 8px var(--perf-blue-light) !important;
  transform: scale(1.1) !important;
}

.el-dialog.perf-panel-dialog .el-dialog__body {
  padding: 16px !important; /* 减小内容区域内边距 */
  background: linear-gradient(135deg, var(--perf-blue-dark), var(--perf-blue-mid)) !important;
  color: var(--perf-text-secondary) !important;
  max-height: 70vh !important;
  overflow-y: auto !important;
}
</style>

<style scoped>
.perf-panel {
  display: flex;
  flex-direction: column;
  gap: 16px; /* 减小间距 */
  position: relative;
}

.perf-section {
  margin-bottom: 10px; /* 减小下边距 */
  animation: perf-appear 0.5s ease forwards;
  opacity: 0;
  transform: translateY(10px);
  background: rgba(10, 30, 60, 0.3);
  border-radius: 8px;
  border: 1px solid var(--perf-border-light);
  padding: 12px; /* 减小内边距 */
  position: relative;
  overflow: hidden;
}

.perf-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--perf-blue-light), transparent);
  opacity: 0.5;
}

@keyframes perf-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.perf-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px; /* 减小下边距 */
  padding-bottom: 8px; /* 减小下内边距 */
  border-bottom: 1px solid var(--perf-border-light);
  position: relative;
}

.perf-section-header .el-icon {
  font-size: 18px; /* 减小图标大小 */
  color: var(--perf-blue-light);
  text-shadow: 0 0 8px var(--perf-blue-glow);
}

.perf-section-header span {
  color: var(--perf-text-primary);
  font-size: 15px; /* 减小字体大小 */
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px var(--perf-blue-glow);
}

.tech-line {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--perf-blue-light), transparent);
  opacity: 0.6;
}

.perf-options {
  display: flex;
  flex-direction: column;
  gap: 8px; /* 减小选项间距 */
}

.perf-option {
  display: flex;
  align-items: center;
  gap: 12px; /* 减小内部间距 */
  padding: 10px 12px; /* 减小内边距 */
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
  background-color: rgba(5, 16, 34, 0.4);
  border: 1px solid rgba(0, 122, 255, 0.1);
  position: relative;
  overflow: hidden;
  min-height: 62px; /* 减小最小高度 */
}

.perf-option::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.1), transparent);
  transition: left 0.5s;
}

.perf-option:hover::before {
  left: 100%;
}

.perf-option:hover {
  background-color: rgba(10, 32, 68, 0.5);
  border-color: rgba(0, 122, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 122, 255, 0.15);
  transform: translateY(-2px);
}

.perf-option-active {
  background-color: rgba(0, 122, 255, 0.15);
  border-color: rgba(0, 122, 255, 0.3);
  box-shadow: 0 0 15px rgba(0, 122, 255, 0.2);
  transform: translateY(-2px);
}

.perf-option-icon {
  width: 40px; /* 减小图标尺寸 */
  height: 40px; /* 减小图标尺寸 */
  min-width: 40px; /* 确保图标不会被压缩 */
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.perf-option:hover .perf-option-icon,
.perf-option-active .perf-option-icon {
  transform: scale(1.05);
}

.perf-option-icon-high {
  background: linear-gradient(135deg, var(--perf-green-light), var(--perf-green-dark));
  border: 1px solid rgba(0, 234, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 234, 255, 0.3);
}

.perf-option-icon-medium {
  background: linear-gradient(135deg, var(--perf-blue-mid-light), var(--perf-blue-mid-dark));
  border: 1px solid rgba(0, 119, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 119, 255, 0.3);
}

.perf-option-icon-low {
  background: linear-gradient(135deg, var(--perf-purple-light), var(--perf-purple-dark));
  border: 1px solid rgba(77, 0, 255, 0.5);
  box-shadow: 0 0 15px rgba(77, 0, 255, 0.3);
}

.perf-option-icon .el-icon {
  font-size: 20px; /* 减小图标大小 */
  color: var(--perf-blue-light);
  transition: all 0.3s ease;
}

.perf-option:hover .perf-option-icon .el-icon,
.perf-option-active .perf-option-icon .el-icon {
  transform: scale(1.1);
}

.perf-option-icon-medium .el-icon {
  color: #0077ff;
}

.perf-option-icon-low .el-icon {
  color: #4d00ff;
}

.perf-option-content {
  flex: 1;
  display: flex; 
  flex-direction: column;
}

.perf-option-title {
  font-size: 14px; /* 减小字体大小 */
  font-weight: 500;
  color: var(--perf-text-primary);
  margin-bottom: 4px; /* 减小下边距 */
  transition: all 0.3s ease;
}

.perf-option:hover .perf-option-title,
.perf-option-active .perf-option-title {
  color: var(--perf-blue-light);
  text-shadow: 0 0 8px var(--perf-blue-glow);
}

.perf-option-desc {
  font-size: 12px; /* 减小字体大小 */
  color: var(--perf-text-secondary);
  opacity: 0.8;
  transition: all 0.3s ease;
  line-height: 1.3; /* 减小行高 */
}

.perf-option:hover .perf-option-desc,
.perf-option-active .perf-option-desc {
  opacity: 1;
}

.perf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px; /* 减小间距 */
  margin-top: 12px; /* 减小上边距 */
}

.perf-btn {
  min-width: 90px; /* 减小最小宽度 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px; /* 减小内边距 */
  border: none;
  border-radius: 6px;
  font-size: 13px; /* 减小字体大小 */
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.5px;
}

.perf-btn-cancel {
  background: linear-gradient(to right, #1a2238, #2a3350);
  border: 1px solid rgba(138, 180, 255, 0.3);
  color: var(--perf-text-secondary);
  position: relative;
  overflow: hidden;
}

.perf-btn-cancel::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(138, 180, 255, 0.1), transparent);
  transition: left 0.5s;
}

.perf-btn-cancel:hover::before {
  left: 100%;
}

.perf-btn-cancel:hover {
  background: linear-gradient(to right, #232f4e, #374a6e);
  box-shadow: 0 0 12px rgba(138, 180, 255, 0.3);
  transform: translateY(-2px);
}

.perf-btn-apply {
  background: linear-gradient(to right, #0052cc, #0088ff);
  color: #ffffff;
  border: 1px solid rgba(0, 136, 255, 0.3);
  position: relative;
  overflow: hidden;
}

.perf-btn-apply::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 234, 255, 0.2), transparent);
  transition: left 0.5s;
}

.perf-btn-apply:hover::before {
  left: 100%;
}

.perf-btn-apply:hover {
  background: linear-gradient(to right, #0088ff, #00aaff);
  box-shadow: 0 0 15px rgba(0, 136, 255, 0.4);
  transform: translateY(-2px);
}
</style> 