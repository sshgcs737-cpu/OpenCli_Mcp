import { useTopoStore } from '@/store/modules/topo';
import { closeScene, createScene, getPrivateSceneList, getSceneList, getTopoBySession, pauseSession, startBroker, startSession, stopBroker, stopSession } from '@/api/scene';
import type { SceneData } from '@/api/scene';
import { getNemIds } from '@/api/node';
import { getOrdinaryValue, getUserInfo } from '@/store/user';
import { useNemIdStore } from '@/store/modules/nemId';
import eventBus from '@/utils/eventBus';
import router from '@/router';
import type { Link, LinkOptions, Node, NodeIface, TopoData } from '@/types/topo';
import type { OpenCliCommand, OpenCliNodeType, OpenCliResult, OpenCliRole } from './types';

const DEFAULT_CENTER = {
  lat: 30.523,
  lon: 114.364,
  alt: 200,
};

const prefixByType: Record<OpenCliNodeType, string> = {
  DRONE: 'DRONE',
  EMANE: 'EMANE',
  BASESTATION: 'BASESTATION',
  DEFAULT: 'ROUTER',
  VMNODE: 'VM',
  RJ45: 'PC',
  SWITCH: 'SWITCH',
  INODE: 'INODE',
  DOCKER: 'DOCKER',
};

function asApiMessage(response: any, fallback: string): string {
  return response?.msg || response?.message || fallback;
}

function getErrorMessage(error: any, fallback = '请求失败'): string {
  const data = error?.response?.data;

  if (typeof data === 'string') return data;

  return (
    data?.msg ||
    data?.message ||
    data?.error ||
    error?.msg ||
    error?.message ||
    fallback
  );
}

function assertApiOk(response: any, fallback: string): void {
  if (!response) {
    throw new Error(fallback);
  }

  if (typeof response.code !== 'undefined' && response.code !== 200) {
    throw new Error(asApiMessage(response, fallback));
  }
}

function normalizeDurationMs(duration?: number): number {
  // OpenCLI 里“时长=300”默认按秒理解；
  // 如果用户传入 300000，则认为已经是毫秒。
  const value = Number(duration || 300);

  if (!Number.isFinite(value) || value <= 0) {
    return 300000;
  }

  return value <= 24 * 60 * 60 ? value * 1000 : value;
}

function buildMonitorParams(duration?: number) {
  const durationMs = normalizeDurationMs(duration);

  return {
    duration: durationMs,
    stepLength: 1000,
    mode: 0,
    durationMinutes: Math.max(1, Math.round(durationMs / 60000)),
    endTime: new Date(Date.now() + durationMs),
  };
}

function hasEmaneNodes(topo: TopoData): boolean {
  return Array.isArray(topo.nodes) && topo.nodes.some((node: any) => node.type === 'EMANE');
}

async function cacheNemIdsIfNeeded(topo: TopoData): Promise<string> {
  if (!hasEmaneNodes(topo)) {
    return '当前场景没有 EMANE 节点，已跳过 NEM ID 获取。';
  }

  try {
    const response: any = await getNemIds(topo.id);

    if (response?.code === 200 && response?.data) {
      const nemIdStore = useNemIdStore();
      nemIdStore.setNemIds(response.data.sessionId, response.data.nemIds || []);
      return '已获取并缓存 NEM ID。';
    }

    return `获取 NEM ID 未成功：${asApiMessage(response, '后端未返回有效 NEM ID 数据')}`;
  } catch (error: any) {
    return `获取 NEM ID 失败，但不影响仿真启动流程继续：${getErrorMessage(error)}`;
  }
}

function commandHelp(): OpenCliResult {
  return {
    ok: true,
    message: [
      'OpenCLI 全局后端模式：命令会调用项目现有后端接口，并刷新 topoStore。',
      '',
      '场景命令可在 /simu 和 /viewer 内直接使用；拓扑命令需要先加载场景。',
      '',
      '可用命令：',
      '场景列表',
      '私有场景列表',
      '公共场景列表',
      '加载场景 12',
      '切换到 OpenCLI测试',
      '当前场景',
      '打开态势',
      '退出当前场景',
      '关闭场景 12',
      '新建场景 名为 OpenCLI测试',
      '刷新拓扑',
      '仿真检查',
      '演示场景',
      '添加无人机 名为 DRONE1 在 30.523,114.364,300',
      '生成 3 架无人机 在 30.523,114.364 高度 300',
      '批量添加无人机 DRONE1 DRONE2 DRONE3',
      '添加无线子网 名为 EMANE1 在 lat=30.526 lon=114.366 alt=100',
      '连接 DRONE1 EMANE1',
      '批量连接 DRONE1-EMANE1 DRONE2-EMANE1',
      '移动 DRONE1 到 lat=30.53 lon=114.37 alt=500',
      '故障 DRONE1',
      '恢复 DRONE1',
      '删除 DRONE1',
      '批量删除节点 DRONE1 DRONE2 EMANE1',
      '批量删除链路 DRONE1-EMANE1 DRONE2-EMANE1',
      '清空场景',
      '查看节点',
      '查看链路',
      '启动仿真 时长=300',
      '暂停仿真',
      '停止仿真',
      '导出',
    ].join('\n'),
  };
}

function getCurrentUserId(): string {
  const userInfo = getUserInfo();
  return userInfo.id || '';
}

type SceneScope = 'private' | 'public' | 'all';
type OpenCliScene = SceneData & { scopeLabel?: string };

function getSceneId(scene: OpenCliScene): number {
  return Number(scene.id || (scene as any).sessionId || (scene as any).session?.id || 0);
}

function getSceneName(scene: OpenCliScene): string {
  return scene.name || (scene as any).session?.name || `场景${getSceneId(scene)}`;
}

function sceneRecords(response: any, scopeLabel: string): OpenCliScene[] {
  if (!response || response.code !== 200 || !response.data) {
    return [];
  }

  const records = Array.isArray(response.data.records)
    ? response.data.records
    : Array.isArray(response.data)
      ? response.data
      : [];

  return records
    .map((scene: SceneData) => ({ ...scene, scopeLabel }))
    .filter((scene: OpenCliScene) => getSceneId(scene));
}

