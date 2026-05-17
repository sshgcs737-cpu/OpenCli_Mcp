<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog save-template-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">保存组网模板</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- 模板信息配置 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">模板信息</span>
            </div>
            <div class="template-info-form">
              <div class="form-row">
                <label class="form-label">模板名称<span class="required">*</span></label>
                <el-input
                  v-model="templateName"
                  placeholder="请输入模板名称"
                  class="form-input"
                  maxlength="50"
                  show-word-limit
                />
              </div>
            </div>
          </div>

          <!-- 节点选择 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">选择节点</span>
              <span class="section-subtitle">(已选择 {{ selectedNodeIds.length }} 个节点)</span>
            </div>

            <div class="select-all-row">
              <el-checkbox
                v-model="selectAll"
                @change="handleSelectAll"
                :indeterminate="indeterminate"
              >
                全选
              </el-checkbox>
            </div>

            <div v-if="nodeList.length === 0" class="no-nodes">
              <el-empty description="当前场景暂无节点" :image-size="80" />
            </div>
            <div v-else class="node-list">
              <div
                v-for="node in nodeList"
                :key="node.id"
                class="node-item"
                :class="{ 'selected': selectedNodeIds.includes(node.id) }"
              >
                <el-checkbox
                  :model-value="selectedNodeIds.includes(node.id)"
                  @change="(val: boolean) => handleNodeSelect(node.id, val)"
                >
                  <div class="node-info">
                    <span class="node-name">{{ node.name }}</span>
                    <span v-if="node.alias && node.alias !== node.name" class="node-alias">{{ node.alias }}</span>
                  </div>
                </el-checkbox>
              </div>
            </div>
          </div>

          <!-- 链路预览 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">相关链路</span>
              <span class="section-subtitle">(将保存 {{ relatedLinks.length }} 条链路)</span>
            </div>

            <div v-if="relatedLinks.length === 0" class="no-links">
              <el-empty description="所选节点之间暂无链路" :image-size="60" />
            </div>
            <div v-else class="link-list">
              <div
                v-for="(link, index) in relatedLinks"
                :key="`${link.node1_id}-${link.node2_id}`"
                class="link-item"
              >
                <span class="link-index">{{ index + 1 }}</span>
                <span class="link-info">
                  {{ getNodeName(link.node1_id) }} ↔ {{ getNodeName(link.node2_id) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 预览统计 -->
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-label">节点数量：</span>
              <span class="stat-value">{{ selectedNodeIds.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">链路数量：</span>
              <span class="stat-value">{{ relatedLinks.length }}</span>
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button
            class="dialog-btn confirm-btn"
            @click="handleSaveTemplate"
            :loading="isSaving"
            :disabled="!canSave"
          >
            保存模板
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
import { addTemplate, type TemplateNode, type TemplateLink, type SubnetTemplateData } from '../../../api/scene';
import type { Node, Link } from '../../../types/topo';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'close', 'success']);

const topoStore = useTopoStore();
const dialogVisible = ref(props.visible);

// 表单数据
const templateName = ref('');
const selectedNodeIds = ref<number[]>([]);
const isSaving = ref(false);

// 节点列表
const nodeList = computed(() => {
  return topoStore.topoData?.nodes || [];
});

// 全选状态
const selectAll = computed({
  get: () => selectedNodeIds.value.length === nodeList.value.length && nodeList.value.length > 0,
  set: (val: boolean) => {
    if (val) {
      selectedNodeIds.value = nodeList.value.map(node => node.id);
    } else {
      selectedNodeIds.value = [];
    }
  }
});

// 半选状态
const indeterminate = computed(() => {
  const length = selectedNodeIds.value.length;
  return length > 0 && length < nodeList.value.length;
});

// 相关链路（只包含选中节点之间的链路，并去重）
const relatedLinks = computed(() => {
  if (!topoStore.topoData?.links) return [];

  // 先筛选出选中节点之间的链路
  const filteredLinks = topoStore.topoData.links.filter(link =>
    selectedNodeIds.value.includes(link.node1_id) &&
    selectedNodeIds.value.includes(link.node2_id)
  );

  // 使用Map去重，key为两个节点ID的组合（较小ID在前）
  const uniqueLinksMap = new Map<string, Link>();

  filteredLinks.forEach(link => {
    // 生成唯一键：较小的ID-较大的ID
    const minId = Math.min(link.node1_id, link.node2_id);
    const maxId = Math.max(link.node1_id, link.node2_id);
    const linkKey = `${minId}-${maxId}`;

    // 如果还没有这个链路，则添加
    if (!uniqueLinksMap.has(linkKey)) {
      uniqueLinksMap.set(linkKey, link);
    }
  });

  return Array.from(uniqueLinksMap.values());
});

// 是否可以保存
const canSave = computed(() => {
  return templateName.value.trim() !== '' && selectedNodeIds.value.length > 0;
});

// 监听visible变化
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal) {
    resetForm();
  }
});

// 重置表单
const resetForm = () => {
  templateName.value = '';
  selectedNodeIds.value = [];
};

// 处理全选
const handleSelectAll = (val: boolean) => {
  if (val) {
    selectedNodeIds.value = nodeList.value.map(node => node.id);
  } else {
    selectedNodeIds.value = [];
  }
};

