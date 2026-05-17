<template>
  <Teleport to="body">
    <div v-if="visible" class="slot-config-overlay" @click.self="handleClose">
      <div class="slot-config-dialog">
        <div class="slot-config-header">
          <span class="slot-config-title">时隙配置</span>
          <span class="slot-config-close" @click="handleClose">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <line x1="5" y1="5" x2="15" y2="15" stroke="#b6eaff" stroke-width="2" stroke-linecap="round" />
              <line x1="15" y1="5" x2="5" y2="15" stroke="#b6eaff" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
        </div>

        <div class="slot-config-content">
          <!-- 文件路径配置 -->
          <div class="config-section">
            <div class="section-title">TDMA调度文件</div>
            <div class="form-row">
              <div class="form-label">文件路径</div>
              <div class="form-input-group">
                <el-input
                  v-model="localConfig.filePath"
                  placeholder="请输入调度文件路径"
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <!-- 时隙基本配置 -->
          <div class="config-section">
            <div class="section-title">时隙基本参数</div>
            <div class="form-row">
              <div class="form-label">时隙数</div>
              <div class="form-input-group">
                <el-input-number
                  v-model="localConfig.slotCount"
                  :min="connectedNodes.length || 1"
                  :max="100"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-label">时隙宽度 (μs)</div>
              <div class="form-input-group">
                <el-input-number
                  v-model="localConfig.slotWidth"
                  :min="1"
                  :max="100000"
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <!-- 节点时隙映射配置 -->
          <div class="config-section">
            <div class="section-title">节点时隙映射</div>

            <div v-if="connectedNodes.length > 0" class="node-mapping-list">
              <div
                v-for="node in connectedNodes"
                :key="node.nemId"
                class="node-mapping-item"
              >
                <div class="node-info">
                  <span class="node-name">{{ node.name }}</span>
                </div>
                <div class="slot-selector">
                  <el-input-number
                    v-model="localConfig.nodeSlotMap[node.nemId]"
                    :min="0"
                    :max="localConfig.slotCount - 1"
                    placeholder="时隙索引"
                    class="slot-input"
                  />
                </div>
              </div>
            </div>

            <div v-else class="no-nodes-hint">
              未检测到连接的节点
            </div>
          </div>
        </div>

        <div class="slot-config-footer">
          <button class="cancel-btn" @click="handleClose">取消</button>
          <button class="confirm-btn" @click="handleConfirm">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useTopoStore } from '../../../store/modules/topo';
import type { Node } from '../../../types/topo';

// 定义属性
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  subnetId: {
    type: Number,
    required: true,
  },
  initialConfig: {
    type: Object,
    default: () => ({
      filePath: '/usr/local/share/core/tdmaschedule/schedule1.xml',
      slotCount: 1,
      slotWidth: 10000,
      nodeSlotMap: {},
    }),
  },
});

// 定义事件
const emit = defineEmits(['close', 'confirm']);

const topoStore = useTopoStore();

// 本地配置数据
const localConfig = ref({
  filePath: '/usr/local/share/core/tdmaschedule/schedule1.xml',
  slotCount: 1,
  slotWidth: 10000,
  nodeSlotMap: {} as Record<number, number>,
});

// 获取连接到该子网的节点
const connectedNodes = computed(() => {
  if (!topoStore.topoData?.links || !props.subnetId) {
    return [];
  }

  const subnetId = props.subnetId;
  const nodes: Array<{ nemId: number; name: string }> = [];

  // 查找所有连接到该子网的链路
  topoStore.topoData.links.forEach((link: any) => {
    if (link.node1_id === subnetId || link.node2_id === subnetId) {
      // 获取另一端的节点ID
      const nodeId = link.node1_id === subnetId ? link.node2_id : link.node1_id;

      // 查找节点信息
      const node = topoStore.topoData?.nodes?.find((n: Node) => n.id === nodeId);

      if (node && node.type !== 'EMANE') {
        nodes.push({
          nemId: node.id,
          name: node.name,
        });
      }
    }
  });

  return nodes;
});

// 监听visible变化，初始化配置
watch(() => props.visible, (newVal) => {
  if (newVal) {
    localConfig.value = {
      ...props.initialConfig,
      nodeSlotMap: { ...props.initialConfig.nodeSlotMap },
    };

    // 根据连接的节点数自动设置时隙数
    const nodeCount = connectedNodes.value.length;
    if (nodeCount > 0) {
      // 如果节点数大于当前时隙数，自动调整时隙数
      if (localConfig.value.slotCount < nodeCount) {
        localConfig.value.slotCount = nodeCount;
      }
    }

    // 为所有连接的节点初始化默认时隙映射
    connectedNodes.value.forEach((node, index) => {
      if (localConfig.value.nodeSlotMap[node.nemId] === undefined) {
        localConfig.value.nodeSlotMap[node.nemId] = index % localConfig.value.slotCount;
      }
    });
  }
});

