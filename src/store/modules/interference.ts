import { defineStore } from 'pinia';
import { getInodeConfig, type InterferenceNodeData } from '../../api/inode/index';
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage';

export const useInterferenceStore = defineStore('interference', {
  state: () => ({
    interferenceConfigs: [] as InterferenceNodeData[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    // 获取所有干扰节点配置
    allConfigs: (state) => state.interferenceConfigs,
    
    // 根据节点ID获取干扰配置
    getConfigByNodeId: (state) => (nodeId: number) => {
      return state.interferenceConfigs.find(config => config.nodeId === nodeId);
    },
    
    // 根据干扰ID获取干扰配置
    getConfigById: (state) => (id: number) => {
      return state.interferenceConfigs.find(config => config.id === id);
    }
  },

  actions: {
    // 设置干扰配置列表
    setInterferenceConfigs(configs: InterferenceNodeData[]) {
      this.interferenceConfigs = configs;
    },

    // 清空干扰配置列表
    clearInterferenceConfigs() {
      this.interferenceConfigs = [];
    },

    // 获取干扰节点配置列表
    async fetchInterferenceConfigs(sessionId: number) {
      this.loading = true;
      this.error = null;
      
      try {
        // 响应拦截器已经处理了API响应，这里直接获取数据
        const result = await getInodeConfig(sessionId);
        
        // 如果返回的data为null，说明当前场景没有干扰节点，清空干扰配置列表
        if (result.data === null) {
          this.clearInterferenceConfigs();
        }
        // 确保返回的是数组类型
        else if (Array.isArray(result.data)) {
          this.interferenceConfigs = result.data;
        } else {
          this.error = '获取干扰节点配置失败';
        }
      } catch (error: any) {
        console.error('获取干扰节点配置失败:', error);
        this.error = error.message || '获取干扰节点配置失败';
      } finally {
        this.loading = false;
      }
    },

    // 更新单个干扰配置
    updateInterferenceConfig(config: InterferenceNodeData) {
      const index = this.interferenceConfigs.findIndex(item => item.id === config.id);
      if (index !== -1) {
        this.interferenceConfigs[index] = config;
      } else {
        this.interferenceConfigs.push(config);
      }
    },

    // 删除单个干扰配置
    removeInterferenceConfig(id: number) {
      this.interferenceConfigs = this.interferenceConfigs.filter(config => config.id !== id);
    }
  },
  
  // 添加持久化配置，使用会话隔离
  persist: {
    key: 'interference-store',
    storage: createUserIsolatedStorage()
  }
}); 