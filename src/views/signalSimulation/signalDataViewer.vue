<template>
  <div class="signal-data-viewer">
    <!-- 简化的页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button type="primary" @click="goBack" :icon="ArrowLeft" size="default">
          返回
        </el-button>
        <div v-if="selectedNode" class="node-info">
          <span class="node-name">{{ selectedNodeDisplayName }}</span>
          <span class="node-id">ID: {{ selectedNode.id }}</span>
          <el-divider direction="vertical" />
          <span class="session-info">场景: {{ topoStore.currentSessionId }}</span>
        </div>
      </div>
      <div class="header-right">
        <el-divider direction="vertical" />
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="暂停"
          size="default"
          @change="handleAutoRefreshChange"
        />
        <el-button type="danger" @click="clearData" :icon="Delete" size="default">
          清空
        </el-button>
      </div>
    </div>

    <!-- 简化的控制面板 -->
    <div class="control-panel">
      <!-- 数据类型选择 -->
      <div class="data-type-selector">
        <span class="selector-label">数据类型:</span>
        <el-radio-group v-model="activeDataType" @change="handleTabChange" size="default">
          <el-radio-button
            v-for="dataType in currentDataTypes"
            :key="dataType.key"
            :label="dataType.key"
          >
            {{ dataType.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 状态信息 -->
      <div class="status-info">
        <div class="status-item">
          <span class="label">更新时间:</span>
          <span class="value">{{ lastUpdateTime || '--' }}</span>
        </div>
        <div class="status-item">
          <span class="label">数据长度:</span>
          <span class="value">{{ getCurrentDataLength() }}</span>
        </div>
        <div class="status-item">
          <span class="label">内存:</span>
          <span class="value" :class="{ 'warning': memoryUsageWarning }">
            {{ memoryStats.estimatedMemoryMB.toFixed(1) }}MB
          </span>
        </div>
      </div>
    </div>

    <!-- 优化的图表区域 -->
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">{{ getChartTitle() }}</h3>
        <div class="chart-actions">
          <el-button size="small" @click="refreshChart" :icon="Refresh" type="primary" plain>
            刷新
          </el-button>
          <el-button size="small" @click="downloadChart" :icon="Download" type="success" plain>
            下载
          </el-button>
          <el-button
            v-if="isBitDataType()"
            size="small"
            @click="openBitStreamViewer"
            :icon="Grid"
            :disabled="!hasCurrentData()"
            type="info"
            plain
          >
            比特流
          </el-button>
        </div>
      </div>

      <div class="chart-content" v-loading="chartLoading">
        <div
          ref="chartRef"
          class="chart-element"
        ></div>
      </div>
    </div>

    <!-- 比特流数据查看器对话框 -->
    <el-dialog
      v-model="bitStreamDialogVisible"
      title="比特流数据"
      width="50%"
      :close-on-click-modal="false"
      class="bit-stream-dialog"
    >
      <div class="bit-stream-viewer">
        <!-- 工具栏 -->
        <div class="bit-stream-toolbar">
          <div class="toolbar-left">
            <el-tag type="info" effect="dark">
              数据类型: {{ activeDataType === 'num_in_240_200' ? '输入比特数据' : '输出比特数据' }}
            </el-tag>
            <el-tag type="success">
              总长度: {{ getCurrentDataLength() }} bits
            </el-tag>
            <el-tag type="warning">
              字节数: {{ Math.ceil(getCurrentDataLength() / 8) }} bytes
            </el-tag>
          </div>
          <div class="toolbar-right">
            <el-button size="small" @click="exportBitStreamData" :icon="Download">
              导出数据
            </el-button>
            <el-button size="small" @click="copyBitStreamData" :icon="CopyDocument">
              复制数据
            </el-button>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="bit-stream-stats">
          <div class="stats-item">
            <span class="label">0比特数量:</span>
            <span class="value">{{ getBitStreamStats().zeroCount }}</span>
          </div>
          <div class="stats-item">
            <span class="label">1比特数量:</span>
            <span class="value">{{ getBitStreamStats().oneCount }}</span>
          </div>
        </div>

        <!-- 16进制数据表格 -->
        <div class="bit-stream-table">
          <div class="table-container">
            <!-- 表头 -->
            <div class="table-header">
              <div class="offset-header">Offset</div>
              <div class="hex-headers">
                <div
                  v-for="i in 16"
                  :key="i-1"
                  class="hex-header"
                  :class="{ 'header-group-separator': (i-1) % 4 === 0 && i > 1 }"
                >
                  {{ (i-1).toString(16).toUpperCase().padStart(2, '0') }}
                </div>
              </div>
              <div class="ascii-header">ASCII</div>
            </div>

            <!-- 表格内容 -->
            <div class="table-content">
              <div
                v-for="(row, rowIndex) in getBitStreamRows()"
                :key="rowIndex"
                class="table-row"
                :class="{ 'row-highlight': rowIndex % 2 === 1 }"
              >
                <!-- 偏移量列 -->
                <div class="offset-cell">
                  {{ formatOffset(rowIndex * 16) }}
                </div>

                <!-- 16进制数据列 -->
                <div class="hex-cells">
                  <div
                    v-for="(hexValue, colIndex) in row.hexValues"
                    :key="colIndex"
                    class="hex-cell"
                    :class="{
                      'cell-empty': hexValue === '',
                      'cell-group-separator': colIndex % 4 === 0 && colIndex > 0,
                      'cell-highlighted': hexValue && hexValue === highlightedHexValue
                    }"
                    :title="getHexCellTooltip(rowIndex, colIndex, hexValue)"
                    @click="toggleHighlight(hexValue)"
                  >
                    {{ hexValue }}
                  </div>
                </div>

                <!-- ASCII列 -->
                <div class="ascii-cell">
                  {{ row.asciiValue }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTopoStore } from '../../store/modules/topo';
import { websocketService } from '../../services/websocket';
import {
  ArrowLeft,
  Delete,
  DataLine,
  TrendCharts,
  PictureRounded,
  Refresh,
  Download,
  Grid,
  CopyDocument
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as echarts from 'echarts';

// 路由和存储
const router = useRouter();
const route = useRoute();
const topoStore = useTopoStore();

// 页面状态
const selectedNode = ref<{id: number, name: string} | null>(null);
const selectedPhyModel = ref('ofdm'); // 默认选择OFDM模型
const activeDataType = ref('num_in_240_200');
const autoRefresh = ref(true);
const wsConnected = ref(false);
const chartLoading = ref(false);
const chartHeight = ref(600);

const selectedNodeDisplayName = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  const currentNode = topoStore.topoData?.nodes?.find((node: any) => node.id === selectedNode.value?.id);
  return currentNode?.alias || currentNode?.name || selectedNode.value.name;
});

// 比特流查看器状态
const bitStreamDialogVisible = ref(false);
const highlightedHexValue = ref<string>('');

