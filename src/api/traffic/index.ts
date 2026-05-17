import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { getUserToken } from '../request';

// 流量模型服务的API基础URL配置
// 使用Vite代理路径，解决跨域问题
const TRAFFIC_BASE_URL = '/trafficWork';

// 创建专门用于流量模型的axios实例
const trafficService: AxiosInstance = axios.create({
  baseURL: TRAFFIC_BASE_URL,
  timeout: 30000, // 流量模型可能需要更长的处理时间
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
trafficService.interceptors.request.use(
  (config) => {
    // 使用用户隔离的token获取方法
    const token = getUserToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    console.error('流量模型API请求错误：', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
trafficService.interceptors.response.use(
  (response: AxiosResponse): any => {
    // 直接返回响应数据
    return response.data;
  },
  (error: any) => {
    console.error('流量模型API响应错误：', error);
    return Promise.reject(error);
  }
);

// 定义API响应接口
export interface ApiResponse<T = any> {
  code: number;
  msg: string | null;
  data: T;
}

// 定义流量模型请求参数接口
export interface TrafficModelParams {
  container: string;
  dst_ip: string;
  re_container: string;
  time: string;
  traffic_model: string;
  csv_filename: string;
}

// 定义流量模型响应数据接口
export interface TrafficModelResponse {
  success: boolean;
  message?: string;
  csv_content?: any[];
  csv_filename?: string;
  [key: string]: any;
}

// 定义获取CSV参数接口
export interface GetCsvParams {
  container: string;
  filename: string;
}

// 定义CSV响应数据接口
export interface CsvResponse {
  success: boolean;
  message?: string;
  csv_content?: any[];
  filename?: string;
  [key: string]: any;
}

/**
 * 流量模型接口
 * @param data 流量模型参数
 * @returns Promise<TrafficModelResponse>
 */
export async function trafficModel(data: TrafficModelParams): Promise<TrafficModelResponse> {
  try {
    const response = await trafficService.post('/traffic/trafficModel', data);
    return response;
  } catch (error: any) {
    console.error('流量模型请求失败:', error);
    throw new Error(error.message || '流量模型请求失败');
  }
}

/**
 * 获取CSV数据接口
 * @param params 获取CSV参数
 * @returns Promise<CsvResponse>
 */
export async function getCsv(params: GetCsvParams): Promise<CsvResponse> {
  try {
    const response = await trafficService.get('/traffic/csv', { params });
    return response;
  } catch (error: any) {
    console.error('获取CSV数据失败:', error);
    throw new Error(error.message || '获取CSV数据失败');
  }
}

// 导出服务实例，以便在其他地方使用
export { trafficService };
