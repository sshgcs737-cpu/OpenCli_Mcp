<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">

        <div class="custom-dialog-header">
          <span class="custom-dialog-title">节点配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>


        <div class="custom-dialog-body">

          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner">
              <div class="spinner-circle"></div>
              <div class="spinner-text">正在创建无人机群...</div>
              <div class="spinner-progress">{{ loadingProgress }}</div>
            </div>
          </div>
          

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

            <div class="form-row" v-if="isRJ45Type">
              <div class="form-label">物理网口</div>
              <el-select
                v-model="nodeForm.name"
                placeholder="请选择ens节点名称"
                class="form-input"
                :disabled="false"
              >
                <el-option
                  v-for="option in ensOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="option.disabled"
                />
              </el-select>
            </div>

            <div class="form-row">
              <div class="form-label">节点类型</div>
              <el-input :value="getNodeTypeDisplayLabel" disabled class="form-input" />
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
              <el-input
                v-model="nodeForm.geo.alt"
                type="number"
                @input="handleAltitudeInput"
                class="form-input"
              />
            </div>
          </div>


          <div class="config-section" v-if="isVMType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">VM模板配置</span>
            </div>

            <div class="form-row">
              <div class="form-label">选择模板</div>
              <el-select
                v-model="selectedTemplateId"
                placeholder="请选择VM模板"
                class="form-input"
                :loading="vmTemplateStore.loading"
              >
                <el-option
                  v-for="option in vmTemplateStore.templateOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </div>

            <template v-if="selectedTemplate">
              <div class="form-row">
                <div class="form-label">模板描述</div>
                <el-input
                  :value="selectedTemplate.description"
                  disabled
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <div class="form-label">CPU核数</div>
                <el-input
                  :value="selectedTemplate.vcpu"
                  disabled
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <div class="form-label">内存大小</div>
                <el-input
                  :value="formatMemory(selectedTemplate.memory)"
                  disabled
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <div class="form-label">磁盘文件</div>
                <el-input
                  :value="selectedTemplate.disk"
                  disabled
                  class="form-input"
                />
              </div>
            </template>
          </div>


      <div class="config-section" v-if="isUAVType || isRouterType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">快速放置</span>
            </div>

            <div class="form-row formation-option">
              <el-checkbox v-model="formationEnabled" class="formation-checkbox">
                多节点放置
              </el-checkbox>
            </div>

            <template v-if="formationEnabled">
              <div class="form-row">
                <div class="form-label">节点数量</div>
                <el-input-number
                  v-model="formationCount"
                  :min="3"
                  :max="1000"
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <div class="form-label">编队半径(米)</div>
                <el-input-number
                  v-model="formationRadius"
                  :min="50"
                  :max="10000"
                  :step="50"
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <div class="form-label">高度差(米)</div>
                <el-input-number
                  v-model="formationHeight"
                  :min="0"
                  :max="1000"
                  :step="10"
                  @change="handleHeightDiffChange"
                  class="form-input"
                />
              </div>
            </template>
          </div>


          <div class="config-section" v-if="isUAVType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">协议配置</span>
            </div>

            <div class="form-row">
              <el-checkbox v-model="protocolConfig.enableZebra" class="form-input">
                Zebra协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="protocolConfig.enableOSPF" class="form-input">
                OSPF协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="protocolConfig.enableOLSR" class="form-input">
                OLSR协议
              </el-checkbox>
            </div>
          </div>


          <div class="config-section" v-if="isBaseStationType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">协议配置</span>
            </div>
            <div class="form-row">
              <el-checkbox v-model="baseStationProtocolConfig.enableZebra" class="form-input">
                Zebra协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="baseStationProtocolConfig.enableOSPF" class="form-input">
                OSPF协议
              </el-checkbox>
            </div>  
            
            <div class="form-row">
              <el-checkbox v-model="baseStationProtocolConfig.enableOLSR" class="form-input">
                OLSR协议
              </el-checkbox>
            </div>  
          </div>


          <!-- 路由器协议配置 - 仅在分布式场景中显示 -->
          <div class="config-section" v-if="isRouterType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">协议配置</span>
            </div>

            <div class="form-row">
              <el-checkbox v-model="routerProtocolConfig.enableZebra" class="form-input">
                Zebra协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="routerProtocolConfig.enableOSPF" class="form-input">
                OSPFv2协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="routerProtocolConfig.enableBGP" class="form-input">
                BGP协议
              </el-checkbox>
            </div>

            <div class="form-row">
              <el-checkbox v-model="routerProtocolConfig.enableRIP" class="form-input">
                RIP协议
              </el-checkbox>
            </div>
          </div>


          <div class="config-section" v-if="isTMVType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">流量终端配置</span>
            </div>

            <div class="form-row">
              <div class="form-label">设备类型</div>
              <el-radio-group v-model="tmvConfig.deviceType" class="form-input">
                <el-radio label="transmitter">发送机</el-radio>
                <el-radio label="receiver">接收机</el-radio>
              </el-radio-group>
            </div>
          </div>


          <div class="config-section" v-if="isBusinessTransmitterType">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">传输器配置</span>
            </div>

            <div class="form-row">
              <div class="form-label">设备类型</div>
              <el-radio-group v-model="businessTransmitterConfig.deviceType" class="form-input">
                <el-radio label="container">发送机</el-radio>
                <el-radio label="transferTarget">接收机</el-radio>
              </el-radio-group>
            </div>
          </div>

          <!-- SERVER配置 - 仅对无人机和路由器显示 -->
          <div class="config-section" v-if="shouldShowServerConfig">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">SERVER配置</span>
            </div>

            <div class="form-row">
              <!-- <div class="form-label">选择SERVER</div> -->
              <el-select
                v-model="selectedServer"
                placeholder="请选择SERVER"
                class="form-input"
                clearable
              >
                <el-option
                  v-for="server in serverOptions"
                  :key="server.value"
                  :label="server.label"
                  :value="server.value"
                />
              </el-select>
            </div>
          </div>
        </div>


        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose" :disabled="isLoading">取消</el-button>
          <el-button class="dialog-btn confirm-btn" type="primary" @click="handleConfirm" :loading="isLoading" :disabled="isLoading"
            >确定</el-button
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, computed, onMounted } from "vue";
import { useTopoStore } from "../../../store/modules/topo";
import { geoToENU, formatCoord } from "../../../utils/coordTransform";
import { useVMTemplateStore } from "../../../store/modules/vmTemplate";
import { useTMVTrafficStore } from "../../../store/modules/tmvTraffic";
import type { Node, GeoPosition, Server } from "../../../types/topo";
import { ElMessage } from "element-plus";
import { getTopoBySession as getTopoBySessionApi } from "../../../api/scene";
import { addVMNode } from "../../../api/node/index";
import { getUserInfo } from "../../../store/user";
import { getNodeTypeLabelCN, getNodeTypeLabelEN } from '../../../utils/nodeTypeUtils';
import { useWebSocketState } from '../../../services/websocket';

