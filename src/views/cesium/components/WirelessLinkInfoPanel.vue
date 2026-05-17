<template>
  <div class="neo-infobox" v-if="link" ref="wirelessPanelRef" :style="{ transform: `translate(${dragOffsetX}px, ${dragOffsetY}px)` }">
    <div class="neo-infobox-header">
      <span class="neo-infobox-title">
        <svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
          <path
            d="M8 1.5 C 7 3 5.5 4.5 4 5 A 7 7 0 0 0 14 5 C 12.5 4.5 11 3 10 1.5"
            stroke="#4caf50"
            stroke-width="1.5"
            fill="none"
          />
          <path
            d="M8 5.5 C 7 7 5.5 8.5 4 9 A 7 7 0 0 0 14 9 C 12.5 8.5 11 7 10 5.5"
            stroke="#4caf50"
            stroke-width="1.5"
            fill="none"
          />
          <path
            d="M8 9.5 C 7 11 5.5 12.5 4 13 A 7 7 0 0 0 14 13 C 12.5 12.5 11 11 10 9.5"
            stroke="#4caf50"
            stroke-width="1.5"
            fill="none"
          />
        </svg>
        无线链路信息
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
            <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18" />
          </svg>
          基本信息
        </div>

        <div class="node-info-block">
          <div class="node-info-title">源节点</div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">节点名称</div>
              <div class="item-value">{{ sourceNodeName }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">节点ID</div>
              <div class="item-value">{{ link.node1_id }}</div>
            </div>
          </div>
        </div>

        <div class="node-info-block">
          <div class="node-info-title">目标节点</div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">节点名称</div>
              <div class="item-value">{{ targetNodeName }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">节点ID</div>
              <div class="item-value">{{ link.node2_id }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasEmaneData" class="neo-section">
        <div class="neo-section-title">
          <svg width="16" height="16" style="margin-right: 4px">
            <circle cx="8" cy="8" r="7" fill="#00eaff" fill-opacity="0.18" />
          </svg>
          EMANE链路状态
        </div>
        
        <div class="cache-indicator" v-if="isUsingCachedData">
          <div class="cache-warning">
            <svg width="16" height="16" viewBox="0 0 16 16" style="margin-right:4px;">
              <path d="M8 1L15 15H1L8 1Z" fill="#ffaa00" fill-opacity="0.3" stroke="#ffaa00" stroke-width="1"/>
              <text x="8" y="13" text-anchor="middle" font-size="10" font-weight="bold" fill="#ffaa00">!</text>
            </svg>
            正在显示缓存数据 (30秒内)
          </div>
        </div>
        
        <!-- 简要指标数据 -->
        <div class="emane-brief-data">
          <div class="neo-grid">
            <div class="neo-grid-item highlight" v-if="isRfPipeModel">
              <div class="item-label">平均接收功率</div>
              <div class="item-value">
                {{ rfSignalData ? rfSignalData.avgRxPower.toFixed(2) : "0" }}
                {{ rfSignalData ? "dBm" : "" }}
              </div>
            </div>
            <!-- <div class="neo-grid-item highlight">
              <div class="item-label">平均SINR</div>
              <div class="item-value">
                {{ getSinrValue() }}
              </div>
            </div> -->
            <div class="neo-grid-item">
              <div class="item-label">接收包数</div>
              <div class="item-value">{{ metricData ? metricData.rxPkts : "0" }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">发送包数</div>
              <div class="item-value">{{ metricData ? metricData.txPkts : "0" }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">丢失包数</div>
              <div class="item-value">{{ metricData ? metricData.missedPkts : "0" }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">带宽占用</div>
              <div class="item-value">{{ metricData ? metricData.bwUtil + " μs" : "0 μs" }}</div>
            </div>
          </div>
        </div>

        <!-- 简化图表 -->
        <div ref="miniChartRef" class="mini-chart-container"></div>
      </div>

      <!-- 新增：实时链路质量 -->
      <div v-if="hasEmaneData && (hasSourcePerspectiveData || hasTargetPerspectiveData)" class="neo-section">
        <div class="neo-section-title">
          <svg width="16" height="16" style="margin-right: 4px">
            <circle cx="8" cy="8" r="7" fill="#81c784" fill-opacity="0.18" />
          </svg>
          实时链路质量
        </div>
        <div class="dual-perspective-stats">
          <div class="dual-stats-grid">
            <div class="perspective-column">
              <div class="perspective-title">{{ sourceNodeName }} 视角</div>
              <div class="stat-row" v-if="sourcePerspectiveStats?.avgRxPower !== undefined">
                <div class="stat-label">平均接收功率</div>
                <div class="stat-value">{{ sourcePerspectiveStats.avgRxPower.toFixed(2) }} dBm</div>
              </div>
              <!-- <div class="stat-row" v-if="sourcePerspectiveStats?.sinrAvg !== undefined">
                <div class="stat-label">平均SINR</div>
                <div class="stat-value">{{ sourcePerspectiveStats.sinrAvg.toFixed(2) }} dB</div>
              </div> -->
              <div class="stat-row" v-if="sourcePerspectiveStats?.rxPkts !== undefined">
                <div class="stat-label">接收包数</div>
                <div class="stat-value">{{ sourcePerspectiveStats.rxPkts }}</div>
              </div>
              <div class="stat-row" v-if="sourcePerspectiveStats?.txPkts !== undefined">
                <div class="stat-label">发送包数</div>
                <div class="stat-value">{{ sourcePerspectiveStats.txPkts }}</div>
              </div>
              <div class="stat-row" v-if="sourcePerspectiveStats?.missedPkts !== undefined">
                <div class="stat-label">丢失包数</div>
                <div class="stat-value">{{ sourcePerspectiveStats.missedPkts }}</div>
              </div>
              <div class="no-data-tip" v-if="!hasSourcePerspectiveData">
                <span>该视角暂无数据</span>
              </div>
            </div>
            
            <div class="perspective-column">
              <div class="perspective-title">{{ targetNodeName }} 视角</div>
              <div class="stat-row" v-if="targetPerspectiveStats?.avgRxPower !== undefined">
                <div class="stat-label">平均接收功率</div>
                <div class="stat-value">{{ targetPerspectiveStats.avgRxPower.toFixed(2) }} dBm</div>
              </div>
              <!-- <div class="stat-row" v-if="targetPerspectiveStats?.sinrAvg !== undefined">
                <div class="stat-label">平均SINR</div>
                <div class="stat-value">{{ targetPerspectiveStats.sinrAvg.toFixed(2) }} dB</div>
              </div> -->
              <div class="stat-row" v-if="targetPerspectiveStats?.rxPkts !== undefined">
                <div class="stat-label">接收包数</div>
                <div class="stat-value">{{ targetPerspectiveStats.rxPkts }}</div>
              </div>
              <div class="stat-row" v-if="targetPerspectiveStats?.txPkts !== undefined">
                <div class="stat-label">发送包数</div>
                <div class="stat-value">{{ targetPerspectiveStats.txPkts }}</div>
              </div>
              <div class="stat-row" v-if="targetPerspectiveStats?.missedPkts !== undefined">
                <div class="stat-label">丢失包数</div>
                <div class="stat-value">{{ targetPerspectiveStats.missedPkts }}</div>
              </div>
              <div class="no-data-tip" v-if="!hasTargetPerspectiveData">
                <span>该视角暂无数据</span>
              </div>
            </div>
          </div>
          
          <div class="link-quality-indicator">
            <div class="link-quality-label">链路质量评估:</div>
            <div class="link-quality-value" :class="linkQualityClass">{{ linkQualityText }}</div>
          </div>
        </div>
      </div>



      <div v-else class="no-emane-data">
        <div class="info-message">暂无数据，等待消息更新...</div>
      </div>

      <!-- 操作按钮 -->
      <div class="neo-actions">
        <button class="neo-btn monitor-btn" @click="handleShowDetails">
          <el-icon :size="16" color="#ffffff"><Monitor /></el-icon>
          显示详细监控
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  shallowRef,
} from "vue";
import { useTopoStore } from "../../../store/modules/topo";
import { useEmaneStore } from "../../../store/modules/emane";
import { useNemIdStore } from "../../../store/modules/nemId";
import type { Link, Node } from "../../../types/topo";
import type { NeighborMetricTable, RFSignalTable } from "../../../types/emane";

import { Monitor } from "@element-plus/icons-vue";
import eventBus from "../../../utils/eventBus";
import * as echarts from "echarts";
import { useDraggable } from '../../../composables/useDraggable';


interface EnhancedLink extends Link {
  is_node_monitoring?: boolean;
  nem_id?: number;
  viewpoint_nem_id?: number;
  model?: string;
}

const props = defineProps<{ link: EnhancedLink }>();
const emit = defineEmits(["close"]);

const wirelessPanelRef = ref<HTMLElement | null>(null);
const { offsetX: dragOffsetX, offsetY: dragOffsetY } = useDraggable(
  wirelessPanelRef,
  '.neo-infobox-header'
);

const topoStore = useTopoStore();
const emaneStore = useEmaneStore();
const nemIdStore = useNemIdStore();

const isSimulationRunning = ref(false);

const miniChartRef = ref<HTMLElement | null>(null);
let miniChart: echarts.ECharts | null = null;
const historyData = shallowRef<{
  timestamps: Date[];
  avgRxPower: number[];
  avgSINR: number[];
  rxPkts: number[];
  txPkts: number[];
  missedPkts: number[];
}>({
  timestamps: [],
  avgRxPower: [],
  avgSINR: [],
  rxPkts: [],
  txPkts: [],
  missedPkts: [],
});

const activeViewpointNemId = ref<number | null>(null);
const activeTargetNemId = ref<number | null>(null);

const sourceNodeName = computed(() => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
    return "未知节点";
  }
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node1_id);
  return node ? (node.alias || node.name) : "未知节点";
});

const targetNodeName = computed(() => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
    return "未知节点";
  }
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node2_id);
  return node ? (node.alias || node.name) : "未知节点";
});

