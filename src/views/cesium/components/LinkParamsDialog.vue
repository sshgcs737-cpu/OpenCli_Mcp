<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <!-- 标题栏 -->
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">链路参数修改</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="custom-dialog-body">
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">链路信息</span>
            </div>

            <div class="link-info">
              <div class="node-info">{{ sourceNodeName }}</div>
              <div class="link-arrow">→</div>
              <div class="node-info">{{ targetNodeName }}</div>
            </div>

            <div class="form-row">
              <div class="form-label">源IPv4地址</div>
              <el-input
                v-model="linkForm.sourceIp"
                placeholder="10.0.0.1"
                class="form-input"
                :pattern="ipPattern">
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">源IPv6地址</div>
              <el-input
                v-model="linkForm.sourceIp6"
                placeholder="2001:db8::1"
                class="form-input"
                :pattern="ipv6Pattern">
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">目标IPv4地址</div>
              <el-input
                v-model="linkForm.targetIp"
                placeholder="10.0.0.2"
                class="form-input"
                :pattern="ipPattern">
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">目标IPv6地址</div>
              <el-input
                v-model="linkForm.targetIp6"
                placeholder="2001:db8::2"
                class="form-input"
                :pattern="ipv6Pattern">
              </el-input>
            </div>
          </div>

          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">链路参数</span>
            </div>

            <div class="form-row">
              <div class="form-label">带宽</div>
              <el-input 
                v-model.number="linkForm.bandwidth" 
                type="number" 
                placeholder="1000" 
                class="form-input">
                <template #append>bps</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">延迟</div>
              <el-input 
                v-model.number="linkForm.delay" 
                type="number" 
                placeholder="10" 
                class="form-input">
                <template #append>ms</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">丢包率</div>
              <el-input 
                v-model.number="linkForm.loss" 
                type="number" 
                placeholder="0" 
                class="form-input"
                min="0"
                max="100">
                <template #append>%</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">抖动</div>
              <el-input 
                v-model.number="linkForm.jitter" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>ms</template>
              </el-input>
            </div>
            
            <div class="form-row">
              <div class="form-label">缓冲区</div>
              <el-input 
                v-model.number="linkForm.buffer" 
                type="number" 
                placeholder="1024" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">重复</div>
              <el-input 
                v-model.number="linkForm.dup" 
                type="number" 
                placeholder="0" 
                min="0"
                class="form-input">
                <template #append>%</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">突发流量</div>
              <el-input 
                v-model.number="linkForm.burst" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>

            <div class="form-row">
              <div class="form-label">最大突发</div>
              <el-input 
                v-model.number="linkForm.mburst" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>
            
            <div class="form-row">
              <div class="form-label">
                单向链路
              </div>
              <el-switch v-model="linkForm.unidirectional" class="form-input" />
            </div>
          </div>
        </div>

        <!-- 底部按钮区 -->
        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button class="dialog-btn confirm-btn" type="primary" @click="handleConfirm">确定</el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, computed } from 'vue';
import { useTopoStore } from '../../../store/modules/topo';
import { ElMessage } from 'element-plus';
import type { Link, Node, LinkOptions } from '../../../types/topo';
import eventBus from '../../../utils/eventBus';

// 定义属性
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  link: {
    type: Object as () => Link,
    default: null
  }
});

// 定义事件
const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

// 获取store
const topoStore = useTopoStore();

// 对话框可见性
const dialogVisible = ref(props.visible);

// 源节点和目标节点名称
const sourceNodeName = computed(() => {
  if (!props.link || !topoStore.topoData) return '';
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node1_id);
  return node?.name || `节点 ${props.link.node1_id}`;
});

const targetNodeName = computed(() => {
  if (!props.link || !topoStore.topoData) return '';
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node2_id);
  return node?.name || `节点 ${props.link.node2_id}`;
});

// IP地址验证正则
const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// IPv6地址验证正则
const ipv6Pattern = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

// 表单数据
const linkForm = reactive({
  jitter: 0,
  key: 0,
  mburst: 0,
  mer: 0,
  loss: 0,
  bandwidth: 0,
  burst: 0,
  delay: 0,
  dup: 0,
  unidirectional: false,
  buffer: 0,
  sourceIp: '',
  targetIp: '',
  sourceIp6: '',
  targetIp6: ''
});