// 获取全局仿真运行状态
const { isSimulationRunning } = useWebSocketState();

// 无线节点类型（运行状态下禁止添加）
const WIRELESS_NODE_TYPES = ['DRONE', 'BASESTATION'];



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
  nodeType: {
    type: String,
    default: "DEVICE",
  },
});


const emit = defineEmits(["update:visible", "confirm", "cancel"]);


const topoStore = useTopoStore();
const vmTemplateStore = useVMTemplateStore();
const tmvTrafficStore = useTMVTrafficStore();

// 场景分布式设置
const isDistributedScene = ref(false);

// 获取场景分布式设置
const fetchSceneDistributedSetting = async () => {
  try {
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (sessionId) {
      // 尝试从 topo API 响应中获取场景信息
      const res = await getTopoBySessionApi(sessionId);
      const data = res?.data?.data ?? res?.data;
      
      // 检查响应中是否包含 disturb 信息
      if (data && typeof data === 'object') {
        if ('disturb' in data) {
          isDistributedScene.value = data.disturb === 1;
          return;
        }
      }
      
      // 如果直接获取不到，检查 topoData 中的 metadata 或 options
      const topoData = topoStore.topoData;
      if (topoData?.metadata && topoData.metadata.disturb) {
        isDistributedScene.value = topoData.metadata.disturb === '1';
      } else if (topoData?.options && topoData.options.disturb) {
        isDistributedScene.value = topoData.options.disturb === '1';
      } else {
        isDistributedScene.value = false;
      }
    }
  } catch (error) {
    console.error('获取场景分布式设置失败:', error);
    isDistributedScene.value = false;
  }
};


const isLoading = ref(false);
const loadingProgress = ref('0%');

const formationEnabled = ref(false);
const formationCount = ref(5);
const formationRadius = ref(200);
const formationHeight = ref(20);


const isUAVType = computed(() => {
  return props.nodeType === "DRONE";
});


const isBaseStationType = computed(() => {
  return props.nodeType === "BASESTATION";
});

