<template>
  <div v-show="visible" class="drone-control-panel">
    <div class="panel-header">
      <h3>节点控制</h3>
      <div class="panel-btns">
        <div class="btn-row">
          <el-button 
            type="success" 
            size="small"
            class="tech-button-success" 
            :disabled="selectedDrones.length === 0"
            @click="startControl"
          >
          开始控制
          </el-button>
          <el-button 
            type="danger" 
            size="small"
            class="tech-button-danger" 
            :disabled="selectedDrones.length === 0 || selectedDrones.every(id => !isControlled(id))"
            @click="stopSelectedControl"
          >
           停止选中
          </el-button>
          <el-button 
            type="danger" 
            size="small"
            class="tech-button-danger" 
            :disabled="controlledDrones.length === 0"
            @click="stopAllControl"
          >
          停止全部
          </el-button>
          <el-button
            type="warning"
            size="small"
            class="tech-button-warning"
            @click="$emit('update:visible', false)"
          >
            关闭
          </el-button>
        </div>
      </div>
    </div>
    
    <div class="panel-content">
      <div class="drone-list-section">
        <h4>可控制节点</h4>
        <div v-if="availableDrones.length === 0" class="no-drones">
          <p>暂无可控制的节点</p>
          <p class="hint">请确认场景中存在节点</p>
        </div>
        <el-scrollbar height="180px">
          <el-checkbox-group v-model="selectedDrones" @change="handleDroneSelectionChange">
            <div v-for="drone in availableDrones" :key="drone.id" class="drone-card">
              <div class="drone-info">
                <el-checkbox :label="drone.id">
                  <span class="drone-name">
                    {{ drone.name }}
                  </span>
                </el-checkbox>
                <span class="drone-status" :class="{ 'controlled': isControlled(drone.id) }">
                  {{ isControlled(drone.id) ? '(已控制)' : '(待命)' }}
                </span>
              </div>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
      </div>

      <div class="control-section">
        <h4>速度设置</h4>
        <div class="speed-controls">
          <div class="speed-item">
            <div class="speed-label">水平移动速度 (米/秒)</div>
            <el-input-number 
              v-model="horizontalSpeed" 
              :min="10" 
              :max="5000" 
              :step="10" 
              controls-position="right"
              class="speed-input"
              @change="updateDroneSpeed"
            />
          </div>
          
          <div class="speed-item">
            <div class="speed-label">垂直移动速度 (米/秒)</div>
            <el-input-number 
              v-model="verticalSpeed" 
              :min="5" 
              :max="2000" 
              :step="5" 
              controls-position="right"
              class="speed-input"
              @change="updateDroneSpeed"
            />
          </div>
        </div>
      </div>

      <div class="control-section">
        <h4>控制说明</h4>
        <div class="instruction-grid">
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">↑</span>
            </div>
            <div class="instruction-text">前进</div>
          </div>
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">↓</span>
            </div>
            <div class="instruction-text">后退</div>
          </div>
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">←</span>
            </div>
            <div class="instruction-text">左转</div>
          </div>
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">→</span>
            </div>
            <div class="instruction-text">右转</div>
          </div>
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">J</span>
            </div>
            <div class="instruction-text">上升</div>
          </div>
          <div class="instruction-item">
            <div class="instruction-key">
              <span class="key">K</span>
            </div>
            <div class="instruction-text">下降</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="panel-footer">
      <div class="controlled-status">
        当前控制: <span class="controlled-count">{{ controlledDrones.length }}</span> 个节点
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch,computed } from 'vue';
import type { PropType } from 'vue';
import { ElMessage } from 'element-plus';
import { useTopoStore } from '../../../store/modules/topo';
import { useInterferenceStore } from '../../../store/modules/interference';
import { controlEntityMovement } from '../../../utils/entityControl';
import eventBus from '../../../utils/eventBus';
import * as Cesium from 'cesium';
import { editInterferenceNode, stopNodeInterference } from '../../../api/inode';
import { getUserInfo } from '../../../store/user';


