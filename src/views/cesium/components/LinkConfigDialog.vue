<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">链路配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <div class="row">
            <div class="config-section">
              <div class="section-title-block">
                <div class="title-indicator"></div>
                <span class="section-title">源节点信息</span>
              </div>
              <div class="form-row">
                <div class="form-label">节点名称</div>
                <el-input v-model="sourceNodeName" disabled class="form-input" />
              </div>
              <div class="form-row">
                <div class="form-label">节点类型</div>
                <el-input :value="getNodeTypeDisplay(props.sourceNode)" disabled class="form-input" />
              </div>
              
              <div v-if="isSourceEmane" class="form-row">
                <div class="form-info">{{ getNoInterfaceConfigMessage(props.sourceNode) }}</div>
              </div>
              
              <div v-else>
                <div class="form-row">
                  <div class="form-label">接口ID</div>
                  <el-input v-model="sourceIfaceId" type="number" class="form-input" />
                </div>
                <div class="form-row">
                  <div class="form-label">接口名称</div>
                  <el-input v-model="sourceIfaceName" placeholder="eth0" class="form-input" />
                </div>
                <div class="form-row">
                  <div class="form-label">MAC地址</div>
                  <el-input v-model="sourceIfaceMac" placeholder="00:00:00:00:00:01" class="form-input" />
                </div>
                <template v-if="!isSourceOvsSwitch && !isSourceSwitch && !isSourceRJ45 && !isSourceSRSwitch && !isSourceVM">
                  <div class="form-row">
                    <div class="form-label">IPv4地址</div>
                    <el-input v-model="sourceIfaceIp" placeholder="10.0.0.1" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IP掩码</div>
                    <el-input v-model="sourceIfaceMask" type="number" placeholder="24" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IPv6地址</div>
                    <el-input v-model="sourceIfaceIp6" placeholder="2001:db8::1" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IPv6掩码</div>
                    <el-input v-model="sourceIfaceIp6Mask" type="number" placeholder="64" class="form-input" />
                  </div>
                </template>
              </div>
            </div>
            
            <div class="config-section">
              <div class="section-title-block">
                <div class="title-indicator"></div>
                <span class="section-title">目标节点信息</span>
              </div>
              <div class="form-row">
                <div class="form-label">节点名称</div>
                <el-input v-model="targetNodeName" disabled class="form-input" />
              </div>
              <div class="form-row">
                <div class="form-label">节点类型</div>
                <el-input :value="getNodeTypeDisplay(props.targetNode)" disabled class="form-input" />
              </div>
              
              <div v-if="isTargetEmane" class="form-row">
                <div class="form-info">{{ getNoInterfaceConfigMessage(props.targetNode) }}</div>
              </div>
              
              <div v-else>
                <div class="form-row">
                  <div class="form-label">接口ID</div>
                  <el-input v-model="targetIfaceId" type="number" class="form-input" />
                </div>
                <div class="form-row">
                  <div class="form-label">接口名称</div>
                  <el-input v-model="targetIfaceName" placeholder="eth0" class="form-input" />
                </div>
                <div class="form-row">
                  <div class="form-label">MAC地址</div>
                  <el-input v-model="targetIfaceMac" placeholder="00:00:00:00:00:02" class="form-input" />
                </div>
                <template v-if="!isTargetOvsSwitch && !isTargetSwitch && !isTargetRJ45 && !isTargetSRSwitch && !isTargetVM">
                  <div class="form-row">
                    <div class="form-label">IPv4地址</div>
                    <el-input v-model="targetIfaceIp" placeholder="10.0.0.2" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IP掩码</div>
                    <el-input v-model="targetIfaceMask" type="number" placeholder="24" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IPv6地址</div>
                    <el-input v-model="targetIfaceIp6" placeholder="2001:db8::2" class="form-input" />
                  </div>
                  <div class="form-row">
                    <div class="form-label">IPv6掩码</div>
                    <el-input v-model="targetIfaceIp6Mask" type="number" placeholder="64" class="form-input" />
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="config-section" v-if ="!isSourceEmane && !isTargetEmane">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">链路配置</span>
            </div>
            <div class="form-row">
              <div class="form-label">带宽</div>
              <el-input 
                v-model.number="bandwidth" 
                type="number" 
                placeholder="1000" 
                class="form-input">
                <template #append>bps</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">延迟</div>
              <el-input 
                v-model.number="delay" 
                type="number" 
                placeholder="10" 
                class="form-input">
                <template #append>ms</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">丢包率</div>
              <el-input 
                v-model.number="loss" 
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
                v-model.number="jitter" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>ms</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">缓冲区</div>
              <el-input 
                v-model.number="buffer" 
                type="number" 
                placeholder="1024" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">重复</div>
              <el-input 
                v-model.number="dup" 
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
                v-model.number="burst" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">最大突发</div>
              <el-input 
                v-model.number="mburst" 
                type="number" 
                placeholder="0" 
                class="form-input">
                <template #append>KB</template>
              </el-input>
            </div>
            <div class="form-row">
              <div class="form-label">单向链路</div>
              <el-switch v-model="unidirectional" class="form-input" />
            </div>
          </div>
        </div>

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
import { useTMVTrafficStore } from '../../../store/modules/tmvTraffic';
import { ElMessage } from 'element-plus';
import type { Link, NodeIface, LinkOptions, Node } from '../../../types/topo';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  sourceNode: {
    type: Object,
    default: null
  },
  targetNode: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const topoStore = useTopoStore();