// 判断是否为路由器节点（仅限分布式场景）
const isRouterType = computed(() => {
  return props.nodeType === "ROUTER" && isDistributedScene.value;
});


const ensOptions = computed(() => {
  const options = [
    { label: 'ens52f0', value: 'ens52f0', disabled: false },
    { label: 'ens52f1', value: 'ens52f1', disabled: false },
    { label: 'ens52f2', value: 'ens52f2', disabled: false },
    { label: 'ens52f3', value: 'ens52f3', disabled: false },

  ];
  

  const topoData = topoStore.topoData;
  if (topoData?.nodes) {
    const existingRJ45Names = topoData.nodes
      .filter((node: Node) => node.type === 'RJ45')
      .map((node: Node) => node.name);
    

    options.forEach(option => {
      if (existingRJ45Names.includes(option.value)) {
        option.disabled = true;
      }
    });
  }
  
  return options;
});


const getEffectiveTypeCode = (typeCode: string): string => {
  if ((typeCode === 'DRONE' || typeCode === 'BASESTATION') && topoStore.selectedNodeSubType) {
    return topoStore.selectedNodeSubType;
  }
  return typeCode;
};


// 动态获取节点类型标签（考虑分布式场景）
const getNodeTypeDisplayLabel = computed(() => {
  // 如果有子类型（比如机动车），优先显示子类型的中文标签
  if ((nodeForm.type === 'DRONE' || nodeForm.type === 'BASESTATION') && topoStore.selectedNodeSubType) {
    return getNodeTypeLabelCN(topoStore.selectedNodeSubType);
  }
  if (nodeForm.type === 'DEFAULT' && isDistributedScene.value) {
    return '路由器';
  }
  return getNodeTypeLabelCN(nodeForm.type);
});

const isRJ45Type = computed(() => {
  return props.nodeType === "RJ45";
});


const isVMType = computed(() => {
  return props.nodeType === "SERVER" || props.nodeType === "VMNODE";
});


const isTMVType = computed(() => {
  return props.nodeType === "TMV";
});


const isBusinessTransmitterType = computed(() => {
  return props.nodeType === "BUSINESS_Transmitter";
});

// 是否显示SERVER配置 - 仅在分布式场景中对无人机和路由器显示
const shouldShowServerConfig = computed(() => {
  return isDistributedScene.value && (isUAVType.value || props.nodeType === "ROUTER");
});

// SERVER配置
const selectedServer = ref<string>("");

// SERVER选项 - 从topo数据中的servers获取，显示名称和host
const serverOptions = computed(() => {
  const servers = topoStore.topoData?.servers || [];
  return servers.map((server: Server) => ({
    label: `${server.name} (${server.host})`,
    value: server.name
  }));
});


const selectedTemplateId = ref<number | null>(null);


const protocolConfig = reactive({
  enableZebra: true,
  enableOSPF: true,
  enableOLSR: true,
});


const baseStationProtocolConfig = reactive({
  enableOSPF: true,
  enableZebra: true,
  enableOLSR: true,
});

// 路由器协议配置（分布式场景）
const routerProtocolConfig = reactive({
  enableOSPF: true,
  enableBGP: false,
  enableRIP: false,
  enableZebra: true,
});


const tmvConfig = reactive({
  deviceType: 'transmitter' as 'transmitter' | 'receiver'
});


const businessTransmitterConfig = reactive({
  deviceType: 'container'
});


const selectedTemplate = computed(() => {
  if (!selectedTemplateId.value) return null;
  return vmTemplateStore.getTemplateById(selectedTemplateId.value);
});


const formatMemory = (memory: string): string => {
  const memoryKB = parseInt(memory);
  if (memoryKB >= 1024 * 1024) {
    return `${(memoryKB / (1024 * 1024)).toFixed(1)} GB`;
  } else if (memoryKB >= 1024) {
    return `${(memoryKB / 1024).toFixed(1)} MB`;
  } else {
    return `${memoryKB} KB`;
  }
};

