import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';

// 认证服务的API基础URL配置
// 使用Vite代理路径，解决跨域问题
const AUTH_BASE_URL = '/router';

// 创建专门用于认证的axios实例
const routerervice: AxiosInstance = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// 请求拦截器
routerervice.interceptors.request.use(
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
routerervice.interceptors.response.use(
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

// 新增：插入路由器信息 API
export async function insertRouterInfo(data: Record<string, any>) {
  const response=await routerervice.post<ResponseData>('/router/insert', data);
  const response2: ResponseData = response as any;
   if(response2.code==200){
     ElMessage.success('协议配置成功');
   }else{
     ElMessage.error('协议配置失败');
   }
}

//开启场景时让配置的协议生效
export async function applyProtocol(sessionId: number) {
    // 修正：将sessionId作为params对象传递
    const response= await routerervice.get<ResponseData>('/router/pushRouter', {
      params: { sessionId }
    }) as any;
    
    if (response.code==200) {
      ElMessage.success('协议配置成功');
      return response.data;
    } else {
      return false;
    }
}


//关闭场景时让协议配置失效
export async function cancelProtocol(sessionId: number) {
  try {
    // 修正：将sessionId作为params对象传递
    const response = await routerervice.get<ResponseData>('/router/resetRouter', {
      params: { sessionId }
    }) as any;
    
    if (response.code === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    // 添加错误处理
    console.error('协议重置请求失败:', error);
    return false;
  }
}


//获取所有协议信息
export async function getAllProtocols(sessionId: number, container: string, showMessages: boolean = true) {
  try {
    const response = await routerervice.get<ResponseData>('/router/slecteRouterConfig', {
      params: { sessionId, container }
    }) as any;

    if (response.code === 200) {
      if (showMessages) {
        ElMessage.success('获取协议信息成功');
        console.log('获取协议信息成功:', response.data);
      }
      return response.data;
    } else {
      return null;
    }
  } catch (error) {
    console.error('协议查询请求失败:', error);
    return false;
  }
}




// 下发主动测量
export async function sendActiveMeasurement(data:any) {
  try {
    const response= await routerervice.post<ResponseData>('/measure/active', data)as any;
    
    if (response.code === 200) {
      ElMessage.success('主动测量命令下发成功');
      return response;
    } else {
      return null;
    }
  } catch (error) {
    console.error('主动测量请求失败:', error);
    return null;
  }
}

// 下发被动测量
export async function sendPassiveMeasurement(data:any) {
  try {
    const response = await routerervice.post<ResponseData>('/measure/passive', data)as any;
    
    if (response.code === 200) {
      ElMessage.success('被动测量命令下发成功');
      return response;
    } else {
      return null;
    }
  } catch (error) {
    console.error('被动测量请求失败:', error);
    return null;
  }
}

//获取主动测试结果
export async function getActiveMeasurementResult( pageNo: Number,
            pageSize: Number,
            srcContainer:string,
            dstContainer:string,
            sessionId:Number,
            status: string) { 
    try {
    const response = await routerervice.get<ResponseData>('/measure/activeRes/pageQuery', {params:{
      pageNo,
      pageSize,
      srcContainer,
      dstContainer,
      sessionId,
      status
    }})as any;
    
    if (response.code === 200) {
      ElMessage.success('主动测量结果查询成功');
      return response;
    } else {
      return null;
    }
  } catch (error) {
    console.error('主动测量结果查询失败:', error);
    return null;
  }

}


//获取被动测试结果
export async function getPassiveMeasurementResult(pageNo: Number,
            pageSize: Number,
            container: string,
            sessionId:Number,
            status: string){ 
    try {
    const response = await routerervice.get<ResponseData>('/measure/passiveRes/pageQuery', {params:{
      pageNo,
      pageSize,
      container,
      sessionId,
      status
    }})as any;
    
    if (response.code === 200) {
      ElMessage.success('被动测量结果查询成功');
      return response;
    } else {
      return null;
    }
  } catch (error) {
    console.error('被动测量结果查询失败:', error);
    return null;
  }
}