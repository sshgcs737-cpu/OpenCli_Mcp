import request from './request';
import { ElMessage } from 'element-plus';

// TDMA时隙配置项接口
export interface TDMASlotItem {
  index: number;
  nodes: string;
}

// TDMA生成请求参数接口
export interface GenerateTDMARequest {
  savePath: string;
  slots: number;
  slotduration: number;
  slotList: TDMASlotItem[];
}

// TDMA生成响应接口
export interface GenerateTDMAResponse {
  code: number;
  msg?: string;
  data?: any;
}

/**
 * 生成TDMA调度文件
 * @param data TDMA配置参数
 * @returns 响应结果
 */
export async function generateTDMA(data: GenerateTDMARequest): Promise<GenerateTDMAResponse> {
  try {
    const response = await request.post<GenerateTDMAResponse>('/generateTDMA', data);

    if (response.code === 200) {
      ElMessage.success('TDMA调度文件生成成功');
      return response;
    } else {
      ElMessage.error(response.msg || 'TDMA调度文件生成失败');
      return response;
    }
  } catch (error: any) {
    console.error('TDMA调度文件生成请求失败:', error);
    ElMessage.error('TDMA调度文件生成请求失败');
    throw error;
  }
}
