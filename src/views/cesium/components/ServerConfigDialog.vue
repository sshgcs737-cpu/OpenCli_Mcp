<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">服务器配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- 当前场景可用服务器列表 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">当前场景可用服务器</span>
            </div>
            
            <div v-if="availableServers.length === 0" class="no-servers">
              <el-icon class="no-server-icon"><Cloudy /></el-icon>
              <div class="no-server-text">当前场景暂无可用服务器</div>
            </div>
            
            <div v-else class="server-list">
              <div 
                v-for="server in availableServers" 
                :key="server.name"
                class="server-item"
              >
                <div class="server-info">
                  <el-icon class="server-item-icon"><Cloudy /></el-icon>
                  <div class="server-details">
                    <div class="server-name">{{ server.name }}</div>
                    <div class="server-host">{{ server.host }}</div>
                  </div>
                </div>
                <div class="server-status">
                  <span class="status-dot online"></span>
                  <span class="status-text">在线</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button class="dialog-btn confirm-btn" type="primary" @click="handleAddServer">添加</el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, computed } from 'vue';
import { Cloudy } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useTopoStore } from '../../../store/modules/topo';
import type { Server } from '../../../types/topo';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'save', 'add', 'close']);

const topoStore = useTopoStore();
const dialogVisible = ref(props.visible);

// 获取当前场景可用的服务器列表
const availableServers = computed((): Server[] => {
  return topoStore.topoData?.servers || [];
});

watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
});

watch(() => dialogVisible.value, (newVal) => {
  emit('update:visible', newVal);
});

const serverConfig = ref({
  name: '',
  address: '',
});

const handleClose = () => {
  dialogVisible.value = false;
  emit('close');
};

const handleSaveConfig = () => {
  if (!serverConfig.value.name || !serverConfig.value.address) {
    ElMessage.warning('请填写服务器名称和地址');
    return;
  }
  
  ElMessage.success('配置已保存');
  emit('save', { ...serverConfig.value });
};

const handleAddServer = () => {
  if (!serverConfig.value.name || !serverConfig.value.address) {
    ElMessage.warning('请填写服务器名称和地址');
    return;
  }
  
  ElMessage.success(`服务器 ${serverConfig.value.name} 已添加`);
  emit('add', { ...serverConfig.value });
  handleClose();
};
</script>

<style scoped>
/* 服务器列表样式 */
.no-servers {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  color: #7f8c9d;
}

.no-server-icon {
  font-size: 48px;
  color: #4a5568;
  margin-bottom: 12px;
  opacity: 0.6;
}

.no-server-text {
  font-size: 14px;
  color: #a0aec0;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.server-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(20, 30, 50, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(12, 196, 204, 0.1);
  transition: all 0.3s ease;
}

.server-item:hover {
  border-color: rgba(12, 196, 204, 0.3);
  background: rgba(20, 30, 50, 0.6);
  box-shadow: 0 0 15px rgba(12, 196, 204, 0.1);
}

.server-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.server-item-icon {
  font-size: 24px;
  color: #00aaff;
  background: rgba(0, 170, 255, 0.1);
  padding: 8px;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 170, 255, 0.2);
}

.server-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.server-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  letter-spacing: 0.3px;
}

.server-host {
  font-size: 12px;
  color: #a0aec0;
  font-family: "Consolas", "Monaco", monospace;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse-status 2s infinite;
}

.status-dot.online {
  background-color: #34C759;
  box-shadow: 0 0 6px rgba(52, 199, 89, 0.5);
}

.status-text {
  font-size: 12px;
  color: #34C759;
  font-weight: 500;
}

@keyframes pulse-status {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}
.custom-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

.custom-dialog {
  width: 520px;
  background: rgba(30, 39, 54, 0.95);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-family: "Microsoft YaHei", sans-serif;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  animation: slideIn 0.3s ease;
  position: relative;
  overflow: hidden;
}

.custom-dialog::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(12, 196, 204, 0.5), transparent);
}

.custom-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(41, 54, 73, 0.8);
  background: rgba(30, 39, 54, 0.8);
}

.custom-dialog-title {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  position: relative;
  padding-left: 12px;
}

.custom-dialog-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: #0cc4cc;
  border-radius: 2px;
}

.custom-dialog-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #7f8c9d;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.custom-dialog-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: rotate(90deg);
}

.close-icon {
  font-style: normal;
}

.custom-dialog-body {
  padding: 16px;
  max-height: 65vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(12, 196, 204, 0.3) transparent;
}

.custom-dialog-body::-webkit-scrollbar {
  width: 6px;
}

.custom-dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.custom-dialog-body::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px 16px;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

.config-section {
  margin-bottom: 20px;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(12, 196, 204, 0.1);
  transition: all 0.3s ease;
}

.config-section:hover {
  border-color: rgba(12, 196, 204, 0.3);
  box-shadow: 0 0 20px rgba(12, 196, 204, 0.1);
}

.section-title-block {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #0cc4cc, #00a8ff);
  margin-right: 10px;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(12, 196, 204, 0.3);
}

.section-title {
  font-size: 14px;
  color: #0cc4cc;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.form-row {
  display: flex;
  margin-bottom: 16px;
  align-items: center;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 80px;
  text-align: right;
  padding-right: 16px;
  color: #a0aec0;
  font-size: 13px;
  font-weight: 500;
}

.form-input {
  flex: 1;
}

.server-icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.server-icon {
  font-size: 40px;
  color: #00aaff;
  background: rgba(0, 170, 255, 0.1);
  padding: 12px;
  border-radius: 50%;
  box-shadow: 0 0 15px rgba(0, 170, 255, 0.3);
}

.form-info {
  padding: 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  color: #b6eaff;
  font-size: 14px;
  text-align: center;
}

.dialog-btn {
  min-width: 90px;
  height: 36px;
  font-size: 14px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.dialog-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.dialog-btn:hover::after {
  transform: translateX(100%);
}

.cancel-btn {
  background: rgba(40, 57, 80, 0.8);
  color: #fff;
  margin-right: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background: rgba(53, 70, 92, 0.8);
  transform: translateY(-1px);
}

.save-btn {
  background: linear-gradient(135deg, #0f8a5f, #0ecd87);
  color: #fff;
  box-shadow: 0 4px 15px rgba(14, 205, 135, 0.3);
  margin-right: 12px;
}

.save-btn:hover {
  background: linear-gradient(135deg, #0ecd87, #0f8a5f);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 205, 135, 0.4);
}

.confirm-btn {
  background: linear-gradient(135deg, #105f95, #0e87cd);
  color: #fff;
  box-shadow: 0 4px 15px rgba(14, 135, 205, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #0e87cd, #105f95);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 135, 205, 0.4);
}

:deep(.el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
  box-shadow: none !important;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(12, 196, 204, 0.3);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #0cc4cc;
  box-shadow: 0 0 0 1px rgba(12, 196, 204, 0.2) !important;
}

:deep(.el-input__inner) {
  color: #fff;
  height: 36px;
  font-size: 13px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.3) !important;
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.05);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style> 