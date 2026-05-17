import { defineStore } from 'pinia'
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage'

// NEM ID信息接口定义
interface IfaceNemMap {
  [ifaceId: string]: number;
}

interface NemIdInfo {
  nodeId: number;
  ifaceNemMap: IfaceNemMap;
}

interface NemIdState {
  sessionId: number | null;
  nemIds: NemIdInfo[];
  loading: boolean;
  error: string | null;
}

export const useNemIdStore = defineStore('nemId', {
  state: (): NemIdState => ({
    sessionId: null,
    nemIds: [],
    loading: false,
    error: null
  }),

  getters: {
    // 获取特定节点的NEM ID信息
    getNemIdsByNodeId: (state) => (nodeId: number): NemIdInfo | undefined => {
      return state.nemIds.find(item => item.nodeId === nodeId);
    },

    // 获取特定节点特定接口的NEM ID
    getNemIdByNodeAndIface: (state) => (nodeId: number, ifaceId: string | number): number | undefined => {
      const nodeInfo = state.nemIds.find(item => item.nodeId === nodeId);
      if (nodeInfo) {
        return nodeInfo.ifaceNemMap[ifaceId.toString()];
      }
      return undefined;
    },

    // 是否有NEM ID数据
    hasNemIds: (state): boolean => state.nemIds.length > 0
  },

  actions: {
    // 设置NEM ID数据
    setNemIds(sessionId: number, nemIds: NemIdInfo[]) {
      this.sessionId = sessionId;
      this.nemIds = nemIds;
      this.error = null;
    },

    // 重置状态
    resetNemIds() {
      this.sessionId = null;
      this.nemIds = [];
      this.error = null;
    },

    // 设置加载状态
    setLoading(loading: boolean) {
      this.loading = loading;
    },

    // 设置错误信息
    setError(error: string) {
      this.error = error;
    }
  },

  // 持久化配置，使用会话隔离
  persist: {
    key: 'nemId-store',
    storage: createUserIsolatedStorage()
  }
}) 