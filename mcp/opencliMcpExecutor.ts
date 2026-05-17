import { parseOpenCli } from '../src/opencli/parser.ts';
import type { OpenCliCommand, OpenCliNodeType, OpenCliResult, OpenCliRole } from '../src/opencli/types.ts';
import type { Link, LinkOptions, Node, NodeIface, TopoData } from '../src/types/topo.ts';
import { requireUserId } from './config.ts';
import { OpenCliBackendClient, type SceneData } from './backendClient.ts';

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

interface ExecutorState {
  currentSessionId: number | null;
  currentSessionName: string;
  topoData: TopoData | null;
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
  return Boolean(value && typeof value === 'object' && typeof value.id !== 'undefined');
}

function normalizeTopoArrays(topo: TopoData): TopoData {
  return {
    ...topo,
    nodes: Array.isArray(topo.nodes) ? topo.nodes : [],
    links: Array.isArray(topo.links) ? topo.links : [],
  };
}

function normalizeTopoResponse(value: any): TopoData | null {
  const candidates = [
    value,
    value?.data,
    value?.data?.data,
    value?.data?.topo,
    value?.topo,
    value?.topology,
    value?.result,
    value?.result?.data,
  ].map(tryParseJson);

  for (const candidate of candidates) {
    if (isTopoData(candidate)) {
      return normalizeTopoArrays(candidate);
    }
  }

  return null;
}

function sceneId(scene: SceneData): number {
  return Number(scene.id || scene.session?.id || 0);
}

function sceneName(scene: SceneData): string {
  return scene.name || scene.session?.name || `场景${sceneId(scene)}`;
}

function sceneScopeLabel(scene: SceneData): string {
  return (scene as SceneData & { scopeLabel?: string }).scopeLabel || '场景';
}

function summarizeScenes(scenes: SceneData[], currentSessionId?: number | null): string {
  if (scenes.length === 0) return '没有找到匹配场景。';

  const lines = scenes.slice(0, 30).map((scene) => {
    const id = sceneId(scene);
    const current = currentSessionId === id ? ' 当前' : '';
    const state = scene.state || scene.session?.state || 'UNKNOWN';
    const updated = scene.updateTime || scene.createTime || '';
    return `#${id} ${sceneName(scene)} [${sceneScopeLabel(scene)}] state=${state}${current}${updated ? ` updated=${updated}` : ''}`;
  });

  if (scenes.length > 30) {
    lines.push(`... 还有 ${scenes.length - 30} 个场景未显示，请用 name 过滤。`);
  }

  return lines.join('\n');
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

  return links.map((link, index) =>
    `${index + 1}. ${link.node1_id} <-> ${link.node2_id} type=${link.type} network=${link.network_id ?? 0}`
  ).join('\n');
}

function normalizeDurationMs(duration?: number): number {
  const value = Number(duration || 300);
  if (!Number.isFinite(value) || value <= 0) return 300000;
  return value <= 24 * 60 * 60 ? value * 1000 : value;
}

function toBackendNodeType(type: OpenCliNodeType): { type: string; model: string; image: string } {
  switch (type) {
    case 'DRONE':
      return { type: 'DRONE', model: 'prouter', image: '' };
    case 'BASESTATION':
      return { type: 'BASESTATION', model: 'prouter', image: '' };
    case 'DEFAULT':
      return { type: 'DOCKER', model: 'router', image: 'nest:v3' };
    case 'DOCKER':
      return { type: 'DOCKER', model: 'docker', image: 'nest:v3' };
    case 'VMNODE':
      return { type: 'VMNODE', model: 'vm', image: '/home/feuille/vm-template/cirros.xml' };
    case 'RJ45':
      return { type: 'RJ45', model: 'rj45', image: '' };
    case 'SWITCH':
      return { type: 'SWITCH', model: 'switch', image: '' };
    case 'INODE':
      return { type: 'INODE', model: 'inode', image: '' };
    case 'EMANE':
      return { type: 'EMANE', model: 'emane', image: '' };
    default:
      return { type: 'DOCKER', model: 'router', image: 'nest:v3' };
  }
}

