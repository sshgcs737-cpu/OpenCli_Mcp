<template>
  <div class="custom-dialog-overlay" v-if="visible" @click.self="handleCancel">
    <div class="custom-dialog">
      <div class="custom-dialog-header">
        <div class="dialog-title">
          <svg width="20" height="20" style="margin-right: 8px">
            <circle cx="10" cy="10" r="9" fill="none" stroke="#00d8ff" stroke-width="1.5" />
            <circle cx="10" cy="10" r="5" fill="#00d8ff" fill-opacity="0.2" />
            <path d="M7 10h6M10 7v6" stroke="#00d8ff" stroke-width="1.5" />
          </svg>
          编辑虚拟机参数
        </div>
        <button class="dialog-close-btn" @click="handleCancel">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <div class="custom-dialog-body">
        <div class="vm-edit-form">
          <div class="form-group">
            <label class="form-label">
              <svg width="16" height="16" style="margin-right: 6px">
                <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="#00d8ff" stroke-width="1.2" />
                <rect x="5" y="5" width="6" height="6" fill="#00d8ff" fill-opacity="0.3" />
              </svg>
              CPU核数
            </label>
            <div class="input-wrapper">
              <el-input-number
                v-model="formData.cpu"
                :min="1"
                :max="16"
                :step="1"
                class="vm-input-number"
                controls-position="right"
              />
              <span class="input-unit">核</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="16" height="16" style="margin-right: 6px">
                <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke="#00d8ff" stroke-width="1.2" />
                <rect x="5" y="6" width="6" height="1" fill="#00d8ff" />
                <rect x="5" y="8" width="4" height="1" fill="#00d8ff" />
                <rect x="5" y="10" width="5" height="1" fill="#00d8ff" />
              </svg>
              内存大小
            </label>
            <div class="input-wrapper">
              <el-input-number
                v-model="memoryMB"
                :min="512"
                :max="32768"
                :step="512"
                class="vm-input-number"
                controls-position="right"
              />
              <span class="input-unit">MB</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="16" height="16" style="margin-right: 6px">
                <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke="#40a9ff" stroke-width="1.2" />
                <rect x="5" y="6" width="6" height="1" fill="#40a9ff" />
                <rect x="5" y="8" width="3" height="1" fill="#40a9ff" />
              </svg>
              当前内存
            </label>
            <div class="input-wrapper">
              <el-input-number
                v-model="currentMemoryMB"
                :min="512"
                :max="memoryMB"
                :step="512"
                class="vm-input-number"
                controls-position="right"
              />
              <span class="input-unit">MB</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <svg width="16" height="16" style="margin-right: 6px">
                <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="#00d8ff" stroke-width="1.2" />
                <path d="M6 7h4M6 9h3" stroke="#00d8ff" stroke-width="1" />
              </svg>
              使用模板
            </label>
            <div class="input-wrapper">
              <el-select
                v-model="formData.templateId"
                placeholder="请选择VM模板"
                class="vm-select"
                :loading="vmTemplateStore.loading"
                @change="handleTemplateChange"
              >
                <el-option
                  v-for="option in vmTemplateStore.templateOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <span class="input-unit"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="custom-dialog-footer">
        <button class="dialog-btn cancel-btn" @click="handleCancel">
          <el-icon><Close /></el-icon>
          取消
        </button>
        <button class="dialog-btn confirm-btn" @click="handleConfirm" :disabled="loading">
          <el-icon v-if="loading"><Loading /></el-icon>
          <el-icon v-else><Check /></el-icon>
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Close, Check, Loading } from '@element-plus/icons-vue';
import { editVMNode } from '../../../api/node';
import { getUserInfo } from '../../../store/user';
import { useVMTemplateStore } from '../../../store/modules/vmTemplate';
import { useTopoStore } from '../../../store/modules/topo';

interface VMEditData {
  cpu: number;
  memory: string;
  currentMemory: string;
  templateId: number;
}