async function fetchScenes(scope: SceneScope = 'all', name?: string): Promise<OpenCliScene[]> {
  const userInfo = getUserInfo();
  const ordinary = getOrdinaryValue();
  const requests: Array<Promise<OpenCliScene[]>> = [];

  if (scope !== 'public') {
    requests.push(
      getPrivateSceneList({
        pageNo: 1,
        pageSize: 50,
        user: userInfo.username || '',
        userId: userInfo.id || '',
        name,
        ordinary,
      }).then((response) => sceneRecords(response, '私有'))
    );
  }

  if (scope !== 'private') {
    requests.push(
      getSceneList({
        pageNo: 1,
        pageSize: 50,
        name,
        ordinary,
      }).then((response) => sceneRecords(response, '公共'))
    );
  }

  const settled = await Promise.allSettled(requests);
  const scenes: OpenCliScene[] = [];
  const errors: string[] = [];

  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      scenes.push(...result.value);
    } else {
      errors.push(getErrorMessage(result.reason, '获取场景列表失败'));
    }
  });

  if (scenes.length === 0 && errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const byId = new Map<number, OpenCliScene>();
  scenes.forEach((scene) => {
    const id = getSceneId(scene);
    if (!byId.has(id)) {
      byId.set(id, scene);
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.updateTime || a.createTime || 0).getTime();
    const bTime = new Date(b.updateTime || b.createTime || 0).getTime();
    return bTime - aTime;
  });
}

function summarizeScenes(scenes: OpenCliScene[]): string {
  if (scenes.length === 0) {
    return '没有找到匹配的场景。';
  }

  const topoStore = useTopoStore();
  const currentId = Number(topoStore.currentSessionId || topoStore.topoData?.id || 0);
  const lines = scenes.slice(0, 30).map((scene) => {
    const id = getSceneId(scene);
    const current = currentId === id ? ' 当前' : '';
    const state = scene.state || (scene as any).session?.state || 'UNKNOWN';
    const updated = scene.updateTime || scene.createTime || '';
    return `#${id} ${getSceneName(scene)} [${scene.scopeLabel || '场景'}] state=${state}${current}${updated ? ` updated=${updated}` : ''}`;
  });

  if (scenes.length > 30) {
    lines.push(`... 还有 ${scenes.length - 30} 个场景未显示，可用“场景列表 名为 关键词”缩小范围。`);
  }

  return lines.join('\n');
}

async function resolveSceneId(command: Extract<OpenCliCommand, { kind: 'loadScene' | 'closeScene' }>): Promise<number> {
  if (command.sessionId) {
    return Number(command.sessionId);
  }

  const name = command.name?.trim();
  if (!name) {
    throw new Error('需要提供场景 ID 或名称。');
  }

  const scenes = await fetchScenes('all', name);
  const exact = scenes.filter((scene) => getSceneName(scene) === name);
  const candidates = exact.length > 0
    ? exact
    : scenes.filter((scene) => getSceneName(scene).includes(name));

  if (candidates.length === 0) {
    throw new Error(`没有找到名为“${name}”的场景。可先输入：场景列表`);
  }

  if (candidates.length > 1) {
    throw new Error(`找到多个匹配场景，请改用 ID 加载：\n${summarizeScenes(candidates)}`);
  }

  return getSceneId(candidates[0]);
}

function notifySceneLoaded(topo: TopoData): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('scene-loaded', {
    detail: { name: topo.name || `场景${topo.id}` },
  }));
}

function notifyTopoChanged(): void {
  try {
    eventBus.emit('topoDataUpdated');
  } catch (error) {
    console.warn('[OpenCLI] 通知态势刷新失败：', error);
  }
}

function notifyLifecycleChanged(payload: {
  status: 'loaded' | 'started' | 'paused' | 'stopped' | 'closed' | 'refreshed';
  sessionId?: number;
  duration?: number;
  stepLength?: number;
  mode?: number;
}): void {
  try {
    (eventBus as any).emit('opencli:simulationLifecycle', payload);
  } catch (error) {
    console.warn('[OpenCLI] 通知生命周期变化失败：', error);
  }
}

function notifySceneListChanged(payload: {
  action: 'created' | 'updated' | 'deleted';
  sceneId?: number;
  name?: string;
  scope?: 'private' | 'public';
}): void {
  try {
    eventBus.emit('opencli:sceneListChanged', payload);
  } catch (error) {
    console.warn('[OpenCLI] 通知场景列表刷新失败：', error);
  }
}

function tryParseJson(value: any): any {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isTopoData(value: any): value is TopoData {
  // 后端在空场景时可能返回 nodes: null、links: null，
  // 所以这里只判断它是不是 topo 对象，数组兜底交给 normalizeTopoArrays。
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.id !== 'undefined'
  );
}

function normalizeTopoArrays(topo: TopoData): TopoData {
  return {
    ...topo,
    nodes: Array.isArray(topo.nodes) ? topo.nodes : [],
    links: Array.isArray(topo.links) ? topo.links : [],
  };
}

function summarizeTopoCounts(topo?: Pick<TopoData, 'nodes' | 'links'> | null) {
  const nodes = Array.isArray(topo?.nodes) ? topo.nodes : [];
  const links = Array.isArray(topo?.links) ? topo.links : [];
  const subnetCount = nodes.filter((node: any) => String(node?.type || '').toUpperCase() === 'EMANE').length;
  const nodeCount = nodes.filter((node: any) => {
    const type = String(node?.type || '');
    return type.toLowerCase() !== 'inode' && type.toUpperCase() !== 'EMANE';
  }).length;

  return {
    subnetCount,
    nodeCount,
    linkCount: links.length,
  };
}

function formatTopoCounts(topo?: Pick<TopoData, 'nodes' | 'links'> | null): string {
  const counts = summarizeTopoCounts(topo);
  return `子网 ${counts.subnetCount} 个，节点 ${counts.nodeCount} 个，链路 ${counts.linkCount} 条`;
}

function normalizeTopoResponse(response: any): TopoData | null {
  console.log('[OpenCLI] topo 原始返回：', response);

  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.data?.topo,
    response?.data?.topology,
    response?.topo,
    response?.topology,
    response?.result,
    response?.result?.data,
    response?.result?.topo,
  ].map(tryParseJson);

  for (const item of candidates) {
    if (isTopoData(item)) {
      return normalizeTopoArrays(item);
    }
  }

  return null;
}

function findCachedTopoBySessionId(sessionId: number): TopoData | null {
  const keys = Object.keys(localStorage).filter((key) => key.includes('topo-store'));

  for (const key of keys) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      const topo = value?.topoData;

      if (isTopoData(topo) && Number(topo.id) === Number(sessionId)) {
        console.log('[OpenCLI] 使用 localStorage 缓存 topo：', key, topo);
        return normalizeTopoArrays(topo);
      }
    } catch {
      // 忽略损坏缓存
    }
  }

  return null;
}

