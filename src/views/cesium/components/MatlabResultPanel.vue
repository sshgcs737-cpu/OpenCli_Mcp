<template>
  <el-dialog
    v-model="visible"
    title="MATLAB 执行结果"
    width="85%"
    :before-close="handleClose"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    center
    destroy-on-close
    top="5vh"
  >
    <div class="matlab-result-container">
      <div class="result-header">
        <h3>{{ currentFilename }}</h3>
        <p>FHSS (跳频扩频) 通信系统仿真结果</p>
      </div>

      <div class="charts-grid">
        <div class="chart-item">
          <h4>误比特率 vs 信噪比</h4>
          <v-chart
            class="chart"
            :option="berChartOption"
            :autoresize="true"
          />
        </div>

        <div class="chart-item">
          <h4>基带信号 (前20bits)</h4>
          <v-chart
            class="chart"
            :option="basebandChartOption"
            :autoresize="true"
          />
        </div>

        <div class="chart-item">
          <h4>MSK调制信号频谱</h4>
          <v-chart
            class="chart"
            :option="mskSpectrumOption"
            :autoresize="true"
          />
        </div>

        <div class="chart-item">
          <h4>跳频调制信号频谱</h4>
          <v-chart
            class="chart"
            :option="fhSpectrumOption"
            :autoresize="true"
          />
        </div>

        <div class="chart-item">
          <h4>经信道后的信号频谱</h4>
          <v-chart
            class="chart"
            :option="noisySpectrumOption"
            :autoresize="true"
          />
        </div>

        <div class="chart-item">
          <h4>解跳信号频谱</h4>
          <v-chart
            class="chart"
            :option="unjumpSpectrumOption"
            :autoresize="true"
          />
        </div>
      </div>

      <div class="result-summary">
        <h4>仿真参数</h4>
        <div class="params-grid">
          <div class="param-item">
            <span class="param-label">数据速率:</span>
            <span class="param-value">50 Kb/s</span>
          </div>
          <div class="param-item">
            <span class="param-label">跳频速率:</span>
            <span class="param-value">1000 h/s</span>
          </div>
          <div class="param-item">
            <span class="param-label">跳频带宽:</span>
            <span class="param-value">5 MHz</span>
          </div>
          <div class="param-item">
            <span class="param-label">频点数目:</span>
            <span class="param-value">25</span>
          </div>
          <div class="param-item">
            <span class="param-label">中心频率:</span>
            <span class="param-value">3 MHz</span>
          </div>
          <div class="param-item">
            <span class="param-label">调制方式:</span>
            <span class="param-value">MSK</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { use } from 'echarts/core';
import {
  CanvasRenderer
} from 'echarts/renderers';
import {
  LineChart,
  BarChart
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
} from 'echarts/components';
import VChart from 'vue-echarts';
import eventBus from '../../../utils/eventBus';

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
]);

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const currentFilename = ref('');
const resultsData = ref<any>(null);

const berChartOption = computed(() => {
  if (!resultsData.value?.ber) return {};
  
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0];
        return `SNR: ${point.name} dB<br/>BER: ${point.value.toExponential(2)}`;
      }
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.ber.snr.map((v: number) => v.toString()),
      name: 'SNR (dB)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'log',
      name: 'BER',
      nameLocation: 'center',
      nameGap: 50,
      min: 1e-6
    },
    series: [{
      data: resultsData.value.ber.ber,
      type: 'line',
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        color: '#ff6b6b'
      },
      itemStyle: {
        color: '#ff6b6b'
      }
    }],
    grid: {
      left: 80,
      right: 20,
      top: 20,
      bottom: 60
    }
  };
});

const basebandChartOption = computed(() => {
  if (!resultsData.value?.baseband) return {};
  
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.baseband.time.map((t: number) => (t * 1000).toFixed(2)),
      name: 'Time (ms)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: 'Amplitude',
      nameLocation: 'center',
      nameGap: 40,
      min: -1.5,
      max: 1.5
    },
    series: [{
      data: resultsData.value.baseband.signal,
      type: 'line',
      step: 'end',
      lineStyle: {
        color: '#4dabf7',
        width: 2
      },
      itemStyle: {
        color: '#4dabf7'
      },
      symbol: 'none'
    }],
    grid: {
      left: 60,
      right: 20,
      top: 20,
      bottom: 60
    }
  };
});