watch(
  () => [props.link, emaneStore.lastUpdated],
  () => {
    if (!props.link) return;

    const viewpoint1 = emaneStore.getLinkViewpointNemId(props.link.node1_id, props.link.node2_id, 'source');
    const target1 = emaneStore.getNemIdForLink(props.link.node1_id, props.link.node2_id, 'source');

    if (viewpoint1 && target1) {
      const data = emaneStore.getRFSignalByNem(target1, viewpoint1) || emaneStore.getMetricByNem(target1, viewpoint1);
      if (data) {
        activeViewpointNemId.value = viewpoint1;
        activeTargetNemId.value = target1;
        return;
      }
    }

    const viewpoint2 = emaneStore.getLinkViewpointNemId(props.link.node1_id, props.link.node2_id, 'target');
    const target2 = emaneStore.getNemIdForLink(props.link.node1_id, props.link.node2_id, 'target');

    if (viewpoint2 && target2) {
      const data = emaneStore.getRFSignalByNem(target2, viewpoint2) || emaneStore.getMetricByNem(target2, viewpoint2);
      if (data) {
        activeViewpointNemId.value = viewpoint2;
        activeTargetNemId.value = target2;
        return;
      }
    }

    activeViewpointNemId.value = null;
    activeTargetNemId.value = null;
  },
  { immediate: true, deep: true }
);

