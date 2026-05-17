<template>
  <div>
    <!-- 干扰节点信息框 -->
    <div class="neo-infobox" v-if="node" ref="interferPanelRef" :style="{ transform: `translate(${dragOffsetX}px, ${dragOffsetY}px)` }">
      <div class="neo-infobox-header">
        <span class="neo-infobox-title">
          <svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="8" fill="#D32F2F" fill-opacity="0.18" />
            <circle cx="9" cy="9" r="4" fill="#D32F2F" fill-opacity="0.38" />
          </svg>
          干扰节点信息
        </span>
        <span class="neo-infobox-close" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line
              x1="5"
              y1="5"
              x2="15"
              y2="15"
              stroke="#b6eaff"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="15"
              y1="5"
              x2="5"
              y2="15"
              stroke="#b6eaff"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </div>
      <div class="neo-infobox-content">
        <div class="neo-section">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#D32F2F" fill-opacity="0.18" />
            </svg>
            基本信息
          </div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">ID</div>
              <div class="item-value">{{ node.id }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">名称</div>
              <div class="item-value">{{ node.alias || node.name }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">别名</div>
              <div class="item-value">{{ node.alias || '未设置' }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">类型</div>
              <div class="item-value">干扰节点</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">状态</div>
              <div class="item-value">
                <span :class="['status-indicator', interferenceStatusClass]"></span>
                {{ interferenceStatusText }}
              </div>
            </div>
          </div>
          <div class="section-location">
            {{ geoToXYHText(node.geo.lon, node.geo.lat, node.geo.alt) }}
          </div>
        </div>

        <div class="neo-section">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#D32F2F" fill-opacity="0.18" />
            </svg>
            干扰参数
          </div>
          <div class="interference-params">
            <div class="param-row">
              <div class="param-label">干扰功率</div>
              <div class="param-value">
                {{ isParamConfigured(localPowerValue !== null ? localPowerValue : nodeConfig?.interferePowerdb)
                   ? `${typeof localPowerValue === 'number' && localPowerValue !== null ? localPowerValue.toFixed(1) : (nodeConfig?.interferePowerdb || 0)} dB`
                   : '未配置' }}
              </div>
            </div>
            <div class="param-row power-slider-row" v-if="isParamConfigured(nodeConfig?.interferePowerdb)">
              <div class="param-label">调节功率</div>
              <div class="power-slider-container">
                <el-slider
                  v-model="localPowerValue"
                  :min="0"
                  :max="100"
                  :step="0.1"
                  :show-tooltip="true"
                  :format-tooltip="(val: number) => `${val.toFixed(1)} dB`"
                  @input="handlePowerSliderInput"
                  @change="handlePowerSliderChange"
                  style="width: 100%"
                />
              </div>
            </div>
            <div class="param-row">
              <div class="param-label">干扰频率</div>
              <div class="param-value">{{ isParamConfigured(nodeConfig?.interfereFreq) ? `${nodeConfig?.interfereFreq} MHz` : '未配置' }}</div>
            </div>
            <div class="param-row">
              <div class="param-label">方位角</div>
              <div class="param-value">{{ isParamConfigured(nodeConfig?.azimuth) ? `${nodeConfig?.azimuth}°` : '未配置' }}</div>
            </div>
            <div class="param-row">
              <div class="param-label">俯仰角</div>
              <div class="param-value">{{ isParamConfigured(nodeConfig?.elevation) ? `${nodeConfig?.elevation}°` : '未配置' }}</div>
            </div>
            <div class="param-row interference-switch-row">
              <div class="param-label">开启干扰</div>
              <div class="param-value">
                <el-switch
                  v-model="isInterferenceSwitchOn"
                  :disabled="!canToggleInterferenceVisuals"
                  @change="handleInterferenceSwitchChange"
                  inline-prompt
                  active-text="ON"
                  inactive-text="OFF"
                  style="--el-switch-on-color: #D32F2F; --el-switch-off-color: #676767;"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div class="neo-actions">
          <button class="neo-btn config-btn" @click="handleConfigInterference">
            <el-icon><Setting /></el-icon>
            配置干扰参数
          </button>
          <button class="neo-btn delete-btn" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除节点
          </button>
        </div>
      </div>
    </div>
    
    <!-- 干扰参数配置对话框 -->
    <InterferenceConfigDialog
      v-model:visible="showConfigDialog"
      :node-id="node?.id"
      :interference-params="dialogInterferenceParams"
      @confirm="handleConfigConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { useTopoStore } from "../../../store/modules/topo";
import { geoToXYHText } from "../../../utils/coordTransform";
import { useInterferenceStore } from "../../../store/modules/interference";
import { ref, computed, watch } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { Delete, Setting } from '@element-plus/icons-vue';
import InterferenceConfigDialog from './InterferenceConfigDialog.vue';
import { startNodeInterference, stopNodeInterference, editInterferenceNode } from '../../../api/inode';
import type { InterferenceNodeData } from '../../../api/inode';
import { getUserInfo } from '../../../store/user';
import { useDraggable } from '../../../composables/useDraggable';

const props = defineProps<{ node: any }>();
const emit = defineEmits(["close", "delete"]);

const interferPanelRef = ref<HTMLElement | null>(null);
const { offsetX: dragOffsetX, offsetY: dragOffsetY } = useDraggable(
  interferPanelRef,
  '.neo-infobox-header'
);

const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();
const showConfigDialog = ref(false);

const isSimulationRunning = computed(() => {
  return topoStore.topoData?.state === 'RUNTIME' ||
         topoStore.topoData?.state === 'RUNNING' ||
         topoStore.topoData?.status === 'RUNNING';
});

const isChildOfSubnetNode = computed(() => {
  if (!props.node?.parent_id || !topoStore.topoData?.nodes) {
    return false;
  }

  const parentNode = topoStore.topoData.nodes.find((node: any) => node.id === props.node.parent_id);
  return parentNode?.type === 'EMANE';
});

const isConnectedToSubnetNode = computed(() => {
  if (!props.node?.id || !topoStore.topoData?.links || !topoStore.topoData?.nodes) {
    return false;
  }

  return topoStore.topoData.links.some((link: any) => {
    if (link.node1_id !== props.node.id && link.node2_id !== props.node.id) {
      return false;
    }

    const otherNodeId = link.node1_id === props.node.id ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData.nodes.find((node: any) => node.id === otherNodeId);
    return otherNode?.type === 'EMANE';
  });
});

const isWirelessEnvironmentNode = computed(() => {
  return isChildOfSubnetNode.value || isConnectedToSubnetNode.value;
});

// 本地功率值（用于滑动条）
const localPowerValue = ref<number>(0);

// 防抖定时器
let powerUpdateTimer: number | null = null;

// 对话框参数，从nodeConfig中获取
const dialogInterferenceParams = computed(() => {
  if (!nodeConfig.value) return {
    interferePowerdb: null,
    interfereFreq: null,
    azimuth: null,
    elevation: null,
    interfereModel: null
  };

  return {
    interferePowerdb: isParamConfigured(nodeConfig.value.interferePowerdb) 
      ? Number(nodeConfig.value.interferePowerdb) 
      : null,
    interfereFreq: isParamConfigured(nodeConfig.value.interfereFreq) 
      ? Number(nodeConfig.value.interfereFreq) 
      : null,
    azimuth: isParamConfigured(nodeConfig.value.azimuth) 
      ? Number(nodeConfig.value.azimuth) 
      : null,
    elevation: isParamConfigured(nodeConfig.value.elevation) 
      ? Number(nodeConfig.value.elevation) 
      : null,
    interfereModel: isParamConfigured(nodeConfig.value.interfereModel)
      ? nodeConfig.value.interfereModel
      : null
  };
});

// 从Store中获取当前节点的配置
const nodeConfig = computed<InterferenceNodeData | null>(() => {
  if (!props.node) return null;
  // 确保返回类型是InterferenceNodeData | null，而不是undefined
  return interferenceStore.getConfigByNodeId(props.node.id) || null;
});

// 当节点变化时，尝试从仓库加载配置数据
watch(() => props.node, (newNode) => {
  if (newNode && topoStore.currentSessionId) {
    // 确保已经加载了干扰配置
    if (interferenceStore.interferenceConfigs.length === 0) {
      interferenceStore.fetchInterferenceConfigs(topoStore.currentSessionId);
    }
  }
}, { immediate: true });

// 监听nodeConfig变化，更新本地功率值
watch(() => nodeConfig.value?.interferePowerdb, (newPower) => {
  if (newPower !== null && newPower !== undefined && newPower !== '') {
    localPowerValue.value = Number(newPower);
  }
}, { immediate: true });

// 上次发送请求的时间戳
let lastUpdateTime = 0;

// 处理滑动条实时输入（节流处理，每1秒发送一次请求）
const handlePowerSliderInput = (value: number) => {
  // 实时更新本地显示值
  localPowerValue.value = value;

  // 清除之前的防抖定时器
  if (powerUpdateTimer !== null) {
    clearTimeout(powerUpdateTimer);
  }

  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;

  // 如果距离上次更新已经超过1秒，立即发送请求
  if (timeSinceLastUpdate >= 1000) {
    sendPowerUpdateRequest(value);
    lastUpdateTime = now;
  } else {
    // 否则设置定时器，在剩余时间后发送请求
    const remainingTime = 1000 - timeSinceLastUpdate;
    powerUpdateTimer = window.setTimeout(() => {
      sendPowerUpdateRequest(value);
      lastUpdateTime = Date.now();
    }, remainingTime);
  }
};

// 处理滑动条变化完成（确保最后的值也被发送）
const handlePowerSliderChange = (value: number) => {
  // 清除定时器
  if (powerUpdateTimer !== null) {
    clearTimeout(powerUpdateTimer);
  }

  // 发送最终值
  sendPowerUpdateRequest(value);
  lastUpdateTime = Date.now();
};

// 发送功率更新请求的统一方法
const sendPowerUpdateRequest = async (value: number) => {
  if (!props.node || !nodeConfig.value) {
    ElMessage.error('节点信息不完整');
    return;
  }

  const sessionId = topoStore.currentSessionId;
  if (!sessionId) {
    ElMessage.error('当前会话ID不存在');
    return;
  }

  const userInfo = getUserInfo();
  const userId = userInfo.id;

  try {
    // 调用editInode API更新功率
    await editInterferenceNode({
      sessionId: Number(sessionId),
      nodeId: props.node.id,
      lat: props.node.geo.lat.toString(),
      lon: props.node.geo.lon.toString(),
      alt: props.node.geo.alt.toString(),
      interferePowerdb: value.toString(),
      interfereFreq: nodeConfig.value.interfereFreq || '',
      azimuth: nodeConfig.value.azimuth || '',
      elevation: nodeConfig.value.elevation || '',
      userId: userId
    });

    // 更新本地store
    interferenceStore.updateInterferenceConfig({
      ...nodeConfig.value,
      interferePowerdb: value.toString()
    });

  } catch (error: any) {
    console.error('更新干扰功率失败:', error);
    ElMessage.error(error?.message || '更新干扰功率失败，请重试');
    // 恢复原值
    if (nodeConfig.value?.interferePowerdb) {
      localPowerValue.value = Number(nodeConfig.value.interferePowerdb);
    }
  }
};

// 处理删除节点
const handleDelete = async () => {
  if (isSimulationRunning.value && isWirelessEnvironmentNode.value) {
    ElMessage.warning('对无线环境进行操作请先暂停场景');
    return;
  }

  try {
    await ElMessageBox.confirm(`确定要删除干扰节点"${props.node.alias || props.node.name}"吗？`, "删除确认", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
      center: true,
      customClass: "delete-confirm-box",
    });
    
    // 使用topoStore中正确的删除节点方法
    // 注意：需要使用类型断言来访问可能不在类型定义中的方法
    if ((topoStore as any).removeNodeRemote) {
      await (topoStore as any).removeNodeRemote(props.node.id);
    } else {
      console.error('topoStore中缺少removeNodeRemote方法');
      throw new Error('删除节点失败：缺少API方法');
    }
    
    // 如果存在配置，也从干扰配置仓库中删除
    if (nodeConfig.value) {
      interferenceStore.removeInterferenceConfig(nodeConfig.value.id);
    }
    
    ElMessage.success("干扰节点已删除");
    emit("close");
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || "删除失败");
    }
  }
};

