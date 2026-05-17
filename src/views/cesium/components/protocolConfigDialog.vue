<template>
  <teleport to="body">
    <div class="protocol-dialog-mask" v-if="visible">
      <div class="protocol-dialog">
        <div class="protocol-dialog-header">
          <span class="protocol-dialog-title">{{ isNestV3Docker ? '网卡协议配置' : '静态路由配置' }}</span>
          <span class="protocol-dialog-close" @click="$emit('close')">×</span>
        </div>
        <div v-if="nodeName" class="protocol-dialog-nodename">节点名称：{{ nodeName }}</div>
        <!-- 标签页切换 - 仅 nest:v3 镜像显示 -->
        <div class="protocol-dialog-tabs" v-if="isNestV3Docker">
          <div :class="['protocol-dialog-tab', { active: activeTab === 'protocol' }]" @click="activeTab = 'protocol'">网络协议配置</div>
          <div :class="['protocol-dialog-tab', { active: activeTab === 'converge' }]" @click="activeTab = 'converge'">路由收敛设置</div>
        </div>
        <div class="protocol-dialog-body">
          <!-- 网络协议配置页 - nest:v3 显示完整配置,其他只显示静态路由 -->
          <div v-show="activeTab === 'protocol' || !isNestV3Docker">
            <!-- 网卡列表 - 仅 nest:v3 显示 -->
            <div class="nic-list-section" v-if="isNestV3Docker">
              <div class="nic-list-title">网卡列表</div>
              <div class="nic-list">
                <div
                  v-for="iface in interfaces"
                  :key="iface"
                  class="nic-item"
                >
                  <span class="nic-name">{{ iface }}</span>
                </div>
              </div>
            </div>
            <!-- 协议配置 - 仅 nest:v3 显示 -->
            <div class="config-content" v-if="isNestV3Docker">
              <div class="nic-protocol-config-section">
                <div class="nic-protocol-config-title">协议配置</div>
                <div class="protocol-config-grid">
                  <!-- OSPFv2 -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.OSPFv2.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">OSPFv2</span>
                    </label>
                    <template v-if="selectedProtocols.OSPFv2.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.OSPFv2.interfaces" :key="iface" class="tag" @click="removeIface('OSPFv2', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.OSPFv2.interfaces.includes(iface) }" @click="toggleIface('OSPFv2', iface)">{{ iface }}</div>
                        </div>
                      </div>
                      <input class="custom-input" v-model="selectedProtocols.OSPFv2.areaId" placeholder="区域ID：例如0" />
                    </template>
                  </div>
                  <!-- OSPFv3 -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.OSPFv3.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">OSPFv3</span>
                    </label>
                    <template v-if="selectedProtocols.OSPFv3.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.OSPFv3.interfaces" :key="iface" class="tag" @click="removeIface('OSPFv3', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.OSPFv3.interfaces.includes(iface) }" @click="toggleIface('OSPFv3', iface)">{{ iface }}</div>
                        </div>
                      </div>
                      <input class="custom-input" v-model="selectedProtocols.OSPFv3.areaId" placeholder="区域ID：例如0（0.0.0.0）" />
                    </template>
                  </div>
                  <!-- RIP -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.RIP.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">RIP</span>
                    </label>
                    <template v-if="selectedProtocols.RIP.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.RIP.interfaces" :key="iface" class="tag" @click="removeIface('RIP', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.RIP.interfaces.includes(iface) }" @click="toggleIface('RIP', iface)">{{ iface }}</div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <!-- BGP -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.BGP.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">BGP</span>
                    </label>
                    <template v-if="selectedProtocols.BGP.enabled">
                      <input class="custom-input" v-model="selectedProtocols.BGP.localAs" placeholder="本地AS号" />
                      <div v-for="(neighbor, nIdx) in selectedProtocols.BGP.neighbors" :key="nIdx" style="display: flex; gap: 8px; margin-bottom: 6px;">
                        <input class="custom-input" v-model="neighbor.neighborIp" placeholder="邻居IP" style="width: 120px;" />
                        <input class="custom-input" v-model="neighbor.neighborAs" placeholder="邻居AS" style="width: 80px;" />
                        <button class="protocol-btn remove-neighbor" @click="selectedProtocols.BGP.neighbors.splice(nIdx, 1)">删除</button>
                      </div>
                      <button class="protocol-btn add-neighbor" @click="selectedProtocols.BGP.neighbors.push({ neighborIp: '', neighborAs: '' })">添加邻居</button>
                    </template>
                  </div>
                  <!-- IS-IS -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols['IS-IS'].enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">IS-IS</span>
                    </label>
                    <template v-if="selectedProtocols['IS-IS'].enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols['IS-IS'].interfaces" :key="iface" class="tag" @click="removeIface('IS-IS', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols['IS-IS'].interfaces.includes(iface) }" @click="toggleIface('IS-IS', iface)">{{ iface }}</div>
                        </div>
                      </div>
                      <input class="custom-input" v-model="selectedProtocols['IS-IS'].process" placeholder="进程名" />
                      <input class="custom-input" v-model="selectedProtocols['IS-IS'].netAddr" placeholder="NET地址：例如49.0001.0000.0000.0000.00" />
                    </template>
                  </div>
                  <!-- PIM -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.PIM.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">PIM</span>
                    </label>
                    <template v-if="selectedProtocols.PIM.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.PIM.interfaces" :key="iface" class="tag" @click="removeIface('PIM', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.PIM.interfaces.includes(iface) }" @click="toggleIface('PIM', iface)">{{ iface }}</div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <!-- Snapshot -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.Snapshot.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">Snapshot</span>
                    </label>
                    <template v-if="selectedProtocols.Snapshot.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.Snapshot.interfaces" :key="iface" class="tag" @click="removeIface('Snapshot', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.Snapshot.interfaces.includes(iface) }" @click="toggleIface('Snapshot', iface)">{{ iface }}</div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <!-- Backpressure -->
                  <div class="protocol-config-item">
                    <label class="custom-switch">
                      <input type="checkbox" v-model="selectedProtocols.Backpressure.enabled" />
                      <span class="custom-slider"></span>
                      <span class="custom-switch-label">Backpressure</span>
                    </label>
                    <template v-if="selectedProtocols.Backpressure.enabled">
                      <div class="custom-multiselect">
                        <div class="selected-tags">
                          <span v-for="iface in selectedProtocols.Backpressure.interfaces" :key="iface" class="tag" @click="removeIface('Backpressure', iface)">{{ iface }} ×</span>
                        </div>
                        <div class="dropdown-list">
                          <div v-for="iface in interfaces" :key="iface" class="dropdown-item" :class="{ selected: selectedProtocols.Backpressure.interfaces.includes(iface) }" @click="toggleIface('Backpressure', iface)">{{ iface }}</div>
                        </div>
                      </div>
                    </template>
                  </div>

                  
                </div>
              </div>
            </div>
            <!-- 静态路由配置 - 始终显示 -->
            <div class="config-content">
              <div class="nic-protocol-config-section">
                <div class="nic-protocol-config-title">静态路由配置</div>
                <div class="protocol-config-grid">
                    <div class="protocol-config-item" style="grid-column: 1 / -1;">
                      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                        <div style="font-weight:600; color:#00eaff">静态路由列表</div>
                        <button class="protocol-btn add-neighbor" @click="addRoute">添加静态路由</button>
                      </div>
                      <div class="static-route-header">
                        <div class="col-destination">目标网络</div>
                        <div class="col-nexthop">下一跳</div>
                        <div class="col-interface">网卡名（可选）</div>
                        <div class="col-action">操作</div>
                      </div>
                      <div v-for="(route, idx) in selectedProtocols.staticRoutes" :key="idx" class="static-route-row">
                        <input class="static-input destination" v-model="route.destination" placeholder="如 10.0.0.0/24" />
                        <input class="static-input nexthop" v-model="route.nexthop" placeholder="如 10.0.1.20" />
                        <div class="col-interface">
                          <input class="static-input iface" list="iface-list" v-model="route.interface" placeholder="可填或留空" />
                          <datalist id="iface-list">
                            <option v-for="iface in interfaces" :key="iface" :value="iface"></option>
                          </datalist>
                        </div>
                        <div class="col-action"><button class="protocol-btn remove-static" @click="removeRoute(idx)">删除</button></div>
                      </div>

                    </div>
                </div>
              </div>
            </div>
          </div>
          <!-- 路由收敛设置页 - 仅 nest:v3 显示 -->
          <div v-show="activeTab === 'converge' && isNestV3Docker" class="converge-settings">
            <form class="converge-form" @submit.prevent="handleConvergeSave">
              <div class="converge-form-item">
                <label>目标网段：</label>
                <input v-model="convergeTarget" type="text" placeholder="如 192.168.1.0/24" />
              </div>
              <div class="converge-form-item">
                <label>最大尝试次数：</label>
                <input v-model.number="convergeMaxTries" type="number" min="1" placeholder="请输入最大尝试次数" />
              </div>
            </form>
          </div>
        </div>
        <div class="protocol-dialog-footer">
          <button class="protocol-btn cancel" @click.prevent="$emit('close')">取消</button>
          <button class="protocol-btn confirm" @click.prevent="handleSaveAll">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, reactive, getCurrentInstance, onUnmounted, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useTopoStore } from '../../../store/modules/topo';