const tmvTrafficStore = useTMVTrafficStore();

const dialogVisible = ref(props.visible);

const sourceNodeName = computed(() => props.sourceNode?.alias || props.sourceNode?.name || '');
const targetNodeName = computed(() => props.targetNode?.alias || props.targetNode?.name || '');

const hasNodePrefix = (node: any, prefixes: string[]): boolean => {
  const candidateValues = [node?.name, node?.alias];
  return candidateValues.some((value) =>
    typeof value === 'string' && prefixes.some((prefix) => value.startsWith(prefix))
  );
};

const getNodeSubTypeDisplay = (node: any): string | null => {
  if (hasNodePrefix(node, ['SATELLITE', '卫星'])) return '卫星节点';
  if (hasNodePrefix(node, ['VAN', '机动车'])) return '机动车节点';
  return null;
};

const isEmaneNode = (node: any): boolean => {
  return node?.type === 'EMANE';
};

const isSwitchNode = (node: any): boolean => {
  return node?.type === 'SWITCH';
};

const isRJ45Node = (node: any): boolean => {
  return node?.type === 'RJ45' || node?.name === 'ens52f0' || node?.name === 'ens52f1'|| node?.name === 'ens52f2'|| node?.name === 'ens52f3'
};

const isOvsSwitchNode = (node: any): boolean => {
  return node?.type === 'Ovs_SWITCH' || node?.name?.includes('Ovs_SWITCH') || node?.alias?.includes('Ovs_Switch');
};

const isSRSwitchNode = (node: any): boolean => {
  return node?.name?.includes('SR_SWITCH') ;
};
const isDroneNode = (node: any): boolean => {
  return node?.type === 'DRONE';
};

const isBaseStationNode = (node: any): boolean => {
  return node?.type === 'BASESTATION';
};

const isTMVNode = (node: any): boolean => {
  return node?.image === 'tmv:v1';
};

const isVMNode = (node: any): boolean => {
  return node?.type === 'VMNODE';
};
const isSourceEmane = computed(() => isEmaneNode(props.sourceNode));
const isTargetEmane = computed(() => isEmaneNode(props.targetNode));

const isSourceOvsSwitch = computed(() => isOvsSwitchNode(props.sourceNode));
const isTargetOvsSwitch = computed(() => isOvsSwitchNode(props.targetNode));

const isSourceSRSwitch = computed(() => isSRSwitchNode(props.sourceNode));
const isTargetSRSwitch = computed(() => isSRSwitchNode(props.targetNode));

const isSourceSwitch = computed(() => isSwitchNode(props.sourceNode));
const isTargetSwitch = computed(() => isSwitchNode(props.targetNode));