// 处理配置干扰参数按钮点击
const handleConfigInterference = () => {
  showConfigDialog.value = true;
};

// 处理干扰参数配置确认
const handleConfigConfirm = async (params: any) => {
  try {
    if (!props.node || !nodeConfig.value) return;
    
    // 更新仓库中的配置
    let newStatus = nodeConfig.value.status;
    
    // 如果之前是未配置状态，并且现在配置了有效参数，则更新为已配置状态
    if (newStatus === 'INSTANTIATION' && 
        (isParamConfigured(params.interferePowerdb) || 
         isParamConfigured(params.interfereFreq) || 
         isParamConfigured(params.azimuth) || 
         isParamConfigured(params.interfereModel) ||
         isParamConfigured(params.elevation))) {
      newStatus = 'DEFINITION';
    }

    interferenceStore.updateInterferenceConfig({
      ...nodeConfig.value,
      interferePowerdb: params.interferePowerdb !== null ? params.interferePowerdb.toString() : '',
      interfereFreq: params.interfereFreq !== null ? params.interfereFreq.toString() : '',
      azimuth: params.azimuth !== null ? params.azimuth.toString() : '',
      elevation: params.elevation !== null ? params.elevation.toString() : '',
      interfereModel: params.interfereModel || '',
      status: newStatus
    });
    
    ElMessage.success('干扰参数已更新');
  } catch (error: any) {
    console.error('更新干扰参数失败:', error);
    ElMessage.error(error?.message || '更新干扰参数失败，请重试');
  }
};