const props = defineProps({
  visible: Boolean,
  viewer: {
    type: Object as PropType<Record<string, any> | null>,
    default: null
  }
});

const emit = defineEmits(['update:visible']);


const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();

// 干扰节点的定时干扰器管理
const interferenceTimers = ref<Map<string | number, number>>(new Map());
const INTERFERENCE_INTERVAL = 1000; // 1秒发送一次干扰请求

interface Position {
  longitude: number;
  latitude: number;
  height: number;
}
const lastReportedPositions = ref<Map<string | number, Position>>(new Map());
const POSITION_CHANGE_THRESHOLD = 2.0;


const isSimulationRunning = computed(() => {
  return topoStore.topoData?.state === 'RUNTIME' || topoStore.topoData?.state === 'RUNNING';
});


const availableDrones = ref<any[]>([]);

const selectedDrones = ref<(string | number)[]>([]);

const controlledDrones = ref<(string | number)[]>([]);


const removeControlFunctions = ref<Map<string | number, Function>>(new Map());


const isDroneBeingControlled = ref(false);


const positionUpdateTimer = ref<number | null>(null);

const POSITION_UPDATE_INTERVAL = 500;


const horizontalSpeed = ref(100);
const verticalSpeed = ref(50);


const calculateHorizontalDistance = (
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number => {
  const earthRadius = 6371000;
  const lon1Rad = Cesium.Math.toRadians(lon1);
  const lat1Rad = Cesium.Math.toRadians(lat1);
  const lon2Rad = Cesium.Math.toRadians(lon2);
  const lat2Rad = Cesium.Math.toRadians(lat2);

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance;
};

const calculateDistance = (pos1: Position, pos2: Position): number => {
  return calculateHorizontalDistance(
    pos1.longitude, pos1.latitude, 
    pos2.longitude, pos2.latitude
  ) + Math.abs(pos1.height - pos2.height);
}



const fetchAvailableDrones = () => {
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    availableDrones.value = [];
    return;
  }


  const drones = topoStore.topoData.nodes.filter((node: any) => {
    return node.type === 'DRONE' || node.type === 'INODE';
  });

  availableDrones.value = drones.map((drone: any) => ({
    id: drone.id,
    name: drone.alias || drone.name,
    type: drone.type,
    geo: drone.geo
  }));
};


const isControlled = (droneId: string | number): boolean => {
  return controlledDrones.value.includes(droneId);
};


const updateDroneSpeed = () => {
  if (!props.viewer) return;
  
  controlledDrones.value.forEach(droneId => {
    const entity = props.viewer?.entities.getById(droneId.toString());
    if (entity) {
      (entity as any).speed = horizontalSpeed.value;
      (entity as any).verticalSpeed = verticalSpeed.value;
    }
  });
  
  if (controlledDrones.value.length > 0) {
    ElMessage.success(`已更新${controlledDrones.value.length}个节点的速度设置`);
  }
};


const handleDroneSelectionChange = () => {

};


const updateEntityPositionToStore = (entityId: string): boolean => {
  if (!props.viewer) return false;
  
  try {
    const entity = props.viewer.entities.getById(entityId);
    if (!entity || !entity.position) return false;

    const position = entity.position.getValue(props.viewer.clock.currentTime);
    if (!position) return false;
    
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height;
    
    const currentPosition = { longitude, latitude, height };

    const lastPosition = lastReportedPositions.value.get(entityId);
    if (lastPosition) {
      if (calculateDistance(lastPosition, currentPosition) < POSITION_CHANGE_THRESHOLD) {
        return false;
      }
    }
    lastReportedPositions.value.set(entityId, currentPosition);

    const nodeId = parseInt(entityId, 10);
    if (isNaN(nodeId)) return false;
    
    if (!topoStore.topoData || !topoStore.topoData.nodes) return false;
    
    const node = topoStore.topoData.nodes.find((n: any) => n.id === nodeId);
    if (!node) return false;
    
    node.geo.lon = Number(longitude.toFixed(6));
    node.geo.lat = Number(latitude.toFixed(6));
    node.geo.alt = Number(height.toFixed(2));
    
    return true;

    } catch (error) {
    console.error(`更新实体${entityId}位置时出错:`, error);
    return false;
  }
};


