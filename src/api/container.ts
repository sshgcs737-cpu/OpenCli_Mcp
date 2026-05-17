import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

// 认证服务的API基础URL配置
// 使用Vite代理路径，解决跨域问题
const AUTH_BASE_URL = '/dockerTest';

// 创建专门用于认证的axios实例
const containerService: AxiosInstance = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
containerService.interceptors.request.use(
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
containerService.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response;
  },
  (error: any) => {
    console.error('响应错误：', error);

    return Promise.reject(error);
  }
);

//定义响应接口类型
interface ApiResponse<T = any> {
  code: number;
  msg: string | null;
  data: T;
}

// 获取容器列表i
export async function fetchContainers() {
    const data: ApiResponse = await containerService.get<ApiResponse>('/dockerTest/containers') as any;
    return data.data.data.containers;   //第三个data是因为接口返回的data嵌套了data
}
// 执行操作（生成图片/视频，及可选传输）
export async function executeOperation(params: {
 container: string;
 operation: string;
 transferTarget?: string;
 serviceParams: any;
 transferParams?: any;
}): Promise<ApiResponse> {  //定义返回接口保存 output success transfer_id
 const response = await containerService.post<ApiResponse>('/dockerTest/execute', params);
 return response.data;
}

// {
//   const data = containerService.post('/dockerTest/execute', params);
//   return data;
// }

// // 查询传输状态

export async function fetchTransferStatus(transferId: string): Promise<ApiResponse<{
  status: string;
  message: string;
  delay?: number;
  rate?: number;
  details?: { sent: string; received: string };
  error?: string;
}>> {
  const response = await containerService.get<ApiResponse<any>>(`/dockerTest/transfer-status/${transferId}`);
  return response.data;
}

// 查看文件内容
export async function viewFile(container: string, path: string): Promise<ApiResponse<any>> {
  const response = await containerService.get<ApiResponse<any>>(`/dockerTest/view-file`, {
    params: {
      container,
      path
    }
  });
  return response.data;
}
// export function fetchTransferStatus(transferId: string) {
//     return axios.get(`/dockerTest/transfer-status/${transferId}`);
// }