// 开关状态计算属性
const isInterferenceSwitchOn = computed({
  get: () => {
    if (!nodeConfig.value) return false;
    return nodeConfig.value.status === 'RUNTIME';
  },
  set: (value) => {
    // 当开关状态发生变化时，将在 handleInterferenceSwitchChange 中处理
  }
});

// 开关是否视觉上可用的计算属性
const canToggleInterferenceVisuals = computed(() => {
  if (!nodeConfig.value) return false;
  // 只有当节点状态不是未配置状态时，开关才可用
  return nodeConfig.value.status !== 'INSTANTIATION'; 
});

// 处理干扰开关变化
const handleInterferenceSwitchChange = async (newState: boolean) => {
  if (!props.node || !props.node.id || !nodeConfig.value) {
    ElMessage.error('节点信息不完整');
    return;
  }
  
  const nodeId = props.node.id;
  const sessionId = topoStore.currentSessionId;
  
  if (!sessionId) {
    ElMessage.error('当前会话ID不存在');
    return;
  }
  
  // 检查场景状态（与 isSimulationRunning 保持一致）
  if (!isSimulationRunning.value) {
    ElMessage.error('场景未运行，无法操作干扰');
    return;
  }
  
  // 检查节点状态
  if (newState) { // 尝试开启干扰
    if (nodeConfig.value.status !== 'DEFINITION' && nodeConfig.value.status !== 'SHUTDOWN') {
      ElMessage.error(`节点当前状态为"${interferenceStatusText.value}"，无法开启干扰`);
      return;
    }
  } else { // 尝试关闭干扰
    if (nodeConfig.value.status !== 'RUNTIME') {
      ElMessage.error(`节点当前状态为"${interferenceStatusText.value}"，无需关闭`);
      return;
    }
  }
  
  // 获取当前用户ID
  const userInfo = getUserInfo();
  const userId = userInfo.id;

  try {
    if (newState) {
      // 开启干扰
      await startNodeInterference(Number(sessionId), nodeId, userId);
      interferenceStore.updateInterferenceConfig({
        ...nodeConfig.value,
        status: 'RUNTIME'
      });
      ElMessage.success('干扰已开启');
    } else {
      // 关闭干扰
      await stopNodeInterference(Number(sessionId), nodeId, userId);
      interferenceStore.updateInterferenceConfig({
        ...nodeConfig.value,
        status: 'SHUTDOWN'
      });
      ElMessage.success('干扰已关闭');
    }
  } catch (error: any) {
    console.error('操作干扰失败:', error);
    ElMessage.error(error?.message || '操作失败，请重试');
    // 手动触发计算属性更新
    isInterferenceSwitchOn.value = !newState;
  }
};

