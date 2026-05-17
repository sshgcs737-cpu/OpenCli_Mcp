import * as echarts from 'echarts';
import type { Metrics, PassiveMetrics } from '../types';

// 图表颜色配置
export const CHART_COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9c27b0', '#ff9800', '#795548'];

// 获取测量类型标签
export const getControlTypeTag = (type: number): string => {
    const tagMap: Record<number, string> = {
        1: 'primary',
        2: 'success',
        3: 'warning',
        11: 'info'
    };
    return tagMap[type] || 'default';
};

// 获取测量类型文本
export const getControlTypeText = (type: number): string => {
    const textMap: Record<number, string> = {
        1: 'iperf TCP',
        2: 'iperf UDP',
        3: 'hping3',
        11: 'iperf TCP流'
    };
    return textMap[type] || '未知';
};

// 获取节点类型标签
export const getNodeTypeTag = (type: string): string => {
    const tagMap: Record<string, string> = {
        DOCKER: 'success'
    };
    return tagMap[type] || 'default';
};

// 创建图表网格布局样式
export const createGridStyle = (columns: number, rows: number): string => {
    return `
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        grid-template-rows: repeat(${rows}, 1fr);
        gap: 20px;
        height: 100%;
        padding: 20px;
        min-height: 600px;
    `;
};

// 创建图表容器样式
export const createChartContainerStyle = (): string => {
    return `
        width: 100%;
        height: 350px;
        min-height: 350px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        padding: 15px;
        background: white;
        box-sizing: border-box;
    `;
};

// 创建基础图表选项
export const createBaseChartOption = (title: string, series: any[], colors: string[] = CHART_COLORS) => {
    // 获取数据点的数量（从第一个系列的数据长度）
    const dataLength = series.length > 0 && series[0].data ? series[0].data.length : 10;
    
    
    // 根据标题确定Y轴单位
    let yAxisUnit = '';
    if (title.includes('吞吐量')) {
        yAxisUnit = 'Kbits/sec';
    } else if (title.includes('时延') || title.includes('抖动')) {
        yAxisUnit = 'ms';
    } else if (title.includes('丢包率')) {
        yAxisUnit = '%';
    } else if (title.includes('包数') || title.includes('丢包数') || title.includes('错误包数')) {
        yAxisUnit = '个';
    } else if (title.includes('字节数')) {
        yAxisUnit = 'Bytes';
    }
    
    const option = {
        title: {
            text: title,
            left: 'center',
            top: 15,
            textStyle: { fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: function(params: any) {
                let result = `${params[0].axisValue}<br/>`;
                params.forEach((param: any) => {
                    let value = param.value;
                    let unit = '';
                    
                    // 根据指标类型添加单位
                    if (title.includes('吞吐量')) {
                        unit = ' Kbits/sec';
                        if (value >= 1000000) {
                            value = (value / 1000000).toFixed(2) + ' Gbits/sec';
                        } else if (value >= 1000) {
                            value = (value / 1000).toFixed(2) + ' Mbits/sec';
                        } else {
                            value = value.toFixed(2) + unit;
                        }
                    } else if (title.includes('时延') || title.includes('抖动')) {
                        unit = ' ms';
                        value = value.toFixed(2) + unit;
                    } else if (title.includes('丢包率')) {
                        unit = ' %';
                        value = value.toFixed(2) + unit;
                    } else if (title.includes('包数') || title.includes('丢包数') || title.includes('错误包数')) {
                        unit = ' 个';
                        value = value.toFixed(0) + unit;
                    } else if (title.includes('字节数')) {
                        unit = ' Bytes';
                        if (value >= 1000000) {
                            value = (value / 1000000).toFixed(2) + ' MB';
                        } else if (value >= 1000) {
                            value = (value / 1000).toFixed(2) + ' KB';
                        } else {
                            value = value.toFixed(0) + unit;
                        }
                    } else {
                        // 默认格式化
                        if (value >= 1000000) {
                            value = (value / 1000000).toFixed(2) + 'M';
                        } else if (value >= 1000) {
                            value = (value / 1000).toFixed(2) + 'K';
                        } else if (value >= 1) {
                            value = value.toFixed(2);
                        } else {
                            value = value.toFixed(4);
                        }
                    }
                    result += `${param.marker}${param.seriesName}: ${value}<br/>`;
                });
                return result;
            }
        },
        legend: {
            data: series.map(s => s.name),
            bottom: 15,
            type: 'scroll',
            textStyle: {
                fontSize: 12
            }
        },
        grid: [
            { 
                left: '8%', 
                right: '8%', 
                top: '20%', 
                bottom: '30%',
                containLabel: true
            }
        ],
        xAxis: {
            type: 'category',
            data: Array.from({length: dataLength}, (_, i) => `数据${i + 1}`),
            axisLabel: { 
                rotate: 0,
                fontSize: 12,
                margin: 8
            },
            axisTick: { show: true },
            name: '时间顺序',
            nameLocation: 'middle',
            nameGap: 30
        },
        yAxis: [
            {
                type: 'value',
                name: `折线图 (${yAxisUnit})`,
                position: 'left',
                splitLine: { show: true },
                axisLabel: {
                    fontSize: 12,
                    margin: 8,
                    formatter: function(value: number) {
                        // 根据指标类型格式化Y轴标签
                        if (title.includes('吞吐量')) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'G';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'M';
                            }
                            return value.toFixed(1) + 'K';
                        } else if (title.includes('时延') || title.includes('抖动')) {
                            return value.toFixed(1) + 'ms';
                        } else if (title.includes('丢包率')) {
                            return value.toFixed(1) + '%';
                        } else if (title.includes('包数') || title.includes('丢包数') || title.includes('错误包数')) {
                            return value.toFixed(0) + '个';
                        } else if (title.includes('字节数')) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'MB';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'KB';
                            }
                            return value.toFixed(0) + 'B';
                        } else {
                            // 默认格式化
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'K';
                            }
                            return value.toFixed(1);
                        }
                    }
                }
            },
            {
                type: 'value',
                name: `柱状图 (${yAxisUnit})`,
                position: 'right',
                splitLine: { show: false },
                axisLabel: {
                    fontSize: 12,
                    margin: 8,
                    formatter: function(value: number) {
                        // 根据指标类型格式化Y轴标签
                        if (title.includes('吞吐量')) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'G';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'M';
                            }
                            return value.toFixed(1) + 'K';
                        } else if (title.includes('时延') || title.includes('抖动')) {
                            return value.toFixed(1) + 'ms';
                        } else if (title.includes('丢包率')) {
                            return value.toFixed(1) + '%';
                        } else if (title.includes('包数') || title.includes('丢包数') || title.includes('错误包数')) {
                            return value.toFixed(0) + '个';
                        } else if (title.includes('字节数')) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'MB';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'KB';
                            }
                            return value.toFixed(0) + 'B';
                        } else {
                            // 默认格式化
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'K';
                            }
                            return value.toFixed(1);
                        }
                    }
                }
            }
        ],
        series: series,
        color: colors
    };
    
    return option;
};

