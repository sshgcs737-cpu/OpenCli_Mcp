<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">分布式场景链路配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <!-- 无人机选择区域 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">无人机选择</span>
            </div>

            <div class="selection-area">
              <div class="selection-panel available-panel">
                <div class="panel-header">
                  <div class="panel-title">
                    <el-icon class="panel-icon"><Collection /></el-icon>
                    <span>可选无人机</span>
                    <span class="count-badge">{{ availableDrones.length }}</span>
                  </div>
                  <el-button size="small" type="primary" @click="selectAllDrones" :disabled="availableDrones.length === 0">
                    全选
                  </el-button>
                </div>
                <div class="panel-body">
                  <div class="node-grid" v-if="availableDrones.length > 0">
                    <div
                      v-for="drone in availableDrones"
                      :key="drone.id"
                      class="node-card"
                      :class="{ 'temp-selected': tempSelectedDrones.includes(drone.id) }"
                      @click="selectDrone(drone)"
                    >
                      <div class="node-avatar">
                        <el-icon><Drone /></el-icon>
                      </div>
                      <div class="node-details">
                        <div class="node-name">{{ drone.alias || drone.name }}</div>
                        <div class="node-id">ID: {{ drone.id }}</div>
                      </div>
                      <div class="selection-indicator" v-if="tempSelectedDrones.includes(drone.id)">
                        <el-icon><Check /></el-icon>
                      </div>
                    </div>
                  </div>
                  <div v-else class="empty-panel">
                    <el-icon class="empty-icon"><InfoFilled /></el-icon>
                    <p>暂无可选的无人机节点</p>
                  </div>
                </div>
              </div>

              <div class="transfer-controls">
                <el-button
                  type="primary"
                  :icon="ArrowRight"
                  @click="addSelectedDrones"
                  :disabled="tempSelectedDrones.length === 0"
                  class="transfer-btn"
                >
                  添加
                </el-button>
                <el-button
                  type="danger"
                  :icon="ArrowLeft"
                  @click="removeSelectedDrones"
                  :disabled="tempRemovedDrones.length === 0"
                  class="transfer-btn"
                >
                  移除
                </el-button>
              </div>

              <div class="selection-panel selected-panel">
                <div class="panel-header">
                  <div class="panel-title">
                    <el-icon class="panel-icon"><Select /></el-icon>
                    <span>已选无人机</span>
                    <span class="count-badge selected">{{ selectedDrones.length }}</span>
                  </div>
                  <el-button size="small" type="danger" @click="clearSelectedDrones" :disabled="selectedDrones.length === 0">
                    清空
                  </el-button>
                </div>
                <div class="panel-body">
                  <div class="node-grid" v-if="selectedDrones.length > 0">
                    <div
                      v-for="drone in selectedDroneNodes"
                      :key="drone.id"
                      class="node-card selected"
                      :class="{ 'temp-remove-selected': tempRemovedDrones.includes(drone.id) }"
                      @click="unselectDrone(drone)"
                    >
                      <div class="node-avatar">
                        <el-icon><Drone /></el-icon>
                      </div>
                      <div class="node-details">
                        <div class="node-name">{{ drone.alias || drone.name }}</div>
                        <div class="node-id">ID: {{ drone.id }}</div>
                      </div>
                      <div class="selection-indicator" v-if="tempRemovedDrones.includes(drone.id)">
                        <el-icon><Close /></el-icon>
                      </div>
                    </div>
                  </div>
                  <div v-else class="empty-panel">
                    <el-icon class="empty-icon"><InfoFilled /></el-icon>
                    <p>未选择任何无人机</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- EMANE子网选择 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">子网选择</span>
            </div>

            <div class="form-row">
              <div class="form-label">目标子网</div>
              <el-select
                v-model="targetEmaneSubnet"
                placeholder="请选择子网"
                class="form-input"
                clearable
              >
                <el-option
                  v-for="emane in emaneNodes"
                  :key="emane.id"
                  :label="`${emane.alias || emane.name} (ID: ${emane.id})`"
                  :value="emane.id"
                >
                  <div class="option-content">
                    <span class="option-name">{{ emane.alias || emane.name }}</span>
                    <span class="option-id">ID: {{ emane.id }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>

          <!-- 路由器链配置 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">路由器链路配置</span>
            </div>

            <div class="form-row">
              <div class="form-label">启用路由器链路</div>
              <el-switch v-model="enableRouterChain" class="form-input" />
            </div>

            <div v-if="enableRouterChain" class="router-chain-config">
              <div class="router-chain-area">
                <div class="available-routers">
                  <div class="router-list-header">
                    <span>可选路由器 ({{ availableRouters.length }})</span>
                  </div>
                  <div class="router-list">
                    <div
                      v-for="router in availableRouters"
                      :key="router.id"
                      class="router-item"
                      @click="addRouterToChain(router)"
                    >
                      <el-icon class="router-icon"><NetworkDrive /></el-icon>
                      <div class="router-info">
                        <div class="router-name">{{ router.alias || router.name }}</div>
                        <div class="router-id">ID: {{ router.id }}</div>
                      </div>
                    </div>
                    <div v-if="availableRouters.length === 0" class="empty-message">
                      暂无可选路由器
                    </div>
                  </div>
                </div>

                <div class="router-chain">
                  <div class="router-list-header">
                    <span>路由器链 ({{ routerChain.length }})</span>
                    <el-button size="small" type="danger" @click="clearRouterChain" :disabled="routerChain.length === 0">
                      清空
                    </el-button>
                  </div>
                  <div class="router-chain-list">
                    <div
                      v-for="(routerId, index) in routerChain"
                      :key="routerId"
                      class="router-chain-item"
                    >
                      <div class="chain-index">{{ index + 1 }}</div>
                      <div class="router-info">
                        <div class="router-name">{{ routerChainNodes[index]?.alias || routerChainNodes[index]?.name }}</div>
                        <div class="router-id">ID: {{ routerId }}</div>
                      </div>
                      <div class="chain-controls">
                        <el-button size="small" :icon="ArrowUp" @click="moveRouterUp(routerId)" :disabled="index === 0" />
                        <el-button size="small" :icon="ArrowDown" @click="moveRouterDown(routerId)" :disabled="index === routerChain.length - 1" />
                        <el-button size="small" :icon="Delete" type="danger" @click="removeRouterFromChain(routerId)" />
                      </div>
                      <div v-if="index < routerChain.length - 1" class="chain-arrow">
                        <el-icon><ArrowDown /></el-icon>
                      </div>
                    </div>
                    <div v-if="routerChain.length === 0" class="empty-chain">
                      请从左侧选择路由器添加到链路中<br>
                      路由器将按顺序串联连接
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- IP地址配置 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">IP地址配置</span>
            </div>

            <div class="form-row">
              <div class="form-label">自动分配IP</div>
              <el-switch v-model="autoIpAllocation" class="form-input" />
            </div>

            <div v-if="autoIpAllocation" class="form-row">
              <div class="form-label">IP地址范围</div>
              <el-input
                v-model="ipRange"
                placeholder="10.0.0.0/24"
                class="form-input"
              />
            </div>
          </div>

          <!-- 链路参数配置 -->
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">链路参数</span>
              <span class="section-description">配置链路性能参数</span>
            </div>

            <div class="link-params">
              <div class="form-row">
                <div class="form-label">带宽</div>
                <el-input
                  v-model.number="linkOptions.bandwidth"
                  type="number"
                  placeholder="1000"
                  class="form-input">
                  <template #append>bps</template>
                </el-input>
              </div>
              <div class="form-row">
                <div class="form-label">延迟</div>
                <el-input
                  v-model.number="linkOptions.delay"
                  type="number"
                  placeholder="10"
                  class="form-input">
                  <template #append>ms</template>
                </el-input>
              </div>
              <div class="form-row">
                <div class="form-label">丢包率</div>
                <el-input
                  v-model.number="linkOptions.loss"
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
                  v-model.number="linkOptions.jitter"
                  type="number"
                  placeholder="0"
                  class="form-input">
                  <template #append>ms</template>
                </el-input>
              </div>
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button
            class="dialog-btn confirm-btn"
            type="primary"
            @click="handleConfirm"
            :loading="isCreating"
          >
            {{ isCreating ? '创建中...' : '创建链路' }}
          </el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, defineProps, defineEmits } from 'vue';