// 物理层模型配置
const phyModelConfig = {
  ofdm: {
    label: 'OFDM',
    dataTypes: [
      { key: 'num_in_240_200', label: '输入比特数据', icon: 'DataLine', type: 'bit' },
      { key: 'qam_mapped', label: '16QAM调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'de_interFrq_out', label: '信道输出云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'de_sfo_comp', label: '均衡算法输出云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'de_scram_out_240_200', label: '输出比特数据', icon: 'DataLine', type: 'bit' }
    ]
  },
  pdcch: {
    label: 'PDCCH',
    dataTypes: [
      { key: 'original_data', label: 'bit数据', icon: 'DataLine', type: 'bit' },
      { key: 'qpsk_symbols', label: 'QPSK调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'channel_output', label: '云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'decoded_bits', label: 'bit数据', icon: 'DataLine', type: 'bit' }
    ]
  },
  pbch: {
    label: 'PBCH',
    dataTypes: [
      { key: 'original_data', label: 'bit数据', icon: 'DataLine', type: 'bit' },
      { key: 'qpsk_symbols', label: 'QPSK调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'channel_output', label: '云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'decoded_bits', label: 'bit数据', icon: 'DataLine', type: 'bit' }
    ]
  },
  fhss: {
    label: 'FHSS',
    dataTypes: [
      { key: 'original_data', label: 'bit数据', icon: 'DataLine', type: 'bit' },
      { key: 'msk_modulated', label: 'MSK调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'hop_sequence', label: '跳频序列的波形图', icon: 'TrendCharts', type: 'waveform' },
      { key: 'demodulated_data', label: 'bit数据', icon: 'DataLine', type: 'bit' }
    ]
  },
  dsss: {
    label: 'DSSS',
    dataTypes: [
      { key: 'original_bits', label: 'bit数据', icon: 'DataLine', type: 'bit' },
      { key: 'qam_modulated_symbols', label: '16QAM调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'spread_samples', label: '云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'despread_samples', label: '云图', icon: 'PictureRounded', type: 'cloud' },
      { key: 'demodulated_bits', label: 'bit数据', icon: 'DataLine', type: 'bit' }
    ]
  },
  cdma: {
    label: 'CDMA',
    dataTypes: [
      { key: 'original_bits', label: 'bit数据图', icon: 'DataLine', type: 'bit' },
      { key: 'qam_modulated_symbols', label: '16QAM调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'spread_samples', label: '时域图', icon: 'TrendCharts', type: 'time_domain' },
      { key: 'despread_samples', label: '时域图', icon: 'TrendCharts', type: 'time_domain' },
      { key: 'demodulated_bits', label: 'bit数据图', icon: 'DataLine', type: 'bit' },
      { key: 'pn_code', label: 'PN码序列', icon: 'DataLine', type: 'bit' }
    ]
  },
  zigbee: {
    label: 'ZigBee',
    dataTypes: [
      { key: 'original_bits', label: 'bit数据图', icon: 'DataLine', type: 'bit' },
      { key: 'oqpsk_modulated_symbols', label: 'O-QPSK调制星座图', icon: 'TrendCharts', type: 'constellation' },
      { key: 'spread_samples', label: '时域图', icon: 'TrendCharts', type: 'time_domain' },
      { key: 'despread_samples', label: '时域图', icon: 'TrendCharts', type: 'time_domain' },
      { key: 'demodulated_bits', label: 'bit数据图', icon: 'DataLine', type: 'bit' },
      { key: 'spreading_code', label: 'ZigBee扩频码图', icon: 'TrendCharts', type: 'spreading_code' }
    ]
  },
  prach: {
    label: 'PRACH',
    dataTypes: [
      { key: 'original_bits', label: 'bit数据图', icon: 'DataLine', type: 'bit' },
      { key: 'zc_sequence', label: '双轴折线图(实部+虚部)', icon: 'TrendCharts', type: 'dual_axis' },
      { key: 'time_domain_signal', label: '幅度时序折线图', icon: 'TrendCharts', type: 'amplitude_time' },
      { key: 'frequency_domain_signal', label: '幅度谱折线图', icon: 'TrendCharts', type: 'amplitude_spectrum' }
    ]
  }
};

// 数据状态
const lastUpdateTime = ref('');
const dataPacketCount = ref(0);
const signalData = ref<Record<string, any>>({});

// 性能优化相关
const maxDataPoints = ref(5000); // 最大数据点数量
const updateThrottleMs = ref(100); // 更新限流间隔（毫秒）
const lastUpdateTimestamp = ref(0);
const pendingUpdate = ref(false);
const memoryUsageWarning = ref(false);

// 数据缓存管理
const dataCache = ref<{
  [key: string]: {
    data: any[],
    timestamp: number,
    size: number
  }
}>({});

// 内存监控
const memoryStats = ref({
  totalDataPoints: 0,
  estimatedMemoryMB: 0,
  cacheHitRate: 0
});

// 计算属性
const currentDataTypes = computed(() => {
  return phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig]?.dataTypes || [];
});

// 图表实例
const chartRef = ref<HTMLElement>();
let chartInstance: echarts.ECharts | null = null;

// 初始化
onMounted(() => {
  // 从路由参数获取节点信息
  const nodeId = route.query.nodeId as string;
  const nodeName = route.query.nodeName as string;

  if (nodeId && nodeName) {
    selectedNode.value = {
      id: parseInt(nodeId),
      name: nodeName
    };

    // 根据节点的phy_type自动设置物理层模型
    autoDetectPhyModel(parseInt(nodeId));
  }

  // 设置默认的活动数据类型
  const defaultDataTypes = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig]?.dataTypes || [];
  if (defaultDataTypes.length > 0) {
    activeDataType.value = defaultDataTypes[0].key;
  }

  // 初始化WebSocket连接和图表
  initializeWebSocket();
  initializeChart();

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  // 清理资源
  cleanupWebSocket();
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  window.removeEventListener('resize', handleResize);
});

// 监听活动数据类型变化
watch(activeDataType, () => {
  adjustChartHeight();
  updateChart();
});

// 返回节点列表
const goBack = () => {
  router.push('/simu/signal');
};

// 获取物理层模型标签
const getPhyModelLabel = (model: string) => {
  return phyModelConfig[model as keyof typeof phyModelConfig]?.label || model.toUpperCase();
};

// 根据节点的phy_type自动设置物理层模型
const autoDetectPhyModel = (nodeId: number) => {
  try {
    // 查找对应的子网节点
    const subnetNode = findSubnetForNode(nodeId);
    if (subnetNode && subnetNode.phy_type) {
      const detectedPhyType = subnetNode.phy_type.toLowerCase();

      // 检查检测到的物理层类型是否在配置中
      if (phyModelConfig[detectedPhyType as keyof typeof phyModelConfig]) {
        selectedPhyModel.value = detectedPhyType;

        // 更新活动数据类型为第一个
        const newDataTypes = phyModelConfig[detectedPhyType as keyof typeof phyModelConfig]?.dataTypes || [];
        if (newDataTypes.length > 0) {
          activeDataType.value = newDataTypes[0].key;
        }
      } else {
        console.warn(`未知的物理层类型: ${detectedPhyType}, 使用默认OFDM模型`);
      }
    } else {
    }
  } catch (error) {
    console.error('自动检测物理层模型时出错:', error);
  }
};

// 查找节点对应的子网
const findSubnetForNode = (nodeId: number) => {
  if (!topoStore.topoData?.nodes || !topoStore.topoData?.links) {
    return null;
  }

  // 查找与该节点相连的EMANE子网
  const nodeLinks = topoStore.topoData.links.filter((link: any) =>
    link.node1_id === nodeId || link.node2_id === nodeId
  );

  for (const link of nodeLinks) {
    const otherNodeId = link.node1_id === nodeId ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData.nodes.find((n: any) => n.id === otherNodeId);

    if (otherNode?.type === 'EMANE' && otherNode.phy_type) {
      return otherNode;
    }
  }

  return null;
};

// 处理物理层模型变化
const handlePhyModelChange = (newModel: string) => {

  // 清空当前数据
  signalData.value = {};

  // 重置活动数据类型为第一个
  const newDataTypes = phyModelConfig[newModel as keyof typeof phyModelConfig]?.dataTypes || [];
  if (newDataTypes.length > 0) {
    activeDataType.value = newDataTypes[0].key;
  }

  // 更新图表
  updateChart();
};

// 获取当前数据长度
const getCurrentDataLength = () => {
  const currentData = signalData.value[activeDataType.value];
  return currentData ? currentData.length : 0;
};

// 检查是否有当前数据
const hasCurrentData = () => {
  const currentData = signalData.value[activeDataType.value];
  return currentData && currentData.length > 0;
};

// 检查当前数据类型是否为比特数据
const isBitDataType = () => {
  const currentConfig = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig];
  const currentDataTypeConfig = currentConfig?.dataTypes.find(dt => dt.key === activeDataType.value);
  return currentDataTypeConfig?.type === 'bit';
};

// 打开比特流查看器
const openBitStreamViewer = () => {
  if (!hasCurrentData() || !isBitDataType()) {
    ElMessage.warning('当前没有可查看的比特流数据');
    return;
  }
  bitStreamDialogVisible.value = true;
};

// 将比特数据转换为16进制行数据（类似Wireshark packet bytes面板）
const getBitStreamRows = () => {
  const currentData = signalData.value[activeDataType.value] as number[];
  if (!currentData || currentData.length === 0) return [];

  const rows = [];
  const bytesPerRow = 16; // 每行16个字节
  const bitsPerByte = 8;  // 每字节8位

  // 将比特数据按字节分组
  for (let i = 0; i < currentData.length; i += bytesPerRow * bitsPerByte) {
    const rowBits = currentData.slice(i, i + bytesPerRow * bitsPerByte);
    const hexValues = [];
    let asciiValue = '';

    // 每8位转换为一个16进制值
    for (let j = 0; j < bytesPerRow; j++) {
      const byteStartIndex = j * bitsPerByte;
      const byteBits = rowBits.slice(byteStartIndex, byteStartIndex + bitsPerByte);

      if (byteBits.length === 0) {
        hexValues.push('');
        continue;
      }

      // 将8位比特转换为十进制，再转换为16进制
      let byteValue = 0;
      for (let k = 0; k < byteBits.length; k++) {
        byteValue += (byteBits[k] || 0) * Math.pow(2, bitsPerByte - 1 - k);
      }

      // 补齐不足8位的情况
      if (byteBits.length < bitsPerByte) {
        byteValue = byteValue << (bitsPerByte - byteBits.length);
      }

      const hexValue = byteValue.toString(16).toUpperCase().padStart(2, '0');
      hexValues.push(hexValue);

      // 生成ASCII字符（可打印字符范围32-126）
      if (byteValue >= 32 && byteValue <= 126) {
        asciiValue += String.fromCharCode(byteValue);
      } else {
        asciiValue += '.';
      }
    }

    rows.push({
      hexValues,
      asciiValue
    });
  }

  return rows;
};

// 格式化偏移量显示
const formatOffset = (offset: number) => {
  return '0x' + offset.toString(16).toUpperCase().padStart(8, '0');
};

// 获取比特流统计信息
const getBitStreamStats = () => {
  const currentData = signalData.value[activeDataType.value as keyof typeof signalData.value] as number[];
  if (!currentData || currentData.length === 0) {
    return {
      zeroCount: 0,
      oneCount: 0,
    };
  }

  const zeroCount = currentData.filter(bit => bit === 0).length;
  const oneCount = currentData.filter(bit => bit === 1).length;

  return {
    zeroCount,
    oneCount,
  };
};

// 导出比特流数据
const exportBitStreamData = () => {
  const currentData = signalData.value[activeDataType.value as keyof typeof signalData.value] as number[];
  if (!currentData || currentData.length === 0) {
    ElMessage.warning('没有可导出的数据');
    return;
  }

  const rows = getBitStreamRows();
  const dataTypeName = activeDataType.value === 'num_in_240_200' ? '输入比特数据' : '输出比特数据';
  let content = `比特流数据导出 - ${dataTypeName}\n`;
  content += `节点: ${selectedNodeDisplayName.value} (ID: ${selectedNode.value?.id})\n`;
  content += `导出时间: ${new Date().toLocaleString()}\n`;
  content += `数据长度: ${currentData.length} bits (${Math.ceil(currentData.length / 8)} bytes)\n\n`;

  // 添加表头
  content += 'Offset      ';
  for (let i = 0; i < 16; i++) {
    content += i.toString(16).toUpperCase().padStart(2, '0') + ' ';
  }
  content += ' ASCII\n';
  content += '-'.repeat(80) + '\n';

  // 添加数据行
  rows.forEach((row, index) => {
    content += formatOffset(index * 16) + '  ';
    row.hexValues.forEach(hex => {
      content += (hex || '  ') + ' ';
    });
    content += ' ' + row.asciiValue + '\n';
  });

  // 创建下载链接
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${dataTypeName}_${selectedNodeDisplayName.value}_${new Date().getTime()}.txt`;
  link.click();
  URL.revokeObjectURL(url);

  ElMessage.success('比特流数据导出成功');
};

// 复制比特流数据到剪贴板
const copyBitStreamData = async () => {
  const currentData = signalData.value[activeDataType.value as keyof typeof signalData.value] as number[];
  if (!currentData || currentData.length === 0) {
    ElMessage.warning('没有可复制的数据');
    return;
  }

  try {
    // 生成16进制字符串
    const hexString = getBitStreamRows()
      .map(row => row.hexValues.filter(hex => hex !== '').join(' '))
      .filter(line => line.length > 0)
      .join('\n');

    await navigator.clipboard.writeText(hexString);
    ElMessage.success('比特流数据已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败，请手动选择数据');
  }
};

// 获取16进制单元格的详细提示信息
const getHexCellTooltip = (rowIndex: number, colIndex: number, hexValue: string) => {
  if (!hexValue) return '空字节';

  const offset = rowIndex * 16 + colIndex;
  const decimalValue = parseInt(hexValue, 16);
  const binaryValue = decimalValue.toString(2).padStart(8, '0');
  const asciiChar = (decimalValue >= 32 && decimalValue <= 126) ? String.fromCharCode(decimalValue) : '.';

  return `偏移: ${formatOffset(offset)}
十六进制: 0x${hexValue}
十进制: ${decimalValue}
二进制: ${binaryValue}
ASCII: '${asciiChar}'
字节位置: 行${rowIndex + 1}, 列${colIndex + 1}`;
};

// 切换高亮显示相同的16进制值
const toggleHighlight = (hexValue: string) => {
  if (!hexValue) return;

  if (highlightedHexValue.value === hexValue) {
    highlightedHexValue.value = '';
    ElMessage.info('已取消高亮显示');
  } else {
    highlightedHexValue.value = hexValue;
    const rows = getBitStreamRows();
    let count = 0;
    rows.forEach(row => {
      count += row.hexValues.filter(val => val === hexValue).length;
    });
    ElMessage.success(`已高亮显示值 0x${hexValue}，共找到 ${count} 个匹配项`);
  }
};

// 获取图表标题
const getChartTitle = () => {
  const currentConfig = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig];
  const currentDataTypeConfig = currentConfig?.dataTypes.find(dt => dt.key === activeDataType.value);
  return currentDataTypeConfig?.label || '未知数据类型';
};

// 处理标签页切换
const handleTabChange = (tabName: string) => {
  activeDataType.value = tabName;
};

// 处理自动刷新切换
const handleAutoRefreshChange = (value: boolean) => {
  if (value) {
    ElMessage.success('已开启自动刷新');
  } else {
    ElMessage.info('已暂停自动刷新');
  }
};

// 清空数据
const clearData = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有数据吗？', '确认清空', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    // 重置所有数据
    signalData.value = {
      num_in_240_200: [],
      qam_mapped: [],
      de_interFrq_out: [],
      de_sfo_comp: [],
      de_scram_out_240_200: []
    };
    dataPacketCount.value = 0;
    lastUpdateTime.value = '';

    // 清空缓存
    dataCache.value = {};

    // 重置性能统计
    memoryStats.value = {
      totalDataPoints: 0,
      estimatedMemoryMB: 0,
      cacheHitRate: 0
    };

    // 重置警告状态
    memoryUsageWarning.value = false;

    // 重置最大数据点数量
    maxDataPoints.value = 5000;

    // 更新图表
    updateChart();
    ElMessage.success('数据已清空');
  } catch {
    // 用户取消操作
  }
};

// 刷新图表
const refreshChart = () => {
  updateChart();
  ElMessage.success('图表已刷新');
};

// 下载图表
const downloadChart = () => {
  if (chartInstance) {
    const url = chartInstance.getDataURL({
      type: 'png',
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getChartTitle()}_${new Date().getTime()}.png`;
    link.click();
    ElMessage.success('图表下载成功');
  }
};