async function refreshTopo(sessionId?: number): Promise<TopoData> {
  const topoStore = useTopoStore();
  const targetSessionId = sessionId ?? topoStore.currentSessionId ?? topoStore.topoData?.id;

  if (!targetSessionId) {
    throw new Error('当前没有加载场景。请先在场景列表加载一个场景，或输入：新建场景 名为 OpenCLI测试');
  }

  let response: any = null;
  let topo: TopoData | null = null;

  try {
    response = await getTopoBySession(Number(targetSessionId));
    topo = normalizeTopoResponse(response);
  } catch (error) {
    console.warn('[OpenCLI] 后端 topo 接口请求失败，准备使用缓存 topo：', error);
  }

  const cachedTopo =
    topoStore.topoData?.id === Number(targetSessionId)
      ? topoStore.topoData
      : findCachedTopoBySessionId(Number(targetSessionId));

  const finalTopo = topo || cachedTopo;

  if (!finalTopo) {
    throw new Error(asApiMessage(response, '刷新拓扑失败：后端没有返回有效 topo 数据，且本地也没有缓存 topo'));
  }

  const finalSessionId = Number(finalTopo.id || targetSessionId);
  const previousSessionId = Number(topoStore.currentSessionId || topoStore.topoData?.id || 0);
  const sceneName =
    finalTopo.name ||
    (previousSessionId === finalSessionId ? topoStore.currentSessionName : null) ||
    `\u573a\u666f${finalSessionId}`;

  topoStore.$patch({
    currentSessionId: finalSessionId,
    currentSessionName: sceneName,
    topoData: normalizeTopoArrays({ ...finalTopo, id: finalSessionId }),
  });

  return finalTopo;
}

async function refreshTopoAndNotify(sessionId?: number, status: 'loaded' | 'refreshed' = 'refreshed'): Promise<TopoData> {
  const topo = await refreshTopo(sessionId);
  notifyTopoChanged();
  notifyLifecycleChanged({ status, sessionId: Number(topo.id) });
  return topo;
}

const FORCE_CLOSE_STATES = new Set(['CONFIGURATION', 'RUNTIME', 'INSTANTIATION']);

function normalizeSceneState(state?: string | null): string | undefined {
  const normalized = String(state || '').trim().toUpperCase();
  return normalized || undefined;
}

async function getSceneStateById(sessionId: number): Promise<string | undefined> {
  const topoStore = useTopoStore();
  const currentId = Number(topoStore.currentSessionId || topoStore.topoData?.id || 0);

  if (currentId === Number(sessionId)) {
    const currentState = normalizeSceneState(topoStore.topoData?.state);
    if (currentState) return currentState;
  }

  try {
    const scenes = await fetchScenes('all');
    const matched = scenes.find((scene) => getSceneId(scene) === Number(sessionId));
    return normalizeSceneState(matched?.state || (matched as any)?.session?.state);
  } catch (error) {
    console.warn('[OpenCLI] 获取场景状态失败，继续按后端接口处理：', error);
    return undefined;
  }
}

function patchCurrentSceneState(sessionId: number, state: string): void {
  const topoStore = useTopoStore();
  const currentId = Number(topoStore.currentSessionId || topoStore.topoData?.id || 0);

  if (currentId !== Number(sessionId) || !topoStore.topoData) return;

  topoStore.$patch({
    topoData: {
      ...topoStore.topoData,
      state,
    },
  });

  notifyTopoChanged();
}

async function requireLoadedTopo(): Promise<TopoData> {
  const topoStore = useTopoStore();

  if (topoStore.topoData?.id) {
    topoStore.topoData.nodes = Array.isArray(topoStore.topoData.nodes)
      ? topoStore.topoData.nodes
      : [];

    topoStore.topoData.links = Array.isArray(topoStore.topoData.links)
      ? topoStore.topoData.links
      : [];

    return topoStore.topoData;
  }

  return refreshTopo();
}

function nextNodeId(nodes: Node[]): number {
  return nodes.length ? Math.max(...nodes.map((node) => Number(node.id) || 0)) + 1 : 1;
}

function nextNodeName(type: OpenCliNodeType, nodes: Node[], customName?: string): string {
  if (customName) return customName;
  const prefix = prefixByType[type] || 'NODE';
  let index = 1;
  while (nodes.some((node) => node.name === `${prefix}${index}` || node.alias === `${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

function toBackendNodeType(type: OpenCliNodeType): { type: string; model: string; image: string } {
  switch (type) {
    case 'DRONE':
      return { type: 'DRONE', model: 'prouter', image: '' };
    case 'BASESTATION':
      return { type: 'BASESTATION', model: 'prouter', image: '' };
    case 'DEFAULT':
      return { type: 'DEFAULT', model: 'router', image: '' };
    case 'DOCKER':
      return { type: 'DOCKER', model: '', image: 'nest:v3' };
    default:
      return { type, model: '', image: '' };
  }
}

function getRole(commandRole?: OpenCliRole): OpenCliRole {
  if (commandRole) return commandRole;
  const userInfo = getUserInfo();
  if (userInfo.role === 'red') return 2;
  if (userInfo.role === 'blue') return 3;
  return 1;
}

function getDefaultServerName(topo: TopoData): string {
  const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
  const firstServer = servers[0];
  return firstServer?.name || firstServer?.host || '';
}

function summarizeNodesWithoutServer(nodes: Node[]): string {
  return nodes
    .slice(0, 8)
    .map((node) => node.alias || node.name || `#${node.id}`)
    .join('、');
}

type SimulationPreflightResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  info: string[];
  topo?: TopoData;
  servers: any[];
  nodesWithoutServer: Node[];
};

function isRuntimeState(state?: string): boolean {
  return ['RUNTIME', 'RUNNING', 'INSTANTIATION'].includes(normalizeSceneState(state) || '');
}

function formatPreflight(preflight: SimulationPreflightResult): string {
  const topo = preflight.topo;
  const lines: string[] = [];

  lines.push(preflight.ok ? '仿真检查通过。' : '仿真检查未通过。');

  if (topo) {
    const counts = summarizeTopoCounts(topo);
    lines.push(`场景：${topo.name || `场景${topo.id}`}，ID=${topo.id}，状态=${topo.state || 'UNKNOWN'}`);
    lines.push(`子网=${counts.subnetCount}，节点=${counts.nodeCount}，链路=${counts.linkCount}，服务器=${preflight.servers.length}`);
  }

  if (preflight.blockers.length > 0) {
    lines.push('');
    lines.push('阻塞项：');
    lines.push(...preflight.blockers.map((item) => `- ${item}`));
  }

  if (preflight.warnings.length > 0) {
    lines.push('');
    lines.push('提示项：');
    lines.push(...preflight.warnings.map((item) => `- ${item}`));
  }

  if (preflight.info.length > 0) {
    lines.push('');
    lines.push('信息：');
    lines.push(...preflight.info.map((item) => `- ${item}`));
  }

  return lines.join('\n');
}

async function runSimulationPreflight(): Promise<SimulationPreflightResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const userId = getCurrentUserId();
  let topo: TopoData | undefined;

  if (!userId) {
    blockers.push('当前没有登录用户 ID，后端 /start 需要 userId。');
  }

  try {
    const loadedTopo = normalizeTopoArrays(await requireLoadedTopo());
    topo = normalizeTopoArrays(await refreshTopo(Number(loadedTopo.id)));
  } catch (error: any) {
    blockers.push(getErrorMessage(error, '当前没有可用拓扑数据。'));
  }

  const servers = topo && Array.isArray((topo as any).servers) ? (topo as any).servers : [];
  const nodes = topo?.nodes || [];
  const links = topo?.links || [];
  const nodesWithoutServer = nodes.filter((node: any) => !String(node.server || '').trim());

  if (topo) {
    if (!topo.id) {
      blockers.push('当前拓扑没有有效 sessionId。');
    }

    if (nodes.length === 0) {
      blockers.push('当前场景没有节点，启动仿真没有可执行对象。');
    }

    if (servers.length === 0) {
      blockers.push('当前场景没有服务器配置。');
    }

    if (servers.length > 0 && nodesWithoutServer.length > 0) {
      warnings.push(`有 ${nodesWithoutServer.length} 个节点未分配服务器：${summarizeNodesWithoutServer(nodesWithoutServer)}。启动前会自动分配到 ${servers[0]?.name || servers[0]?.host}。`);
    }

    if (links.length === 0 && nodes.length > 1) {
      warnings.push('当前场景没有链路，仿真可启动但拓扑连通性可能不符合预期。');
    }

    if (isRuntimeState(topo.state)) {
      blockers.push(`当前场景状态为 ${topo.state}，已经处于运行或实例化阶段，请勿重复启动。`);
    }

    info.push(hasEmaneNodes(topo) ? '检测到 EMANE 节点，启动后会尝试获取 NEM ID。' : '未检测到 EMANE 节点，将跳过 NEM ID 获取。');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    info,
    topo,
    servers,
    nodesWithoutServer,
  };
}