// 处理节点选择
const handleNodeSelect = (nodeId: number, selected: boolean) => {
  if (selected) {
    if (!selectedNodeIds.value.includes(nodeId)) {
      selectedNodeIds.value.push(nodeId);
    }
  } else {
    const index = selectedNodeIds.value.indexOf(nodeId);
    if (index > -1) {
      selectedNodeIds.value.splice(index, 1);
    }
  }
};

// 获取节点名称
const getNodeName = (nodeId: number): string => {
  const node = nodeList.value.find(n => n.id === nodeId);
  return node?.name || `节点${nodeId}`;
};

// 转换节点数据为模板格式
const convertNodeToTemplate = (node: Node): TemplateNode => {
  return {
    id: node.id,
    name: node.name,
    alias: node.alias || node.name,
    role: node.role || 'UNKNOWN',
    type: node.type,
    model: node.model || '',
    position: node.position,
    emane: node.emane,
    icon: node.icon,
    image: node.image || '',
    server: node.server,
    config_services: node.config_services,
    geo: node.geo,
    dir: node.dir,
    channel: node.channel,
    canvas: node.canvas,
    wlan_config: node.wlan_config as any,
    mobility_config: node.mobility_config as any,
    service_configs: node.service_configs as any,
    config_cervice_configs: node.config_cervice_configs || {},
    emane_configs: node.emane_configs as any,
    status: node.status || 'UP',
    phy_type: node.phy_type || ''
  };
};

// 转换链路数据为模板格式
const convertLinkToTemplate = (link: Link): TemplateLink => {
  return {
    node1_id: link.node1_id,
    node2_id: link.node2_id,
    type: link.type,
    iface1: link.iface1 as any,
    iface2: link.iface2 as any,
    options: link.options as any,
    network_id: link.network_id
  };
};

// 保存模板
const handleSaveTemplate = async () => {
  if (!canSave.value) {
    ElMessage.warning('请填写模板名称并选择至少一个节点');
    return;
  }

  if (!topoStore.currentSessionId) {
    ElMessage.warning('请先打开场景');
    return;
  }

  try {
    isSaving.value = true;

    // 获取选中的节点
    const selectedNodes = nodeList.value.filter(node =>
      selectedNodeIds.value.includes(node.id)
    );

    // 转换为模板格式
    const templateNodes: TemplateNode[] = selectedNodes.map(convertNodeToTemplate);
    const templateLinks: TemplateLink[] = relatedLinks.value.map(convertLinkToTemplate);

    // 构建请求数据
    const templateData: SubnetTemplateData = {
      name: templateName.value.trim(),
      sessionId: topoStore.currentSessionId,
      nodes: templateNodes,
      links: templateLinks
    };

    // 调用API保存模板
    const response = await addTemplate(templateData);

    if (response.code === 200) {
      ElMessage.success('模板保存成功');
      emit('success', templateData);
      handleClose();
    } else {
      ElMessage.error(response.msg || '模板保存失败');
    }
  } catch (error: any) {
    console.error('保存模板失败:', error);
    ElMessage.error(error?.message || '模板保存失败，请重试');
  } finally {
    isSaving.value = false;
  }
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
  z-index: 2000;
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
  max-height: 85vh;
}

.save-template-dialog {
  width: 800px;
  max-width: 90vw;
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
  max-height: 65vh;
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

/* 表单样式 */
.template-info-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.required {
  color: #ff4d4f;
  margin-left: 4px;
}

/* 全选行 */
.select-all-row {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(12, 196, 204, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(12, 196, 204, 0.1);
}

/* 节点列表 */
.node-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-list::-webkit-scrollbar {
  width: 6px;
}

.node-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.node-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.node-item {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
}

.node-item:hover {
  background: rgba(12, 196, 204, 0.1);
  border-color: rgba(12, 196, 204, 0.2);
}

.node-item.selected {
  background: rgba(12, 196, 204, 0.15);
  border-color: rgba(12, 196, 204, 0.3);
}

.node-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}

.node-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  min-width: 100px;
}

.node-type {
  font-size: 12px;
  color: rgba(12, 196, 204, 0.8);
  background: rgba(12, 196, 204, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.node-alias {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 链路列表 */
.link-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-list::-webkit-scrollbar {
  width: 6px;
}

.link-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.link-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.link-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(12, 196, 204, 0.2);
  color: #0cc4cc;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 500;
}

.link-info {
  flex: 1;
  color: rgba(255, 255, 255, 0.8);
}

.link-type {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 空状态 */
.no-nodes,
.no-links {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

/* 预览统计 */
.preview-stats {
  display: flex;
  gap: 30px;
  padding: 15px;
  background: rgba(12, 196, 204, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(12, 196, 204, 0.2);
  margin-top: 10px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #0cc4cc;
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

:deep(.el-textarea__inner) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.el-textarea__inner:hover) {
  border-color: rgba(12, 196, 204, 0.4);
}

:deep(.el-textarea__inner:focus) {
  border-color: rgba(12, 196, 204, 0.6) !important;
}

:deep(.el-input__count) {
  background: transparent;
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.el-checkbox) {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #0cc4cc;
  border-color: #0cc4cc;
}

:deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: #0cc4cc;
  border-color: #0cc4cc;
}

:deep(.el-checkbox__inner) {
  background-color: rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.el-checkbox__inner:hover) {
  border-color: #0cc4cc;
}

:deep(.el-empty__description p) {
  color: rgba(255, 255, 255, 0.5);
}
</style>