// 处理窗口大小变化
const handleResize = () => {
  adjustChartHeight();
  if (chartInstance) {
    chartInstance.resize();
  }
};

// 初始化WebSocket连接
const initializeWebSocket = () => {
  // 设置拓扑存储获取器
  websocketService.setTopoStoreGetter(() => topoStore);

  // 建立WebSocket连接
  websocketService.connect('signal-data-viewer');

  // 监听WebSocket连接状态
  wsConnected.value = websocketService.connected;

  // 注册消息处理器，监听action=2的消息
  websocketService.onMessage('action_2', handleSignalData);
};

// 清理WebSocket连接
const cleanupWebSocket = () => {
  // 移除消息处理器
  websocketService.offMessage('action_2', handleSignalData);
  websocketService.disconnect('signal-data-viewer');
};

// 处理信号数据（带性能优化）
const handleSignalData = (message: any) => {
  if (!autoRefresh.value) {
    return; // 如果暂停刷新，则不处理数据
  }

  // 限流处理
  const now = Date.now();
  if (now - lastUpdateTimestamp.value < updateThrottleMs.value) {
    if (!pendingUpdate.value) {
      pendingUpdate.value = true;
      setTimeout(() => {
        pendingUpdate.value = false;
        handleSignalDataInternal(message);
      }, updateThrottleMs.value);
    }
    return;
  }

  lastUpdateTimestamp.value = now;
  handleSignalDataInternal(message);
};

// WebSocket信号数据处理函数
const handleSignalDataInternal = (message: any) => {
  try {
    // 检查是否是CDMA双用户消息格式
    if (selectedPhyModel.value === 'cdma' && message.user1 && message.user2) {
      // CDMA双用户数据处理
      const user1NodeId = message.user1['node_id:1'] || message.user1.node_id;
      const user2NodeId = message.user2['node_id:2'] || message.user2.node_id;
      
      // 检查节点ID是否匹配（检查当前选中节点是否是user1或user2中的一个）
      if (selectedNode.value && 
          user1NodeId !== selectedNode.value.id && 
          user2NodeId !== selectedNode.value.id) {
        return; // 不是当前选中节点相关的数据，忽略
      }

      const user1Data = message.user1.data;
      const user2Data = message.user2.data;
      
      if (!user1Data && !user2Data) {
        console.warn('CDMA收到的双用户信号数据为空');
        return;
      }

      // 根据当前选择的物理层模型更新对应的数据
      const currentConfig = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig];
      if (currentConfig) {
        let hasValidData = false;
        currentConfig.dataTypes.forEach(dataType => {
          // 检查user1和user2是否都有这个数据类型
          const user1HasData = user1Data && user1Data[dataType.key];
          const user2HasData = user2Data && user2Data[dataType.key];
          
          if (user1HasData || user2HasData) {
            // 构建CDMA双用户数据结构
            const cdmaData = {
              user1: user1HasData ? {
                data: {
                  [dataType.key]: user1Data[dataType.key]
                }
              } : null,
              user2: user2HasData ? {
                data: {
                  [dataType.key]: user2Data[dataType.key]
                }
              } : null
            };
            
            signalData.value[dataType.key] = cdmaData;
            hasValidData = true;
          }
        });
        
        // 只有在有效数据时才更新状态
        if (hasValidData) {
          // 更新状态信息
          dataPacketCount.value++;
          lastUpdateTime.value = new Date().toLocaleTimeString();

          // 更新内存统计
          updateMemoryStats();

          // 检查内存使用情况
          checkMemoryUsage();

          // 更新图表（限流）
          throttledUpdateChart();

        }
      }
      
      return;
    }
    
    // 原有的单用户数据处理逻辑
    const data = message.data;
    if (!data) {
      console.warn('收到的信号数据为空');
      return;
    }

    // 检查节点ID是否匹配
    if (selectedNode.value && message.node_id !== selectedNode.value.id) {
      return; // 不是当前选中节点的数据，忽略
    }

    // 优化数据更新 - 限制数据点数量
    const updateDataWithLimit = (key: string, newData: any[]) => {
      if (!newData || !Array.isArray(newData)) return;

      // 限制数据点数量，保留最新的数据
      const limitedData = newData.length > maxDataPoints.value
        ? newData.slice(-maxDataPoints.value)
        : newData;

      signalData.value[key] = [...limitedData];

      // 更新缓存
      updateDataCache(key, limitedData);
    };

    // 根据当前选择的物理层模型更新对应的数据
    const currentConfig = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig];
    if (currentConfig) {
      let hasValidData = false;
      currentConfig.dataTypes.forEach(dataType => {
        if (data[dataType.key]) {
          // 使用实际接收的数据
          updateDataWithLimit(dataType.key, data[dataType.key]);
          hasValidData = true;
        }
      });
      
      // 只有在有效数据时才更新状态
      if (hasValidData) {
        // 更新状态信息
        dataPacketCount.value++;
        lastUpdateTime.value = new Date().toLocaleTimeString();

        // 更新内存统计
        updateMemoryStats();

        // 检查内存使用情况
        checkMemoryUsage();

        // 更新图表（限流）
        throttledUpdateChart();

      }
    }

  } catch (error) {
    console.error('处理信号数据时出错:', error);
    ElMessage.error('处理信号数据失败');
  }
};

// 更新数据缓存
const updateDataCache = (key: string, data: any[]) => {
  const timestamp = Date.now();
  const size = estimateDataSize(data);

  dataCache.value[key] = {
    data: [...data],
    timestamp,
    size
  };

  // 清理过期缓存（超过5分钟）
  const expireTime = 5 * 60 * 1000;
  Object.keys(dataCache.value).forEach(cacheKey => {
    if (timestamp - dataCache.value[cacheKey].timestamp > expireTime) {
      delete dataCache.value[cacheKey];
    }
  });
};

// 估算数据大小（KB）
const estimateDataSize = (data: any[]): number => {
  if (!data || !Array.isArray(data)) return 0;

  // 简单估算：每个数字8字节，每个复数对象16字节
  const sampleItem = data[0];
  let itemSize = 8; // 默认数字大小

  if (typeof sampleItem === 'object' && sampleItem !== null) {
    itemSize = 16; // 复数对象大小
  }

  return (data.length * itemSize) / 1024; // 转换为KB
};

// 更新内存统计
const updateMemoryStats = () => {
  let totalPoints = 0;
  let totalSizeKB = 0;

  Object.values(signalData.value).forEach(dataArray => {
    if (Array.isArray(dataArray)) {
      totalPoints += dataArray.length;
      totalSizeKB += estimateDataSize(dataArray);
    }
  });

  memoryStats.value = {
    totalDataPoints: totalPoints,
    estimatedMemoryMB: totalSizeKB / 1024,
    cacheHitRate: calculateCacheHitRate()
  };
};

// 计算缓存命中率
const calculateCacheHitRate = (): number => {
  const cacheEntries = Object.keys(dataCache.value).length;
  const totalDataTypes = 5; // 总共5种数据类型
  return cacheEntries > 0 ? (cacheEntries / totalDataTypes) * 100 : 0;
};

// 检查内存使用情况
const checkMemoryUsage = () => {
  const memoryLimitMB = 100; // 内存使用警告阈值

  if (memoryStats.value.estimatedMemoryMB > memoryLimitMB) {
    if (!memoryUsageWarning.value) {
      memoryUsageWarning.value = true;
      ElMessage.warning(`内存使用量较高 (${memoryStats.value.estimatedMemoryMB.toFixed(1)}MB)，建议清空数据`);

      // 自动减少数据点数量
      maxDataPoints.value = Math.max(1000, maxDataPoints.value * 0.8);
      console.warn('自动调整最大数据点数量至:', maxDataPoints.value);
    }
  } else {
    memoryUsageWarning.value = false;
  }
};

// 限流的图表更新函数
let chartUpdateTimer: number | null = null;
const throttledUpdateChart = () => {
  if (chartUpdateTimer) {
    clearTimeout(chartUpdateTimer);
  }

  chartUpdateTimer = window.setTimeout(() => {
    updateChart();
    chartUpdateTimer = null;
  }, 50); // 50ms限流
};

// 初始化图表
const initializeChart = () => {
  nextTick(() => {
    if (chartRef.value) {
      chartInstance = echarts.init(chartRef.value);
      updateChart();

      // 为星座图和云图调整高度，使其更接近正方形
      adjustChartHeight();
    }
  });
};