import { insertRouterInfo,getAllProtocols } from '../../../api/protocol';

interface BgpNeighbor {
  neighborIp?: string;
  neighborAs?: string;
}

// 1. 扩展协议类型
const protocolOptions = ['OSPFv2', 'OSPFv3', 'RIP', 'BGP', 'IS-IS', 'PIM', 'Snapshot', 'Backpressure','staticRoutes'] as const;
type ProtocolType = typeof protocolOptions[number];

const props = defineProps<{
  visible: boolean;
  protocol: string;
  interfaces: string[];
  nodeName: string;
  nodeType?: string;
  nodeImage?: string;
}>();
const emit = defineEmits(['close', 'save']);
const instance = getCurrentInstance();
let isUnmounted = false;
onUnmounted(() => { isUnmounted = true; });

// 判断是否是 nest:v3 的 Docker 节点
const isNestV3Docker = computed(() => {
  return props.nodeType === 'DOCKER' && props.nodeImage === 'nest:v3';
});

// 2. 协议配置数据结构
const selectedProtocols = reactive<Record<ProtocolType, any>>({
  OSPFv2: { enabled: false, interfaces: [], areaId:0 },
  OSPFv3: { enabled: false, interfaces: [], areaId: '' },
  RIP:    { enabled: false, interfaces: [] },
  BGP:    { enabled: false, localAs: 0, neighbors: [] },
  'IS-IS':{ enabled: false, interfaces: [], process: 0, netAddr: '' },
  PIM:    { enabled: false, interfaces: [] },
  Snapshot: { enabled: false, interfaces: [] },
  Backpressure: { enabled: false, interfaces: [] },
  staticRoutes:[]
});

