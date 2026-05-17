import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { getUserToken } from '../request';

// 创建专门用于日志的axios实例，使用auth-api
const logService: AxiosInstance = axios.create({
  baseURL: '/auth-api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
logService.interceptors.request.use(
  (config) => {
    // 使用用户隔离的token获取方法
    const token = getUserToken();
    if (token && config.headers) {
      // 设置token到请求头
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    console.error('日志API请求错误：', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
logService.interceptors.response.use(
  (response: AxiosResponse): any => {
    const { data } = response;

    // 处理后端返回的数据结构，将其转换为前端期望的格式
    if (data.code === 200) {
      // 对于 getLogInfo 接口，需要特殊处理
      if (Array.isArray(data.data)) {
        return {
          success: true,
          message: data.msg || '获取成功',
          logs: data.data
        };
      }
      // 对于 sendLog 接口
      return {
        success: true,
        message: data.msg || '操作成功',
        logId: data.data || null
      };
    } else {
      // 如果code不是200，返回错误格式
      return {
        success: false,
        message: data.msg || '操作失败',
        logs: [],
        logId: null
      };
    }
  },
  (error: any) => {
    console.error('日志API响应错误：', error);
    return Promise.reject(error);
  }
);

// 日志类型定义（后端接口要求的类型）
export type LogType = 'important' | 'normal' | 'warning';

// 前端日志类型（现有系统使用的类型）
export type FrontendLogType = 'info' | 'warning' | 'error' | 'success';

// 发送日志的数据结构
export interface SendLogData {
  type: LogType;
  time: number;
  information: string;
  module: string;
  action: string;
  details: string;
}

// 发送日志的响应结构
export interface SendLogResponse {
  success: boolean;
  message: string;
  logId: number | null;
}

// 后端日志信息结构（从后端获取的日志格式）
export interface BackendLogEntry {
  id: number;
  sessionId: string;
  type: LogType;
  time: number;
  information: string;
  module: string;
  action: string;
  details: string;
}

// 获取日志信息的响应结构
export interface GetLogInfoResponse {
  success: boolean;
  message: string;
  logs: BackendLogEntry[];
}

// 类型映射函数：将前端日志类型映射到后端接口要求的类型
export function mapLogType(frontendType: FrontendLogType): LogType {
  const typeMap: Record<FrontendLogType, LogType> = {
    'info': 'normal',
    'warning': 'warning',
    'error': 'important',
    'success': 'important'
  };
  
  return typeMap[frontendType];
}

// 发送日志到后端保存
export function sendLog(
  sessionId: number,
  logData: {
    type: FrontendLogType;
    timestamp: number;
    module: string;
    action: string;
    details?: string;
    information?: string;
  }
): Promise<SendLogResponse> {
  // 构建发送给后端的数据
  const sendData: SendLogData = {
    type: mapLogType(logData.type),
    time: logData.timestamp,
    information: logData.information || logData.action, // 如果没有提供 information，使用 action
    module: logData.module,
    action: logData.action,
    details: logData.details || ''
  };

  return logService({
    url: '/sendLog',
    method: 'post',
    params: { sessionId },
    data: sendData
  });
}

// 根据场景ID获取后端保存的所有日志信息
export function getLogInfo(sessionId: number): Promise<GetLogInfoResponse> {
  return logService({
    url: '/getLogInfo',
    method: 'get',
    params: { sessionId }
  });
}
