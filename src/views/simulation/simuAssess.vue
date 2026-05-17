<template>
    <div class="simulation-container">
            <div class="content-area">
                <!-- 场景信息提示 -->
                <el-alert 
                    v-if="topoStore.currentSessionId" 
                    :title="`当前场景: ${topoStore.currentSessionName || '未命名场景'} (ID: ${topoStore.currentSessionId})`" 
                    type="info" 
                    :closable="false"
                    show-icon
                    style="margin-bottom: 10px; padding: 0%;"
                />
                <el-alert 
                    v-else 
                    title="未加载场景" 
                    type="warning" 
                    :closable="false"
                    show-icon
                    style="margin-bottom: 10px;"
                >
                    <template #default>
                        请先加载仿真场景
                    </template>
                </el-alert>

                <!-- 链路测量 -->
                <div v-if="activeMenuItem === '1-1'">
                    <LinkMeasurementForm 
                        :docker-nodes="measurementData.dockerNodes.value"
                        :route-links="measurementData.routeLinks.value"
                        :loading="linkMeasurementLoading"
                        @submit="handleLinkMeasurementSubmit"
                        @reset="handleLinkMeasurementReset"
                    />
                </div>

                <!-- 节点测量 -->
                <div v-if="activeMenuItem === '1-2'">
                    <NodeMeasurementForm 
                        :docker-nodes="measurementData.dockerNodes.value"
                        :loading="nodeMeasurementLoading"
                        :is-monitoring="passiveMeasurement.isMonitoring.value"
                        @submit="handleNodeMeasurementSubmit"
                        @reset="handleNodeMeasurementReset"
                    />
                </div>

                <!-- 主动测量结果查询 -->
                <div v-if="activeMenuItem === '2-1'">
                    <ActiveMeasurementResults 
                        :data="filteredActiveData"
                        :loading="activeMeasurement.activeResultQueryLoading.value"
                        :available-links="measurementData.availableLinks.value"
                        ref="activeResultsRef"
                        @link-change="onLinkChange"
                        @refresh-chart="updateActiveChart"
                        @query-selected-link="onQuerySelectedLink"
                    />
                </div>

                <!-- 被动测量结果查询 -->
                <div v-if="activeMenuItem === '2-2'">
                    <PassiveMeasurementResults 
                        :data="passiveMeasurement.filteredPassiveResultData.value"
                        :loading="passiveMeasurement.passiveResultQueryLoading.value"
                        :available-containers="measurementData.availableContainers.value"
                        ref="passiveResultsRef"
                        @container-change="onContainerChange"
                        @refresh-chart="updatePassiveChart"
                    />
                </div>
            </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTopoStore } from '../../store/modules/topo';
import { 
    useMeasurementData, 
    useActiveMeasurement, 
    usePassiveMeasurement 
} from './composables/useMeasurementData';
import LinkMeasurementForm from './components/LinkMeasurementForm.vue';
import NodeMeasurementForm from './components/NodeMeasurementForm.vue';
import ActiveMeasurementResults from './components/ActiveMeasurementResults.vue';
import PassiveMeasurementResults from './components/PassiveMeasurementResults.vue';
import type { LinkMeasurementForm as LinkForm, NodeMeasurementForm as NodeForm } from './types';
import { 
    processActiveMeasurementData,
    processPassiveMeasurementData,
    createGridStyle,
    createChartContainerStyle,
    createBaseChartOption,
    createChartSeries,
    createActiveChartSeries,
    initChart
} from './utils/chartUtils';


const route = useRoute();
const activeMenuItem = computed(() => (route.query.tab as string) || '1-1');

// 获取topo store
const topoStore = useTopoStore();

// 使用composables
const measurementData = useMeasurementData();
const activeMeasurement = useActiveMeasurement();
const passiveMeasurement = usePassiveMeasurement();

// 组件引用
const activeResultsRef = ref();
const passiveResultsRef = ref();

// 加载状态
const linkMeasurementLoading = ref(false);
const nodeMeasurementLoading = ref(false);

let autoRefreshTimer: number | null = null;