import {
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Delete, Switch,
  Check, Close, Select, Collection, InfoFilled
} from '@element-plus/icons-vue';
import { Drone, NetworkDrive } from '@icon-park/vue-next';
import { ElMessage } from 'element-plus';
import { useTopoStore } from '../../../store/modules/topo';
import { DistributedLinkUtils } from '../../../utils/distributedLinkUtils';
import type {
  Node,
  LinkOptions,
  DistributedLinkConfig,
  DistributedLinkResult
} from '../../../types/topo';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const topoStore = useTopoStore();
const dialogVisible = ref(props.visible);
const isCreating = ref(false);

// 表单数据
const selectedDrones = ref<number[]>([]);
const targetEmaneSubnet = ref<number | null>(null);
const enableRouterChain = ref(false);
const routerChain = ref<number[]>([]);
const autoIpAllocation = ref(true);
const ipRange = ref('10.0.0.0/24');

// 临时选择状态
const tempSelectedDrones = ref<number[]>([]);
const tempRemovedDrones = ref<number[]>([]);

// 链路选项
const linkOptions = reactive<LinkOptions>({
  bandwidth: 0,
  delay: 0,
  loss: 0,
  jitter: 0,
  buffer: 0,
  dup: 0,
  burst: 0,
  mburst: 0,
  unidirectional: false,
  mtu: 0,
  key: 0,
  mer: 0
});