const isSourceRJ45 = computed(() => isRJ45Node(props.sourceNode));
const isTargetRJ45 = computed(() => isRJ45Node(props.targetNode));

const isSourceDrone = computed(() => isDroneNode(props.sourceNode));
const isTargetDrone = computed(() => isDroneNode(props.targetNode));

const isSourceBaseStation = computed(() => isBaseStationNode(props.sourceNode));
const isTargetBaseStation = computed(() => isBaseStationNode(props.targetNode));

const isSourceTMV = computed(() => isTMVNode(props.sourceNode));
const isTargetTMV = computed(() => isTMVNode(props.targetNode));

const isSourceVM = computed(() => isVMNode(props.sourceNode));
const isTargetVM = computed(() => isVMNode(props.targetNode));

const isTMVLink = computed(() => isSourceTMV.value && isTargetTMV.value);

const getNodeTypeDisplay = (node: any): string => {
  if (!node) return '未知节点';
  const nodeSubTypeDisplay = getNodeSubTypeDisplay(node);
  
  if (isEmaneNode(node)) return 'EMANE节点';
  if (isRJ45Node(node)) return '半实物节点';
  if (isOvsSwitchNode(node)) return 'OVS交换机';
  if (isSwitchNode(node)) return '普通交换机';
  if (nodeSubTypeDisplay) return nodeSubTypeDisplay;
  if (isDroneNode(node)) return '无人机节点';
  if (isBaseStationNode(node)) return '基站节点';
  if (isTMVNode(node)) return '流量终端';
  
  return '普通节点';
};

const getNoInterfaceConfigMessage = (node: any): string => {
  if (!node) return '';
  
  if (isEmaneNode(node)) return 'EMANE节点无需配置接口';
  
  return '该节点无需配置接口';
};

const determineLinkType = (): string => {
  return 'WIRED';
};

// 创建用于接口字段的计算属性
// 源节点接口ID
const sourceIfaceId = computed({
  get: () => linkForm.iface1?.id || 0,
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.id = value;
    }
  }
});

// 源节点接口名称
const sourceIfaceName = computed({
  get: () => linkForm.iface1?.name || '',
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.name = value;
    }
  }
});

// 源节点MAC地址
const sourceIfaceMac = computed({
  get: () => linkForm.iface1?.mac || '',
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.mac = value;
    }
  }
});

// 源节点IP地址
const sourceIfaceIp = computed({
  get: () => linkForm.iface1?.ip4 || '',
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.ip4 = value;
    }
  }
});

const sourceIfaceMask = computed({
  get: () => linkForm.iface1?.ip4_mask || 24,
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.ip4_mask = value;
    }
  }
});

const sourceIfaceIp6 = computed({
  get: () => linkForm.iface1?.ip6 || '',
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.ip6 = value;
    }
  }
});

const sourceIfaceIp6Mask = computed({
  get: () => linkForm.iface1?.ip6_mask || 64,
  set: (value) => {
    if (linkForm.iface1) {
      linkForm.iface1.ip6_mask = value;
    }
  }
});

const targetIfaceId = computed({
  get: () => linkForm.iface2?.id || 0,
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.id = value;
    }
  }
});

const targetIfaceName = computed({
  get: () => linkForm.iface2?.name || '',
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.name = value;
    }
  }
});

// 目标节点MAC地址
const targetIfaceMac = computed({
  get: () => linkForm.iface2?.mac || '',
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.mac = value;
    }
  }
});

const targetIfaceIp = computed({
  get: () => linkForm.iface2?.ip4 || '',
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.ip4 = value;
    }
  }
});

const targetIfaceMask = computed({
  get: () => linkForm.iface2?.ip4_mask || 24,
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.ip4_mask = value;
    }
  }
});

const targetIfaceIp6 = computed({
  get: () => linkForm.iface2?.ip6 || '',
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.ip6 = value;
    }
  }
});

const targetIfaceIp6Mask = computed({
  get: () => linkForm.iface2?.ip6_mask || 64,
  set: (value) => {
    if (linkForm.iface2) {
      linkForm.iface2.ip6_mask = value;
    }
  }
});

