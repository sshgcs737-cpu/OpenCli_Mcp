// 链路配置接口
export interface LinkConfig {
    id: number;
    srcContainer: string;
    dstContainer: string;
    srcIp: string;
    dstIp: string;
}

// 查询结果数据类型定义
export interface ActiveResultItem {
    id: number;
    sessionId: number;
    controlType: number;
    srcContainer: string;
    dstContainer: string;
    linkLabel?: string;
    direction?: string;
    status: string;
    beginTime: string;
    endTime: string;
    result: string;
}

export interface PassiveResultItem {
    id: number;
    sessionId: number;
    taskId: string;
    status: number;
    controlType: number;
    reportInterval: number;
    container: string;
    cpu: string;
    mem: string;
    iface: Array<{
        id: number;
        pmrId: number;
        name: string;
        txPackages: string;
        txBytes: string;
        txErrors: string;
        txDropped: string;
        rxPackages: string;
        rxBytes: string;
        rxErrors: string;
        rxDropped: string;
    }>;
    msg: string | null;
    execTime: string;
}

// 链路测量表单
export interface LinkMeasurementForm {
    controlType: number;
    sessionId: string;
    links: LinkConfig[];
    testTime: number;
    bandwidthLimit: string;
}

// 节点测量表单
export interface NodeMeasurementForm {
    controlType: number;
    sessionId: string;
    container: string;
    reportInterval: number;
}

// 主动测量结果查询表单
export interface ActiveResultQueryForm {
    pageNo: number;
    pageSize: number;
    sessionId: number;
    status: string;
}

// 被动测量结果查询表单
export interface PassiveResultQueryForm {
    pageNo: number;
    pageSize: number;
    sessionId: number;
    status: string;
}

// 被动测量图表表单
export interface PassiveChartForm {
    selectedContainer: string;
}

// 主动测量图表表单
export interface ActiveChartForm {
    selectedLink: string;
}

// 路由链路接口
export interface RouteLink {
    id: string;
    linkId: any;
    node1: {
        id: string;
        alias?: string;
        name: string;
        type: string;
        ip: string;
        container: string;
    };
    node2: {
        id: string;
        alias?: string;
        name: string;
        type: string;
        ip: string;
        container: string;
    };
    label: string;
    description: string;
}

// 图表指标数据
export interface MetricData {
    name: string;
    data: Record<string, number[]>;
}

// 图表指标集合
export interface Metrics {
    throughput: MetricData;
    latency: MetricData;
    jitter: MetricData;
    lossrate: MetricData;
}

// 被动测量指标集合
export interface PassiveMetrics {
    txPackages: MetricData;
    rxPackages: MetricData;
    txBytes: MetricData;
    rxBytes: MetricData;
    txErrors: MetricData;
    rxErrors: MetricData;
    txDropped: MetricData;
    rxDropped: MetricData;
} 