const startPositionUpdates = () => {
  if (positionUpdateTimer.value !== null) {
    clearInterval(positionUpdateTimer.value);
  }
  

  positionUpdateTimer.value = window.setInterval(() => {
    if (controlledDrones.value.length === 0) return;
    
    let hasUpdate = false;
    controlledDrones.value.forEach(droneId => {
      if (updateEntityPositionToStore(droneId.toString())) {
        hasUpdate = true;
      }
    });
    
    if (hasUpdate) {
      (eventBus as any).emit('triggerPositionUpdate');
    }
  }, POSITION_UPDATE_INTERVAL);
  
  

  isDroneBeingControlled.value = true;
};


const stopPositionUpdates = () => {
  if (positionUpdateTimer.value !== null) {
    clearInterval(positionUpdateTimer.value);
    positionUpdateTimer.value = null;
  }
  
  isDroneBeingControlled.value = false;
};


const startControl = () => {
  if (!props.viewer) {
    ElMessage.warning('视图未初始化,无法控制节点');
    return;
  }


  if (!isSimulationRunning.value) {
    ElMessage.warning('仿真未开启,无法控制节点');
    return;
  }

  if (selectedDrones.value.length === 0) {
    ElMessage.warning('请先选择要控制的节点');
    return;
  }

  selectedDrones.value.forEach(droneId => {
    if (!controlledDrones.value.includes(droneId)) {
      try {
        const viewer = props.viewer as Record<string, any>;
        const removeControlFunction = controlEntityMovement(viewer, droneId.toString());

        if (removeControlFunction) {
          removeControlFunctions.value.set(droneId, removeControlFunction);
        }

        const entity = viewer.entities.getById(droneId.toString());
        if (entity) {
          (entity as any).speed = horizontalSpeed.value;
          (entity as any).verticalSpeed = verticalSpeed.value;

          (entity as any)._isControlled = true;
          (entity as any)._isFlying = true;
          (entity as any)._hasCustomPath = true;

          controlledDrones.value.push(droneId);

          // 如果是干扰节点且已开启干扰,启动定时干扰
          if (isInterferenceNode(droneId)) {
            const config = getInterferenceConfig(droneId);
            if (config && config.status === 'RUNTIME') {
              startInterferenceTimer(droneId);
            }
          }

          ElMessage.success(`开始控制节点: ${getDroneName(droneId)}`);
        } else {
          ElMessage.error(`未找到ID为 ${droneId} 的节点实体`);
        }
      } catch (error) {
        console.error(`控制节点 ${droneId} 时出错:`, error);
        ElMessage.error(`控制节点失败: ${error}`);
      }
    }
  });

  if (controlledDrones.value.length > 0) {
    startPositionUpdates();
    (eventBus as any).emit('startFlightPositionUpdates');
  }
};


const stopSelectedControl = () => {
  if (!props.viewer) return;

  const selectedControlledDrones = selectedDrones.value.filter(droneId =>
    controlledDrones.value.includes(droneId)
  );

  if (selectedControlledDrones.length === 0) {
    ElMessage.warning('没有选中正在被控制的节点');
    return;
  }

  selectedControlledDrones.forEach(droneId => {
    lastReportedPositions.value.delete(droneId);

    // 如果是干扰节点,停止定时干扰
    if (isInterferenceNode(droneId)) {
      stopInterferenceTimer(droneId);
    }

    const entity = props.viewer?.entities.getById(droneId.toString());
    if (entity) {
      (entity as any)._isControlled = false;
      (entity as any)._isFlying = false;
    }

    const removeControlFunction = removeControlFunctions.value.get(droneId);
    if (removeControlFunction) {
      removeControlFunction();
      removeControlFunctions.value.delete(droneId);
    }

    const index = controlledDrones.value.indexOf(droneId);
    if (index > -1) {
      controlledDrones.value.splice(index, 1);
    }
  });

  if (controlledDrones.value.length === 0) {
    stopPositionUpdates();
    (eventBus as any).emit('stopFlightPositionUpdates');
  }

  ElMessage.success(`已停止控制 ${selectedControlledDrones.length} 个选中的节点`);
};


