<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog template-manage-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">组网模板管理</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- 模板列表 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">已保存模板</span>
              <span class="section-subtitle">(共 {{ totalTemplates }} 个)</span>
            </div>

            <div v-if="templateLoading" class="template-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
            <div v-else-if="templateList.length === 0" class="no-templates">
              <el-empty description="暂无保存的模板" :image-size="80" />
            </div>
            <div v-else class="template-list">
              <div
                v-for="template in templateList"
                :key="template.id"
                class="template-item"
                :class="{ 'selected': selectedTemplate?.id === template.id }"
                @click="handleSelectTemplate(template)"
              >
                <div class="template-info">
                  <div class="template-header">
                    <span class="template-name">{{ template.name || '未命名模板' }}</span>
                    <span class="template-time">{{ formatTime(template.createTime) }}</span>
                  </div>
                  <div class="template-stats">
                    <span class="stat-badge">
                      <i class="stat-icon">📍</i>
                      {{ template.nodeJson?.length || 0 }} 节点
                    </span>
                    <span class="stat-badge">
                      <i class="stat-icon">🔗</i>
                      {{ template.linkJson?.length || 0 }} 链路
                    </span>
                  </div>
                </div>
                <div class="template-actions">
                  <el-button
                    type="primary"
                    size="small"
                    @click.stop="handleUseTemplate(template)"
                    :loading="isUsingTemplate && currentTemplateId === template.id"
                  >
                    使用模板
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    @click.stop="handleDeleteTemplate(template)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 分页 -->
            <div class="pagination-wrapper" v-if="totalTemplates > pageSize">
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :page-sizes="[5, 10, 20, 50]"
                :total="totalTemplates"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="handleSizeChange"
                @current-change="handlePageChange"
              />
            </div>
          </div>

          <!-- 模板详情（选中后显示） -->
          <div class="config-section" v-if="selectedTemplate">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">模板详情</span>
            </div>

            <div class="template-detail">
              <div class="detail-row">
                <span class="detail-label">模板名称：</span>
                <span class="detail-value">{{ selectedTemplate.name || '未命名' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">会话ID：</span>
                <span class="detail-value">{{ selectedTemplate.sessionId || '-' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">节点数量：</span>
                <span class="detail-value">{{ selectedTemplate.nodeJson?.length || 0 }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">链路数量：</span>
                <span class="detail-value">{{ selectedTemplate.linkJson?.length || 0 }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">创建时间：</span>
                <span class="detail-value">{{ formatTime(selectedTemplate.createTime) }}</span>
              </div>
            </div>

            <!-- 节点列表预览 -->
            <div class="preview-section">
              <h4 class="preview-title">节点列表</h4>
              <div class="node-preview-list">
                <div
                  v-for="(node, index) in selectedTemplate.nodeJson"
                  :key="index"
                  class="node-preview-item"
                >
                  <span class="node-index">{{ index + 1 }}</span>
                  <span class="node-name">{{ node.name }}</span>
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

    <!-- 模板配置对话框 -->
    <TemplateConfigDialog
      v-model:visible="isConfigDialogVisible"
      :template-data="templateToConfig"
      @close="handleConfigDialogClose"
      @start-placement="handleStartPlacement"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits, onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listTemplate, deleteTemplate, type TemplateListItem } from '../../../api/scene';
import type { ApiResponse } from '../../../api/scene';
import TemplateConfigDialog from './TemplateConfigDialog.vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'close', 'use-template']);

const dialogVisible = ref(props.visible);

// 分页数据
const currentPage = ref(1);
const pageSize = ref(10);
const totalTemplates = ref(0);
const templateList = ref<TemplateListItem[]>([]);
const templateLoading = ref(false);
const selectedTemplate = ref<TemplateListItem | null>(null);
const isUsingTemplate = ref(false);
const currentTemplateId = ref<number | null>(null);

// 配置对话框状态
const isConfigDialogVisible = ref(false);
const templateToConfig = ref<TemplateListItem | null>(null);

// 监听visible变化
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal) {
    loadTemplateList();
  }
});

watch(() => dialogVisible.value, (newVal) => {
  emit('update:visible', newVal);
});

// 加载模板列表
const loadTemplateList = async () => {
  templateLoading.value = true;
  try {
    const response = await listTemplate({
      pageNo: currentPage.value,
      pageSize: pageSize.value
    }) as unknown as ApiResponse;

    if (response.code === 200 && response.data) {
      templateList.value = response.data.records || [];
      totalTemplates.value = response.data.total || 0;
    } else {
      ElMessage.error(response.msg || '获取模板列表失败');
    }
  } catch (error: any) {
    console.error('获取模板列表失败:', error);
    ElMessage.error(error?.message || '获取模板列表失败');
  } finally {
    templateLoading.value = false;
  }
};

// 处理页码变化
const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadTemplateList();
};

// 处理页大小变化
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadTemplateList();
};

