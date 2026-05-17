import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

// 认证服务的API基础URL配置
// 使用Vite代理路径，解决跨域问题
const AUTH_BASE_URL = '/wiredTest';

// 创建专门用于认证的axios实例
const wiredService: AxiosInstance = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
wiredService.interceptors.request.use(
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
wiredService.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response.data;
  },
  (error: any) => {
    console.error('响应错误：', error);
    
    
    return Promise.reject(error);
  }
);

// 建议的ResponseData接口定义
export interface ResponseData {
  code: number;
  message?: string;
  data?: any;
}

export async function PassiveMeasurement(data:any) {
  try {
    const response = await wiredService.post<ResponseData>('/measure/passive', data) as any;

    if (response.code === 200) {
      ElMessage.success('命令下发成功');
      return response;
    } else {
      return null;
    }
  } catch (error) {
    console.error('被动测量请求失败:', error);
    return null;
  }
}