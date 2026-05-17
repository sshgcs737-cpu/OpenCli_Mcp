import request from '../request';

// 定义请求参数和响应数据的类型
export interface SceneListParams {
  pageNo: number;
  pageSize: number;
  name?: string;
  user?: string;
  userId?: string;
  ordinary?: number; // 1代表普通模式，2代表攻防模式
}

export interface SceneData {
  id: number;
  state: string;
  name: string;
  user: string;
  createTime: string;
  createUser: string;
  updateTime: string;
  updateUser: string;
  isPublic?: number; // 0代表私有，1代表公共
  ordinary?: number; // 1代表普通模式，2代表攻防模式
  session?: any;
}

export interface SceneCreateParams {
  name: string;
  userId: string; // 用户ID
  isPublic: number; // 0代表私有，1代表公共
  ordinary: number; // 1代表普通模式，2代表攻防模式
  disturb?: number;
}

export interface SceneUpdateParams {
  id: number;
  name?: string;
  state?: string;
  userId?: string; // 用户ID
  isPublic?: number; // 0代表私有，1代表公共
}

// 定义API响应类型
export interface ApiResponse<T = any> {
  code: number;
  msg: string | null;
  data: T;
}

// 定义分页响应数据类型
export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface startBrokerParams {
  duration: number;
  stepLength: number;
  mode: number;
}

// 添加快照相关的类型定义
export interface SnapshotData {
  id: number;
  sessionId: number;
  alias: string;
  updateTime: string;
}

export interface SaveSnapshotParams {
  sessionId: number;
  alias: string;
}

export interface RecoverySnapshotParams {
  snapId: number;
  sessionId: number;
}

export interface EditSessionParams {
  sessionId: number;
  name: string;
  isPublic: number;
}

export interface ServerInfo {
  name: string;
  host: string;
}

export interface PrivateSceneListParams {
  pageNo: number;
  pageSize: number;
  user: string;
  userId: string;
  name?: string;
  ordinary?: number; // 1代表普通模式，2代表攻防模式
}

// 定义录制历史记录类型
export interface RecordingHistory {
  id: number;
  sessionId: number;
  userChannel: string | null;
  startTime: string;
  endTime: string;
  brokerId: string;
  status: string;
}

// 获取场景列表
export function getSceneList(params: SceneListParams): Promise<ApiResponse<PageResult<SceneData>>> {
  return request({
    url: '/load',
    method: 'post',
    data: params
  });
}

// 获取私有场景列表
export function getPrivateSceneList(params: PrivateSceneListParams): Promise<ApiResponse<PageResult<SceneData>>> {
  return request({
    url: '/loadPrivate',
    method: 'post',
    data: params
  });
}

// 创建场景
export function createScene(data: SceneCreateParams): Promise<ApiResponse> {
  return request({
    url: '/create',
    method: 'post',
    data
  });
}

//克隆场景
export function copyScene(data: SceneCreateParams, copySessionId: number): Promise<ApiResponse> {
  return request({
    url: `/copySession`,
    method: 'post',
    params: { copySessionId },
    data
  });
}

// 更新场景
export function updateScene(data: SceneUpdateParams): Promise<ApiResponse> {
  return request({
    url: `/update/${data.id}`,
    method: 'put',
    data
  });
}

// 删除场景
export function deleteScene(sessionId: number): Promise<ApiResponse> {
  return request({
    url: '/delete',
    method: 'post',
    params: { sessionId }
  });
}

//强制关闭场景
export function closeScene(sessionId: number): Promise<ApiResponse> {
  return request({
    url: '/clearSession',
    method: 'get',
    params: { sessionId }
  });
}

// 批量删除场景
export function batchDeleteScene(sessionIds: number[]): Promise<ApiResponse> {
  return request({
    url: '/batchDelete',
    method: 'post',
    params: { sessionIds: sessionIds.join(',') }
  });
}

// 加载场景
export function loadScene(id: number): Promise<ApiResponse> {
  return request({
    url: `/loadScene/${id}`,
    method: 'get'
  });
}

// 获取全局拓扑数据
export function getTopoBySession(sessionId: number) {
  return request({
    url: '/topo',
    method: 'get',
    params: { sessionId }
  });
}

// 启动会话
export function startSession(sessionId: number, userId: string, data?: ServerInfo[], duration?: number): Promise<ApiResponse> {
  return request({
    url: '/start',
    method: 'post',
    params: { sessionId, userId, duration },    data
  });
}

// 停止会话
export function stopSession(sessionId: number): Promise<ApiResponse> {
  return request({
    url: '/stop',
    method: 'post',
    params: { sessionId }
  });
}

//暂停会话
export function pauseSession(sessionId: number, userId: string,containerList: string[]): Promise<ApiResponse> {
  return request({
    url: '/pause',
    method: 'post',
    params: { sessionId, userId, containerList },
    paramsSerializer: (params) => {
      return Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
    }
  });
}

// 保存会话
export function saveSession(sessionId: number, userId: string, sceneName: string, incrementalNumber: number): Promise<ApiResponse> {
  const alias = `${sceneName}-${incrementalNumber}`;
  return request({
    url: '/save',
    method: 'post',
    params: { sessionId, userId, alias }
  });
}

// 保存场景快照
export function saveSnapshot(params: SaveSnapshotParams): Promise<ApiResponse> {
  return request({
    url: '/save',
    method: 'post',
    params: {
      sessionId: params.sessionId,
      alias: params.alias
    }
  });
}

// 获取场景快照列表
export function getSnapshotList(sessionId: number): Promise<ApiResponse<SnapshotData[]>> {
  return request({
    url: '/snapshot',
    method: 'get',
    params: { sessionId }
  });
}