// 处理主动测量数据
export const processActiveMeasurementData = (data: any[], selectedLink: string): Metrics => {
    
    // 按链路分组数据
    let linkGroups = data.reduce((acc, item) => {
        const linkKey = item.direction || item.linkLabel || `${item.srcContainer} → ${item.dstContainer}`;
        if (!acc[linkKey]) {
            acc[linkKey] = [];
        }
        acc[linkKey].push(item);
        return acc;
    }, {} as Record<string, any[]>);


    // 如果指定了选中的链路，只处理该链路的数据
    if (selectedLink) {
        const filteredGroups: Record<string, any[]> = {};
        if (linkGroups[selectedLink]) {
            filteredGroups[selectedLink] = linkGroups[selectedLink];
        }
        linkGroups = filteredGroups;
    }

    // 为每个链路获取最新的10条数据，并按时间正序排列（修复顺序颠倒问题）
    Object.keys(linkGroups).forEach(link => {
        // 先按时间倒序排序获取最新数据
        linkGroups[link].sort((a: any, b: any) => new Date(b.beginTime).getTime() - new Date(a.beginTime).getTime());
        if (linkGroups[link].length > 10) {
            linkGroups[link] = linkGroups[link].slice(0, 10);
        }
        // 然后按时间正序排列，确保图表显示正确的时间顺序
        linkGroups[link].sort((a: any, b: any) => new Date(a.beginTime).getTime() - new Date(b.beginTime).getTime());
    });

    // 准备4个指标的数据（throughput、latency、jitter、lossrate）
    const metrics: Metrics = {
        throughput: { name: '吞吐量 (Kbits/sec)', data: {} as Record<string, number[]> },
        latency: { name: '时延 (ms)', data: {} as Record<string, number[]> },
        jitter: { name: '抖动 (ms)', data: {} as Record<string, number[]> },
        lossrate: { name: '丢包率 (%)', data: {} as Record<string, number[]> }
    };

    // 为每个链路准备数据
    Object.keys(linkGroups).forEach(link => {
        const linkData = linkGroups[link];
        
        // 初始化每个指标的数据数组
        Object.keys(metrics).forEach(metricKey => {
            metrics[metricKey as keyof typeof metrics].data[link] = [];
        });
        
        // 填充数据
        linkData.forEach((item: any) => {
            
            let throughput = 0,latency = 0, jitter = 0, lossrate = 0;
            
            // 首先尝试从API返回的直接字段中获取数据，并统一单位换算
            if (item.throughput && item.throughput !== null) {
                // 统一吞吐量单位换算为 Kbits/sec
                let throughputValue = 0;
                let throughputUnit = '';
                
                // 匹配数值和单位
                const throughputMatch = item.throughput.match(/(\d+(?:\.\d+)?)\s*([KMGT]?bits\/sec)/i);
                if (throughputMatch) {
                    throughputValue = parseFloat(throughputMatch[1]);
                    throughputUnit = throughputMatch[2].toLowerCase();
                    
                    // 单位换算：统一转换为 Kbits/sec
                    switch (throughputUnit) {
                        case 'gbits/sec':
                            throughput = throughputValue * 1000000; // 1 Gbit = 1,000,000 Kbit
                            break;
                        case 'mbits/sec':
                            throughput = throughputValue * 1000; // 1 Mbit = 1,000 Kbit
                            break;
                        case 'kbits/sec':
                            throughput = throughputValue;
                            break;
                        case 'bits/sec':
                            throughput = throughputValue / 1000; // 1 bit = 0.001 Kbit
                            break;
                        default:
                            throughput = throughputValue; // 默认按 Kbits/sec 处理
                    }
                }
            }
            
            // 修复latency处理，null值也要处理
            if (item.latency !== undefined && item.latency !== null) {
                // 处理 "0.50/8.75/31.20 ms" 格式，取平均值（第二个值）
                if (item.latency.includes('/')) {
                    const values = item.latency.match(/(\d+(?:\.\d+)?)/g);
                    if (values && values.length >= 3) {
                        // 格式：最小值/平均值/最大值，取平均值（第二个值）
                        latency = parseFloat(values[1]);
                    } else if (values && values.length > 0) {
                        // 如果只有两个值，取第一个
                        latency = parseFloat(values[0]);
                    }
                } else {
                    // 处理单个数值格式
                    const latencyMatch = item.latency.match(/(\d+(?:\.\d+)?)/);
                    if (latencyMatch) {
                        latency = parseFloat(latencyMatch[1]);
                    }
                }
            }
            
            if (item.jitter && item.jitter !== null) {
                const jitterMatch = item.jitter.match(/(\d+(?:\.\d+)?)/);
                if (jitterMatch) {
                    jitter = parseFloat(jitterMatch[1]);
                }
            }
            
            // 修复lossRate处理，支持多种格式
            if (item.lossRate && item.lossRate !== null) {
                // 处理 "0/11(0%)" 格式
                const lossrateMatch1 = item.lossRate.match(/(\d+)\/(\d+)\((\d+)%\)/);
                if (lossrateMatch1) {
                    const lost = parseInt(lossrateMatch1[1]);
                    const total = parseInt(lossrateMatch1[2]);
                    lossrate = total > 0 ? (lost / total) * 100 : 0;
                } else {
                    // 处理 "0.000" 格式
                    const lossrateMatch2 = item.lossRate.match(/(\d+(?:\.\d+)?)/);
                    if (lossrateMatch2) {
                        lossrate = parseFloat(lossrateMatch2[1]);
                    }
                }
            }
            
            
            metrics.throughput.data[link].push(throughput);
            metrics.latency.data[link].push(latency);
            metrics.jitter.data[link].push(jitter);
            metrics.lossrate.data[link].push(lossrate);
        });
    });

    return metrics;
};

