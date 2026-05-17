import { ref, computed } from 'vue';
import { useTopoStore } from '../../../store/modules/topo';
import { 
    sendActiveMeasurement, 
    sendPassiveMeasurement, 
    getActiveMeasurementResult, 
    getPassiveMeasurementResult 
} from '../../../api/protocol';
import { ElMessage } from 'element-plus';
import type { 
    ActiveResultItem, 
    PassiveResultItem, 
    RouteLink,
    LinkMeasurementForm,
    NodeMeasurementForm
} from '../types';

export const useMeasurementData = () => {
    const topoStore = useTopoStore();

    // 获取当前场景中的docker类型节点
    const dockerNodes = computed(() => {
        if (!topoStore.topoData?.nodes) return [];
        return topoStore.topoData.nodes.filter((node: any) => 
            node.type === 'DOCKER' 
        );
    });

    // routeLinks computed属性，避免重复生成链路
    const routeLinks = computed(() => {
        if (!topoStore.topoData?.links || !topoStore.topoData?.nodes) {
            return [];
        }
        const links: RouteLink[] = [];
        const processedLinks = new Set<string>(); // 用于去重
        
        topoStore.topoData.links.forEach((link: any) => {
            const node1 = topoStore.topoData!.nodes.find((n: any) => n.id === link.node1_id);
            const node2 = topoStore.topoData!.nodes.find((n: any) => n.id === link.node2_id);
            if (
                node1 && node2 &&
                node1.type === 'DOCKER' && node2.type === 'DOCKER' &&
                link.iface1 && link.iface2
            ) {
                // 生成唯一的链路标识符（不考虑方向）
                const linkKey1 = `${Math.min(link.node1_id, link.node2_id)}-${Math.max(link.node1_id, link.node2_id)}`;
                const linkKey2 = `${Math.max(link.node1_id, link.node2_id)}-${Math.min(link.node1_id, link.node2_id)}`;
                
                // 如果这个链路已经处理过，跳过
                if (processedLinks.has(linkKey1) || processedLinks.has(linkKey2)) {
                    return;
                }
                
                // 标记为已处理
                processedLinks.add(linkKey1);
                processedLinks.add(linkKey2);
                
                // 只生成一条链路记录（正向）
                links.push({
                    id: `${link.node1_id}-${link.node2_id}`,
                    linkId: link,
                    node1: {
                        id: node1.id,
                        alias: node1.alias,
                        name: node1.name,
                        type: node1.type,
                        ip: link.iface1.ip4 || '',
                        container: node1.name
                    },
                    node2: {
                        id: node2.id,
                        alias: node2.alias,
                        name: node2.name,
                        type: node2.type,
                        ip: link.iface2.ip4 || '',
                        container: node2.name
                    },
                    label: `${node1.alias || node1.name} → ${node2.alias || node2.name}`,
                    description: `${node1.alias || node1.name}(${link.iface1.ip4}) → ${node2.alias || node2.name}(${link.iface2.ip4})`
                });

                //反向
                links.push({
                    id: `${link.node2_id}-${link.node1_id}`,
                    linkId: link,
                    node1: {
                        id: node2.id,
                        alias: node2.alias,
                        name: node2.name,
                        type: node2.type,
                        ip: link.iface2.ip4 || '',
                        container: node2.name
                    },
                    node2: {
                        id: node1.id,
                        alias: node1.alias,
                        name: node1.name,
                        type: node1.type,
                        ip: link.iface1.ip4 || '',
                        container: node1.name
                    },
                    label: `${node2.alias || node2.name} → ${node1.alias || node1.name}`,
                    description: `${node2.alias || node2.name}(${link.iface2.ip4}) → ${node1.alias || node1.name}(${link.iface1.ip4})`
                });
            }
        });
        return links;
    });

    // 可用的容器列表 - 从当前场景中的所有容器节点获取
    const availableContainers = computed(() => {
        return dockerNodes.value.map((node: any) => node.name).sort();
    });

    // 可用的链路列表 - 从当前场景中的所有链路获取
    const availableLinks = computed(() => {
        return routeLinks.value.map((link: RouteLink) => link.label).sort();
    });

    return {
        dockerNodes,
        routeLinks,
        availableContainers,
        availableLinks
    };
};