export class OpenCliMcpExecutor {
  private readonly state: ExecutorState = {
    currentSessionId: null,
    currentSessionName: '',
    topoData: null,
  };

  constructor(private readonly backend: OpenCliBackendClient) {}

  async listScenes(scope: 'private' | 'public' | 'all' = 'all', name?: string): Promise<OpenCliResult> {
    const scenes = await this.backend.listScenes({ scope, name });
    return { ok: true, message: summarizeScenes(scenes, this.state.currentSessionId), data: scenes };
  }

  currentScene(): OpenCliResult {
    if (!this.state.currentSessionId) {
      return { ok: false, message: '当前 MCP server 没有加载场景。请先调用 opencli_load_scene。' };
    }

    const topo = this.state.topoData;
    return {
      ok: true,
      message: [
        `当前场景：${topo?.name || this.state.currentSessionName || `场景${this.state.currentSessionId}`}`,
        `ID=${this.state.currentSessionId}`,
        `状态=${topo?.state || 'UNKNOWN'}`,
        `节点=${topo?.nodes?.length || 0}`,
        `链路=${topo?.links?.length || 0}`,
      ].join('\n'),
      data: topo,
    };
  }

  async loadScene(input: { sessionId?: number; name?: string }): Promise<OpenCliResult> {
    const sessionId = await this.resolveSceneId(input);
    const topo = await this.refreshTopo(sessionId);
    return {
      ok: true,
      message: `已加载场景：${topo.name || `场景${sessionId}`}，ID=${sessionId}，节点 ${topo.nodes.length} 个，链路 ${topo.links.length} 条。`,
      data: topo,
    };
  }

  async topoSummary(sessionId?: number): Promise<OpenCliResult> {
    const topo = sessionId ? await this.fetchTopo(sessionId) : await this.requireLoadedTopo();
    const nodes = topo.nodes || [];
    const links = topo.links || [];
    const subnetCount = nodes.filter((node) => node.type === 'EMANE').length;
    const normalNodeCount = nodes.length - subnetCount;

    return {
      ok: true,
      message: [
        `场景：${topo.name || `场景${topo.id}`} (ID=${topo.id})`,
        `状态：${topo.state || 'UNKNOWN'}`,
        `子网=${subnetCount}，节点=${normalNodeCount}，链路=${links.length}`,
        '',
        '节点摘要：',
        summarizeNodes(nodes).split('\n').slice(0, 20).join('\n'),
        '',
        '链路摘要：',
        summarizeLinks(links).split('\n').slice(0, 20).join('\n'),
      ].join('\n'),
      data: {
        id: topo.id,
        name: topo.name,
        state: topo.state,
        nodeCount: normalNodeCount,
        subnetCount,
        linkCount: links.length,
      },
    };
  }

  async topoExport(sessionId?: number): Promise<OpenCliResult> {
    const topo = sessionId ? await this.fetchTopo(sessionId) : await this.requireLoadedTopo();
    return { ok: true, message: JSON.stringify(topo, null, 2), data: topo };
  }

  async runText(input: string): Promise<OpenCliResult> {
    const command = parseOpenCli(input);
    return this.executeCommand(command);
  }

  async runCommand(command: OpenCliCommand): Promise<OpenCliResult> {
    return this.executeCommand(command);
  }