const sourceNodeNemId = computed(() => {
  const nodeInfo = nemIdStore.getNemIdsByNodeId(props.link.node1_id);
  return nodeInfo && nodeInfo.ifaceNemMap ? Object.values(nodeInfo.ifaceNemMap)[0] : null;
});

const targetNodeNemId = computed(() => {
  const nodeInfo = nemIdStore.getNemIdsByNodeId(props.link.node2_id);
  return nodeInfo && nodeInfo.ifaceNemMap ? Object.values(nodeInfo.ifaceNemMap)[0] : null;
});

const getPerspectiveStats = (viewpointNemId: number, targetNemId: number) => {
  const stats = {
    sinrAvg: undefined as number | undefined,
    avgRxPower: undefined as number | undefined,
    avgNoiseFloor: undefined as number | undefined,
    rxPkts: undefined as number | undefined,
    txPkts: undefined as number | undefined,
    missedPkts: undefined as number | undefined,
  };
  
  const rfSignal = emaneStore.getRFSignalByNem(targetNemId, viewpointNemId);
  if (rfSignal) {
    stats.avgRxPower = rfSignal.avgRxPower;
    stats.avgNoiseFloor = rfSignal.avgNoiseFloor;
    stats.sinrAvg = rfSignal.avgSINR;
  }
  
  const metric = emaneStore.getMetricByNem(targetNemId, viewpointNemId);
  if (metric) {
    stats.rxPkts = metric.rxPkts;
    stats.txPkts = metric.txPkts;
    stats.missedPkts = metric.missedPkts;
  }
  
  // 如果没有获取到SINR数据，尝试从metric中获取（可能来自数据复制）
  if (stats.sinrAvg === undefined && metric && Number.isFinite(metric.sinrAvg)) {
    stats.sinrAvg = metric.sinrAvg;
  }
  
  return stats;
};