// 计算属性
const nodes = computed(() => topoStore.topoData?.nodes || []);
const links = computed(() => topoStore.topoData?.links || []);

const droneNodes = computed(() => DistributedLinkUtils.getDroneNodes(nodes.value));
const routerNodes = computed(() => DistributedLinkUtils.getRouterNodes(nodes.value));
const emaneNodes = computed(() => {
  // 使用Map去重，确保每个EMANE节点只出现一次
  const uniqueEmaneNodes = new Map();
  DistributedLinkUtils.getEmaneNodes(nodes.value).forEach(node => {
    uniqueEmaneNodes.set(node.id, node);
  });
  return Array.from(uniqueEmaneNodes.values());
});

const availableDrones = computed(() =>
  droneNodes.value.filter(drone => !selectedDrones.value.includes(drone.id))
);

const selectedDroneNodes = computed(() =>
  droneNodes.value.filter(drone => selectedDrones.value.includes(drone.id))
);

const availableRouters = computed(() =>
  routerNodes.value.filter(router => !routerChain.value.includes(router.id))
);

const routerChainNodes = computed(() =>
  routerChain.value.map(routerId =>
    routerNodes.value.find(router => router.id === routerId)
  ).filter(Boolean)
);

// 无人机选择方法
const selectDrone = (drone: Node) => {
  if (tempSelectedDrones.value.includes(drone.id)) {
    tempSelectedDrones.value = tempSelectedDrones.value.filter(id => id !== drone.id);
  } else {
    tempSelectedDrones.value.push(drone.id);
  }
};

const unselectDrone = (drone: Node) => {
  if (tempRemovedDrones.value.includes(drone.id)) {
    tempRemovedDrones.value = tempRemovedDrones.value.filter(id => id !== drone.id);
  } else {
    tempRemovedDrones.value.push(drone.id);
  }
};

const addSelectedDrones = () => {
  selectedDrones.value.push(...tempSelectedDrones.value);
  tempSelectedDrones.value = [];
};

const removeSelectedDrones = () => {
  selectedDrones.value = selectedDrones.value.filter(id => !tempRemovedDrones.value.includes(id));
  tempRemovedDrones.value = [];
};