  private async executeCommand(command: OpenCliCommand): Promise<OpenCliResult> {
    switch (command.kind) {
      case 'help':
        return this.help();
      case 'listScenes':
        return this.listScenes(command.scope || 'all', command.name);
      case 'currentScene':
        return this.currentScene();
      case 'openViewer':
        return { ok: true, message: 'MCP 无法直接操作浏览器。请在前端打开 /viewer，或输入“打开态势”使用前端 OpenCLI。' };
      case 'exitCurrentScene':
        this.state.currentSessionId = null;
        this.state.currentSessionName = '';
        this.state.topoData = null;
        return { ok: true, message: '已清除 MCP server 里的当前场景状态。' };
      case 'loadScene':
        return this.loadScene({ sessionId: command.sessionId, name: command.name });
      case 'refreshTopo': {
        const topo = await this.refreshTopo();
        return { ok: true, message: `已刷新拓扑：节点 ${topo.nodes.length} 个，链路 ${topo.links.length} 条。`, data: topo };
      }
      case 'simulationCheck':
        return this.simulationCheck();
      case 'listNodes': {
        const topo = await this.requireLoadedTopo();
        return { ok: true, message: summarizeNodes(topo.nodes), data: topo.nodes };
      }
      case 'listLinks': {
        const topo = await this.requireLoadedTopo();
        return { ok: true, message: summarizeLinks(topo.links), data: topo.links };
      }
      case 'exportScene':
        return { ok: true, message: '请调用 opencli_topo_export 获取完整 topo JSON，避免 run_text 输出过长。' };
      case 'initScene':
        return this.createScene(command.name);
      case 'closeScene':
        return this.closeScene(command);
      case 'addNode':
        return this.addNode(command);
      case 'addNodesGrid':
        return this.addNodesGrid(command);
      case 'addNodesBatch':
        return this.addNodesBatch(command);
      case 'sampleScene':
        return this.sampleScene();
      case 'connectNodes':
        return this.connectNodes(command.from, command.to, command.linkType);
      case 'addLinksBatch':
        return this.addLinksBatch(command);
      case 'deleteNode':
        return this.deleteNode(command.target);
      case 'deleteNodesBatch':
        return this.deleteNodesBatch(command.targets);
      case 'deleteLinksBatch':
        return this.deleteLinksBatch(command.pairs);
      case 'moveNode':
        return this.moveNode(command);
      case 'setNodeStatus':
        return this.setNodeStatus(command.target, command.status);
      case 'clearScene':
        return this.clearScene();
      case 'startSession':
        return this.startSession(command.duration);
      case 'pauseSession':
        return this.pauseSession();
      case 'stopSession':
        return this.stopSession();
      default:
        return { ok: false, message: '未知命令。' };
    }
  }

  private help(): OpenCliResult {
    return {
      ok: true,
      message: [
        'OpenCLI MCP 工具：',
        'opencli_scene_list / opencli_load_scene / opencli_current_scene',
        'opencli_topo_summary / opencli_topo_export',
        'opencli_run_text 和结构化写操作 tools',
        '',
        'run_text 示例：查看节点、添加无人机 名为 DRONE1 在 30.523,114.364,300、启动仿真 时长=300',
        '注意：当前 MCP 写操作会直接执行，不再生成待确认项。',
      ].join('\n'),
    };
  }

  private async fetchTopo(sessionId: number): Promise<TopoData> {
    const response = await this.backend.getTopo(sessionId);
    const topo = normalizeTopoResponse(response);
    if (!topo) throw new Error('后端没有返回有效 topo 数据。');
    return topo;
  }

  private async refreshTopo(sessionId?: number): Promise<TopoData> {
    const targetSessionId = sessionId || this.state.currentSessionId || this.state.topoData?.id;
    if (!targetSessionId) {
      throw new Error('当前 MCP server 没有加载场景。请先调用 opencli_load_scene。');
    }

    const topo = await this.fetchTopo(Number(targetSessionId));
    this.state.currentSessionId = Number(targetSessionId);
    this.state.currentSessionName = topo.name || this.state.currentSessionName || `场景${targetSessionId}`;
    this.state.topoData = topo;
    return topo;
  }

  private async requireLoadedTopo(): Promise<TopoData> {
    if (this.state.topoData?.id) {
      this.state.topoData = normalizeTopoArrays(this.state.topoData);
      return this.state.topoData;
    }

    return this.refreshTopo();
  }

  private async resolveSceneId(input: { sessionId?: number; name?: string }): Promise<number> {
    if (input.sessionId) return Number(input.sessionId);
    const name = input.name?.trim();
    if (!name) throw new Error('需要提供场景 ID 或名称。');

    const scenes = await this.backend.listScenes({ scope: 'all', name });
    const exact = scenes.filter((scene) => sceneName(scene) === name);
    const candidates = exact.length > 0 ? exact : scenes.filter((scene) => sceneName(scene).includes(name));

    if (candidates.length === 0) throw new Error(`没有找到名为“${name}”的场景。`);
    if (candidates.length > 1) throw new Error(`找到多个匹配场景，请改用 ID：\n${summarizeScenes(candidates, this.state.currentSessionId)}`);

    return sceneId(candidates[0]);
  }

