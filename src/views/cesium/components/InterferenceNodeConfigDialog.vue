<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">干扰节点配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">基本信息</span>
            </div>

            <div class="form-row">
              <div class="form-label">节点名称</div>
              <el-input
                v-model="nodeForm.alias"
                placeholder="请输入节点名称"
                class="form-input"
              />
            </div>

            <div class="form-row">
              <div class="form-label">节点类型</div>
              <el-input v-model="nodeForm.typeLabel" disabled class="form-input" />
            </div>

            <div class="form-row" v-if="!isNormalMode">
              <div class="form-label">节点角色</div>
              <div class="form-input role-radio-group">
                <el-radio-group v-model="nodeForm.role">
                  <el-radio
                    v-for="option in ROLE_OPTIONS"
                    :key="option.value"
                    :label="option.value"
                  >
                    {{ option.label }}
                  </el-radio>
                </el-radio-group>
              </div>
            </div>
          </div>

          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">坐标信息</span>
            </div>

            <div class="form-row">
              <div class="form-label">X</div>
              <el-input
                :model-value="formatCoord(geoToENU(nodeForm.geo.lon, nodeForm.geo.lat, nodeForm.geo.alt).x)"
                disabled
                class="form-input"
              />
            </div>

            <div class="form-row">
              <div class="form-label">Y</div>
              <el-input
                :model-value="formatCoord(geoToENU(nodeForm.geo.lon, nodeForm.geo.lat, nodeForm.geo.alt).y)"
                disabled
                class="form-input"
              />
            </div>

            <div class="form-row">
              <div class="form-label">Z</div>
              <el-input v-model="nodeForm.geo.alt" type="number" class="form-input" />
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button class="dialog-btn confirm-btn" type="primary" @click="handleConfirm"
            >确定</el-button
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, onMounted, computed } from "vue";
import { useTopoStore } from "../../../store/modules/topo";
import { geoToENU, formatCoord } from "../../../utils/coordTransform";
import type { Node, GeoPosition } from "../../../types/topo";
import { ElMessage } from "element-plus";
import { getTopoBySession as getTopoBySessionApi } from "../../../api/scene";
import { getUserInfo } from "../../../store/user";

const NODE_TYPE_LABEL = "INODE";
const NODE_TYPE_VALUE = "INODE";

const ROLE_OPTIONS = [
  { label: '公共', value: 1 },
  { label: '红方', value: 2 },
  { label: '蓝方', value: 3 }
];

// 普通仿真模式下不需要分配角色，默认公共
const isNormalMode = computed(() => getUserInfo().mode === 'normal');

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  position: {
    type: Object as () => GeoPosition,
    default: () => ({ lat: 0, lon: 0, alt: 0 }),
  },
  // nodeType prop is implicitly INTERFERENCE for this dialog
});
const emit = defineEmits(["update:visible", "confirm", "cancel"]);

const topoStore = useTopoStore();

const dialogVisible = ref(props.visible);

const nodeForm = reactive({
  name: "",
  alias: "",
  type: NODE_TYPE_VALUE,
  typeLabel: NODE_TYPE_LABEL,
  geo: {
    lat: props.position.lat,
    lon: props.position.lon,
    alt: props.position.alt,
  },
  role: isNormalMode.value ? 1 : 2
});
const getMaxInterferenceNodeNumber = (): number => {
  if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length === 0) {
    return 0;
  }
  const regex = new RegExp(`^${NODE_TYPE_LABEL}(\\d+)$`);
  let maxNumber = 0;
  topoStore.topoData.nodes.forEach((node: Node) => {
    if (node.type === NODE_TYPE_VALUE || node.name.startsWith(NODE_TYPE_LABEL)) {
      const match = node.name.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });
  return maxNumber;
};

const generateUniqueInterferenceNodeName = (): string => {
  const maxNumber = getMaxInterferenceNodeNumber();
  return `${NODE_TYPE_LABEL}${maxNumber + 1}`;
};

const initNodeName = () => {
  nodeForm.name = generateUniqueInterferenceNodeName();
  const maxNumber = getMaxInterferenceNodeNumber();
  nodeForm.alias = `干扰${maxNumber + 1}`;
};

