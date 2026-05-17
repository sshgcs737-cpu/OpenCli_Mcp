// VM模板相关类型定义

/**
 * VM模板接口
 */
export interface VMTemplate {
  id: number;
  description: string;
  name: string;
  template: string; // XML格式的模板
  disk: string;
  createTime: string;
  updateTime: string;
  vcpu: number;
  memory: string;
  curMemory: string;
  location: string;
}

/**
 * VM模板API响应接口
 */
export interface VMTemplateResponse {
  code: number;
  msg: string | null;
  data: VMTemplate[];
}

/**
 * 解析后的XML模板信息
 */
export interface ParsedXMLTemplate {
  name?: string;
  uuid?: string;
  memory?: string;
  currentMemory?: string;
  vcpu?: string;
  osType?: string;
  machine?: string;
}