const stopAllControl = () => {
  if (!props.viewer) return;

  controlledDrones.value.forEach(droneId => {
    lastReportedPositions.value.delete(droneId);

    // 如果是干扰节点,停止定时干扰
    if (isInterferenceNode(droneId)) {
      stopInterferenceTimer(droneId);
    }

    const entity = props.viewer?.entities.getById(droneId.toString());
    if (entity) {
      (entity as any)._isControlled = false;
      (entity as any)._isFlying = false;
    }

    const removeControlFunction = removeControlFunctions.value.get(droneId);
    if (removeControlFunction) {
      removeControlFunction();
      removeControlFunctions.value.delete(droneId);
    }
  });

  stopPositionUpdates();

  if (controlledDrones.value.length > 0) {
    ElMessage.success(`已停止控制 ${controlledDrones.value.length} 个节点`);
    controlledDrones.value = [];
    (eventBus as any).emit('stopFlightPositionUpdates');
  }
};


const getDroneName = (droneId: string | number): string => {
  const drone = availableDrones.value.find(d => d.id === droneId);
  return drone ? drone.name : `节点 ${droneId}`;
};

// 判断是否为干扰节点
const isInterferenceNode = (nodeId: string | number): boolean => {
  const drone = availableDrones.value.find(d => d.id === nodeId);
  return drone?.type === 'INODE';
};

// 获取干扰节点的配置
const getInterferenceConfig = (nodeId: string | number) => {
  const node = topoStore.topoData?.nodes.find((n: any) => n.id === nodeId);
  if (!node) return null;
  return interferenceStore.getConfigByNodeId(nodeId as number);
};

// 启动干扰节点的定时干扰
const startInterferenceTimer = (nodeId: string | number) => {
  // 如果已经有定时器,先清除
  const existingTimer = interferenceTimers.value.get(nodeId);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  const config = getInterferenceConfig(nodeId);
  if (!config || config.status !== 'RUNTIME') {
    return;
  }

  // 创建定时器,每秒发送一次编辑请求(更新位置信息)
  const timer = window.setInterval(async () => {
    try {
      const sessionId = topoStore.currentSessionId;
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      if (sessionId && config) {
        // 获取当前节点的最新位置
        const node = topoStore.topoData?.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          // 调用editINode API更新位置并保持干扰状态
          await editInterferenceNode({
            sessionId: Number(sessionId),
            nodeId: Number(nodeId),
            lat: String(node.geo.lat),
            lon: String(node.geo.lon),
            alt: String(node.geo.alt),
            interferePowerdb: config.interferePowerdb || '',
            interfereFreq: config.interfereFreq || '',
            azimuth: config.azimuth || '',
            elevation: config.elevation || '',
            userId: userId
          });
        }
      }
    } catch (error) {
      console.error(`干扰节点 ${nodeId} 发送编辑请求失败:`, error);
    }
  }, INTERFERENCE_INTERVAL);

  interferenceTimers.value.set(nodeId, timer);
};

// 停止干扰节点的定时干扰
const stopInterferenceTimer = (nodeId: string | number) => {
  const timer = interferenceTimers.value.get(nodeId);
  if (timer) {
    clearInterval(timer);
    interferenceTimers.value.delete(nodeId);
  }
};