// 临时变量，用于监听上报间隔变化
const nodeMeasurementForm = ref({
    reportInterval: 10
});

// 修改自动刷新逻辑，被动查询按照上报间隔进行刷新
const startAutoRefresh = () => {
    if (!autoRefreshEnabled.value) return;
    
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    let interval: number;
    if (activeMenuItem.value === '2-1') {
        // 主动测量结果页面不自动查询，只更新图表
        return;
    } else if (activeMenuItem.value === '2-2') {
        // 被动查询按照上报间隔进行刷新，最小1秒，最大60秒
        interval = Math.max(1000, Math.min(60000, (nodeMeasurementForm.value.reportInterval || 10) * 1000));
    } else {
        return;
    }
    
    autoRefreshTimer = setInterval(async () => {
        if (activeMenuItem.value === '2-2') {
            await passiveMeasurement.queryPassiveResults(passiveResultsRef.value?.chartForm.selectedContainer || '');
        }
    }, interval);
};

// 停止自动刷新
const stopAutoRefresh = () => {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
};

// 监听 tab 切换，进入结果页面时自动刷新
watch(activeMenuItem, (index) => {
    if (index === '2-1' || index === '2-2') {
        setTimeout(async () => {
            if (index === '2-1') {
                updateActiveChart();
            } else {
                await passiveMeasurement.queryPassiveResults(passiveResultsRef.value?.chartForm.selectedContainer || '');
                updatePassiveChart();
                stopAutoRefresh();
                startAutoRefresh();
            }
        }, 100);
    } else {
        stopAutoRefresh();
    }
});

// 链路测量处理
const handleLinkMeasurementSubmit = async (form: LinkForm) => {
    try {
        linkMeasurementLoading.value = true;
        await activeMeasurement.startLinkMeasurement(form);
    } finally {
        linkMeasurementLoading.value = false;
    }
};

const handleLinkMeasurementReset = () => {
    // 重置逻辑
};

// 节点测量处理
const handleNodeMeasurementSubmit = async (form: NodeForm) => {
    try {
        nodeMeasurementLoading.value = true;
        const success = await passiveMeasurement.startNodeMeasurement(form);
        if (success) {
            // 下发后不自动查询
        }
    } finally {
        nodeMeasurementLoading.value = false;
    }
};

const handleNodeMeasurementReset = () => {
    // 重置逻辑
};

// 链路选择变化处理
const onLinkChange = async (link: string) => {
    // 当链路选择变化时，只更新图表显示，不自动查询
    if (activeMenuItem.value === '2-1') {
        setTimeout(() => {
            updateActiveChart();
        }, 100);
    }
};

// 查询选中链路数据
const onQuerySelectedLink = async (link: string) => {
    if (activeMenuItem.value === '2-1' && link) {
        await activeMeasurement.querySelectedLinkResults(link);
        
        // 添加调试信息
        
        // 等待数据查询完成后自动更新图表
        setTimeout(() => {
            updateActiveChart();
        }, 100);
    }
};

// 获取过滤后的主动测量数据
const filteredActiveData = computed(() => {
    const selectedLink = activeResultsRef.value?.chartForm?.selectedLink || '';
    if (!selectedLink) {
        return []; // 未选择链路时返回空数组
    }
    if (!activeResultsRef.value) return activeMeasurement.activeResultData.value || [];
    return activeMeasurement.getFilteredActiveResultData(selectedLink);
});

// 容器选择变化处理
const onContainerChange = async (container: string) => {
    // 当容器选择变化时，重新查询该容器的数据并自动更新图表
    if (activeMenuItem.value === '2-2' && container) {
        await passiveMeasurement.queryPassiveResults(container);
        // 等待数据查询完成后自动更新图表
        setTimeout(() => {
            updatePassiveChart();
        }, 100);
    }
};