// 初始化表单数据
const initFormData = () => {
  if (!props.link || !props.link.options) return;

  const options = props.link.options;
  linkForm.jitter = options.jitter || 0;
  linkForm.key = options.key || 0;
  linkForm.mburst = options.mburst || 0;
  linkForm.mer = options.mer || 0;
  linkForm.loss = options.loss || 0;
  linkForm.bandwidth = options.bandwidth || 0;
  linkForm.burst = options.burst || 0;
  linkForm.delay = options.delay || 0;
  linkForm.dup = options.dup || 0;
  linkForm.unidirectional = options.unidirectional || false;
  linkForm.buffer = options.buffer || 0;

  // 从iface中读取IP地址
  if (props.link.iface1) {
    linkForm.sourceIp = props.link.iface1.ip4 || '';
    linkForm.sourceIp6 = props.link.iface1.ip6 || '';
  }
  if (props.link.iface2) {
    linkForm.targetIp = props.link.iface2.ip4 || '';
    linkForm.targetIp6 = props.link.iface2.ip6 || '';
  }
};

// 监听对话框显示
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal) {
    initFormData();
  }
});

// 监听链路变化
watch(() => props.link, (newVal) => {
  if (newVal && dialogVisible.value) {
    initFormData();
  }
}, { deep: true });

// 监听内部可见性变化
watch(dialogVisible, (val) => {
  emit('update:visible', val);
});

// 处理关闭对话框
const handleClose = () => {
  dialogVisible.value = false;
  emit('cancel');
};

// 处理确认修改链路参数
const handleConfirm = async () => {
  try {
    if (!props.link) {
      ElMessage.error('链路数据不完整');
      return;
    }

    // 验证IPv4地址格式
    if (linkForm.sourceIp && !ipPattern.test(linkForm.sourceIp)) {
      ElMessage.error('源IPv4地址格式不正确');
      return;
    }

    if (linkForm.targetIp && !ipPattern.test(linkForm.targetIp)) {
      ElMessage.error('目标IPv4地址格式不正确');
      return;
    }

    // 验证IPv6地址格式
    if (linkForm.sourceIp6 && !ipv6Pattern.test(linkForm.sourceIp6)) {
      ElMessage.error('源IPv6地址格式不正确');
      return;
    }

    if (linkForm.targetIp6 && !ipv6Pattern.test(linkForm.targetIp6)) {
      ElMessage.error('目标IPv6地址格式不正确');
      return;
    }

    // 构建新的链路选项（不包含IP地址）
    const newOptions: LinkOptions = {
      jitter: Number(linkForm.jitter),
      key: Number(linkForm.key),
      mburst: Number(linkForm.mburst),
      mer: Number(linkForm.mer),
      loss: Number(linkForm.loss),
      bandwidth: Number(linkForm.bandwidth),
      burst: Number(linkForm.burst),
      delay: Number(linkForm.delay),
      dup: Number(linkForm.dup),
      unidirectional: linkForm.unidirectional,
      buffer: Number(linkForm.buffer),
      mtu: 0
    };

    // 构建更新后的链路对象，包括iface中的IP地址
    const updatedLink: Link = {
      ...props.link,
      options: newOptions,
      iface1: props.link.iface1 ? {
        ...props.link.iface1,
        ip4: linkForm.sourceIp,
        ip6: linkForm.sourceIp6
      } : undefined,
      iface2: props.link.iface2 ? {
        ...props.link.iface2,
        ip4: linkForm.targetIp,
        ip6: linkForm.targetIp6
      } : undefined
    };

    // 使用类型断言来访问方法
    const topoStoreAny = topoStore as any;

    // 使用modifyLinkRemote方法直接修改链路
    await topoStoreAny.modifyLinkRemote(updatedLink);

    // 发送事件通知刷新链路标签
    eventBus.emit('refreshLinkLabels');

    ElMessage.success('链路参数更新成功');
    dialogVisible.value = false;
    emit('confirm', updatedLink);
  } catch (error: any) {
    console.error('修改链路参数失败:', error);
    ElMessage.error(error?.message || '修改链路参数失败，请重试');
  }
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
  z-index: 9999;
  animation: fadeIn 0.3s ease;
  padding: 1rem;
  box-sizing: border-box;
}

/* 对话框容器 */
.custom-dialog {
  width: 90%;
  max-width: 460px;
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

/* 对话框标题栏 */
.custom-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(41, 54, 73, 0.8);
  background: rgba(30, 39, 54, 0.8);
}