async function assignMissingServers(topo: TopoData, nodesWithoutServer: Node[]): Promise<number> {
  const server = getDefaultServerName(topo);
  if (!server || nodesWithoutServer.length === 0) return 0;

  let updatedCount = 0;
  const topoStore = useTopoStore();

  for (const node of nodesWithoutServer) {
    await topoStore.editNodeRemote({ ...node, server });
    updatedCount += 1;
  }

  await refreshTopoAndNotify(topo.id);
  return updatedCount;
}

async function makeNodeData(params: {
  nodeType: OpenCliNodeType;
  name?: string;
  lat?: number;
  lon?: number;
  alt?: number;
  role?: OpenCliRole;
}): Promise<any> {
  const topo = await requireLoadedTopo();
  const nodes = topo.nodes ?? [];
  const id = nextNodeId(nodes);
  const name = nextNodeName(params.nodeType, nodes, params.name);
  const backend = toBackendNodeType(params.nodeType);
  const server = getDefaultServerName(topo);

  return {
    id,
    name,
    type: backend.type,
    model: backend.model,
    image: backend.image,
    geo: {
      lon: params.lon ?? DEFAULT_CENTER.lon,
      lat: params.lat ?? DEFAULT_CENTER.lat,
      alt: Number(params.alt ?? DEFAULT_CENTER.alt),
    },
    role: getRole(params.role),
    status: 'UP',
    alias: name,
    server,
  };
}

function findNode(target: string): Node | undefined {
  const topoStore = useTopoStore();
  const normalized = target.trim().toLowerCase();

  const nodes = Array.isArray(topoStore.topoData?.nodes)
    ? topoStore.topoData.nodes
    : [];

  return nodes.find((node) => {
    return String(node.id) === normalized ||
      node.name?.toLowerCase() === normalized ||
      node.alias?.toLowerCase() === normalized;
  });
}

function defaultOptions(): LinkOptions {
  return {
    jitter: 0,
    key: 0,
    mburst: 0,
    mer: 0,
    loss: 0,
    bandwidth: 0,
    burst: 0,
    delay: 0,
    dup: 0,
    unidirectional: true,
    buffer: 0,
    mtu: 0,
  };
}

function getNodeInterfaces(links: Link[], nodeId: number): NodeIface[] {
  const interfaces: NodeIface[] = [];
  links.forEach((link) => {
    if (link.iface1?.node_id === nodeId) interfaces.push(link.iface1);
    if (link.iface2?.node_id === nodeId) interfaces.push(link.iface2);
  });
  return interfaces;
}

function getNextAvailableId(interfaces: NodeIface[]): number {
  const usedIds = interfaces.map((iface) => iface.id).filter((id) => Number.isFinite(id));
  let nextId = 0;
  while (usedIds.includes(nextId)) nextId += 1;
  return nextId;
}

function createIface(nodeId: number, links: Link[]): NodeIface {
  const ifaceId = getNextAvailableId(getNodeInterfaces(links, nodeId));
  return {
    id: ifaceId,
    name: `eth${ifaceId}`,
    mac: '',
    ip4: '',
    ip4_mask: 24,
    ip6: '',
    ip6_mask: 64,
    netId: 0,
    flowId: 0,
    mtu: 0,
    node_id: nodeId,
    net2_id: 0,
  };
}

function determineLinkType(node1: Node, node2: Node, preferred?: 'WIRED' | 'WIRELESS'): 'WIRED' | 'WIRELESS' {
  if (preferred) return preferred;
  if (node1.type === 'EMANE' || node2.type === 'EMANE') return 'WIRELESS';
  if (node1.type === 'DRONE' || node2.type === 'DRONE') return 'WIRELESS';
  return 'WIRED';
}

function makeLinkData(node1: Node, node2: Node, preferredType?: 'WIRED' | 'WIRELESS'): Partial<Link> {
  const topoStore = useTopoStore();
  const links = topoStore.topoData?.links ?? [];
  const type = determineLinkType(node1, node2, preferredType);
  const linkData: Partial<Link> = {
    node1_id: node1.id,
    node2_id: node2.id,
    type,
    options: defaultOptions(),
    network_id: 0,
  };

  if (node1.type !== 'EMANE') linkData.iface1 = createIface(node1.id, links);
  if (node2.type !== 'EMANE') linkData.iface2 = createIface(node2.id, links);

  const emaneNode = node1.type === 'EMANE' ? node1 : node2.type === 'EMANE' ? node2 : null;
  if (emaneNode) {
    linkData.network_id = emaneNode.id;
    const nonEmaneIface = node1.type === 'EMANE' ? linkData.iface2 : linkData.iface1;
    if (nonEmaneIface) {
      const emaneIndex = (topoStore.topoData?.nodes ?? []).filter((node) => node.type === 'EMANE').findIndex((node) => node.id === emaneNode.id);
      const baseIp = `${(Math.max(emaneIndex, 0) + 1) * 10}.0.0`;
      const count = links.filter((link) => link.node1_id === emaneNode.id || link.node2_id === emaneNode.id).length;
      nonEmaneIface.ip4 = `${baseIp}.${count + 1}`;
      nonEmaneIface.net2_id = emaneNode.id;
    }
  }

  return linkData;
}

