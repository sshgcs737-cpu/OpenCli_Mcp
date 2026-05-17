<template>
  <el-dialog
    v-model="visible"
    title="场景编辑"
    width="800px"
    class="edit-dialog"
    :before-close="handleClose"
    append-to-body
    :modal-append-to-body="false"
    :z-index="2000"
  >
    <div class="edit-panel">
      <!-- 设备节点管理 -->
      <div class="edit-section">
        <div class="edit-section-header">
          <el-icon><Monitor /></el-icon>
          <span>设备节点</span>
          <div class="tech-line"></div>
        </div>
        
        <!-- 节点类型分组 -->
        <div v-for="(nodes, type) in groupedNodes" :key="type" class="edit-node-group">
          <div class="edit-group-header">
            <span class="edit-group-title">{{ type }}</span>
            <span class="edit-node-count">({{ nodes.length }})</span>
          </div>
          
          <div class="edit-node-list">
            <div v-for="node in nodes" :key="node.id" class="edit-node-item">
              <div class="edit-node-info">
                <el-icon><Connection /></el-icon>
                <span class="edit-node-name">{{ node.alias || node.name }}</span>
                <span class="edit-node-id">ID: {{ node.id }}</span>
              </div>
              <el-button 
                class="edit-delete-btn" 
                type="danger" 
                size="small"
                @click="handleDeleteNode(node)"
              >
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 链路管理 -->
      <div class="edit-section">
        <div class="edit-section-header">
          <el-icon><Link /></el-icon>
          <span>链路</span>
          <div class="tech-line"></div>
        </div>
        
        <div class="edit-link-list">
          <div v-for="link in links" :key="link.id" class="edit-link-item">
            <div class="edit-link-info">
              <el-icon><Connection /></el-icon>
              <span class="edit-link-name">{{ link.name }}</span>
              <span class="edit-link-detail">{{ link.source }} → {{ link.target }}</span>
            </div>
            <el-button 
              class="edit-delete-btn" 
              type="danger" 
              size="small"
              @click="handleDeleteLink(link)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </div>
      
      <!-- 科技装饰元素 -->
      <div class="tech-decoration">
        <div class="tech-scanning-line"></div>
        <div class="tech-grid"></div>
        <div class="tech-pulse-dots">
          <div class="tech-pulse-dot"></div>
          <div class="tech-pulse-dot"></div>
          <div class="tech-pulse-dot"></div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Monitor, Connection, Link, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { storeToRefs } from 'pinia';
import { useTopoStore } from '../../../store/modules/topo';
import { getNodeTypeLabelCN } from '../../../utils/nodeTypeUtils';

// 定义节点和链路的类型
interface Node {
  id: string;
  name: string;
  type: string;
}

interface Link {
  id: string;
  name: string;
  source: string;
  target: string;
}

// 获取topo store
const topoStore = useTopoStore();
const { topoData } = storeToRefs(topoStore);

// 定义props
const props = defineProps<{
  modelValue: boolean;
}>();

// 定义emit
const emit = defineEmits(['update:modelValue']);

// 从topoData中提取节点和链路数据
// 判断是否为分布式场景
const isDistributedScene = computed(() => {
  if (topoData.value?.metadata && topoData.value.metadata.disturb) {
    return topoData.value.metadata.disturb === '1';
  } else if (topoData.value?.options && topoData.value.options.disturb) {
    return topoData.value.options.disturb === '1';
  }
  return false;
});

// 动态获取节点类型标签（考虑分布式场景）
const getNodeTypeDisplayLabel = (nodeType: string) => {
  if (nodeType === 'DEFAULT' && isDistributedScene.value) {
    return '路由器';
  }
  return getNodeTypeLabelCN(nodeType);
};

const nodes = computed(() => {
  if (!topoData.value?.nodes) return [];
  return topoData.value.nodes.map((node: any) => ({
    id: node.id,
    name: node.alias || node.name || `节点${node.id}`,
    type: getNodeTypeDisplayLabel(node.type || 'OTHER')
  }));
});