// 调整图表高度
const adjustChartHeight = () => {
  if (!chartRef.value) return;

  const isScatterChart = ['qam_mapped', 'de_interFrq_out', 'de_sfo_comp'].includes(activeDataType.value);

  if (isScatterChart) {
    // 对于散点图，使用更大的高度以接近正方形比例
    const containerWidth = chartRef.value.clientWidth;
    const idealHeight = Math.min(containerWidth * 0.8, 1100);
    chartHeight.value = Math.max(idealHeight, 900);
  } else {
    // 对于折线图，使用标准高度
    chartHeight.value = 800;
  }

  // 重新调整图表大小
  if (chartInstance) {
    const currentChart = chartInstance;
    nextTick(() => {
      currentChart.resize();
    });
  }
};

// 更新图表
const updateChart = () => {
  if (!chartInstance) {
    return;
  }

  chartLoading.value = true;

  try {
    let option: any = {};

    // 根据当前数据类型的类型来决定图表类型
    const currentConfig = phyModelConfig[selectedPhyModel.value as keyof typeof phyModelConfig];
    const currentDataTypeConfig = currentConfig?.dataTypes.find(dt => dt.key === activeDataType.value);

    if (!currentDataTypeConfig) {
      option = createEmptyChart();
    } else {
      switch (currentDataTypeConfig.type) {
        case 'bit':
          option = createBitDataChart();
          break;
        case 'constellation':
          option = createConstellationChart();
          break;
        case 'cloud':
          option = createCloudChart();
          break;
        case 'waveform':
          option = createWaveformChart();
          break;
        case 'numeric':
          option = createNumericChart();
          break;
        case 'dual_axis':
          option = createDualAxisChart();
          break;
        case 'amplitude_time':
          option = createAmplitudeTimeChart();
          break;
        case 'amplitude_spectrum':
          option = createAmplitudeSpectrumChart();
          break;
        case 'time_domain':
          option = createTimeDomainChart();
          break;
        case 'spreading_code':
          option = createSpreadingCodeChart();
          break;
        default:
          option = createEmptyChart();
      }
    }

    chartInstance.setOption(option, true);

  } catch (error) {
    console.error('更新图表时出错:', error);
    ElMessage.error('更新图表失败');
  } finally {
    chartLoading.value = false;
  }
};

// 创建比特数据图表
const createBitDataChart = () => {
  // 检查是否是CDMA模型的双用户数据
  if (selectedPhyModel.value === 'cdma') {
    const currentData = signalData.value[activeDataType.value];
    
    if (!currentData) {
      return createEmptyChart();
    }
    
    // 检查是否有user1和user2的数据结构
    const user1Data = currentData?.user1?.data?.[activeDataType.value];
    const user2Data = currentData?.user2?.data?.[activeDataType.value];
    
    if (!user1Data && !user2Data) {
      return createEmptyChart();
    }
    
    // 限制显示的数据点数量，避免性能问题
    const maxPoints = 1000;
    const user1DisplayData = user1Data && user1Data.length > maxPoints
      ? user1Data.slice(-maxPoints)
      : user1Data || [];
    const user2DisplayData = user2Data && user2Data.length > maxPoints  
      ? user2Data.slice(-maxPoints)
      : user2Data || [];
    
    // 创建X轴数据（取最长的数据长度）
    const maxLength = Math.max(user1DisplayData.length, user2DisplayData.length);
    const xAxisData = Array.from({length: maxLength}, (_, index) => index);
    
    // 深色科技蓝主题配色
    const user1Color = '#00D4FF';  // 科技蓝主色 - User1
    const user2Color = '#FF6B6B';  // 珊瑚红 - User2
    const user1AccentColor = '#66E5FF';    
    const user2AccentColor = '#FF9999';
    const user1AreaColor = 'rgba(0, 212, 255, 0.15)';
    const user2AreaColor = 'rgba(255, 107, 107, 0.15)';
    const user1GlowColor = 'rgba(0, 212, 255, 0.8)';
    const user2GlowColor = 'rgba(255, 107, 107, 0.8)';

    const series = [];
    
    // User1 数据系列
    if (user1DisplayData.length > 0) {
      series.push({
        name: 'User1 - 比特数据',
        type: 'line',
        data: user1DisplayData,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: user1Color },
              { offset: 0.5, color: user1AccentColor },
              { offset: 1, color: user1Color }
            ]
          },
          shadowBlur: 8,
          shadowColor: user1GlowColor
        },
        itemStyle: {
          color: user1Color,
          borderColor: user1AccentColor,
          borderWidth: 2,
          shadowBlur: 6,
          shadowColor: user1GlowColor
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: user1AreaColor },
              { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 3,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }
    
    // User2 数据系列  
    if (user2DisplayData.length > 0) {
      series.push({
        name: 'User2 - 比特数据',
        type: 'line',
        data: user2DisplayData,
        symbol: 'diamond',
        symbolSize: 5,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: user2Color },
              { offset: 0.5, color: user2AccentColor },
              { offset: 1, color: user2Color }
            ]
          },
          shadowBlur: 8,
          shadowColor: user2GlowColor
        },
        itemStyle: {
          color: user2Color,
          borderColor: user2AccentColor,
          borderWidth: 2,
          shadowBlur: 6,
          shadowColor: user2GlowColor
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: user2AreaColor },
              { offset: 1, color: 'rgba(255, 107, 107, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500', 
            borderWidth: 3,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }

    return {
      backgroundColor: '#0A0E1A', // 深色背景
      legend: {
        data: series.map(s => s.name),
        textStyle: {
          color: '#E6F7FF',
          fontSize: 12
        },
        top: 10
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = '<div style="font-weight: bold; margin-bottom: 5px;">样本索引: ' + params[0].dataIndex + '</div>';
          params.forEach((param: any) => {
            const userColor = param.seriesName.includes('User1') ? user1Color : user2Color;
            result += `<div style="color: ${userColor};">${param.seriesName}: ${param.value}</div>`;
          });
          result += `<div style="color: #99CCFF; font-size: 12px; margin-top: 5px;">数据类型: ${activeDataType.value}</div>`;
          return result;
        },
        backgroundColor: 'rgba(10, 14, 26, 0.95)',
        borderColor: user1Color,
        borderWidth: 1,
        textStyle: {
          color: '#E6F7FF',
          fontSize: 13
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 212, 255, 0.3)'
      },
      grid: {
        left: '6%',
        right: '4%',
        top: '15%',
        bottom: '12%',
        containLabel: true,
        backgroundColor: 'rgba(15, 25, 40, 0.3)',
        borderColor: 'rgba(0, 212, 255, 0.2)',
        borderWidth: 1
      },
      xAxis: {
        type: 'category',
        name: '样本索引',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        data: xAxisData,
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 5,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.1)',
            type: 'dashed',
            width: 1
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '比特值',
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        min: -0.2,
        max: 1.2,
        interval: 0.2,
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 5,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.1)',
            type: 'dashed',
            width: 1
          }
        }
      },
      series: series,
      dataZoom: [
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 5,
          backgroundColor: 'rgba(15, 25, 40, 0.8)',
          borderColor: user1Color,
          fillerColor: 'rgba(0, 212, 255, 0.3)',
          handleStyle: {
            color: user1Color,
            borderColor: user1AccentColor
          },
          textStyle: {
            color: '#66E5FF'
          }
        },
        {
          type: 'inside'
        }
      ]
    };
  }
  
  // 原有的单用户bit数据图表逻辑
  const currentData = signalData.value[activeDataType.value] as number[];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量，避免性能问题
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';  // 科技蓝主色
  const accentColor = '#66E5FF';    // 亮蓝色
  const areaColor = 'rgba(0, 212, 255, 0.15)';
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A', // 深色背景
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold;">样本索引: ${point.dataIndex}</div>
                <div style="color: #66E5FF;">比特值: ${point.value}</div>
                <div style="color: #99CCFF; font-size: 12px;">数据类型: ${activeDataType.value}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      name: '样本索引',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      data: displayData.map((_, index) => index),
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '比特值',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: -0.2,
      max: 1.2,
      interval: 0.2,
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [{
      name: '比特数据',
      type: 'line',
      data: displayData,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: {
        width: 3,
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: primaryColor },
            { offset: 0.5, color: accentColor },
            { offset: 1, color: primaryColor }
          ]
        },
        shadowBlur: 8,
        shadowColor: glowColor
      },
      itemStyle: {
        color: primaryColor,
        borderColor: accentColor,
        borderWidth: 2,
        shadowBlur: 6,
        shadowColor: glowColor
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: areaColor },
            { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
          ]
        }
      },
      emphasis: {
        itemStyle: {
          color: '#FFD700',
          borderColor: '#FFA500',
          borderWidth: 3,
          symbolSize: 8,
          shadowBlur: 10,
          shadowColor: 'rgba(255, 215, 0, 0.8)'
        }
      }
    }],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建星座图