onMounted(async () => {
  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  if (sessionId) {
    try {
      const res = await getTopoBySessionApi(sessionId);
      const code = res?.data?.code;
      const data = res?.data?.data ?? res?.data;
      if (code === 200 && data) {
        (topoStore as any).setTopoData(data.id, data);
      }
    } catch (error) {
      console.error("Failed to fetch topo data on mount:", error);
    }
  }
  initNodeName();
});

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val;
    if (val) {
      initNodeName();
      if (props.position) {
        const { lat, lon, alt } = props.position;
        nodeForm.geo = { lat, lon, alt };
      }
    }
  }
);

watch(dialogVisible, (val) => {
  emit("update:visible", val);
});

watch(
  () => props.position,
  (newPosition) => {
    if (newPosition) {
      const { lat, lon, alt } = newPosition;
      nodeForm.geo = { lat, lon, alt };
    }
  },
  { immediate: true, deep: true }
);

const ensureTopoDataExists = () => {
  if (!topoStore.topoData) {
    (topoStore as any).initEmptyTopoData();
  }
  if (!topoStore.topoData) {
    return null;
  }
  if (!Array.isArray(topoStore.topoData.nodes)) {
    topoStore.topoData.nodes = [];
  }
  return topoStore.topoData;
};

const getNextNodeId = (): number => {
  const nodes = topoStore.topoData?.nodes || [];
  const links = topoStore.topoData?.links || [];
  
  if (nodes.length === 0 && links.length === 0) {
    return 1;
  }
  const maxNodeId = nodes.length > 0 ? Math.max(...nodes.map((n: Node) => n.id)) : 0;
  const nodeId = maxNodeId + links.length + 1;
  
  return nodeId;
};

const handleClose = () => {
  dialogVisible.value = false;
  emit("cancel");
};

const handleConfirm = async () => {
  try {
    if (!nodeForm.alias.trim()) {
      ElMessage.warning("节点名称不能为空");
      return;
    }

    const topoData = ensureTopoDataExists();
    if (!topoData) {
      ElMessage.error("拓扑数据初始化失败");
      return;
    }

    if (topoData.nodes.some((node: Node) => node.alias === nodeForm.alias)) {
      ElMessage.warning(`节点名称 "${nodeForm.alias}" 已存在，请修改后重试`);
      return;
    }

    const nodeId = getNextNodeId();
    const nodeData = {
      id: nodeId,
      name: nodeForm.name,
      type: NODE_TYPE_VALUE,
      model: "",
      image: "",
      geo: { ...nodeForm.geo },
      role: nodeForm.role,
      status: "UP",
      alias: nodeForm.alias
    };

    await (topoStore as any).addNodeRemote(nodeData);
    dialogVisible.value = false;
    emit("confirm", nodeData);

  } catch (error: any) {
    console.error("创建干扰节点时出错:", error);
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
  background: rgba(0, 0, 0, 0.7); /* Keep or slightly adjust if needed */
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

/* 对话框容器 */
.custom-dialog {
  width: 460px;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.95) 0%,
    rgba(17, 23, 64, 0.98) 100%
  );
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(211, 47, 47, 0.2); /* Reddish border */
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
  background: linear-gradient(90deg, transparent, rgba(211, 47, 47, 0.5), transparent); /* Reddish gradient */
}

/* 对话框标题栏 */
.custom-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(
    90deg,
    rgba(183, 28, 28, 0.4) 0%, /* Darker red tone */
    rgba(211, 47, 47, 0.2) 100% /* Lighter red tone */
  );
  border-bottom: 1px solid rgba(211, 47, 47, 0.2);
}

.custom-dialog-title {
  color: #D32F2F; /* Reddish color */
  font-size: 16px;
  font-weight: 500; /* InfoPanel title is 600 */
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
  background: #D32F2F; /* Reddish color */
  border-radius: 2px;
}