function summarizeNodes(nodes: Node[]): string {
  if (nodes.length === 0) return '当前场景没有节点。';
  return nodes.map((node) => {
    const alias = node.alias || node.name;
    const geo = node.geo ? `(${node.geo.lat}, ${node.geo.lon}, ${node.geo.alt})` : '(无坐标)';
    return `#${node.id} ${alias} type=${node.type} status=${node.status || 'UP'} geo=${geo}`;
  }).join('\n');
}

function summarizeLinks(links: Link[]): string {
  if (links.length === 0) return '当前场景没有链路。';
  return links.map((link, index) => {
    return `${index + 1}. ${link.node1_id} <-> ${link.node2_id} type=${link.type} network=${link.network_id ?? 0}`;
  }).join('\n');
}

function nodeLabel(node?: Node | null): string {
  if (!node) return 'UNKNOWN';
  return node.alias || node.name || `#${node.id}`;
}

function linkLabel(link: Pick<Link, 'node1_id' | 'node2_id'>): string {
  const from = findNode(String(link.node1_id));
  const to = findNode(String(link.node2_id));
  return `${nodeLabel(from)}-${nodeLabel(to)}`;
}

function findLinkBetween(from: Node, to: Node): Link | undefined {
  const topoStore = useTopoStore();
  const links = Array.isArray(topoStore.topoData?.links) ? topoStore.topoData.links : [];
  return links.find((link) =>
    (link.node1_id === from.id && link.node2_id === to.id) ||
    (link.node1_id === to.id && link.node2_id === from.id)
  );
}

function isEmaneLink(link: Pick<Link, 'node1_id' | 'node2_id'>, nodes: Node[]): boolean {
  const node1 = nodes.find((node) => node.id === link.node1_id);
  const node2 = nodes.find((node) => node.id === link.node2_id);
  return Boolean(node1 && node2 && (node1.type === 'EMANE' || node2.type === 'EMANE'));
}

async function addLinkPair(fromTarget: string, toTarget: string, linkType?: 'WIRED' | 'WIRELESS'): Promise<string> {
  await requireLoadedTopo();
  const topoStore = useTopoStore();
  const from = findNode(fromTarget);
  const to = findNode(toTarget);

  if (!from || !to) {
    throw new Error(`找不到节点：${!from ? fromTarget : toTarget}`);
  }

  if (from.id === to.id) {
    throw new Error(`不能连接同一个节点：${nodeLabel(from)}`);
  }

  if (findLinkBetween(from, to)) {
    throw new Error(`链路已存在：${nodeLabel(from)}-${nodeLabel(to)}`);
  }

  const linkData = makeLinkData(from, to, linkType);
  await topoStore.addLinkRemote(linkData);
  await refreshTopoAndNotify();
  return `${nodeLabel(from)}-${nodeLabel(to)}`;
}

async function deleteLinkPair(fromTarget: string, toTarget: string): Promise<string> {
  await requireLoadedTopo();
  const topoStore = useTopoStore();
  const from = findNode(fromTarget);
  const to = findNode(toTarget);

  if (!from || !to) {
    throw new Error(`找不到节点：${!from ? fromTarget : toTarget}`);
  }

  const link = findLinkBetween(from, to);
  if (!link) {
    throw new Error(`找不到链路：${nodeLabel(from)}-${nodeLabel(to)}`);
  }

  await topoStore.deleteLinkRemote(link);
  await refreshTopoAndNotify();
  return `${nodeLabel(from)}-${nodeLabel(to)}`;
}

function formatBatchResult(title: string, success: string[], failed: string[], skipped: string[] = []): OpenCliResult {
  const lines = [
    `${title}：成功 ${success.length} 项，失败 ${failed.length} 项${skipped.length ? `，跳过 ${skipped.length} 项` : ''}。`,
  ];

  if (success.length > 0) lines.push(`成功：${success.join('、')}`);
  if (skipped.length > 0) lines.push(`跳过：${skipped.join('、')}`);
  if (failed.length > 0) lines.push(`失败：${failed.join('；')}`);

  return {
    ok: failed.length === 0,
    message: lines.join('\n'),
    data: { success, failed, skipped },
  };
}

async function clearTopologyElements(): Promise<OpenCliResult> {
  const topoStore = useTopoStore();
  const topo = normalizeTopoArrays(await requireLoadedTopo());

  if (isRuntimeState(topo.state)) {
    return {
      ok: false,
      message: `当前场景状态为 ${topo.state}，请先停止/关闭仿真后再清空节点、链路和子网。`,
    };
  }

  const beforeCounts = summarizeTopoCounts(topo);
  const deletedLinks: string[] = [];
  const skippedLinks: string[] = [];
  const failedLinks: string[] = [];

  for (const link of topo.links) {
    if (isEmaneLink(link, topo.nodes)) {
      skippedLinks.push(`${link.node1_id}-${link.node2_id}`);
      continue;
    }

    try {
      await topoStore.deleteLinkRemote(link);
      deletedLinks.push(linkLabel(link));
    } catch (error: any) {
      failedLinks.push(`${link.node1_id}-${link.node2_id}: ${getErrorMessage(error)}`);
    }
  }

  await refreshTopoAndNotify(topo.id);

  const refreshedTopo = normalizeTopoArrays(await requireLoadedTopo());
  const nodesToDelete = [...refreshedTopo.nodes].sort((a, b) => {
    if (a.type === 'EMANE' && b.type !== 'EMANE') return 1;
    if (a.type !== 'EMANE' && b.type === 'EMANE') return -1;
    return Number(a.id) - Number(b.id);
  });

  const deletedNodes: string[] = [];
  const failedNodes: string[] = [];

  for (const node of nodesToDelete) {
    try {
      await topoStore.removeNodeRemote(node.id);
      deletedNodes.push(nodeLabel(node));
    } catch (error: any) {
      failedNodes.push(`${nodeLabel(node)}: ${getErrorMessage(error)}`);
    }
  }

  await refreshTopoAndNotify(topo.id);

  const failed = [...failedLinks, ...failedNodes];
  const lines = [
    `已清空场景拓扑：原有子网 ${beforeCounts.subnetCount} 个，节点 ${beforeCounts.nodeCount} 个，链路 ${beforeCounts.linkCount} 条。`,
    `已删除链路 ${deletedLinks.length} 条，已删除节点/子网 ${deletedNodes.length} 个。`,
  ];

  if (skippedLinks.length > 0) {
    lines.push(`跳过 ${skippedLinks.length} 条子网关联链路；这些链路会随节点/子网删除一起清理。`);
  }

  if (failed.length > 0) {
    lines.push(`失败：${failed.join('；')}`);
  }

  return {
    ok: failed.length === 0,
    message: lines.join('\n'),
    data: { deletedLinks, skippedLinks, deletedNodes, failed },
  };
}