// 恢复场景快照
export function recoverySnapshot(params: RecoverySnapshotParams): Promise<ApiResponse> {
  return request({
    url: '/recovery',
    method: 'post',
    params: {
      snapId: params.snapId,
      sessionId: params.sessionId
    }
  });
}

export function startBroker(params: startBrokerParams, sessionId: number): Promise<ApiResponse> {
  return request({
    url: '/startBroker',
    method: 'post',
    params: { sessionId, ...params },
  });
}

export function stopBroker(sessionId: number): Promise<ApiResponse> {
  return request({
    url: '/stopBroker',
    method: 'post',
    params: { sessionId }
  });
}

// 编辑会话
export function editSession(data: EditSessionParams): Promise<ApiResponse> {
  return request({
    url: '/edit',
    method: 'post',
    data
  });
}

// 获取录制历史记录
export function getRecordHistory(sessionId: number): Promise<ApiResponse<RecordingHistory[]>> {
  return request({
    url: '/record/broker',
    method: 'get',
    params: { sessionId }
  });
}

// 获取录制时间戳
export function getRecordTimestamps(recordId: number): Promise<ApiResponse<number[]>> {
  return request({
    url: '/record/timestamp',
    method: 'get',
    params: { id: recordId }
  });
}

// 获取录制数据切片
export interface RecordSliceParams {
  brokerId: string;
  start: number;
  end: number;
}

export function getRecordSlice(params: RecordSliceParams): Promise<ApiResponse<any>> {
  return request({
    url: '/record/slice',
    method: 'get',
    params: {
      brokerId: params.brokerId,
      start: params.start,
      end: params.end
    }
  });
}

// 保存录制记录
export function saveRecord(id: number): Promise<ApiResponse> {
  return request({
    url: '/record/save',
    method: 'post',
    params: { id }
  });
}

// 子网模板相关类型定义
export interface TemplateConfigOption {
  label: string;
  name: string;
  value: string;
  type: number;
  select: string[];
  group: string;
}

export interface TemplateServiceData {
  executables: string[];
  dependencies: string[];
  dirs: string[];
  configs: string[];
  startup: string[];
  validate: string[];
  validationMode: string;
  validationTimer: number;
  shutdown: string[];
  meta: string;
}

export interface TemplateServiceConfig {
  nodeId: number;
  service: string;
  data: TemplateServiceData;
  files: Record<string, string>;
}

export interface TemplateConfigServiceConfig {
  nodeId: number;
  name: string;
  templates: Record<string, string>;
  config: Record<string, string>;
}

export interface TemplateEmaneConfig {
  ifaceId: number;
  model: string;
  config: Record<string, TemplateConfigOption>;
}

export interface TemplateNodeIface {
  id: number;
  name: string;
  mac: string;
  ip4: string;
  ip4_mask: number;
  ip6: string;
  ip6_mask: number;
  netId: number;
  flowId: number;
  mtu: number;
  node_id: number;
  net2_id: number;
}

export interface TemplateLinkOptions {
  jitter?: number;
  key?: number;
  mburst?: number;
  mer?: number;
  loss?: number;
  bandwidth?: number;
  burst?: number;
  delay?: number;
  dup?: number;
  unidirectional?: boolean;
  buffer?: number;
  mtu?: number;
}

export interface TemplateNode {
  id: number;
  name: string;
  alias: string;
  role: string;
  type: string;
  model: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  emane: string;
  icon: string;
  image: string;
  server: string;
  config_services: string[];
  geo: {
    lat: number;
    lon: number;
    alt: number;
  };
  dir: string;
  channel: string;
  canvas: number;
  wlan_config: Record<string, TemplateConfigOption>;
  mobility_config: Record<string, TemplateConfigOption>;
  service_configs: Record<string, TemplateServiceConfig>;
  config_cervice_configs: Record<string, TemplateConfigServiceConfig>;
  emane_configs: TemplateEmaneConfig[];
  status: string;
  phy_type: string;
}

export interface TemplateLink {
  node1_id: number;
  node2_id: number;
  type: string;
  iface1?: TemplateNodeIface;
  iface2?: TemplateNodeIface;
  options?: TemplateLinkOptions;
  network_id?: number;
}

export interface SubnetTemplateData {
  name: string; // 模板名称
  sessionId: number; // 会话ID
  nodes: TemplateNode[];
  links: TemplateLink[];
}

// 模板列表查询参数
export interface TemplateListParams {
  pageNo: number;
  pageSize: number;
}

// 模板列表项（简化版，用于列表显示）
export interface TemplateListItem {
  id?: number;
  name?: string; // 模板名称
  sessionId?: number; // 会话ID
  nodeCount?: number;
  linkCount?: number;
  createTime?: string;
  updateTime?: string;
  nodeJson: TemplateNode[]; // 后端返回的实际字段名
  linkJson: TemplateLink[]; // 后端返回的实际字段名
  routerJson?: any[]; // 路由配置信息
}

// 保存子网模板
export function addTemplate(data: SubnetTemplateData): Promise<ApiResponse> {
  return request({
    url: '/addTemplate',
    method: 'post',
    data,
  });
}

// 查询模板列表
export function listTemplate(params: TemplateListParams): Promise<ApiResponse<PageResult<TemplateListItem>>> {
  return request({
    url: '/listTemplate',
    method: 'post',
    data: params,
  });
}

// 删除组网模板
export function deleteTemplate(templateId: number): Promise<ApiResponse> {
  return request({
    url: '/delTemplate',
    method: 'post',
    params: { templateId },
  });
}