// 处理被动测量数据
export const processPassiveMeasurementData = (data: any[], containerName: string): PassiveMetrics => {
    // 先按时间倒序排序获取最新数据，然后取前10条，最后按时间正序排列（修复顺序颠倒问题）
    const containerData = data.sort((a, b) => new Date(b.execTime).getTime() - new Date(a.execTime).getTime());
    const limitedData = containerData.slice(0, 10).sort((a, b) => new Date(a.execTime).getTime() - new Date(b.execTime).getTime());

    // 准备8个指标的数据
    const metrics: PassiveMetrics = {
        txPackages: { name: '发送包数 (个)', data: {} as Record<string, number[]> },
        rxPackages: { name: '接收包数 (个)', data: {} as Record<string, number[]> },
        txBytes: { name: '发送字节数 (Bytes)', data: {} as Record<string, number[]> },
        rxBytes: { name: '接收字节数 (Bytes)', data: {} as Record<string, number[]> },
        txErrors: { name: '发送错误包数 (个)', data: {} as Record<string, number[]> },
        rxErrors: { name: '接收错误包数 (个)', data: {} as Record<string, number[]> },
        txDropped: { name: '发送丢包数 (个)', data: {} as Record<string, number[]> },
        rxDropped: { name: '接收丢包数 (个)', data: {} as Record<string, number[]> }
    };

    // 填充数据 - 只处理eth网卡数据，不显示容器指标
    limitedData.forEach((item: any, index: number) => {
        if (item.iface && item.iface.length > 0) {
            // 过滤出以eth开头的网卡
            const ethInterfaces = item.iface.filter((iface: any) => iface.name.startsWith('eth'));
            
            if (ethInterfaces.length > 0) {
                // 为每个eth接口分别处理数据
                ethInterfaces.forEach((iface: any) => {
                    const interfaceName = `${containerName}-${iface.name}`;
                    
                    // 如果这个接口还没有初始化数据数组，则初始化
                    Object.keys(metrics).forEach(metricKey => {
                        if (!metrics[metricKey as keyof typeof metrics].data[interfaceName]) {
                            metrics[metricKey as keyof typeof metrics].data[interfaceName] = [];
                        }
                    });
                    
                    // 填充当前时间点的数据
                    Object.keys(metrics).forEach(metricKey => {
                        const value = parseInt(iface[metricKey as keyof typeof iface] || '0');
                        metrics[metricKey as keyof typeof metrics].data[interfaceName].push(value);
                    });
                });
                
                // 为其他时间点填充0（如果某些接口在某个时间点没有数据）
                Object.keys(metrics).forEach(metricKey => {
                    Object.keys(metrics[metricKey as keyof typeof metrics].data).forEach(interfaceName => {
                        if (metrics[metricKey as keyof typeof metrics].data[interfaceName].length < index + 1) {
                            metrics[metricKey as keyof typeof metrics].data[interfaceName].push(0);
                        }
                    });
                });
            }
        
        }
    });

    return metrics;
};