// 生成基于节点ID的MAC地址
const generateMacAddress = (nodeId: number): string => {
  // 确保节点ID在有效范围内（0-281474976710655，即48位最大值）
  const safeNodeId = Math.abs(nodeId) & 0xFFFFFFFFFFFF;
  
  // 将节点ID转换为48位16进制（6字节）
  const hex = safeNodeId.toString(16).padStart(12, '0');
  
  // 分割为6个字节并用冒号连接
  const bytes = hex.match(/.{2}/g);
  
  if (bytes && bytes.length === 6) {
    return bytes.join(':');
  }
  
  // 备用方案：使用最后6位数字
  const fallbackHex = (safeNodeId % 0xFFFFFFFFFFFF).toString(16).padStart(12, '0');
  return fallbackHex.match(/.{2}/g)?.join(':') || '00:00:00:00:00:01';
};

const createDefaultIface = (nodeId: number, id: number, nodeType?: string): NodeIface => {
  // 对于普通链路配置，所有节点都不自动分配MAC地址，需要用户手动输入
  return {
    id,
    name: `eth${id}`,
    mac: '', // 普通链路不自动分配MAC地址
    ip4: '',
    ip4_mask: 24,
    ip6: '',
    ip6_mask: 64,
    netId: 0,
    flowId: 0,
    mtu: 0,
    node_id: nodeId,
    net2_id: 0
  };
};

// 创建默认的链路选项
const createDefaultLinkOptions = (): LinkOptions => {
  return {
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
    mtu: 0
  };
};

const linkForm = reactive<Partial<Link>>({
  type: 'WIRED',
  node1_id: 0,
  node2_id: 0,
  iface1: createDefaultIface(0, 0, ''),
  iface2: createDefaultIface(0, 0, ''),
  options: createDefaultLinkOptions(),
  network_id: 0
});

const bandwidth = computed({
  get: () => linkForm.options?.bandwidth || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.bandwidth = value;
    }
  }
});

const delay = computed({
  get: () => linkForm.options?.delay || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.delay = value;
    }
  }
});

const loss = computed({
  get: () => linkForm.options?.loss || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.loss = value;
    }
  }
});

const jitter = computed({
  get: () => linkForm.options?.jitter || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.jitter = value;
    }
  }
});

const buffer = computed({
  get: () => linkForm.options?.buffer || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.buffer = value;
    }
  }
});

const dup = computed({
  get: () => linkForm.options?.dup || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.dup = value;
    }
  }
});

const burst = computed({
  get: () => linkForm.options?.burst || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.burst = value;
    }
  }
});

const mburst = computed({
  get: () => linkForm.options?.mburst || 0,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.mburst = value;
    }
  }
});

const unidirectional = computed({
  get: () => linkForm.options?.unidirectional || false,
  set: (value) => {
    if (linkForm.options) {
      linkForm.options.unidirectional = value;
    }
  }
});

const getEmaneNodeIndex = (emaneNodeId: number): number => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) return 0;
  
  // @ts-ignore: 忽略类型检查，这里nodes应该是Node[]类型
  const emaneNodes = topoStore.topoData.nodes.filter(node => node.type === 'EMANE');
  // @ts-ignore: 忽略类型检查，这里node应该是Node类型  
  const index = emaneNodes.findIndex(node => node.id === emaneNodeId);
  return index !== -1 ? index : 0;
};

const getBaseStationOtherNodesConnectionCount = (baseStationNodeId: number): number => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.links) || !Array.isArray(topoStore.topoData.nodes)) {
    return 0;
  }

  // 获取该基站节点的所有连接
  const links = topoStore.topoData.links.filter((link: Link) => 
    link.node1_id === baseStationNodeId || link.node2_id === baseStationNodeId
  );

  // 计算连接的非EMANE、非无人机节点数量
  let count = 0;
  for (const link of links) {
    const otherNodeId = link.node1_id === baseStationNodeId ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData.nodes.find((node: Node) => node.id === otherNodeId);
    
    if (otherNode && otherNode.type !== 'EMANE' && otherNode.type !== 'DRONE') {
      count++;
    }
  }

  return count;
};

