import { defineStore } from 'pinia';
import { trafficModel } from '@/api/traffic/index';
import type { TrafficModelParams } from '@/api/traffic/index';
import { ElMessage } from 'element-plus';
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage';

// 创建用户隔离存储实例
const userStorage = createUserIsolatedStorage();

// TMV链路参数接口
export interface TMVLinkParams {
  linkId: string; // 链路唯一标识
  sourceNodeId: number; // 发送机节点ID
  targetNodeId: number; // 接收机节点ID
  container: string; // 发送机容器名（alias）
  re_container: string; // 接收机容器名（alias）
  dst_ip: string; // 接收机IP地址
  traffic_model: string; // 流量模型
  time: string; // 测试时长
  csv_filename: string; // CSV文件名
  sessionId: number; // 会话ID
}

// TMV节点配置接口
export interface TMVNodeConfig {
  nodeId: number;
  modelType: 'transmitter' | 'receiver';
  trafficModel?: string; // 发送机的流量模型
  testDuration?: number; // 接收机的测试时长
}

// Store状态接口
interface TMVTrafficState {
  tmvLinks: TMVLinkParams[]; // TMV链路参数列表
  csvCounter: number; // CSV文件计数器
  isSimulationRunning: boolean; // 仿真运行状态
  pendingTrafficCalls: TMVLinkParams[]; // 待执行的流量模型调用
  tmvNodeConfigs: TMVNodeConfig[]; // TMV节点配置列表
}

/**
 * TMV流量模型管理Store
 */
