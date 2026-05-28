import axios, { AxiosError, type AxiosInstance } from 'axios';
import { config, requireBackendToken } from './config.ts';
import type { Link, TopoData } from '../src/types/topo.ts';

export interface ApiResponse<T = any> {
  code: number;
  msg?: string | null;
  data: T;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface SceneData {
  id: number;
  state: string;
  name: string;
  user?: string;
  createTime?: string;
  createUser?: string;
  updateTime?: string;
  updateUser?: string;
  isPublic?: number;
  ordinary?: number;
  session?: any;
}

export interface SceneListOptions {
  scope?: 'private' | 'public' | 'all';
  name?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface StartBrokerParams {
  duration: number;
  stepLength: number;
  mode: number;
}

export interface EditVMNodeParams {
  sessionId: number | string;
  userId?: number | string;
  nodeId: number;
  templateId: number;
  cpu: number;
  currentMemory: string;
  memory: string;
}

export interface AddVMNodeParams {
  templateId: number;
  node: any;
}

export interface GenerateTDMAParams {
  savePath: string;
  slots: number;
  slotduration: number;
  slotList: Array<{
    index: number;
    nodes: string;
  }>;
}

function apiMessage(value: any, fallback: string): string {
  return value?.msg || value?.message || value?.error || fallback;
}

function normalizeAxiosError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    if (axiosError.response?.status === 401) {
      return new Error('后端返回 401：OPENCLI_BACKEND_TOKEN 无效或已过期。');
    }

    const data = axiosError.response?.data;
    return new Error(apiMessage(data, axiosError.message || '后端请求失败'));
  }

  return error instanceof Error ? error : new Error(String(error));
}

function assertApiOk<T>(response: ApiResponse<T>, fallback: string): ApiResponse<T> {
  if (!response) {
    throw new Error(fallback);
  }

  if (typeof response.code !== 'undefined' && response.code !== 200) {
    throw new Error(apiMessage(response, fallback));
  }

  return response;
}