export const useActiveMeasurement = () => {
    const activeResultData = ref<ActiveResultItem[]>([]);
    const activeResultTotal = ref(0);
    const activeResultQueryLoading = ref(false);

    // 过滤后的主动测量结果数据 - 根据选中的链路过滤
    const filteredActiveResultData = computed(() => {
        // 这里可以根据选中的链路进行过滤
        // 目前返回所有数据，过滤逻辑在图表处理时进行
        return activeResultData.value || [];
    });

    // 根据选中链路过滤数据
    const getFilteredActiveResultData = (selectedLink: string) => {
        if (!selectedLink) {
            return []; // 未选择链路时返回空数组
        }
        if (!activeResultData.value) {
            return [];
        }
        
        
        return activeResultData.value.filter(item => {
            // 检查是否匹配选中的链路
            const itemLinkLabel = item.linkLabel || item.direction || `${item.srcContainer} → ${item.dstContainer}`;
            
            // 如果itemLinkLabel包含会话ID，需要提取容器名称进行比较
            let normalizedItemLink = itemLinkLabel;
            if (itemLinkLabel.includes('-')) {
                // 提取容器名称，去掉会话ID部分
                const parts = itemLinkLabel.split(' → ');
                if (parts.length === 2) {
                    const srcContainer = parts[0].split('-')[0]; // 取第一个部分作为容器名
                    const dstContainer = parts[1].split('-')[0]; // 取第一个部分作为容器名
                    normalizedItemLink = `${srcContainer} → ${dstContainer}`;
                }
            }
            
            return normalizedItemLink === selectedLink;
        });
    };

    // 查询特定链路的主动测量结果
    const querySelectedLinkResults = async (selectedLink: string) => {
        try {
            activeResultQueryLoading.value = true;
            const topoStore = useTopoStore();
            
            // 从链路标签中解析源容器和目标容器
            const linkParts = selectedLink.split(' → ');
            if (linkParts.length !== 2) {
                console.error('链路格式错误:', selectedLink);
                ElMessage.error('链路格式错误');
                return;
            }
            
            const srcDisplayName = linkParts[0];
            const dstDisplayName = linkParts[1];

            // 标签中可能是 alias（中文），需要反查英文 name 发送给后端
            const nodes = topoStore.topoData?.nodes || [];
            const srcNode = nodes.find((n: any) => n.alias === srcDisplayName || n.name === srcDisplayName);
            const dstNode = nodes.find((n: any) => n.alias === dstDisplayName || n.name === dstDisplayName);
            const srcContainer = srcNode?.name || srcDisplayName;
            const dstContainer = dstNode?.name || dstDisplayName;
            
            const srcContainerWithSession = srcContainer + '-' + topoStore.currentSessionId;
            const dstContainerWithSession = dstContainer + '-' + topoStore.currentSessionId;

            const result = await getActiveMeasurementResult(
                1, 10, srcContainerWithSession, dstContainerWithSession, 
                Number(topoStore.currentSessionId), 'COMPLETED'
            );
            
            if (result && result.data && result.data.list) {
                // 直接使用返回的数据
                const linkResults = result.data.list.map((item: any) => ({
                    ...item,
                    linkLabel: selectedLink,
                    srcContainer: srcContainer,
                    dstContainer: dstContainer,
                    direction: selectedLink
                }));
                activeResultData.value = linkResults;
                activeResultTotal.value = linkResults.length;
            } else {
                // 如果没有数据，添加测试数据用于调试
                activeResultData.value = Array.from({length: 10}, (_, i) => ({
                    id: 100 + i,
                    sessionId: Number(topoStore.currentSessionId),
                    controlType: 1,
                    srcContainer: srcContainer,
                    dstContainer: dstContainer,
                    linkLabel: selectedLink,
                    direction: selectedLink,
                    status: 'COMPLETED',
                    beginTime: `2025-07-30 16:42:${22 + i}`,
                    endTime: `2025-07-30 16:43:${22 + i}`,
                    result: `带宽: ${100 + i * 10} Mbps, 延迟: ${5 + i} ms, 丢包率: ${0.1 + i * 0.01}%`
                }));
                activeResultTotal.value = activeResultData.value.length;
            }
        } catch (error) {
            console.error(`查询链路 ${selectedLink} 数据失败:`, error);
            ElMessage.error(`查询链路 ${selectedLink} 数据失败`);
        } finally {
            activeResultQueryLoading.value = false;
        }
    };

    // 查询主动测量结果
    const queryActiveResults = async () => {
        try {
            const topoStore = useTopoStore();
            // 获取当前场景中的所有链路（包括正向和反向）
            const allLinks = useMeasurementData().routeLinks.value;
            
            // 为每个链路查询最新的10条数据
            const allResults: any[] = [];
            
            for (const link of allLinks) {
                try {
                    const srcContainerWithSession = link.node1.container + '-' + topoStore.currentSessionId;
                    const dstContainerWithSession = link.node2.container + '-' + topoStore.currentSessionId;

                    const result = await getActiveMeasurementResult(
                        1, 10, srcContainerWithSession, dstContainerWithSession, 
                        Number(topoStore.currentSessionId), 'COMPLETED'
                    );
                    
                    if (result && result.data && result.data.list) {
                        // 直接使用返回的数据
                        const linkResults = result.data.list.map((item: any) => ({
                            ...item,
                            linkLabel: link.label,
                            srcContainer: link.node1.container,
                            dstContainer: link.node2.container,
                            direction: `${link.node1.container} → ${link.node2.container}`
                        }));
                        allResults.push(...linkResults);
                    }
                } catch (error) {
                    console.error(`查询链路 ${link.label} 数据失败:`, error);
                }
            }
            
            activeResultData.value = allResults;
            activeResultTotal.value = allResults.length;
            
            // 如果没有数据，添加测试数据用于调试
            if (activeResultData.value.length === 0) {
                activeResultData.value = [
                    // ROUTER1 -> ROUTER2 的10条数据
                    ...Array.from({length: 10}, (_, i) => ({
                        id: 100 + i,
                        sessionId: Number(topoStore.currentSessionId),
                        controlType: 1,
                        srcContainer: "ROUTER1",
                        dstContainer: "ROUTER2",
                        linkLabel: "ROUTER1 → ROUTER2",
                        direction: "ROUTER1 → ROUTER2",
                        status: 'COMPLETED',
                        beginTime: `2025-07-30 16:42:${22 + i}`,
                        endTime: `2025-07-30 16:43:${22 + i}`,
                        result: `带宽: ${100 + i * 10} Mbps, 延迟: ${5 + i} ms, 丢包率: ${0.1 + i * 0.01}%`
                    })),
                    // ROUTER2 -> ROUTER1 的10条数据
                    ...Array.from({length: 10}, (_, i) => ({
                        id: 200 + i,
                        sessionId: Number(topoStore.currentSessionId),
                        controlType: 2,
                        srcContainer: "ROUTER2",
                        dstContainer: "ROUTER1",
                        linkLabel: "ROUTER2 → ROUTER1",
                        direction: "ROUTER2 → ROUTER1",
                        status: 'COMPLETED',
                        beginTime: `2025-07-30 16:42:${12 + i}`,
                        endTime: `2025-07-30 16:43:${12 + i}`,
                        result: `带宽: ${90 + i * 8} Mbps, 延迟: ${6 + i} ms, 丢包率: ${0.2 + i * 0.01}%`
                    }))
                ];
            }
        } catch (error) {
            console.error('查询主动测量结果失败:', error);
            ElMessage.error('查询主动测量结果失败');
        }
    };

    // 开始链路测量
    const startLinkMeasurement = async (form: LinkMeasurementForm) => {
        try {
            if (form.links.length === 0) {
                ElMessage.warning('请添加一条链路配置');
                return false;
            }
            
            const link = form.links[0];
            const measurementData = {
                controlType: form.controlType,
                sessionId: parseInt(form.sessionId),
                srcContainer: link.srcContainer+'-'+form.sessionId,
                dstContainer: link.dstContainer+'-'+form.sessionId,
                srcIp: link.srcIp,
                dstIp: link.dstIp,
                testTime: form.testTime,
                bandwidthLimit: form.bandwidthLimit
            };
            
            const result = await sendActiveMeasurement(measurementData);
            if (result) {
                ElMessage.success('链路测量请求发送成功');
                return true;
            } else {
                ElMessage.error('链路测量请求发送失败');
                return false;
            }
            
        } catch (error) {
            console.error('链路测量失败:', error);
            ElMessage.error('链路测量失败，请检查网络连接');
            return false;
        }
    };

    return {
        activeResultData,
        activeResultTotal,
        activeResultQueryLoading,
        filteredActiveResultData,
        getFilteredActiveResultData,
        queryActiveResults,
        querySelectedLinkResults,
        startLinkMeasurement
    };
};