const sourcePerspectiveStats = computed(() => {
  if (!sourceNodeNemId.value || !targetNodeNemId.value) return null;
  return getPerspectiveStats(sourceNodeNemId.value, targetNodeNemId.value);
});

const targetPerspectiveStats = computed(() => {
  if (!sourceNodeNemId.value || !targetNodeNemId.value) return null;
  return getPerspectiveStats(targetNodeNemId.value, sourceNodeNemId.value);
});

const linkQualityClass = computed(() => {
  const hasSinrData = (sourcePerspectiveStats.value?.sinrAvg !== undefined || 
                       targetPerspectiveStats.value?.sinrAvg !== undefined);
  
  if (!hasSinrData) {
    return 'quality-unknown';
  }
  
  let totalSinr = 0;
  let count = 0;
  
  if (sourcePerspectiveStats.value?.sinrAvg !== undefined) {
    totalSinr += sourcePerspectiveStats.value.sinrAvg;
    count++;
  }
  
  if (targetPerspectiveStats.value?.sinrAvg !== undefined) {
    totalSinr += targetPerspectiveStats.value.sinrAvg;
    count++;
  }
  
  if (count === 0) return 'quality-unknown';
  
  const avgSinr = totalSinr / count;
  
  if (avgSinr > 25) return 'quality-excellent';
  if (avgSinr > 15) return 'quality-good';
  if (avgSinr > 10) return 'quality-fair';
  return 'quality-poor';
});