watch(
  () => props.visible,
  async (val) => {
    dialogVisible.value = val;
    if (val) {

      initNodeName();


      formationEnabled.value = false;


      // 分布式场景中无人机节点默认不可用olsr服务
      protocolConfig.enableZebra = true;
      protocolConfig.enableOSPF = true;
      protocolConfig.enableOLSR = !(isDistributedScene.value && isUAVType.value);


      baseStationProtocolConfig.enableOSPF = true;
      baseStationProtocolConfig.enableZebra = true;
      baseStationProtocolConfig.enableOLSR = true;


      if (isVMType.value) {
        try {
          await vmTemplateStore.ensureTemplatesAvailable();


          if (vmTemplateStore.templates.length > 0) {
            selectedTemplateId.value = vmTemplateStore.templates[0].id;
          }
        } catch (error) {
          console.error('获取VM模板失败:', error);
          ElMessage.warning('获取VM模板失败，请稍后重试');
        }
      } else {

        selectedTemplateId.value = null;
      }


      if (isTMVType.value) {
        tmvConfig.deviceType = 'transmitter';
      }


      if (isBusinessTransmitterType.value) {
        businessTransmitterConfig.deviceType = 'container';
      }

      // 重置SERVER选择
      selectedServer.value = "";
    }
  }
);

const calculateFormationPositions = (centerPosition: GeoPosition, count: number, radius: number, heightDiff: number): GeoPosition[] => {
  const positions: GeoPosition[] = [];
  
  
  const latMetersPerDegree = 111000;
  const lonMetersPerDegree = 111000 * Math.cos(centerPosition.lat * Math.PI / 180);
  
  
  positions.push({...centerPosition});
  
  
  const angleStep = (2 * Math.PI) / (count - 1);
  
  for (let i = 0; i < count - 1; i++) {
    const angle = i * angleStep;
    
    
    const xOffset = radius * Math.cos(angle);
    const yOffset = radius * Math.sin(angle);
    
    
    const lonOffset = xOffset / lonMetersPerDegree;
    const latOffset = yOffset / latMetersPerDegree;
    
    
    const newPosition: GeoPosition = {
      lon: centerPosition.lon + lonOffset,
      lat: centerPosition.lat + latOffset,
      alt: Number(centerPosition.alt) + Number(heightDiff)
    };
    
    positions.push(newPosition);
  }
  
  return positions;
};


const dialogVisible = ref(props.visible);


const getMaxNodeNumberByType = (typeCode: string): number => {
  if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length === 0) {
    return 0;
  }
  const typeLabel = getNodeTypeLabelEN(typeCode);
  const regex = new RegExp(`^${typeLabel}(\\d+)$`);
  let maxNumber = 0;
  topoStore.topoData.nodes.forEach((node: Node) => {
    const match = node.name.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  return maxNumber;
};


const getMaxNodeAliasNumberByType = (typeCode: string): number => {
  if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length === 0) {
    return 0;
  }
  const typeLabel = getNodeTypeLabelCN(typeCode);
  const regex = new RegExp(`^${typeLabel}(\\d+)$`);
  let maxNumber = 0;
  topoStore.topoData.nodes.forEach((node: Node) => {
    const match = (node.alias || '').match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  return maxNumber;
};


const generateUniqueNodeName = (typeCode: string, index?: number): string => {

  if (typeCode === 'RJ45') {
    const topoData = topoStore.topoData;
    if (!topoData?.nodes) {
      return 'ens52f0'; 
    }

    
    const existingRJ45Names = topoData.nodes
      .filter((node: Node) => node.type === 'RJ45')
      .map((node: Node) => node.name);

    
    if (!existingRJ45Names.includes('ens52f0')) {
      return 'ens52f0';
    } else if (!existingRJ45Names.includes('ens52f1')) {
      return 'ens52f1';
    } else if (!existingRJ45Names.includes('ens52f2')) {
      return 'ens52f2';
    } else if (!existingRJ45Names.includes('ens52f3')) {
      return 'ens52f3';
    }else {
      return '';
    }
  }

  // 如果有子类型（比如机动车），使用子类型的标签
  const actualTypeCode = getEffectiveTypeCode(typeCode);
  const maxNumber = getMaxNodeNumberByType(actualTypeCode);
  const typeLabel = getNodeTypeLabelEN(actualTypeCode);


  if (index !== undefined) {
    return `${typeLabel}${maxNumber + 1}`;
  }

  return `${typeLabel}${maxNumber + 1}`;
};


const generateUniqueNodeAlias = (typeCode: string, index?: number): string => {

  if (typeCode === 'RJ45') {
    const maxNumber = getMaxNodeAliasNumberByType(typeCode);
    const typeLabel = getNodeTypeLabelCN(typeCode);
    return `${typeLabel}${maxNumber + 1}`;
  }

  // 如果有子类型（比如机动车），使用子类型的标签
  const actualTypeCode = getEffectiveTypeCode(typeCode);
  const maxNumber = getMaxNodeNumberByType(actualTypeCode);
  const typeLabel = getNodeTypeLabelCN(actualTypeCode);


  if (index !== undefined) {
    return `${typeLabel}${maxNumber + 1}`;
  }

  return `${typeLabel}${maxNumber + 1}`;
};


const nodeForm = reactive({
  name: "",
  alias: "",
  type: props.nodeType,
  geo: {
    lat: props.position.lat,
    lon: props.position.lon,
    alt: Math.max(1, Number(props.position.alt)), // 高度至少为1米
  },
  role: isNormalMode.value ? 1 : 2,
});


const initNodeName = () => {
  nodeForm.name = generateUniqueNodeName(nodeForm.type);
  nodeForm.alias = generateUniqueNodeAlias(nodeForm.type);
};


onMounted(async () => {

  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  if (sessionId) {
    const res = await getTopoBySessionApi(sessionId);

    const code = res?.data?.code;
    const data = res?.data?.data ?? res?.data;
    if (code === 200 && data) {
      (topoStore as any).setTopoData(data.id, data);
    }
  }

  // 获取场景分布式设置
  await fetchSceneDistributedSetting();
  
  tmvTrafficStore.loadTMVNodeConfigs();
});


watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val;
    if (val) {

      initNodeName();
    }
  }
);