interface Props {
  visible: boolean;
  nodeId: number;
  sessionId: number | string;
  templateId: number;
  templateName: string;
  initialData: VMEditData;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', data: VMEditData): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const vmTemplateStore = useVMTemplateStore();
const topoStore = useTopoStore();

const formData = ref({
  cpu: 1,
  memory: '1048576',
  currentMemory: '1048576',
  templateId: 1
});

const memoryMB = computed({
  get: () => Math.round(parseInt(formData.value.memory) / 1024),
  set: (value: number) => {
    formData.value.memory = (value * 1024).toString();
  }
});

const currentMemoryMB = computed({
  get: () => Math.round(parseInt(formData.value.currentMemory) / 1024),
  set: (value: number) => {
    formData.value.currentMemory = (value * 1024).toString();
  }
});

watch(() => props.initialData, (newData) => {
  if (newData) {
    formData.value = {
      ...newData,
      templateId: props.templateId || 1
    };
  }
}, { immediate: true });

watch(() => props.templateId, (newTemplateId) => {
  if (newTemplateId) {
    formData.value.templateId = newTemplateId;
  }
}, { immediate: true });

const handleTemplateChange = (templateId: number) => {
  const selectedTemplate = vmTemplateStore.getTemplateById(templateId);
  if (selectedTemplate) {
    formData.value.cpu = selectedTemplate.vcpu || 1;
    formData.value.memory = selectedTemplate.memory || '1048576';
    formData.value.currentMemory = selectedTemplate.curMemory || selectedTemplate.memory || '1048576';

    ElMessage.success(`已切换到模板: ${selectedTemplate.name}`);
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};

const handleConfirm = async () => {
  try {
    loading.value = true;

    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    const editData = {
      sessionId: props.sessionId,
      userId: userId,
      nodeId: props.nodeId,
      templateId: formData.value.templateId,
      cpu: formData.value.cpu,
      currentMemory: formData.value.currentMemory,
      memory: formData.value.memory
    };

    const response = await editVMNode(editData) as any;

    if (response && response.code === 200) {
      if (response.data && topoStore.topoData) {
        (topoStore as any).setTopoData(response.data.id, response.data);
      } else {
        const currentTopoData = topoStore.topoData;
        if (currentTopoData && currentTopoData.nodes) {
          const nodeToUpdate = currentTopoData.nodes.find((n: any) => n.id === props.nodeId);
          if (nodeToUpdate) {
            nodeToUpdate.vcpu = formData.value.cpu;
            nodeToUpdate.memory = formData.value.memory;
            nodeToUpdate.curMemory = formData.value.currentMemory;
            nodeToUpdate.templateId = formData.value.templateId;

            const selectedTemplate = vmTemplateStore.getTemplateById(formData.value.templateId);
            if (selectedTemplate) {
              nodeToUpdate.templateName = selectedTemplate.name;
              nodeToUpdate.disk = selectedTemplate.disk;
              nodeToUpdate.location = selectedTemplate.location;
            }

          }
        }
      }

      ElMessage.success('虚拟机参数更新成功');
      emit('confirm', formData.value);
      emit('update:visible', false);
    } else {
      ElMessage.error(response?.msg || '更新虚拟机参数失败');
    }
  } catch (error: any) {
    console.error('更新虚拟机参数失败:', error);
    ElMessage.error(error?.message || '更新虚拟机参数失败，请重试');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    await vmTemplateStore.ensureTemplatesAvailable();
  } catch (error) {
    console.error('获取VM模板失败:', error);
    ElMessage.warning('获取VM模板失败，请稍后重试');
  }
});
</script>

<style scoped>
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
  width: 480px;
  background: rgba(5, 27, 48, 0.95);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-family: "Microsoft YaHei", sans-serif;
  border: 1px solid rgba(0, 216, 255, 0.2);
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
  background: linear-gradient(90deg, transparent, rgba(0, 216, 255, 0.5), transparent);
}

.custom-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 216, 255, 0.15);
  background: rgba(5, 27, 48, 0.8);
}

.dialog-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #00d8ff;
  letter-spacing: 0.5px;
}

.dialog-close-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.dialog-close-btn:hover {
  color: #00d8ff;
  background: rgba(0, 216, 255, 0.1);
}

.custom-dialog-body {
  padding: 24px;
  background: linear-gradient(135deg, rgba(5, 27, 48, 0.9), rgba(10, 59, 102, 0.9));
}

.vm-edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.readonly {
  opacity: 0.7;
}

.form-label {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  color: #a6e1ff;
  letter-spacing: 0.3px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-unit {
  color: #666;
  font-size: 14px;
  min-width: 30px;
}

.readonly-unit {
  visibility: hidden;
}

.readonly-value {
  flex: 1;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(102, 102, 102, 0.3);
  border-radius: 6px;
  color: #999;
  font-size: 14px;
  height: 32px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(0, 216, 255, 0.15);
  background: rgba(5, 27, 48, 0.8);
}

.dialog-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
}

.cancel-btn {
  background: rgba(102, 102, 102, 0.2);
  color: #999;
  border: 1px solid rgba(102, 102, 102, 0.3);
}

.cancel-btn:hover {
  background: rgba(102, 102, 102, 0.3);
  color: #ccc;
}

.confirm-btn {
  background: linear-gradient(135deg, #0088ff, #00d8ff);
  color: white;
  border: 1px solid #00d8ff;
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0066cc, #00a6cc);
  box-shadow: 0 4px 12px rgba(0, 216, 255, 0.3);
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

<style>
.vm-input-number {
  flex: 1 !important;
}

.vm-input-number .el-input__wrapper {
  background: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(0, 216, 255, 0.2) !important;
  border-radius: 6px !important;
  box-shadow: none !important;
}

.vm-input-number .el-input__wrapper:hover {
  border-color: rgba(0, 216, 255, 0.4) !important;
}

.vm-input-number .el-input__wrapper.is-focus {
  border-color: #00d8ff !important;
  box-shadow: 0 0 8px rgba(0, 216, 255, 0.2) !important;
}

.vm-input-number .el-input__inner {
  color: #a6e1ff !important;
  text-align: center !important;
}

.vm-input-number .el-input-number__increase,
.vm-input-number .el-input-number__decrease {
  background: rgba(0, 216, 255, 0.1) !important;
  border-color: rgba(0, 216, 255, 0.2) !important;
  color: #00d8ff !important;
}

.vm-input-number .el-input-number__increase:hover,
.vm-input-number .el-input-number__decrease:hover {
  background: rgba(0, 216, 255, 0.2) !important;
  color: white !important;
}

.vm-select {
  flex: 1 !important;
}

.vm-select .el-select__wrapper {
  background: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(0, 216, 255, 0.2) !important;
  border-radius: 6px !important;
  box-shadow: none !important;
}

.vm-select .el-select__wrapper:hover {
  border-color: rgba(0, 216, 255, 0.4) !important;
}

.vm-select .el-select__wrapper.is-focused {
  border-color: #00d8ff !important;
  box-shadow: 0 0 8px rgba(0, 216, 255, 0.2) !important;
}

.vm-select .el-select__placeholder {
  color: #666 !important;
}

.vm-select .el-input__inner {
  color: #a6e1ff !important;
}

.vm-select .el-select__caret {
  color: #00d8ff !important;
}
</style>
