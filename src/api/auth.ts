import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

// 认证服务的API基础URL配置
// 使用Vite代理路径，解决跨域问题
const AUTH_BASE_URL = '/auth-api';

// 创建专门用于认证的axios实例
const authService: AxiosInstance = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
authService.interceptors.request.use(
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
authService.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response.data;
  },
  (error: any) => {
    console.error('响应错误：', error);
    
    
    return Promise.reject(error);
  }
);

// 角色映射：数字角色转换为字符串
export const numberToRole = (roleNumber: number): string => {
  const roleMap: { [key: number]: string } = {
    1: 'white', // 白方
    2: 'red',   // 红方
    3: 'blue'   // 蓝方
  };
  return roleMap[roleNumber] || 'white'; // 默认为白方
};

// 解析复杂响应，尝试提取出数据
export const parseComplexResponse = (response: any): any => {
  // 如果响应不存在，返回null
  if (!response) return null;
  
  // 如果响应是字符串，尝试解析成JSON
  if (typeof response === 'string') {
    try {
      return JSON.parse(response);
    } catch (e) {
      console.error('解析响应字符串失败:', e);
      return response;
    }
  }
  
  // 如果响应包含data属性，且data是字符串
  if (response.data && typeof response.data === 'string') {
    try {
      return JSON.parse(response.data);
    } catch (e) {
      console.error('解析响应data字符串失败:', e);
      return response;
    }
  }
  
  // 如果响应是标准API响应格式，包含code和data
  if (response.code === 200 && response.data) {
    return response.data;
  }
  
  // 其他情况直接返回原始响应
  return response;
};

// 定义响应类型接口
interface AuthResponse {
  id?: string;
  username?: string;
  type?: number; // 用户类型
  role?: number; // 用户角色数字表示
  [key: string]: any;
}

// 登录API
export const login = async (username: string, password: string, type: number) => {
  try {
    
    const response = await authService.post<AuthResponse>('/login', {
      username,
      password,
      type
    });
    
    
    // 确保响应中包含用户名，如果没有则使用提交的用户名
    const responseData: AuthResponse = response as any;
    if (!responseData.username) {
      responseData.username = username;
    }
    
    return responseData;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
};

// 注册API
export const register = async (username: string, password: string, type: number) => {
  try {
    
    const response = await authService.post<AuthResponse>('/register', {
      username,
      password,
      type
    });
    
    
    // 确保响应中包含用户名，如果没有则使用提交的用户名
    const responseData: AuthResponse = response as any;
    if (!responseData.username) {
      responseData.username = username;
    }
    
    return responseData;
  } catch (error) {
    console.error('注册失败:', error);
    throw error;
  }
};

// 获取所有用户API
export const getUsers = async () => {
  try {
    const response = await authService.get<AuthResponse[]>('/getUsers');
    
    // 处理响应数据
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (response && typeof response === 'object') {
      // 如果响应是一个对象，尝试获取data属性
      const responseObj = response as any;
      users = Array.isArray(responseObj.data) ? responseObj.data : 
              (responseObj.users ? responseObj.users : []);
    }
    
    return users;
  } catch (error) {
    console.error('获取用户列表失败:', error);
    ElMessage.error('获取用户列表失败');
    throw error;
  }
};

// 删除用户API
export const deleteUser = async (username: string, type: number) => {
  try {
    
    const response = await authService.post('/deleteUser', null, {
      params: {
        username,
        type
      }
    });
    
    return response;
  } catch (error) {
    console.error('删除用户失败:', error);
    throw error;
  }
};

// 更改用户角色API
export const changeRole = async (username: string, type: number, role: number) => {
  try {
    const response = await authService.post('/changeRole', null, {
      params: {
        username,
        type,
        role
      }
    });
    
    return response;
  } catch (error) {
    console.error('更改用户角色失败:', error);
    throw error;
  }
};

// 更改用户分布式场景创建权限API
export const changeDisturb = async (username: string, type: number, disturb: number) => {
  try {
    const response = await authService.post('/changeDisturb', null, {
      params: {
        username,
        type,
        disturb
      }
    });
    
    return response;
  } catch (error) {
    console.error('更改分布式场景权限失败:', error);
    throw error;
  }
};

export default {
  login,
  register,
  getUsers,
  deleteUser,
  changeRole,
  changeDisturb,
  numberToRole,
  parseComplexResponse,
};