// 停止所有干扰节点的干扰
const stopAllInterference = async () => {
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    return;
  }

  const sessionId = topoStore.currentSessionId;
  if (!sessionId) {
    console.warn('无法关闭干扰: 当前会话ID不存在');
    return;
  }

  const userInfo = getUserInfo();
  const userId = userInfo.id;

  // 找出所有干扰中的INODE节点
  const activeInterferenceNodes = topoStore.topoData.nodes.filter((node: any) => {
    if (node.type !== 'INODE') return false;
    const config = interferenceStore.getConfigByNodeId(node.id);
    return config && config.status === 'RUNTIME';
  });

  if (activeInterferenceNodes.length === 0) {
    return;
  }


  // 为每个活跃的干扰节点调用stopNodeInterference API
  const stopPromises = activeInterferenceNodes.map(async (node: any) => {
    try {
      await stopNodeInterference(Number(sessionId), node.id, userId);

      // 更新interferenceStore中的状态
      const config = interferenceStore.getConfigByNodeId(node.id);
      if (config) {
        interferenceStore.updateInterferenceConfig({
          ...config,
          status: 'SHUTDOWN'
        });
      }

    } catch (error) {
      console.error(`DroneControlPanel: 关闭干扰节点 ${node.id} 失败:`, error);
    }
  });

  await Promise.all(stopPromises);
};


watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchAvailableDrones();
  }
});

// 监听干扰节点配置状态变化，在控制中动态启停干扰定时器
watch(
  () => interferenceStore.interferenceConfigs.map(c => `${c.nodeId}:${c.status}`).join(','),
  (newVal, oldVal) => {
    if (!newVal || !oldVal) return;
    const parseConfigs = (val: string) => {
      if (!val) return new Map<number, string>();
      const map = new Map<number, string>();
      val.split(',').forEach(item => {
        const [id, status] = item.split(':');
        if (id && status) map.set(Number(id), status);
      });
      return map;
    };
    const newMap = parseConfigs(newVal);
    const oldMap = parseConfigs(oldVal);

    newMap.forEach((status, nodeId) => {
      const oldStatus = oldMap.get(nodeId);
      if (status === oldStatus) return;

      if (status === 'RUNTIME' && oldStatus !== 'RUNTIME') {
        // 状态变为 RUNTIME：如果节点正在被控制，启动定时器
        if (controlledDrones.value.includes(nodeId) || controlledDrones.value.includes(String(nodeId))) {
          startInterferenceTimer(nodeId);
        }
      } else if (status !== 'RUNTIME' && oldStatus === 'RUNTIME') {
        // 状态从 RUNTIME 变为其他：停止定时器
        stopInterferenceTimer(nodeId);
      }
    });
  }
);

watch(() => isSimulationRunning.value, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {

    // 停止所有干扰节点的干扰
    await stopAllInterference();

    // 停止所有节点控制
    if (controlledDrones.value.length > 0) {
      stopAllControl();
    }
  } else if (oldVal === false && newVal === true) {
  }
});

onMounted(() => {
  fetchAvailableDrones();

  (eventBus as any).on('wsConnectionStateChange', (connected: boolean) => {
    if (connected) {
    } else {
    }
  });
});


onUnmounted(() => {
  (eventBus as any).off('wsConnectionStateChange');

  // 清理所有干扰定时器
  interferenceTimers.value.forEach((timer, nodeId) => {
    clearInterval(timer);
  });
  interferenceTimers.value.clear();
});
</script>

<style scoped>
.drone-control-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  width: 450px;
  background: linear-gradient(90deg, rgba(10, 21, 54, 0.9) 0%, rgba(16, 42, 92, 0.9) 100%);
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 0 24px #1e90ff44, 0 0 0 1.5px #1e90ff33 inset;
  border: 1.5px solid #1e90ff55;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
  color: #b6eaff;
  font-family: "Orbitron", "Arial", sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid #1e90ff33;
  padding-bottom: 8px;
}

.panel-header h3 {
  margin: 0;
  color: #4dd0ff;
  font-size: 18px;
  font-weight: normal;
  text-shadow: 0 0 8px #00eaff;
  letter-spacing: 1px;
}

.panel-btns {
  display: flex;
  gap: 8px;
}