// 判断参数是否已配置
const isParamConfigured = (param: any) => {
  return param !== null && param !== undefined && param !== '';
};

// 计算属性：干扰状态文本
const interferenceStatusText = computed(() => {
  if (!nodeConfig.value) return '未知状态';
  
  // 根据状态返回对应的中文文本
  switch (nodeConfig.value.status) {
    case 'INSTANTIATION':
      return '未配置';
    case 'DEFINITION':
      return '已配置';
    case 'RUNTIME':
      return '干扰中';
    case 'SHUTDOWN':
      return '已关闭';
    default:
      return '未知状态';
  }
});

// 计算属性：干扰状态类名
const interferenceStatusClass = computed(() => {
  if (!nodeConfig.value) return 'inactive';
  
  // 根据状态返回对应的CSS类名
  switch (nodeConfig.value.status) {
    case 'INSTANTIATION':
      return 'inactive';
    case 'DEFINITION':
      return 'configured';
    case 'RUNTIME':
      return 'active';
    case 'SHUTDOWN':
      return 'shutdown';
    default:
      return 'inactive';
  }
});
</script>

<style scoped>
.neo-infobox {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.85) 0%,
    rgba(17, 23, 64, 0.9) 100%
  );
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 408px;
  min-width: 300px;
  min-height: 150px;
  overflow: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(211, 47, 47, 0.2);
  color: white;
  transform-origin: top right;
  animation: infobox-appear 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  resize: both;
}