watch(dialogVisible, async (val) => {
  emit("update:visible", val);
  
  // 当对话框打开时，更新分布式设置
  if (val) {
    await fetchSceneDistributedSetting();
  }
});


watch(
  () => props.position,
  (newPosition) => {
    if (newPosition) {

      const { lat, lon } = newPosition;
      let alt = Number(newPosition.alt);

      // 高度不能低于1米
      if (alt < 1) {
        alt = 1;
      }

      nodeForm.geo = { lat, lon, alt };
    }
  },
  { immediate: true, deep: true }
);


watch(
  () => props.nodeType,
  (newType) => {
    if (newType) {
      nodeForm.type = newType;
      nodeForm.name = generateUniqueNodeName(newType);
      nodeForm.alias = generateUniqueNodeAlias(newType);
    }
  }
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
  const maxNodeId = nodes.length >0 ? Math.max(...nodes.map((n: Node)=>n.id)): 0;
  const nodeId = maxNodeId + links.length + 1;
  
  return nodeId;
};


const handleClose = () => {
  dialogVisible.value = false;
  emit("cancel");
};


const handleConfirm = async () => {
  try {
    // 场景运行时，禁止添加无线节点
    if (isSimulationRunning.value && WIRELESS_NODE_TYPES.includes(nodeForm.type)) {
      ElMessage.warning('对无线环境进行操作请先暂停场景');
      return;
    }

    if (!nodeForm.alias.trim()) {
      ElMessage.warning("节点名称不能为空");
      return;
    }
    if (isRJ45Type.value && !nodeForm.name.trim()) {
      ElMessage.warning("物理网口不能为空");
      return;
    }

    const topoData = ensureTopoDataExists();
    if (!topoData) {
      ElMessage.error("拓扑数据初始化失败");
      return;
    }
    if (isRJ45Type.value && topoData.nodes.some((node: Node) => node.type === 'RJ45' && node.name === nodeForm.name)) {
      ElMessage.warning(`物理网口"${nodeForm.name}"已被占用，请重新选择`);
      return;
    }
    if (topoData.nodes.some((node: Node) => node.alias === nodeForm.alias)) {
      ElMessage.warning(`节点名称\"${nodeForm.alias}\"已存在，请修改后重试`);
      return;
    }
    
    
    nodeForm.geo.alt = Number(nodeForm.geo.alt);
    

    if (formationEnabled.value && (isUAVType.value || isRouterType.value)) {

      isLoading.value = true;
      loadingProgress.value = '0%';


      const positions = calculateFormationPositions(
        nodeForm.geo,
        formationCount.value,
        formationRadius.value,
        formationHeight.value
      );


      const createdNodes = [];
      const totalNodes = positions.length;

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const nodeName = i === 0 ? nodeForm.name : generateUniqueNodeName(nodeForm.type, i);
        const nodeAlias = i === 0 ? nodeForm.alias : generateUniqueNodeAlias(nodeForm.type, i);

        const nodeId = getNextNodeId();

        // 构建协议配置
        const services = [];

        // 根据节点类型配置协议
        if (isUAVType.value) {
          if (protocolConfig.enableOSPF) {
            services.push("OSPFv2");
          }
          if (protocolConfig.enableZebra) {
            services.push("zebra");
          }
          if (protocolConfig.enableOLSR) {
            services.push("olsrd");
          }
        } else if (isRouterType.value) {
          if (routerProtocolConfig.enableZebra) {
            services.push("zebra");
          }
          if (routerProtocolConfig.enableOSPF) {
            services.push("OSPFv2");
          }
          if (routerProtocolConfig.enableBGP) {
            services.push("BGP");
          }
          if (routerProtocolConfig.enableRIP) {
            services.push("RIP");
          }
        }

        // 确定节点类型和模型
        let backendNodeType = nodeForm.type;
        let backendModel = "";

        if (isUAVType.value) {
          backendNodeType = "DRONE";
          backendModel = "prouter";
        } else if (isRouterType.value) {
          backendNodeType = "DEFAULT";
          backendModel = "router";
        }

        const nodeData = {
          id: nodeId,
          name: nodeName,
          type: backendNodeType,
          model: backendModel,
          image: "",
          role: nodeForm.role,
          geo: {
            lon: position.lon,
            lat: position.lat,
            alt: Number(position.alt)
          },
          status: "UP",
          alias: nodeAlias,
          config_services: services.length > 0 ? services : null,
          server: selectedServer.value || undefined // 为批量创建的节点添加server字段
        };

        try {

          loadingProgress.value = `${Math.round(((i + 1) / totalNodes) * 100)}%`;


          const result = await (topoStore as any).addNodeRemote(nodeData);
          createdNodes.push(result.newNode);
        } catch (error) {
          console.error(`创建节点 ${nodeName} 时出错:`, error);

        }
      }


      isLoading.value = false;

      if (createdNodes.length > 0) {
        dialogVisible.value = false;
        emit("confirm", createdNodes);
        const nodeTypeText = isUAVType.value ? '无人机' : '路由器';
        ElMessage.success(`已成功创建${createdNodes.length}个${nodeTypeText}节点`);
      } else {
        ElMessage.error("创建节点失败");
      }
    } else {

      const nodeId = getNextNodeId();
      
      let backendNodeType = nodeForm.type; 
      let backendModel = "";
      let backendImage = "";

      
      switch (nodeForm.type) {
        case "SERVER":

          if (!selectedTemplateId.value) {
            ElMessage.warning("请选择VM模板");
            return;
          }
          backendNodeType = "VMNODE";
          backendImage = "/home/feuille/vm-template/cirros.xml";
          break;
        case "DRONE":
          backendNodeType = "DRONE"; 
          backendModel = "prouter";
          break;
        case "BASESTATION":
          backendNodeType = "BASESTATION";
          backendModel = "prouter";
          break;
        case "ROUTER":
          if (isDistributedScene.value) {
            backendModel = 'router';
            backendNodeType = 'DEFAULT';
          } else {
            backendNodeType = "DOCKER";
            backendImage = "nest:v3";
          }
          break;
        case "BUSINESS_Transmitter":
          backendNodeType = "DOCKER";
          backendImage = "data:v1";
          break;
        case "SWITCH":
          backendNodeType = "SWITCH"; 
          break;

        case "HTTP":
          backendNodeType = "DOCKER";
          backendImage = "http:v1";
          break;
        case "FTP":
          backendNodeType = "DOCKER";
          backendImage = "ftp:v1";
          break;
        case "DNS":
          backendNodeType = "DOCKER";
          backendImage = "dns:v1";
          break;
        case "SMTP":
          backendNodeType = "DOCKER";
          backendImage = "smtp:v1";
          break;
        case "VoIP-SIP":
          backendNodeType = "DOCKER";
          backendImage = "voip:v1";
          break;
        case "TLS":
          backendNodeType = "DOCKER";
          backendImage = "tls:v1";
          break;
        case "RTSP-RTP":
          backendNodeType = "DOCKER";
          backendImage = "rtsp:v1";
          break;
        case "MQTT":
          backendNodeType = "DOCKER";
          backendImage = "mqtt:v1";
          break;
        case "CoAP":
          backendNodeType = "DOCKER";
          backendImage = "coap:v1";
          break;
        case "DDS":
          backendNodeType = "DOCKER";
          backendImage = "dds:v1";
          break;
        case "SSH":
          backendNodeType = "DOCKER";
          backendImage = "ssh:v1";
          break;
        case "PKI":
          backendNodeType = "DOCKER";
          backendImage = "pki:v1";
          break;
        case "RJ45":

          backendNodeType = "RJ45";
          backendModel = "";
          backendImage = "";
          break;
        case "TMV":

          backendNodeType = "DOCKER";
          backendImage = "tmv:v1";
          break;
        case "ATTACK_MACHINE":

          backendNodeType = "DOCKER";
          backendImage = "attack:v2.3";
          break;
        case "SECURITY_MACHINE":

          backendNodeType = "DOCKER";
          backendImage = "attack:v2.3";
          break;
        case "SDN_CONTROLLER":

          backendNodeType = "DOCKER";
          backendImage = "sdn:v1.1";
          break;
        case "Ovs_SWITCH":
          // OpenVSwitch交换机
          backendNodeType = "DOCKER";
          backendImage = "sdn:v1.1";
          break;
        case "P4_SWITCH":
          // P4交换机
          backendNodeType = "DOCKER";
          backendImage = "p4lang/bm-4c:v1.0";
          break;
        case "SR_SWITCH":
          // SR交换机
          backendNodeType = "DOCKER";
          backendImage = "sdn:v1.3";
          break;

        default:

          console.warn(`Unhandled node type: ${nodeForm.type}, using as backend type.`);
          backendNodeType = nodeForm.type; 
          break;
      }

      
      const nodeData: any = {
        id: nodeId,
        name: nodeForm.name,
        type: backendNodeType,
        model: backendModel,
        image: backendImage,
        geo: {
          lon: nodeForm.geo.lon,
          lat: nodeForm.geo.lat,
          alt: Number(nodeForm.geo.alt) 
        },
        role: nodeForm.role,
        status: "UP",
        alias: nodeForm.alias 
      };

      // 添加SERVER配置 - 仅对无人机和路由器
      if (shouldShowServerConfig.value && selectedServer.value) {
        nodeData.server = selectedServer.value;
      }


      if (isUAVType.value) {
        const services = [];
        if (protocolConfig.enableOSPF) {
          services.push("OSPFv2");
        }
        if (protocolConfig.enableZebra) {
          services.push("zebra");
        }
        if (protocolConfig.enableOLSR) {
          services.push("olsrd");
        }
        if (services.length > 0) {
          nodeData.config_services = services;
        }
      }


      if (isBaseStationType.value) {
        const services = [];
        if (baseStationProtocolConfig.enableOSPF) {
          services.push("OSPFv2");
        }
        if (baseStationProtocolConfig.enableZebra) {
          services.push("zebra");
        }
        if (baseStationProtocolConfig.enableOLSR) {
          services.push("olsrd");
        }
        if (services.length > 0) {
          nodeData.config_services = services;
        }
      }

      // 路由器协议配置（分布式场景）
      if (isRouterType.value) {
        const services = [];
        if (routerProtocolConfig.enableZebra) {
          services.push("zebra");
        }
        if (routerProtocolConfig.enableOSPF) {
          services.push("OSPFv2");
        }
        if (routerProtocolConfig.enableBGP) {
          services.push("BGP");
        }
        if (routerProtocolConfig.enableRIP) {
          services.push("RIP");
        }
        if (services.length > 0) {
          nodeData.config_services = services;
        }
      }
      
      
      if (isVMType.value && selectedTemplateId.value && selectedTemplate.value) {
        const template = selectedTemplate.value;

        
        nodeData.templateId = selectedTemplateId.value;
        nodeData.templateName = template.name;
        nodeData.vcpu = template.vcpu;
        nodeData.memory = template.memory;
        nodeData.curMemory = template.curMemory;
        nodeData.disk = template.disk;
        nodeData.location = template.location;

        
        if (template.location) {
          nodeData.image = template.location;
        }

      }

      
      if (isTMVType.value) {
        nodeData.tmvConfig = {
          deviceType: tmvConfig.deviceType
        };

        
        const storageKey = `tmvConfig_${nodeId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          nodeId: nodeId,
          deviceType: tmvConfig.deviceType,
          nodeName: nodeForm.alias
        }));

      }

      
      if (isBusinessTransmitterType.value) {
        nodeData.businessTransmitterConfig = {
          deviceType: businessTransmitterConfig.deviceType
        };
        
        
        const storageKey = `businessTransmitterConfig_${nodeId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          nodeId: nodeId,
          deviceType: businessTransmitterConfig.deviceType,
          nodeName: nodeForm.alias
        }));
        
      }

      
      if (isVMType.value && selectedTemplateId.value) {

        const vmNodeData = {
          templateId: selectedTemplateId.value,
          node: nodeData
        };

        
        const sessionId = topoStore.topoData?.id;
        if (!sessionId) {
          ElMessage.error("会话信息不完整，无法创建节点");
          return;
        }

        
        const userInfo = getUserInfo();
        const userId = userInfo.id;

        
        const response = await addVMNode(vmNodeData, sessionId, userId);

        if (response && response.data) {
          
          const updatedTopoData = { ...response.data };

          
          if (updatedTopoData.nodes) {
            const createdNode = updatedTopoData.nodes.find((n: any) => n.id === nodeId);
            if (createdNode && selectedTemplateId.value) {
              
              const selectedTemplate = vmTemplateStore.getTemplateById(selectedTemplateId.value);
              if (selectedTemplate) {
                
                createdNode.templateId = selectedTemplateId.value;
                createdNode.templateName = selectedTemplate.name;
                createdNode.vcpu = selectedTemplate.vcpu;
                createdNode.memory = selectedTemplate.memory;
                createdNode.curMemory = selectedTemplate.curMemory;
                createdNode.disk = selectedTemplate.disk;
                createdNode.location = selectedTemplate.location;
              }
            }
          }

          (topoStore as any).setTopoData(updatedTopoData.id, updatedTopoData);
        }
        dialogVisible.value = false;
        emit("confirm", nodeData);

        

        ElMessage.success(`VM节点 ${nodeForm.alias} 创建成功`);
      } else {

        await (topoStore as any).addNodeRemote(nodeData);
        dialogVisible.value = false;
        emit("confirm", nodeData);

        

        ElMessage.success(`节点 ${nodeForm.alias} 创建成功`);
      }
    }
  } catch (error: any) {

    isLoading.value = false;
    console.error("创建节点时出错:", error);
    ElMessage.error(error?.message || "创建节点失败，请重试");
  }
};