const links = computed(() => {
  if (!topoData.value?.links) return [];
  return topoData.value.links.map((link: any) => ({
    id: link.id,
    name: link.name || `链路${link.id}`,
    source: link.source,
    target: link.target
  }));
});

// 计算属性：按类型分组的节点
const groupedNodes = computed(() => {
  const groups: { [key: string]: Node[] } = {};
  nodes.value.forEach((node: Node) => {
    if (!groups[node.type]) {
      groups[node.type] = [];
    }
    groups[node.type].push(node);
  });
  return groups;
});

// 对话框可见性
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 关闭对话框
const handleClose = () => {
  visible.value = false;
};

// 删除节点
const handleDeleteNode = (node: Node) => {
  ElMessage.success(`删除节点: ${node.alias || node.name}`);
  // TODO: 实现删除节点的逻辑
};

// 删除链路
const handleDeleteLink = (link: Link) => {
  ElMessage.success(`删除链路: ${link.name}`);
  // TODO: 实现删除链路的逻辑
};

// 监听topoData变化
watch(topoData, (newValue) => {
  if (newValue) {
  }
}, { deep: true });
</script>

<style>
/* 使用不带scoped的全局样式，确保样式能够正确应用到Element Plus对话框 */
.el-dialog.edit-dialog {
  --edit-blue-dark: #051022;
  --edit-blue-mid: #0a2044;
  --edit-blue-light: #00eaff;
  --edit-blue-glow: rgba(0, 234, 255, 0.3);
  --edit-text-primary: #4dd0ff;
  --edit-text-secondary: #b6eaff;
  --edit-text-tertiary: #8ab4ff;
  --edit-border-light: rgba(0, 234, 255, 0.2);
  --edit-red-light: rgba(255, 77, 77, 0.3);
  --edit-red-text: #ffb6b6;
  --edit-red-hover: rgba(255, 77, 77, 0.5);
  --edit-red: #ff4d4d;
  --edit-red-glow: rgba(255, 77, 77, 0.3);
  margin: 0 !important;
}

/* 对话框样式 */
.el-dialog.edit-dialog {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  max-width: 90vw;
  max-height: 90vh;
  background: linear-gradient(135deg, var(--edit-blue-dark), var(--edit-blue-mid)) !important;
  border: 1px solid var(--edit-border-light) !important;
  box-shadow: 0 0 30px var(--edit-blue-glow) !important;
  backdrop-filter: blur(10px);
  border-radius: 8px !important;
  overflow: hidden;
  z-index: 2000 !important;
}

/* 对话框头部 */
.el-dialog.edit-dialog .el-dialog__header {
  background: linear-gradient(90deg, var(--edit-blue-dark), var(--edit-blue-mid)) !important;
  border-bottom: 1px solid var(--edit-border-light) !important;
  padding: 15px 20px !important;
  position: relative;
}

.el-dialog.edit-dialog .el-dialog__header::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--edit-blue-light), transparent);
}

/* 对话框标题 */
.el-dialog.edit-dialog .el-dialog__title {
  color: var(--edit-text-primary) !important;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
  font-size: 18px !important;
  text-shadow: 0 0 8px var(--edit-blue-glow) !important;
  letter-spacing: 0.5px !important;
}

/* 关闭按钮 */
.el-dialog.edit-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--edit-text-primary) !important;
  transition: all 0.3s;
}

.el-dialog.edit-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: var(--edit-blue-light) !important;
  text-shadow: 0 0 8px var(--edit-blue-light) !important;
  transform: scale(1.1) !important;
}

/* 对话框内容区域 */
.el-dialog.edit-dialog .el-dialog__body {
  padding: 20px !important;
  background: linear-gradient(135deg, var(--edit-blue-dark), var(--edit-blue-mid)) !important;
  color: var(--edit-text-secondary) !important;
  max-height: 70vh !important;
  overflow-y: auto !important;
}