const assignIpAddresses = () => {
  // 检查是否有EMANE节点参与连接
  if (isSourceEmane.value || isTargetEmane.value) {
    const emaneNode = isSourceEmane.value ? props.sourceNode : props.targetNode;
    const otherNode = isSourceEmane.value ? props.targetNode : props.sourceNode;
    const emaneNodeIndex = getEmaneNodeIndex(emaneNode!.id);
    
    // EMANE节点没有接口需要配置IP
    // 只配置连接到EMANE的普通节点IP（如果不是OVS交换机）
    // 根据EMANE节点索引动态生成IP前缀：10.0.0, 20.0.0, 30.0.0...
    const baseIp = `${(emaneNodeIndex + 1) * 10}.0.0`;
    
    // 获取当前EMANE的连接数，用于分配下一个可用IP
    let nodeCount = 0;
    if (topoStore.topoData && Array.isArray(topoStore.topoData.links)) {
      nodeCount = topoStore.topoData.links.filter((link: Link) => 
        (link.node1_id === emaneNode!.id || link.node2_id === emaneNode!.id)
      ).length;
    }
    
    // 分配给普通节点的IP（如果不是OVS交换机）
    const ipLast = nodeCount + 1; // 从1开始递增
    const nodeIp = `${baseIp}.${ipLast}`;
    
    // 设置IP到相应的接口
    if (isSourceEmane.value && linkForm.iface2) {
      linkForm.iface2.ip4 = nodeIp;
    } else if (isTargetEmane.value && linkForm.iface1) {
      linkForm.iface1.ip4 = nodeIp;
    }
  }
  // 检查是否基站连接到普通节点 
  else if ((isSourceBaseStation.value && !isTargetDrone.value && !isTargetEmane.value) || 
           (isTargetBaseStation.value && !isSourceDrone.value && !isSourceEmane.value)) {
    const baseStationNode = isSourceBaseStation.value ? props.sourceNode : props.targetNode;
    const otherNode = isSourceBaseStation.value ? props.targetNode : props.sourceNode;
    
    // 获取该基站连接的普通节点数量
    const connectionCount = getBaseStationOtherNodesConnectionCount(baseStationNode!.id);
    
    // 设置连接ID，从1开始递增
    const connectionId = connectionCount + 1;
    const baseIp = `10.0.${connectionId}`;
    
    // 配置IP地址
    if (isSourceBaseStation.value) {
      if (linkForm.iface1) linkForm.iface1.ip4 = `${baseIp}.1`;
      if (linkForm.iface2) linkForm.iface2.ip4 = `${baseIp}.2`;
    } else {
      if (linkForm.iface1) linkForm.iface1.ip4 = `${baseIp}.2`;
      if (linkForm.iface2) linkForm.iface2.ip4 = `${baseIp}.1`;
    }
  }
  // 普通节点之间的连接（包括OVS交换机）
  else {
    // 对于其他节点的连接，使用默认IP分配方案
    if (linkForm.iface1) linkForm.iface1.ip4 = `10.0.0.1`;
    if (linkForm.iface2) linkForm.iface2.ip4 = `10.0.0.2`;
  }
};

watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  
  if (newVal && props.sourceNode && props.targetNode) {
    // 初始化TMV节点配置
    tmvTrafficStore.loadTMVNodeConfigs();
    
    // 初始化表单数据
    linkForm.node1_id = props.sourceNode.id;
    linkForm.node2_id = props.targetNode.id;
    
    // 创建接口，普通链路不自动分配MAC地址
    linkForm.iface1 = createDefaultIface(props.sourceNode.id, 1, props.sourceNode.type);
    linkForm.iface2 = createDefaultIface(props.targetNode.id, 2, props.targetNode.type);
    
    // 根据节点类型设置链路类型
    linkForm.type = determineLinkType();
    
    // 检查是否是EMANE节点，如果是则将接口设置为undefined
    if (isSourceEmane.value) {
      linkForm.iface1 = undefined;
    } else {
      // 更新接口节点ID
      linkForm.iface1 = createDefaultIface(props.sourceNode.id, 0, props.sourceNode.type);
      
      // 查找源节点已使用的接口ID和名称
      const sourceNodeInterfaces = getNodeInterfaces(topoStore.topoData?.links || [], props.sourceNode.id);
      const sourceIfaceId = getNextAvailableId(sourceNodeInterfaces);
      const sourceIfaceName = `eth${sourceIfaceId}`;
      
      // 设置不重复的接口ID和名称
      if (linkForm.iface1) {
        linkForm.iface1.id = sourceIfaceId;
        linkForm.iface1.name = sourceIfaceName;
        
        // 如果是OVS交换机或普通交换机，设置默认掩码值避免验证问题
        if (isSourceOvsSwitch.value || isSourceSwitch.value) {
          linkForm.iface1.ip4_mask = 24;
          linkForm.iface1.ip6_mask = 64;
        }
      }
    }
    
    if (isTargetEmane.value) {
      linkForm.iface2 = undefined;
    } else {
      // 更新接口节点ID
      linkForm.iface2 = createDefaultIface(props.targetNode.id, 0, props.targetNode.type);
      
      // 查找目标节点已使用的接口ID和名称
      const targetNodeInterfaces = getNodeInterfaces(topoStore.topoData?.links || [], props.targetNode.id);
      const targetIfaceId = getNextAvailableId(targetNodeInterfaces);
      const targetIfaceName = `eth${targetIfaceId}`;
      
      // 设置不重复的接口ID和名称
      if (linkForm.iface2) {
        linkForm.iface2.id = targetIfaceId;
        linkForm.iface2.name = targetIfaceName;
        
        // 如果是OVS交换机或普通交换机，设置默认掩码值避免验证问题
        if (isTargetOvsSwitch.value || isTargetSwitch.value) {
          linkForm.iface2.ip4_mask = 24;
          linkForm.iface2.ip6_mask = 64;
        }
      }
    }

    // 设置链路参数的默认值
    if (linkForm.options) {
      linkForm.options.bandwidth = 0;  
      linkForm.options.delay = 0;
      linkForm.options.jitter = 0;
      linkForm.options.loss = 0;
      linkForm.options.mtu = 0;    
      linkForm.options.buffer = 0;    
      linkForm.options.unidirectional = true;
    }
    
        assignIpAddresses();
  }
});

watch(dialogVisible, (val) => {
  emit('update:visible', val);
});

const handleClose = () => {
  dialogVisible.value = false;
  emit('cancel');
};