const linkQualityText = computed(() => {
  const hasSinrData = (sourcePerspectiveStats.value?.sinrAvg !== undefined || 
                       targetPerspectiveStats.value?.sinrAvg !== undefined);
  
  if (!hasSinrData) {
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

const metricData = computed<NeighborMetricTable | null>(() => {
  if (!activeTargetNemId.value || !activeViewpointNemId.value) return null;
  return emaneStore.getMetricByNem(activeTargetNemId.value, activeViewpointNemId.value) || null;
});

const rfSignalData = computed<RFSignalTable | null>(() => {
  if (!activeTargetNemId.value || !activeViewpointNemId.value) return null;
  return emaneStore.getRFSignalByNem(activeTargetNemId.value, activeViewpointNemId.value) || null;
});

const hasEmaneData = computed(() => {
  return emaneStore.hasEmaneData && (metricData.value !== null || rfSignalData.value !== null);
});

const isUsingCachedData = computed(() => {
  if (!activeViewpointNemId.value) return false;
  const viewData = emaneStore.getViewpointData(activeViewpointNemId.value);
  if (!viewData || !viewData.lastUpdated) return true; // 如果没有更新时间，则认为是旧数据
  return (Date.now() - viewData.lastUpdated.getTime()) > 30000;
});

const updateHistoryData = () => {
  if (!rfSignalData.value && !metricData.value) return;

  const now = new Date();

  try {
    historyData.value.timestamps.push(now);
    
    if (isRfPipeModel.value) {
      historyData.value.avgRxPower.push(
        rfSignalData.value && Number.isFinite(rfSignalData.value.avgRxPower) ? rfSignalData.value.avgRxPower : 0
      );
    } else {
      historyData.value.avgRxPower.push(0);
    }
    
    if (isRfPipeModel.value && rfSignalData.value && Number.isFinite(rfSignalData.value.avgSINR)) {
      historyData.value.avgSINR.push(rfSignalData.value.avgSINR);
    } else if (metricData.value && Number.isFinite(metricData.value.sinrAvg)) {
      historyData.value.avgSINR.push(metricData.value.sinrAvg);
    } else {
      historyData.value.avgSINR.push(0);
    }
    
    historyData.value.rxPkts.push(
      metricData.value && Number.isFinite(metricData.value.rxPkts) ? metricData.value.rxPkts : 0
    );
    historyData.value.txPkts.push(
      metricData.value && Number.isFinite(metricData.value.txPkts) ? metricData.value.txPkts : 0
    );
    historyData.value.missedPkts.push(
      metricData.value && Number.isFinite(metricData.value.missedPkts) ? metricData.value.missedPkts : 0
    );

    const MAX_HISTORY_POINTS = 10;
    if (historyData.value.timestamps.length > MAX_HISTORY_POINTS) {
      historyData.value.timestamps = historyData.value.timestamps.slice(
        -MAX_HISTORY_POINTS
      );
      historyData.value.avgRxPower = historyData.value.avgRxPower.slice(
        -MAX_HISTORY_POINTS
      );
      historyData.value.avgSINR = historyData.value.avgSINR.slice(-MAX_HISTORY_POINTS);
      historyData.value.rxPkts = historyData.value.rxPkts.slice(-MAX_HISTORY_POINTS);
      historyData.value.txPkts = historyData.value.txPkts.slice(-MAX_HISTORY_POINTS);
      historyData.value.missedPkts = historyData.value.missedPkts.slice(-MAX_HISTORY_POINTS);
    }
  } catch (error) {
    console.error("更新链路监控历史数据出错:", error);
  }
};

const updateChart = () => {
  if (!miniChart || !historyData.value.timestamps) return;

  try {
    const seriesData = [
      {
        name: "平均SINR",
        data: historyData.value.avgSINR,
      },
      {
        name: "接收包数",
        data: historyData.value.rxPkts,
      },
      {
        name: "发送包数",
        data: historyData.value.txPkts,
      },
      {
        name: "丢失包数",
        data: historyData.value.missedPkts,
      }
    ];
    
    if (isRfPipeModel.value) {
      seriesData.unshift({
        name: "平均接收功率",
        data: historyData.value.avgRxPower,
      });
    }
    
    miniChart.setOption({
      xAxis: {
        data: historyData.value.timestamps,
      },
      series: seriesData,
    });
  } catch (error) {
    console.error("更新链路监控图表出错:", error);
  }
};

const initMiniChart = () => {
  if (!miniChartRef.value) return;

  try {
    if (miniChart) {
      miniChart.dispose();
    }

    const seriesData = [];
    
    if (isRfPipeModel.value) {
      seriesData.push({
        name: "平均接收功率",
        type: "line",
        data: [],
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: "#66bb6a",
        },
      });
    }
    
    seriesData.push({
      name: "平均SINR",
      type: "line",
      data: [],
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
      },
      itemStyle: {
        color: "#00eaff",
      },
    });
    
    seriesData.push(
      {
        name: "接收包数",
        type: "line",
        yAxisIndex: 1,
        data: [],
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: "#ff9800",
        },
      },
      {
        name: "发送包数",
        type: "line",
        yAxisIndex: 1,
        data: [],
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: "#2196f3",
        },
      },
      {
        name: "丢失包数",
        type: "line",
        yAxisIndex: 1,
        data: [],
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: "#f44336",
        },
      }
    );
    
    const legendData = ["平均SINR", "接收包数", "发送包数", "丢失包数"];
    const legendSelected = {
      '接收包数': false,
      '发送包数': false,
      '丢失包数': false
    };
    
    if (isRfPipeModel.value) {
      legendData.unshift("平均接收功率");
    }

    miniChart = echarts.init(miniChartRef.value);
    miniChart.setOption({
      grid: {
        left: "5%",
        right: "5%",
        bottom: "12%",
        top: "12%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          if (!params || params.length === 0) return "";

          let result = params[0].axisValueLabel + "<br/>";
          params.forEach((item: any) => {
            if (!item) return;

            let value = item.value;
            let unit = "";
            if (item.seriesName.includes("SINR") || item.seriesName.includes("功率")) {
              unit = item.seriesName.includes("SINR") ? "dB" : "dBm";
            }
            result += `${item.marker} ${item.seriesName}: ${
              Number.isFinite(value) ? value.toFixed(2) : "N/A"
            } ${unit}<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: legendData,
        textStyle: {
          color: "#eaf6ff",
          fontSize: 10
        },
        top: 0,
        selected: legendSelected
      },
      xAxis: {
        type: "category",
        data: [],
        axisLabel: {
          color: "#eaf6ff",
          formatter: (value: string) => {
            if (!value) return "";
            try {
              const date = new Date(value);
              return `${date
                .getMinutes()
                .toString()
                .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
            } catch (e) {
              return "";
            }
          },
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: "rgba(76, 175, 80, 0.3)",
          },
        },
      },
      yAxis: [
        {
          type: "value",
          name: "dB/dBm",
          axisLabel: {
            color: "#eaf6ff",
            fontSize: 10,
          },
          splitLine: {
            lineStyle: {
              color: "rgba(255, 255, 255, 0.1)",
            },
          },
        },
        {
          type: "value",
          name: "包数",
          axisLabel: {
            color: "#eaf6ff",
            fontSize: 10,
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: seriesData,
      backgroundColor: "transparent",
    });
  } catch (error) {
    console.error("初始化链路监控图表出错:", error);
  }
};