const selectAllDrones = () => {
  selectedDrones.value = [...droneNodes.value.map(drone => drone.id)];
};

const clearSelectedDrones = () => {
  selectedDrones.value = [];
};

// 路由器管理方法
const addRouterToChain = (router: Node) => {
  if (!routerChain.value.includes(router.id)) {
    routerChain.value.push(router.id);
  }
};

const removeRouterFromChain = (routerId: number) => {
  const index = routerChain.value.indexOf(routerId);
  if (index > -1) {
    routerChain.value.splice(index, 1);
  }
};

const moveRouterUp = (routerId: number) => {
  const index = routerChain.value.indexOf(routerId);
  if (index > 0) {
    [routerChain.value[index], routerChain.value[index - 1]] =
    [routerChain.value[index - 1], routerChain.value[index]];
  }
};

const moveRouterDown = (routerId: number) => {
  const index = routerChain.value.indexOf(routerId);
  if (index < routerChain.value.length - 1) {
    [routerChain.value[index], routerChain.value[index + 1]] =
    [routerChain.value[index + 1], routerChain.value[index]];
  }
};

const clearRouterChain = () => {
  routerChain.value = [];
};

// 表单验证
const validateForm = (): boolean => {
  // 检查是否至少有一种配置：无人机到EMANE 或 路由器链
  const hasDroneConfig = selectedDrones.value.length > 0 && targetEmaneSubnet.value;
  const hasRouterConfig = enableRouterChain.value && routerChain.value.length > 0;

  if (!hasDroneConfig && !hasRouterConfig) {
    ElMessage.warning('请至少配置一种链路：无人机到EMANE子网 或 路由器链');
    return false;
  }

  // 如果配置了无人机到EMANE，验证相关字段
  if (hasDroneConfig) {
    if (selectedDrones.value.length === 0) {
      ElMessage.warning('请至少选择一个无人机');
      return false;
    }

    if (!targetEmaneSubnet.value) {
      ElMessage.warning('请选择目标EMANE子网');
      return false;
    }
  }

  // 如果配置了路由器链，验证相关字段
  if (hasRouterConfig && routerChain.value.length === 0) {
    ElMessage.warning('请至少选择一个路由器');
    return false;
  }

  if (autoIpAllocation.value) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!ipRegex.test(ipRange.value)) {
      ElMessage.warning('IP地址范围格式不正确');
      return false;
    }
  }

  return true;
};

