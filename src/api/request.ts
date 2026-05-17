import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import { useSystemLogStore } from '../store/modules/systemLog';

// API基础URL配置
const BASE_URL = '/api';

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: BASE_URL, // 直接使用常量而不是环境变量
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 获取用户隔离的token
function getUserToken(): string | null {
  // 获取当前会话ID
  const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
  
  // 尝试获取用户ID
  let userId = 'anonymous';
  try {
    const userKeys = Object.keys(localStorage).filter(k => k.startsWith('userInfo_') && k.includes(sessionId));
    if (userKeys.length > 0) {
      const userInfo = JSON.parse(localStorage.getItem(userKeys[0]) || '{}');
      userId = userInfo.id || 'anonymous';
    }
  } catch (error) {
    console.warn('获取用户ID失败:', error);
  }
  
  // 构建用户隔离的token键
  const tokenKey = `token_${userId}_${sessionId}`;
  return localStorage.getItem(tokenKey) || localStorage.getItem('token'); // 兼容旧版本
}

// 设置用户隔离的token
function setUserToken(token: string): void {
  // 获取当前会话ID
  const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
  
  // 尝试获取用户ID
  let userId = 'anonymous';
  try {
    const userKeys = Object.keys(localStorage).filter(k => k.startsWith('userInfo_') && k.includes(sessionId));
    if (userKeys.length > 0) {
      const userInfo = JSON.parse(localStorage.getItem(userKeys[0]) || '{}');
      userId = userInfo.id || 'anonymous';
    }
  } catch (error) {
    console.warn('获取用户ID失败:', error);
  }
  
  // 构建用户隔离的token键
  const tokenKey = `token_${userId}_${sessionId}`;
  localStorage.setItem(tokenKey, token);
}

// 清除用户隔离的token
function clearUserToken(): void {
  // 获取当前会话ID
  const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
  
  // 尝试获取用户ID
  let userId = 'anonymous';
  try {
    const userKeys = Object.keys(localStorage).filter(k => k.startsWith('userInfo_') && k.includes(sessionId));
    if (userKeys.length > 0) {
      const userInfo = JSON.parse(localStorage.getItem(userKeys[0]) || '{}');
      userId = userInfo.id || 'anonymous';
    }
  } catch (error) {
    console.warn('获取用户ID失败:', error);
  }
  
  // 清除用户隔离的token
  const tokenKey = `token_${userId}_${sessionId}`;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem('token'); // 兼容旧版本
}

// 请求拦截器
service.interceptors.request.use(
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
    console.error('请求错误：', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response;
    
    // 如果响应的状态码不是200，说明请求出错
    if (data.code !== 200) {
      // 对于外部API（如路径追踪服务），它们可能没有code字段，而是直接返回数据
      // 检查是否有success字段，并且值为true
      if (data.success === true) {
        return data;
      }
      
      ElMessage.error(data.msg || '系统错误');
      
      // 如果是401，说明token过期或无效，需要重新登录
      if (data.code === 401) {
        // 清除登录信息
        clearUserToken();
        // 跳转到登录页
        window.location.href = '/login';
      }
      
      return Promise.reject(new Error(data.msg || '系统错误'));
    }
    
    return data;
  },
  (error: any) => {
    console.error('响应错误：', error);

    // 记录API响应错误日志
    const systemLogStore = useSystemLogStore();
    let errorMessage = '未知错误';
    let statusCode = 'unknown';

    if (error.response) {
      statusCode = error.response.status.toString();
      errorMessage = error.response.data?.message || error.response.data?.msg || `HTTP ${error.response.status} 错误`;
    } else if (error.request) {
      errorMessage = '网络连接错误';
    } else {
      errorMessage = '请求配置错误';
    }

    systemLogStore.addLog({
      type: 'warning',
      module: 'api',
      action: 'API响应错误',
      information: 'API响应错误',
      details: `API响应错误: ${error.config?.url || '未知URL'}, 状态码: ${statusCode}`
    });

    return Promise.reject(error);
  }
);

export default service;

// 导出token管理函数以供其他模块使用
export { getUserToken, setUserToken, clearUserToken }; 