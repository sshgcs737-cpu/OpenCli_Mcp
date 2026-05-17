<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog template-config-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">配置模板参数</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- 模板基本信息 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">模板信息</span>
            </div>
            <div class="template-info">
              <div class="info-item">
                <span class="info-label">模板名称：</span>
                <span class="info-value">{{ templateData?.name || '未命名模板' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">节点数量：</span>
                <span class="info-value">{{ nodeConfigs.length }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">链路数量：</span>
                <span class="info-value">{{ linkConfigs.length }}</span>
              </div>
            </div>
          </div>

          <!-- 节点配置 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">节点配置</span>
              <span class="section-subtitle">(请为每个节点配置名称和别名)</span>
            </div>
            <div class="node-config-list">
              <div
                v-for="(config, index) in nodeConfigs"
                :key="index"
                class="node-config-item"
              >
                <div class="config-row">
                  <div class="config-field">
                    <label class="field-label">节点 {{ index + 1 }}<span class="required">*</span></label>
                    <el-input
                      v-model="config.name"
                      placeholder="请输入节点名称"
                      size="small"
                      maxlength="50"
                    />
                  </div>
                  <div class="config-field">
                    <label class="field-label">别名</label>
                    <el-input
                      v-model="config.alias"
                      placeholder="请输入别名"
                      size="small"
                      maxlength="50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 链路配置 -->
          <div class="config-section" v-if="linkConfigs.length > 0">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">链路配置</span>
              <span class="section-subtitle">(请为每条链路配置IP地址和掩码)</span>
            </div>
            <div class="link-config-list">
              <div
                v-for="(config, index) in linkConfigs"
                :key="index"
                class="link-config-item"
              >
                <div class="link-header">
                  <span class="link-index">链路 {{ index + 1 }}</span>
                  <span class="link-nodes">
                    {{ getNodeNameByIndex(config.node1Index) }} ↔ {{ getNodeNameByIndex(config.node2Index) }}
                  </span>
                </div>
                <div class="config-row">
                  <div class="config-field">
                    <label class="field-label">接口1 IP</label>
                    <el-input
                      v-model="config.iface1Ip"
                      placeholder="例如: 192.168.1.1"
                      size="small"
                    />
                  </div>
                  <div class="config-field">
                    <label class="field-label">接口1 掩码</label>
                    <el-input
                      v-model="config.iface1Mask"
                      placeholder="例如: 24"
                      size="small"
                      type="number"
                    />
                  </div>
                  <div class="config-field">
                    <label class="field-label">接口2 IP</label>
                    <el-input
                      v-model="config.iface2Ip"
                      placeholder="例如: 192.168.1.2"
                      size="small"
                    />
                  </div>
                  <div class="config-field">
                    <label class="field-label">接口2 掩码</label>
                    <el-input
                      v-model="config.iface2Mask"
                      placeholder="例如: 24"
                      size="small"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 使用说明 -->
          <div class="usage-tips">
            <div class="tip-icon">ℹ️</div>
            <div class="tip-text">
              点击"开始放置"后，请在地图上点击选择模板放置位置
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button
            class="dialog-btn confirm-btn"
            @click="handleStartPlacement"
            :disabled="!canStartPlacement"
          >
            开始放置
          </el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits } from 'vue';
import { ElMessage } from 'element-plus';
import { useTopoStore } from '../../../store/modules/topo';
import type { TemplateListItem, TemplateNode, TemplateLink } from '../../../api/scene';

interface NodeConfig {
  name: string;
  alias: string;
  originalNode: TemplateNode;
  originalIndex: number;
}

interface LinkConfig {
  node1Index: number;
  node2Index: number;
  iface1Ip: string;
  iface1Mask: string;
  iface2Ip: string;
  iface2Mask: string;
  originalLink: TemplateLink;
}

const props = defineProps<{
  visible: boolean;
  templateData: TemplateListItem | null;
}>();

const emit = defineEmits(['update:visible', 'close', 'start-placement']);

const topoStore = useTopoStore();
const dialogVisible = ref(props.visible);
const nodeConfigs = ref<NodeConfig[]>([]);
const linkConfigs = ref<LinkConfig[]>([]);

// 监听visible变化
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal && props.templateData) {
    initializeConfigs();
  }
});

watch(() => dialogVisible.value, (newVal) => {
  emit('update:visible', newVal);
});

// 初始化配置
const initializeConfigs = () => {
  if (!props.templateData) return;

  // 初始化节点配置
  nodeConfigs.value = (props.templateData.nodeJson || []).map((node, index) => ({
    name: node.name || `节点${index + 1}`,
    alias: node.alias || node.name || `节点${index + 1}`,
    originalNode: node,
    originalIndex: index
  }));

  // 初始化链路配置
  linkConfigs.value = (props.templateData.linkJson || []).map((link) => {
    // 找到链路对应的节点索引
    const node1Index = (props.templateData!.nodeJson || []).findIndex(n => n.id === link.node1_id);
    const node2Index = (props.templateData!.nodeJson || []).findIndex(n => n.id === link.node2_id);

    return {
      node1Index,
      node2Index,
      iface1Ip: link.iface1?.ip4 || '',
      iface1Mask: link.iface1?.ip4_mask?.toString() || '24',
      iface2Ip: link.iface2?.ip4 || '',
      iface2Mask: link.iface2?.ip4_mask?.toString() || '24',
      originalLink: link
    };
  });
};

