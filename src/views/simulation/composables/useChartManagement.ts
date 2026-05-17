import { ref, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { 
    createGridStyle, 
    createChartContainerStyle, 
    createBaseChartOption,
    processActiveMeasurementData,
    processPassiveMeasurementData,
    createChartSeries,
    initChart,
} from '../utils/chartUtils';
import type { ActiveResultItem, PassiveResultItem } from '../types';

export const useChartManagement = () => {
    const activeChartRef = ref<HTMLElement>();
    const passiveChartRef = ref<HTMLElement>();
    const activeChart = ref<echarts.ECharts>();
    const passiveChart = ref<echarts.ECharts>();
    const chartLoading = ref(false);

    // 初始化图表
    const initCharts = () => {
        if (activeChartRef.value) {
            activeChart.value = echarts.init(activeChartRef.value);
        }
        if (passiveChartRef.value) {
            passiveChart.value = echarts.init(passiveChartRef.value);
        }
    };

    // 更新主动测量结果图表
    const updateActiveChart = (data: ActiveResultItem[], selectedLink: string) => {
        
        if (!activeChartRef.value) {
            console.error('图表容器不存在');
            return;
        }
        
        if (!data || data.length === 0) {
            const chartContainer = activeChartRef.value;
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">暂无主动测量数据</div>';
            return;
        }
        
        // 处理数据
        const metrics = processActiveMeasurementData(data, selectedLink);
        
        // 创建图表容器
        const chartContainer = activeChartRef.value;
        if (!chartContainer) {
            console.error('图表容器不存在');
            return;
        }
        
        // 清空容器
        chartContainer.innerHTML = '';
        
        // 创建图表网格布局
        chartContainer.style.cssText = createGridStyle(2, 3);
        
        // 为每个指标创建图表
        Object.entries(metrics).forEach(([metricKey, metric], index) => {
            const chartDiv = document.createElement('div');
            chartDiv.style.cssText = createChartContainerStyle();
            chartContainer.appendChild(chartDiv);
            
            const chart = initChart(chartDiv);
            
            // 准备图表数据 - 为每个链路创建折线图和柱状图
            const series = createChartSeries(metric.data);
            
            const option = createBaseChartOption(metric.name, series);
            
            chart.setOption(option);
        });
        
    };

    // 更新被动测量结果图表
    const updatePassiveChart = (data: PassiveResultItem[], containerName: string) => {
        
        if (!passiveChartRef.value) {
            console.error('图表容器不存在');
            return;
        }
        
        if (!data || data.length === 0) {
            const chartContainer = passiveChartRef.value;
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #999;">暂无被动测量数据</div>';
            return;
        }
        
        // 处理数据
        const metrics = processPassiveMeasurementData(data, containerName);
        
        // 创建图表容器
        const chartContainer = passiveChartRef.value;
        if (!chartContainer) {
            console.error('图表容器不存在');
            return;
        }
        
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
            
            // 准备图表数据 - 为每个网卡接口创建折线图和柱状图
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
        
    };

    // 组件卸载时清理定时器
    onUnmounted(() => {
        if (activeChart.value) {
            activeChart.value.dispose();
        }
        if (passiveChart.value) {
            passiveChart.value.dispose();
        }
    });

    return {
        activeChartRef,
        passiveChartRef,
        activeChart,
        passiveChart,
        chartLoading,
        initCharts,
        updateActiveChart,
        updatePassiveChart
    };
}; 