.custom-dialog-close {
  background: rgba(211, 47, 47, 0.1); /* Reddish background */
  border: none;
  color: rgba(211, 47, 47, 0.8); /* Reddish color */
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%; /* InfoPanel close is 50% */
  transition: all 0.3s ease;
}

.custom-dialog-close:hover {
  background: rgba(211, 47, 47, 0.3); /* Darker reddish background on hover */
  color: #D32F2F; /* Reddish color on hover */
  transform: rotate(90deg);
}

.close-icon {
  font-style: normal;
}

/* 对话框内容区 */
.custom-dialog-body {
  padding: 24px; /* InfoPanel dialog body is 20px */
  max-height: 65vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(211, 47, 47, 0.3) transparent; /* Reddish scrollbar thumb */
  color: #eaf6ff;
}

.custom-dialog-body::-webkit-scrollbar {
  width: 6px;
}

.custom-dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.custom-dialog-body::-webkit-scrollbar-thumb {
  background-color: rgba(211, 47, 47, 0.3); /* Reddish scrollbar thumb */
  border-radius: 3px;
}

/* 对话框底部 */
.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px 24px;
  border-top: 1px solid rgba(211, 47, 47, 0.2); /* Reddish border */
}

/* 表单样式 */
.config-section {
  margin-bottom: 28px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(211, 47, 47, 0.05); /* Reddish border */
  transition: all 0.3s ease;
}

.config-section:hover {
  border-color: rgba(211, 47, 47, 0.15); /* Darker reddish border on hover */
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.1); /* Reddish shadow on hover */
}

.section-title-block {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #D32F2F, #B71C1C); /* Reddish gradient */
  margin-right: 10px;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.3); /* Reddish shadow */
}

.section-title {
  font-size: 14px;
  color: #D32F2F; /* Reddish color */
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
  color: #F8BBD0; /* Lighter red/pink for labels, for contrast */
  font-size: 13px;
  font-weight: 500; /* InfoPanel label is 400, config label is 500 */
}

.form-input {
  flex: 1;
}

/* 按钮样式 */
.dialog-btn {
  min-width: 90px;
  height: 36px;
  font-size: 14px;
  border-radius: 6px; /* InfoPanel buttons are 6px */
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px; /* Consistent with InfoPanel neo-btn */
  letter-spacing: 0.5px; /* Consistent with InfoPanel neo-btn */
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
  /* Match InfoPanel's el-button--default */
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #eaf6ff;
  margin-right: 12px;
}

.cancel-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  transform: translateY(-1px);
}

.confirm-btn {
  /* Match InfoPanel's config-btn style but with red tones */
  background: linear-gradient(to right, #B71C1C, #D32F2F);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(to right, #D32F2F, #E53935); /* Lighter red gradient on hover */
  box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4);
  transform: translateY(-1px);
}

/* Element Plus样式覆盖 */
:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  box-shadow: none !important;
  border-radius: 6px;
  border: 1px solid rgba(211, 47, 47, 0.3) !important;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: #D32F2F !important;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #D32F2F !important;
  box-shadow: 0 0 0 1px rgba(211, 47, 47, 0.2) !important;
}

:deep(.el-input__inner) {
  color: #eaf6ff; /* Match InfoPanel text color */
  height: 36px;
  font-size: 13px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.03) !important;
  opacity: 0.7;
  border-color: rgba(211, 47, 47, 0.15) !important;
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

/* 针对 Element Plus input 组件隐藏原生 number 箭头 */
:deep(.el-input__inner[type='number'])::-webkit-inner-spin-button,
:deep(.el-input__inner[type='number'])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
:deep(.el-input__inner[type='number']) {
  -moz-appearance: textfield;
}

/* 角色单选按钮组样式 */
.role-radio-group {
  display: flex;
}

:deep(.el-radio) {
  margin-right: 20px;
  color: #F8BBD0; /* 与其他标签颜色一致 */
}

:deep(.el-radio.is-checked) {
  color: #D32F2F; /* 与干扰节点主题色一致 */
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #D32F2F;
  border-color: #D32F2F;
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #D32F2F;
}

:deep(.el-radio__inner:hover) {
  border-color: #D32F2F;
}
</style> 