// 处理关闭
const handleClose = () => {
  emit('close');
};

// 处理确认
const handleConfirm = () => {
  emit('confirm', { ...localConfig.value });
  handleClose();
};
</script>

<style scoped>
.slot-config-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlay-fade-in 0.3s ease;
}

@keyframes overlay-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.slot-config-dialog {
  background: linear-gradient(135deg, rgba(8, 15, 39, 0.95) 0%, rgba(17, 23, 64, 0.95) 100%);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);
  width: min(600px, calc(100vw - 40px));
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 122, 255, 0.3);
  animation: dialog-slide-in 0.3s cubic-bezier(0.19, 1, 0.22, 1);
}

@keyframes dialog-slide-in {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.slot-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(90deg, rgba(9, 84, 159, 0.4) 0%, rgba(40, 75, 150, 0.2) 100%);
  border-bottom: 1px solid rgba(0, 122, 255, 0.2);
}

.slot-config-title {
  font-size: 18px;
  font-weight: 600;
  color: #00c6ff;
  text-shadow: 0 0 10px rgba(0, 198, 255, 0.3);
}

.slot-config-close {
  cursor: pointer;
  color: rgba(0, 198, 255, 0.8);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 122, 255, 0.1);
  transition: all 0.2s ease;
}

.slot-config-close:hover {
  color: #00c6ff;
  background-color: rgba(0, 122, 255, 0.3);
  transform: rotate(90deg);
}

.slot-config-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 122, 255, 0.3) transparent;
}

.slot-config-content::-webkit-scrollbar {
  width: 6px;
}

.slot-config-content::-webkit-scrollbar-track {
  background: transparent;
}

.slot-config-content::-webkit-scrollbar-thumb {
  background: rgba(0, 122, 255, 0.3);
  border-radius: 3px;
}

.slot-config-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 122, 255, 0.5);
}

.config-section {
  margin-bottom: 28px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(0, 122, 255, 0.15);
}

.config-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #7fdfff;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #00c6ff, #0088ff);
  border-radius: 2px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  min-width: 140px;
  color: #b6eaff;
  font-size: 14px;
  font-weight: 500;
}

.form-input-group {
  flex: 1;
}

.form-input {
  width: 100%;
}

:deep(.el-input__wrapper) {
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.2);
  box-shadow: none;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(0, 122, 255, 0.4);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #00c6ff;
  box-shadow: 0 0 0 2px rgba(0, 198, 255, 0.1);
}

:deep(.el-input__inner) {
  color: #eaf6ff;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(182, 234, 255, 0.4);
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-input-number .el-input__wrapper) {
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.2);
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  background: rgba(0, 122, 255, 0.15);
  border-left: 1px solid rgba(0, 122, 255, 0.2);
  color: #00c6ff;
}

:deep(.el-input-number__decrease:hover),
:deep(.el-input-number__increase:hover) {
  background: rgba(0, 122, 255, 0.25);
  color: #7fdfff;
}


.node-mapping-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-mapping-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(0, 122, 255, 0.08);
  border: 1px solid rgba(0, 122, 255, 0.2);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.node-mapping-item:hover {
  background: rgba(0, 122, 255, 0.12);
  border-color: rgba(0, 122, 255, 0.3);
  transform: translateX(4px);
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-id {
  color: #00c6ff;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

.node-name {
  color: #b6eaff;
  font-size: 14px;
}

.slot-selector {
  min-width: 140px;
}

.slot-input {
  width: 100%;
}

.no-nodes-hint {
  color: rgba(182, 234, 255, 0.6);
  font-size: 14px;
  font-style: italic;
  text-align: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px dashed rgba(0, 122, 255, 0.2);
}

.slot-config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(0, 122, 255, 0.2);
}

.cancel-btn,
.confirm-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #b6eaff;
  border: 1px solid rgba(0, 122, 255, 0.2);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 122, 255, 0.3);
}

.confirm-btn {
  background: linear-gradient(135deg, #00c6ff, #0088ff);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 198, 255, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #0088ff, #0066cc);
  box-shadow: 0 4px 12px rgba(0, 198, 255, 0.5);
  transform: translateY(-1px);
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .slot-config-dialog {
    width: calc(100vw - 20px);
    max-height: 90vh;
  }

  .form-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .form-label {
    min-width: auto;
  }

  .node-mapping-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .slot-selector {
    width: 100%;
  }
}
</style>
