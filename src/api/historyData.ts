import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

// 历史数据服务的 API 基础 URL 配置
// 使用 Vite 代理路径，解决跨域问题
const HISTORY_BASE_URL = '/api';

// 创建专门用于历史数据的 axios 实例
const HistoryDataService: AxiosInstance = axios.create({
  baseURL: HISTORY_BASE_URL,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
HistoryDataService.interceptors.request.use(
  (config) => {
    // 可以在这里添加请求前的处理逻辑
    return config;
  },
  (error: any) => {
    console.error('请求错误：', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
HistoryDataService.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response;
  },
  (error: any) => {
    console.error('响应错误：', error);

    return Promise.reject(error);
  }
);

// 定义响应接口类型
interface ApiResponse<T = any> {
  code: number;
  msg: string | null;
  data: T;
}

// 获取历史数据
export async function getHistoryData(data: {
    sessionId: number;
    type: number;
    start: string;
    end: string;
}): Promise<ApiResponse> {
    // 修复：将参数包裹在配置对象的body属性中
   const response = await HistoryDataService.post<ApiResponse>(
      '/getListByTime', // 接口路径
      data// 请求体参数
    );
    return response.data;
}