const isValidIpAddress = (ip: string) => {
  const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

const isValidIpv6Address = (ip: string) => {
  if (!ip) return true; // 允许为空
  const ipv6Regex = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Regex.test(ip);
};

const validateForm = () => {
    if (!isSourceEmane.value) {
    if (!linkForm.iface1?.name) {
      ElMessage.warning('请输入源节点接口名称');
      return false;
    }
    
    if (linkForm.iface1?.ip4 && !isValidIpAddress(linkForm.iface1.ip4)) {
      ElMessage.warning('源节点IPv4地址格式不正确');
      return false;
    }

    if (linkForm.iface1?.ip6 && !isValidIpv6Address(linkForm.iface1.ip6)) {
      ElMessage.warning('源节点IPv6地址格式不正确');
      return false;
    }
  }
  
    if (!isTargetEmane.value) {
    if (!linkForm.iface2?.name) {
      ElMessage.warning('请输入目标节点接口名称');
      return false;
    }
    
    if (linkForm.iface2?.ip4 && !isValidIpAddress(linkForm.iface2.ip4)) {
      ElMessage.warning('目标节点IPv4地址格式不正确');
      return false;
    }

    if (linkForm.iface2?.ip6 && !isValidIpv6Address(linkForm.iface2.ip6)) {
      ElMessage.warning('目标节点IPv6地址格式不正确');
      return false;
    }
  }
  
  return true;
};

const handleConfirm = async () => {
  try {
        if (!validateForm()) return;
    
        if (!props.sourceNode || !props.targetNode) {
      ElMessage.error('节点数据不完整');
      return;
    }
    
        linkForm.node1_id = props.sourceNode.id;
    linkForm.node2_id = props.targetNode.id;
    
        linkForm.type = determineLinkType();
    
        if (linkForm.iface1 && (isSourceOvsSwitch.value || isSourceSwitch.value ||isSourceSRSwitch.value || isSourceVM.value)) {
      linkForm.iface1.ip4 = '';
      linkForm.iface1.ip4_mask = 0;
      linkForm.iface1.ip6 = '';
      linkForm.iface1.ip6_mask = 0;
      linkForm.iface1.mac = '';
    }
    
    if (linkForm.iface2 && (isTargetOvsSwitch.value || isTargetSwitch.value ||isTargetSRSwitch.value || isTargetVM.value)) {
      linkForm.iface2.ip4 = '';
      linkForm.iface2.ip4_mask = 0;
      linkForm.iface2.ip6 = '';
      linkForm.iface2.ip6_mask = 0;
      linkForm.iface2.mac = '';
    }
    
        if (linkForm.options) {
      linkForm.options.jitter = Number(linkForm.options.jitter) || 0;
      linkForm.options.key = Number(linkForm.options.key) || 0;
      linkForm.options.mburst = Number(linkForm.options.mburst) || 0;
      linkForm.options.mer = Number(linkForm.options.mer) || 0;
      linkForm.options.loss = Number(linkForm.options.loss) || 0;
      linkForm.options.bandwidth = Number(linkForm.options.bandwidth) || 0;
      linkForm.options.burst = Number(linkForm.options.burst) || 0;
      linkForm.options.delay = Number(linkForm.options.delay) || 0;
      linkForm.options.dup = Number(linkForm.options.dup) || 0;
      linkForm.options.buffer = Number(linkForm.options.buffer) || 0;
      linkForm.options.mtu = Number(linkForm.options.mtu) || 0;
    } else {
            linkForm.options = createDefaultLinkOptions();
    }
    
    
        const result = await (topoStore as any).addLinkRemote(linkForm);

        if (isTMVLink.value) {
      saveTMVLinkParams(result.newLink);
    }

        dialogVisible.value = false;
    emit('confirm', result.newLink);
  } catch (error: any) {
    console.error('添加链路出错:', error);
    ElMessage.error(error?.message || '添加链路失败，请重试');
  }
};

const saveTMVLinkParams = (link: Link) => {
  try {
    if (!props.sourceNode || !props.targetNode) {
      console.error('TMV链路参数保存失败：节点数据不完整');
      return;
    }

        let transmitterNode: any = null;
    let receiverNode: any = null;
    let transmitterIface: NodeIface | null = null;
    let receiverIface: NodeIface | null = null;

        if (props.sourceNode.tmvConfig?.modelType === 'transmitter') {
      transmitterNode = props.sourceNode;
      receiverNode = props.targetNode;
      transmitterIface = link.iface1;
      receiverIface = link.iface2;
    } else if (props.targetNode.tmvConfig?.modelType === 'transmitter') {
      transmitterNode = props.targetNode;
      receiverNode = props.sourceNode;
      transmitterIface = link.iface2;
      receiverIface = link.iface1;
    } else {
            transmitterNode = props.sourceNode;
      receiverNode = props.targetNode;
      transmitterIface = link.iface1;
      receiverIface = link.iface2;
      console.warn('TMV链路：未找到明确的发送机配置，默认源节点为发送机');
    }

        const dstIp = receiverIface?.ip4 || '10.0.0.2'; 
    // 从TMV Traffic Store获取流量模型参数，而不是从节点的tmvConfig
    const transmitterConfig = tmvTrafficStore.getTMVNodeConfig(transmitterNode.id);
    const receiverConfig = tmvTrafficStore.getTMVNodeConfig(receiverNode.id);
    
    
    const trafficModel = transmitterConfig?.trafficModel || 'power_law_model.sh';
    const testDuration = receiverConfig?.testDuration || 60;
    

    // 获取会话ID
    const sessionId = topoStore.topoData?.id || 0;

    // 生成链路ID
    const linkId = `${transmitterNode.id}-${receiverNode.id}`;

    // 构建TMV链路参数
    const tmvLinkParams = {
      linkId,
      sourceNodeId: transmitterNode.id,
      targetNodeId: receiverNode.id,
      container: transmitterNode.alias || transmitterNode.name,
      re_container: receiverNode.alias || receiverNode.name,
      dst_ip: dstIp,
      traffic_model: trafficModel,
      time: testDuration.toString(),
      sessionId
    };

    // 保存到TMV流量模型Store
    tmvTrafficStore.addTMVLink(tmvLinkParams);

    ElMessage.success('TMV链路参数已保存，仿真开启后将自动调用流量模型');

  } catch (error: any) {
    console.error('保存TMV链路参数失败:', error);
    ElMessage.error('保存TMV链路参数失败');
  }
};

// 获取节点已使用的所有接口
const getNodeInterfaces = (links: Link[], nodeId: number) => {
  const interfaces: NodeIface[] = [];
  
  links.forEach(link => {
    if (link.node1_id === nodeId && link.iface1) {
      interfaces.push(link.iface1);
    }
    if (link.node2_id === nodeId && link.iface2) {
      interfaces.push(link.iface2);
    }
  });
  
  return interfaces;
};

const getNextAvailableId = (interfaces: NodeIface[]) => {
  if (!interfaces.length) return 0;
  
    const usedIds = interfaces.map(iface => iface.id).sort((a, b) => a - b);
  
    let nextId = 0;
  for (const id of usedIds) {
    if (id !== nextId) {
      break;
    }
    nextId++;
  }
  
  return nextId;
};
</script>

<style scoped>
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
  width: 90%; 
  max-width: 900px;
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
  max-height: 75vh;
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
  margin-bottom: 1.25rem;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 0.75rem;
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
  margin-bottom: 0.625rem;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  background-color: rgba(0, 198, 255, 0.2);
  color: #00eaff;
  border-radius: 50%;
  font-size: 0.75rem;
  margin-left: 0.25rem;
  cursor: help;
}

