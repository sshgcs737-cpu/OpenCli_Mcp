import { defineStore } from 'pinia'
import { useNemIdStore } from './nemId'
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage'
import type {
  NeighborMetricTable,
  NeighborStatusTable,
  RFSignalTable,
  EmaneMacInfo,
  EmaneDataByNem,
  NodeLinkNemMap
} from '../../types/emane'

// 定义Store状态接口
interface EmaneState {
  // 新增：按视角节点ID组织的数据结构
  viewpointData: {
    [viewpointNemId: number]: {
      neighborMetricTables: NeighborMetricTable[];
      neighborStatusTables: NeighborStatusTable[];
      rfSignalTables: RFSignalTable[];
      lastUpdated: Date | null;
    }
  };
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null; // 这个lastUpdated是全局的最后更新时间
  // 存储节点视角下的NEM ID映射关系
  nodePerspectiveMap: NodeLinkNemMap;
}

// 使用 OPTIONS API 方式定义store
export const useEmaneStore = defineStore('emane', {
  state: (): EmaneState => ({
    // 新增：按视角节点ID组织的数据
    viewpointData: {},
    loading: false,
    error: null,
    lastUpdated: null,
    nodePerspectiveMap: {}
  }),

  getters: {
    // 基础信息
    hasEmaneData: (state: EmaneState) => Object.keys(state.viewpointData).length > 0,
    
    // 获取按NEM ID组织的数据
    dataByNem: (state: EmaneState): EmaneDataByNem => {
      const dataMap: EmaneDataByNem = {};
      
      // 将指标数据按NEM ID归类
      if (state.viewpointData[1]?.neighborMetricTables) {
        state.viewpointData[1].neighborMetricTables.forEach((metric: NeighborMetricTable) => {
          if (!dataMap[metric.nem]) {
            dataMap[metric.nem] = {};
          }
          dataMap[metric.nem].metrics = metric;
        });
      }
      
      // 将状态数据按NEM ID归类
      if (state.viewpointData[1]?.neighborStatusTables) {
        state.viewpointData[1].neighborStatusTables.forEach((status: NeighborStatusTable) => {
          if (!dataMap[status.nem]) {
            dataMap[status.nem] = {};
          }
          dataMap[status.nem].status = status;
        });
      }
      
      // 将RF信号数据按NEM ID归类
      if (state.viewpointData[1]?.rfSignalTables) {
        state.viewpointData[1].rfSignalTables.forEach((rfSignal: RFSignalTable) => {
          if (!dataMap[rfSignal.nem]) {
            dataMap[rfSignal.nem] = {};
          }
          dataMap[rfSignal.nem].rfSignal = rfSignal;
        });
      }
      
      return dataMap;
    },
    
    // 获取所有NEM IDs
    allNemIds: (state: EmaneState): number[] => {
      const nemIds = new Set<number>();
      
      // 从viewpointData中收集所有NEM ID
      Object.values(state.viewpointData).forEach((viewData) => {
        viewData.neighborMetricTables?.forEach((item: NeighborMetricTable) => {
          if (item.nem !== 65535) nemIds.add(item.nem);
        });
        viewData.neighborStatusTables?.forEach((item: NeighborStatusTable) => {
          if (item.nem !== 65535) nemIds.add(item.nem);
        });
        viewData.rfSignalTables?.forEach((item: RFSignalTable) => {
          if (item.nem !== 65535) nemIds.add(item.nem);
        });
      });
      
      return Array.from(nemIds).sort((a, b) => a - b);
    },
    
    // 获取节点和链路的NEM ID映射
    nodeLinkNemMap: (state: EmaneState): NodeLinkNemMap => {
      return state.nodePerspectiveMap;
    },
    
    // 按NEM ID获取指标数据，优化为考虑视角
    getMetricByNem: (state: EmaneState) => (nemId: number, viewpointNemId?: number): NeighborMetricTable | undefined => {
      // 如果指定了视角NEM ID，优先从特定视角获取数据
      if (viewpointNemId !== undefined && state.viewpointData[viewpointNemId]) {
        const metric = state.viewpointData[viewpointNemId].neighborMetricTables.find(
          (metric: NeighborMetricTable) => metric.nem === nemId
        );
        if (metric) return metric;
      }
      
      // 如果指定视角没有数据，尝试从其他视角获取数据并复制（用于信号级仿真数据共享）
      if (viewpointNemId !== undefined) {
        for (const [otherViewpointId, viewpoint] of Object.entries(state.viewpointData)) {
          if (parseInt(otherViewpointId) !== viewpointNemId) {
            const metric = viewpoint.neighborMetricTables.find(
              (m: NeighborMetricTable) => m.nem === viewpointNemId || m.nem === nemId
            );
            if (metric) {
              // 创建一个副本，调整NEM ID为请求的目标
              return {
                ...metric,
                nem: nemId
              };
            }
          }
        }
      }
      
      // 如果没有指定视角NEM ID或者指定的视角没有数据，尝试从所有视角中查找
      for (const viewpoint of Object.values(state.viewpointData)) {
        const metric = viewpoint.neighborMetricTables.find(
          (m: NeighborMetricTable) => m.nem === nemId
        );
        if (metric) return metric;
      }
      
      return undefined;
    },
    
    // 按NEM ID获取状态数据，优化为考虑视角
    getStatusByNem: (state: EmaneState) => (nemId: number, viewpointNemId?: number): NeighborStatusTable | undefined => {
      // 如果指定了视角NEM ID，优先从特定视角获取数据
      if (viewpointNemId !== undefined && state.viewpointData[viewpointNemId]) {
        const status = state.viewpointData[viewpointNemId].neighborStatusTables.find(
          (status: NeighborStatusTable) => status.nem === nemId
        );
        if (status) return status;
      }
      
      // 如果指定视角没有数据，尝试从其他视角获取数据并复制（用于信号级仿真数据共享）
      if (viewpointNemId !== undefined) {
        for (const [otherViewpointId, viewpoint] of Object.entries(state.viewpointData)) {
          if (parseInt(otherViewpointId) !== viewpointNemId) {
            const status = viewpoint.neighborStatusTables.find(
              (s: NeighborStatusTable) => s.nem === viewpointNemId || s.nem === nemId
            );
            if (status) {
              // 创建一个副本，调整NEM ID为请求的目标
              return {
                ...status,
                nem: nemId
              };
            }
          }
        }
      }
      
      // 如果没有指定视角NEM ID或者指定的视角没有数据，尝试从所有视角中查找
      for (const viewpoint of Object.values(state.viewpointData)) {
        const status = viewpoint.neighborStatusTables.find(
          (s: NeighborStatusTable) => s.nem === nemId
        );
        if (status) return status;
      }
      
      return undefined;
    },
    
    // 按NEM ID获取RF信号数据，优化为考虑视角
    getRFSignalByNem: (state: EmaneState) => (nemId: number, viewpointNemId?: number): RFSignalTable | undefined => {
      // 如果指定了视角NEM ID，优先从特定视角获取数据
      if (viewpointNemId !== undefined && state.viewpointData[viewpointNemId]) {
        const signal = state.viewpointData[viewpointNemId].rfSignalTables.find(
          (signal: RFSignalTable) => signal.nem === nemId
        );
        if (signal) return signal;
      }
      
      // 如果指定视角没有数据，尝试从其他视角获取数据并复制（用于信号级仿真数据共享）
      if (viewpointNemId !== undefined) {
        for (const [otherViewpointId, viewpoint] of Object.entries(state.viewpointData)) {
          if (parseInt(otherViewpointId) !== viewpointNemId) {
            const signal = viewpoint.rfSignalTables.find(
              (s: RFSignalTable) => s.nem === viewpointNemId || s.nem === nemId
            );
            if (signal) {
              // 创建一个副本，调整NEM ID为请求的目标
              return {
                ...signal,
                nem: nemId
              };
            }
          }
        }
      }
      
      // 如果没有指定视角NEM ID或者指定的视角没有数据，尝试从所有视角中查找
      for (const viewpoint of Object.values(state.viewpointData)) {
        const signal = viewpoint.rfSignalTables.find(
          (s: RFSignalTable) => s.nem === nemId
        );
        if (signal) return signal;
      }
      
      return undefined;
    },
    
    // 获取视角节点的数据
    getViewpointData: (state: EmaneState) => (viewpointNemId: number) => {
      return state.viewpointData[viewpointNemId] || null;
    },
    
    // 获取所有可用的视角NEM ID
    allViewpointNemIds: (state: EmaneState): number[] => {
      return Object.keys(state.viewpointData).map(Number);
    },
    
    // 根据链路的两个节点ID获取相应的NEM ID（考虑视角）
    getNemIdForLink: (state: EmaneState) => (node1Id: number, node2Id: number, perspective: 'source' | 'target'): number | null => {
      const nemIdStore = useNemIdStore();
      
      // 确定源和目标节点
      const sourceNodeId = perspective === 'source' ? node1Id : node2Id;
      const targetNodeId = perspective === 'source' ? node2Id : node1Id;
      
      // 从节点视角映射中获取目标节点的NEM ID
      const perspectiveMap = state.nodePerspectiveMap[sourceNodeId];
      if (perspectiveMap && perspectiveMap.targetNemIds[targetNodeId] !== undefined) {
        return perspectiveMap.targetNemIds[targetNodeId];
      }
      
      // 如果映射不存在，则使用nemIdStore查找
      const targetNodeInfo = nemIdStore.getNemIdsByNodeId(targetNodeId);
      if (targetNodeInfo && targetNodeInfo.ifaceNemMap) {
        // 返回第一个有效的NEM ID
        const firstIfaceId = Object.keys(targetNodeInfo.ifaceNemMap)[0];
        if (firstIfaceId) {
          return targetNodeInfo.ifaceNemMap[firstIfaceId];
        }
      }
      
      return null;
    },
    
    // 获取链路视角NEM ID
    getLinkViewpointNemId: (state: EmaneState) => (node1Id: number, node2Id: number, perspective: 'source' | 'target'): number | null => {
      const nemIdStore = useNemIdStore();
      
      // 确定视角节点ID
      const viewpointNodeId = perspective === 'source' ? node1Id : node2Id;
      
      // 获取视角节点的NEM ID
      const nodeInfo = nemIdStore.getNemIdsByNodeId(viewpointNodeId);
      if (!nodeInfo || !nodeInfo.ifaceNemMap) return null;
      
      // 返回第一个有效的NEM ID
      const firstIfaceId = Object.keys(nodeInfo.ifaceNemMap)[0];
      if (firstIfaceId) {
        return nodeInfo.ifaceNemMap[firstIfaceId];
      }
      
      return null;
    }
  },

  actions: {
    // 更新指定视角节点的EMANE数据
    updateViewpointData(viewpointNemId: number, data: EmaneMacInfo) {
      // 确保该视角节点的数据结构已初始化
      if (!this.viewpointData[viewpointNemId]) {
        this.viewpointData[viewpointNemId] = {
          neighborMetricTables: [],
          neighborStatusTables: [],
          rfSignalTables: [],
          lastUpdated: null
        };
      }
      
      const viewData = this.viewpointData[viewpointNemId];
      
      // 更新邻居指标表
      viewData.neighborMetricTables = data.neighborMetricTables ? JSON.parse(JSON.stringify(data.neighborMetricTables)) : [];
      
      // 更新邻居状态表
      viewData.neighborStatusTables = data.neighborStatusTables ? JSON.parse(JSON.stringify(data.neighborStatusTables)) : [];
      
      // 更新RF信号表
      viewData.rfSignalTables = data.rfSignalTables ? JSON.parse(JSON.stringify(data.rfSignalTables)) : [];
      
      // 更新时间戳
      viewData.lastUpdated = new Date();
      this.lastUpdated = new Date();
      
      // 更新节点视角映射关系
      this.updateNodePerspectiveMap();
    },
    
    // 设置完整的EMANE MAC信息（兼容旧的API）
    setEmaneMacInfo(data: EmaneMacInfo) {
      // 检查是否已经有数据，如果有则合并新旧数据
      if (this.viewpointData[1]) {
        // 创建一个合并后的数据对象
        const mergedInfo: EmaneMacInfo = {
          neighborMetricTables: [...(this.viewpointData[1].neighborMetricTables || [])],
          neighborStatusTables: [...(this.viewpointData[1].neighborStatusTables || [])],
          rfSignalTables: [...(this.viewpointData[1].rfSignalTables || [])]
        };

        // 合并指标数据
        if (data.neighborMetricTables && data.neighborMetricTables.length > 0) {
          data.neighborMetricTables.forEach((newTable: NeighborMetricTable) => {
            const existingIndex = mergedInfo.neighborMetricTables.findIndex(
              (existing: NeighborMetricTable) => existing.nem === newTable.nem
            );
            if (existingIndex !== -1) {
              // 更新现有数据
              mergedInfo.neighborMetricTables[existingIndex] = newTable;
            } else {
              // 添加新数据
              mergedInfo.neighborMetricTables.push(newTable);
            }
          });
        }

        // 合并状态数据
        if (data.neighborStatusTables && data.neighborStatusTables.length > 0) {
          data.neighborStatusTables.forEach((newTable: NeighborStatusTable) => {
            const existingIndex = mergedInfo.neighborStatusTables.findIndex(
              (existing: NeighborStatusTable) => existing.nem === newTable.nem
            );
            if (existingIndex !== -1) {
              // 更新现有数据
              mergedInfo.neighborStatusTables[existingIndex] = newTable;
            } else {
              // 添加新数据
              mergedInfo.neighborStatusTables.push(newTable);
            }
          });
        }

        // 合并RF信号数据
        if (data.rfSignalTables && data.rfSignalTables.length > 0) {
          data.rfSignalTables.forEach((newTable: RFSignalTable) => {
            const existingIndex = mergedInfo.rfSignalTables.findIndex(
              (existing: RFSignalTable) => existing.nem === newTable.nem && existing.antennaId === newTable.antennaId
            );
            if (existingIndex !== -1) {
              // 更新现有数据
              mergedInfo.rfSignalTables[existingIndex] = newTable;
            } else {
              // 添加新数据
              mergedInfo.rfSignalTables.push(newTable);
            }
          });
        }

        // 更新为合并后的数据
        this.viewpointData[1] = {
          neighborMetricTables: mergedInfo.neighborMetricTables,
          neighborStatusTables: mergedInfo.neighborStatusTables,
          rfSignalTables: mergedInfo.rfSignalTables,
          lastUpdated: new Date()
        };
      } else {
        // 如果没有现有数据，直接设置
        this.viewpointData[1] = {
          neighborMetricTables: data.neighborMetricTables || [],
          neighborStatusTables: data.neighborStatusTables || [],
          rfSignalTables: data.rfSignalTables || [],
          lastUpdated: new Date()
        };
      }

      this.lastUpdated = new Date();
      this.error = null;
      
      // 更新节点视角的NEM ID映射
      this.updateNodePerspectiveMap();
    },
    
    // 更新单个指标表数据
    updateNeighborMetricTable(metricTable: NeighborMetricTable) {
      if (!this.viewpointData[1]) {
        this.viewpointData[1] = {
          neighborMetricTables: [],
          neighborStatusTables: [],
          rfSignalTables: [],
          lastUpdated: null
        };
      }
      
      // 查找并更新现有数据，如果不存在则添加
      const index = this.viewpointData[1].neighborMetricTables.findIndex(
        (metric: NeighborMetricTable) => metric.nem === metricTable.nem
      );
      
      if (index !== -1) {
        this.viewpointData[1].neighborMetricTables[index] = metricTable;
      } else {
        this.viewpointData[1].neighborMetricTables.push(metricTable);
      }
      
      this.lastUpdated = new Date();
    },
    
    // 更新单个状态表数据
    updateNeighborStatusTable(statusTable: NeighborStatusTable) {
      if (!this.viewpointData[1]) {
        this.viewpointData[1] = {
          neighborMetricTables: [],
          neighborStatusTables: [],
          rfSignalTables: [],
          lastUpdated: null
        };
      }
      
      // 查找并更新现有数据，如果不存在则添加
      const index = this.viewpointData[1].neighborStatusTables.findIndex(
        (status: NeighborStatusTable) => status.nem === statusTable.nem
      );
      
      if (index !== -1) {
        this.viewpointData[1].neighborStatusTables[index] = statusTable;
      } else {
        this.viewpointData[1].neighborStatusTables.push(statusTable);
      }
      
      this.lastUpdated = new Date();
    },
    
    // 更新单个RF信号表数据
    updateRFSignalTable(rfSignalTable: RFSignalTable) {
      if (!this.viewpointData[1]) {
        this.viewpointData[1] = {
          neighborMetricTables: [],
          neighborStatusTables: [],
          rfSignalTables: [],
          lastUpdated: null
        };
      }
      
      // 查找并更新现有数据，如果不存在则添加
      const index = this.viewpointData[1].rfSignalTables.findIndex(
        (signal: RFSignalTable) => signal.nem === rfSignalTable.nem && signal.antennaId === rfSignalTable.antennaId
      );
      
      if (index !== -1) {
        this.viewpointData[1].rfSignalTables[index] = rfSignalTable;
      } else {
        this.viewpointData[1].rfSignalTables.push(rfSignalTable);
      }
      
      this.lastUpdated = new Date();
    },
    
    // 更新加载状态
    setLoading(loading: boolean) {
      this.loading = loading;
    },
    
    // 设置错误信息
    setError(error: string | null) {
      this.error = error;
    },
    
    // 清除数据
    clearEmaneData() {
      this.viewpointData = {}; // 清除视角数据
      this.lastUpdated = null;
      this.error = null;
      this.nodePerspectiveMap = {};
    },
    
    // 更新节点视角的NEM ID映射关系
    updateNodePerspectiveMap() {
      const nemIdStore = useNemIdStore();
      const newNodePerspectiveMap: NodeLinkNemMap = {};
      const allNodeNemInfo = nemIdStore.nemIds; // Array of { nodeId, ifaceNemMap }

      if (!allNodeNemInfo || allNodeNemInfo.length === 0) {
        this.nodePerspectiveMap = newNodePerspectiveMap;
        return;
      }

      // Create a map from nodeId to its primary NEM ID
      const nodeToPrimaryNemIdMap = new Map<number, number>();
      allNodeNemInfo.forEach(info => {
        const firstIfaceKey = Object.keys(info.ifaceNemMap)[0];
        if (firstIfaceKey) {
          nodeToPrimaryNemIdMap.set(info.nodeId, info.ifaceNemMap[firstIfaceKey]);
        }
      });

      // Create a map from NEM ID back to nodeId (assuming NEM IDs are unique across nodes for this context)
      const nemToNodeIdMap = new Map<number, number>();
      allNodeNemInfo.forEach(info => {
        Object.values(info.ifaceNemMap).forEach(nem => {
          nemToNodeIdMap.set(nem, info.nodeId);
        });
      });
      
      allNodeNemInfo.forEach(sourceNodeInfo => {
        const sourceNodeId = sourceNodeInfo.nodeId;
        const sourceViewpointNemId = nodeToPrimaryNemIdMap.get(sourceNodeId);

        if (sourceViewpointNemId === undefined) return; // Skip if source node has no primary NEM ID

        newNodePerspectiveMap[sourceNodeId] = {
          ownNemId: sourceViewpointNemId,
          targetNemIds: {}
        };

        const viewData = this.viewpointData[sourceViewpointNemId];
        if (viewData) {
          const processTables = (tables: {nem: number}[]) => {
            tables.forEach(tableEntry => {
              const neighborNemId = tableEntry.nem;
              if (neighborNemId !== 65535 && neighborNemId !== sourceViewpointNemId) {
                const targetNodeId = nemToNodeIdMap.get(neighborNemId);
                if (targetNodeId !== undefined && targetNodeId !== sourceNodeId) {
                  newNodePerspectiveMap[sourceNodeId].targetNemIds[targetNodeId] = neighborNemId;
                }
              }
            });
          };
          if(viewData.neighborMetricTables) processTables(viewData.neighborMetricTables);
          if(viewData.neighborStatusTables) processTables(viewData.neighborStatusTables);
          if(viewData.rfSignalTables) processTables(viewData.rfSignalTables);
        }
      });
      this.nodePerspectiveMap = newNodePerspectiveMap;
    },
    
    // 从WebSocket消息更新数据
    updateFromWebSocket(wsData: any) {
      try {
        this.setLoading(true);
        this.setError(null); // Clear previous errors
        if (wsData.emaneInfo && wsData.emaneInfo.nemId !== undefined) {
          const viewpointNemId = parseInt(wsData.emaneInfo.nemId, 10);
          if (isNaN(viewpointNemId)) {
            console.warn('EMANE Store: Invalid viewpoint NEM ID received:', wsData.emaneInfo.nemId);
            this.setError('Invalid viewpoint NEM ID');
            this.setLoading(false);
            return;
          }
          
          const emaneInfo: EmaneMacInfo = {
            neighborMetricTables: wsData.emaneInfo.neighborMetricTables || [],
            neighborStatusTables: wsData.emaneInfo.neighborStatusTables || [],
            rfSignalTables: wsData.emaneInfo.rfSignalTables || []
          };
          
          this.updateViewpointData(viewpointNemId, emaneInfo);
        } else {
          console.warn('EMANE Store: Unexpected WebSocket message format:', wsData);
          this.setError('Unexpected EMANE data format');
        }
      } catch (error: any) {
        console.error('EMANE Store: Error processing WebSocket EMANE data:', error);
        this.setError(error?.message || 'Failed to update EMANE data');
      } finally {
        this.setLoading(false);
      }
    },
    
    // 根据链路的两个节点ID查找可能的NEM ID
    findNemIdByNodes(node1Id: number, node2Id: number): number | null {
      if (this.nodePerspectiveMap[node1Id]?.targetNemIds[node2Id] !== undefined) {
        return this.nodePerspectiveMap[node1Id].targetNemIds[node2Id];
      }
      if (this.nodePerspectiveMap[node2Id]?.targetNemIds[node1Id] !== undefined) {
        return this.nodePerspectiveMap[node2Id].targetNemIds[node1Id];
      }
      
      const nemIdStore = useNemIdStore();
      const node2Info = nemIdStore.getNemIdsByNodeId(node2Id);
      if (node2Info && node2Info.ifaceNemMap && Object.keys(node2Info.ifaceNemMap).length > 0) {
        return node2Info.ifaceNemMap[Object.keys(node2Info.ifaceNemMap)[0]];
      }
      
      const node1Info = nemIdStore.getNemIdsByNodeId(node1Id);
      if (node1Info && node1Info.ifaceNemMap && Object.keys(node1Info.ifaceNemMap).length > 0) {
        return node1Info.ifaceNemMap[Object.keys(node1Info.ifaceNemMap)[0]];
      }
      return null;
    }
  },

  persist: {
    key: 'emane-store',
    storage: createUserIsolatedStorage()
  }
}) 