async function exitCurrentScene(): Promise<OpenCliResult> {
  const topoStore = useTopoStore();
  const hadScene = Boolean(
    topoStore.currentSessionId ||
    topoStore.topoData?.id ||
    topoStore.topoData?.nodes?.length ||
    topoStore.topoData?.links?.length
  );

  eventBus.emit('stopSimulation');
  topoStore.clearTopoData();
  eventBus.emit('exitCurrentScene');
  notifyTopoChanged();
  notifyLifecycleChanged({ status: 'closed' });

  if (router.currentRoute.value.path !== '/simu/view') {
    await router.replace('/simu/view');
  }

  return {
    ok: true,
    message: hadScene ? '已退出当前场景，并返回场景列表。' : '当前没有加载场景，已返回场景列表。',
  };
}

async function createBackendScene(name?: string): Promise<OpenCliResult> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('还没有登录用户信息。请先正常登录系统。');

  const sceneName = name || `OpenCLI场景-${new Date().toLocaleString()}`;
  const response: any = await createScene({
    name: sceneName,
    userId,
    isPublic: 0,
    ordinary: getOrdinaryValue(),
    disturb: getUserInfo().disturb ?? 0,
  });

  if (response?.code !== 200) {
    throw new Error(asApiMessage(response, '新建场景失败'));
  }

  const newSessionId = response?.data?.id || response?.data?.session?.id || response?.data?.sessionId || response?.id;
  notifySceneListChanged({
    action: 'created',
    sceneId: newSessionId ? Number(newSessionId) : undefined,
    name: sceneName,
    scope: 'private',
  });

  if (newSessionId) {
    const topo = await refreshTopoAndNotify(Number(newSessionId), 'loaded');
    return { ok: true, message: `已新建并加载场景：${sceneName}，ID=${newSessionId}，${formatTopoCounts(topo)}` };
  }

  return { ok: true, message: `已新建场景：${sceneName}。后端未返回场景 ID，请到“仿真场景编辑”列表里加载该场景。`, data: response };
}