.form-input {
  flex: 1;
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

:deep(.el-select__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
}

:deep(.el-input__inner[type='number'])::-webkit-inner-spin-button,
:deep(.el-input__inner[type='number'])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
:deep(.el-input__inner[type='number']) {
  -moz-appearance: textfield;
}

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

.row {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.75rem;
}
.row .config-section {
  flex: 1;
  min-width: 0;
}

.form-info {
  width: 100%;
  text-align: center;
  padding: 0.625rem;
  border-radius: 6px;
  background: rgba(14, 135, 205, 0.1);
  color: #0cc4cc;
  font-size: 0.875rem;
  margin: 0.3125rem 0;
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

@media (max-width: 1024px) {
  .custom-dialog {
    width: 95%;
    max-width: 800px;
  }
}

@media (max-width: 768px) {
  .row {
    flex-direction: column;
    gap: 1rem;
  }
  .form-row {
    flex-wrap: wrap;
  }
  .form-label {
    width: 100%;
    text-align: left;
    margin-bottom: 0.375rem;
    padding-right: 0;
    justify-content: flex-start;
  }
  .custom-dialog {
    width: 95%;
    max-width: 600px;
  }
}

@media (max-width: 480px) {
  .custom-dialog-body {
    padding: 0.75rem;
  }
  .config-section {
    padding: 0.625rem;
  }
  .custom-dialog-header {
    padding: 0.625rem 0.75rem;
  }
  .custom-dialog-footer {
    padding: 0.625rem 0.75rem 0.75rem;
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
  .custom-dialog {
    width: 100%;
    border-radius: 0;
    height: 100%;
    max-height: 100vh;
  }
  .custom-dialog-overlay {
    padding: 0;
  }
  .custom-dialog-body {
    max-height: none;
    flex-grow: 1;
    overflow-y: auto;
  }
}
</style>