const handleShowDetails = () => {
  const enhancedLink = { 
    ...props.link,
    viewpoint_nem_id: activeViewpointNemId.value,
    target_nem_id: activeTargetNemId.value
  };
  
  eventBus.emit("startEmaneMonitor", { link: enhancedLink });

  emit("close");
};

watch(
  [() => rfSignalData.value, () => metricData.value, () => hasEmaneData.value],
  ([newRfSignal, newMetric, newHasData]) => {
    if (newHasData && (newRfSignal || newMetric)) {
      updateHistoryData();
      nextTick(() => {
        updateChart();
      });
    }
  },
  { deep: true }
);



const handleStartSimulationEvent = () => {
  isSimulationRunning.value = true;
};

const handleStopSimulationEvent = () => {
  isSimulationRunning.value = false;
};

const setupSimulationListeners = () => {
  eventBus.on("startSimulation", handleStartSimulationEvent);
  eventBus.on("stopSimulation", handleStopSimulationEvent);
};

const removeSimulationListeners = () => {
  eventBus.off("startSimulation", handleStartSimulationEvent);
  eventBus.off("stopSimulation", handleStopSimulationEvent);
};

onMounted(() => {
  initMiniChart();
  setupSimulationListeners();

  window.addEventListener("resize", handleResize);

  if (topoStore.topoData && topoStore.topoData.state === "RUNTIME") {
    isSimulationRunning.value = true;
  }
});