const createConstellationChart = () => {
  // 检查是否是CDMA模型的双用户数据
  if (selectedPhyModel.value === 'cdma') {
    const currentData = signalData.value[activeDataType.value];
    
    if (!currentData) {
      return createEmptyChart();
    }
    
    // 检查是否有user1和user2的数据结构
    const user1Data = currentData?.user1?.data?.[activeDataType.value];
    const user2Data = currentData?.user2?.data?.[activeDataType.value];
    
    if (!user1Data && !user2Data) {
      return createEmptyChart();
    }
    
    // 限制显示的数据点数量
    const maxPoints = 2000;
    const user1DisplayData = user1Data && user1Data.length > maxPoints
      ? user1Data.slice(-maxPoints)
      : user1Data || [];
    const user2DisplayData = user2Data && user2Data.length > maxPoints  
      ? user2Data.slice(-maxPoints)
      : user2Data || [];
    
    // 转换为散点图数据格式 [real, imag]
    const user1ScatterData = user1DisplayData.map((point: any) => [
      typeof point === 'object' ? (point.real || point.r || 0) : 0,
      typeof point === 'object' ? (point.imag || point.i || 0) : 0
    ]);
    
    const user2ScatterData = user2DisplayData.map((point: any) => [
      typeof point === 'object' ? (point.real || point.r || 0) : 0,
      typeof point === 'object' ? (point.imag || point.i || 0) : 0
    ]);

    // 计算数据范围以确保坐标轴比例一致
    let minReal = Infinity, maxReal = -Infinity;
    let minImag = Infinity, maxImag = -Infinity;

    [...user1ScatterData, ...user2ScatterData].forEach(([real, imag]: [number, number]) => {
      minReal = Math.min(minReal, real);
      maxReal = Math.max(maxReal, real);
      minImag = Math.min(minImag, imag);
      maxImag = Math.max(maxImag, imag);
    });

    // 计算统一的范围，确保坐标系为正方形
    const realRange = maxReal - minReal;
    const imagRange = maxImag - minImag;
    const maxRange = Math.max(realRange, imagRange);

    // 添加一些边距
    const margin = maxRange * 0.1;
    const centerReal = (minReal + maxReal) / 2;
    const centerImag = (minImag + maxImag) / 2;

    const axisMin = Math.min(centerReal - maxRange/2 - margin, centerImag - maxRange/2 - margin);
    const axisMax = Math.max(centerReal + maxRange/2 + margin, centerImag + maxRange/2 + margin);

    // 深色科技蓝主题配色
    const user1Color = '#00D4FF';  // 科技蓝主色 - User1
    const user2Color = '#FF6B6B';  // 珊瑚红 - User2
    const user1AccentColor = '#66E5FF';    
    const user2AccentColor = '#FF9999';
    const user1GlowColor = 'rgba(0, 212, 255, 0.8)';
    const user2GlowColor = 'rgba(255, 107, 107, 0.8)';

    const series = [];
    
    // User1 数据系列
    if (user1ScatterData.length > 0) {
      series.push({
        name: 'User1 - 16QAM星座点',
        type: 'scatter',
        data: user1ScatterData,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: {
          color: user1Color,
          opacity: 0.8,
          borderColor: user1AccentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: user1GlowColor
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            opacity: 1,
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 12,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }
    
    // User2 数据系列  
    if (user2ScatterData.length > 0) {
      series.push({
        name: 'User2 - 16QAM星座点',
        type: 'scatter',
        data: user2ScatterData,
        symbol: 'diamond',
        symbolSize: 6,
        itemStyle: {
          color: user2Color,
          opacity: 0.8,
          borderColor: user2AccentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: user2GlowColor
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            opacity: 1,
            borderColor: '#FFA500', 
            borderWidth: 2,
            symbolSize: 12,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }

    return {
      backgroundColor: '#0A0E1A', // 深色背景
      legend: {
        data: series.map(s => s.name),
        textStyle: {
          color: '#E6F7FF',
          fontSize: 12
        },
        top: 10
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [real, imag] = params.value;
          const magnitude = Math.sqrt(real*real + imag*imag);
          const phase = Math.atan2(imag, real) * 180 / Math.PI;
          const userColor = params.seriesName.includes('User1') ? user1Color : user2Color;
          return `<div style="color: ${userColor}; font-weight: bold; margin-bottom: 5px;">${params.seriesName}</div>
                  <div style="color: #66E5FF;">实部 (I): ${real.toFixed(4)}</div>
                  <div style="color: #66E5FF;">虚部 (Q): ${imag.toFixed(4)}</div>
                  <div style="color: #99CCFF;">幅度: ${magnitude.toFixed(4)}</div>
                  <div style="color: #99CCFF;">相位: ${phase.toFixed(2)}°</div>`;
        },
        backgroundColor: 'rgba(10, 14, 26, 0.95)',
        borderColor: user1Color,
        borderWidth: 1,
        textStyle: {
          color: '#E6F7FF',
          fontSize: 13
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 212, 255, 0.3)'
      },
      grid: {
        left: '6%',
        right: '4%',
        top: '15%',
        bottom: '12%',
        containLabel: true,
        backgroundColor: 'rgba(15, 25, 40, 0.3)',
        borderColor: 'rgba(0, 212, 255, 0.2)',
        borderWidth: 1
      },
      xAxis: {
        type: 'value',
        name: '实部 (I)',
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        min: axisMin,
        max: axisMax,
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.15)',
            type: 'dashed',
            width: 1
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 6,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        }
      },
      yAxis: {
        type: 'value',
        name: '虚部 (Q)',
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        min: axisMin,
        max: axisMax,
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.15)',
            type: 'dashed',
            width: 1
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 6,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        }
      },
      series: series,
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 5,
          backgroundColor: 'rgba(15, 25, 40, 0.8)',
          borderColor: user1Color,
          fillerColor: 'rgba(0, 212, 255, 0.3)',
          handleStyle: {
            color: user1Color,
            borderColor: user1AccentColor
          },
          textStyle: {
            color: '#66E5FF'
          }
        },
        {
          type: 'slider',
          yAxisIndex: 0,
          start: 0,
          end: 100,
          width: 20,
          right: 5,
          backgroundColor: 'rgba(15, 25, 40, 0.8)',
          borderColor: user1Color,
          fillerColor: 'rgba(0, 212, 255, 0.3)',
          handleStyle: {
            color: user1Color,
            borderColor: user1AccentColor
          },
          textStyle: {
            color: '#66E5FF'
          }
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          yAxisIndex: 0
        }
      ]
    };
  }
  
  // 原有的单用户星座图逻辑
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 2000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 转换为散点图数据格式 [real, imag]
  const scatterData = displayData.map((point: any) => [
    typeof point === 'object' ? (point.real || point.r || 0) : 0,
    typeof point === 'object' ? (point.imag || point.i || 0) : 0
  ]);

  // 计算数据范围以确保坐标轴比例一致
  let minReal = Infinity, maxReal = -Infinity;
  let minImag = Infinity, maxImag = -Infinity;

  scatterData.forEach(([real, imag]: [number, number]) => {
    minReal = Math.min(minReal, real);
    maxReal = Math.max(maxReal, real);
    minImag = Math.min(minImag, imag);
    maxImag = Math.max(maxImag, imag);
  });

  // 计算统一的范围，确保坐标系为正方形
  const realRange = maxReal - minReal;
  const imagRange = maxImag - minImag;
  const maxRange = Math.max(realRange, imagRange);

  // 添加一些边距
  const margin = maxRange * 0.1;
  const centerReal = (minReal + maxReal) / 2;
  const centerImag = (minImag + maxImag) / 2;

  const axisMin = Math.min(centerReal - maxRange/2 - margin, centerImag - maxRange/2 - margin);
  const axisMax = Math.max(centerReal + maxRange/2 + margin, centerImag + maxRange/2 + margin);

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';  // 科技蓝主色
  const accentColor = '#66E5FF';    // 亮蓝色
  const pointColor = '#00BFFF';     // 星座点颜色
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A', // 深色背景
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const [real, imag] = params.value;
        const magnitude = Math.sqrt(real*real + imag*imag);
        const phase = Math.atan2(imag, real) * 180 / Math.PI;
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">16QAM星座点</div>
                <div style="color: #66E5FF;">实部 (I): ${real.toFixed(4)}</div>
                <div style="color: #66E5FF;">虚部 (Q): ${imag.toFixed(4)}</div>
                <div style="color: #99CCFF;">幅度: ${magnitude.toFixed(4)}</div>
                <div style="color: #99CCFF;">相位: ${phase.toFixed(2)}°</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'value',
      name: '实部 (I)',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: axisMin,
      max: axisMax,
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 6,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      }
    },
    yAxis: {
      type: 'value',
      name: '虚部 (Q)',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: axisMin,
      max: axisMax,
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 6,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      }
    },
    series: [{
      name: '16QAM调制星座点',
      type: 'scatter',
      data: scatterData,
      symbolSize: 5,
      itemStyle: {
        color: pointColor,
        opacity: 0.8,
        borderColor: primaryColor,
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          color: '#FFD700',
          opacity: 1,
          borderColor: '#FFA500',
          borderWidth: 2,
          symbolSize: 12,
          shadowBlur: 10,
          shadowColor: 'rgba(255, 215, 0, 0.8)'
        }
      }
    }],
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        start: 0,
        end: 100,
        width: 20,
        right: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside',
        xAxisIndex: 0,
        yAxisIndex: 0
      }
    ]
  };
};

// 创建云图（复数数据的散点图）
const createCloudChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 2000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 转换为散点图数据格式 [real, imag]
  const scatterData = displayData.map((point: any) => [
    typeof point === 'object' ? (point.real || point.r || 0) : 0,
    typeof point === 'object' ? (point.imag || point.i || 0) : 0
  ]);

  // 计算数据范围以确保坐标轴比例一致
  let minReal = Infinity, maxReal = -Infinity;
  let minImag = Infinity, maxImag = -Infinity;

  scatterData.forEach(([real, imag]: [number, number]) => {
    minReal = Math.min(minReal, real);
    maxReal = Math.max(maxReal, real);
    minImag = Math.min(minImag, imag);
    maxImag = Math.max(maxImag, imag);
  });

  // 计算统一的范围，确保坐标系为正方形
  const realRange = maxReal - minReal;
  const imagRange = maxImag - minImag;
  const maxRange = Math.max(realRange, imagRange);

  // 添加一些边距
  const margin = maxRange * 0.1;
  const centerReal = (minReal + maxReal) / 2;
  const centerImag = (minImag + maxImag) / 2;

  const axisMin = Math.min(centerReal - maxRange/2 - margin, centerImag - maxRange/2 - margin);
  const axisMax = Math.max(centerReal + maxRange/2 + margin, centerImag + maxRange/2 + margin);

  // 深色科技蓝主题配色 - 根据数据类型选择不同的蓝色调
  const primaryColor = '#00D4FF';  // 科技蓝主色
  const accentColor = '#66E5FF';    // 亮蓝色
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  // 为不同数据类型选择不同的蓝色系颜色
  const pointColor = activeDataType.value === 'de_interFrq_out' ? '#00FFCC' : '#0099FF';  // 青蓝色 vs 深蓝色
  const pointBorderColor = activeDataType.value === 'de_interFrq_out' ? '#00D4AA' : '#0077CC';

  return {
    backgroundColor: '#0A0E1A', // 深色背景
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const [real, imag] = params.value;
        const magnitude = Math.sqrt(real*real + imag*imag);
        const phase = Math.atan2(imag, real) * 180 / Math.PI;
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">复数数据云图</div>
                <div style="color: #66E5FF;">实部: ${real.toFixed(4)}</div>
                <div style="color: #66E5FF;">虚部: ${imag.toFixed(4)}</div>
                <div style="color: #99CCFF;">幅度: ${magnitude.toFixed(4)}</div>
                <div style="color: #99CCFF;">相位: ${phase.toFixed(2)}°</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'value',
      name: '实部',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: axisMin,
      max: axisMax,
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 6,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      }
    },
    yAxis: {
      type: 'value',
      name: '虚部',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: axisMin,
      max: axisMax,
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 6,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      }
    },
    series: [{
      name: '复数数据点',
      type: 'scatter',
      data: scatterData,
      symbolSize: 6,
      itemStyle: {
        color: pointColor,
        opacity: 0.85,
        borderColor: pointBorderColor,
        borderWidth: 1,
        shadowBlur: 4,
        shadowColor: `rgba(${activeDataType.value === 'de_interFrq_out' ? '0, 255, 204' : '0, 153, 255'}, 0.5)`
      },
      emphasis: {
        itemStyle: {
          color: '#FFD700',
          opacity: 1,
          borderColor: '#FFA500',
          borderWidth: 2,
          symbolSize: 10,
          shadowBlur: 10,
          shadowColor: 'rgba(255, 215, 0, 0.8)'
        }
      }
    }],
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        start: 0,
        end: 100,
        width: 20,
        right: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside',
        xAxisIndex: 0,
        yAxisIndex: 0
      }
    ]
  };
};

