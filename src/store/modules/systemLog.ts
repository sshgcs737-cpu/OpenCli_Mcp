import { defineStore } from 'pinia';
import { sendLog, getLogInfo } from '../../api/log';
import type { BackendLogEntry, LogType } from '../../api/log';
import { useTopoStore } from './topo';

export interface LogEntry {
  id: number;
  sessionId: string;
  type: 'important' | 'normal' | 'warning';
  time: number;
  information: string;
  module: string;
  action: string;
  details: string;
}

interface SystemLogState {
  logs: LogEntry[];
  nextId: number;
  maxLogs: number;
  // 后端日志相关状态
  backendLogs: BackendLogEntry[];
  loadingBackendLogs: boolean;
  backendLogsError: string | null;
}

export const useSystemLogStore = defineStore('systemLog', {
  state: (): SystemLogState => ({
    logs: [],
    nextId: 1,
    maxLogs: 1000, // 最大日志数量，防止内存占用过多
    // 后端日志相关状态初始化
    backendLogs: [],
    loadingBackendLogs: false,
    backendLogsError: null
  }),
  
  getters: {
    allLogs: (state: SystemLogState) => state.logs,

    // 按日期倒序排列的日志
    sortedLogs: (state: SystemLogState) => [...state.logs].sort((a, b) => b.time - a.time),

    // 根据类型过滤的日志
    filteredLogs: (state: SystemLogState) => (type: string) => {
      if (type === 'all') return state.logs;
      return state.logs.filter(log => log.type === type);
    },

    // 后端日志相关 getters
    allBackendLogs: (state: SystemLogState) => state.backendLogs,

    // 按时间倒序排列的后端日志
    sortedBackendLogs: (state: SystemLogState) => [...state.backendLogs].sort((a, b) => b.time - a.time),

    // 根据类型过滤的后端日志
    filteredBackendLogs: (state: SystemLogState) => (type: string) => {
      if (type === 'all') return state.backendLogs;
      return state.backendLogs.filter(log => log.type === type);
    },

    // 后端日志加载状态
    isLoadingBackendLogs: (state: SystemLogState) => state.loadingBackendLogs,

    // 后端日志错误信息
    backendLogsErrorMessage: (state: SystemLogState) => state.backendLogsError
  },
  
  actions: {
    // 添加一条日志
    addLog(log: Omit<LogEntry, 'id' | 'time' | 'sessionId'>) {
      // 获取当前场景ID
      const topoStore = useTopoStore();
      const sessionId = topoStore.topoData?.id?.toString() || 'unknown';

      const newLog: LogEntry = {
        id: this.nextId++,
        time: Date.now(),
        sessionId,
        ...log
      };

      this.logs.push(newLog);

      // 如果日志数量超过最大值，删除最早的日志
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      // 保存到localStorage
      this.saveToLocalStorage();

      // 尝试发送日志到后端
      this.sendLogToBackend(newLog);

      return newLog.id;
    },

    // 发送日志到后端
    async sendLogToBackend(logEntry: LogEntry) {
      try {
        // 获取当前 sessionId
        const topoStore = useTopoStore();
        const sessionId = topoStore.topoData?.id;

        // 如果没有 sessionId，则不发送到后端（可能还没有加载场景）
        if (!sessionId) {
          return;
        }

        // 发送日志到后端
        // 需要将本地日志类型映射回前端类型以便发送到后端
        const frontendType = this.mapToFrontendType(logEntry.type);
        const response = await sendLog(sessionId, {
          type: frontendType,
          timestamp: logEntry.time,
          module: logEntry.module,
          action: logEntry.action,
          details: logEntry.details,
          information: logEntry.information
        });

      } catch (error) {
        // 发送失败时只记录错误，不影响前端日志功能
        console.error('发送日志到后端失败:', error);
      }
    },
    
    // 清空所有日志
    clearLogs() {
      this.logs = [];
      this.saveToLocalStorage();
      return true;
    },
    
    // 导出日志为JSON字符串
    exportLogs() {
      return JSON.stringify([...this.logs].sort((a, b) => b.time - a.time), null, 2);
    },
    
    // 删除指定ID的日志
    deleteLog(id: number) {
      const index = this.logs.findIndex(log => log.id === id);
      if (index !== -1) {
        this.logs.splice(index, 1);
        this.saveToLocalStorage();
        return true;
      }
      return false;
    },
    
    // 从localStorage加载日志
    loadFromLocalStorage() {
      try {
        const savedLogs = localStorage.getItem('system-logs');
        if (savedLogs) {
          const parsedLogs = JSON.parse(savedLogs);
          this.logs = parsedLogs;
          
          // 找出最大ID
          if (this.logs.length > 0) {
            const maxId = Math.max(...this.logs.map(log => log.id));
            this.nextId = maxId + 1;
          }
        }
      } catch (error) {
        console.error('加载系统日志失败:', error);
      }
    },
    
    // 保存到localStorage
    saveToLocalStorage() {
      try {
        localStorage.setItem('system-logs', JSON.stringify(this.logs));
      } catch (error) {
        console.error('保存系统日志失败:', error);
      }
    },

    // 从后端获取日志信息
    async fetchBackendLogs(sessionId?: number) {
      try {
        // 设置加载状态
        this.loadingBackendLogs = true;
        this.backendLogsError = null;

        // 如果没有提供 sessionId，尝试从 topoStore 获取
        let targetSessionId = sessionId;
        if (!targetSessionId) {
          const topoStore = useTopoStore();
          targetSessionId = topoStore.topoData?.id;
        }

        // 如果仍然没有 sessionId，抛出错误
        if (!targetSessionId) {
          throw new Error('没有可用的 sessionId，请确保已加载场景');
        }

        // 调用 API 获取后端日志
        const response = await getLogInfo(targetSessionId);

        if (response.success) {
          // 更新后端日志数据
          this.backendLogs = response.logs;
        } else {
          throw new Error(response.message || '获取日志失败');
        }
      } catch (error: any) {
        // 设置错误状态
        this.backendLogsError = error.message || '获取后端日志失败';
        console.error('获取后端日志失败:', error);
        throw error;
      } finally {
        // 清除加载状态
        this.loadingBackendLogs = false;
      }
    },

    // 清空后端日志数据
    clearBackendLogs() {
      this.backendLogs = [];
      this.backendLogsError = null;
    },

    // 刷新后端日志（重新获取）
    async refreshBackendLogs(sessionId?: number) {
      return this.fetchBackendLogs(sessionId);
    },

    // 将本地日志类型映射回前端类型（用于发送到后端）
    mapToFrontendType(localType: 'important' | 'normal' | 'warning'): 'info' | 'warning' | 'error' | 'success' {
      const typeMap: Record<string, 'info' | 'warning' | 'error' | 'success'> = {
        'normal': 'info',
        'warning': 'warning',
        'important': 'error'
      };
      return typeMap[localType] || 'info';
    }
  }
});