const handleResize = () => {
  if (miniChart) miniChart.resize();
};

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);

  removeSimulationListeners();

  if (miniChart) {
    miniChart.dispose();
    miniChart = null;
  }
});



const hasSourcePerspectiveData = computed(() => {
  if (!sourcePerspectiveStats.value) return false;
  return (
    sourcePerspectiveStats.value.avgRxPower !== undefined ||
    sourcePerspectiveStats.value.sinrAvg !== undefined ||
    sourcePerspectiveStats.value.rxPkts !== undefined ||
    sourcePerspectiveStats.value.txPkts !== undefined ||
    sourcePerspectiveStats.value.missedPkts !== undefined
  );
});

const hasTargetPerspectiveData = computed(() => {
  if (!targetPerspectiveStats.value) return false;
  return (
    targetPerspectiveStats.value.avgRxPower !== undefined ||
    targetPerspectiveStats.value.sinrAvg !== undefined ||
    targetPerspectiveStats.value.rxPkts !== undefined ||
    targetPerspectiveStats.value.txPkts !== undefined ||
    targetPerspectiveStats.value.missedPkts !== undefined
  );
});

const getSinrValue = () => {
  if (isRfPipeModel.value && rfSignalData.value && Number.isFinite(rfSignalData.value.avgSINR)) {
    return rfSignalData.value.avgSINR.toFixed(2) + " dB";
  }
  
  if (metricData.value && Number.isFinite(metricData.value.sinrAvg)) {
    return metricData.value.sinrAvg.toFixed(2) + " dB";
  }
  
  return "N/A";
};