export class OpenCliBackendClient {
  private readonly api: AxiosInstance;
  private readonly routerApi: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiBase,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      timeout: 30000,
    });

    this.routerApi = axios.create({
      baseURL: config.routerApiBase,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      timeout: 30000,
    });

    this.api.interceptors.request.use((requestConfig) => {
      requestConfig.headers.Authorization = `Bearer ${requireBackendToken()}`;
      return requestConfig;
    });
  }

  private async request<T>(label: string, run: () => Promise<{ data: ApiResponse<T> }>): Promise<ApiResponse<T>> {
    try {
      const response = await run();
      return assertApiOk(response.data, label);
    } catch (error) {
      throw normalizeAxiosError(error);
    }
  }

  private async routerRequest<T>(label: string, run: () => Promise<{ data: ApiResponse<T> }>): Promise<ApiResponse<T>> {
    try {
      const response = await run();
      return assertApiOk(response.data, label);
    } catch (error) {
      throw normalizeAxiosError(error);
    }
  }

  async listScenes(options: SceneListOptions): Promise<SceneData[]> {
    const scope = options.scope || 'all';
    const pageNo = options.pageNo || 1;
    const pageSize = options.pageSize || 50;
    const requests: Array<Promise<SceneData[]>> = [];

    if (scope !== 'public') {
      requests.push(
        this.request<PageResult<SceneData>>('获取私有场景列表失败', () => this.api.post('/loadPrivate', {
          pageNo,
          pageSize,
          user: config.username,
          userId: config.userId,
          name: options.name || undefined,
          ordinary: config.ordinary,
        })).then((response) => (response.data.records || []).map((scene) => ({ ...scene, scopeLabel: '私有' } as SceneData & { scopeLabel: string })))
      );
    }

    if (scope !== 'private') {
      requests.push(
        this.request<PageResult<SceneData>>('获取公共场景列表失败', () => this.api.post('/load', {
          pageNo,
          pageSize,
          name: options.name || undefined,
          ordinary: config.ordinary,
        })).then((response) => (response.data.records || []).map((scene) => ({ ...scene, scopeLabel: '公共' } as SceneData & { scopeLabel: string })))
      );
    }

    const results = await Promise.all(requests);
    const byId = new Map<number, SceneData>();

    results.flat().forEach((scene) => {
      const id = Number(scene.id || scene.session?.id || 0);
      if (id && !byId.has(id)) {
        byId.set(id, scene);
      }
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = new Date(a.updateTime || a.createTime || 0).getTime();
      const bTime = new Date(b.updateTime || b.createTime || 0).getTime();
      return bTime - aTime;
    });
  }

  createScene(name: string): Promise<ApiResponse> {
    return this.request('新建场景失败', () => this.api.post('/create', {
      name,
      userId: config.userId,
      isPublic: 0,
      ordinary: config.ordinary,
      disturb: config.disturb,
    }));
  }

  closeScene(sessionId: number): Promise<ApiResponse> {
    return this.request('关闭场景失败', () => this.api.get('/clearSession', { params: { sessionId } }));
  }

  getTopo(sessionId: number): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('获取拓扑失败', () => this.api.get('/topo', { params: { sessionId } }));
  }

  addNode(nodeData: any, sessionId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('添加节点失败', () => this.api.post('/node/add', nodeData, { params: { sessionId, userId } }));
  }

  addVMNode(vmNodeData: AddVMNodeParams, sessionId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('添加 VM 节点失败', () => this.api.post('/node/addVMNode', vmNodeData, { params: { sessionId, userId } }));
  }

  editNode(nodeData: any, sessionId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('编辑节点失败', () => this.api.post('/node/edit', nodeData, { params: { sessionId, userId } }));
  }

  deleteNode(sessionId: number, nodeId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('删除节点失败', () => this.api.post('/node/del', null, { params: { sessionId, nodeId, userId } }));
  }

  addLink(linkData: Partial<Link>, sessionId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('添加链路失败', () => this.api.post('/link/add', linkData, { params: { sessionId, userId } }));
  }

  deleteLink(linkData: Partial<Link>, sessionId: number, userId: string): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('删除链路失败', () => this.api.post('/link/del', linkData, { params: { sessionId, userId } }));
  }

  startSession(sessionId: number, userId: string, servers: any[], duration: number): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('启动会话失败', () => this.api.post('/start', servers, { params: { sessionId, userId, duration } }));
  }

  pauseSession(sessionId: number, userId: string, containerList: string[]): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('暂停会话失败', () => this.api.post('/pause', null, {
      params: { sessionId, userId, containerList },
      paramsSerializer: (params) => Object.keys(params).map((key) => `${key}=${params[key]}`).join('&'),
    }));
  }

  stopSession(sessionId: number): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('停止会话失败', () => this.api.post('/stop', null, { params: { sessionId } }));
  }

  startBroker(params: StartBrokerParams, sessionId: number): Promise<ApiResponse> {
    return this.request('启动监控失败', () => this.api.post('/startBroker', null, { params: { sessionId, ...params } }));
  }

  stopBroker(sessionId: number): Promise<ApiResponse> {
    return this.request('停止监控失败', () => this.api.post('/stopBroker', null, { params: { sessionId } }));
  }

  getNemIds(sessionId: number): Promise<ApiResponse> {
    return this.request('获取 NEM ID 失败', () => this.api.get('/node/nemId', { params: { sessionId } }));
  }

  getVMTemplates(): Promise<ApiResponse> {
    return this.request('get VM templates failed', () => this.api.get('/node/getVMTemplate'));
  }

  editVMNode(vmEditData: EditVMNodeParams): Promise<ApiResponse<TopoData>> {
    return this.request<TopoData>('edit VM node failed', () => this.api.post('/node/editVMNode', vmEditData));
  }

  getAllProtocols(sessionId: number, container: string): Promise<ApiResponse> {
    return this.routerRequest('get protocol configuration failed', () => this.routerApi.get('/router/slecteRouterConfig', {
      params: { sessionId, container },
    }));
  }

  insertRouterInfo(data: Record<string, any>): Promise<ApiResponse> {
    return this.routerRequest('save protocol configuration failed', () => this.routerApi.post('/router/insert', data));
  }

  cancelProtocol(sessionId: number): Promise<ApiResponse> {
    return this.routerRequest('reset protocol configuration failed', () => this.routerApi.get('/router/resetRouter', {
      params: { sessionId },
    }));
  }

  applyProtocol(sessionId: number): Promise<ApiResponse> {
    return this.routerRequest('apply protocol configuration failed', () => this.routerApi.get('/router/pushRouter', {
      params: { sessionId },
    }));
  }

  passiveMeasurement(data: any): Promise<ApiResponse> {
    return this.routerRequest('passive measurement command failed', () => this.routerApi.post('/measure/passive', data));
  }

  generateTDMA(data: GenerateTDMAParams): Promise<ApiResponse> {
    return this.request('generate TDMA schedule failed', () => this.api.post('/generateTDMA', data));
  }
}