// 创建波形图（用于跳频序列等）
const createWaveformChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 检查是否是跳频序列数据
  const isHopSequence = activeDataType.value === 'hop_sequence';

  if (isHopSequence) {
    return createHopSequenceChart(currentData);
  } else {
    // 其他波形数据的处理
    return createGenericWaveformChart(currentData);
  }
};

// 创建跳频序列专用图表
const createHopSequenceChart = (data: any[]) => {
  const dataLength = data.length;

  // 计算频率轴参数
  const centerFreq = 3.0; // 3MHz中心频率
  const freqStep = 0.2; // 0.2MHz步长
  const centerIndex = Math.floor(dataLength / 2); // 中心索引

  // 生成波形数据
  const waveformData: number[][] = [];
  const samplesPerBit = 50; // 每个比特的采样点数，用于生成平滑的正弦波

  data.forEach((bitValue: number, index: number) => {
    // 计算当前索引对应的频率
    const freqOffset = (index - centerIndex) * freqStep;
    const frequency = centerFreq + freqOffset;

    if (bitValue === 1) {
      // 生成半个周期的正弦波（正值）
      for (let i = 0; i < samplesPerBit; i++) {
        const phase = (i / samplesPerBit) * Math.PI; // 0到π，半个周期
        const amplitude = Math.sin(phase);
        const xPos = frequency + (i / samplesPerBit - 0.5) * freqStep; // 在当前频率点周围分布
        waveformData.push([xPos, amplitude]);
      }
    } else {
      // bitValue === 0，幅度为0
      for (let i = 0; i < samplesPerBit; i++) {
        const xPos = frequency + (i / samplesPerBit - 0.5) * freqStep;
        waveformData.push([xPos, 0]);
      }
    }
  });

  // 按频率排序
  waveformData.sort((a, b) => a[0] - b[0]);

  // 计算频率轴范围
  const minFreq = centerFreq - (centerIndex + 1) * freqStep;
  const maxFreq = centerFreq + (dataLength - centerIndex) * freqStep;

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';  // 科技蓝主色
  const accentColor = '#66E5FF';    // 亮蓝色
  const waveColor = '#00BFFF';      // 波形颜色
  const centerLineColor = '#FF6B35'; // 中心频率线颜色
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A', // 深色背景
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">跳频序列</div>
                <div style="color: #66E5FF;">频率: ${point.data[0].toFixed(2)} MHz</div>
                <div style="color: #99CCFF;">幅度: ${point.data[1].toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'value',
      name: '频率 (MHz)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: minFreq,
      max: maxFreq,
      interval: freqStep,
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      },
      // 添加中心频率标记
      markLine: {
        data: [
          {
            xAxis: centerFreq,
            lineStyle: {
              color: centerLineColor,
              type: 'solid',
              width: 3,
              shadowBlur: 8,
              shadowColor: 'rgba(255, 107, 53, 0.6)'
            },
            label: {
              formatter: '中心频率: 3MHz',
              position: 'insideEndTop',
              color: centerLineColor,
              fontWeight: 'bold',
              fontSize: 12
            }
          }
        ]
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      min: -0.1,
      max: 1.1,
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '跳频序列',
        type: 'line',
        data: waveformData,
        smooth: false,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: waveColor },
              { offset: 0.5, color: accentColor },
              { offset: 1, color: waveColor }
            ]
          },
          width: 3,
          shadowBlur: 6,
          shadowColor: 'rgba(0, 191, 255, 0.6)'
        },
        itemStyle: {
          color: waveColor,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 191, 255, 0.5)'
        },
        symbol: 'none',
        connectNulls: false,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 191, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 191, 255, 0.05)' }
            ]
          }
        }
      }
    ]
  };
};

// 创建通用波形图表
const createGenericWaveformChart = (data: any[]) => {
  // 限制显示的数据点数量
  const maxPoints = 1000;
  const displayData = data.length > maxPoints ? data.slice(-maxPoints) : data;

  // 如果是复数数据，转换为幅度
  let waveformData;
  if (Array.isArray(displayData) && displayData.length > 0 && typeof displayData[0] === 'object') {
    // 复数数据，计算幅度
    waveformData = displayData.map((point: any, index: number) => [
      index,
      Math.sqrt((point.real || 0) ** 2 + (point.imag || 0) ** 2)
    ]);
  } else {
    // 实数数据
    waveformData = displayData.map((value: any, index: number) => [index, value]);
  }

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';  // 科技蓝主色
  const accentColor = '#66E5FF';    // 亮蓝色
  const waveColor = '#00BFFF';      // 波形颜色
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A', // 深色背景
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">波形数据</div>
                <div style="color: #66E5FF;">样本索引: ${point.data[0]}</div>
                <div style="color: #99CCFF;">幅度: ${point.data[1].toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'value',
      name: '样本索引',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '波形',
        type: 'line',
        data: waveformData,
        smooth: true,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: waveColor },
              { offset: 0.5, color: accentColor },
              { offset: 1, color: waveColor }
            ]
          },
          width: 3,
          shadowBlur: 6,
          shadowColor: 'rgba(0, 191, 255, 0.6)'
        },
        itemStyle: {
          color: waveColor,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 191, 255, 0.5)'
        },
        symbol: 'none',
        sampling: 'lttb',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 191, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 191, 255, 0.05)' }
            ]
          }
        }
      }
    ]
  };
};

// 创建数值数据图表
const createNumericChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 100;
  const displayData = currentData.length > maxPoints ? currentData.slice(-maxPoints) : currentData;

  // 转换为图表数据格式
  const chartData = displayData.map((value: number, index: number) => [index, value]);

  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">数值数据</div>
                <div style="color: #66E5FF;">索引: ${point.data[0]}</div>
                <div style="color: #99CCFF;">数值: ${point.data[1].toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      }
    },
    grid: {
      left: '60px',
      right: '20px',
      top: '60px',
      bottom: '60px',
      containLabel: false
    },
    xAxis: {
      type: 'value',
      name: '索引',
      nameTextStyle: {
        color: accentColor,
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: accentColor
        }
      },
      axisLabel: {
        color: '#99CCFF',
        fontSize: 11
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(102, 229, 255, 0.2)',
          type: 'dashed'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '数值',
      nameTextStyle: {
        color: accentColor,
        fontSize: 12
      },
      axisLine: {
        lineStyle: {
          color: accentColor
        }
      },
      axisLabel: {
        color: '#99CCFF',
        fontSize: 11
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(102, 229, 255, 0.2)',
          type: 'dashed'
        }
      }
    },
    series: [{
      type: 'bar',
      data: chartData,
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: primaryColor },
            { offset: 1, color: accentColor }
          ]
        }
      },
      barWidth: '60%',
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 212, 255, 0.8)'
        }
      }
    }]
  };
};