const isRfPipeModel = computed(() => {
  return props.link.model === "rfpipe";
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
  width: min(408px, calc(100vw - 40px));
  min-width: 300px;
  min-height: 150px;
  overflow: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(76, 175, 80, 0.2);
  color: white;
  transform-origin: top right;
  animation: infobox-appear 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
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
    rgba(76, 175, 80, 0.4) 0%,
    rgba(76, 175, 80, 0.2) 100%
  );
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  font-weight: 600;
  font-size: 16px;
  color: #4caf50;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  position: relative;
  flex: 0 0 auto; /* 防止头部被压缩 */
}
.neo-infobox-header::after {
  content: "";
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
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* 隐藏WebKit浏览器的滚动条 */
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
.neo-section:nth-child(1) {
  animation-delay: 0.1s;
}
.neo-section:nth-child(2) {
  animation-delay: 0.2s;
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

/* 高亮的grid-item */
.neo-grid-item.highlight {
  background-color: rgba(0, 234, 255, 0.08);
  border-color: rgba(0, 234, 255, 0.15);
}
.neo-grid-item.highlight:hover {
  background-color: rgba(0, 234, 255, 0.12);
  border-color: rgba(0, 234, 255, 0.25);
  box-shadow: 0 0 10px rgba(0, 234, 255, 0.15);
}
.neo-grid-item.highlight .item-label {
  color: #7fdfff;
}
.neo-grid-item.highlight .item-value {
  color: #00eaff;
  text-shadow: 0 0 8px rgba(0, 198, 255, 0.4);
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
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.5px;
}

/* 节点信息块样式 */
.node-info-block {
  margin-top: 14px;
  background: rgba(76, 175, 80, 0.06);
  border-radius: 8px;
  padding: 10px;
  border-left: 3px solid rgba(76, 175, 80, 0.4);
}

.node-info-title {
  font-size: 14px;
  color: #4caf50;
  margin-bottom: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.panel-icon {
  margin-right: 6px;
}

/* 操作按钮样式 */
.neo-actions {
  display: flex;
  justify-content: flex-end;
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

.monitor-btn {
  background: linear-gradient(to right, #2e7d32, #4caf50);
  color: #ffffff;
}

.monitor-btn:hover {
  background: linear-gradient(to right, #4caf50, #66bb6a);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
}

.btn-icon {
  filter: drop-shadow(0 0 4px currentColor);
}

/* 简化版图表样式 */
.mini-chart-container {
  height: 120px;
  width: 100%;
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.15);
  animation: fade-in 0.5s ease-in-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* EMANE数据简要视图 */
.emane-brief-data {
  background: rgba(0, 60, 30, 0.15);
  padding: 10px;
  border-radius: 8px;
  margin-top: 10px;
  border-left: 3px solid rgba(76, 175, 80, 0.4);
}

/* 无EMANE数据提示 */
.no-emane-data {
  padding: 16px;
  text-align: center;
  background: rgba(0, 60, 30, 0.15);
  border-radius: 8px;
  margin: 12px 0;
}

.info-message {
  color: #a5d6a7;
  font-size: 14px;
}

/* 响应式媒体查询 */
@media screen and (max-width: 768px) {
  .neo-infobox {
    width: min(350px, calc(100vw - 30px));
    top: 15px;
    right: 15px;
  }

  .neo-grid {
    grid-template-columns: 1fr;
  }

  .mini-chart-container {
    height: 100px;
  }
  
  .neo-actions {
    justify-content: center;
  }
}

@media screen and (max-width: 480px) {
  .neo-infobox {
    width: calc(100vw - 20px);
    top: 10px;
    right: 10px;
  }

  .neo-actions {
    flex-direction: column;
    gap: 8px;
  }

  .neo-infobox-title {
    max-width: 200px;
    font-size: 14px;
  }

  .mini-chart-container {
    height: 80px;
  }
  
  .neo-infobox-header {
    padding: 12px 14px;
  }
  
  .neo-infobox-content {
    padding: 10px;
  }
  
  .neo-section-title {
    font-size: 13px;
  }
  
  .item-label {
    font-size: 13px;
  }
  
  .item-value {
    font-size: 12px;
  }
}

/* 特别处理低高度屏幕 */
@media screen and (max-height: 700px) {
  .neo-infobox {
    max-height: 95vh;
    top: 10px;
  }
  
  .mini-chart-container {
    height: 90px;
  }
  
  .node-info-block {
    padding: 8px;
    margin-top: 10px;
  }
  
  .neo-section {
    margin-bottom: 12px;
  }
}

/* 缓存数据提示样式 */
.cache-indicator {
  margin-bottom: 10px;
  text-align: center;
}

.cache-warning {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background-color: rgba(255, 170, 0, 0.2);
  border-radius: 4px;
  font-size: 12px;
  color: #ffaa00;
}

.cache-warning svg {
  margin-right: 4px;
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



.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 20px 0;
  color: #80deea;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 188, 212, 0.1);
  border-radius: 50%;
  border-top: 3px solid #00bcd4;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.error-message {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  color: #ff5252;
  margin-top: 10px;
}

.error-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(244, 67, 54, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: bold;
}

.retry-btn {
  margin-left: auto;
  padding: 4px 8px;
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.4);
  border-radius: 4px;
  color: #ff5252;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: rgba(244, 67, 54, 0.3);
}

.no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: #80deea;
  gap: 15px;
}

.analyze-btn {
  padding: 8px 16px;
  background: linear-gradient(to right, #0097a7, #00bcd4);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.analyze-btn:hover {
  background: linear-gradient(to right, #00bcd4, #26c6da);
  box-shadow: 0 0 10px rgba(0, 188, 212, 0.5);
  transform: translateY(-2px);
}

.refresh-btn {
  cursor: pointer;
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 188, 212, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(0, 188, 212, 0.2);
  transform: rotate(180deg);
}

.simulation-status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(0, 188, 212, 0.06);
  border-radius: 8px;
  color: #80deea;
  font-size: 14px;
}

.info-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 188, 212, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: bold;
}



@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}



.no-data-tip {
  text-align: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  color: #a5d6a7;
  font-size: 13px;
  margin-top: 5px;
  border: 1px dashed rgba(76, 175, 80, 0.2);
}
</style>