// 创建图表系列数据
export const createChartSeries = (metricData: Record<string, number[]>, colors: string[] = CHART_COLORS): any[] => {
    const series: any[] = [];
    
    Object.keys(metricData).forEach((name, index) => {
        // 只处理eth网卡的数据
        if (name.includes('-') && name.includes('eth')) {
            const color = colors[index % colors.length];
            
            // 添加折线图系列
            series.push({
                name: name,
                type: 'line',
                data: metricData[name],
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2, color: color },
                itemStyle: { color: color, borderWidth: 2 }
            });
            
            // 添加柱状图系列
            series.push({
                name: `${name}(柱状图)`,
                type: 'bar',
                data: metricData[name],
                yAxisIndex: 1,
                itemStyle: { color: color + '80' }
            } as any);
        }
    });
    
    return series;
};

// 创建主动测量图表系列数据
export const createActiveChartSeries = (metricData: Record<string, number[]>, colors: string[] = CHART_COLORS): any[] => {
    const series: any[] = [];
    
    Object.keys(metricData).forEach((name, index) => {
        const color = colors[index % colors.length];
        
        // 添加折线图系列
        series.push({
            name: name,
            type: 'line',
            data: metricData[name],
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2, color: color },
            itemStyle: { color: color, borderWidth: 2 }
        });
        
        // 添加柱状图系列
        series.push({
            name: `${name}(柱状图)`,
            type: 'bar',
            data: metricData[name],
            yAxisIndex: 1,
            itemStyle: { color: color + '80' }
        } as any);
    });
    
    return series;
};

// 初始化图表
export const initChart = (container: HTMLElement): echarts.ECharts => {
    const chart = echarts.init(container);
    
    // 响应式调整
    window.addEventListener('resize', () => chart.resize());
    
    return chart;
}; 