/* 以下使用scoped样式处理内部元素 */
</style>

<style scoped>
/* 主面板 */
.edit-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
}

/* 区块样式 */
.edit-section {
  background: rgba(10, 30, 60, 0.3);
  border-radius: 8px;
  border: 1px solid var(--edit-border-light);
  padding: 16px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}

.edit-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--edit-blue-light), transparent);
  opacity: 0.5;
}

/* 区块头部 */
.edit-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--edit-border-light);
  position: relative;
}

.edit-section-header .el-icon {
  font-size: 20px;
  color: var(--edit-blue-light);
  text-shadow: 0 0 8px var(--edit-blue-glow);
}

.edit-section-header span {
  color: var(--edit-text-primary);
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px var(--edit-blue-glow);
}

.tech-line {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--edit-blue-light), transparent);
  opacity: 0.6;
}

/* 节点组 */
.edit-node-group {
  margin-bottom: 20px;
}

.edit-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.edit-group-title {
  color: var(--edit-text-secondary);
  font-size: 14px;
  font-weight: bold;
}

.edit-node-count {
  color: var(--edit-blue-light);
  font-size: 12px;
  text-shadow: 0 0 5px var(--edit-blue-glow);
}

/* 节点列表和链路列表 */
.edit-node-list, .edit-link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-node-item, .edit-link-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(5, 16, 34, 0.4);
  border-radius: 6px;
  border: 1px solid var(--edit-border-light);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.edit-node-item::before, .edit-link-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.1), transparent);
  transition: left 0.5s;
}

.edit-node-item:hover::before, .edit-link-item:hover::before {
  left: 100%;
}

.edit-node-item:hover, .edit-link-item:hover {
  background: rgba(10, 32, 68, 0.5);
  border-color: var(--edit-blue-light);
  box-shadow: 0 0 10px var(--edit-blue-glow);
  transform: translateY(-1px);
}

/* 节点和链路信息 */
.edit-node-info, .edit-link-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-node-info .el-icon, .edit-link-info .el-icon {
  color: var(--edit-blue-light);
  font-size: 16px;
  text-shadow: 0 0 5px var(--edit-blue-glow);
}

.edit-node-name, .edit-link-name {
  color: var(--edit-text-secondary);
  font-size: 14px;
}

.edit-node-id, .edit-link-detail {
  color: var(--edit-text-tertiary);
  font-size: 12px;
  margin-left: 8px;
}

/* 删除按钮 */
.edit-delete-btn {
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid var(--edit-red-light);
  color: var(--edit-red-text);
  transition: all 0.3s ease;
}

.edit-delete-btn:hover {
  background: rgba(255, 77, 77, 0.2);
  border-color: var(--edit-red-hover);
  color: var(--edit-red);
  box-shadow: 0 0 8px var(--edit-red-glow);
  transform: translateY(-1px);
}

.edit-delete-btn .el-icon {
  margin-right: 4px;
}

/* 科技装饰元素 */
.tech-decoration {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.5;
}

.tech-scanning-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--edit-blue-light), transparent);
  animation: scan-line 3s linear infinite;
}

@keyframes scan-line {
  0% { transform: translateY(0) translateX(-100%); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(60px) translateX(100%); opacity: 0; }
}

.tech-grid {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background-image: 
    linear-gradient(rgba(0, 140, 255, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 140, 255, 0.1) 1px, transparent 1px);
  background-size: 10px 10px;
}

.tech-pulse-dots {
  position: absolute;
  right: 20px;
  bottom: 20px;
  display: flex;
  gap: 6px;
}

.tech-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--edit-blue-light);
}

.tech-pulse-dot:nth-child(1) {
  animation: pulse 2s infinite;
}

.tech-pulse-dot:nth-child(2) {
  animation: pulse 2s infinite 0.6s;
}

.tech-pulse-dot:nth-child(3) {
  animation: pulse 2s infinite 1.2s;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 0.4; }
  100% { transform: scale(1); opacity: 0.8; }
}
</style> 