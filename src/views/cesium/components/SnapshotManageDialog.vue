<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">场景快照管理</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">创建快照</span>
            </div>
            <div class="create-snapshot-form">
              <el-input
                v-model="newSnapshotAlias"
                placeholder="请输入快照名称"
                class="form-input"
                @keyup.enter="handleCreateSnapshot"
              />
              <el-button type="primary" @click="handleCreateSnapshot" :loading="isCreatingSnapshot">
                创建快照
              </el-button>
            </div>
          </div> -->

          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">快照列表</span>
            </div>
            
            <div v-if="snapshotLoading" class="snapshot-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
            <div v-else-if="snapshotList.length === 0" class="no-snapshots">
              <el-empty description="暂无快照" />
            </div>
            <div v-else class="snapshot-list">
              <div
                v-for="snapshot in snapshotList"
                :key="snapshot.id"
                class="snapshot-item"
              >
                <div class="snapshot-info">
                  <div class="snapshot-name">{{ snapshot.alias }}</div>
                  <div class="snapshot-time">{{ formatTime(snapshot.updateTime) }}</div>
                </div>
                <div class="snapshot-actions">
                  <el-button
                    type="primary"
                    size="small"
                    @click="handleRecoverySnapshot(snapshot)"
                    :loading="isRecoveringSnapshot && currentRecoveryId === snapshot.id"
                  >
                    恢复
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">关闭</el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, onMounted } from 'vue';
import { Loading, Camera } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { saveSnapshot, getSnapshotList, recoverySnapshot } from '../../../api/scene';
import type { ApiResponse } from '../../../api/scene';
import { useTopoStore } from '../../../store/modules/topo';
import { storeToRefs } from 'pinia';
import eventBus from '../../../utils/eventBus';
import { useSystemLogStore } from '../../../store/modules/systemLog';

const props = defineProps<{
  visible: boolean;
  sessionId: number | null;
}>();

const emit = defineEmits(['update:visible', 'close']);

const dialogVisible = ref(props.visible);

watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal && props.sessionId) {
    loadSnapshotList();
  }
});

watch(() => dialogVisible.value, (newVal) => {
  emit('update:visible', newVal);
});

const topoStore = useTopoStore();
const { currentSessionId } = storeToRefs(topoStore);
const systemLogStore = useSystemLogStore();

const snapshotList = ref<any[]>([]);
const snapshotLoading = ref(false);
const newSnapshotAlias = ref('');
const isCreatingSnapshot = ref(false);
const isRecoveringSnapshot = ref(false);
const currentRecoveryId = ref<number | null>(null);

const handleClose = () => {
  dialogVisible.value = false;
  emit('close');
  resetState();
};

const resetState = () => {
  newSnapshotAlias.value = '';
  isCreatingSnapshot.value = false;
  isRecoveringSnapshot.value = false;
  currentRecoveryId.value = null;
};

const loadSnapshotList = async () => {
  if (!props.sessionId) return;
  
  snapshotLoading.value = true;
  try {
    const response = await getSnapshotList(props.sessionId) as unknown as ApiResponse;
    if (response.code === 200) {
      snapshotList.value = response.data || [];
    } else {
      ElMessage.error(response.msg || '获取快照列表失败');
    }
  } catch (error) {
    console.error('获取快照列表失败:', error);
    ElMessage.error('获取快照列表失败');
  } finally {
    snapshotLoading.value = false;
  }
};