// 创建双轴折线图（实部+虚部）
const createDualAxisChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 提取实部和虚部数据
  const realData: number[] = [];
  const imagData: number[] = [];
  const xAxisData: number[] = [];

  displayData.forEach((point: any, index: number) => {
    xAxisData.push(index);
    if (typeof point === 'object' && point !== null) {
      realData.push(point.real || 0);
      imagData.push(point.imag || 0);
    } else {
      realData.push(0);
      imagData.push(0);
    }
  });

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';
  const realColor = '#00BFFF';
  const imagColor = '#FF6B35';
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const realPoint = params.find((p: any) => p.seriesName === '实部');
        const imagPoint = params.find((p: any) => p.seriesName === '虚部');
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">ZC序列数据</div>
                <div style="color: #66E5FF;">样本索引: ${realPoint?.dataIndex || 0}</div>
                <div style="color: #00BFFF;">实部: ${realPoint?.value?.toFixed(4) || 0}</div>
                <div style="color: #FF6B35;">虚部: ${imagPoint?.value?.toFixed(4) || 0}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    legend: {
      data: ['实部', '虚部'],
      textStyle: {
        color: '#66E5FF',
        fontSize: 14
      },
      top: 10
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '15%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      name: '样本索引',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '实部',
        type: 'line',
        data: realData,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          color: realColor,
          width: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(0, 191, 255, 0.6)'
        },
        itemStyle: {
          color: realColor,
          borderColor: '#00D4FF',
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 191, 255, 0.5)'
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 8,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      },
      {
        name: '虚部',
        type: 'line',
        data: imagData,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          color: imagColor,
          width: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(255, 107, 53, 0.6)'
        },
        itemStyle: {
          color: imagColor,
          borderColor: '#FF8C42',
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: 'rgba(255, 107, 53, 0.5)'
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 8,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建幅度时序折线图
const createAmplitudeTimeChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 计算幅度数据
  const amplitudeData: number[] = [];
  const xAxisData: number[] = [];

  displayData.forEach((point: any, index: number) => {
    xAxisData.push(index);
    if (typeof point === 'object' && point !== null) {
      const real = point.real || 0;
      const imag = point.imag || 0;
      const amplitude = Math.sqrt(real * real + imag * imag);
      amplitudeData.push(amplitude);
    } else {
      amplitudeData.push(Math.abs(point || 0));
    }
  });

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';
  const amplitudeColor = '#00BFFF';
  const areaColor = 'rgba(0, 212, 255, 0.15)';
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">时域信号幅度</div>
                <div style="color: #66E5FF;">样本索引: ${point.dataIndex}</div>
                <div style="color: #99CCFF;">幅度: ${point.value.toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      name: '时间样本',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '幅度',
        type: 'line',
        data: amplitudeData,
        symbol: 'circle',
        symbolSize: 3,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: amplitudeColor },
              { offset: 0.5, color: accentColor },
              { offset: 1, color: amplitudeColor }
            ]
          },
          width: 3,
          shadowBlur: 8,
          shadowColor: glowColor
        },
        itemStyle: {
          color: amplitudeColor,
          borderColor: accentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 191, 255, 0.5)'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: areaColor },
              { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建幅度谱折线图
const createAmplitudeSpectrumChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 计算幅度谱数据
  const amplitudeData: number[] = [];
  const frequencyData: number[] = [];

  displayData.forEach((point: any, index: number) => {
    // 频率轴：从-fs/2到fs/2的归一化频率
    const normalizedFreq = (index - displayData.length / 2) / displayData.length;
    frequencyData.push(normalizedFreq);
    
    if (typeof point === 'object' && point !== null) {
      const real = point.real || 0;
      const imag = point.imag || 0;
      const amplitude = Math.sqrt(real * real + imag * imag);
      amplitudeData.push(amplitude);
    } else {
      amplitudeData.push(Math.abs(point || 0));
    }
  });

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';
  const spectrumColor = '#00BFFF';
  const areaColor = 'rgba(0, 212, 255, 0.15)';
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        const freq = frequencyData[point.dataIndex];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">频域信号幅度谱</div>
                <div style="color: #66E5FF;">归一化频率: ${freq.toFixed(4)}</div>
                <div style="color: #99CCFF;">幅度: ${point.value.toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'value',
      data: frequencyData,
      name: '归一化频率',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
        formatter: (value: number) => value.toFixed(2)
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '幅度谱',
        type: 'line',
        data: amplitudeData.map((amplitude, index) => [frequencyData[index], amplitude]),
        symbol: 'none',
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: spectrumColor },
              { offset: 0.5, color: accentColor },
              { offset: 1, color: spectrumColor }
            ]
          },
          width: 3,
          shadowBlur: 8,
          shadowColor: glowColor
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: areaColor },
              { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
            ]
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建时域图表
const createTimeDomainChart = () => {
  // 检查是否是CDMA模型的双用户数据
  if (selectedPhyModel.value === 'cdma') {
    const currentData = signalData.value[activeDataType.value];
    
    if (!currentData) {
      return createEmptyChart();
    }
    
    // 检查是否有user1和user2的数据结构
    const user1Data = currentData?.user1?.data?.[activeDataType.value];
    const user2Data = currentData?.user2?.data?.[activeDataType.value];
    
    if (!user1Data && !user2Data) {
      return createEmptyChart();
    }
    
    // 限制显示的数据点数量
    const maxPoints = 1000;
    const user1DisplayData = user1Data && user1Data.length > maxPoints
      ? user1Data.slice(-maxPoints)
      : user1Data || [];
    const user2DisplayData = user2Data && user2Data.length > maxPoints  
      ? user2Data.slice(-maxPoints)
      : user2Data || [];
    
    // 处理时域数据 - 计算幅度或直接使用实数值
    const user1TimeData: number[] = [];
    const user2TimeData: number[] = [];
    
    user1DisplayData.forEach((point: any) => {
      if (typeof point === 'object' && point !== null) {
        // 复数数据，计算幅度
        const real = point.real || 0;
        const imag = point.imag || 0;
        const amplitude = Math.sqrt(real * real + imag * imag);
        user1TimeData.push(amplitude);
      } else {
        // 实数数据
        user1TimeData.push(Math.abs(point || 0));
      }
    });
    
    user2DisplayData.forEach((point: any) => {
      if (typeof point === 'object' && point !== null) {
        // 复数数据，计算幅度
        const real = point.real || 0;
        const imag = point.imag || 0;
        const amplitude = Math.sqrt(real * real + imag * imag);
        user2TimeData.push(amplitude);
      } else {
        // 实数数据
        user2TimeData.push(Math.abs(point || 0));
      }
    });

    // 创建X轴数据（取最长的数据长度）
    const maxLength = Math.max(user1TimeData.length, user2TimeData.length);
    const xAxisData = Array.from({length: maxLength}, (_, index) => index);

    // 深色科技蓝主题配色
    const user1Color = '#00D4FF';  // 科技蓝主色 - User1
    const user2Color = '#FF6B6B';  // 珊瑚红 - User2
    const user1AccentColor = '#66E5FF';    
    const user2AccentColor = '#FF9999';
    const user1AreaColor = 'rgba(0, 212, 255, 0.15)';
    const user2AreaColor = 'rgba(255, 107, 107, 0.15)';
    const user1GlowColor = 'rgba(0, 212, 255, 0.8)';
    const user2GlowColor = 'rgba(255, 107, 107, 0.8)';

    const series = [];
    
    // User1 数据系列
    if (user1TimeData.length > 0) {
      series.push({
        name: 'User1 - 时域信号',
        type: 'line',
        data: user1TimeData,
        symbol: 'circle',
        symbolSize: 3,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: user1Color },
              { offset: 0.5, color: user1AccentColor },
              { offset: 1, color: user1Color }
            ]
          },
          width: 2,
          shadowBlur: 6,
          shadowColor: user1GlowColor
        },
        itemStyle: {
          color: user1Color,
          borderColor: user1AccentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: user1GlowColor
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: user1AreaColor },
              { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }
    
    // User2 数据系列  
    if (user2TimeData.length > 0) {
      series.push({
        name: 'User2 - 时域信号',
        type: 'line',
        data: user2TimeData,
        symbol: 'diamond',
        symbolSize: 3,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: user2Color },
              { offset: 0.5, color: user2AccentColor },
              { offset: 1, color: user2Color }
            ]
          },
          width: 2,
          shadowBlur: 6,
          shadowColor: user2GlowColor
        },
        itemStyle: {
          color: user2Color,
          borderColor: user2AccentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: user2GlowColor
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: user2AreaColor },
              { offset: 1, color: 'rgba(255, 107, 107, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500', 
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      });
    }

    return {
      backgroundColor: '#0A0E1A',
      legend: {
        data: series.map(s => s.name),
        textStyle: {
          color: '#E6F7FF',
          fontSize: 12
        },
        top: 10
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = '<div style="font-weight: bold; margin-bottom: 5px;">样本索引: ' + params[0].dataIndex + '</div>';
          params.forEach((param: any) => {
            const userColor = param.seriesName.includes('User1') ? user1Color : user2Color;
            result += `<div style="color: ${userColor};">${param.seriesName}: ${param.value.toFixed(4)}</div>`;
          });
          result += `<div style="color: #99CCFF; font-size: 12px; margin-top: 5px;">数据类型: ${activeDataType.value}</div>`;
          return result;
        },
        backgroundColor: 'rgba(10, 14, 26, 0.95)',
        borderColor: user1Color,
        borderWidth: 1,
        textStyle: {
          color: '#E6F7FF',
          fontSize: 13
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 212, 255, 0.3)'
      },
      grid: {
        left: '6%',
        right: '4%',
        top: '15%',
        bottom: '12%',
        containLabel: true,
        backgroundColor: 'rgba(15, 25, 40, 0.3)',
        borderColor: 'rgba(0, 212, 255, 0.2)',
        borderWidth: 1
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        name: '时间样本',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 5,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.1)',
            type: 'dashed',
            width: 1
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '幅度',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: user1Color,
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLabel: {
          fontSize: 12,
          color: '#66E5FF',
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: user1Color,
            width: 2,
            shadowBlur: 5,
            shadowColor: user1GlowColor
          }
        },
        axisTick: {
          show: true,
          length: 5,
          lineStyle: {
            color: user1AccentColor,
            width: 1
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(0, 212, 255, 0.1)',
            type: 'dashed',
            width: 1
          }
        }
      },
      series: series,
      dataZoom: [
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 5,
          backgroundColor: 'rgba(15, 25, 40, 0.8)',
          borderColor: user1Color,
          fillerColor: 'rgba(0, 212, 255, 0.3)',
          handleStyle: {
            color: user1Color,
            borderColor: user1AccentColor
          },
          textStyle: {
            color: '#66E5FF'
          }
        },
        {
          type: 'inside'
        }
      ]
    };
  }
  
  // 原有的单用户时域图逻辑
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // 限制显示的数据点数量
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 处理时域数据 - 计算幅度或直接使用实数值
  const timeData: number[] = [];
  const xAxisData: number[] = [];

  displayData.forEach((point: any, index: number) => {
    xAxisData.push(index);
    if (typeof point === 'object' && point !== null) {
      // 复数数据，计算幅度
      const real = point.real || 0;
      const imag = point.imag || 0;
      const amplitude = Math.sqrt(real * real + imag * imag);
      timeData.push(amplitude);
    } else {
      // 实数数据
      timeData.push(Math.abs(point || 0));
    }
  });

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';
  const timeColor = '#00BFFF';
  const areaColor = 'rgba(0, 212, 255, 0.15)';
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">时域信号</div>
                <div style="color: #66E5FF;">样本索引: ${point.dataIndex}</div>
                <div style="color: #99CCFF;">幅度: ${point.value.toFixed(4)}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      name: '时间样本',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '幅度',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: '时域信号',
        type: 'line',
        data: timeData,
        symbol: 'circle',
        symbolSize: 3,
        lineStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: timeColor },
              { offset: 0.5, color: accentColor },
              { offset: 1, color: timeColor }
            ]
          },
          width: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(0, 191, 255, 0.6)'
        },
        itemStyle: {
          color: timeColor,
          borderColor: accentColor,
          borderWidth: 1,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 191, 255, 0.5)'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: areaColor },
              { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            symbolSize: 8,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建ZigBee扩频码图表
const createSpreadingCodeChart = () => {
  const currentData = signalData.value[activeDataType.value];

  if (!currentData || currentData.length === 0) {
    return createEmptyChart();
  }

  // ZigBee扩频码通常是一个序列，显示为脉冲图
  const maxPoints = 1000;
  const displayData = currentData.length > maxPoints
    ? currentData.slice(-maxPoints)
    : currentData;

  // 处理扩频码数据
  const codeData: number[] = [];
  const xAxisData: number[] = [];

  displayData.forEach((value: any, index: number) => {
    xAxisData.push(index);
    if (typeof value === 'object' && value !== null) {
      // 如果是复数，取实部
      codeData.push(value.real || 0);
    } else {
      codeData.push(Number(value) || 0);
    }
  });

  // 深色科技蓝主题配色
  const primaryColor = '#00D4FF';
  const accentColor = '#66E5FF';
  const codeColor = '#FF6B35';  // 使用橙色来区分扩频码
  const glowColor = 'rgba(0, 212, 255, 0.8)';

  return {
    backgroundColor: '#0A0E1A',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `<div style="color: #00D4FF; font-weight: bold; margin-bottom: 5px;">ZigBee扩频码</div>
                <div style="color: #66E5FF;">码片索引: ${point.dataIndex}</div>
                <div style="color: #FF6B35;">码片值: ${point.value}</div>`;
      },
      backgroundColor: 'rgba(10, 14, 26, 0.95)',
      borderColor: primaryColor,
      borderWidth: 1,
      textStyle: {
        color: '#E6F7FF',
        fontSize: 13
      },
      shadowBlur: 10,
      shadowColor: 'rgba(0, 212, 255, 0.3)'
    },
    grid: {
      left: '6%',
      right: '4%',
      top: '3%',
      bottom: '12%',
      containLabel: true,
      backgroundColor: 'rgba(15, 25, 40, 0.3)',
      borderColor: 'rgba(0, 212, 255, 0.2)',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      name: '码片索引',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '扩频码值',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: primaryColor,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLabel: {
        fontSize: 12,
        color: '#66E5FF',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: primaryColor,
          width: 2,
          shadowBlur: 5,
          shadowColor: glowColor
        }
      },
      axisTick: {
        show: true,
        length: 5,
        lineStyle: {
          color: accentColor,
          width: 1
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.1)',
          type: 'dashed',
          width: 1
        }
      }
    },
    series: [
      {
        name: 'ZigBee扩频码',
        type: 'bar',
        data: codeData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: codeColor },
              { offset: 1, color: '#FF8C42' }
            ]
          },
          borderColor: '#FF4500',
          borderWidth: 1,
          shadowBlur: 6,
          shadowColor: 'rgba(255, 107, 53, 0.6)'
        },
        barWidth: '60%',
        emphasis: {
          itemStyle: {
            color: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 215, 0, 0.8)'
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 5,
        backgroundColor: 'rgba(15, 25, 40, 0.8)',
        borderColor: primaryColor,
        fillerColor: 'rgba(0, 212, 255, 0.3)',
        handleStyle: {
          color: primaryColor,
          borderColor: accentColor
        },
        textStyle: {
          color: '#66E5FF'
        }
      },
      {
        type: 'inside'
      }
    ]
  };
};