// 是否可以开始放置
const canStartPlacement = computed(() => {
  // 检查所有节点是否都有名称
  return nodeConfigs.value.every(config => config.name.trim() !== '');
});

// 根据索引获取节点名称
const getNodeNameByIndex = (index: number): string => {
  if (index >= 0 && index < nodeConfigs.value.length) {
    return nodeConfigs.value[index].name || `节点${index + 1}`;
  }
  return '未知节点';
};

// 验证节点名和IP是否与场景中已存在的节点重复
const validateNodesAndIps = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const existingNodes = topoStore.topoData?.nodes || [];

  // 检查节点名是否重复
  nodeConfigs.value.forEach((config, index) => {
    const trimmedName = config.name.trim();

    // 检查与场景中已存在节点的名称是否重复
    const existingNodeWithSameName = existingNodes.find(
      (node: any) => node.name === trimmedName
    );

    if (existingNodeWithSameName) {
      errors.push(`节点 ${index + 1} 的名称 "${trimmedName}" 与场景中已存在的节点重复`);
    }
  });

  // 收集所有配置中的IP地址
  const configuredIps = new Set<string>();
  linkConfigs.value.forEach((config, index) => {
    if (config.iface1Ip && config.iface1Ip.trim()) {
      configuredIps.add(config.iface1Ip.trim());
    }
    if (config.iface2Ip && config.iface2Ip.trim()) {
      configuredIps.add(config.iface2Ip.trim());
    }
  });

  // 收集场景中已存在的所有IP地址
  const existingIps = new Set<string>();
  if (topoStore.topoData?.links) {
    topoStore.topoData.links.forEach((link: any) => {
      if (link.iface1?.ip4) {
        existingIps.add(link.iface1.ip4);
      }
      if (link.iface2?.ip4) {
        existingIps.add(link.iface2.ip4);
      }
    });
  }

  // 检查IP是否重复
  const duplicateIps: string[] = [];
  configuredIps.forEach(ip => {
    if (existingIps.has(ip)) {
      duplicateIps.push(ip);
    }
  });

  if (duplicateIps.length > 0) {
    errors.push(`以下IP地址与场景中已存在的IP重复: ${duplicateIps.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// 开始放置
const handleStartPlacement = () => {
  if (!canStartPlacement.value) {
    ElMessage.warning('请填写所有必填字段');
    return;
  }

  // 验证节点名和IP是否重复
  const validation = validateNodesAndIps();
  if (!validation.valid) {
    validation.errors.forEach(error => {
      ElMessage.error(error);
    });
    return;
  }

  // 发送配置数据到父组件
  emit('start-placement', {
    nodeConfigs: nodeConfigs.value,
    linkConfigs: linkConfigs.value
  });

  handleClose();
};

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};
</script>

<style scoped>
/* 对话框蒙层 */
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
  z-index: 2100;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 对话框容器 */
.custom-dialog {
  width: 700px;
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
  max-height: 90vh;
}

.template-config-dialog {
  width: 900px;
  max-width: 95vw;
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

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 对话框头部 */
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

/* 对话框主体 */
.custom-dialog-body {
  padding: 16px;
  overflow-y: auto;
  color: rgba(255, 255, 255, 0.9);
  max-height: calc(90vh - 120px);
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

/* 对话框底部 */
.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px 16px;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

/* 配置区域 */
.config-section {
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.config-section:last-of-type {
  margin-bottom: 0;
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

.section-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}

/* 模板信息 */
.template-info {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.info-value {
  font-size: 14px;
  color: #0cc4cc;
  font-weight: 500;
}

/* 节点配置列表 */
.node-config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.node-config-list::-webkit-scrollbar {
  width: 6px;
}

.node-config-list::-webkit-scrollbar-track {
  background: transparent;
}

.node-config-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.node-config-item {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* 链路配置列表 */
.link-config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.link-config-list::-webkit-scrollbar {
  width: 6px;
}

.link-config-list::-webkit-scrollbar-track {
  background: transparent;
}

.link-config-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.link-config-item {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.link-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.link-index {
  font-size: 13px;
  color: #0cc4cc;
  font-weight: 500;
  background: rgba(12, 196, 204, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.link-nodes {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

/* 配置行和字段 */
.config-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.required {
  color: #ff4d4f;
  margin-left: 2px;
}

/* 使用提示 */
.usage-tips {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(12, 196, 204, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(12, 196, 204, 0.2);
  margin-top: 16px;
}

.tip-icon {
  font-size: 20px;
}

.tip-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

/* 按钮样式 */
.dialog-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
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

.confirm-btn {
  background: #0cc4cc;
  color: #fff;
  margin-left: 10px;
}

.confirm-btn:hover:not(:disabled) {
  background: #0fd9e2;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Element Plus样式覆盖 */
:deep(.el-input__wrapper) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  box-shadow: none !important;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(12, 196, 204, 0.4);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: rgba(12, 196, 204, 0.6) !important;
}

:deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.3) !important;
}

/* 确保ElMessage显示在对话框之上 */
:deep(.el-message) {
  z-index: 9999 !important;
}
</style>

<style>
/* 全局样式：确保所有ElMessage都显示在对话框之上 */
.el-message {
  z-index: 9999 !important;
}
</style>