// 更新图表
const updateActiveChart = () => {
    if (activeResultsRef.value?.chartRef) {
        const chartContainer = activeResultsRef.value.chartRef;
        if (!chartContainer) return;
        
        const selectedLink = activeResultsRef.value.chartForm?.selectedLink || '';
        // 使用filteredActiveData而不是activeMeasurement.activeResultData.value
        const data = filteredActiveData.value;
        
        
        // 如果未选择链路，显示提示信息
        if (!selectedLink) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">请先选择链路并查询数据</div>';
            return;
        }
        
        if (!data || data.length === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">暂无主动测量数据，请点击查询按钮获取数据</div>';
            return;
        }
        
        
        // 处理数据
        const metrics = processActiveMeasurementData(data, selectedLink);
        
        // 清空容器
        chartContainer.innerHTML = '';
        
        // 创建图表网格布局 - 只显示4个指标
        chartContainer.style.cssText = createGridStyle(2, 2);
        
        // 为每个指标创建图表（只显示throughput、latency、jitter、lossrate）
        const metricKeys = ['throughput', 'latency', 'jitter', 'lossrate'];
        let chartCount = 0;
        
        metricKeys.forEach((metricKey, index) => {
            const metric = metrics[metricKey as keyof typeof metrics];
            
            if (metric && Object.keys(metric.data).length > 0) {
                const chartDiv = document.createElement('div');
                chartDiv.style.cssText = createChartContainerStyle();
                chartContainer.appendChild(chartDiv);
                
                const chart = initChart(chartDiv);
                
                // 准备图表数据
                const series = createActiveChartSeries(metric.data);
                const option = createBaseChartOption(metric.name, series);
                
                chart.setOption(option);
                chartCount++;
            }
        });
        
        
        // 如果没有创建任何图表，显示提示信息
        if (chartCount === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">数据格式不支持图表显示</div>';
        }
    }
};

const updatePassiveChart = () => {
    if (passiveResultsRef.value?.chartRef) {
        const chartContainer = passiveResultsRef.value.chartRef;
        if (!chartContainer) return;
        
        const data = passiveMeasurement.filteredPassiveResultData.value;
        const selectedContainer = passiveResultsRef.value.chartForm.selectedContainer;
        
        if (!data || data.length === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">暂无被动测量数据</div>';
            return;
        }
        
        // 处理数据
        const metrics = processPassiveMeasurementData(data, selectedContainer);
        
        // 清空容器
        chartContainer.innerHTML = '';
        
        // 创建图表网格布局
        chartContainer.style.cssText = createGridStyle(2, 4);
        
        // 为每个指标创建图表
        Object.entries(metrics).forEach(([metricKey, metric], index) => {
            const chartDiv = document.createElement('div');
            chartDiv.style.cssText = createChartContainerStyle();
            chartContainer.appendChild(chartDiv);
            
            const chart = initChart(chartDiv);
            
            // 准备图表数据
            const series = createChartSeries(metric.data);
            
            const option = {
                ...createBaseChartOption(metric.name, series),
                legend: {
                    data: Object.keys(metric.data).map(name => [name, `${name}(柱状图)`]).flat(),
                    bottom: 10,
                    type: 'scroll',
                    formatter: function(name: string) {
                        // 只显示eth网卡的图例，过滤掉容器级别的指标
                        if (name.includes('-') && name.includes('eth')) {
                            const parts = name.split('-');
                            if (parts.length >= 2) {
                                return `${parts[0]}-${parts[1]}`; // 显示为 "容器名-网卡名"
                            }
                        }
                        // 如果不是eth网卡，不显示在图例中
                        return '';
                    }
                }
            };
            
            chart.setOption(option);
        });
    }
};

// 自动刷新控制
const autoRefreshEnabled = ref(true);

// 添加对上报间隔变化的监听
watch(() => nodeMeasurementForm.value.reportInterval, (newInterval) => {
    // 如果当前在被动测量结果页面，重新启动自动刷新
    if (activeMenuItem.value === '2-2' && autoRefreshEnabled.value) {
        stopAutoRefresh();
        startAutoRefresh();
    }
});

// 初始化
onMounted(async () => {    
});

// 组件卸载时清理定时器
onUnmounted(() => {
    stopAutoRefresh();
});
</script>

<style scoped lang="scss">
.simulation-container {
    height: 100%;

    .content-area {
        height: 100%;
        overflow: auto;
    }
}
</style>