import request from '../request';

// 定义API响应接口
interface ApiResponse<T> {
  code: number;
  msg: string | null;
  data: T;
}

// 定义干扰节点参数接口
interface InterferenceNodeParams {
  sessionId: number;
  nodeId: number;
  lat: string;
  lon: string;
  alt: string;
  interferePowerdb: string;
  interfereFreq: string;
  interfereModel?: string;
  azimuth: string;
  elevation: string;
  userId?: string; // 添加用户ID字段
}

// 定义干扰节点数据接口
export interface InterferenceNodeData {
  id: number;
  nodeId: number;
  sessionId: number;
  interferePowerdb: string;
  interfereFreq: string;
  interfereModel?: string;
  azimuth: string;
  elevation: string;
  status: string;
  lat: string;
  lon: string;
  alt: string;
  cmd: string;
}

/**
 * 编辑干扰节点参数
 * @param data 干扰节点参数
 * @returns Promise<ApiResponse<InterferenceNodeData>> 响应数据
 */
export const editInterferenceNode = (data: InterferenceNodeParams) => {
  return request<ApiResponse<InterferenceNodeData>>({
    url: '/node/editINode',
    method: 'post',
    data
  });
};

/**
 * 获取干扰节点配置列表
 * @param sessionId 会话ID
 * @returns Promise<ApiResponse<InterferenceNodeData[]>> 干扰节点配置列表
 */
export const getInodeConfig = (sessionId: number) => {
  return request<ApiResponse<InterferenceNodeData[]>>({
    url: '/node/getInodeConfig',
    method: 'get',
    params: { sessionId }
  });
};

/**
 * 开启干扰节点
 * @param sessionId 会话ID
 * @param nodeId 节点ID
 * @param userId 用户ID
 * @returns Promise<ApiResponse<InterferenceNodeData>> 响应数据
 */
export const startNodeInterference = (sessionId: number, nodeId: number, userId?: string) => {
  const params: any = { sessionId, nodeId };
  if (userId) {
    params.userId = userId;
  }

  return request<ApiResponse<InterferenceNodeData>>({
    url: '/node/startInterfere',
    method: 'post',
    params
  });
};

/**
 * 关闭干扰节点
 * @param sessionId 会话ID
 * @param nodeId 节点ID
 * @param userId 用户ID
 * @returns Promise<ApiResponse<InterferenceNodeData>> 响应数据
 */
export const stopNodeInterference = (sessionId: number, nodeId: number, userId?: string) => {
  const params: any = { sessionId, nodeId };
  if (userId) {
    params.userId = userId;
  }

  return request<ApiResponse<InterferenceNodeData>>({
    url: '/node/stopInterfere',
    method: 'post',
    params
  });
};