@keyframes infobox-appear {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.neo-infobox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(
    90deg,
    rgba(183, 28, 28, 0.4) 0%,
    rgba(211, 47, 47, 0.2) 100%
  );
  border-bottom: 1px solid rgba(211, 47, 47, 0.2);
  font-weight: 600;
  font-size: 16px;
  color: #D32F2F;
  text-shadow: 0 0 10px rgba(211, 47, 47, 0.3);
  position: relative;
}

.neo-infobox-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 15%;
  width: 70%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(211, 47, 47, 0.7), transparent);
}

.neo-infobox-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.neo-infobox-close {
  cursor: pointer;
  color: rgba(211, 47, 47, 0.8);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(211, 47, 47, 0.1);
  transition: all 0.2s ease;
}

.neo-infobox-close:hover {
  color: #D32F2F;
  background-color: rgba(211, 47, 47, 0.3);
  transform: rotate(90deg);
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.5);
}

.neo-infobox-content {
  padding: 14px;
}

.neo-section {
  margin-bottom: 16px;
  animation: section-appear 0.5s ease forwards;
  opacity: 0;
  transform: translateY(10px);
}

.neo-section:nth-child(1) {
  animation-delay: 0.1s;
}

.neo-section:nth-child(2) {
  animation-delay: 0.2s;
}

.neo-section:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes section-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.neo-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: rgba(211, 47, 47, 0.9);
  letter-spacing: 0.5px;
}

.neo-section-title .el-icon {
  color: #D32F2F;
  font-size: 18px;
  background: rgba(211, 47, 47, 0.15);
  padding: 4px;
  border-radius: 6px;
}

.neo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 4px;
}

.neo-grid-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(211, 47, 47, 0.05);
}

.neo-grid-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(211, 47, 47, 0.15);
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.1);
  transform: scale(1.02);
}

.item-label {
  color: #ffccbc;
  font-size: 15px;
  font-weight: 400;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
  text-align: center;
}

.item-value {
  color: #eaf6ff;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-indicator.active {
  background-color: #D32F2F;
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.8);
  animation: pulse-red 1.5s infinite;
}

.status-indicator.configured {
  background-color: #2196F3;
  box-shadow: 0 0 8px rgba(33, 150, 243, 0.8);
}

.status-indicator.inactive {
  background-color: #9E9E9E;
}

.status-indicator.shutdown {
  background-color: #4caf50;
}

@keyframes pulse-red {
  0% {
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.8);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(211, 47, 47, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0);
  }
}

.section-location {
  margin: 10px 0 0 0;
  color: #b6eaff;
  font-size: 14px;
  background: linear-gradient(90deg, rgba(211, 47, 47, 0.07) 0, #1e2736 100%);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: "Consolas", "Menlo", monospace;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 4px rgba(211, 47, 47, 0.07);
  text-align: center;
}

.interference-params {
  background-color: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(211, 47, 47, 0.05);
}

.param-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(211, 47, 47, 0.1);
}

.param-row:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.param-label {
  color: #ffccbc;
  font-size: 14px;
  flex: 1;
  text-align: left;
}

.param-value {
  color: #eaf6ff;
  font-size: 14px;
  font-family: "Consolas", "Menlo", monospace;
  flex: 1;
  text-align: right;
}

.interference-switch-row {
  /* 可根据需要添加特定样式 */
  align-items: center; /* 确保标签和开关垂直居中对齐 */
}

.power-slider-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.power-slider-container {
  width: 100%;
  padding: 0 12px;
}

.power-slider-container :deep(.el-slider__runway) {
  background-color: rgba(211, 47, 47, 0.15);
  height: 6px;
}

.power-slider-container :deep(.el-slider__bar) {
  background: linear-gradient(to right, #B71C1C, #D32F2F);
  height: 6px;
}

.power-slider-container :deep(.el-slider__button) {
  width: 16px;
  height: 16px;
  border: 2px solid #D32F2F;
  background-color: #fff;
  transition: all 0.2s ease;
}

.power-slider-container :deep(.el-slider__button:hover) {
  transform: scale(1.2);
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.6);
}

.power-slider-container :deep(.el-slider__button-wrapper) {
  top: -5px;
}

.neo-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.neo-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 8px;
  letter-spacing: 0.5px;
}

.delete-btn {
  background: linear-gradient(to right, #8B0000, #FF0000);
  color: #ffffff;
}

.delete-btn:hover {
  background: linear-gradient(to right, #FF0000, #c62828);
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  transform: translateY(-2px);
}

.config-btn {
  background: linear-gradient(to right, #B71C1C, #D32F2F);
  color: #ffffff;
}

.config-btn:hover {
  background: linear-gradient(to right, #D32F2F, #E53935);
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.5);
  transform: translateY(-2px);
}
</style> 