export async function executeRemoteTopoCommand(command: OpenCliCommand): Promise<OpenCliResult> {
  const topoStore = useTopoStore();

  switch (command.kind) {
    case 'help':
      return commandHelp();

    case 'listScenes': {
      const scenes = await fetchScenes(command.scope || 'all', command.name);
      return { ok: true, message: summarizeScenes(scenes), data: scenes };
    }

    case 'currentScene': {
      const currentId = topoStore.currentSessionId || topoStore.topoData?.id;
      if (!currentId) {
        return { ok: false, message: '当前没有加载场景。可以输入：场景列表，然后输入：加载场景 12' };
      }

      const topo = topoStore.topoData;
      const counts = summarizeTopoCounts(topo);
      return {
        ok: true,
        message: [
          `当前场景：${topo?.name || topoStore.currentSessionName || `场景${currentId}`}`,
          `ID=${currentId}`,
          `状态=${topo?.state || 'UNKNOWN'}`,
          `子网=${counts.subnetCount}`,
          `节点=${counts.nodeCount}`,
          `链路=${counts.linkCount}`,
        ].join('\n'),
        data: topo,
      };
    }

    case 'simulationCheck': {
      const preflight = await runSimulationPreflight();
      return {
        ok: preflight.ok,
        message: formatPreflight(preflight),
        data: preflight,
      };
    }

    case 'openViewer': {
      if (router.currentRoute.value.path !== '/viewer' || router.currentRoute.value.query.mode === 'playback') {
        await router.push('/viewer');
      }

      return { ok: true, message: '已打开态势展示。' };
    }

    case 'exitCurrentScene':
      return exitCurrentScene();

    case 'initScene':
      return createBackendScene(command.name);

    case 'loadScene': {
      const sessionId = await resolveSceneId(command);
      const topo = await refreshTopoAndNotify(sessionId, 'loaded');
      notifySceneLoaded(topo);
      return { ok: true, message: `已加载场景：${topo.name || `场景${sessionId}`}，ID=${sessionId}，${formatTopoCounts(topo)}。\n输入“打开态势”可进入 /viewer。` };
    }

    case 'closeScene': {
      const sessionId = await resolveSceneId(command);
      const sceneState = await getSceneStateById(sessionId);

      if (sceneState && !FORCE_CLOSE_STATES.has(sceneState)) {
        patchCurrentSceneState(sessionId, sceneState);
        notifyLifecycleChanged({ status: 'closed', sessionId });
        return {
          ok: true,
          message: `场景 ID=${sessionId} 当前状态为 ${sceneState}，无需调用强制关闭接口。`,
        };
      }

      try {
        const response: any = await closeScene(sessionId);
        assertApiOk(response, '关闭场景失败');
      } catch (error: any) {
        const latestState = await getSceneStateById(sessionId);
        if (latestState && !FORCE_CLOSE_STATES.has(latestState)) {
          patchCurrentSceneState(sessionId, latestState);
          notifyLifecycleChanged({ status: 'closed', sessionId });
          return {
            ok: true,
            message: `场景 ID=${sessionId} 当前状态为 ${latestState}，已视为无需强制关闭。`,
          };
        }

        throw new Error(`关闭场景 /clearSession 失败：${getErrorMessage(error, '后端返回错误')}`);
      }

      if (Number(topoStore.currentSessionId || topoStore.topoData?.id) === Number(sessionId)) {
        try {
          await refreshTopoAndNotify(sessionId);
        } catch {
          if (topoStore.topoData) {
            topoStore.$patch({
              topoData: {
                ...topoStore.topoData,
                state: 'SHUTDOWN',
              },
            });
            notifyTopoChanged();
          }
        }
      }

      notifyLifecycleChanged({ status: 'closed', sessionId });

      return { ok: true, message: `已请求关闭场景：ID=${sessionId}` };
    }

    case 'refreshTopo': {
      const topo = await refreshTopoAndNotify();
      return { ok: true, message: `已刷新拓扑：${formatTopoCounts(topo)}。` };
    }

    case 'listNodes': {
      const topo = await requireLoadedTopo();
      return { ok: true, message: summarizeNodes(topo.nodes) };
    }

    case 'listLinks': {
      const topo = await requireLoadedTopo();
      return { ok: true, message: summarizeLinks(topo.links) };
    }

    case 'exportScene': {
      const topo = await requireLoadedTopo();
      return { ok: true, message: JSON.stringify(topo, null, 2), data: topo };
    }

    case 'clearScene':
      return clearTopologyElements();

    case 'addNode': {
      const nodeData = await makeNodeData(command);
      await topoStore.addNodeRemote(nodeData);
      const refreshed = await refreshTopoAndNotify();
      const created = refreshed.nodes.find((node) => node.name === nodeData.name || node.alias === nodeData.alias);
      return { ok: true, message: `已通过后端创建节点：${created?.alias || created?.name || nodeData.alias}，ID=${created?.id ?? nodeData.id}` };
    }

    case 'addNodesGrid': {
      const count = Math.max(1, Math.min(command.count, 30));
      const centerLat = command.centerLat ?? DEFAULT_CENTER.lat;
      const centerLon = command.centerLon ?? DEFAULT_CENTER.lon;
      const alt = command.alt ?? DEFAULT_CENTER.alt;
      const cols = Math.ceil(Math.sqrt(count));
      const step = 0.006;
      const names: string[] = [];

      for (let i = 0; i < count; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const nodeData = await makeNodeData({
          nodeType: command.nodeType,
          lat: centerLat + (row - Math.floor(cols / 2)) * step,
          lon: centerLon + (col - Math.floor(cols / 2)) * step,
          alt,
          role: command.role,
        });
        await topoStore.addNodeRemote(nodeData);
        names.push(nodeData.alias);
        await refreshTopoAndNotify();
      }

      return { ok: true, message: `已通过后端批量创建 ${names.length} 个节点：${names.join('、')}` };
    }

    case 'addNodesBatch': {
      const names = command.names.slice(0, 100);
      const centerLat = command.centerLat ?? DEFAULT_CENTER.lat;
      const centerLon = command.centerLon ?? DEFAULT_CENTER.lon;
      const alt = command.alt ?? DEFAULT_CENTER.alt;
      const cols = Math.ceil(Math.sqrt(names.length));
      const step = 0.006;
      const success: string[] = [];
      const failed: string[] = [];
      const skipped: string[] = [];

      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        const row = Math.floor(i / cols);
        const col = i % cols;

        try {
          await requireLoadedTopo();
          if (findNode(name)) {
            skipped.push(`${name}: 已存在`);
            continue;
          }

          const nodeData = await makeNodeData({
            nodeType: command.nodeType,
            name,
            lat: centerLat + (row - Math.floor(cols / 2)) * step,
            lon: centerLon + (col - Math.floor(cols / 2)) * step,
            alt,
            role: command.role,
          });

          await topoStore.addNodeRemote(nodeData);
          await refreshTopoAndNotify();
          success.push(name);
        } catch (error: any) {
          failed.push(`${name}: ${getErrorMessage(error)}`);
        }
      }

      if (command.names.length > names.length) {
        skipped.push(`仅处理前 ${names.length} 个节点，剩余 ${command.names.length - names.length} 个未执行`);
      }

      return formatBatchResult('批量添加节点', success, failed, skipped);
    }

    case 'sampleScene': {
      const sampleCommands: Array<Extract<OpenCliCommand, { kind: 'addNode' }>> = [
        { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE1', lat: 30.523, lon: 114.364, alt: 300 },
        { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE2', lat: 30.528, lon: 114.371, alt: 350 },
        { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE3', lat: 30.519, lon: 114.372, alt: 320 },
        { kind: 'addNode', nodeType: 'EMANE', name: 'EMANE1', lat: 30.525, lon: 114.368, alt: 100 },
      ];
      for (const addCommand of sampleCommands) {
        const nodeData = await makeNodeData(addCommand);
        await topoStore.addNodeRemote(nodeData);
        await refreshTopoAndNotify();
      }
      const connectCommands: Array<Extract<OpenCliCommand, { kind: 'connectNodes' }>> = [
        { kind: 'connectNodes', from: 'DRONE1', to: 'EMANE1', linkType: 'WIRELESS' },
        { kind: 'connectNodes', from: 'DRONE2', to: 'EMANE1', linkType: 'WIRELESS' },
        { kind: 'connectNodes', from: 'DRONE3', to: 'EMANE1', linkType: 'WIRELESS' },
      ];
      for (const linkCommand of connectCommands) {
        const linkResult = await executeRemoteTopoCommand(linkCommand);
        if (!linkResult.ok) throw new Error(linkResult.message);
      }
      return { ok: true, message: '已通过后端生成示例场景：3 架无人机 + 1 个 EMANE 无线子网 + 3 条链路。' };
    }

    case 'connectNodes': {
      try {
        const label = await addLinkPair(command.from, command.to, command.linkType);
        return { ok: true, message: `已通过后端创建链路：${label}` };
      } catch (error: any) {
        return { ok: false, message: getErrorMessage(error, '创建链路失败') };
      }
    }

    case 'addLinksBatch': {
      const success: string[] = [];
      const failed: string[] = [];

      for (const pair of command.pairs) {
        try {
          const label = await addLinkPair(pair.from, pair.to, command.linkType);
          success.push(label);
        } catch (error: any) {
          failed.push(`${pair.from}-${pair.to}: ${getErrorMessage(error)}`);
        }
      }

      return formatBatchResult('批量添加链路', success, failed);
    }

    case 'deleteNode': {
      await requireLoadedTopo();
      const node = findNode(command.target);
      if (!node) return { ok: false, message: `找不到节点：${command.target}` };
      await topoStore.removeNodeRemote(node.id);
      await refreshTopoAndNotify();
      return { ok: true, message: `已通过后端删除节点：${node.alias || node.name}` };
    }

    case 'deleteNodesBatch': {
      await requireLoadedTopo();
      const success: string[] = [];
      const failed: string[] = [];
      const skipped: string[] = [];
      const targets = command.targets.filter((target, index, list) => list.indexOf(target) === index);

      for (const target of targets) {
        try {
          await requireLoadedTopo();
          const node = findNode(target);
          if (!node) {
            skipped.push(`${target}: 不存在`);
            continue;
          }

          await topoStore.removeNodeRemote(node.id);
          await refreshTopoAndNotify();
          success.push(nodeLabel(node));
        } catch (error: any) {
          failed.push(`${target}: ${getErrorMessage(error)}`);
        }
      }

      return formatBatchResult('批量删除节点/子网', success, failed, skipped);
    }

    case 'deleteLinksBatch': {
      const success: string[] = [];
      const failed: string[] = [];

      for (const pair of command.pairs) {
        try {
          const label = await deleteLinkPair(pair.from, pair.to);
          success.push(label);
        } catch (error: any) {
          failed.push(`${pair.from}-${pair.to}: ${getErrorMessage(error)}`);
        }
      }

      return formatBatchResult('批量删除链路', success, failed);
    }

    case 'moveNode': {
      await requireLoadedTopo();
      const node = findNode(command.target);
      if (!node) return { ok: false, message: `找不到节点：${command.target}` };
      const updatedNode = {
        ...node,
        geo: {
          ...(node.geo || { lat: 0, lon: 0, alt: 0 }),
          lat: command.lat,
          lon: command.lon,
          alt: command.alt ?? node.geo?.alt ?? 0,
        },
      };
      await topoStore.editNodeRemote(updatedNode);
      await refreshTopoAndNotify();
      return { ok: true, message: `已通过后端移动节点：${node.alias || node.name}` };
    }

    case 'setNodeStatus': {
      await requireLoadedTopo();
      const node = findNode(command.target);
      if (!node) return { ok: false, message: `找不到节点：${command.target}` };
      await topoStore.editNodeRemote({ ...node, status: command.status });
      await refreshTopoAndNotify();
      return { ok: true, message: `已通过后端设置节点 ${node.alias || node.name} 状态为 ${command.status}` };
    }

    case 'startSession': {
      const preflight = await runSimulationPreflight();

      if (!preflight.ok) {
        return {
          ok: false,
          message: formatPreflight(preflight),
          data: preflight,
        };
      }

      let topo = normalizeTopoArrays(preflight.topo!);
      const userId = getCurrentUserId();

      if (!userId) {
        throw new Error('还没有登录用户信息，无法启动仿真。');
      }

      if (!topo.id) {
        throw new Error('当前拓扑没有有效 sessionId，无法启动仿真。');
      }

      const monitorParams = buildMonitorParams(command.duration);
      const messages: string[] = [];
      const assignedCount = await assignMissingServers(topo, preflight.nodesWithoutServer);

      if (assignedCount > 0) {
        topo = normalizeTopoArrays(await requireLoadedTopo());
        messages.push(`已自动为 ${assignedCount} 个未分配服务器的节点设置默认服务器：${getDefaultServerName(topo)}。`);
      }

      const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];

      try {
        const response: any = await startSession(
          topo.id,
          userId,
          servers,
          monitorParams.duration
        );

        assertApiOk(response, '启动会话失败');

        // /start 成功后，后端通常会返回最新 topo。
        // 这里尽量同步到 topoStore。
        const startedTopo = normalizeTopoResponse(response);

        if (startedTopo) {
          topoStore.$patch({
            currentSessionId: Number(topo.id),
            currentSessionName: startedTopo.name || topoStore.currentSessionName || `场景${topo.id}`,
            topoData: normalizeTopoArrays(startedTopo),
          });
          notifyTopoChanged();
        } else if (response?.data) {
          (topoStore as any).setTopoData?.(Number(topo.id), response.data);
          notifyTopoChanged();
        }

        messages.push(`已调用 /start：sessionId=${topo.id}，duration=${monitorParams.duration}ms。`);
      } catch (error: any) {
        throw new Error(`启动会话 /start 失败：${getErrorMessage(error, '后端返回错误')}`);
      }

      const latestTopo = normalizeTopoArrays(
        topoStore.topoData?.id ? topoStore.topoData : topo
      );

      const nemMessage = await cacheNemIdsIfNeeded(latestTopo);
      messages.push(nemMessage);

      try {
        const monitorResponse: any = await startBroker(
          {
            duration: monitorParams.duration,
            stepLength: monitorParams.stepLength,
            mode: monitorParams.mode,
          },
          Number(topo.id)
        );

        assertApiOk(monitorResponse, '启动监控 /startBroker 失败');

        messages.push(`已调用 /startBroker：持续约 ${monitorParams.durationMinutes} 分钟。`);
      } catch (error: any) {
        throw new Error(`启动监控 /startBroker 失败：${getErrorMessage(error, '后端返回错误')}`);
      }

      try {
        eventBus.emit('startSimulation');
      } catch (error) {
        console.warn('[OpenCLI] 触发 Cesium 仿真事件失败：', error);
      }

      await refreshTopoAndNotify(Number(topo.id));
      notifyLifecycleChanged({
        status: 'started',
        sessionId: Number(topo.id),
        duration: monitorParams.duration,
        stepLength: monitorParams.stepLength,
        mode: monitorParams.mode,
      });

      return {
        ok: true,
        message: [
          `已通过 OpenCLI 启动仿真：sessionId=${topo.id}`,
          ...messages,
        ].join('\n'),
      };
    }

    case 'pauseSession': {
      const topo = normalizeTopoArrays(await requireLoadedTopo());
      const userId = getCurrentUserId();

      if (!userId) {
        throw new Error('还没有登录用户信息，无法暂停仿真。');
      }

      if (!isRuntimeState(topo.state)) {
        return {
          ok: false,
          message: `当前场景状态为 ${topo.state || 'UNKNOWN'}，不处于运行态，无需暂停。`,
        };
      }

      const dockerNodes = topo.nodes.filter((node: any) => node.type === 'DOCKER');
      const containerList = dockerNodes.map((node: any) => `${node.name}-${topo.id}`);

      try {
        await stopBroker(Number(topo.id));
      } catch (error) {
        console.warn('[OpenCLI] pause 前 stopBroker 失败，继续调用 pauseSession：', error);
      }

      const response: any = await pauseSession(Number(topo.id), userId, containerList);
      assertApiOk(response, '暂停仿真失败');

      if (response?.data) {
        (topoStore as any).setTopoData?.(Number(topo.id), response.data);
      } else if (topoStore.topoData) {
        topoStore.$patch({
          topoData: {
            ...topoStore.topoData,
            state: 'SHUTDOWN',
          },
        });
      }

      try {
        eventBus.emit('stopSimulation');
      } catch (error) {
        console.warn('[OpenCLI] 触发 Cesium 暂停事件失败：', error);
      }

      await refreshTopoAndNotify(Number(topo.id));
      notifyLifecycleChanged({ status: 'paused', sessionId: Number(topo.id) });

      return {
        ok: true,
        message: `已请求后端暂停仿真：sessionId=${topo.id}`,
      };
    }

    case 'stopSession': {
      const topo = await requireLoadedTopo();

      try {
        await stopBroker(Number(topo.id));
      } catch (error) {
        console.warn('[OpenCLI] stopBroker 失败，继续调用 stopSession：', error);
      }

      const response: any = await stopSession(topo.id);
      assertApiOk(response, '停止仿真失败');

      if (response?.data) {
        (topoStore as any).setTopoData?.(Number(topo.id), response.data);
      }

      try {
        eventBus.emit('stopSimulation');
      } catch (error) {
        console.warn('[OpenCLI] 触发 Cesium 停止事件失败：', error);
      }

      await refreshTopoAndNotify(topo.id);
      notifyLifecycleChanged({ status: 'stopped', sessionId: Number(topo.id) });

      return {
        ok: true,
        message: `已请求后端停止仿真：sessionId=${topo.id}`,
      };
    }
    default:
      return { ok: false, message: '未知命令。' };
  }
}