const mskSpectrumOption = computed(() => {
  if (!resultsData.value?.spectrum) return {};
  
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.spectrum.frequency.map((f: number) => (f / 1000).toFixed(0)),
      name: 'Frequency (kHz)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: 'Magnitude',
      nameLocation: 'center',
      nameGap: 50
    },
    series: [{
      data: resultsData.value.spectrum.msk,
      type: 'line',
      lineStyle: {
        color: '#51cf66',
        width: 1
      },
      symbol: 'none'
    }],
    grid: {
      left: 70,
      right: 20,
      top: 20,
      bottom: 60
    },
    dataZoom: [{
      type: 'inside'
    }]
  };
});

const fhSpectrumOption = computed(() => {
  if (!resultsData.value?.spectrum) return {};
  
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.spectrum.frequency.map((f: number) => (f / 1000).toFixed(0)),
      name: 'Frequency (kHz)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: 'Magnitude',
      nameLocation: 'center',
      nameGap: 50
    },
    series: [{
      data: resultsData.value.spectrum.fh,
      type: 'line',
      lineStyle: {
        color: '#ffd43b',
        width: 1
      },
      symbol: 'none'
    }],
    grid: {
      left: 70,
      right: 20,
      top: 20,
      bottom: 60
    },
    dataZoom: [{
      type: 'inside'
    }]
  };
});

const noisySpectrumOption = computed(() => {
  if (!resultsData.value?.spectrum) return {};
  
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.spectrum.frequency.map((f: number) => (f / 1000).toFixed(0)),
      name: 'Frequency (kHz)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: 'Magnitude',
      nameLocation: 'center',
      nameGap: 50
    },
    series: [{
      data: resultsData.value.spectrum.noisy,
      type: 'line',
      lineStyle: {
        color: '#ff8787',
        width: 1
      },
      symbol: 'none'
    }],
    grid: {
      left: 70,
      right: 20,
      top: 20,
      bottom: 60
    },
    dataZoom: [{
      type: 'inside'
    }]
  };
});

const unjumpSpectrumOption = computed(() => {
  if (!resultsData.value?.spectrum) return {};
  
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: resultsData.value.spectrum.frequency.map((f: number) => (f / 1000).toFixed(0)),
      name: 'Frequency (kHz)',
      nameLocation: 'center',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: 'Magnitude',
      nameLocation: 'center',
      nameGap: 50
    },
    series: [{
      data: resultsData.value.spectrum.unjump,
      type: 'line',
      lineStyle: {
        color: '#9775fa',
        width: 1
      },
      symbol: 'none'
    }],
    grid: {
      left: 70,
      right: 20,
      top: 20,
      bottom: 60
    },
    dataZoom: [{
      type: 'inside'
    }]
  };
});

const handleClose = () => {
  visible.value = false;
};

const handleMatlabResults = (data: any) => {
  currentFilename.value = data.filename;
  resultsData.value = data.results;
};

onMounted(() => {
  eventBus.on('matlabResults', handleMatlabResults);
});

onUnmounted(() => {
  eventBus.off('matlabResults', handleMatlabResults);
});
</script>

<style scoped>
.matlab-result-container {
  padding: 20px;
  background: var(--el-bg-color);
  max-height: 80vh;
  overflow-y: auto;
}

.result-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color);
}

.result-header h3 {
  color: var(--el-text-color-primary);
  margin: 0 0 10px 0;
  font-size: 20px;
}

.result-header p {
  color: var(--el-text-color-regular);
  margin: 0;
  font-size: 14px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.chart-item {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.chart-item h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  text-align: center;
}

.chart {
  width: 100%;
  height: 280px;
}

.result-summary {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 20px;
  margin-top: 15px;
}

.result-summary h4 {
  margin: 0 0 15px 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.param-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 3px;
  font-size: 13px;
}

.param-label {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.param-value {
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-family: monospace;
}

/* 暗色主题适配 */
.dark .matlab-result-container {
  background: var(--el-bg-color);
}

.dark .chart-item,
.dark .result-summary {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
}

.dark .param-item {
  background: var(--el-bg-color-page);
  border-color: var(--el-border-color);
}

@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
  }
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .chart-item {
    padding: 12px;
  }
  
  .chart {
    height: 220px;
  }
  
  .params-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .matlab-result-container {
    padding: 15px;
  }
}

/* 添加滚动条样式 */
.matlab-result-container::-webkit-scrollbar {
  width: 6px;
}

.matlab-result-container::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 3px;
}

.matlab-result-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color-dark);
  border-radius: 3px;
}

.matlab-result-container::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}
</style>