// 创建链路
const handleConfirm = async () => {
  if (!validateForm()) return;

  const config: DistributedLinkConfig = {
    selectedDrones: selectedDrones.value,
    targetEmaneSubnet: targetEmaneSubnet.value!,
    routerChain: enableRouterChain.value ? routerChain.value : [], // 根据开关状态决定是否包含路由器链
    autoIpAllocation: autoIpAllocation.value,
    ipRange: ipRange.value,
    linkOptions: { ...linkOptions }
  };

  // 验证配置
  const validationErrors = DistributedLinkUtils.validateConfig(config, nodes.value);
  if (validationErrors.length > 0) {
    ElMessage.error(validationErrors.join('；'));
    return;
  }

  isCreating.value = true;

  try {
    const result: DistributedLinkResult = await DistributedLinkUtils.createDistributedLinks(
      config,
      nodes.value,
      links.value
    );

    if (result.errors.length > 0) {
      ElMessage.error(`创建链路时发生错误：${result.errors.join('；')}`);
      return;
    }

    // 批量添加链路到拓扑
    for (const link of result.createdLinks) {
      try {
        await topoStore.addLinkRemote(link);
      } catch (error: any) {
        console.error('添加链路失败:', error);
        ElMessage.error(`添加链路失败: ${error.message}`);
      }
    }

    // 显示IP分配信息
    if (Object.keys(result.ipAllocations).length > 0) {
      const ipInfo = Object.entries(result.ipAllocations)
        .map(([nodeId, ip]) => {
          const node = nodes.value.find(n => n.id === parseInt(nodeId));
          const nodeName = node ? (node.alias || node.name) : nodeId;
          const nodeType = node ? node.type : '未知';
          return `${nodeName} (${nodeType}): ${ip}`;
        })
        .join('\n');


      // 如果IP分配较少，直接在消息中显示
      if (Object.keys(result.ipAllocations).length <= 3) {
        const shortInfo = Object.entries(result.ipAllocations)
          .map(([nodeId, ip]) => {
            const node = nodes.value.find(n => n.id === parseInt(nodeId));
            const nodeName = node ? (node.alias || node.name) : nodeId;
            return `${nodeName}: ${ip}`;
          })
          .join(', ');
        ElMessage({
          message: `成功创建链路并分配IP - ${shortInfo}`,
          type: 'success',
          duration: 6000
        });
      } else {
        ElMessage({
          message: `成功创建 ${result.createdLinks.length} 条链路，已为 ${Object.keys(result.ipAllocations).length} 个节点分配IP地址（详情见控制台）`,
          type: 'success',
          duration: 6000
        });
      }
    } else {
      ElMessage({
        message: `成功创建 ${result.createdLinks.length} 条链路`,
        type: 'success'
      });
    }

    dialogVisible.value = false;
    emit('confirm', result);

  } catch (error: any) {
    console.error('创建分布式链路失败:', error);
    ElMessage.error(`创建分布式链路失败: ${error.message}`);
  } finally {
    isCreating.value = false;
  }
};

const handleClose = () => {
  dialogVisible.value = false;
  emit('cancel');
};

// 重置表单
const resetForm = () => {
  selectedDrones.value = [];
  targetEmaneSubnet.value = null;
  enableRouterChain.value = false;
  routerChain.value = [];
  autoIpAllocation.value = true;
  ipRange.value = '10.0.0.0/24';
  tempSelectedDrones.value = [];
  tempRemovedDrones.value = [];

  Object.assign(linkOptions, {
    bandwidth: 0,
    delay: 0,
    loss: 0,
    jitter: 0,
    buffer: 0,
    dup: 0,
    burst: 0,
    mburst: 0,
    unidirectional: false,
    mtu: 0,
    key: 0,
    mer: 0
  });
};

// 监听对话框显示状态
watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal) {
    resetForm();
  }
});

watch(dialogVisible, (val) => {
  emit('update:visible', val);
});

// 监听路由器串联开关
watch(enableRouterChain, (newVal) => {
  if (!newVal) {
    routerChain.value = [];
  }
});
</script>

<style scoped>
/* 继承现有对话框样式 */
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