const handleAltitudeInput = (value: string | number) => {
  let altValue = Number(value);

  // 高度不能低于0米
  if (altValue < 0) {
    altValue = 0;
  }

  nodeForm.geo.alt = altValue;
};


const handleHeightDiffChange = (value: number) => {

  formationHeight.value = Number(value);
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
}

/* 对话框容器 */
.custom-dialog {
  width: 460px;
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
  padding: 20px 24px;
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

/* 对话框内容区 */
.custom-dialog-body {
  padding: 24px;
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
  padding: 16px 24px 24px;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

/* 表单样式 */
.config-section {
  margin-bottom: 28px;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 16px;
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
  margin-bottom: 16px;
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #0cc4cc, #00a8ff);
  margin-right: 10px;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(12, 196, 204, 0.3);
}

.section-title {
  font-size: 14px;
  color: #0cc4cc;
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
  color: #a0aec0;
  font-size: 13px;
  font-weight: 500;
}

.form-input {
  flex: 1;
}

/* 按钮样式 */
.dialog-btn {
  min-width: 90px;
  height: 36px;
  font-size: 14px;
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
  margin-right: 12px;
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
  height: 36px;
  font-size: 13px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.3) !important;
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.05);
}

/* Select组件样式 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-select .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

:deep(.el-select .el-input__wrapper:hover) {
  border-color: rgba(12, 196, 204, 0.3);
}

:deep(.el-select .el-input__wrapper.is-focus) {
  border-color: #0cc4cc;
  box-shadow: 0 0 0 1px rgba(12, 196, 204, 0.2) !important;
}

:deep(.el-select .el-input__inner) {
  color: #fff;
}

:deep(.el-select-dropdown) {
  background: rgba(30, 39, 54, 0.95);
  border: 1px solid rgba(12, 196, 204, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

:deep(.el-select-dropdown__item) {
  color: #a0aec0;
  background: transparent;
}

:deep(.el-select-dropdown__item:hover) {
  background: rgba(12, 196, 204, 0.1);
  color: #0cc4cc;
}

:deep(.el-select-dropdown__item.selected) {
  background: rgba(12, 196, 204, 0.2);
  color: #0cc4cc;
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
  color: #a0aec0;
}

:deep(.el-radio.is-checked) {
  color: #0cc4cc;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #0cc4cc;
  border-color: #0cc4cc;
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #0cc4cc;
}

:deep(.el-radio__inner:hover) {
  border-color: #0cc4cc;
}

/* Loading 样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(30, 39, 54, 0.9);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
  backdrop-filter: blur(3px);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid rgba(12, 196, 204, 0.1);
  border-top-color: #0cc4cc;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

.spinner-text {
  color: #0cc4cc;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.spinner-progress {
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(12, 196, 204, 0.5);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