export const useTMVTrafficStore = defineStore('tmvTraffic', {
  state: (): TMVTrafficState => ({
    tmvLinks: [],
    csvCounter: 0,
    isSimulationRunning: false,
    pendingTrafficCalls: [],
    tmvNodeConfigs: []
  }),

  getters: {
    /**
     * 获取所有TMV链路
     */
    getAllTMVLinks: (state): TMVLinkParams[] => state.tmvLinks,

    /**
     * 根据链路ID获取TMV链路参数
     */
    getTMVLinkById: (state) => (linkId: string): TMVLinkParams | undefined => {
      return state.tmvLinks.find(link => link.linkId === linkId);
    },

    /**
     * 获取待执行的流量模型调用
     */
    getPendingCalls: (state): TMVLinkParams[] => state.pendingTrafficCalls,

    /**
     * 根据节点ID获取TMV节点配置
     */
    getTMVNodeConfig: (state) => (nodeId: number): TMVNodeConfig | undefined => {
      return state.tmvNodeConfigs.find(config => config.nodeId === nodeId);
    },

    /**
     * 获取所有TMV节点配置
     */
    getAllTMVNodeConfigs: (state): TMVNodeConfig[] => state.tmvNodeConfigs
  },

  actions: {
    /**
     * 初始化时从localStorage加载TMV节点配置
     */
    loadTMVNodeConfigs() {
      try {
        const stored = userStorage.getItem('tmvNodeConfigs');
        if (stored) {
          this.tmvNodeConfigs = JSON.parse(stored);
        }
      } catch (error) {
        console.warn('TMV流量模型 - 加载节点配置失败:', error);
        this.tmvNodeConfigs = [];
      }
    },

    /**
     * 保存TMV节点配置到localStorage
     */
    saveTMVNodeConfigs() {
      try {
        userStorage.setItem('tmvNodeConfigs', JSON.stringify(this.tmvNodeConfigs));
      } catch (error) {
        console.warn('TMV流量模型 - 保存节点配置失败:', error);
      }
    },

    /**
     * 添加或更新TMV节点配置
     */
    setTMVNodeConfig(config: TMVNodeConfig) {
      const existingIndex = this.tmvNodeConfigs.findIndex(c => c.nodeId === config.nodeId);
      if (existingIndex >= 0) {
        this.tmvNodeConfigs[existingIndex] = config;
      } else {
        this.tmvNodeConfigs.push(config);
      }
      this.saveTMVNodeConfigs();
    },

    /**
     * 移除TMV节点配置
     */
    removeTMVNodeConfig(nodeId: number) {
      const index = this.tmvNodeConfigs.findIndex(c => c.nodeId === nodeId);
      if (index >= 0) {
        this.tmvNodeConfigs.splice(index, 1);
        this.saveTMVNodeConfigs();
      }
    },

    /**
     * 添加TMV链路参数
     */
    addTMVLink(linkParams: Omit<TMVLinkParams, 'csv_filename'>) {
      // 自动生成CSV文件名
      this.csvCounter++;
      const csvFilename = `traffic${this.csvCounter}.csv`;

      const tmvLink: TMVLinkParams = {
        ...linkParams,
        csv_filename: csvFilename
      };

      // 检查是否已存在相同的链路
      const existingIndex = this.tmvLinks.findIndex(link => link.linkId === tmvLink.linkId);
      if (existingIndex >= 0) {
        // 更新现有链路
        this.tmvLinks[existingIndex] = tmvLink;
      } else {
        // 添加新链路
        this.tmvLinks.push(tmvLink);
      }

      // 如果仿真正在运行，立即添加到待执行队列
      if (this.isSimulationRunning) {
        this.addToPendingCalls(tmvLink);
      }
    },

    /**
     * 移除TMV链路参数
     */
    removeTMVLink(linkId: string) {
      const index = this.tmvLinks.findIndex(link => link.linkId === linkId);
      if (index >= 0) {
        this.tmvLinks.splice(index, 1);
      }

      // 同时从待执行队列中移除
      const pendingIndex = this.pendingTrafficCalls.findIndex(link => link.linkId === linkId);
      if (pendingIndex >= 0) {
        this.pendingTrafficCalls.splice(pendingIndex, 1);
      }
    },

    /**
     * 设置仿真运行状态 - 已禁用自动调用
     */
    setSimulationRunning(isRunning: boolean) {
      this.isSimulationRunning = isRunning;

      // 不再自动执行流量模型调用
      // TMV节点现在使用手动触发的方式，类似业务终端
      if (!isRunning) {
        // 仿真停止时，清空待执行队列
        this.pendingTrafficCalls = [];
      }
    },

    /**
     * 添加到待执行队列
     */
    addToPendingCalls(linkParams: TMVLinkParams) {
      const existingIndex = this.pendingTrafficCalls.findIndex(link => link.linkId === linkParams.linkId);
      if (existingIndex >= 0) {
        this.pendingTrafficCalls[existingIndex] = linkParams;
      } else {
        this.pendingTrafficCalls.push(linkParams);
      }

      // 如果仿真正在运行，延迟3秒后执行
      if (this.isSimulationRunning) {
        setTimeout(() => {
          this.executeSingleCall(linkParams);
        }, 3000);
      }
    },

    /**
     * 执行所有待执行的流量模型调用
     */
    async executeAllPendingCalls() {
      if (!this.isSimulationRunning || this.pendingTrafficCalls.length === 0) {
        return;
      }


      // 并发执行所有调用
      const promises = this.pendingTrafficCalls.map(linkParams => this.executeSingleCall(linkParams));
      
      try {
        await Promise.allSettled(promises);
      } catch (error) {
        console.error('TMV流量模型 - 执行流量模型调用时出错:', error);
      }
    },

    /**
     * 执行单个流量模型调用
     */
    async executeSingleCall(linkParams: TMVLinkParams) {
      if (!this.isSimulationRunning) {
        return;
      }

      try {

        const trafficParams: TrafficModelParams = {
          container: linkParams.container,
          dst_ip: linkParams.dst_ip,
          re_container: linkParams.re_container,
          time: linkParams.time,
          traffic_model: linkParams.traffic_model,
          csv_filename: linkParams.csv_filename
        };

        const response = await trafficModel(trafficParams);
        
        if (response.code === 200) {
          ElMessage.success(`TMV流量模型执行成功: ${linkParams.linkId}`);
        } else {
          ElMessage.warning(`TMV流量模型执行失败: ${linkParams.linkId} - ${response.msg || '未知错误'}`);
          console.warn('TMV流量模型 - 执行失败:', linkParams.linkId, response);
        }
      } catch (error: any) {
        ElMessage.error(`TMV流量模型执行错误: ${linkParams.linkId} - ${error.message}`);
        console.error('TMV流量模型 - 执行错误:', linkParams.linkId, error);
      }
    },

    /**
     * 清空所有数据
     */
    clearAll() {
      this.tmvLinks = [];
      this.pendingTrafficCalls = [];
      this.tmvNodeConfigs = [];
      this.csvCounter = 0;
      this.isSimulationRunning = false;
      // 同时清理localStorage
      try {
        userStorage.setItem('tmvNodeConfigs', '[]');
      } catch (error) {
        console.warn('TMV流量模型 - 清理localStorage失败:', error);
      }
    }
  }
});