  private nextNodeId(nodes: Node[]): number {
    return nodes.length ? Math.max(...nodes.map((node) => Number(node.id) || 0)) + 1 : 1;
  }

  private nextNodeName(type: OpenCliNodeType, nodes: Node[], customName?: string): string {
    if (customName) return customName;
    const prefix = prefixByType[type] || 'NODE';
    let index = 1;
    while (nodes.some((node) => node.name === `${prefix}${index}` || node.alias === `${prefix}${index}`)) index += 1;
    return `${prefix}${index}`;
  }

  private defaultServerName(topo: TopoData): string {
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    return String(servers[0]?.name || servers[0]?.host || '');
  }

  private role(commandRole?: OpenCliRole): OpenCliRole {
    return commandRole || 1;
  }

  private async makeNodeData(params: {
    nodeType: OpenCliNodeType;
    name?: string;
    lat?: number;
    lon?: number;
    alt?: number;
    role?: OpenCliRole;
  }): Promise<any> {
    const topo = await this.requireLoadedTopo();
    const nodes = topo.nodes || [];
    const id = this.nextNodeId(nodes);
    const name = this.nextNodeName(params.nodeType, nodes, params.name);
    const backend = toBackendNodeType(params.nodeType);

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
      role: this.role(params.role),
      status: 'UP',
      alias: name,
      server: this.defaultServerName(topo),
    };
  }

  private findNode(target: string): Node | undefined {
    const normalized = target.trim().toLowerCase();
    const nodes = Array.isArray(this.state.topoData?.nodes) ? this.state.topoData.nodes : [];

    return nodes.find((node) =>
      String(node.id) === normalized ||
      node.name?.toLowerCase() === normalized ||
      node.alias?.toLowerCase() === normalized
    );
  }

  private defaultOptions(): LinkOptions {
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

  private getNodeInterfaces(links: Link[], nodeId: number): NodeIface[] {
    const interfaces: NodeIface[] = [];
    links.forEach((link) => {
      if (link.iface1?.node_id === nodeId) interfaces.push(link.iface1);
      if (link.iface2?.node_id === nodeId) interfaces.push(link.iface2);
    });
    return interfaces;
  }

  private getNextAvailableId(interfaces: NodeIface[]): number {
    const usedIds = interfaces.map((iface) => iface.id).filter((id) => Number.isFinite(id));
    let nextId = 0;
    while (usedIds.includes(nextId)) nextId += 1;
    return nextId;
  }

  private createIface(nodeId: number, links: Link[]): NodeIface {
    const ifaceId = this.getNextAvailableId(this.getNodeInterfaces(links, nodeId));
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

  private determineLinkType(node1: Node, node2: Node, preferred?: 'WIRED' | 'WIRELESS'): 'WIRED' | 'WIRELESS' {
    if (preferred) return preferred;
    if (node1.type === 'EMANE' || node2.type === 'EMANE') return 'WIRELESS';
    if (node1.type === 'DRONE' || node2.type === 'DRONE') return 'WIRELESS';
    return 'WIRED';
  }

  private makeLinkData(node1: Node, node2: Node, preferredType?: 'WIRED' | 'WIRELESS'): Partial<Link> {
    const links = this.state.topoData?.links || [];
    const type = this.determineLinkType(node1, node2, preferredType);
    const linkData: Partial<Link> = {
      node1_id: node1.id,
      node2_id: node2.id,
      type,
      options: this.defaultOptions(),
      network_id: 0,
    };

    if (node1.type !== 'EMANE') linkData.iface1 = this.createIface(node1.id, links);
    if (node2.type !== 'EMANE') linkData.iface2 = this.createIface(node2.id, links);

    const emaneNode = node1.type === 'EMANE' ? node1 : node2.type === 'EMANE' ? node2 : null;
    if (emaneNode) {
      linkData.network_id = emaneNode.id;
      const nonEmaneIface = node1.type === 'EMANE' ? linkData.iface2 : linkData.iface1;
      if (nonEmaneIface) {
        const emaneIndex = (this.state.topoData?.nodes || []).filter((node) => node.type === 'EMANE').findIndex((node) => node.id === emaneNode.id);
        const baseIp = `${(Math.max(emaneIndex, 0) + 1) * 10}.0.0`;
        const count = links.filter((link) => link.node1_id === emaneNode.id || link.node2_id === emaneNode.id).length;
        nonEmaneIface.ip4 = `${baseIp}.${count + 1}`;
        nonEmaneIface.net2_id = emaneNode.id;
      }
    }

    return linkData;
  }

  private async updateTopoFromResponse(responseData: any, fallbackSessionId?: number): Promise<TopoData> {
    const topo = normalizeTopoResponse(responseData);
    if (topo) {
      this.state.currentSessionId = Number(topo.id);
      this.state.currentSessionName = topo.name || this.state.currentSessionName || `场景${topo.id}`;
      this.state.topoData = topo;
      return topo;
    }

    return this.refreshTopo(fallbackSessionId);
  }

  private async createScene(name?: string): Promise<OpenCliResult> {
    requireUserId();
    const sceneNameValue = name || `OpenCLI场景-${new Date().toLocaleString()}`;
    const response = await this.backend.createScene(sceneNameValue);
    const newSessionId = response.data?.id || response.data?.session?.id || response.data?.sessionId || (response as any).id;

    if (!newSessionId) {
      return { ok: true, message: `已新建场景：${sceneNameValue}。后端未返回场景 ID，请用 opencli_scene_list 查询。`, data: response.data };
    }

    const topo = await this.refreshTopo(Number(newSessionId));
    return { ok: true, message: `已新建并加载场景：${sceneNameValue}，ID=${newSessionId}，节点数=${topo.nodes.length}`, data: topo };
  }

  private async closeScene(command: Extract<OpenCliCommand, { kind: 'closeScene' }>): Promise<OpenCliResult> {
    const sessionId = await this.resolveSceneId({ sessionId: command.sessionId, name: command.name });
    await this.backend.closeScene(sessionId);

    if (this.state.currentSessionId === sessionId && this.state.topoData) {
      this.state.topoData = { ...this.state.topoData, state: 'SHUTDOWN' };
    }

    return { ok: true, message: `已请求关闭场景：ID=${sessionId}` };
  }

  private async addNode(command: Extract<OpenCliCommand, { kind: 'addNode' }>): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const nodeData = await this.makeNodeData(command);
    const response = await this.backend.addNode(nodeData, topo.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    const created = refreshed.nodes.find((node) => node.name === nodeData.name || node.alias === nodeData.alias);
    return { ok: true, message: `已创建节点：${created?.alias || created?.name || nodeData.alias}，ID=${created?.id ?? nodeData.id}` };
  }

  private async addNodesGrid(command: Extract<OpenCliCommand, { kind: 'addNodesGrid' }>): Promise<OpenCliResult> {
    const count = Math.max(1, Math.min(command.count, 30));
    const centerLat = command.centerLat ?? DEFAULT_CENTER.lat;
    const centerLon = command.centerLon ?? DEFAULT_CENTER.lon;
    const alt = command.alt ?? DEFAULT_CENTER.alt;
    const cols = Math.ceil(Math.sqrt(count));
    const step = 0.006;
    const names: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const result = await this.addNode({
        kind: 'addNode',
        nodeType: command.nodeType,
        lat: centerLat + (row - Math.floor(cols / 2)) * step,
        lon: centerLon + (col - Math.floor(cols / 2)) * step,
        alt,
        role: command.role,
      });
      names.push(result.message);
    }

    return { ok: true, message: `已生成 ${count} 个节点：\n${names.join('\n')}` };
  }

  private async addNodesBatch(command: Extract<OpenCliCommand, { kind: 'addNodesBatch' }>): Promise<OpenCliResult> {
    const centerLat = command.centerLat ?? DEFAULT_CENTER.lat;
    const centerLon = command.centerLon ?? DEFAULT_CENTER.lon;
    const alt = command.alt ?? DEFAULT_CENTER.alt;
    const step = 0.004;
    const created: string[] = [];

    for (let index = 0; index < command.names.length; index += 1) {
      const result = await this.addNode({
        kind: 'addNode',
        nodeType: command.nodeType,
        name: command.names[index],
        lat: centerLat + index * step,
        lon: centerLon + index * step,
        alt,
        role: command.role,
      });
      created.push(result.message);
    }

    return { ok: true, message: `已批量添加 ${created.length} 个节点：\n${created.join('\n')}` };
  }

  private findLinkBetween(from: Node, to: Node): Link | undefined {
    const links = Array.isArray(this.state.topoData?.links) ? this.state.topoData.links : [];
    return links.find((link) =>
      (link.node1_id === from.id && link.node2_id === to.id) ||
      (link.node1_id === to.id && link.node2_id === from.id)
    );
  }

  private async connectNodes(fromTarget: string, toTarget: string, linkType?: 'WIRED' | 'WIRELESS'): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const from = this.findNode(fromTarget);
    const to = this.findNode(toTarget);
    if (!from || !to) throw new Error(`找不到节点：${!from ? fromTarget : toTarget}`);
    if (from.id === to.id) throw new Error('不能连接同一个节点。');
    if (this.findLinkBetween(from, to)) throw new Error(`链路已存在：${from.alias || from.name} - ${to.alias || to.name}`);

    const linkData = this.makeLinkData(from, to, linkType);
    const response = await this.backend.addLink(linkData, topo.id, userId);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已添加链路：${from.alias || from.name} - ${to.alias || to.name}` };
  }

  private async addLinksBatch(command: Extract<OpenCliCommand, { kind: 'addLinksBatch' }>): Promise<OpenCliResult> {
    const results: string[] = [];
    for (const pair of command.pairs) {
      const result = await this.connectNodes(pair.from, pair.to, command.linkType);
      results.push(result.message);
    }
    return { ok: true, message: `已批量添加 ${results.length} 条链路：\n${results.join('\n')}` };
  }

  private async deleteNode(target: string): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(target);
    if (!node) throw new Error(`找不到节点：${target}`);

    const response = await this.backend.deleteNode(topo.id, node.id, userId);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已删除节点：${node.alias || node.name}` };
  }

  private async deleteNodesBatch(targets: string[]): Promise<OpenCliResult> {
    const results: string[] = [];
    for (const target of targets) {
      const result = await this.deleteNode(target);
      results.push(result.message);
    }
    return { ok: true, message: `已批量删除 ${results.length} 个节点：\n${results.join('\n')}` };
  }

  private async deleteLink(fromTarget: string, toTarget: string): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const from = this.findNode(fromTarget);
    const to = this.findNode(toTarget);
    if (!from || !to) throw new Error(`找不到节点：${!from ? fromTarget : toTarget}`);

    const link = this.findLinkBetween(from, to);
    if (!link) throw new Error(`找不到链路：${fromTarget} - ${toTarget}`);

    const response = await this.backend.deleteLink(link, topo.id, userId);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已删除链路：${from.alias || from.name} - ${to.alias || to.name}` };
  }

  private async deleteLinksBatch(pairs: Array<{ from: string; to: string }>): Promise<OpenCliResult> {
    const results: string[] = [];
    for (const pair of pairs) {
      const result = await this.deleteLink(pair.from, pair.to);
      results.push(result.message);
    }
    return { ok: true, message: `已批量删除 ${results.length} 条链路：\n${results.join('\n')}` };
  }

  private async moveNode(command: Extract<OpenCliCommand, { kind: 'moveNode' }>): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(command.target);
    if (!node) throw new Error(`找不到节点：${command.target}`);

    const updatedNode = {
      ...node,
      geo: {
        lon: command.lon,
        lat: command.lat,
        alt: Number(command.alt ?? node.geo?.alt ?? DEFAULT_CENTER.alt),
      },
    };
    const response = await this.backend.editNode(updatedNode, topo.id, userId);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已移动节点：${node.alias || node.name}` };
  }

  private async setNodeStatus(target: string, status: 'UP' | 'DOWN'): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(target);
    if (!node) throw new Error(`找不到节点：${target}`);

    const response = await this.backend.editNode({ ...node, status }, topo.id, userId);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已设置节点 ${node.alias || node.name} 状态为 ${status}` };
  }

  private async clearScene(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const pairs = [...topo.links].map((link) => ({ from: String(link.node1_id), to: String(link.node2_id) }));
    for (const pair of pairs) {
      try {
        await this.deleteLink(pair.from, pair.to);
      } catch {
        // 部分链路可能会随节点删除自动消失，忽略并继续清理节点。
      }
    }

    const ids = [...(this.state.topoData?.nodes || [])].map((node) => String(node.id));
    for (const id of ids) {
      await this.deleteNode(id);
    }

    await this.refreshTopo(topo.id);
    return { ok: true, message: `已清空场景拓扑：删除 ${ids.length} 个节点。` };
  }

  private async sampleScene(): Promise<OpenCliResult> {
    const addCommands: Array<Extract<OpenCliCommand, { kind: 'addNode' }>> = [
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE1', lat: 30.523, lon: 114.364, alt: 300 },
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE2', lat: 30.528, lon: 114.371, alt: 350 },
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE3', lat: 30.519, lon: 114.372, alt: 320 },
      { kind: 'addNode', nodeType: 'EMANE', name: 'EMANE1', lat: 30.525, lon: 114.368, alt: 100 },
    ];

    for (const command of addCommands) {
      await this.addNode(command);
    }

    const linkMessages = [
      await this.connectNodes('DRONE1', 'EMANE1', 'WIRELESS'),
      await this.connectNodes('DRONE2', 'EMANE1', 'WIRELESS'),
      await this.connectNodes('DRONE3', 'EMANE1', 'WIRELESS'),
    ];

    return { ok: true, message: `演示场景已创建。\n${linkMessages.map((item) => item.message).join('\n')}` };
  }

  private async simulationCheck(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    const nodes = topo.nodes || [];
    const nodesWithoutServer = nodes.filter((node: any) => !String(node.server || '').trim());
    const emaneCount = nodes.filter((node) => node.type === 'EMANE').length;

    return {
      ok: true,
      message: [
        `仿真启动检查：sessionId=${topo.id}`,
        `状态=${topo.state || 'UNKNOWN'}，节点=${nodes.length}，链路=${topo.links.length}，EMANE=${emaneCount}，服务器=${servers.length}`,
        nodesWithoutServer.length > 0 ? `有 ${nodesWithoutServer.length} 个节点未分配服务器。` : '节点服务器分配看起来正常。',
      ].join('\n'),
      data: { servers, nodesWithoutServer },
    };
  }

  private dockerContainers(topo: TopoData): string[] {
    return (topo.nodes || [])
      .filter((node) => node.type === 'DOCKER')
      .map((node) => `${node.name}-${topo.id}`);
  }

  private async startSession(duration?: number): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    const durationMs = normalizeDurationMs(duration);
    const startResponse = await this.backend.startSession(topo.id, userId, servers, durationMs);
    await this.updateTopoFromResponse(startResponse, topo.id);

    if ((this.state.topoData?.nodes || []).some((node) => node.type === 'EMANE')) {
      try {
        await this.backend.getNemIds(topo.id);
      } catch {
        // NEM ID 获取失败不阻塞启动流程。
      }
    }

    await this.backend.startBroker({ duration: durationMs, stepLength: 1000, mode: 0 }, topo.id);
    await this.refreshTopo(topo.id);
    return { ok: true, message: `已启动仿真：sessionId=${topo.id}，duration=${durationMs}ms。` };
  }

  private async pauseSession(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    try {
      await this.backend.stopBroker(topo.id);
    } catch {
      // pause 继续调用后端 pause。
    }

    const response = await this.backend.pauseSession(topo.id, userId, this.dockerContainers(topo));
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已请求暂停仿真：sessionId=${topo.id}` };
  }

  private async stopSession(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    try {
      await this.backend.stopBroker(topo.id);
    } catch {
      // stopSession 继续调用后端 stop。
    }

    const response = await this.backend.stopSession(topo.id);
    await this.updateTopoFromResponse(response, topo.id);
    return { ok: true, message: `已请求停止仿真：sessionId=${topo.id}` };
  }
}