.custom-dialog {
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
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
  padding: 0.75rem 1.25rem;
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

.custom-dialog-body {
  padding: 1rem;
  flex: 1;
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
  padding: 0.75rem 1.25rem 1rem;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

.config-section {
  margin-bottom: 1.5rem;
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

.section-description {
  margin-left: 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: normal;
}

.form-row {
  display: flex;
  margin-bottom: 0.75rem;
  align-items: center;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 6rem;
  text-align: right;
  padding-right: 1rem;
  color: #a0aec0;
  font-size: 0.8125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.form-input {
  flex: 1;
}

/* 信息提示框样式 */
.form-info {
  width: 100%;
  text-align: left;
  padding: 0.75rem;
  border-radius: 6px;
  background: rgba(14, 135, 205, 0.1);
  color: #0cc4cc;
  font-size: 0.875rem;
  margin: 0.5rem 0;
  border: 1px solid rgba(12, 196, 204, 0.2);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.emane-info {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
  border-color: rgba(255, 193, 7, 0.3);
}

.info-icon {
  font-style: normal;
  font-size: 1rem;
}

/* 选择区域样式 */
.selection-area {
  display: flex;
  gap: 1rem;
  align-items: stretch;
  min-height: 280px;
}

.selection-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  background: rgba(30, 39, 54, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(12, 196, 204, 0.15);
  overflow: hidden;
  transition: all 0.3s ease;
}

.available-panel:hover,
.selected-panel:hover {
  border-color: rgba(12, 196, 204, 0.3);
  box-shadow: 0 0 15px rgba(12, 196, 204, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(12, 196, 204, 0.1);
  border-bottom: 1px solid rgba(12, 196, 204, 0.2);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ffffff;
  font-weight: 500;
  font-size: 0.875rem;
}

.panel-icon {
  color: #0cc4cc;
  font-size: 1rem;
}

.count-badge {
  background: linear-gradient(135deg, rgba(12, 196, 204, 0.8), rgba(0, 200, 255, 0.6));
  color: #ffffff;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 4px rgba(12, 196, 204, 0.3);
}

.count-badge.selected {
  background: linear-gradient(135deg, rgba(255, 165, 0, 0.8), rgba(255, 87, 87, 0.6));
  box-shadow: 0 2px 4px rgba(255, 165, 0, 0.3);
}

.panel-body {
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(12, 196, 204, 0.3) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 4px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
  border-radius: 2px;
}

.node-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.node-card {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: rgba(40, 57, 80, 0.4);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.node-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(12, 196, 204, 0.15), transparent);
  transition: left 0.5s ease;
}

.node-card:hover {
  background: rgba(40, 57, 80, 0.7);
  border-color: rgba(12, 196, 204, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(12, 196, 204, 0.2);
}

.node-card:hover::before {
  left: 100%;
}

.node-card.selected {
  background: rgba(12, 196, 204, 0.15);
  border-color: rgba(12, 196, 204, 0.5);
  box-shadow: 0 0 12px rgba(12, 196, 204, 0.3);
}

.node-card.temp-selected {
  background: linear-gradient(135deg, rgba(0, 255, 127, 0.2), rgba(12, 196, 204, 0.15));
  border-color: rgba(0, 255, 127, 0.7);
  box-shadow:
    0 0 20px rgba(0, 255, 127, 0.5),
    inset 0 0 10px rgba(0, 255, 127, 0.1);
  transform: translateY(-2px) scale(1.02);
  animation: card-selected-pulse 2s ease-in-out infinite;
}

.node-card.temp-remove-selected {
  background: linear-gradient(135deg, rgba(255, 87, 87, 0.2), rgba(255, 165, 0, 0.15));
  border-color: rgba(255, 87, 87, 0.7);
  box-shadow:
    0 0 20px rgba(255, 87, 87, 0.5),
    inset 0 0 10px rgba(255, 87, 87, 0.1);
  transform: translateY(-1px) scale(1.01);
  animation: card-remove-pulse 2s ease-in-out infinite;
}

@keyframes card-selected-pulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(0, 255, 127, 0.5),
      inset 0 0 10px rgba(0, 255, 127, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(0, 255, 127, 0.7),
      inset 0 0 15px rgba(0, 255, 127, 0.2);
  }
}

@keyframes card-remove-pulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(255, 87, 87, 0.5),
      inset 0 0 10px rgba(255, 87, 87, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(255, 87, 87, 0.7),
      inset 0 0 15px rgba(255, 87, 87, 0.2);
  }
}

.node-avatar {
  margin-right: 0.75rem;
  color: #0cc4cc;
  font-size: 1.25rem;
  transition: all 0.3s ease;
}

.node-card.temp-selected .node-avatar {
  color: #00ff7f;
  text-shadow: 0 0 8px rgba(0, 255, 127, 0.8);
  transform: scale(1.15);
}

.node-card.temp-remove-selected .node-avatar {
  color: #ff5757;
  text-shadow: 0 0 8px rgba(255, 87, 87, 0.8);
  transform: scale(1.1);
}

.node-details {
  flex: 1;
}

.node-name {
  font-size: 0.875rem;
  color: #ffffff;
  font-weight: 500;
  margin-bottom: 0.25rem;
  transition: all 0.3s ease;
}

.node-card.temp-selected .node-name {
  color: #ffffff;
  text-shadow: 0 0 5px rgba(0, 255, 127, 0.6);
  font-weight: 600;
}

.node-card.temp-remove-selected .node-name {
  color: #ffffff;
  text-shadow: 0 0 5px rgba(255, 87, 87, 0.6);
  font-weight: 600;
}

.node-id {
  font-size: 0.75rem;
  color: #a0aec0;
  transition: all 0.3s ease;
}

.selection-indicator {
  margin-left: 0.5rem;
  color: #ffffff;
  font-size: 1rem;
  background: rgba(0, 255, 127, 0.2);
  border-radius: 50%;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(0, 255, 127, 0.4);
  animation: indicator-pulse 1.5s ease-in-out infinite;
}

.node-card.temp-remove-selected .selection-indicator {
  background: rgba(255, 87, 87, 0.2);
  color: #ff5757;
  box-shadow: 0 0 8px rgba(255, 87, 87, 0.4);
}

@keyframes indicator-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

.transfer-controls {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  align-items: center;
}

.transfer-btn {
  padding: 0.75rem 1rem;
  min-width: 4rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.transfer-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: #7f8c9d;
  text-align: center;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.6;
}

.empty-panel p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.node-icon {
  margin-right: 0.75rem;
  color: #0cc4cc;
}

.empty-message {
  text-align: center;
  color: #7f8c9d;
  font-size: 0.875rem;
  padding: 1rem;
}

/* 路由器链样式 */
.router-chain-config {
  margin-top: 1rem;
}

.router-chain-area {
  display: flex;
  gap: 1rem;
  min-height: 300px;
}

.available-routers {
  flex: 1;
  background: rgba(30, 39, 54, 0.5);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
}

.router-chain {
  flex: 1;
  background: rgba(30, 39, 54, 0.5);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
}

.router-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: #a0aec0;
  font-weight: 500;
}

.router-list {
  max-height: 250px;
  overflow-y: auto;
}

.router-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.router-item:hover {
  background: rgba(40, 57, 80, 0.6);
  border-color: rgba(12, 196, 204, 0.3);
}

.router-icon {
  margin-right: 0.75rem;
  color: #0cc4cc;
}

.router-info {
  flex: 1;
}

.router-name {
  font-size: 0.875rem;
  color: #fff;
  font-weight: 500;
}

.router-id {
  font-size: 0.75rem;
  color: #a0aec0;
}

.router-chain-list {
  max-height: 250px;
  overflow-y: auto;
}

.router-chain-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: rgba(12, 196, 204, 0.1);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(12, 196, 204, 0.3);
  position: relative;
}

.chain-index {
  width: 2rem;
  height: 2rem;
  background: #0cc4cc;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  margin-right: 0.75rem;
}

.chain-controls {
  display: flex;
  gap: 0.25rem;
  margin-left: 0.75rem;
}

.chain-arrow {
  position: absolute;
  bottom: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  color: #0cc4cc;
  font-size: 1.25rem;
}

.empty-chain {
  text-align: center;
  color: #7f8c9d;
  font-size: 0.875rem;
  padding: 2rem 1rem;
  line-height: 1.5;
}

/* 链路参数样式 */
.link-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

/* 选项内容样式 */
.option-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.option-name {
  color: #fff;
  font-weight: 500;
}

.option-id {
  color: #a0aec0;
  font-size: 0.75rem;
}

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

/* Element Plus 样式覆盖 */
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

:deep(.el-select__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
}

:deep(.el-input-group__append) {
  background: rgba(40, 57, 80, 0.7) !important;
  color: #fff !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-left: none !important;
  border-radius: 0 6px 6px 0 !important;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
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

@media (max-width: 1024px) {
  .custom-dialog {
    width: 98%;
    max-width: 100%;
  }

  .selection-area {
    flex-direction: column;
  }

  .router-chain-area {
    flex-direction: column;
    min-height: auto;
  }

  .link-params {
    grid-template-columns: 1fr;
  }
}
</style>