.custom-dialog-title {
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.5px;
  position: relative;
  padding-left: 0.75rem;
}

.custom-dialog-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 1rem;
  background: #0cc4cc;
  border-radius: 2px;
}

.custom-dialog-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #7f8c9d;
  font-size: 1.125rem;
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

/* 对话框内容区 */
.custom-dialog-body {
  padding: 1.5rem;
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

/* 对话框底部 */
.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.5rem 1.5rem;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

/* 表单样式 */
.config-section {
  margin-bottom: 1.75rem;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 1rem;
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
  margin-bottom: 1rem;
}

.title-indicator {
  width: 4px;
  height: 1rem;
  background: linear-gradient(180deg, #0cc4cc, #00a8ff);
  margin-right: 0.625rem;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(12, 196, 204, 0.3);
}

.section-title {
  font-size: 0.875rem;
  color: #0cc4cc;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.form-row {
  display: flex;
  margin-bottom: 1rem;
  align-items: center;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 5rem;
  text-align: right;
  padding-right: 1rem;
  color: #a0aec0;
  font-size: 0.8125rem;
  font-weight: 500;
}

.form-input {
  flex: 1;
}

/* 链路信息展示 */
.link-info {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.75rem 0;
  padding: 1rem;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(0, 122, 255, 0.2);
  transition: all 0.3s ease;
}

.link-info:hover {
  background: rgba(0, 122, 255, 0.15);
  box-shadow: 0 0 15px rgba(0, 122, 255, 0.2);
  transform: translateY(-2px);
}

.link-arrow {
  margin: 0 0.875rem;
  color: #0cc4cc;
  font-size: 1.25rem;
  text-shadow: 0 0 8px rgba(12, 196, 204, 0.5);
}

.node-info {
  padding: 0.5rem 0.875rem;
  background: rgba(0, 198, 255, 0.15);
  border-radius: 6px;
  color: #eaf6ff;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.5px;
  border: 1px solid rgba(0, 198, 255, 0.25);
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 11rem;
}

.node-info:hover {
  background: rgba(0, 198, 255, 0.2);
  box-shadow: 0 0 10px rgba(0, 198, 255, 0.3);
}

/* 按钮样式 */
.dialog-btn {
  min-width: 5.625rem;
  height: 2.25rem;
  font-size: 0.875rem;
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
  margin-right: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background: rgba(53, 70, 92, 0.8);
  transform: translateY(-1px);
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

/* Element Plus样式覆盖 */
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
  height: 2.25rem;
  font-size: 0.8125rem;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.3) !important;
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.05);
}

:deep(.el-input-group__append) {
  width: 3.75rem;
  background: rgba(40, 57, 80, 0.7) !important;
  color: #fff !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-left: none !important;
  border-radius: 0 6px 6px 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  padding: 0;
  box-sizing: border-box;
}

/* 针对 Element Plus input 组件隐藏原生 number 箭头 */
:deep(.el-input__inner[type='number'])::-webkit-inner-spin-button,
:deep(.el-input__inner[type='number'])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
:deep(.el-input__inner[type='number']) {
  -moz-appearance: textfield;
}

/* 动画 */
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

.item-value {
  color: #eaf6ff;
  font-size: 0.9375rem;
  letter-spacing: 0.5px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .custom-dialog {
    width: 95%;
  }
  
  .link-info {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .link-arrow {
    transform: rotate(90deg);
    margin: 0.3125rem 0;
  }
  
  .node-info {
    max-width: 100%;
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 576px) {
  .custom-dialog-body {
    padding: 1rem;
  }
  
  .form-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .form-label {
    width: 100%;
    text-align: left;
    padding-right: 0;
    margin-bottom: 0.3125rem;
  }
  
  .form-input {
    width: 100%;
  }
  
  .custom-dialog-header {
    padding: 0.75rem 1rem;
  }
  
  .custom-dialog-footer {
    padding: 0.75rem 1rem 1rem;
  }
}

@media (max-width: 480px) {
  .custom-dialog-footer {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .dialog-btn {
    width: 100%;
    margin-right: 0;
  }
  
  .cancel-btn {
    margin-bottom: 0.5rem;
    margin-right: 0;
  }
  
  .custom-dialog-body {
    max-height: 70vh;
  }
  
  .custom-dialog {
    width: 100%;
    max-height: 90vh;
  }
  
  .config-section {
    padding: 0.75rem;
  }
}
</style> 