.btn-row {
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.btn-row .el-button {
  flex: 1;
  min-width: 0;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  margin-top: 4px;
  margin-bottom: 8px;
  color: #4dd0ff;
  font-weight: normal;
  font-size: 15px;
  border-bottom: 1px solid #1e90ff33;
  padding-bottom: 4px;
  text-shadow: 0 0 8px #00eaff;
}

.drone-list-section {
  margin-bottom: 8px;
}

.drone-card {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
}

.drone-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.drone-name {
  font-weight: normal;
  font-size: 14px;
  color: #b6eaff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-type-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  background: rgba(211, 47, 47, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(211, 47, 47, 0.4);
}

.node-type-badge.drone-badge {
  background: rgba(33, 150, 243, 0.2);
  color: #64b5f6;
  border: 1px solid rgba(33, 150, 243, 0.4);
}

.drone-status {
  font-size: 12px;
  color: #8ab4ff;
}

.drone-status.controlled {
  color: #67c23a;
  text-shadow: 0 0 8px rgba(103, 194, 58, 0.5);
}

.no-drones {
  text-align: center;
  padding: 16px;
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  color: #b6eaff;
  border: 1px solid #00eaff22;
}

.hint {
  font-size: 0.9em;
  color: #8ab4ff;
  margin-top: 5px;
}

.control-section {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
}

.speed-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.speed-item {
  width: 100%;
}

.speed-label {
  font-size: 13px;
  margin-bottom: 8px;
  color: #b6eaff;
}

.instruction-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 4px;
}

.instruction-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.instruction-key {
  display: flex;
  justify-content: center;
}

.key {
  width: 32px;
  height: 32px;
  background: rgba(0, 40, 80, 0.5);
  border: 1px solid rgba(0, 198, 255, 0.4);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00c6ff;
  font-family: "Consolas", monospace;
  font-size: 14px;
  box-shadow: 0 2px 0 rgba(0, 198, 255, 0.2);
}

.instruction-text {
  color: #b6eaff;
  font-size: 12px;
  text-align: center;
}

.panel-footer {
  margin-top: 12px;
  padding: 12px 0 0;
  border-top: 1px solid #1e90ff33;
  font-size: 13px;
  color: #b6eaff;
  display: flex;
  justify-content: center;
  align-items: center;
}

.controlled-count {
  font-weight: bold;
  color: #00c6ff;
}

.speed-input {
  width: 100%;
}

:deep(.speed-input .el-input__inner) {
  color: #b6eaff;
  background: rgba(0, 40, 80, 0.6);
  border-color: #00eaff55;
  text-align: center;
}

:deep(.speed-input .el-input-number__increase),
:deep(.speed-input .el-input-number__decrease) {
  background: rgba(0, 40, 80, 0.6);
  border-color: #00eaff55;
  color: #b6eaff;
}

:deep(.speed-input .el-input-number__increase:hover),
:deep(.speed-input .el-input-number__decrease:hover) {
  background: rgba(0, 102, 204, 0.6);
  color: #4dd0ff;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  background: rgba(10, 21, 54, 0.3);
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 150, 255, 0.5);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 150, 255, 0.8);
}

:deep(.el-checkbox__label) {
  color: #b6eaff;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #00c6ff;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #00c6ff;
  border-color: #00c6ff;
}

:deep(.tech-button) {
  background: linear-gradient(180deg, #0a3677 0%, #051c3d 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button:hover) {
  background: linear-gradient(180deg, #0d4798 0%, #062752 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

:deep(.tech-button-success) {
  background: linear-gradient(180deg, #12592c 0%, #083a1c 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-success:hover) {
  background: linear-gradient(180deg, #177037 0%, #0a4622 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

:deep(.tech-button-danger) {
  background: linear-gradient(180deg, #592c12 0%, #3a1c08 100%) !important;
  border: 1.5px solid #ff4d4d55 !important;
  transition: all 0.3s;
  color: #ffb6b6 !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-danger:hover) {
  background: linear-gradient(180deg, #703717 0%, #46220a 100%) !important;
  box-shadow: 0 0 12px #ff4d4d77;
}

:deep(.tech-button-warning) {
  background: linear-gradient(180deg, #594812 0%, #3a2c08 100%) !important;
  border: 1.5px solid #ffaa0055 !important;
  transition: all 0.3s;
  color: #ffe9b6 !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-warning:hover) {
  background: linear-gradient(180deg, #705917 0%, #46370a 100%) !important;
  box-shadow: 0 0 12px #ffaa0077;
}

:deep(.el-button.is-disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}
</style> 