<template>
  <div class="neo-infobox emane-panel" :class="{'chart-mode': currentView === 'chart'}" ref="emanePanelRef" :style="{ transform: `translate(${dragOffsetX}px, ${dragOffsetY}px)` }">
    <div class="neo-infobox-header">
      <span class="neo-infobox-title">
        <svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
          <rect x="2" y="2" width="14" height="14" rx="2" fill="#4caf50" fill-opacity="0.3" />
          <circle cx="9" cy="9" r="4" fill="#4caf50" fill-opacity="0.6" />
          <circle cx="9" cy="9" r="2" fill="#4caf50" fill-opacity="0.8" />
        </svg> 
        链路监控
      </span>
      <span class="neo-infobox-close" @click="$emit('close')">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="5" y1="5" x2="15" y2="15" stroke="#a5d6a7" stroke-width="2" stroke-linecap="round"/>
          <line x1="15" y1="5" x2="5" y2="15" stroke="#a5d6a7" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
    </div>
    <div class="neo-infobox-content">
      <div v-if="loading" class="loading-indicator">
        <div class="loading-spinner"></div>
        <span>加载数据中...</span>
      </div>
      
      <div v-else-if="!hasData" class="no-data-message">
        <div class="info-icon">!</div>
        <span class="info-message">暂无数据，等待消息更新...</span>
      </div>
      
      <template v-else>

        <div class="link-info" v-if="link">
          <div class="node-info-block">
            <div class="node-info-title">链路信息</div>
            <div class="neo-grid">
              <div class="neo-grid-item">
                <div class="item-label">源节点</div>
                <div class="item-value">{{ sourceNodeName }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">目标节点</div>
                <div class="item-value">{{ targetNodeName }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">当前视角</div>
                <div class="item-value highlight">{{ currentPerspective === 'source' ? sourceNodeName : targetNodeName }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">监控的NEM ID</div>
                <div class="item-value highlight">{{ selectedNemId }}</div>
              </div>
            </div>
            

            <div class="model-type-info" v-if="false">
              <div class="model-status" :class="[modelStatusClass]">
                <div class="model-label">子网模型:</div>
                <div class="model-value">{{ formattedModelType }}</div>
              </div>
            </div>
            

            <div class="perspective-toggle">
              <div class="toggle-label">选择监控视角:</div>
              <div class="toggle-buttons">
                <button 
                  class="perspective-btn" 
                  :class="{active: currentPerspective === 'source'}"
                  @click="switchPerspective('source')"
                >
                  {{ sourceNodeName }}
                </button>
                <button 
                  class="perspective-btn" 
                  :class="{active: currentPerspective === 'target'}"
                  @click="switchPerspective('target')"
                >
                  {{ targetNodeName }}
                </button>
              </div>
            </div>


            <div class="dual-perspective-stats" v-if="showDualPerspective && sourceNodeNemId && targetNodeNemId">
              <div class="dual-stats-header">双视角数据对比</div>
              <div class="dual-stats-grid">
                <div class="perspective-column">
                  <div class="perspective-title">{{ sourceNodeName }} 视角</div>
                  <div class="stat-row">
                    <div class="stat-label">平均SINR</div>
                    <div class="stat-value">{{ sourcePerspectiveStats?.sinrAvg?.toFixed(2) || 'N/A' }} dB</div>
                  </div>
                  <div class="stat-row" v-if="isRfPipeModel">
                    <div class="stat-label">平均接收功率</div>
                    <div class="stat-value">{{ sourcePerspectiveStats?.avgRxPower?.toFixed(2) || 'N/A' }} dBm</div>
                  </div>
                  <div class="stat-row">
                    <div class="stat-label">平均噪声基底</div>
                    <div class="stat-value">{{ sourcePerspectiveStats?.avgNoiseFloor?.toFixed(2) || 'N/A' }} dBm</div>
                  </div>
                </div>
                
                <div class="perspective-column">
                  <div class="perspective-title">{{ targetNodeName }} 视角</div>
                  <div class="stat-row">
                    <div class="stat-label">平均SINR</div>
                    <div class="stat-value">{{ targetPerspectiveStats?.sinrAvg?.toFixed(2) || 'N/A' }} dB</div>
                  </div>
                  <div class="stat-row" v-if="isRfPipeModel">
                    <div class="stat-label">平均接收功率</div>
                    <div class="stat-value">{{ targetPerspectiveStats?.avgRxPower?.toFixed(2) || 'N/A' }} dBm</div>
                  </div>
                  <div class="stat-row">
                    <div class="stat-label">平均噪声基底</div>
                    <div class="stat-value">{{ targetPerspectiveStats?.avgNoiseFloor?.toFixed(2) || 'N/A' }} dBm</div>
                  </div>
                </div>
              </div>
              
              <div class="link-quality-indicator">
                <div class="link-quality-label">链路质量评估:</div>
                <div class="link-quality-value" :class="linkQualityClass">{{ linkQualityText }}</div>
              </div>
            </div>
            
            <div class="toggle-dual-perspective">
              <el-switch
                v-model="showDualPerspective"
                active-text="显示双视角数据"
                inactive-text="关闭双视角数据"
                size="small"
              />
            </div>
          </div>
        </div>
        

        <div class="node-selector" v-if="!link">
          <span class="selector-label">选择视角NEM:</span>
          <el-select 
            v-model="viewpointNemId" 
            placeholder="选择视角" 
            size="small"
            class="nem-selector"
            @change="handleViewpointChange"
          >
            <el-option
              v-for="nemId in availableViewpoints"
              :key="nemId"
              :label="nemId"
              :value="nemId"
            />
          </el-select>

          <span class="selector-label" style="margin-left: 10px;">邻居NEM:</span>
          <el-select 
            v-model="selectedNemId" 
            placeholder="选择邻居" 
            size="small"
            class="nem-selector"
            :disabled="!viewpointNemId"
          >
            <el-option
              v-for="nemId in neighborNemIds"
              :key="nemId"
              :label="nemId"
              :value="nemId"
            />
          </el-select>

          <span class="last-updated" v-if="lastUpdated">
            最后更新: {{ formatTime(lastUpdated) }}
          </span>
        </div>
        

        <div class="cache-indicator" v-if="isUsingCachedData">
          <el-alert
            title="您正在查看缓存数据"
            type="warning"
            :closable="false"
            show-icon
            size="small"
          >
            <template #default>
              当前显示的是30秒内的历史数据，因为没有收到最新的EMANE数据更新。
            </template>
          </el-alert>
        </div>
        

        <div class="view-toggle">
          <el-radio-group v-model="currentView" size="small">
            <el-radio-button label="table">表格视图</el-radio-button>
            <el-radio-button label="chart">图表视图</el-radio-button>
          </el-radio-group>
        </div>
        

        <div v-if="currentView === 'table'">

          <div class="neo-section" v-if="tableMetricData">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right:4px;">
                <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18"/>
              </svg>
              邻居节点指标
            </div>
            <div class="neo-grid">
              <div class="neo-grid-item">
                <div class="item-label">接收包数</div>
                <div class="item-value highlight">{{ tableMetricData.rxPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">发送包数</div>
                <div class="item-value highlight">{{ tableMetricData.txPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">丢失包数</div>
                <div class="item-value">{{ tableMetricData.missedPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">带宽占用时间</div>
                <div class="item-value">{{ tableMetricData.bwUtil }} μs</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">最后接收时间戳</div>
                <div class="item-value">{{ tableMetricData.lastRx.toFixed(3) }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">最后发送时间戳</div>
                <div class="item-value">{{ tableMetricData.lastTx.toFixed(3) }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均SINR</div>
                <div class="item-value">{{ tableMetricData.sinrAvg.toFixed(2) }} dB</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">SINR标准差</div>
                <div class="item-value">{{ tableMetricData.sinrStdv.toFixed(2) }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均噪声基底</div>
                <div class="item-value">{{ tableMetricData.nfAvg.toFixed(2) }} dBm</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">噪声水平标准差</div>
                <div class="item-value">{{ tableMetricData.nfStdv.toFixed(2) }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均接收率</div>
                <div class="item-value">{{ tableMetricData.rxRateAvg.toFixed(2) }} bps</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均发送率</div>
                <div class="item-value">{{ tableMetricData.txRateAvg.toFixed(2) }} bps</div>
              </div>
            </div>
          </div>
          
          

          <div class="neo-section" v-if="tableStatusData">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right:4px;">
                <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18"/>
              </svg>
              邻居节点状态
            </div>
            <div class="neo-grid">
              <div class="neo-grid-item">
                <div class="item-label">接收包数</div>
                <div class="item-value">{{ tableStatusData.rxPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">发送包数</div>
                <div class="item-value">{{ tableStatusData.txPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">丢失包数</div>
                <div class="item-value">{{ tableStatusData.missedPkts }}</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均SINR</div>
                <div class="item-value">{{ tableStatusData.sinrAvg.toFixed(2) }} dB</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">平均噪声基底</div>
                <div class="item-value">{{ tableStatusData.nfAvg.toFixed(2) }} dBm</div>
              </div>
              <div class="neo-grid-item">
                <div class="item-label">自最后一次接收数据包以来的时间</div>
                <div class="item-value">{{ tableStatusData.rxRAge.toFixed(3) }} s</div>
              </div>
            </div>


            <div class="neo-section" v-if="tableRfSignalData && shouldShowRfSignalData">
              <div class="neo-section-title">
                <svg width="16" height="16" style="margin-right:4px;">
                  <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18"/>
                </svg>
                RF信号数据
              </div>
              <div class="neo-grid">
              <div class="neo-grid-item">
                <div class="item-label">频率</div>
                <div class="item-value">{{ (tableRfSignalData.frequencyHz / 1000000).toFixed(2) }} MHz</div>
              </div>
                <div class="neo-grid-item">
                  <div class="item-label">样本数</div>
                  <div class="item-value">{{ tableRfSignalData.numSamples }}</div>
                </div>
                <div class="neo-grid-item">
                  <div class="item-label">平均接收功率</div>
                  <div class="item-value highlight">{{ tableRfSignalData.avgRxPower.toFixed(2) }} dBm</div>
                </div>
                <div class="neo-grid-item">
                  <div class="item-label">平均噪声基底</div>
                  <div class="item-value highlight">{{ tableRfSignalData.avgNoiseFloor.toFixed(2) }} dB</div>
                </div>
                <div class="neo-grid-item">
                  <div class="item-label">平均SINR</div>
                  <div class="item-value highlight">{{ tableRfSignalData.avgSINR.toFixed(2) }} dB</div>
                </div>
              </div>
            </div>
            

            <div class="neo-section rf-unavailable-section" v-else-if="props.link && formattedModelType && formattedModelType !== 'RF Pipe'">
              <div class="neo-section-title">
                <svg width="16" height="16" style="margin-right:4px;">
                  <circle cx="8" cy="8" r="7" fill="#ff9800" fill-opacity="0.18"/>
                </svg>
                RF信号数据
              </div>
              <div class="rf-unavailable-compact">
                <svg width="20" height="20" viewBox="0 0 20 20" class="info-icon-small">
                  <circle cx="10" cy="10" r="9" fill="none" stroke="#ff9800" stroke-width="1"/>
                  <text x="10" y="14" text-anchor="middle" fill="#ff9800" font-size="12">i</text>
                </svg>
                <span>当前模型无RF信号数据。</span>
              </div>
            </div>
          </div>
        </div>
        

        <div v-if="currentView === 'chart'" class="chart-view">
          <!-- 图表类型选择 -->
          <div class="chart-type-selector">
            <el-radio-group v-model="chartType" size="small" @change="handleChartTypeChange">
              <el-radio-button label="line">折线图</el-radio-button>
              <el-radio-button label="bar">柱状图</el-radio-button>
            </el-radio-group>
          </div>

          <div class="chart-tabs">
            <el-tabs v-model="activeChartTab" @tab-click="handleChartTabChange">
              <el-tab-pane label="邻居节点指标" name="metric">
                <div ref="metricChartRef" class="chart-container"></div>
              </el-tab-pane>
              <el-tab-pane label="邻居节点状态" name="status">
                <div ref="statusChartRef" class="chart-container"></div>
              </el-tab-pane>

              <el-tab-pane v-if="shouldShowRfSignalData" label="RF信号数据" name="rfSignal">
                <div ref="rfSignalChartRef" class="chart-container"></div>
              </el-tab-pane>

              <el-tab-pane v-else label="RF信号数据" name="rfSignalUnavailable">
                <div class="rf-data-unavailable">
                  <div class="rf-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="none" stroke="#a5d6a7" stroke-width="2"/>
                      <path d="M12,20 L28,20" stroke="#a5d6a7" stroke-width="2"/>
                      <path d="M12,14 L28,14" stroke="#a5d6a7" stroke-width="2" stroke-opacity="0.6"/>
                      <path d="M12,26 L28,26" stroke="#a5d6a7" stroke-width="2" stroke-opacity="0.6"/>
                    </svg>
                  </div>
                  <div class="rf-unavailable-title">RF信号数据不可用</div>
                </div>
              </el-tab-pane>
            </el-tabs>
        </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick, shallowRef, markRaw } from 'vue';
import { useDraggable } from '../../../composables/useDraggable';
import { useEmaneStore } from '../../../store/modules/emane';
import { useTopoStore } from '../../../store/modules/topo';
import { useNemIdStore } from '../../../store/modules/nemId';
import { storeToRefs } from 'pinia';
import * as echarts from 'echarts';
import type { Link, Node } from '../../../types/topo';
import type { NeighborMetricTable, NeighborStatusTable, RFSignalTable } from '../../../types/emane';

interface EnhancedLink extends Link {
  is_node_monitoring?: boolean;
  nem_id?: number;
  viewpoint_nem_id?: number;
  target_nem_id?: number;
}

interface EnhancedNode extends Node {
  displayModel?: string;
}

const props = defineProps<{
  link?: EnhancedLink;
}>();

const emit = defineEmits(['close']);

const emaneStore = useEmaneStore();
const topoStore = useTopoStore();
const nemIdStore = useNemIdStore();

// 拖拽功能
const emanePanelRef = ref<HTMLElement | null>(null);
const { offsetX: dragOffsetX, offsetY: dragOffsetY } = useDraggable(
  emanePanelRef,
  '.neo-infobox-header'
);
const { loading, lastUpdated } = storeToRefs(emaneStore);

const getEmaneModelType = (nodeId: number): string | null => {
  if (!topoStore.topoData?.nodes || !topoStore.topoData?.links) return null;
  
  const nodeLinks = topoStore.topoData.links.filter(
    (link: Link) => link.node1_id === nodeId || link.node2_id === nodeId
  );
  
  for (const link of nodeLinks) {
    const otherNodeId = link.node1_id === nodeId ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData.nodes.find((n: EnhancedNode) => n.id === otherNodeId);
    
    if (otherNode?.type === 'EMANE') {
      if (otherNode.displayModel) {
        return otherNode.displayModel;
      }
      
      if (otherNode.emane && otherNode.emane.startsWith('emane_')) {
        return otherNode.emane.substring(6);
      }
      return otherNode.emane || null;
    }
  }
  
  return null;
};

const shouldShowRfSignalData = computed(() => {
  if (!selectedNemId.value) return false;
  
  if (!tableRfSignalData.value) return false;
  
  if (props.link) {
    if (props.link.is_node_monitoring) {
      const nodeId = props.link.node1_id;
      const modelType = getEmaneModelType(nodeId);
      return modelType === 'rfpipe';
    }
    
    const sourceModelType = getEmaneModelType(props.link.node1_id);
    const targetModelType = getEmaneModelType(props.link.node2_id);
    
    return sourceModelType === 'rfpipe' || targetModelType === 'rfpipe';
  }
  
  return true;
});

const selectedNemId = ref<number | null>(null);

const viewpointNemId = ref<number | null>(null);

const dataCache = shallowRef<Map<number, {
  metric: NeighborMetricTable | null;
  status: NeighborStatusTable | null;
  rfSignal: RFSignalTable | null;
  timestamp: number;
}>>(new Map());

const isUsingCachedData = ref(false);

const CACHE_VALIDITY_PERIOD = 30000;

// 当前视角 - 源节点或目标节点
const currentPerspective = ref<'source' | 'target'>('source');

// 源节点和目标节点名称和ID
const sourceNodeId = computed(() => {
  if (!props.link) return null;
  return props.link.node1_id;
});

const targetNodeId = computed(() => {
  if (!props.link) return null;
  return props.link.node2_id;
});

const sourceNodeName = computed(() => {
  if (!props.link || !topoStore.topoData?.nodes) return '';
  const node = topoStore.topoData.nodes.find((n: any) => n.id === props.link?.node1_id);
  return node ? (node.alias || node.name) : '未知节点';
});

const targetNodeName = computed(() => {
  if (!props.link || !topoStore.topoData?.nodes) return '';
  const node = topoStore.topoData.nodes.find((n: any) => n.id === props.link?.node2_id);
  return node ? (node.alias || node.name) : '未知节点';
});

// 获取所有可用的视角NEM ID
const availableViewpoints = computed(() => {
  return emaneStore.allViewpointNemIds;
});

// 根据当前选择的视角，获取其所有邻居NEM ID
const neighborNemIds = computed(() => {
  if (!viewpointNemId.value) return [];
  const viewpointData = emaneStore.getViewpointData(viewpointNemId.value);
  if (!viewpointData) return [];

  const nemIds = new Set<number>();
  viewpointData.neighborMetricTables?.forEach(item => nemIds.add(item.nem));
  viewpointData.neighborStatusTables?.forEach(item => nemIds.add(item.nem));
  viewpointData.rfSignalTables?.forEach(item => nemIds.add(item.nem));
  
  // 过滤掉无效的NEM ID
  return Array.from(nemIds).filter(id => id !== 65535).sort((a,b) => a - b);
});

// 当视角变化时，重置选中的邻居NEM ID
const handleViewpointChange = () => {
  selectedNemId.value = null;
  // 如果该视角下有邻居，默认选择第一个
  if (neighborNemIds.value.length > 0) {
    selectedNemId.value = neighborNemIds.value[0];
  }
};

// 源节点和目标节点的NEM ID
const sourceNodeNemId = computed(() => {
  if (!sourceNodeId.value) return null;
  const nodeInfo = nemIdStore.getNemIdsByNodeId(sourceNodeId.value);
  if (!nodeInfo || !nodeInfo.ifaceNemMap) return null;
  
  // 获取第一个接口的NEM ID
  const firstIface = Object.keys(nodeInfo.ifaceNemMap)[0];
  return nodeInfo.ifaceNemMap[firstIface];
});

const targetNodeNemId = computed(() => {
  if (!targetNodeId.value) return null;
  const nodeInfo = nemIdStore.getNemIdsByNodeId(targetNodeId.value);
  if (!nodeInfo || !nodeInfo.ifaceNemMap) return null;
  
  // 获取第一个接口的NEM ID
  const firstIface = Object.keys(nodeInfo.ifaceNemMap)[0];
  return nodeInfo.ifaceNemMap[firstIface];
});

// 根据当前视角获取NEM ID - 始终为对端节点的NEM ID（邻居节点）
const perspectiveNemId = computed(() => {
  if (!props.link) return null;
  
  // 使用新的getNemIdForLink方法，根据视角获取正确的NEM ID
  return emaneStore.getNemIdForLink(
    props.link.node1_id, 
    props.link.node2_id, 
    currentPerspective.value
  );
});

// 使用新添加的方法获取视角NEM ID
const linkViewpointNemId = computed(() => {
  if (!props.link) return null;
  
  return emaneStore.getLinkViewpointNemId(
    props.link.node1_id,
    props.link.node2_id,
    currentPerspective.value
  );
});

// 切换视角函数
const switchPerspective = (perspective: 'source' | 'target') => {
  currentPerspective.value = perspective;
  // 更新选中的NEM ID为邻居节点的NEM ID
  if (perspectiveNemId.value !== null) {
    selectedNemId.value = perspectiveNemId.value;
    // 同时更新视角NEM ID
    viewpointNemId.value = linkViewpointNemId.value;
    
    // 立即更新表格数据
    nextTick(() => {
      // updateTableData();
    });
  }
};

// 视图切换
const currentView = ref<'table' | 'chart'>('table');

// 图表相关
const activeChartTab = ref('metric');
const chartType = ref<'line' | 'bar'>('line');
const metricChartRef = ref<HTMLElement | null>(null);
const statusChartRef = ref<HTMLElement | null>(null);
const rfSignalChartRef = ref<HTMLElement | null>(null);
// 使用shallowRef来保存echarts实例，防止它们变成响应式对象
let metricChart = shallowRef<echarts.ECharts | null>(null);
let statusChart = shallowRef<echarts.ECharts | null>(null);
let rfSignalChart = shallowRef<echarts.ECharts | null>(null);

// 历史数据存储 - 使用shallowRef减少深层响应式转换
const historyData = shallowRef<{
  [nemId: number]: {
    timestamps: Date[];
    metrics: { 
      rxPkts: number[]; 
      txPkts: number[]; 
      missedPkts: number[];
      sinrAvg: number[];
      nfAvg: number[];
    };
    status: { 
      rxPkts: number[]; 
      txPkts: number[]; 
      missedPkts: number[];
      bwUtilRatio: number[];
      sinrAvg: number[];
      nfAvg: number[]; 
    };
    rfSignals: { 
      avgRxPower: number[]; 
      avgNoiseFloor: number[]; 
      avgSINR: number[]; 
      avgINR: number[]; 
    };
  }
}>({});

// 获取所有NEM IDs，过滤掉无效的NEM ID (65535)
const nemIds = computed(() => {
  return emaneStore.allNemIds.filter(nemId => nemId !== 65535);
});

// 判断是否有数据
const hasData = computed(() => {
  return emaneStore.hasEmaneData;
});

// 从缓存获取数据，使用泛型以确保返回类型正确
const getCachedData = <T>(nemId: number, type: 'metric' | 'status' | 'rfSignal'): T | null => {
  if (!nemId) {
    console.warn('尝试获取缓存时NEM ID为空');
    return null;
  }
  
  try {
    const cache = dataCache.value.get(nemId);
    if (cache && cache[type] && (Date.now() - cache.timestamp < CACHE_VALIDITY_PERIOD)) {
      return cache[type] as T;
    } else {
      if (cache) {
      } else {
      }
    }
  } catch (error) {
    console.error(`获取NEM ID ${nemId} 的缓存时出错:`, error);
  }
  return null;
};

// 修改selectedMetric computed属性，使用泛型函数
const tableData = computed(() => {
  if (selectedNemId.value !== null && viewpointNemId.value !== null) {
    const metric = emaneStore.getMetricByNem(selectedNemId.value, viewpointNemId.value);
    const status = emaneStore.getStatusByNem(selectedNemId.value, viewpointNemId.value);
    const rfSignal = emaneStore.getRFSignalByNem(selectedNemId.value, viewpointNemId.value);

    // 更新缓存
    if (metric) updateCache(selectedNemId.value, 'metric', metric);
    if (status) updateCache(selectedNemId.value, 'status', status);
    if (rfSignal) updateCache(selectedNemId.value, 'rfSignal', rfSignal);

    if (metric || status || rfSignal) {
      isUsingCachedData.value = false;
      return { metric, status, rfSignal };
    }
  }

  // 尝试从缓存获取
  if (selectedNemId.value !== null) {
    const cachedMetric = getCachedData<NeighborMetricTable>(selectedNemId.value, 'metric');
    const cachedStatus = getCachedData<NeighborStatusTable>(selectedNemId.value, 'status');
    const cachedRfSignal = getCachedData<RFSignalTable>(selectedNemId.value, 'rfSignal');
    if (cachedMetric || cachedStatus || cachedRfSignal) {
      isUsingCachedData.value = true;
      return { metric: cachedMetric, status: cachedStatus, rfSignal: cachedRfSignal };
    }
  }
  
  return { metric: null, status: null, rfSignal: null };
});

// 从新的 tableData 计算属性中分离出各个部分
const tableMetricData = computed(() => tableData.value.metric);
const tableStatusData = computed(() => tableData.value.status);
const tableRfSignalData = computed(() => tableData.value.rfSignal);

// 根据链路信息确定要显示的NEM ID
const findNemIdForLink = () => {
  // 如果没有提供链路，直接返回
  if (!props.link) return;
  
  // 记录查找过程以便调试
  
  // 如果是从WirelessLinkInfoPanel传递过来的视角和目标NEM ID，优先使用它
  if (props.link.viewpoint_nem_id !== undefined && props.link.target_nem_id !== undefined) {
    viewpointNemId.value = props.link.viewpoint_nem_id;
    selectedNemId.value = props.link.target_nem_id;
    return;
  }

  // 如果是从WirelessLinkInfoPanel传递过来的视角NEM ID，优先使用它
  if (props.link.viewpoint_nem_id !== undefined && props.link.viewpoint_nem_id !== null) {
    viewpointNemId.value = props.link.viewpoint_nem_id;

    // 从该视角下的邻居中选择一个默认的selectedNemId
    const viewpointData = emaneStore.getViewpointData(viewpointNemId.value);
    if (viewpointData && viewpointData.neighborMetricTables.length > 0) {
      selectedNemId.value = viewpointData.neighborMetricTables[0].nem;
    }
    return;
  }
  
  // 如果是节点监控模式，直接使用传递的 NEM ID
  if (props.link.is_node_monitoring && props.link.nem_id) {
    selectedNemId.value = props.link.nem_id;
    // 初始化节点缓存
    if (!dataCache.value.has(props.link.nem_id)) {
      dataCache.value.set(props.link.nem_id, {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
    return;
  }
  
  // 使用优化后的方法获取NEM ID
  const targetNemId = emaneStore.getNemIdForLink(
    props.link.node1_id, 
    props.link.node2_id, 
    currentPerspective.value
  );
  
  // 使用新方法获取视角NEM ID，如果之前没有设置的话
  if (viewpointNemId.value === null) {
    const viewpointId = emaneStore.getLinkViewpointNemId(
      props.link.node1_id,
      props.link.node2_id,
      currentPerspective.value
    );
    viewpointNemId.value = viewpointId;
  }
  
  if (targetNemId !== null) {
    selectedNemId.value = targetNemId;
    
    // 立即初始化该NEM ID的缓存
    if (!dataCache.value.has(targetNemId)) {
      dataCache.value.set(targetNemId, {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
    return;
  }
  
  // 尝试直接从源节点和目标节点获取NEM ID
  if (sourceNodeNemId.value) {
    selectedNemId.value = sourceNodeNemId.value;
    // 初始化缓存
    if (!dataCache.value.has(sourceNodeNemId.value)) {
      dataCache.value.set(sourceNodeNemId.value, {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
    return;
  }
  
  if (targetNodeNemId.value) {
    selectedNemId.value = targetNodeNemId.value;
    // 初始化缓存
    if (!dataCache.value.has(targetNodeNemId.value)) {
      dataCache.value.set(targetNodeNemId.value, {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
    return;
  }
  
  // 如果无法根据链路确定NEM ID，则使用第一个可用的NEM ID
  if (nemIds.value.length > 0 && !selectedNemId.value) {
    selectedNemId.value = nemIds.value[0];
    // 初始化缓存
    if (!dataCache.value.has(nemIds.value[0])) {
      dataCache.value.set(nemIds.value[0], {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
  } else {
    console.warn('无法找到任何可用的NEM ID');
  }
};

// 更新历史数据，确保每种数据类型正确添加到对应数据组
const updateHistoryData = () => {
  if (!selectedNemId.value) return;
  
  // 获取最新数据，确保非空
  const metric = tableMetricData.value;
  const status = tableStatusData.value;
  const rfSignal = tableRfSignalData.value;
  
  if (!metric && !status && !rfSignal) return;
  
  const nemId = selectedNemId.value;
  
  // 为该NEM初始化历史数据结构（如果不存在）
  if (!historyData.value[nemId]) {
    historyData.value[nemId] = {
      timestamps: [],
      metrics: { 
        rxPkts: [], 
        txPkts: [], 
        missedPkts: [],
        sinrAvg: [],
        nfAvg: []
      },
      status: { 
        rxPkts: [], 
        txPkts: [], 
        missedPkts: [],
        bwUtilRatio: [],
        sinrAvg: [],
        nfAvg: []
      },
      rfSignals: { 
        avgRxPower: [], 
        avgNoiseFloor: [], 
        avgSINR: [], 
        avgINR: [] 
      }
    };
  }
  
  const now = new Date();
  
  // 添加新的时间戳
  historyData.value[nemId].timestamps.push(now);
  
  // 添加指标数据 - 只有在有指标数据时添加
  if (metric) {
    historyData.value[nemId].metrics.rxPkts.push(metric.rxPkts);
    historyData.value[nemId].metrics.txPkts.push(metric.txPkts);
    historyData.value[nemId].metrics.missedPkts.push(metric.missedPkts);
    historyData.value[nemId].metrics.sinrAvg.push(metric.sinrAvg);
    historyData.value[nemId].metrics.nfAvg.push(metric.nfAvg);
  }
  
  // 添加状态数据 - 只有在有状态数据时添加
  if (status) {
    historyData.value[nemId].status.rxPkts.push(status.rxPkts);
    historyData.value[nemId].status.txPkts.push(status.txPkts);
    historyData.value[nemId].status.missedPkts.push(status.missedPkts);
    historyData.value[nemId].status.bwUtilRatio.push(status.bwUtilRatio);
    historyData.value[nemId].status.sinrAvg.push(status.sinrAvg);
    historyData.value[nemId].status.nfAvg.push(status.nfAvg);
  }
  
  // 添加RF信号数据 - 只有在有RF信号数据时添加
  if (rfSignal) {
    historyData.value[nemId].rfSignals.avgRxPower.push(rfSignal.avgRxPower);
    historyData.value[nemId].rfSignals.avgNoiseFloor.push(rfSignal.avgNoiseFloor);
    historyData.value[nemId].rfSignals.avgSINR.push(rfSignal.avgSINR);
    historyData.value[nemId].rfSignals.avgINR.push(rfSignal.avgINR);
  }
  
  // 限制历史数据长度，保留最新的30个数据点
  const MAX_HISTORY_POINTS = 30;
  if (historyData.value[nemId].timestamps.length > MAX_HISTORY_POINTS) {
    historyData.value[nemId].timestamps = historyData.value[nemId].timestamps.slice(-MAX_HISTORY_POINTS);
    
    // 指标数据裁剪
    historyData.value[nemId].metrics.rxPkts = historyData.value[nemId].metrics.rxPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].metrics.txPkts = historyData.value[nemId].metrics.txPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].metrics.missedPkts = historyData.value[nemId].metrics.missedPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].metrics.sinrAvg = historyData.value[nemId].metrics.sinrAvg.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].metrics.nfAvg = historyData.value[nemId].metrics.nfAvg.slice(-MAX_HISTORY_POINTS);
    
    // 状态数据裁剪
    historyData.value[nemId].status.rxPkts = historyData.value[nemId].status.rxPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].status.txPkts = historyData.value[nemId].status.txPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].status.missedPkts = historyData.value[nemId].status.missedPkts.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].status.bwUtilRatio = historyData.value[nemId].status.bwUtilRatio.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].status.sinrAvg = historyData.value[nemId].status.sinrAvg.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].status.nfAvg = historyData.value[nemId].status.nfAvg.slice(-MAX_HISTORY_POINTS);
    
    // RF信号数据裁剪
    historyData.value[nemId].rfSignals.avgRxPower = historyData.value[nemId].rfSignals.avgRxPower.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].rfSignals.avgNoiseFloor = historyData.value[nemId].rfSignals.avgNoiseFloor.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].rfSignals.avgSINR = historyData.value[nemId].rfSignals.avgSINR.slice(-MAX_HISTORY_POINTS);
    historyData.value[nemId].rfSignals.avgINR = historyData.value[nemId].rfSignals.avgINR.slice(-MAX_HISTORY_POINTS);
  }
};

// 初始化邻居节点指标图表
const initMetricChart = () => {
  if (!metricChartRef.value) return;

  // 确保先销毁现有实例
  if (metricChart.value) {
    metricChart.value.dispose();
  }

  const chart = echarts.init(metricChartRef.value);
  chart.setOption(markRaw({
    title: {
      text: '邻居节点指标变化趋势',
      left: 'center',
      textStyle: {
        color: '#eaf6ff',
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 5
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValueLabel + '<br/>';
        params.forEach((item: any) => {
          let value = item.value;
          let unit = '';
          if (item.seriesName.includes('SINR')) unit = ' dB';
          else if (item.seriesName.includes('噪声')) unit = ' dBm';
          else if (item.seriesName.includes('包数')) unit = ' 个';
          result += `${item.marker} ${item.seriesName}: ${value}${unit}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['接收包数', '发送包数', '丢失包数', 'SINR平均值', '平均噪声基底'],
      textStyle: {
        color: '#eaf6ff',
        fontSize: 11
      },
      top: 35,
      itemGap: 10,
      itemWidth: 16,
      itemHeight: 10
    },
    grid: {
      left: '10%',
      right: '15%',
      top: '15%',
      bottom: '10%',
      containLabel: false
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: [],
      axisLabel: {
        color: '#eaf6ff',
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '包数量',
        position: 'left',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 0, 0, 10]
        },
        nameLocation: 'end',
        nameGap: 10,
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      {
        type: 'value',
        name: 'SINR/噪声(dB)',
        position: 'right',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 10, 0, 0]
        },
        nameLocation: 'end',
        nameGap: 10,
        splitLine: {
          show: false
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        }
      }
    ],
    series: [
      {
        name: '接收包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#47d147'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '发送包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#47b8e0'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '丢失包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ff5733'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: 'SINR平均值',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#00eaff'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '平均噪声基底',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ffcc00'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      }
    ],
    backgroundColor: 'rgba(8, 15, 39, 0.6)'
  }));

  // 保存图表实例
  metricChart.value = chart;
};

// 初始化邻居节点状态图表
const initStatusChart = () => {
  if (!statusChartRef.value) return;

  // 确保先销毁现有实例
  if (statusChart.value) {
    statusChart.value.dispose();
  }

  const chart = echarts.init(statusChartRef.value);
  chart.setOption(markRaw({
    title: {
      text: '邻居节点状态变化趋势',
      left: 'center',
      textStyle: {
        color: '#eaf6ff',
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 5
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValueLabel + '<br/>';
        params.forEach((item: any) => {
          let value = item.value;
          let unit = '';
          if (item.seriesName.includes('SINR')) unit = ' dB';
          else if (item.seriesName.includes('噪声')) unit = ' dBm';
          else if (item.seriesName.includes('包数')) unit = ' 个';
          else if (item.seriesName.includes('带宽')) unit = ' %';
          result += `${item.marker} ${item.seriesName}: ${value}${unit}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['接收包数', '发送包数', '丢失包数', '带宽利用率', 'SINR平均值', '平均噪声基底'],
      textStyle: {
        color: '#eaf6ff',
        fontSize: 10
      },
      top: 35,
      itemGap: 8,
      itemWidth: 14,
      itemHeight: 8,
      orient: 'horizontal'
    },
    grid: {
      left: '10%',
      right: '20%',
      top: '18%',
      bottom: '10%',
      containLabel: false
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: [],
      axisLabel: {
        color: '#eaf6ff',
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '包数量',
        position: 'left',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 0, 0, 10]
        },
        nameLocation: 'end',
        nameGap: 10,
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      {
        type: 'value',
        name: 'SINR/噪声(dB)',
        position: 'right',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 10, 0, 0]
        },
        nameLocation: 'end',
        nameGap: 10,
        splitLine: {
          show: false
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        }
      },
      {
        type: 'value',
        name: '带宽利用率(%)',
        position: 'right',
        offset: 60,
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11,
          formatter: '{value}%'
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 5, 0, 0]
        },
        nameLocation: 'end',
        nameGap: 10,
        splitLine: {
          show: false
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        }
      }
    ],
    series: [
      {
        name: '接收包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#47d147'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '发送包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#47b8e0'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '丢失包数',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ff5733'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '带宽利用率比例',
        type: chartType.value,
        yAxisIndex: 2,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#80FFA5'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: 'SINR平均值',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#00eaff'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '平均噪声基底',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ffcc00'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      }
    ],
    backgroundColor: 'rgba(8, 15, 39, 0.6)'
  }));

  // 保存图表实例
  statusChart.value = chart;
};

// 初始化RF信号图表
const initRfSignalChart = () => {
  if (!rfSignalChartRef.value) return;

  // 确保先销毁现有实例
  if (rfSignalChart.value) {
    rfSignalChart.value.dispose();
  }

  const chart = echarts.init(rfSignalChartRef.value);
  chart.setOption(markRaw({
    title: {
      text: 'RF信号数据变化趋势',
      left: 'center',
      textStyle: {
        color: '#eaf6ff',
        fontSize: 16,
        fontWeight: 'bold'
      },
      top: 5
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValueLabel + '<br/>';
        params.forEach((item: any) => {
          let value = item.value;
          let unit = item.seriesName.includes('SINR') || item.seriesName.includes('INR') ? ' dB' : ' dBm';
          result += `${item.marker} ${item.seriesName}: ${value.toFixed(2)}${unit}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['平均接收功率', '平均噪声基底', '平均SINR', '平均INR'],
      textStyle: {
        color: '#eaf6ff',
        fontSize: 11
      },
      top: 35,
      itemGap: 12,
      itemWidth: 16,
      itemHeight: 10
    },
    grid: {
      left: '10%',
      right: '15%',
      top: '15%',
      bottom: '10%',
      containLabel: false
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: [],
      axisLabel: {
        color: '#eaf6ff',
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '功率/噪声(dBm)',
        position: 'left',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 0, 0, 10]
        },
        nameLocation: 'end',
        nameGap: 15,
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      {
        type: 'value',
        name: 'SINR/INR(dB)',
        position: 'right',
        axisLabel: {
          color: '#eaf6ff',
          fontSize: 11
        },
        nameTextStyle: {
          color: '#a5d6a7',
          fontSize: 12,
          fontWeight: 'bold',
          padding: [0, 10, 0, 0]
        },
        nameLocation: 'end',
        nameGap: 15,
        splitLine: {
          show: false
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        },
        axisTick: {
          show: true,
          lineStyle: {
            color: '#a5d6a7'
          }
        }
      }
    ],
    series: [
      {
        name: '平均接收功率',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ff5733'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '平均噪声基底',
        type: chartType.value,
        yAxisIndex: 0,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ffcc00'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '平均SINR',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#00eaff'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      },
      {
        name: '平均INR',
        type: chartType.value,
        yAxisIndex: 1,
        data: [],
        smooth: chartType.value === 'line',
        lineStyle: chartType.value === 'line' ? {
          width: 2
        } : undefined,
        itemStyle: {
          color: '#ff9900'
        },
        barWidth: chartType.value === 'bar' ? '60%' : undefined
      }
    ],
    backgroundColor: 'rgba(8, 15, 39, 0.6)'
  }));

  // 保存图表实例
  rfSignalChart.value = chart;
};

// 处理图表类型切换
const handleChartTypeChange = () => {
  // 重新初始化当前活跃的图表
  nextTick(() => {
    if (activeChartTab.value === 'metric') {
      initMetricChart();
    } else if (activeChartTab.value === 'status') {
      initStatusChart();
    } else if (activeChartTab.value === 'rfSignal') {
      initRfSignalChart();
    }
    updateCharts();
  });
};

// 更新图表数据
const updateCharts = () => {
  if (!selectedNemId.value) return;

  // 确保历史数据存在
  if (!historyData.value[selectedNemId.value]) {
    historyData.value[selectedNemId.value] = {
      timestamps: [],
      metrics: {
        rxPkts: [],
        txPkts: [],
        missedPkts: [],
        sinrAvg: [],
        nfAvg: []
      },
      status: {
        rxPkts: [],
        txPkts: [],
        missedPkts: [],
        bwUtilRatio: [],
        sinrAvg: [],
        nfAvg: []
      },
      rfSignals: {
        avgRxPower: [],
        avgNoiseFloor: [],
        avgSINR: [],
        avgINR: []
      }
    };
    return; // 初始化数据后退出，等待下一次更新
  }

  const nemId = selectedNemId.value;
  const nemData = historyData.value[nemId];

  // 更新邻居节点指标图表
  if (metricChart.value) {
    metricChart.value.setOption({
      xAxis: {
        data: nemData.timestamps
      },
      series: [
        {
          name: '接收包数',
          type: chartType.value,
          data: nemData.metrics.rxPkts
        },
        {
          name: '发送包数',
          type: chartType.value,
          data: nemData.metrics.txPkts
        },
        {
          name: '丢失包数',
          type: chartType.value,
          data: nemData.metrics.missedPkts
        },
        {
          name: 'SINR平均值',
          type: chartType.value,
          data: nemData.metrics.sinrAvg
        },
        {
          name: '平均噪声基底',
          type: chartType.value,
          data: nemData.metrics.nfAvg
        }
      ]
    });
  }

  // 更新邻居节点状态图表
  if (statusChart.value) {
    statusChart.value.setOption({
      xAxis: {
        data: nemData.timestamps
      },
      series: [
        {
          name: '接收包数',
          type: chartType.value,
          yAxisIndex: 0,
          data: nemData.status.rxPkts
        },
        {
          name: '发送包数',
          type: chartType.value,
          yAxisIndex: 0,
          data: nemData.status.txPkts
        },
        {
          name: '丢失包数',
          type: chartType.value,
          yAxisIndex: 0,
          data: nemData.status.missedPkts
        },
        {
          name: '带宽利用率',
          type: chartType.value,
          yAxisIndex: 2,
          data: nemData.status.bwUtilRatio.map(ratio => (ratio * 100).toFixed(2)) // 转换为百分比
        },
        {
          name: 'SINR平均值',
          type: chartType.value,
          yAxisIndex: 1,
          data: nemData.status.sinrAvg
        },
        {
          name: '平均噪声基底',
          type: chartType.value,
          yAxisIndex: 1,
          data: nemData.status.nfAvg
        }
      ]
    });
  }

  // 更新RF信号图表
  if (rfSignalChart.value) {
    rfSignalChart.value.setOption({
      xAxis: {
        data: nemData.timestamps
      },
      series: [
        {
          name: '平均接收功率',
          type: chartType.value,
          data: nemData.rfSignals.avgRxPower
        },
        {
          name: '平均噪声基底',
          type: chartType.value,
          data: nemData.rfSignals.avgNoiseFloor
        },
        {
          name: '平均SINR',
          type: chartType.value,
          data: nemData.rfSignals.avgSINR
        },
        {
          name: '平均INR',
          type: chartType.value,
          data: nemData.rfSignals.avgINR
        }
      ]
    });
  }
};

// 处理图表标签切换
const handleChartTabChange = () => {
  // 使用nextTick确保DOM已更新
  nextTick(() => {
    // 给一点延迟等待DOM更新和可能的CSS过渡
    setTimeout(() => {
      if (activeChartTab.value === 'metric' && !metricChart.value) {
        initMetricChart();
      } else if (activeChartTab.value === 'status' && !statusChart.value) {
        initStatusChart();
      } else if (activeChartTab.value === 'rfSignal' && !rfSignalChart.value) {
        initRfSignalChart();
      }
      
      // 无论是否新创建图表，都确保当前活跃的图表调整大小
      if (activeChartTab.value === 'metric' && metricChart.value) {
        metricChart.value.resize();
      } else if (activeChartTab.value === 'status' && statusChart.value) {
        statusChart.value.resize();
      } else if (activeChartTab.value === 'rfSignal' && rfSignalChart.value) {
        rfSignalChart.value.resize();
      }
      
      updateCharts();
    }, 100);
  });
};

// 处理视图切换
watch(currentView, (newView, oldView) => {
  if (oldView === 'chart') {
    // 离开图表视图时，销毁所有图表实例并清空引用，
    // 防止切回图表视图时残留的旧实例阻止重新初始化
    if (metricChart.value) { metricChart.value.dispose(); metricChart.value = null; }
    if (statusChart.value) { statusChart.value.dispose(); statusChart.value = null; }
    if (rfSignalChart.value) { rfSignalChart.value.dispose(); rfSignalChart.value = null; }
  }
  if (newView === 'chart') {
    // 当切换到图表视图时，先给一点延迟等待CSS过渡效果完成，然后初始化当前活跃标签的图表
    setTimeout(() => {
      nextTick(() => {
        if (activeChartTab.value === 'metric') {
          initMetricChart();
        } else if (activeChartTab.value === 'status') {
          initStatusChart();
        } else if (activeChartTab.value === 'rfSignal') {
          initRfSignalChart();
        }
        updateCharts();
        // 确保图表适应新的容器尺寸
        if (activeChartTab.value === 'metric' && metricChart.value) metricChart.value.resize();
        else if (activeChartTab.value === 'status' && statusChart.value) statusChart.value.resize();
        else if (activeChartTab.value === 'rfSignal' && rfSignalChart.value) rfSignalChart.value.resize();
      });
    }, 400); // 增加400ms延迟，与CSS过渡时间匹配
  }
});

// 监听NEM ID变化
watch(selectedNemId, () => {
  updateCharts();
});

// 监听视角变化
watch(currentPerspective, () => {
  // 当视角变化时，更新选中的NEM ID和视角NEM ID
  if (perspectiveNemId.value !== null) {
    selectedNemId.value = perspectiveNemId.value;
    viewpointNemId.value = linkViewpointNemId.value;
    
    // 更新表格和图表数据
    nextTick(() => {
      // updateTableData();
      // 不需要立即更新历史数据，等待下一次数据更新
      updateCharts();
    });
  }
});

// 监听EMANE数据变化
watch([() => emaneStore.lastUpdated, selectedNemId, viewpointNemId], () => {
  if (selectedNemId.value) {
    // 数据更新由 computed 属性自动处理
    // updateTableData();
    updateHistoryData();
    updateCharts();
  }
}, { deep: true });

// 增强数据更新逻辑
// 页面挂载时
onMounted(() => {
  // 如果提供了链路信息，查找对应的NEM ID
  if (props.link) {
    watch([() => props.link, nemIds], () => {
      findNemIdForLink();
      // 初始数据加载后更新表格数据
      nextTick(() => {
        // updateTableData();
        
        // 初始化时启用双视角数据对比 - 仅对链路模式
        if (props.link && !props.link.is_node_monitoring) {
          showDualPerspective.value = true;
        }
      });
    }, { immediate: true, deep: true });
  } 
  // 否则，让用户通过下拉菜单选择
  else {
    // 默认选择第一个可用的视角
    if (availableViewpoints.value.length > 0 && !viewpointNemId.value) {
      viewpointNemId.value = availableViewpoints.value[0];
      handleViewpointChange(); // 自动选择第一个邻居
    }
  }
  
  // 订阅EMANE数据更新
  startDataSubscription();
});

// 添加数据订阅定时器
let dataRefreshInterval: number | null = null;

// 启动数据刷新
const startDataSubscription = () => {
  if (dataRefreshInterval) {
    clearInterval(dataRefreshInterval);
  }
  
  // 每2秒刷新一次数据
  dataRefreshInterval = window.setInterval(() => {
    if (selectedNemId.value) {
      // 不再需要手动调用 updateTableData
      updateHistoryData();
      updateCharts();
    }
  }, 2000);
};

// 停止数据刷新
const stopDataSubscription = () => {
  if (dataRefreshInterval) {
    clearInterval(dataRefreshInterval);
    dataRefreshInterval = null;
  }
};

// 组件卸载前清理
onBeforeUnmount(() => {
  stopDataSubscription();
  window.removeEventListener('resize', handleResize);
  
  // 销毁图表实例
  if (metricChart.value) metricChart.value.dispose();
  if (statusChart.value) statusChart.value.dispose();
  if (rfSignalChart.value) rfSignalChart.value.dispose();
  
  // 清空引用
  metricChart.value = null;
  statusChart.value = null;
  rfSignalChart.value = null;
});

// 窗口大小变化时，重新调整图表大小
const handleResize = () => {
  if (metricChart.value) metricChart.value.resize();
  if (statusChart.value) statusChart.value.resize();
  if (rfSignalChart.value) rfSignalChart.value.resize();
};

// 监听窗口大小变化
window.addEventListener('resize', handleResize);

// 格式化时间显示
const formatTime = (date: Date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

// 更新数据缓存
const updateCache = (nemId: number, type: 'metric' | 'status' | 'rfSignal', data: any) => {
  if (!nemId) {
    console.warn('尝试更新缓存时NEM ID为空');
    return;
  }
  
  try {
    if (!dataCache.value.has(nemId)) {
      dataCache.value.set(nemId, {
        metric: null,
        status: null,
        rfSignal: null,
        timestamp: Date.now()
      });
    }
    
    const cache = dataCache.value.get(nemId);
    if (cache) {
      // 直接设置对应类型的数据
      cache[type] = JSON.parse(JSON.stringify(data)); // 深拷贝以避免引用问题
      cache.timestamp = Date.now();
    }
  } catch (error) {
    console.error(`更新NEM ID ${nemId} 的缓存时出错:`, error);
  }
};

// 双视角数据展示开关
const showDualPerspective = ref(false);

// 源节点和目标节点视角的统计数据
const sourcePerspectiveStats = computed(() => {
  if (!sourceNodeNemId.value || !targetNodeNemId.value) return null;
  
  return getPerspectiveStats(sourceNodeNemId.value, targetNodeNemId.value);
});

const targetPerspectiveStats = computed(() => {
  if (!sourceNodeNemId.value || !targetNodeNemId.value) return null;
  
  return getPerspectiveStats(targetNodeNemId.value, sourceNodeNemId.value);
});

// 获取特定视角下的统计数据
const getPerspectiveStats = (viewpointNemId: number, targetNemId: number) => {
  const stats = {
    sinrAvg: undefined as number | undefined,
    avgRxPower: undefined as number | undefined,
    avgNoiseFloor: undefined as number | undefined,
  };
  
  // 从RF信号获取数据
  const rfSignal = emaneStore.getRFSignalByNem(targetNemId, viewpointNemId);
  if (rfSignal) {
    stats.avgRxPower = rfSignal.avgRxPower;
    stats.avgNoiseFloor = rfSignal.avgNoiseFloor;
    stats.sinrAvg = rfSignal.avgSINR;
  }
  
  // 如果没有RF信号数据，尝试从指标数据获取SINR
  if (stats.sinrAvg === undefined) {
    const metric = emaneStore.getMetricByNem(targetNemId, viewpointNemId);
    if (metric && Number.isFinite(metric.sinrAvg)) {
      stats.sinrAvg = metric.sinrAvg;
    }
  }
  
  return stats;
};

// 添加判断是否为rfpipe模型的计算属性
const isRfPipeModel = computed(() => {
  if (!props.link) return false;
  
  // 检查源节点和目标节点连接的EMANE模型
  const sourceModelType = getEmaneModelType(props.link.node1_id);
  const targetModelType = getEmaneModelType(props.link.node2_id);
  
  // 使用第一个非空的模型类型
  const modelType = sourceModelType || targetModelType;
  
  return modelType === 'rfpipe';
});

// 链路质量评估
const linkQualityClass = computed(() => {
  if (!sourcePerspectiveStats.value?.sinrAvg && !targetPerspectiveStats.value?.sinrAvg) {
    return 'quality-unknown';
  }
  
  // 计算平均SINR
  const sourceSinr = sourcePerspectiveStats.value?.sinrAvg || 0;
  const targetSinr = targetPerspectiveStats.value?.sinrAvg || 0;
  const avgSinr = (sourceSinr + targetSinr) / (sourceSinr && targetSinr ? 2 : 1);
  
  if (avgSinr > 25) return 'quality-excellent';
  if (avgSinr > 15) return 'quality-good';
  if (avgSinr > 10) return 'quality-fair';
  return 'quality-poor';
});

// 链路质量文字描述
const linkQualityText = computed(() => {
  if (!sourcePerspectiveStats.value?.sinrAvg && !targetPerspectiveStats.value?.sinrAvg) {
    return '未知';
  }
  
  const qualityClass = linkQualityClass.value;
  switch (qualityClass) {
    case 'quality-excellent': return '优秀';
    case 'quality-good': return '良好';
    case 'quality-fair': return '一般';
    case 'quality-poor': return '较差';
    default: return '未知';
  }
});

// 获取并格式化当前链路使用的EMANE模型类型
const formattedModelType = computed(() => {
  if (!props.link) return '';
  
  // 检查源节点和目标节点连接的EMANE模型
  const sourceModelType = getEmaneModelType(props.link.node1_id);
  const targetModelType = getEmaneModelType(props.link.node2_id);
  
  // 使用第一个非空的模型类型
  const modelType = sourceModelType || targetModelType;
  
  // 将模型类型转换为更友好的显示格式
  switch(modelType) {
    case 'rfpipe':
      return 'RF Pipe';
    case 'tdma':
      return 'TDMA';
    case 'ieee80211abg':
      return 'IEEE 802.11 a/b/g';
    case 'bypass':
      return 'Bypass';
    case 'commeffect':
      return 'CommEffect';
    default:
      return modelType ? modelType.toUpperCase() : '未知';
  }
});

// 获取模型描述
const modelDescription = computed(() => {
  if (!props.link) return '';
  
  // 检查源节点和目标节点连接的EMANE模型
  const sourceModelType = getEmaneModelType(props.link.node1_id);
  const targetModelType = getEmaneModelType(props.link.node2_id);
  
  // 使用第一个非空的模型类型
  const modelType = sourceModelType || targetModelType;
  
  // 返回相应的描述
  switch(modelType) {
    case 'rfpipe':
      return '无线频率管道模型，用于模拟基本射频通信，支持RF信号数据';
    case 'tdma':
      return '时分多址接入模型，适用于模拟多用户时分接入场景';
    case 'ieee80211abg':
      return 'WiFi模型，基于IEEE 802.11 a/b/g标准';
    case 'bypass':
      return '简单的旁路模型，适用于直接测试';
    case 'commeffect':
      return '通信效果模型，提供基础的延迟和丢包功能';
    default:
      return '未知模型类型';
  }
});

// 获取模型状态类名
const modelStatusClass = computed(() => {
  if (!props.link) return '';
  
  // 检查源节点和目标节点连接的EMANE模型
  const sourceModelType = getEmaneModelType(props.link.node1_id);
  const targetModelType = getEmaneModelType(props.link.node2_id);
  
  // 使用第一个非空的模型类型
  const modelType = sourceModelType || targetModelType;
  
  // 为不同模型返回不同的类名
  switch(modelType) {
    case 'rfpipe':
      return 'model-rf';
    case 'tdma':
      return 'model-tdma';
    case 'ieee80211abg':
      return 'model-ieee';
    case 'bypass':
      return 'model-bypass';
    case 'commeffect':
      return 'model-commeffect';
    default:
      return 'model-unknown';
  }
});
</script>

<style scoped>
.emane-panel {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 9999;
}

.neo-infobox {
  background: linear-gradient(135deg, rgba(8, 15, 39, 0.85) 0%, rgba(17, 23, 64, 0.9) 100%);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: min(408px, calc(100vw - 40px));
  min-width: 300px;
  min-height: 150px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(76, 175, 80, 0.2);
  color: white;
  transform-origin: bottom left;
  animation: infobox-appear 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  resize: both;
}

@keyframes infobox-appear {
  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.neo-infobox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.4) 0%, rgba(76, 175, 80, 0.2) 100%);
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  font-weight: 600;
  font-size: 16px;
  color: #4caf50;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  position: relative;
  flex: 0 0 auto; /* 防止头部收缩 */
}

.neo-infobox-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 15%;
  width: 70%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.7), transparent);
}

.neo-infobox-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
  display: flex;
  align-items: center;
}

.neo-infobox-close {
  cursor: pointer;
  color: rgba(76, 175, 80, 0.8);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(76, 175, 80, 0.1);
  transition: all 0.2s ease;
}

.neo-infobox-close:hover {
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.3);
  transform: rotate(90deg);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
}

.neo-infobox-content {
  padding: 14px;
  overflow-y: auto;
  flex: 1 1 auto; /* 内容区域自适应 */
  max-height: calc(80vh - 60px); /* 减去header高度 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.neo-infobox-content::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
  width: 0;
  height: 0;
}

.neo-section {
  margin-bottom: 16px;
  animation: section-appear 0.5s ease forwards;
  opacity: 0;
  transform: translateY(10px);
}

.neo-section:nth-child(1) { animation-delay: 0.1s; }
.neo-section:nth-child(2) { animation-delay: 0.2s; }
.neo-section:nth-child(3) { animation-delay: 0.3s; }

@keyframes section-appear {
  to { opacity: 1; transform: translateY(0); }
}

.neo-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: rgba(76, 175, 80, 0.9);
  letter-spacing: 0.5px;
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
  background-color: rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(76, 175, 80, 0.05);
}

.neo-grid-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(76, 175, 80, 0.15);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.1);
  transform: scale(1.02);
}

.item-label {
  color: #a5d6a7;
  font-size: 15px;
  font-weight: 400;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}

.item-value {
  color: #e8f5e9;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.item-value.highlight {
  color: #4caf50;
  text-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

.panel-icon {
  margin-right: 6px;
}

.node-selector {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  background: rgba(0, 40, 30, 0.3);
  padding: 10px;
  border-radius: 8px;
  border-left: 3px solid rgba(76, 175, 80, 0.4);
}

.selector-label {
  color: #a5d6a7;
  font-size: 13px;
  margin-right: 10px;
}

.nem-selector {
  flex: 1;
}

.nem-selector :deep(.el-input__inner) {
  background: rgba(0, 60, 30, 0.3);
  border: 1px solid rgba(76, 175, 80, 0.3);
  color: #e8f5e9;
}

.last-updated {
  font-size: 12px;
  color: #a5d6a7;
  margin-left: 10px;
}

.loading-indicator, .no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #a5d6a7;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(76, 175, 80, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4caf50;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.info-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(76, 175, 80, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4caf50;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  border: 2px solid rgba(76, 175, 80, 0.4);
}

/* 视角切换控件样式 */
.perspective-toggle {
  margin-top: 12px;
  background: rgba(0, 60, 30, 0.15);
  padding: 12px;
  border-radius: 8px;
}

.toggle-label {
  color: #a5d6a7;
  font-size: 13px;
  margin-bottom: 8px;
}

.toggle-buttons {
  display: flex;
  gap: 10px;
}

.perspective-btn {
  flex: 1;
  padding: 8px 0;
  border: 1px solid rgba(76, 175, 80, 0.3);
  background: rgba(0, 60, 30, 0.2);
  color: #a5d6a7;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.perspective-btn:hover {
  background: rgba(0, 60, 30, 0.4);
  border-color: rgba(76, 175, 80, 0.5);
}

.perspective-btn.active {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.4), rgba(76, 175, 80, 0.6));
  color: #ffffff;
  border-color: rgba(76, 175, 80, 0.6);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}

/* 图表类型选择器样式 */
.chart-type-selector {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  padding: 8px;
  background: rgba(0, 40, 30, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.chart-type-selector :deep(.el-radio-button__inner) {
  background-color: rgba(0, 40, 30, 0.4);
  border-color: rgba(76, 175, 80, 0.4);
  color: #a5d6a7;
  font-size: 13px;
  padding: 8px 16px;
}

.chart-type-selector :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: rgba(76, 175, 80, 0.6);
  border-color: rgba(76, 175, 80, 0.6);
  color: #ffffff;
  box-shadow: -1px 0 0 0 rgba(76, 175, 80, 0.6);
}

.chart-type-selector :deep(.el-radio-button:hover .el-radio-button__inner) {
  color: #4caf50;
}

/* 视图切换样式 */
.view-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.view-toggle :deep(.el-radio-button__inner) {
  background-color: rgba(0, 40, 30, 0.4);
  border-color: rgba(76, 175, 80, 0.4);
  color: #a5d6a7;
}

.view-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: rgba(76, 175, 80, 0.6);
  border-color: rgba(76, 175, 80, 0.6);
  color: #ffffff;
  box-shadow: -1px 0 0 0 rgba(76, 175, 80, 0.6);
}

/* 图表样式 */
.chart-view {
  margin-top: 10px;
  padding: 12px;
  background: rgba(8, 15, 39, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(76, 175, 80, 0.15);
  transition: all 0.4s ease;
}

.chart-container {
  height: 380px;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  animation: fade-in 0.5s ease-in-out;
  border: 1px solid rgba(76, 175, 80, 0.1);
  background: rgba(8, 15, 39, 0.6);
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.3);
  transition: height 0.4s ease, width 0.4s ease;
  position: relative;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.chart-tabs {
  margin-top: 8px;
}

.chart-tabs :deep(.el-tabs__header) {
  background: rgba(0, 40, 30, 0.3);
  border-radius: 8px;
  margin-bottom: 8px;
  border-bottom: none;
  padding: 4px;
}

.chart-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 8px;
}

.chart-tabs :deep(.el-tabs__item) {
  color: #a5d6a7;
  font-size: 13px;
  font-weight: 500;
  padding: 0 16px;
  height: 36px;
  line-height: 36px;
  transition: all 0.3s;
  margin: 0 2px;
  border-radius: 4px;
}

.chart-tabs :deep(.el-tabs__item:hover) {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.chart-tabs :deep(.el-tabs__item.is-active) {
  color: #4caf50;
  font-weight: bold;
  background: rgba(76, 175, 80, 0.2);
  transform: scale(1.02);
}

.chart-tabs :deep(.el-tabs__active-bar) {
  background-color: #4caf50;
  height: 3px;
  border-radius: 2px;
}

.chart-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: rgba(76, 175, 80, 0.2);
  height: 1px;
}

/* 响应式样式 */
@media screen and (max-width: 768px) {
  .neo-infobox {
    width: min(350px, calc(100vw - 30px));
    left: 15px;
    bottom: 15px;
  }

  .neo-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
  }

  .chart-tabs :deep(.el-tabs__item) {
    font-size: 12px;
    padding: 0 12px;
    height: 32px;
    line-height: 32px;
  }

  .node-selector {
    flex-direction: column;
    align-items: flex-start;
  }

  .selector-label {
    margin-bottom: 8px;
  }

  .nem-selector {
    width: 100%;
  }

  .last-updated {
    margin-left: 0;
    margin-top: 6px;
  }

  .toggle-buttons {
    flex-direction: column;
  }
}

@media screen and (max-width: 480px) {
  .neo-infobox {
    width: calc(100vw - 20px);
    left: 10px;
    bottom: 10px;
    max-height: 85vh;
  }

  .neo-infobox-title {
    max-width: 200px;
    font-size: 14px;
  }

  .neo-section-title {
    font-size: 13px;
  }

  .item-label {
    font-size: 13px;
  }

  .item-value {
    font-size: 13px;
  }

  .chart-container {
    height: 250px;
  }

  .chart-tabs :deep(.el-tabs__item) {
    font-size: 11px;
    padding: 0 8px;
    height: 30px;
    line-height: 30px;
  }

  .chart-type-selector :deep(.el-radio-button__inner) {
    font-size: 11px;
    padding: 6px 12px;
  }

  .neo-infobox-header {
    padding: 12px 14px;
  }

  .neo-infobox-content {
    padding: 10px;
  }
}

/* 特别处理低高度屏幕 */
@media screen and (max-height: 700px) {
  .neo-infobox {
    max-height: 95vh;
    bottom: 10px;
  }
  
  .chart-container {
    height: 200px;
  }
  
  .loading-indicator, .no-data-message {
    min-height: 150px;
  }
}

/* 图表模式下的面板样式 */
.neo-infobox.chart-mode {
  width: min(700px, calc(100vw - 40px));
  max-width: 95vw;
}

.chart-mode .chart-container {
  height: min(420px, 45vh);
}

@media screen and (max-width: 768px) {
  .neo-infobox.chart-mode {
    width: min(580px, calc(100vw - 30px));
  }

  .chart-mode .chart-container {
    height: min(350px, 40vh);
  }
}

@media screen and (max-width: 480px) {
  .neo-infobox.chart-mode {
    width: calc(100vw - 20px);
  }

  .chart-mode .chart-container {
    height: 280px;
  }
}

/* 链路信息块样式 */
.link-info {
  margin-bottom: 16px;
}

.node-info-block {
  background: rgba(30, 144, 255, 0.06);
  border-radius: 8px;
  padding: 10px;
  border-left: 3px solid rgba(0, 122, 255, 0.4);
  margin-bottom: 10px;
}

.node-info-title {
  font-size: 14px;
  color: #4caf50;
  margin-bottom: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.item-value.highlight {
  color: #4caf50;
  text-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

.info-message {
  color: #a5d6a7;
  font-size: 14px;
}

/* 缓存数据指示器样式 */
.cache-indicator {
  margin-bottom: 15px;
}

.cache-indicator :deep(.el-alert) {
  background-color: rgba(255, 153, 0, 0.15);
  border: 1px solid rgba(255, 153, 0, 0.3);
  color: #ffcc80;
}

.cache-indicator :deep(.el-alert__title) {
  color: #ffaa00;
  font-weight: bold;
}

.cache-indicator :deep(.el-alert__icon) {
  color: #ffaa00;
}

/* 双视角数据样式 */
.dual-perspective-stats {
  margin-top: 15px;
  background: rgba(30, 144, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(76, 175, 80, 0.2);
  animation: fade-in 0.5s ease;
}

.dual-stats-header {
  color: #4caf50;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  text-align: center;
  letter-spacing: 0.5px;
}

.dual-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.perspective-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.perspective-title {
  text-align: center;
  font-size: 13px;
  color: #a5d6a7;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  margin-bottom: 5px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 5px 8px;
  border-radius: 4px;
}

.stat-label {
  color: #a5d6a7;
}

.stat-value {
  color: #e8f5e9;
  font-weight: 500;
}

.link-quality-indicator {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 5px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.link-quality-label {
  color: #a5d6a7;
  font-size: 13px;
}

.link-quality-value {
  font-size: 14px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 3px;
}

.quality-excellent {
  color: #00e676;
  background: rgba(0, 230, 118, 0.15);
  text-shadow: 0 0 10px rgba(0, 230, 118, 0.5);
}

.quality-good {
  color: #76ff03;
  background: rgba(118, 255, 3, 0.15);
  text-shadow: 0 0 10px rgba(118, 255, 3, 0.5);
}

.quality-fair {
  color: #ffeb3b;
  background: rgba(255, 235, 59, 0.15);
  text-shadow: 0 0 10px rgba(255, 235, 59, 0.5);
}

.quality-poor {
  color: #ff3d00;
  background: rgba(255, 61, 0, 0.15);
  text-shadow: 0 0 10px rgba(255, 61, 0, 0.5);
}

.quality-unknown {
  color: #9e9e9e;
  background: rgba(158, 158, 158, 0.15);
}

.toggle-dual-perspective {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

@media screen and (max-width: 480px) {
  .dual-stats-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .perspective-column:first-child {
    border-bottom: 1px dashed rgba(76, 175, 80, 0.2);
    padding-bottom: 10px;
  }
}

/* 添加模型类型显示样式 */
.model-type-info {
  margin-top: 15px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 20, 40, 0.3);
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.model-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.model-label {
  font-weight: 500;
  color: #a5d6a7;
}

.model-value {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}


/* 不同模型类型的颜色样式 */
.model-rf {
  background: linear-gradient(135deg, rgba(0, 150, 136, 0.2), rgba(0, 150, 136, 0.4));
  border-left: 3px solid #009688;
}

.model-tdma {
  background: linear-gradient(135deg, rgba(63, 81, 181, 0.2), rgba(63, 81, 181, 0.4));
  border-left: 3px solid #3f51b5;
}

.model-ieee {
  background: linear-gradient(135deg, rgba(233, 30, 99, 0.2), rgba(233, 30, 99, 0.4));
  border-left: 3px solid #e91e63;
}

.model-bypass {
  background: linear-gradient(135deg, rgba(158, 158, 158, 0.2), rgba(158, 158, 158, 0.4));
  border-left: 3px solid #9e9e9e;
}

.model-commeffect {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(255, 152, 0, 0.4));
  border-left: 3px solid #ff9800;
}

.model-unknown {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(244, 67, 54, 0.4));
  border-left: 3px solid #f44336;
}

/* RF信号数据不可用的样式 */
.rf-data-unavailable {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 30px 20px;
  text-align: center;
  background: rgba(8, 15, 39, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(165, 214, 167, 0.2);
  width: 100%;
  height: 300px;
}

.rf-icon {
  margin-bottom: 20px;
  opacity: 0.7;
}

.rf-unavailable-title {
  font-size: 18px;
  font-weight: 600;
  color: #a5d6a7;
  margin-bottom: 15px;
}

.rf-unavailable-message {
  font-size: 14px;
  color: #8bc34a;
  margin-bottom: 20px;
  line-height: 1.5;
  max-width: 400px;
}

/* RF信号数据不可用的精简提示 */
.rf-unavailable-section {
  border-left: 3px solid #ff9800;
}

.rf-unavailable-compact {
  display: flex;
  align-items: center;
  padding: 10px;
  background: rgba(255, 152, 0, 0.1);
  border-radius: 6px;
  margin: 5px 0;
  font-size: 13px;
  color: #ffcc80;
  line-height: 1.4;
}

.info-icon-small {
  min-width: 20px;
  margin-right: 10px;
}
</style> 