// 选择模板
const handleSelectTemplate = (template: TemplateListItem) => {
  if (selectedTemplate.value?.id === template.id) {
    selectedTemplate.value = null;
  } else {
    selectedTemplate.value = template;
  }
};

// 删除模板
const handleDeleteTemplate = async (template: TemplateListItem) => {
  if (!template.id) {
    ElMessage.error('模板ID无效');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name || '未命名模板'}" 吗？`,
      '删除模板',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 调用删除API
    const response = await deleteTemplate(template.id);

    if (response.code === 200) {
      ElMessage.success('模板删除成功');

      // 如果删除的是当前选中的模板，清除选中状态
      if (selectedTemplate.value?.id === template.id) {
        selectedTemplate.value = null;
      }

      // 重新加载模板列表
      await loadTemplateList();
    } else {
      ElMessage.error(response.msg || '删除模板失败');
    }
  } catch (error: any) {
    // 用户取消删除
    if (error === 'cancel') {
      return;
    }
    console.error('删除模板失败:', error);
    ElMessage.error(error?.message || '删除模板失败');
  }
};

// 使用模板
const handleUseTemplate = async (template: TemplateListItem) => {
  // 打开配置对话框
  templateToConfig.value = template;
  isConfigDialogVisible.value = true;
};

// 关闭配置对话框
const handleConfigDialogClose = () => {
  isConfigDialogVisible.value = false;
  templateToConfig.value = null;
};

// 开始放置模板
const handleStartPlacement = (configData: any) => {
  // 将配置数据传递给父组件（TopNavBar），由其处理地图点击放置
  emit('use-template', {
    template: templateToConfig.value,
    config: configData
  });

  // 关闭两个对话框
  handleConfigDialogClose();
  handleClose();
};

// 格式化时间
const formatTime = (timeStr?: string) => {
  if (!timeStr) return '-';
  return new Date(timeStr).toLocaleString('zh-CN');
};

// 关闭对话框
const handleClose = () => {
  selectedTemplate.value = null;
  emit('update:visible', false);
  emit('close');
};

// 初始化加载
onMounted(() => {
  if (props.visible) {
    loadTemplateList();
  }
});
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

.template-manage-dialog {
  width: 900px;
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

.config-section:last-child {
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

/* 加载状态 */
.template-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.no-templates {
  text-align: center;
  padding: 40px 20px;
}

/* 模板列表 */
.template-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-list::-webkit-scrollbar {
  width: 6px;
}

.template-list::-webkit-scrollbar-track {
  background: transparent;
}

.template-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
}

.template-item:hover {
  background: rgba(12, 196, 204, 0.1);
  border-color: rgba(12, 196, 204, 0.2);
  transform: translateX(2px);
}

.template-item.selected {
  background: rgba(12, 196, 204, 0.15);
  border-color: rgba(12, 196, 204, 0.4);
}

.template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-header {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: right;
}

.template-name {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.template-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.template-stats {
  display: flex;
  gap: 12px;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(12, 196, 204, 0.9);
  background: rgba(12, 196, 204, 0.1);
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(12, 196, 204, 0.2);
}

.stat-icon {
  font-style: normal;
}

.template-actions {
  margin-left: 16px;
  display: flex;
  gap: 8px;
}

/* 分页 */
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

/* 模板详情 */
.template-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 100px;
}

.detail-value {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

/* 节点预览 */
.preview-section {
  margin-top: 16px;
}

.preview-title {
  font-size: 14px;
  color: #fff;
  margin: 0 0 12px 0;
  padding-left: 8px;
  border-left: 3px solid #0cc4cc;
}

.node-preview-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.node-preview-list::-webkit-scrollbar {
  width: 6px;
}

.node-preview-list::-webkit-scrollbar-track {
  background: transparent;
}

.node-preview-list::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 3px;
}

.node-preview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.node-index {
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

.node-name {
  flex: 1;
  color: rgba(255, 255, 255, 0.8);
}

.node-type-badge {
  font-size: 12px;
  color: rgba(12, 196, 204, 0.8);
  background: rgba(12, 196, 204, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
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

/* Element Plus样式覆盖 */
:deep(.el-pagination) {
  --el-pagination-bg-color: rgba(0, 0, 0, 0.2);
  --el-pagination-text-color: rgba(255, 255, 255, 0.8);
  --el-pagination-hover-color: #0cc4cc;
}

:deep(.el-pagination button:disabled) {
  background-color: rgba(0, 0, 0, 0.1);
  color: rgba(255, 255, 255, 0.3);
}

:deep(.el-pager li) {
  background-color: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

:deep(.el-pager li.is-active) {
  background-color: #0cc4cc;
  color: #fff;
}

:deep(.el-empty__description p) {
  color: rgba(255, 255, 255, 0.5);
}
</style>