// 创建空图表
const createEmptyChart = () => {
  return {
    backgroundColor: '#0A0E1A', // 深色背景
    xAxis: {
      type: 'category',
      data: [],
      axisLine: {
        lineStyle: {
          color: '#00D4FF'
        }
      },
      axisLabel: {
        color: '#66E5FF'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#00D4FF'
        }
      },
      axisLabel: {
        color: '#66E5FF'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.15)'
        }
      }
    },
    series: [{
      data: [],
      type: 'line'
    }],
    graphic: {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无数据',
        fontSize: 18,
        fill: '#66E5FF',
        fontWeight: 'bold',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
      }
    }
  };
};
</script>

<style scoped lang="scss">
// 导入优化字体
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

// CSS变量定义
:root {
  --mono-font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
  --hex-cell-size: 36px;
  --hex-font-size: 16px;
  --offset-width: 120px;
  --ascii-width: 160px;
  --border-color: #dee2e6;
  --border-color-strong: #6c757d;
  --bg-gradient-light: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  --bg-gradient-header: linear-gradient(135deg, #e9ecef 0%, #f1f3f4 100%);
  --hover-color: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  --text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.signal-data-viewer {
  padding: 8px;
  background-color: #f8f9fa;
  min-height: 90vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-header {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .node-info {
      display: flex;
      align-items: center;
      gap: 6px;

      .node-name {
        font-weight: 600;
        font-size: 17px;
        color: #303133;
      }

      .node-id {
        font-size: 15px;
        color: #909399;
      }

      .session-info {
        font-size: 15px;
        color: #606266;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .phy-model-display {
      display: flex;
      align-items: center;
      gap: 6px;

      .model-label {
        font-size: 15px;
        color: #606266;
        font-weight: 500;
      }
    }
  }
}

.control-panel {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;

  .data-type-selector {
    display: flex;
    align-items: center;
    gap: 8px;

    .selector-label {
      font-size: 15px;
      color: #606266;
      font-weight: 500;
      white-space: nowrap;
    }

    :deep(.el-radio-group) {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }

    :deep(.el-radio-button__inner) {
      padding: 4px 8px;
      font-size: 14px;
      border-radius: 3px;
      transition: all 0.2s ease;
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      background-color: #409eff;
      border-color: #409eff;
      color: #fff;
    }
  }

  .status-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;

    .status-item {
      display: flex;
      align-items: center;
      gap: 4px;

      .label {
        font-size: 14px;
        color: #909399;
        white-space: nowrap;
      }

      .value {
        font-size: 14px;
        color: #303133;
        font-weight: 500;

        &.warning {
          color: #e6a23c;
        }
      }
    }
  }
}

.chart-container {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid #f0f2f5;
    background-color: #fafbfc;
    flex-shrink: 0;

    .chart-title {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #303133;
    }

    .chart-actions {
      display: flex;
      gap: 6px;
    }
  }

  .chart-content {
    padding: 12px;
    background-color: #ffffff;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .chart-element {
      width: 100%;
      background-color: #ffffff;
      border-radius: 4px;
      border: 1px solid #f0f2f5;
      flex: 1;
      min-height: 400px;
    }
  }
}

// 比特流查看器样式
.bit-stream-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__header) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;

    .el-dialog__title {
      font-weight: 700;
      font-size: 20px;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
  }
}

.bit-stream-viewer {
  .bit-stream-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-bottom: 2px solid #dee2e6;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    .toolbar-left {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;

      :deep(.el-tag) {
        font-weight: 600;
        font-size: 15px;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      }
    }

    .toolbar-right {
      display: flex;
      gap: 10px;

      :deep(.el-button) {
        font-weight: 600;
        font-size: 15px;
        padding: 10px 16px;
        border-radius: 6px;
      }
    }
  }

  .bit-stream-stats {
    display: flex;
    gap: 32px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-bottom: 2px solid #dee2e6;
    flex-wrap: wrap;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);

    .stats-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background-color: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;

      .label {
        font-weight: 600;
        color: #495057;
        font-size: 15px;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      }

      .value {
        color: #0d6efd;
        font-weight: 700;
        font-size: 16px;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        background-color: #e7f3ff;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #b6d7ff;
      }
    }
  }

  .bit-stream-table {
    height: 500px;
    overflow: auto;
    background-color: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;

    .table-container {
      font-family: var(--mono-font-family);
      font-size: var(--hex-font-size);
      line-height: 1.5;
      font-weight: 500;
      letter-spacing: 0.3px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;

      .table-header {
        display: flex;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 2px solid #6c757d;
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

        .offset-header {
          width: 120px;
          padding: 12px 14px;
          font-weight: 700;
          font-size: 15px;
          text-align: center;
          border-right: 2px solid #6c757d;
          color: #343a40;
          background: linear-gradient(135deg, #e9ecef 0%, #f1f3f4 100%);
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
          letter-spacing: 0.5px;
        }

        .hex-headers {
          display: flex;
          flex: 1;

          .hex-header {
            width: 36px;
            padding: 12px 4px;
            text-align: center;
            font-weight: 700;
            font-size: 14px;
            border-right: 1px solid #dee2e6;
            color: #343a40;
            background-color: #f8f9fa;
            text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
            letter-spacing: 0.3px;

            &.header-group-separator {
              border-left: 2px solid #6c757d;
              background: linear-gradient(135deg, #e9ecef 0%, #f1f3f4 100%);
              font-weight: 800;
            }
          }
        }

        .ascii-header {
          width: 160px;
          padding: 12px 14px;
          font-weight: 700;
          font-size: 15px;
          text-align: center;
          border-left: 2px solid #6c757d;
          color: #343a40;
          background: linear-gradient(135deg, #e9ecef 0%, #f1f3f4 100%);
          text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
          letter-spacing: 0.5px;
        }
      }

      .table-content {
        .table-row {
          display: flex;
          border-bottom: 1px solid #e9ecef;
          transition: all 0.2s ease;

          &.row-highlight {
            background-color: #f8f9fa;
          }

          &:hover {
            background-color: #e3f2fd;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .offset-cell {
            width: 120px;
            padding: 8px 14px;
            text-align: center;
            color: #495057;
            font-weight: 600;
            font-size: 15px;
            border-right: 2px solid #dee2e6;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;
            letter-spacing: 0.3px;
            text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
          }

          .hex-cells {
            display: flex;
            flex: 1;

            .hex-cell {
              width: 36px;
              padding: 8px 3px;
              text-align: center;
              border-right: 1px solid #f1f3f4;
              cursor: pointer;
              transition: all 0.15s ease;
              font-weight: 600;
              color: #212529;
              font-size: 16px;
              line-height: 1.3;
              letter-spacing: 0.2px;
              background-color: #ffffff;
              border-radius: 2px;
              margin: 1px;

              // 增强字体渲染
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;

              &:hover {
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                color: #856404;
                font-weight: 700;
                transform: scale(1.08);
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.4);
                border-radius: 4px;
                z-index: 5;
                position: relative;
              }

              &.cell-empty {
                color: #adb5bd;
                background-color: #f8f9fa;
                font-style: italic;

                &:hover {
                  background-color: #e9ecef;
                  transform: none;
                  box-shadow: none;
                }
              }

              &.cell-group-separator {
                border-left: 2px solid #6c757d;
                background: linear-gradient(135deg, #f1f3f4 0%, #e9ecef 100%);
                font-weight: 700;

                &:hover {
                  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                }
              }

              &.cell-highlighted {
                background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
                color: #155724;
                font-weight: 800;
                border: 2px solid #28a745;
                box-shadow: 0 0 8px rgba(40, 167, 69, 0.3);
                animation: highlight-pulse 1.5s ease-in-out infinite alternate;

                &:hover {
                  background: linear-gradient(135deg, #b8daff 0%, #9fcdff 100%);
                  color: #004085;
                  border-color: #007bff;
                  box-shadow: 0 0 12px rgba(0, 123, 255, 0.4);
                }
              }
            }

            @keyframes highlight-pulse {
              0% {
                box-shadow: 0 0 8px rgba(40, 167, 69, 0.3);
              }
              100% {
                box-shadow: 0 0 12px rgba(40, 167, 69, 0.6);
              }
            }
          }

          .ascii-cell {
            width: 160px;
            padding: 8px 14px;
            font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;
            color: #495057;
            font-weight: 500;
            font-size: 16px;
            line-height: 1.3;
            border-left: 2px solid #6c757d;
            background: linear-gradient(135deg, #fafbfc 0%, #f1f3f4 100%);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            letter-spacing: 0.8px;

            // 增强字体渲染
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;

            // 特殊字符样式
            .ascii-char {
              display: inline-block;
              padding: 1px 2px;
              border-radius: 2px;

              &.printable {
                color: #28a745;
                font-weight: 600;
              }

              &.non-printable {
                color: #6c757d;
                background-color: #e9ecef;
                font-style: italic;
              }
            }
          }
        }
      }
    }
  }
}

// 响应式设计
@media screen and (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;

    .title-section {
      width: 100%;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }

  .data-status .status-info {
    flex-direction: column;
    gap: 12px;
  }

  .bit-stream-viewer {
    .bit-stream-toolbar {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;

      .toolbar-left, .toolbar-right {
        width: 100%;
        justify-content: flex-start;
      }
    }

    .bit-stream-stats {
      flex-direction: column;
      gap: 8px;
    }

    .bit-stream-table {
      .table-container {
        font-size: 12px;

        .table-header {
          .offset-header {
            width: 100px;
            padding: 8px 10px;
            font-size: 11px;
          }

          .hex-headers .hex-header {
            width: 28px;
            padding: 8px 2px;
            font-size: 10px;
          }

          .ascii-header {
            width: 120px;
            padding: 8px 10px;
            font-size: 11px;
          }
        }

        .table-content .table-row {
          .offset-cell {
            width: 100px;
            padding: 6px 10px;
            font-size: 11px;
          }

          .hex-cells .hex-cell {
            width: 28px;
            padding: 6px 2px;
            font-size: 12px;
          }

          .ascii-cell {
            width: 120px;
            padding: 6px 10px;
            font-size: 12px;
          }
        }
      }
    }
  }
}
</style>