// 将静态路由存放到 selectedProtocols.staticRoutes
(selectedProtocols as any).staticRoutes = (selectedProtocols as any).staticRoutes || [];

function addRoute() {
  (selectedProtocols as any).staticRoutes.push({ destination: '', nexthop: '', interface: '' });
}

function removeRoute(idx: number) {
  const arr = (selectedProtocols as any).staticRoutes;
  if (Array.isArray(arr) && idx >= 0 && idx < arr.length) arr.splice(idx, 1);
}

// 标签页状态
const activeTab = ref<'protocol' | 'converge'>('protocol');

// 路由收敛设置表单数据
const convergeTarget = ref('');
const convergeMaxTries = ref<number | null>(null);

watch(props.interfaces, () => {
  // This watch is no longer needed as selectedProtocols is the source of truth
  // selectedProtocols.value = Array(6).fill(null);
  // protocolParams.value = {} as Record<ProtocolType, ProtocolParam>;
});



//获取场景信息
  const topoStore = useTopoStore();
  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id ?? 0;
// 保存所有协议参数或静态路由
async function handleSaveAll(): Promise<void> {
  let protocolSelected = false;
  const result: Record<string, any> = {
    container: props.nodeName + '-' + sessionId || '',
    sessionId: sessionId
  };

  // 仅在 nest:v3 时处理协议配置
  if (isNestV3Docker.value) {
    // OSPFv2
    if (selectedProtocols.OSPFv2.enabled) {
      if (!selectedProtocols.OSPFv2.interfaces.length) {
        ElMessage.warning('OSPFv2 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.ospf2Interfaces = selectedProtocols.OSPFv2.interfaces.join(',');
      result.ospf2Area = String(selectedProtocols.OSPFv2.areaId);
      result.protocolOspf2 = 'on';
    }
    // OSPFv3
    if (selectedProtocols.OSPFv3.enabled) {
      if (!selectedProtocols.OSPFv3.interfaces.length) {
        ElMessage.warning('OSPFv3 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.ospf3Interfaces = selectedProtocols.OSPFv3.interfaces.join(',');
      result.ospf3Area = String(selectedProtocols.OSPFv3.areaId || '');
      result.protocolOspf3 = 'on';
    }
    // RIP
    if (selectedProtocols.RIP.enabled) {
      if (!selectedProtocols.RIP.interfaces.length) {
        ElMessage.warning('RIP 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.ripInterfaces = selectedProtocols.RIP.interfaces.join(',');
      result.protocolRip = 'on';
    }
    // IS-IS
    if (selectedProtocols['IS-IS'].enabled) {
      if (!selectedProtocols['IS-IS'].interfaces.length) {
        ElMessage.warning('IS-IS 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.isisInterfaces = selectedProtocols['IS-IS'].interfaces.join(',');
      result.isisProcess = String(selectedProtocols['IS-IS'].process || '');
      result.isisNet = selectedProtocols['IS-IS'].netAddr || '';
      result.protocolIsis = 'on';
    }
    // PIM
    if (selectedProtocols.PIM.enabled) {
      if (!selectedProtocols.PIM.interfaces.length) {
        ElMessage.warning('PIM 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.pimInterfaces = selectedProtocols.PIM.interfaces.join(',');
      result.protocolPim = 'on';
    }
    // BGP
    if (selectedProtocols.BGP.enabled) {
      protocolSelected = true;
      result.bgpLocalAs = selectedProtocols.BGP.localAs || '';
      if (selectedProtocols.BGP.neighbors && selectedProtocols.BGP.neighbors.length > 0) {
        result.bgpNeighborIp = selectedProtocols.BGP.neighbors.map((n: BgpNeighbor) => n.neighborIp || '').join(',');
        result.bgpNeighborAs = selectedProtocols.BGP.neighbors.map((n: BgpNeighbor) => n.neighborAs || '').join(',');
      }
      result.protocolBgp = 'on';
    }
    // Snapshot
    if (selectedProtocols.Snapshot.enabled) {
      if (!selectedProtocols.Snapshot.interfaces.length) {
        ElMessage.warning('Snapshot 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.snapshotInterfaces = selectedProtocols.Snapshot.interfaces.join(',');
      result.protocolSnapshot = 'on';
    }
    // Backpressure
    if (selectedProtocols.Backpressure.enabled) {
      if (!selectedProtocols.Backpressure.interfaces.length) {
        ElMessage.warning('Backpressure 至少选择一个网卡');
        return;
      }
      protocolSelected = true;
      result.backpressureInterfaces = selectedProtocols.Backpressure.interfaces.join(',');
      result.protocolBackpressure = 'on';
    }

    // 保存路由收敛配置参数
    if (convergeTarget.value) {
      result.targetCidr = convergeTarget.value;
      result.maxAttempts = Number(convergeMaxTries.value);
    }
  }

  // 静态路由（如果存在），放到 exJson.static_routes
  const spStatic = (selectedProtocols as any).staticRoutes;
  let filteredStatic: any[] = [];
  if (Array.isArray(spStatic) && spStatic.length) {
    filteredStatic = spStatic.filter((r: any) => (r.destination && r.destination.trim()) || (r.nexthop && r.nexthop.trim()) || (r.interface && r.interface.trim()));
    if (filteredStatic.length) {
      result.exJson= { static_routes: filteredStatic.map((r: any) => ({ destination: r.destination || '', nexthop: r.nexthop || '', interface: r.interface || '' })) };
    }
  }

  // 对于非 nest:v3，只需要静态路由配置
  // if (!isNestV3Docker.value) {
  //   if (!filteredStatic || filteredStatic.length === 0) {
  //     ElMessage.warning('请至少添加一条静态路由');
  //     return;
  //   }
  // } else {
  //   // 对于 nest:v3，需要至少有协议或静态路由
  //   if (!protocolSelected && (!filteredStatic || filteredStatic.length === 0)) {
  //     ElMessage.warning('请至少选择一个协议或添加静态路由');
  //     return;
  //   }
  // }

  try {
    await insertRouterInfo(result);

    if (!isUnmounted) {
      emit('save', { config: result });
      emit('close');
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '协议配置失败');
  }
}

function handleConvergeSave() {
  // 这里可根据需要扩展，比如结合收敛配置一起放到 formData 或单独处理
  alert(`保存成功！目标网段：${convergeTarget.value}，最大尝试次数：${convergeMaxTries.value}`);
}

function toggleIface(proto: ProtocolType, iface: string) {
  const arr = selectedProtocols[proto].interfaces;
  const idx = arr.indexOf(iface);
  if (idx === -1) arr.push(iface);
  else arr.splice(idx, 1);
}
function removeIface(proto: ProtocolType, iface: string) {
  const arr = selectedProtocols[proto].interfaces;
  const idx = arr.indexOf(iface);
  if (idx !== -1) arr.splice(idx, 1);
}


//进入页面时将查询到的协议信息展示到页面上
async function getProtocols() {
  try {
    const protocolData = await getAllProtocols(sessionId, props.nodeName+'-'+sessionId, true);
    
    // 检查protocolData是否为null或undefined
    if (!protocolData) {
      console.warn('Protocol data is null or undefined');
      return;
    }
    
    // 重置所有协议
    Object.keys(selectedProtocols).forEach(proto => {
      selectedProtocols[proto as ProtocolType].enabled = false;
      selectedProtocols[proto as ProtocolType].interfaces = [];
    });
    
    // OSPFv2
    if (protocolData.protocolOspf2 === 'on') {
      selectedProtocols.OSPFv2.enabled = true;
      if (protocolData.ospf2Interfaces) {
        selectedProtocols.OSPFv2.interfaces = protocolData.ospf2Interfaces.split(',');
      }
      selectedProtocols.OSPFv2.areaId = protocolData.ospf2Area;
    }
    
    // OSPFv3
    if (protocolData.protocolOspf3 === 'on') {
      selectedProtocols.OSPFv3.enabled = true;
      if (protocolData.ospf3Interfaces) {
        selectedProtocols.OSPFv3.interfaces = protocolData.ospf3Interfaces.split(',');
      }
      selectedProtocols.OSPFv3.areaId = protocolData.ospf3Area || '';
    }
    
    // RIP
    if (protocolData.protocolRip === 'on') {
      selectedProtocols.RIP.enabled = true;
      if (protocolData.ripInterfaces) {
        selectedProtocols.RIP.interfaces = protocolData.ripInterfaces.split(',');
      }
    }
    
    // IS-IS
    if (protocolData.protocolIsis === 'on') {
      selectedProtocols['IS-IS'].enabled = true;
      if (protocolData.isisInterfaces) {
        selectedProtocols['IS-IS'].interfaces = protocolData.isisInterfaces.split(',');
      }
      selectedProtocols['IS-IS'].process = protocolData.isisProcess || '';
      selectedProtocols['IS-IS'].netAddr = protocolData.isisNet || '';
    }
    
    // PIM
    if (protocolData.protocolPim === 'on') {
      selectedProtocols.PIM.enabled = true;
      if (protocolData.pimInterfaces) {
        selectedProtocols.PIM.interfaces = protocolData.pimInterfaces.split(',');
      }
    }
    
    // BGP
    if (protocolData.protocolBgp === 'on') {
      selectedProtocols.BGP.enabled = true;
      selectedProtocols.BGP.localAs = protocolData.bgpLocalAs;
      
      // 处理BGP邻居
      if (protocolData.bgpNeighborIp && protocolData.bgpNeighborAs) {
        const neighborIps = protocolData.bgpNeighborIp.split(',');
        const neighborAss = protocolData.bgpNeighborAs.split(',');
        
        selectedProtocols.BGP.neighbors = neighborIps.map((ip:any, index:any) => ({
          neighborIp: ip,
          neighborAs: neighborAss[index] || ''
        }));
      }
    }
    
    // Snapshot
    if (protocolData.protocolSnapshot === 'on') {
      selectedProtocols.Snapshot.enabled = true;
      if (protocolData.snapshotInterfaces) {
        selectedProtocols.Snapshot.interfaces = protocolData.snapshotInterfaces.split(',');
      }
    }
    // Backpressure
    if (protocolData.protocolBackpressure === 'on') {
      selectedProtocols.Backpressure.enabled = true;
      if (protocolData.backpressureInterfaces) {
        selectedProtocols.Backpressure.interfaces = protocolData.backpressureInterfaces.split(',');
      }
    }
    
    // 如果存在路由收敛配置，就显示到页面上
    if (protocolData.targetCidr) { 
      convergeTarget.value = protocolData.targetCidr;
    }
    if (protocolData.maxAttempts) {
      convergeMaxTries.value = protocolData.maxAttempts;
    }
    // 加载静态路由
    try {
      let exJson: any = protocolData.exJson;
      if (typeof exJson === 'string' && exJson) {
        try {
          exJson = JSON.parse(exJson);
        } catch (e) {
          console.warn('Failed to parse exJson string:', e);
          exJson = null;
        }
      }

      if (exJson) {
        let routes: any[] = [];
        if (Array.isArray(exJson)) {
          routes = exJson;
        } else if (Array.isArray(exJson.static_routes)) {
          routes = exJson.static_routes;
        }

        if (routes && routes.length) {
          (selectedProtocols as any).staticRoutes = routes.map((r: any) => ({
            destination: r.destination || r.destination_cidr || '',
            nexthop: r.nexthop || r.next_hop || '',
            interface: r.interface || r.iface || ''
          }));
        }
      }
    } catch (e) {
      console.error('Error loading static routes from exJson:', e);
    }
    
  } catch (error) {
    console.error('Failed to fetch protocol data:', error);
  }
}

//打开对话框时先获取后端查询到的协议配置参数
onMounted(async () => { 
  getProtocols();
});
</script>
<style scoped>
.protocol-dialog-mask {
  position: fixed;
  z-index: 2000;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 20, 40, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.protocol-dialog {
  background: linear-gradient(135deg, #0a1a2a 80%, #1e2a4a 100%);
  border-radius: 16px;
  box-shadow: 0 8px 40px #00eaff44, 0 1.5px 0 #00eaff44 inset;
  min-width: 480px;
  max-width: 95vw;
  width: 50%;
  padding: 0;
  border: 1.5px solid #00eaff88;
  animation: dialog-fade-in 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow-y: auto;
}
@keyframes dialog-fade-in {
  from { opacity: 0; transform: scale(0.95) translateY(30px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.protocol-dialog-header {
  background: linear-gradient(90deg, #0ff 0%, #0a1a2a 100%);
  padding: 18px 28px 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #00eaff44;
}
.protocol-dialog-title {
  color: #d9eef0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-shadow: 0 0 8px #00eaff88;
}
.protocol-dialog-close {
  color: #00eaff;
  font-size: 28px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.2s;
  border-radius: 50%;
  padding: 0 8px;
  line-height: 1;
}
.protocol-dialog-close:hover {
  color: #fff;
  background: #00eaff33;
}
.protocol-dialog-body {
  padding: 28px 32px 10px 32px;
  background: linear-gradient(120deg, #101c2c 80%, #1e2a4a 100%);
  flex: 1 1 auto;
  overflow-y: auto;
  max-height: 60vh;
}
.config-content {
  display: flex;
  gap: 24px;
}
.nic-protocol-config-section {
  flex: 1;
}
.protocol-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.protocol-config-item {
  background: rgba(0, 234, 255, 0.04);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #00eaff22;
}
.protocol-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.protocol-form-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 234, 255, 0.04);
  border-radius: 8px;
  padding: 8px 12px;
  border: 1px solid #00eaff22;
  transition: border 0.2s;
}
.protocol-form-item:focus-within {
  border: 1.5px solid #00eaff;
  background: rgba(0, 234, 255, 0.08);
}
.protocol-form-item label {
  color: #00eaff;
  font-size: 14px;
  min-width: 80px;
  font-weight: 500;
  letter-spacing: 1px;
}
.protocol-form-item input {
  flex: 1;
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 6px;
  color: #eaf6ff;
  font-size: 14px;
  padding: 6px 10px;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px #00eaff22;
}
.protocol-form-item input:focus {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
  background: #12223a;
}
.protocol-form-item select {
  flex: 1;
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 6px;
  color: #eaf6ff;
  font-size: 14px;
  padding: 6px 10px;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px #00eaff22;
}
.protocol-form-item select:focus {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
  background: #12223a;
}
.protocol-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 18px 32px 22px 32px;
  background: linear-gradient(90deg, #0a1a2a 80%, #1e2a4a 100%);
  border-top: 1px solid #00eaff22;
}
.protocol-btn {
  min-width: 90px;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  border: none;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.protocol-btn.cancel {
  background: linear-gradient(90deg, #1e2a4a 60%, #0a1a2a 100%);
  color: #00eaff;
  border: 1.5px solid #00eaff44;
}
.protocol-btn.cancel:hover {
  background: #00eaff22;
  color: #fff;
}
.protocol-btn.confirm {
  background: linear-gradient(90deg, #00eaff 60%, #0a1a2a 100%);
  color: #0a1a2a;
  box-shadow: 0 0 8px #00eaff44;
}
.protocol-btn.confirm:hover {
  background: #00eaff;
  color: #fff;
}

/* BGP协议相关样式 */
.protocol-form-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #00eaff33;
}

.protocol-form-section-title {
  color: #00eaff;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  padding-left: 8px;
}

.bgp-neighbor-item {
  background: rgba(0, 234, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #00eaff22;
}

.add-neighbor {
  background: linear-gradient(90deg, #1e4a2a 60%, #0a2a1a 100%);
  color: #44ff88;
  border: 1.5px solid #44ff8844;
  padding: 6px 12px;
  margin-top: 5px;
  align-self: flex-start;
}

.add-neighbor:hover {
  background: #44ff8822;
  color: #fff;
}

.remove-neighbor {
  background: linear-gradient(90deg, #4a1e1e 60%, #2a0a0a 100%);
  color: #ff4444;
  border: 1.5px solid #ff444444;
  padding: 4px 10px;
  margin: 5px 0 5px 12px;
  align-self: flex-start;
}

.remove-neighbor:hover {
  background: #ff444422;
  color: #fff;
}

/* 静态路由样式调整，适配页面 */
.static-route-header {
  display: grid;
  grid-template-columns: 1fr 200px 180px 90px;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #bfefff;
}
.static-route-row {
  display: grid;
  grid-template-columns: 1fr 200px 180px 90px;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.static-input {
  background: #0a1a2a;
  border: 1.5px solid #00eaff22;
  border-radius: 6px;
  color: #eaf6ff;
  padding: 8px 10px;
  outline: none;
}
.static-input:focus {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
  background: #12223a;
}
.static-input.destination { width: 80%; }
.static-input.nexthop { width: 180px; }
.static-input.iface { width: 90%; }
.protocol-btn.add-neighbor, .protocol-btn.add-static {
  background: linear-gradient(90deg, #2fd27a 60%, #117a3f 100%);
  color: #fff;
  border: 1.5px solid #2fd27a44;
}
.protocol-btn.add-neighbor:hover, .protocol-btn.add-static:hover {
  background: #38e884;
}
.protocol-btn.remove-static {
  background: linear-gradient(90deg, #7a1e1e 60%, #4a0a0a 100%);
  color: #fff;
  border: 1.5px solid #ff4444;
  padding: 6px 10px;
}
.protocol-btn.remove-static:hover { background: #ff4444; }

/* 标签页样式 */
.protocol-dialog-tabs {
  display: flex;
  border-bottom: 1.5px solid #00eaff44;
  margin: 0 0 18px 0;
}
.protocol-dialog-tab {
  padding: 10px 32px;
  cursor: pointer;
  color: #4ecfff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 2.5px solid transparent;
  transition: color 0.2s, border 0.2s;
}
.protocol-dialog-tab.active {
  color: #00eaff;
  border-bottom: 2.5px solid #00eaff;
}

/* 路由收敛设置表单样式 */
.converge-settings {
  padding: 24px 0 0 0;
}
.converge-form {
  display: flex;
  flex-direction: row;
  gap: 22px;
  max-width: 400px;
}
.converge-form-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.converge-form-item label {
  color: #00eaff;
  font-size: 15px;
  min-width: 90px;
  font-weight: 500;
  width: 110px;
  text-align: right;
}
.converge-form-item input {
  flex: 1;
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 6px;
  color: #eaf6ff;
  font-size: 15px;
  padding: 7px 12px;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px #00eaff22;
}
.converge-form-item input:focus {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
  background: #12223a;
}

@media (max-width: 768px) {
  .protocol-dialog {
    min-width: 90vw;
    width: 98vw;
    padding: 0;
  }
  .protocol-dialog-body, .protocol-dialog-footer {
    padding-left: 10px;
    padding-right: 10px;
  }
  .config-content {
    flex-direction: column;
  }
  .protocol-config-grid {
    grid-template-columns: 1fr;
  }
}

/* 自定义多选下拉框样式，深色风格 */
.custom-multiselect {
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  color: #00eaff;
  border-radius: 8px;
  min-height: 38px;
  padding: 4px 8px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.custom-multiselect.open {
  border-color: #00eaff;
  box-shadow: 0 0 8px #00eaff44;
}
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  width: 180px;
  gap: 4px;
  flex: 1;
}
.tag {
  background: #0a1a2a;
  color: #00eaff;
  border-radius: 6px;
  border: 1px solid #00eaff44;
  padding: 2px 8px;
  font-size: 14px;
  margin-right: 2px;
  cursor: pointer;
  user-select: none;
}
.placeholder {
  color: #4ecfff;
  opacity: 0.7;
  font-size: 14px;
}
.arrow {
  margin-left: 8px;
  color: #00eaff;
}
.dropdown-list {
  position: static !important;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 2px;
  z-index: 10;
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 8px;
  box-shadow: none;
}
.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  color: #00eaff;
  font-size: 15px;
  transition: background 0.2s;
}
.dropdown-item.selected {
  background: #12223a;
  font-weight: bold;
}
.dropdown-item:hover {
  background: #1e2a4a;
}
.dropdown-action {
  padding: 8px 12px;
  color: #00eaff;
  font-size: 15px;
  cursor: pointer;
  border-bottom: 1px solid #00eaff22;
  background: #101c2c;
}
/* 新增网卡列表和协议标签样式 */
.nic-list-section {
  margin-bottom: 18px;
}
.nic-list-title {
  color: #00eaff;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.nic-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.nic-item {
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transition: border 0.2s, box-shadow 0.2s;
}
.nic-item.active {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
}
.nic-name {
  color: #00eaff;
  font-size: 15px;
  font-weight: 500;
}
.nic-protocol-tags {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.nic-protocol-tag {
  background: #12223a;
  color: #4ecfff;
  border-radius: 6px;
  border: 1px solid #00eaff44;
  padding: 2px 8px;
  font-size: 13px;
  margin-right: 2px;
}
.nic-protocol-config-section {
  margin-top: 10px;
  padding: 12px 0 0 0;
  border-top: 1px solid #00eaff22;
}
.nic-protocol-config-title {
  color: #00eaff;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.nic-protocol-config-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}
/* 协议总览表格样式 */
.protocol-table-overview {
  width: 240px;
}
.protocol-table-title {
  color: #00eaff;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.protocol-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 234, 255, 0.04);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #00eaff22;
}
.protocol-table-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.protocol-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.protocol-checkbox-custom {
  width: 16px;
  height: 16px;
  border: 1px solid #00eaff44;
  border-radius: 4px;
  background: #0a1a2a;
  transition: background 0.2s;
}
.protocol-checkbox-custom.checked {
  background: #00eaff;
}
.protocol-name {
  color: #00eaff;
  font-size: 15px;
  font-weight: 500;
}
.protocol-dialog-nodename {
  color: #4ecfff;
  font-size: 15px;
  font-weight: 600;
  margin: 10px 0 18px 0;
  text-shadow: 0 0 8px #00eaff88, 0 0 2px #000;
  letter-spacing: 1px;
}
.custom-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.custom-switch input[type="checkbox"] {
  width: 36px;
  height: 20px;
  appearance: none;
  background: #1e2a4a;
  border-radius: 12px;
  position: relative;
  outline: none;
  transition: background 0.2s;
  cursor: pointer;
}
.custom-switch input[type="checkbox"]:checked {
  background: linear-gradient(90deg, #00eaff 60%, #0a1a2a 100%);
}
.custom-slider {
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 20px;
  border-radius: 12px;
  pointer-events: none;
}
.custom-switch input[type="checkbox"]:before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.custom-switch input[type="checkbox"]:checked:before {
  left: 18px;
  background: #00eaff;
}
.custom-switch-label {
  color: #00eaff;
  font-size: 15px;
  font-weight: 600;
}
.custom-multiselect {
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  color: #00eaff;
  border-radius: 8px;
  min-height: 38px;
  padding: 4px 8px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}
.tag {
  background: #0a1a2a;
  color: #00eaff;
  border-radius: 6px;
  border: 1px solid #00eaff44;
  padding: 2px 8px;
  font-size: 14px;
  margin-right: 2px;
  cursor: pointer;
  user-select: none;
}
.dropdown-list {
  position: static !important;
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
  margin-top: 2px;
  z-index: 10;
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  border-radius: 8px;
  box-shadow: none;
}
.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  color: #00eaff;
  font-size: 15px;
  transition: background 0.2s;
}
.dropdown-item.selected {
  background: #12223a;
  font-weight: bold;
}
.dropdown-item:hover {
  background: #1e2a4a;
}
.custom-input {
  background: #0a1a2a;
  border: 1.5px solid #00eaff44;
  color: #eaf6ff;
  border-radius: 6px;
  font-size: 15px;
  padding: 7px 12px;
  outline: none;
  margin-bottom: 8px;
  width: 90%;
  transition: border 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 0 1px #00eaff22;
}
.custom-input:focus {
  border: 1.5px solid #00eaff;
  box-shadow: 0 0 8px #00eaff44;
  background: #12223a;
}
</style>