export const usePassiveMeasurement = () => {
    const passiveResultData = ref<PassiveResultItem[]>([]);
    const passiveResultTotal = ref(0);
    const passiveResultQueryLoading = ref(false);
    const isMonitoring = ref(false);

    // 过滤后的被动测量结果数据 - 现在直接返回当前容器的数据
    const filteredPassiveResultData = computed(() => {
        return passiveResultData.value || [];
    });

    // 查询被动测量结果
    const queryPassiveResults = async (selectedContainer: string) => {
        try {
            const topoStore = useTopoStore();
            
            // 如果仍然没有选择容器，提示用户
            if (!selectedContainer) {
                ElMessage.warning('请先选择一个容器');
                return;
            }
            
            
            // 查询选中容器的数据
            const containerWithSession = selectedContainer + '-' + topoStore.currentSessionId;
            
            const result = await getPassiveMeasurementResult(
                1, 10, containerWithSession, Number(topoStore.currentSessionId), 'COMPLETED'
            );
            
            if (result && result.data && result.data.list) {
                // 使用返回的数据，确保容器名称正确
                const containerResults = result.data.list.map((item: any) => ({
                    ...item,
                    container: selectedContainer // 确保容器名称正确
                }));
                passiveResultData.value = containerResults;
                passiveResultTotal.value = containerResults.length;
            } else {
                // 如果没有数据，清空结果
                passiveResultData.value = [];
                passiveResultTotal.value = 0;
            }
        } catch (error) {
            console.error('查询被动测量结果失败:', error);
            ElMessage.error('查询被动测量结果失败');
        }
    };

    // 开始节点测量
    const startNodeMeasurement = async (form: NodeMeasurementForm) => {
        try {
            if (!form.container) {
                ElMessage.warning('请选择一个容器');
                return false;
            }
            const measurementData = {
                controlType: isMonitoring.value ? 2 : 1, // 1: 开始监控, 2: 停止监控
                sessionId: parseInt(form.sessionId),
                container: form.container+'-'+form.sessionId,
                reportInterval: form.reportInterval
            };
            const result = await sendPassiveMeasurement(measurementData);
            if (result) {
                ElMessage.success(isMonitoring.value ? '已停止监控' : '已开始监控');
                isMonitoring.value = !isMonitoring.value;
                return true;
            } else {
                ElMessage.error(isMonitoring.value ? '停止监控失败' : '开始监控失败');
                return false;
            }
        } catch (error) {
            console.error('节点测量失败:', error);
            ElMessage.error('节点测量失败，请检查网络连接');
            return false;
        }
    };

    return {
        passiveResultData,
        passiveResultTotal,
        passiveResultQueryLoading,
        filteredPassiveResultData,
        isMonitoring,
        queryPassiveResults,
        startNodeMeasurement
    };
}; 