const handleCreateSnapshot = async () => {
  if (!props.sessionId) {
    ElMessage.warning("请先选择场景");
    return;
  }

  if (!newSnapshotAlias.value.trim()) {
    ElMessage.warning("请输入快照名称");
    return;
  }

  isCreatingSnapshot.value = true;
  try {
    systemLogStore.addLog({
      type: 'normal',
      module: 'snapshot',
      action: '开始创建快照',
      information: '快照创建开始',
      details: `开始创建快照 "${newSnapshotAlias.value.trim()}" (场景ID: ${props.sessionId})`
    });

    const response = await saveSnapshot({
      sessionId: props.sessionId,
      alias: newSnapshotAlias.value.trim()
    }) as unknown as ApiResponse;

    if (response.code === 200) {
      systemLogStore.addLog({
        type: 'important',
        module: 'snapshot',
        action: '快照创建成功',
        information: '快照创建成功',
        details: `快照 "${newSnapshotAlias.value.trim()}" 创建成功 (场景ID: ${props.sessionId})`
      });

      ElMessage.success('快照创建成功');
      newSnapshotAlias.value = '';
      loadSnapshotList();
    } else {
      systemLogStore.addLog({
        type: 'important',
        module: 'snapshot',
        action: '快照创建失败',
        information: '快照创建失败',
        details: `快照 "${newSnapshotAlias.value.trim()}" 创建失败: ${response.msg || '未知错误'} (场景ID: ${props.sessionId})`
      });

      ElMessage.error(response.msg || '创建快照失败');
    }
  } catch (error) {
    systemLogStore.addLog({
      type: 'important',
      module: 'snapshot',
      action: '快照创建错误',
      information: '快照创建错误',
      details: `快照 "${newSnapshotAlias.value.trim()}" 创建失败: ${error.message || '未知错误'} (场景ID: ${props.sessionId})`
    });

    console.error('创建快照失败:', error);
    ElMessage.error('创建快照失败');
  } finally {
    isCreatingSnapshot.value = false;
  }
};

const handleRecoverySnapshot = async (snapshot: any) => {
  if (!props.sessionId) {
    ElMessage.warning("请先选择场景");
    return;
  }

  isRecoveringSnapshot.value = true;
  currentRecoveryId.value = snapshot.id;
  
  try {
    const response = await recoverySnapshot({
      snapId: snapshot.id,
      sessionId: props.sessionId
    }) as unknown as ApiResponse;
    
    if (response.code === 200) {
      ElMessage.success(`已恢复快照: ${snapshot.alias}`);
      if (response.data) {
        (topoStore as any).setTopoData(props.sessionId, response.data);
        (eventBus as any).emit("updateTopoData", response.data);
      }
      dialogVisible.value = false;
    } else {
      ElMessage.error(response.msg || '恢复快照失败');
    }
  } catch (error) {
    console.error('恢复快照失败:', error);
    ElMessage.error('恢复快照失败');
  } finally {
    isRecoveringSnapshot.value = false;
    currentRecoveryId.value = null;
  }
};

const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN');
};

onMounted(() => {
  if (props.visible && props.sessionId) {
    loadSnapshotList();
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
  width: 500px;
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

.dialog-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #9aa4b2;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.save-btn {
  background: rgba(12, 196, 204, 0.2);
  color: #0cc4cc;
  margin-left: 10px;
}

.save-btn:hover {
  background: rgba(12, 196, 204, 0.3);
  color: #fff;
}

.confirm-btn {
  background: #0cc4cc;
  color: #fff;
  margin-left: 10px;
}

.confirm-btn:hover {
  background: #0fd9e2;
}

.config-section {
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title-block {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: #0cc4cc;
  border-radius: 2px;
  margin-right: 8px;
}

.section-title {
  color: #fff;
  font-size: 15px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  margin-bottom: 12px;
}

.create-snapshot-form {
  display: flex;
  align-items: center;
  gap: 10px;
}

.snapshot-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.6);
}

.no-snapshots {
  text-align: center;
  padding: 20px;
}

.snapshot-list {
  max-height: 300px;
  overflow-y: auto;
}

.snapshot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.snapshot-item:hover {
  background: rgba(12, 196, 204, 0.1);
  border-color: rgba(12, 196, 204, 0.3);
}

.snapshot-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snapshot-name {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.snapshot-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.snapshot-actions {
  display: flex;
  gap: 8px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style> 