import { parseOpenCli } from '../src/opencli/parser.ts';
import type { OpenCliCommand, OpenCliResult, OpenCliRole } from '../src/opencli/types.ts';
import type { ConfigOption, EmaneConfig, Link, LinkOptions, Node, NodeIface, TopoData } from '../src/types/topo.ts';
import { config, requireUserId } from './config.ts';
import { OpenCliBackendClient, type SceneData } from './backendClient.ts';
import type { ConfigFormEnvelope, PendingConfigSession } from './configForms.ts';

const DEFAULT_CENTER = {
  // Keep MCP-created nodes near the Cesium ENU origin used by the viewer.
  lat: 23.828398440342344,
  lon: 121.12783051473023,
  alt: 200,
};
const DEFAULT_POSITION_STEP = 0.004;
const DEFAULT_POSITION_TOLERANCE = 0.00005;
const CONFIG_REQUEST_MAX_AGE_MS = 10 * 60 * 1000;
const AUTO_DEFAULT_CONFIRMATION_KEYS = new Set([
  'useDefaultConfig',
  'useDefaults',
  'configConfirmed',
  'confirmedDefault',
  'autoConfirmDefaults',
  'defaultConfigConfirmed',
]);

type McpNodeType =
  | 'DRONE'
  | 'VAN'
  | 'EMANE'
  | 'BASESTATION'
  | 'SATELLITE'
  | 'ROUTER'
  | 'DEFAULT'
  | 'VMNODE'
  | 'RJ45'
  | 'SWITCH'
  | 'INODE'
  | 'INTERFERENCE'
  | 'DOCKER'
  | 'TMV'
  | 'BUSINESS_Transmitter'
  | 'ATTACK_MACHINE'
  | 'SECURITY_MACHINE'
  | 'SDN_CONTROLLER'
  | 'Ovs_SWITCH'
  | 'P4_SWITCH'
  | 'SR_SWITCH'
  | 'HTTP'
  | 'FTP'
  | 'DNS'
  | 'SMTP'
  | 'VoIP-SIP'
  | 'TLS'
  | 'RTSP-RTP'
  | 'MQTT'
  | 'CoAP'
  | 'DDS'
  | 'SSH'
  | 'PKI';

const prefixByType: Record<McpNodeType, string> = {
  DRONE: 'DRONE',
  VAN: 'VAN',
  EMANE: 'EMANE',
  BASESTATION: 'BASESTATION',
  SATELLITE: 'SATELLITE',
  ROUTER: 'ROUTER',
  DEFAULT: 'ROUTER',
  VMNODE: 'VM',
  RJ45: 'PC',
  SWITCH: 'SWITCH',
  INODE: 'INODE',
  INTERFERENCE: 'INODE',
  DOCKER: 'DOCKER',
  TMV: 'TMV',
  BUSINESS_Transmitter: 'BUSINESS_Transmitter',
  ATTACK_MACHINE: 'ATTACK_MACHINE',
  SECURITY_MACHINE: 'SECURITY_MACHINE',
  SDN_CONTROLLER: 'SDN_CONTROLLER',
  Ovs_SWITCH: 'Ovs_SWITCH',
  P4_SWITCH: 'P4_SWITCH',
  SR_SWITCH: 'SR_SWITCH',
  HTTP: 'HTTP',
  FTP: 'FTP',
  DNS: 'DNS',
  SMTP: 'SMTP',
  'VoIP-SIP': 'VoIP_SIP',
  TLS: 'TLS',
  'RTSP-RTP': 'RTSP_RTP',
  MQTT: 'MQTT',
  CoAP: 'CoAP',
  DDS: 'DDS',
  SSH: 'SSH',
  PKI: 'PKI',
};

interface ExecutorState {
  currentSessionId: number | null;
  currentSessionName: string;
  topoData: TopoData | null;
}

type PendingConfigRequest = PendingConfigSession;

type EmaneModel = 'bypass' | 'commeffect' | 'rfpipe' | 'tdma' | 'ieee80211abg';
type AddNodeCommand = {
  kind: 'addNode';
  nodeType: McpNodeType;
  name?: string;
  lat?: number;
  lon?: number;
  alt?: number;
  role?: OpenCliRole;
} & NodeCreateOptions;
type AddNodesGridCommand = {
  kind: 'addNodesGrid';
  nodeType: McpNodeType;
  count: number;
  prefix?: string;
  centerLat?: number;
  centerLon?: number;
  alt?: number;
  role?: OpenCliRole;
} & NodeCreateOptions;
type AddNodesBatchCommand = {
  kind: 'addNodesBatch';
  nodeType: McpNodeType;
  names: string[];
  centerLat?: number;
  centerLon?: number;
  alt?: number;
  role?: OpenCliRole;
} & NodeCreateOptions;
type ConnectNodesCommand = {
  kind: 'connectNodes';
  from: string;
  to: string;
  linkType?: 'WIRED' | 'WIRELESS';
} & LinkCreateOptions;
type AddLinksBatchCommand = {
  kind: 'addLinksBatch';
  pairs: Array<{ clientId?: string; from: string; to: string }>;
  linkType?: 'WIRED' | 'WIRELESS';
} & LinkCreateOptions;
type OpenCliMcpCommand =
  | OpenCliCommand
  | AddNodeCommand
  | AddNodesGridCommand
  | AddNodesBatchCommand
  | ConnectNodesCommand
  | AddLinksBatchCommand;

interface NodeCreateOptions {
  clientId?: string;
  emaneModel?: string;
  phyType?: string;
  emaneConfig?: Record<string, string | number | boolean | null | undefined>;
  server?: string;
  configServices?: string[];
  templateId?: number;
  rj45Interface?: string;
  tmvDeviceType?: 'transmitter' | 'receiver';
  businessDeviceType?: 'container' | 'transferTarget';
  userSelections?: Record<string, unknown>;
  skipConfigGate?: boolean;
}

interface LinkCreateOptions {
  clientId?: string;
  linkOptions?: Partial<LinkOptions>;
  fromIp?: string;
  toIp?: string;
  userSelections?: Record<string, unknown>;
  skipConfigGate?: boolean;
}

type NodeConfigValue = string | number | boolean | null | undefined;
type NodeStatusValue = 'UP' | 'DOWN';

interface NodeConfigUpdateInput {
  target: string;
  alias?: string;
  status?: NodeStatusValue;
  role?: OpenCliRole;
  server?: string;
  configServices?: string[];
  lat?: number;
  lon?: number;
  alt?: number;
  phyType?: string;
  emaneConfig?: Record<string, NodeConfigValue>;
}

interface VMConfigUpdateInput {
  target: string;
  templateId?: number;
  cpu?: number;
  memoryMb?: number;
  currentMemoryMb?: number;
  memory?: string;
  currentMemory?: string;
}

interface ProtocolToggleInput {
  enabled?: boolean;
  interfaces?: string[];
  areaId?: string | number;
  process?: string | number;
  netAddr?: string;
  localAs?: string | number;
  neighbors?: Array<{
    neighborIp?: string;
    neighborAs?: string | number;
  }>;
}

interface StaticRouteInput {
  destination?: string;
  nexthop?: string;
  interface?: string;
}

interface ProtocolConfigInput {
  target: string;
  ospf2?: ProtocolToggleInput;
  ospf3?: ProtocolToggleInput;
  rip?: ProtocolToggleInput;
  bgp?: ProtocolToggleInput;
  isis?: ProtocolToggleInput;
  pim?: ProtocolToggleInput;
  snapshot?: ProtocolToggleInput;
  backpressure?: ProtocolToggleInput;
  staticRoutes?: StaticRouteInput[];
  convergence?: {
    targetCidr?: string;
    maxAttempts?: number;
  };
}

interface TdmaScheduleInput {
  target: string;
  filePath?: string;
  slotCount?: number;
  slotWidth?: number;
  nodeSlotMap?: Record<string, number>;
}

interface CreationDraftNode {
  clientId?: string;
  actionId?: string;
  nodeType?: McpNodeType;
  name?: string;
  alias?: string;
  lat?: number;
  lon?: number;
  alt?: number;
  role?: OpenCliRole;
  count?: number;
  [key: string]: unknown;
}

interface CreationDraftLink {
  clientId?: string;
  from?: string;
  to?: string;
  fromClientId?: string;
  toClientId?: string;
  linkType?: 'WIRED' | 'WIRELESS';
  [key: string]: unknown;
}

interface CreationCompositeInput {
  title?: string;
  nodes?: CreationDraftNode[];
  links?: CreationDraftLink[];
  configStage?: string;
  partialSelections?: Record<string, unknown>;
}

interface CreationConfigSchemaInput {
  category?: string;
  item?: string;
  nodeType?: string;
  actionId?: string;
  configStage?: string;
  partialSelections?: Record<string, unknown>;
  composite?: CreationCompositeInput;
  forceNewConfigRequest?: boolean;
}

interface NodeCreationFormInput extends CreationConfigSchemaInput {
  nodeType?: McpNodeType;
  name?: string;
  names?: string[];
  count?: number;
  clientId?: string;
}

interface LinkCreationFormInput {
  from?: string;
  to?: string;
  pairs?: Array<{ from: string; to: string; clientId?: string }>;
  clientId?: string;
  linkType?: 'WIRED' | 'WIRELESS';
}

interface TopoWaitResult {
  topo: TopoData;
  attempts: number;
  settled: boolean;
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

const FRONTEND_LINK_LAYER_MODELS = [
  { value: 'bypass', label: 'Bypass', description: '简单的旁路模型，适用于直接测试' },
  { value: 'commeffect', label: 'CommEffect', description: '通信效果模型，提供基础的延迟和丢包功能' },
  { value: 'rfpipe', label: 'RF Pipe', description: '无线频率管道模型，用于模拟基本射频通信' },
  { value: 'tdma', label: 'TDMA', description: '时分多址接入模型，适用于模拟多用户时分接入场景' },
  { value: 'ieee80211abg', label: 'IEEE 802.11 a/b/g', description: 'WiFi 模型，基于 IEEE 802.11 a/b/g 标准' },
  { value: 'ieee802.3', label: 'IEEE 802.3', description: '以太网模型，基于 IEEE 802.3 标准', backendModel: 'tdma' },
  { value: 'ieee802.15.4', label: 'IEEE 802.15.4', description: 'Zigbee 模型，支持低功耗设备通信', backendModel: 'tdma' },
  { value: 'ieee802.1Qbv', label: 'IEEE 802.1Qbv', description: 'TSN 模型，提供确定性传输调度', backendModel: 'ieee80211abg' },
  { value: 'ieee802.1CB', label: 'IEEE 802.1CB', description: 'TSN 模型，提升网络可靠性', backendModel: 'ieee80211abg' },
  { value: 'ieee802.1Qbu', label: 'IEEE 802.1Qbu', description: 'TSN 模型，允许高优先级帧中断低优先级帧', backendModel: 'tdma' },
  { value: 'ieee802.1AS', label: 'IEEE 802.1AS', description: 'TSN 模型，实现亚微秒级时钟同步', backendModel: 'ieee80211abg' },
  { value: 'LTE', label: 'LTE', description: '长期演进模型，4G 移动通信标准', backendModel: 'tdma' },
];

const FRONTEND_PHYSICAL_LAYER_MODELS = [
  { value: 'fhss', label: 'FHSS', description: '跳频扩频技术，通过快速改变载波频率提高抗干扰能力' },
  { value: 'dsss', label: 'DSSS', description: '直接序列扩频技术，提供更高的数据传输安全性和抗干扰能力' },
  { value: 'ofdm', label: 'OFDM', description: '正交频分复用技术，高效利用频谱资源，提高传输速率' },
  { value: 'pdcch', label: 'PDCCH', description: '物理下行控制信道，用于 LTE 和 5G 网络的控制信息传输' },
  { value: 'pbch', label: 'PBCH', description: '物理广播信道，用于传输主要系统信息和网络配置' },
  { value: 'cdma', label: 'CDMA', description: '码分多址技术，使用直接扩频实现多用户同频共享，具有抗干扰和软切换能力' },
  { value: 'zigbee', label: 'ZigBee', description: '基于 IEEE 802.15.4 的低功耗无线网状网络技术，支持 O-QPSK 调制和 DSSS 扩频' },
  { value: 'prach', label: 'PRACH', description: '物理随机接入信道，使用 Zadoff-Chu 序列实现 LTE/5G 网络的初始接入和同步' },
];

const FRONTEND_PHY_OPTIONS_BY_LINK_LAYER: Record<string, string[]> = {
  bypass: ['cdma'],
  commeffect: ['cdma'],
  rfpipe: ['fhss', 'dsss', 'cdma'],
  tdma: ['fhss', 'ofdm'],
  ieee80211abg: ['dsss', 'fhss', 'ofdm'],
  'ieee802.3': ['wired'],
  'ieee802.15.4': ['dsss', 'zigbee'],
  'ieee802.1Qbv': ['wired'],
  'ieee802.1CB': ['wired'],
  'ieee802.1Qbu': ['wired'],
  'ieee802.1AS': ['wired'],
  LTE: ['ofdm', 'pdcch', 'pbch', 'prach'],
};

const FRONTEND_EMANE_MODEL_MAPPINGS: Record<string, EmaneModel> = {
  'ieee802.3': 'tdma',
  'ieee802.15.4': 'tdma',
  'ieee802.1qbv': 'ieee80211abg',
  'ieee802.1cb': 'ieee80211abg',
  'ieee802.1qbu': 'tdma',
  'ieee802.1as': 'ieee80211abg',
  lte: 'tdma',
};

const EMANE_MODELS = new Set<EmaneModel>(['bypass', 'commeffect', 'rfpipe', 'tdma', 'ieee80211abg']);
const RFPIPE_PHY_TYPES = new Set(['fhss', 'dsss', 'cdma']);

function normalizeEmaneModel(value?: string): EmaneModel {
  const normalized = String(value || 'rfpipe').trim().toLowerCase();
  if (FRONTEND_EMANE_MODEL_MAPPINGS[normalized]) return FRONTEND_EMANE_MODEL_MAPPINGS[normalized];
  return EMANE_MODELS.has(normalized as EmaneModel) ? normalized as EmaneModel : 'rfpipe';
}

function normalizePhyType(value: string | undefined, model: EmaneModel): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (model === 'bypass' || model === 'commeffect') return normalized === 'cdma' ? 'cdma' : 'cdma';
  if (model === 'rfpipe') return RFPIPE_PHY_TYPES.has(normalized) ? normalized : 'fhss';
  if (model === 'tdma') return ['fhss', 'ofdm'].includes(normalized) ? normalized : 'fhss';
  if (model === 'ieee80211abg') return ['dsss', 'fhss', 'ofdm'].includes(normalized) ? normalized : 'fhss';
  return normalized || 'fhss';
}

function canonicalFrontendLinkLayer(value?: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  const matched = FRONTEND_LINK_LAYER_MODELS.find((model) => model.value.toLowerCase() === normalized);
  return matched?.value || String(value || '').trim();
}

function frontendPhyOptions(value?: string): string[] {
  const canonical = canonicalFrontendLinkLayer(value);
  return FRONTEND_PHY_OPTIONS_BY_LINK_LAYER[canonical] || FRONTEND_PHY_OPTIONS_BY_LINK_LAYER[canonical.toLowerCase()] || [];
}

function isFrontendWiredLinkLayer(value?: string): boolean {
  return frontendPhyOptions(value).includes('wired');
}

function frontendDisplayModel(value?: string, backendModel?: EmaneModel): string | null {
  const canonical = canonicalFrontendLinkLayer(value);
  if (!canonical) return null;
  const backend = backendModel || normalizeEmaneModel(canonical);
  return canonical.toLowerCase() === backend.toLowerCase() ? null : canonical;
}

function normalizeFrontendPhyType(value: string | undefined, frontendModel: string | undefined, backendModel: EmaneModel): string {
  const normalized = String(value || '').trim().toLowerCase();
  const options = frontendPhyOptions(frontendModel).map((option) => option.toLowerCase());
  if (options.includes('wired')) return '';
  if (normalized && options.includes(normalized)) return normalized;
  return normalizePhyType(value, backendModel);
}

function stringifyConfigValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value ?? '');
}

function emaneOption(
  key: string,
  value: string | number | boolean | null | undefined,
  group: string,
  type = 4,
  select: string[] = []
): ConfigOption {
  return {
    label: key,
    name: key,
    value: stringifyConfigValue(value),
    type,
    select,
    group,
  };
}

function emaneConfigItem(
  model: string,
  key: string,
  value: string,
  group: string,
  type?: number,
  select?: string[]
): EmaneConfig {
  return {
    ifaceId: -1,
    model,
    config: {
      [key]: emaneOption(key, value, group, type, select),
    },
  };
}

const RFPIPE_EXTERNAL: Record<string, string> = {
  external: '0',
  platformendpoint: '127.0.0.1:40001',
  transportendpoint: '127.0.0.1:50002',
};

const RFPIPE_MAC: Record<string, string> = {
  bitrate: '1000000',
  datarate: '1000000',
  delay: '0.000000',
  enablepromiscuousmode: '0',
  flowcontrolenable: '0',
  flowcontroltokens: '10',
  jitter: '0.000000',
  neighbormetricdeletetime: '60.000000',
  pcrcurveuri: '/usr/share/emane/xml/models/mac/rfpipe/rfpipepcr.xml',
  radiometricenable: '0',
  radiometricreportinterval: '1.000000',
  'rfsignaltable.averageallantennas': '0',
  'rfsignaltable.averageallfrequencies': '0',
  fragmentcheckthreshold: '2',
  fragmenttimeoutthreshold: '5',
  neighbormetricupdateinterval: '1.0',
  'queue.aggregationenable': '0',
  'queue.aggregationslotthreshold': '5',
  'queue.depth': '256',
  'queue.fragmentationenable': '0',
  'queue.strictdequeueenable': '0',
  schedule: '',
};

const TDMA_MAC: Record<string, string> = {
  ...RFPIPE_MAC,
  pcrcurveuri: '/usr/share/emane/xml/models/mac/tdmaeventscheduler/tdmabasemodelpcr.xml',
  'queue.aggregationenable': '1',
  'queue.aggregationslotthreshold': '90',
  'queue.fragmentationenable': '1',
};

const RFPIPE_PHY: Record<string, string> = {
  bandwidth: '1000000',
  compatibilitymode: '1',
  dopplershiftenable: '1',
  excludesamesubidfromfilterenable: '1',
  'fading.lognormal.dlthresh': '0.250000',
  'fading.lognormal.dmu': '5.000000',
  'fading.lognormal.dsigma': '1.000000',
  'fading.lognormal.duthresh': '0.750000',
  'fading.lognormal.lmean': '0.005000',
  'fading.lognormal.lstddev': '0.001000',
  'fading.lognormal.maxpathloss': '100.000000',
  'fading.lognormal.minpathloss': '0.000000',
  'fading.model': 'none',
  'fading.nakagami.distance0': '100.000000',
  'fading.nakagami.distance1': '250.000000',
  'fading.nakagami.m0': '0.750000',
  'fading.nakagami.m1': '1.000000',
  'fading.nakagami.m2': '200.000000',
  'fading.terahertz.atmosphericfactor': '0.1',
  'fading.terahertz.frequency': '300000000000',
  'fading.terahertz.rainrate': '0.0',
  'fading.timevarying.dopplerfrequency': '100.0',
  'fading.timevarying.fadingdepth': '10.0',
  'fading.timevarying.pathlossexponent': '2.0',
  fixedantennagain: '0.000000',
  fixedantennagainenable: '1',
  frequency: '2347000000',
  frequencyofinterest: '2347000000',
  noisebinsize: '20',
  noisemaxclampenable: '0',
  noisemaxmessagepropagation: '200000',
  noisemaxsegmentduration: '1000000',
  noisemaxsegmentoffset: '300000',
  noisemode: 'none',
  processingpoolsize: '0',
  propagationmodel: '2ray',
  rxsensitivitypromiscuousmodeenable: '0',
  spectralmaskindex: '0',
  'stats.observedpowertableenable': '1',
  'stats.receivepowertableenable': '1',
  subid: '1',
  systemnoisefigure: '4.000000',
  timesyncthreshold: '10000',
  txpower: '30.0',
  channelcode: 'none',
  randomlossenvironment: 'none',
};

const RFPIPE_PLATFORM: Record<string, string> = {
  antennaprofilemanifesturi: '',
  spectralmaskmanifesturi: '',
  eventservicedevice: 'ctrl0',
  eventservicegroup: '224.1.2.8:45703',
  eventservicettl: '1',
  otamanagerchannelenable: '1',
  otamanagerdevice: 'ctrl0',
  otamanagergroup: '224.1.2.8:45702',
  otamanagerloopback: '0',
  otamanagermtu: '0',
  otamanagerpartcheckthreshold: '2',
  otamanagerparttimeoutthreshold: '5',
  otamanagerttl: '1',
  'stats.event.maxeventcountrows': '0',
  'stats.ota.maxeventcountrows': '0',
  'stats.ota.maxpacketcountrows': '0',
};

const IEEE80211ABG_MAC_EXTRA: Record<string, string> = {
  aifs0: '0.000002',
  aifs1: '0.000002',
  aifs2: '0.000002',
  aifs3: '0.000001',
  channelactivityestimationtimer: '0.100000',
  cwmax0: '1024',
  cwmax1: '1024',
  cwmax2: '64',
  cwmax3: '16',
  cwmin0: '32',
  cwmin1: '32',
  cwmin2: '16',
  cwmin3: '8',
  distance: '1000',
  mode: '0',
  msdu0: '65535',
  msdu1: '65535',
  msdu2: '65535',
  msdu3: '65535',
  multicastrate: '1',
  neighbortimeout: '30.000000',
  queuesize0: '255',
  queuesize1: '255',
  queuesize2: '255',
  queuesize3: '255',
  retrylimit0: '2',
  retrylimit1: '2',
  retrylimit2: '2',
  retrylimit3: '2',
  rtsthreshold: '255',
  txop0: '0.000000',
  txop1: '0.000000',
  txop2: '0.000000',
  txop3: '0.000000',
  unicastrate: '4',
  wmmenable: '0',
};

const IEEE80211ABG_MAC: Record<string, string> = {
  bitrate: '1000000',
  datarate: '1000000',
  delay: '0.000000',
  jitter: '0.000000',
  enablepromiscuousmode: '0',
  flowcontrolenable: '0',
  flowcontroltokens: '10',
  neighbormetricdeletetime: '60.000000',
  pcrcurveuri: '/usr/share/emane/xml/models/mac/ieee80211abg/ieee80211pcr.xml',
  radiometricenable: '0',
  radiometricreportinterval: '1.000000',
  'rfsignaltable.averageallantennas': '0',
  'rfsignaltable.averageallfrequencies': '0',
  neighbormetricupdateinterval: '1.0',
  ...IEEE80211ABG_MAC_EXTRA,
};

const SUBNET_EXTERNAL_EDITABLE_KEYS = ['external', 'platformendpoint', 'transportendpoint'];
const SUBNET_RFPIPE_MAC_EDITABLE_KEYS = [
  'datarate',
  'delay',
  'enablepromiscuousmode',
  'flowcontrolenable',
  'flowcontroltokens',
  'jitter',
  'neighbormetricdeletetime',
  'pcrcurveuri',
  'radiometricenable',
  'radiometricreportinterval',
  'rfsignaltable.averageallantennas',
  'rfsignaltable.averageallfrequencies',
];
const SUBNET_TDMA_MAC_EDITABLE_KEYS = [
  'datarate',
  'flowcontrolenable',
  'flowcontroltokens',
  'fragmentcheckthreshold',
  'fragmenttimeoutthreshold',
  'neighbormetricdeletetime',
  'neighbormetricupdateinterval',
  'pcrcurveuri',
  'queue.aggregationenable',
  'queue.aggregationslotthreshold',
  'queue.depth',
  'queue.fragmentationenable',
  'queue.strictdequeueenable',
  'schedule',
];
const SUBNET_IEEE80211ABG_MAC_EDITABLE_KEYS = [
  'datarate',
  'mode',
  'unicastrate',
  'multicastrate',
  'rtsthreshold',
  'distance',
  'neighbortimeout',
  'pcrcurveuri',
  'wmmenable',
  'queuesize0',
  'queuesize1',
  'queuesize2',
  'queuesize3',
  'aifs0',
  'aifs1',
  'aifs2',
  'aifs3',
  'cwmin0',
  'cwmin1',
  'cwmin2',
  'cwmin3',
  'cwmax0',
  'cwmax1',
  'cwmax2',
  'cwmax3',
  'txop0',
  'txop1',
  'txop2',
  'txop3',
  'retrylimit0',
  'retrylimit1',
  'retrylimit2',
  'retrylimit3',
  'channelactivityestimationtimer',
];
const SUBNET_PHY_BASIC_KEYS = [
  'bandwidth',
  'channelcode',
  'compatibilitymode',
  'frequency',
  'frequencyofinterest',
  'propagationmodel',
  'subid',
  'systemnoisefigure',
  'txpower',
  'timesyncthreshold',
  'processingpoolsize',
  'spectralmaskindex',
  'randomlossenvironment',
];
const SUBNET_PHY_SWITCH_KEYS = [
  'dopplershiftenable',
  'excludesamesubidfromfilterenable',
  'fixedantennagainenable',
  'fixedantennagain',
  'rxsensitivitypromiscuousmodeenable',
];
const SUBNET_PHY_NOISE_KEYS = [
  'noisemode',
  'noisemaxclampenable',
  'noisebinsize',
  'noisemaxmessagepropagation',
  'noisemaxsegmentduration',
  'noisemaxsegmentoffset',
];
const SUBNET_PHY_FADING_MODEL_KEYS = ['fading.model'];
const SUBNET_PHY_LOGNORMAL_KEYS = [
  'fading.lognormal.dlthresh',
  'fading.lognormal.dmu',
  'fading.lognormal.dsigma',
  'fading.lognormal.duthresh',
  'fading.lognormal.lmean',
  'fading.lognormal.lstddev',
  'fading.lognormal.maxpathloss',
  'fading.lognormal.minpathloss',
];
const SUBNET_PHY_NAKAGAMI_KEYS = [
  'fading.nakagami.distance0',
  'fading.nakagami.distance1',
  'fading.nakagami.m0',
  'fading.nakagami.m1',
  'fading.nakagami.m2',
];
const SUBNET_PHY_TERAHERTZ_KEYS = [
  'fading.terahertz.atmosphericfactor',
  'fading.terahertz.frequency',
  'fading.terahertz.rainrate',
];
const SUBNET_PHY_TIMEVARYING_KEYS = [
  'fading.timevarying.dopplerfrequency',
  'fading.timevarying.fadingdepth',
  'fading.timevarying.pathlossexponent',
];
const SUBNET_PHY_STATS_KEYS = [
  'stats.observedpowertableenable',
  'stats.receivepowertableenable',
];
const SUBNET_PLATFORM_BASIC_KEYS = ['antennaprofilemanifesturi', 'spectralmaskmanifesturi'];
const SUBNET_PLATFORM_EVENT_KEYS = ['eventservicedevice', 'eventservicegroup', 'eventservicettl'];
const SUBNET_PLATFORM_OTA_KEYS = [
  'otamanagerchannelenable',
  'otamanagerdevice',
  'otamanagergroup',
  'otamanagerloopback',
  'otamanagermtu',
  'otamanagerpartcheckthreshold',
  'otamanagerparttimeoutthreshold',
  'otamanagerttl',
];
const SUBNET_PLATFORM_STATS_KEYS = [
  'stats.event.maxeventcountrows',
  'stats.ota.maxeventcountrows',
  'stats.ota.maxpacketcountrows',
];

const BOOLEAN_ZERO_ONE_KEYS = new Set([
  'enablepromiscuousmode',
  'flowcontrolenable',
  'radiometricenable',
  'queue.aggregationenable',
  'queue.fragmentationenable',
  'queue.strictdequeueenable',
]);

const BOOLEAN_ON_OFF_KEYS = new Set([
  'external',
  'dopplershiftenable',
  'excludesamesubidfromfilterenable',
  'fixedantennagainenable',
  'rxsensitivitypromiscuousmodeenable',
  'noisemaxclampenable',
  'stats.observedpowertableenable',
  'stats.receivepowertableenable',
  'otamanagerchannelenable',
  'otamanagerloopback',
]);

const SELECT_OPTIONS: Record<string, string[]> = {
  channelcode: ['none', 'ldpc12', 'ldpc23'],
  compatibilitymode: ['1', '0'],
  randomlossenvironment: ['none', 'urban', 'suburban'],
  noisemode: ['none', 'all', 'outofband', 'passthrough'],
  propagationmodel: ['precomputed', '2ray', 'freespace'],
  'fading.model': ['none', 'lognormal', 'nakagami', 'rician', 'rayleigh', 'terahertz', 'timevarying'],
  mode: ['0', '1', '2', '3'],
  unicastrate: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  multicastrate: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  wmmenable: ['0', '1'],
};

function emaneParamType(key: string, group: string): { type: number; select: string[] } {
  if (BOOLEAN_ZERO_ONE_KEYS.has(key)) return { type: 2, select: ['0', '1'] };
  if (BOOLEAN_ON_OFF_KEYS.has(key)) return { type: 11, select: ['On', 'Off'] };
  if (SELECT_OPTIONS[key]) return { type: 10, select: SELECT_OPTIONS[key] };
  if (['eventservicettl', 'otamanagerttl'].includes(key)) return { type: 1, select: [] };
  if (['otamanagerpartcheckthreshold', 'otamanagerparttimeoutthreshold'].includes(key)) return { type: 2, select: [] };
  if (
    [
      'otamanagermtu',
      'stats.event.maxeventcountrows',
      'stats.ota.maxeventcountrows',
      'stats.ota.maxpacketcountrows',
    ].includes(key)
  ) {
    return { type: 3, select: [] };
  }
  if (group === 'External Parameters' || group === 'Platform Parameters') return { type: 10, select: [] };
  if (
    [
      'systemnoisefigure',
      'txpower',
      'neighbormetricdeletetime',
      'delay',
      'jitter',
      'noisebinsize',
      'noisemaxmessagepropagation',
      'noisemaxsegmentduration',
      'noisemaxsegmentoffset',
    ].includes(key) ||
    key.startsWith('fading.lognormal') ||
    key.startsWith('fading.nakagami') ||
    key.startsWith('fading.terahertz') ||
    key.startsWith('fading.timevarying')
  ) {
    return { type: 9, select: [] };
  }

  return { type: 4, select: [] };
}

function configGroup(modelName: string, values: Record<string, string>, group: string): EmaneConfig[] {
  return Object.entries(values)
    .filter(([key, value]) => key !== 'none' && value !== '')
    .map(([key, value]) => {
      const meta = emaneParamType(key, group);
      return emaneConfigItem(modelName, key, value, group, meta.type, meta.select);
    });
}

function createDefaultEmaneConfig(
  model: EmaneModel,
  overrides: Record<string, string | number | boolean | null | undefined> = {}
): EmaneConfig[] {
  const modelName = `emane_${model}`;
  const macDefaults =
    model === 'tdma' ? TDMA_MAC :
    model === 'ieee80211abg' ? IEEE80211ABG_MAC :
    RFPIPE_MAC;
  const configs = [
    ...configGroup(modelName, RFPIPE_EXTERNAL, 'External Parameters'),
    ...configGroup(modelName, macDefaults, 'MAC Parameters'),
    ...configGroup(modelName, RFPIPE_PHY, 'PHY Parameters'),
    ...configGroup(modelName, RFPIPE_PLATFORM, 'Platform Parameters'),
  ];

  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === 'undefined') return;

    const existing = configs.find((item) => item.config && Object.prototype.hasOwnProperty.call(item.config, key));
    if (existing) {
      existing.config[key].value = stringifyConfigValue(value);
      return;
    }

    const meta = emaneParamType(key, 'PHY Parameters');
    configs.push(emaneConfigItem(modelName, key, stringifyConfigValue(value), 'PHY Parameters', meta.type, meta.select));
  });

  return configs;
}

function toBackendNodeType(type: McpNodeType): { type: string; model: string; image: string } {
  switch (type) {
    case 'DRONE':
    case 'VAN':
      return { type: 'DRONE', model: 'prouter', image: '' };
    case 'BASESTATION':
    case 'SATELLITE':
      return { type: 'BASESTATION', model: 'prouter', image: '' };
    case 'ROUTER':
      return { type: 'DOCKER', model: '', image: 'nest:v3' };
    case 'DEFAULT':
      return { type: 'DOCKER', model: '', image: 'nest:v3' };
    case 'DOCKER':
      return { type: 'DOCKER', model: 'docker', image: 'nest:v3' };
    case 'VMNODE':
      return { type: 'VMNODE', model: 'vm', image: '/home/feuille/vm-template/cirros.xml' };
    case 'RJ45':
      return { type: 'RJ45', model: 'rj45', image: '' };
    case 'SWITCH':
      return { type: 'SWITCH', model: 'switch', image: '' };
    case 'INODE':
    case 'INTERFERENCE':
      return { type: 'INODE', model: 'inode', image: '' };
    case 'EMANE':
      return { type: 'EMANE', model: 'emane', image: '' };
    case 'TMV':
      return { type: 'DOCKER', model: '', image: 'tmv:v1' };
    case 'BUSINESS_Transmitter':
      return { type: 'DOCKER', model: '', image: 'data:v1' };
    case 'ATTACK_MACHINE':
    case 'SECURITY_MACHINE':
      return { type: 'DOCKER', model: '', image: 'attack:v2.3' };
    case 'SDN_CONTROLLER':
    case 'Ovs_SWITCH':
      return { type: 'DOCKER', model: '', image: 'sdn:v1.1' };
    case 'P4_SWITCH':
      return { type: 'DOCKER', model: '', image: 'p4lang/bm-4c:v1.0' };
    case 'SR_SWITCH':
      return { type: 'DOCKER', model: '', image: 'sdn:v1.3' };
    case 'HTTP':
      return { type: 'DOCKER', model: '', image: 'http:v1' };
    case 'FTP':
      return { type: 'DOCKER', model: '', image: 'ftp:v1' };
    case 'DNS':
      return { type: 'DOCKER', model: '', image: 'dns:v1' };
    case 'SMTP':
      return { type: 'DOCKER', model: '', image: 'smtp:v1' };
    case 'VoIP-SIP':
      return { type: 'DOCKER', model: '', image: 'voip:v1' };
    case 'TLS':
      return { type: 'DOCKER', model: '', image: 'tls:v1' };
    case 'RTSP-RTP':
      return { type: 'DOCKER', model: '', image: 'rtsp:v1' };
    case 'MQTT':
      return { type: 'DOCKER', model: '', image: 'mqtt:v1' };
    case 'CoAP':
      return { type: 'DOCKER', model: '', image: 'coap:v1' };
    case 'DDS':
      return { type: 'DOCKER', model: '', image: 'dds:v1' };
    case 'SSH':
      return { type: 'DOCKER', model: '', image: 'ssh:v1' };
    case 'PKI':
      return { type: 'DOCKER', model: '', image: 'pki:v1' };
    default:
      return { type: 'DOCKER', model: 'router', image: 'nest:v3' };
  }
}

const FRONTEND_NODE_CONFIG_CATALOG = {
  version: 1,
  sourceFiles: [
    'src/views/cesium/components/NodeConfigDialog.vue',
    'src/views/cesium/components/NodeInfoPanel.vue',
    'src/views/cesium/components/VMEditDialog.vue',
    'src/views/cesium/components/protocolConfigDialog.vue',
    'src/views/cesium/components/SlotConfigDialog.vue',
  ],
  sections: [
    {
      id: 'node-basic',
      title: 'Node basic info',
      fields: [
        { name: 'alias', widget: 'text', maxLength: 64, appliesTo: 'non-VM/non-INODE node info panel', mcpTool: 'opencli_update_node_config' },
        { name: 'status', widget: 'switch', values: ['UP', 'DOWN'], frontendMeaning: 'fault switch maps true to DOWN and false to UP', mcpTool: 'opencli_update_node_config' },
        { name: 'role', widget: 'select', values: [{ value: 1, label: 'white/public' }, { value: 2, label: 'red' }, { value: 3, label: 'blue' }], mcpTool: 'opencli_update_node_config' },
        { name: 'server', widget: 'select', optionSource: 'topology.servers', mcpTool: 'opencli_update_node_config' },
        { name: 'configServices', widget: 'multi-select', examples: ['zebra', 'OSPFv2', 'olsrd'], mcpTool: 'opencli_update_node_config' },
        { name: 'geo.lat', widget: 'number', mcpTool: 'opencli_update_node_config/opencli_move_node' },
        { name: 'geo.lon', widget: 'number', mcpTool: 'opencli_update_node_config/opencli_move_node' },
        { name: 'geo.alt', widget: 'number', mcpTool: 'opencli_update_node_config/opencli_move_node' },
      ],
    },
    {
      id: 'node-create',
      title: 'Node creation panel choices',
      fields: [
        { name: 'nodeType', widget: 'select', values: ['DRONE', 'VAN', 'EMANE', 'BASESTATION', 'SATELLITE', 'ROUTER', 'DEFAULT', 'VMNODE', 'RJ45', 'SWITCH', 'INODE', 'INTERFERENCE', 'DOCKER', 'TMV', 'BUSINESS_Transmitter', 'ATTACK_MACHINE', 'SECURITY_MACHINE', 'SDN_CONTROLLER', 'Ovs_SWITCH', 'P4_SWITCH', 'SR_SWITCH', 'HTTP', 'FTP', 'DNS', 'SMTP', 'VoIP-SIP', 'TLS', 'RTSP-RTP', 'MQTT', 'CoAP', 'DDS', 'SSH', 'PKI'], mcpTool: 'opencli_add_node' },
        { name: 'rj45Interface', widget: 'select', values: ['ens52f0', 'ens52f1', 'ens52f2', 'ens52f3'], appliesTo: 'RJ45 create dialog' },
        { name: 'formationEnabled', widget: 'checkbox', appliesTo: 'batch UAV formation create dialog' },
        { name: 'formationCount', widget: 'number', appliesTo: 'batch UAV formation create dialog' },
        { name: 'formationRadius', widget: 'number', appliesTo: 'batch UAV formation create dialog' },
        { name: 'formationHeight', widget: 'number', appliesTo: 'batch UAV formation create dialog' },
        { name: 'templateId', widget: 'select', optionSource: 'VM templates', appliesTo: 'VMNODE create/edit', mcpTool: 'opencli_vm_templates/opencli_update_vm_config' },
        { name: 'deviceType', widget: 'select', values: ['transmitter', 'receiver', 'container', 'transferTarget'], appliesTo: 'TMV/business node create dialog' },
      ],
    },
    {
      id: 'vm-config',
      title: 'VM node parameters',
      fields: [
        { name: 'templateId', widget: 'select', optionSource: 'opencli_vm_templates', mcpTool: 'opencli_update_vm_config' },
        { name: 'cpu', widget: 'number', min: 1, max: 16, step: 1, mcpTool: 'opencli_update_vm_config' },
        { name: 'memoryMb', widget: 'number', min: 512, max: 32768, step: 512, storedAs: 'memory KB string', mcpTool: 'opencli_update_vm_config' },
        { name: 'currentMemoryMb', widget: 'number', min: 512, max: 32768, step: 512, storedAs: 'currentMemory KB string', mcpTool: 'opencli_update_vm_config' },
      ],
    },
    {
      id: 'protocol-config',
      title: 'Router protocol dialog',
      fields: [
        { name: 'ospf2.enabled/interfaces/areaId', widget: 'checkbox + multi-select + text', backendKeys: ['protocolOspf2', 'ospf2Interfaces', 'ospf2Area'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'ospf3.enabled/interfaces/areaId', widget: 'checkbox + multi-select + text', backendKeys: ['protocolOspf3', 'ospf3Interfaces', 'ospf3Area'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'rip.enabled/interfaces', widget: 'checkbox + multi-select', backendKeys: ['protocolRip', 'ripInterfaces'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'bgp.enabled/localAs/neighbors', widget: 'checkbox + text + repeated neighbor rows', backendKeys: ['protocolBgp', 'bgpLocalAs', 'bgpNeighborIp', 'bgpNeighborAs'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'isis.enabled/interfaces/process/netAddr', widget: 'checkbox + multi-select + text', backendKeys: ['protocolIsis', 'isisInterfaces', 'isisProcess', 'isisNet'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'pim.enabled/interfaces', widget: 'checkbox + multi-select', backendKeys: ['protocolPim', 'pimInterfaces'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'snapshot.enabled/interfaces', widget: 'checkbox + multi-select', backendKeys: ['protocolSnapshot', 'snapshotInterfaces'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'backpressure.enabled/interfaces', widget: 'checkbox + multi-select', backendKeys: ['protocolBackpressure', 'backpressureInterfaces'], mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'staticRoutes', widget: 'repeated rows', rowFields: ['destination', 'nexthop', 'interface'], backendKey: 'exJson.static_routes', mcpTool: 'opencli_set_node_protocol_config' },
        { name: 'convergence.targetCidr/maxAttempts', widget: 'text + number', backendKeys: ['targetCidr', 'maxAttempts'], mcpTool: 'opencli_set_node_protocol_config' },
      ],
    },
    {
      id: 'tdma-slot-config',
      title: 'TDMA slot schedule',
      fields: [
        { name: 'filePath', widget: 'text', default: '/usr/local/share/core/tdmaschedule/schedule1.xml', backendKey: 'savePath', mcpTool: 'opencli_generate_tdma_schedule' },
        { name: 'slotCount', widget: 'number', min: 'connected node count or 1', max: 100, backendKey: 'slots', mcpTool: 'opencli_generate_tdma_schedule' },
        { name: 'slotWidth', widget: 'number', min: 1, max: 100000, backendKey: 'slotduration', mcpTool: 'opencli_generate_tdma_schedule' },
        { name: 'nodeSlotMap', widget: 'record<node id/name/alias, slot index>', backendKey: 'slotList', mcpTool: 'opencli_generate_tdma_schedule' },
      ],
    },
    {
      id: 'emane-subnet-config',
      title: 'EMANE subnet parameters',
      fields: [
        { name: 'phyType', widget: 'select', values: ['fhss', 'dsss', 'cdma', 'ofdm'], mcpTool: 'opencli_update_node_config/opencli_add_node' },
        { name: 'emaneConfig', widget: 'record<parameterName, value>', optionSource: 'node.emane_configs', examples: ['frequency', 'bandwidth', 'txpower', 'propagationmodel'], mcpTool: 'opencli_update_node_config/opencli_add_node' },
      ],
    },
  ],
};

const FRONTEND_CREATION_CONFIG_CATALOG = {
  version: 1,
  purpose: 'Mirror the frontend left sidebar creation flow so an AI client can ask users for the same fields before calling MCP write tools.',
  sourceFiles: [
    'src/views/cesium/components/SideBar.vue',
    'src/views/cesium/components/NodeConfigDialog.vue',
    'src/views/cesium/components/LinkConfigDialog.vue',
    'src/views/cesium/components/SubnetConfigDialog.vue',
    'src/views/cesium/components/InterferenceNodeConfigDialog.vue',
    'src/views/cesium/components/InterferenceConfigDialog.vue',
    'src/views/cesium/components/VMEditDialog.vue',
  ],
  categories: [
    {
      title: '设备管理',
      type: 'device',
      items: [
        { label: '虚拟机', actionId: 'device.vm', nodeType: 'VMNODE' },
        { label: '无人机', actionId: 'device.drone', nodeType: 'DRONE' },
        { label: '机动车', actionId: 'device.van', nodeType: 'VAN' },
        { label: '卫星', actionId: 'device.satellite', nodeType: 'SATELLITE' },
        { label: '路由器', actionId: 'device.router', nodeType: 'ROUTER' },
        { label: '交换机', actionId: 'device.switch', nodeType: 'SWITCH' },
        { label: '基站', actionId: 'device.basestation', nodeType: 'BASESTATION' },
        { label: '视频服务器', actionId: 'device.rtsp', nodeType: 'RTSP-RTP' },
        { label: '攻击机', actionId: 'device.attack', nodeType: 'ATTACK_MACHINE' },
        { label: '安全机', actionId: 'device.security', nodeType: 'SECURITY_MACHINE' },
        { label: 'SDN控制器', actionId: 'device.sdn', nodeType: 'SDN_CONTROLLER' },
        { label: 'Ovs交换机', actionId: 'device.ovs', nodeType: 'Ovs_SWITCH' },
        { label: 'P4交换机', actionId: 'device.p4', nodeType: 'P4_SWITCH' },
        { label: 'SR交换机', actionId: 'device.sr', nodeType: 'SR_SWITCH' },
        { label: 'PKI模型', actionId: 'device.pki', nodeType: 'PKI' },
      ],
    },
    {
      title: '链路管理',
      type: 'link',
      items: [
        { label: '添加链路', actionId: 'link.add', submitTool: 'opencli_connect_nodes' },
        { label: '删除链路', actionId: 'link.delete', submitTool: 'opencli_delete_links_batch' },
      ],
    },
    {
      title: '子网管理',
      type: 'subnet',
      items: [
        { label: '添加子网', actionId: 'subnet.add', nodeType: 'EMANE' },
        { label: '删除子网', actionId: 'subnet.delete', submitTool: 'opencli_delete_node' },
      ],
    },
    {
      title: '干扰管理',
      type: 'interference',
      items: [
        { label: '添加干扰', actionId: 'interference.add', nodeType: 'INTERFERENCE' },
        { label: '删除干扰', actionId: 'interference.delete', submitTool: 'opencli_delete_node' },
      ],
    },
    {
      title: '半实物管理',
      type: 'hardware',
      items: [
        { label: '添加半实物', actionId: 'hardware.add', nodeType: 'RJ45' },
        { label: '删除半实物', actionId: 'hardware.delete', submitTool: 'opencli_delete_node' },
      ],
    },
    {
      title: '业务管理',
      type: 'business',
      items: [
        { label: '流量终端', actionId: 'business.tmv', nodeType: 'TMV' },
        { label: '业务终端', actionId: 'business.transmitter', nodeType: 'BUSINESS_Transmitter' },
      ],
    },
    {
      title: '应用层模型管理',
      type: 'application',
      items: [
        { label: 'HTTP', actionId: 'application.http', nodeType: 'HTTP' },
        { label: 'TLS', actionId: 'application.tls', nodeType: 'TLS' },
        { label: 'FTP', actionId: 'application.ftp', nodeType: 'FTP' },
        { label: 'DNS', actionId: 'application.dns', nodeType: 'DNS' },
        { label: 'SMTP', actionId: 'application.smtp', nodeType: 'SMTP' },
        { label: 'VoIP-SIP', actionId: 'application.voip', nodeType: 'VoIP-SIP' },
        { label: 'MQTT', actionId: 'application.mqtt', nodeType: 'MQTT' },
        { label: 'CoAP', actionId: 'application.coap', nodeType: 'CoAP' },
        { label: 'DDS', actionId: 'application.dds', nodeType: 'DDS' },
        { label: 'SSH', actionId: 'application.ssh', nodeType: 'SSH' },
      ],
    },
  ],
  distributedCategories: [
    {
      title: '设备管理',
      type: 'device',
      items: [
        { label: '无人机', actionId: 'device.drone', nodeType: 'DRONE' },
        { label: '路由器', actionId: 'device.router', nodeType: 'ROUTER' },
      ],
    },
    {
      title: '链路管理',
      type: 'link',
      items: [
        { label: '添加链路', actionId: 'link.add', submitTool: 'opencli_connect_nodes' },
        { label: '分布式链路配置', actionId: 'link.distributed', status: 'schema-only' },
        { label: '删除链路', actionId: 'link.delete', submitTool: 'opencli_delete_links_batch' },
      ],
    },
    {
      title: '子网管理',
      type: 'subnet',
      items: [
        { label: '添加子网', actionId: 'subnet.add', nodeType: 'EMANE' },
        { label: '删除子网', actionId: 'subnet.delete', submitTool: 'opencli_delete_node' },
      ],
    },
  ],
  submitRules: [
    { name: 'userSelections', meaning: '用户在 AI 界面中选择或填写后的字段值。MCP 只接受这个对象作为创建配置来源，并要求携带上一轮返回的 configRequestId。' },
    { rule: '调用 opencli_add_node/opencli_add_nodes_grid/opencli_add_nodes_batch/opencli_connect_nodes/opencli_add_links_batch 时，如果没有 userSelections，MCP 只返回配置需求，不执行后端写入。' },
    { rule: '默认值只作为字段说明里的 default/defaultMode 展示给用户。MCP 不会因为默认值存在而替用户选择。' },
    { rule: '用户选择默认值时，也必须由客户端把这些默认值和 configRequestId 放进 userSelections 显式传回。' },
  ],
  sharedFields: {
    basicNode: [
      { name: 'name', label: '节点名称', widget: 'text', required: true, description: '对应前端 nodeForm.alias；MCP 写入时会作为 name/alias 使用，必须用户填写或确认。' },
      { name: 'alias', label: '显示名称', widget: 'text', required: false, mcpArgument: 'name', description: '可选别名；不传时使用 name。' },
      { name: 'lat', label: '纬度', widget: 'number', required: true, description: '前端点击放置时由位置生成；AI 界面必须让用户填写或确认位置。' },
      { name: 'lon', label: '经度', widget: 'number', required: true, description: '前端点击放置时由位置生成；AI 界面必须让用户填写或确认位置。' },
      { name: 'alt', label: '高度/Z', widget: 'number', required: true, default: 200, min: 0 },
      { name: 'role', label: '节点角色', widget: 'radio', required: true, default: 1, options: [{ value: 1, label: '公共' }, { value: 2, label: '红方' }, { value: 3, label: '蓝方' }] },
    ],
    protocolServices: [
      { name: 'enableZebra', label: 'Zebra协议', widget: 'checkbox', default: true, mapsTo: 'configServices includes zebra' },
      { name: 'enableOSPF', label: 'OSPF协议', widget: 'checkbox', default: true, mapsTo: 'configServices includes OSPFv2' },
      { name: 'enableOLSR', label: 'OLSR协议', widget: 'checkbox', default: true, mapsTo: 'configServices includes olsrd' },
    ],
    routerProtocolServices: [
      { name: 'enableZebra', label: 'Zebra协议', widget: 'checkbox', default: true, mapsTo: 'configServices includes zebra' },
      { name: 'enableOSPF', label: 'OSPFv2协议', widget: 'checkbox', default: true, mapsTo: 'configServices includes OSPFv2' },
      { name: 'enableBGP', label: 'BGP协议', widget: 'checkbox', default: false, mapsTo: 'configServices includes BGP' },
      { name: 'enableRIP', label: 'RIP协议', widget: 'checkbox', default: false, mapsTo: 'configServices includes RIP' },
    ],
    quickPlacement: [
      { name: 'formationEnabled', label: '多节点放置', widget: 'checkbox', default: false, submitToolWhenTrue: 'opencli_add_nodes_grid' },
      { name: 'formationCount', label: '节点数量', widget: 'number', min: 3, max: 1000, default: 5, mcpArgument: 'count' },
      { name: 'formationRadius', label: '编队半径(米)', widget: 'number', min: 50, max: 10000, step: 50, default: 200, frontendOnly: true },
      { name: 'formationHeight', label: '高度差(米)', widget: 'number', min: 0, max: 1000, step: 10, default: 20, frontendOnly: true },
    ],
  },
  actions: {
    'device.vm': {
      label: '虚拟机',
      category: 'device',
      nodeType: 'VMNODE',
      submitTool: 'opencli_add_node',
      backendEndpoint: '/node/addVMNode when templateId is provided',
      fields: [
        { ref: 'basicNode' },
        { name: 'templateId', label: '选择模板', widget: 'select', required: true, optionSource: 'opencli_vm_templates', mcpArgument: 'templateId' },
        { name: 'templatePreview', label: '模板描述/CPU/内存/磁盘文件', widget: 'readonly', optionSource: 'selected VM template' },
      ],
    },
    'device.drone': {
      label: '无人机',
      category: 'device',
      nodeType: 'DRONE',
      submitTool: 'opencli_add_node or opencli_add_nodes_grid',
      fields: [
        { ref: 'basicNode' },
        { ref: 'quickPlacement' },
        { ref: 'protocolServices', distributedOverride: { enableOLSR: false } },
        { name: 'server', label: 'SERVER', widget: 'select', required: false, optionSource: 'topology.servers', visibleWhen: 'distributed scene' },
      ],
    },
    'device.van': {
      label: '机动车',
      category: 'device',
      nodeType: 'VAN',
      backendType: 'DRONE',
      submitTool: 'opencli_add_node or opencli_add_nodes_grid',
      fields: [{ ref: 'basicNode' }, { ref: 'quickPlacement' }, { ref: 'protocolServices' }],
    },
    'device.satellite': {
      label: '卫星',
      category: 'device',
      nodeType: 'SATELLITE',
      backendType: 'BASESTATION',
      submitTool: 'opencli_add_node',
      fields: [{ ref: 'basicNode' }, { ref: 'protocolServices' }],
    },
    'device.router': {
      label: '路由器',
      category: 'device',
      nodeType: 'ROUTER',
      submitTool: 'opencli_add_node or opencli_add_nodes_grid',
      frontendLogic: 'Normal scene maps to DOCKER/nest:v3; distributed scene maps to DEFAULT/router.',
      fields: [
        { ref: 'basicNode' },
        { ref: 'quickPlacement' },
        { ref: 'routerProtocolServices', visibleWhen: 'distributed scene' },
        { name: 'server', label: 'SERVER', widget: 'select', required: false, optionSource: 'topology.servers', visibleWhen: 'distributed scene' },
      ],
    },
    'device.switch': { label: '交换机', category: 'device', nodeType: 'SWITCH', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.basestation': { label: '基站', category: 'device', nodeType: 'BASESTATION', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }, { ref: 'protocolServices' }] },
    'device.rtsp': { label: '视频服务器', category: 'device', nodeType: 'RTSP-RTP', backendImage: 'rtsp:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.attack': { label: '攻击机', category: 'device', nodeType: 'ATTACK_MACHINE', backendImage: 'attack:v2.3', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.security': { label: '安全机', category: 'device', nodeType: 'SECURITY_MACHINE', backendImage: 'attack:v2.3', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.sdn': { label: 'SDN控制器', category: 'device', nodeType: 'SDN_CONTROLLER', backendImage: 'sdn:v1.1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.ovs': { label: 'Ovs交换机', category: 'device', nodeType: 'Ovs_SWITCH', backendImage: 'sdn:v1.1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.p4': { label: 'P4交换机', category: 'device', nodeType: 'P4_SWITCH', backendImage: 'p4lang/bm-4c:v1.0', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.sr': { label: 'SR交换机', category: 'device', nodeType: 'SR_SWITCH', backendImage: 'sdn:v1.3', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'device.pki': { label: 'PKI模型', category: 'device', nodeType: 'PKI', backendImage: 'pki:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.http': { label: 'HTTP', category: 'application', nodeType: 'HTTP', backendImage: 'http:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.tls': { label: 'TLS', category: 'application', nodeType: 'TLS', backendImage: 'tls:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.ftp': { label: 'FTP', category: 'application', nodeType: 'FTP', backendImage: 'ftp:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.dns': { label: 'DNS', category: 'application', nodeType: 'DNS', backendImage: 'dns:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.smtp': { label: 'SMTP', category: 'application', nodeType: 'SMTP', backendImage: 'smtp:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.voip': { label: 'VoIP-SIP', category: 'application', nodeType: 'VoIP-SIP', backendImage: 'voip:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.mqtt': { label: 'MQTT', category: 'application', nodeType: 'MQTT', backendImage: 'mqtt:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.coap': { label: 'CoAP', category: 'application', nodeType: 'CoAP', backendImage: 'coap:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.dds': { label: 'DDS', category: 'application', nodeType: 'DDS', backendImage: 'dds:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'application.ssh': { label: 'SSH', category: 'application', nodeType: 'SSH', backendImage: 'ssh:v1', submitTool: 'opencli_add_node', fields: [{ ref: 'basicNode' }] },
    'business.tmv': {
      label: '流量终端',
      category: 'business',
      nodeType: 'TMV',
      backendImage: 'tmv:v1',
      submitTool: 'opencli_add_node',
      fields: [
        { ref: 'basicNode' },
        { name: 'tmvDeviceType', label: '设备类型', widget: 'radio', default: 'transmitter', options: [{ value: 'transmitter', label: '发送机' }, { value: 'receiver', label: '接收机' }] },
      ],
    },
    'business.transmitter': {
      label: '业务终端',
      category: 'business',
      nodeType: 'BUSINESS_Transmitter',
      backendImage: 'data:v1',
      submitTool: 'opencli_add_node',
      fields: [
        { ref: 'basicNode' },
        { name: 'businessDeviceType', label: '设备类型', widget: 'radio', default: 'container', options: [{ value: 'container', label: '发送机' }, { value: 'transferTarget', label: '接收机' }] },
      ],
    },
    'hardware.add': {
      label: '添加半实物',
      category: 'hardware',
      nodeType: 'RJ45',
      submitTool: 'opencli_add_node',
      fields: [
        { ref: 'basicNode' },
        { name: 'rj45Interface', label: '物理网口', widget: 'select', required: true, options: ['ens52f0', 'ens52f1', 'ens52f2', 'ens52f3'] },
      ],
    },
    'subnet.add': {
      label: '添加子网',
      category: 'subnet',
      nodeType: 'EMANE',
      submitTool: 'opencli_add_node',
      fields: [
        { ref: 'basicNode' },
        { name: 'emaneModel', label: '链路层模型', widget: 'select', required: true, defaultMode: 'frontend opens with no selected model; MCP only displays defaults', options: FRONTEND_LINK_LAYER_MODELS },
        { name: 'phyType', label: '物理层模型', widget: 'select', required: true, defaultMode: 'must be chosen from the selected link-layer model', options: FRONTEND_PHYSICAL_LAYER_MODELS, optionsByEmaneModel: FRONTEND_PHY_OPTIONS_BY_LINK_LAYER },
        { name: 'emaneConfig', label: 'EMANE 参数', widget: 'record', required: true, defaultMode: 'frontend defaults must be explicitly returned in userSelections if the user accepts them', examples: ['datarate', 'delay', 'frequency', 'bandwidth', 'txpower', 'propagationmodel'], configGroups: ['External Parameters', 'MAC Parameters', 'PHY Parameters', 'Platform Parameters'] },
      ],
    },
    'interference.add': {
      label: '添加干扰',
      category: 'interference',
      nodeType: 'INTERFERENCE',
      backendType: 'INODE',
      submitTool: 'opencli_add_node',
      followUpTool: 'opencli_update_node_config for location/status; interference parameter backend tool is not exposed yet',
      fields: [
        { ref: 'basicNode' },
        { name: 'interfereType', label: '干扰类型', widget: 'radio', default: '压制', options: ['压制', '干扰'], schemaOnly: true },
        { name: 'interferePowerdb', label: '干扰功率', widget: 'number', min: 0, max: 110, step: 10, default: 50, schemaOnly: true },
        { name: 'interfereFreq', label: '干扰频率', widget: 'number', min: 0, max: 9999999999, step: 100, defaultByType: { 压制: 0, 干扰: 2347000000 }, schemaOnly: true },
        { name: 'azimuth', label: '方位角区间', widget: 'range', min: 0, max: 360, default: [0, 360], schemaOnly: true },
        { name: 'elevation', label: '俯仰角区间', widget: 'range', min: -90, max: 90, default: [-90, 90], schemaOnly: true },
      ],
    },
    'link.add': {
      label: '添加链路',
      category: 'link',
      submitTool: 'opencli_connect_nodes',
      fields: [
        { name: 'from', label: '源节点', widget: 'select', required: true, optionSource: 'topology.nodes' },
        { name: 'to', label: '目标节点', widget: 'select', required: true, optionSource: 'topology.nodes' },
        { name: 'fromIface', label: '源端接口', widget: 'object', defaultMode: 'auto', fields: ['id', 'name', 'mac', 'ip', 'mask', 'ip6', 'ip6Mask'] },
        { name: 'toIface', label: '目标端接口', widget: 'object', defaultMode: 'auto', fields: ['id', 'name', 'mac', 'ip', 'mask', 'ip6', 'ip6Mask'] },
        { name: 'linkOptions.bandwidth', label: '带宽', widget: 'number', unit: 'bps', default: 0 },
        { name: 'linkOptions.delay', label: '延迟', widget: 'number', unit: 'ms', default: 0 },
        { name: 'linkOptions.loss', label: '丢包率', widget: 'number', unit: '%', default: 0 },
        { name: 'linkOptions.jitter', label: '抖动', widget: 'number', unit: 'ms', default: 0 },
        { name: 'linkOptions.buffer', label: '缓冲区', widget: 'number', unit: 'KB', default: 0 },
        { name: 'linkOptions.dup', label: '重复', widget: 'number', unit: '%', default: 0 },
        { name: 'linkOptions.burst', label: '突发流量', widget: 'number', unit: 'KB', default: 0 },
        { name: 'linkOptions.mburst', label: '最大突发', widget: 'number', unit: 'KB', default: 0 },
        { name: 'linkOptions.unidirectional', label: '单向链路', widget: 'switch', default: false },
      ],
    },
    'link.delete': { label: '删除链路', category: 'link', submitTool: 'opencli_delete_links_batch', fields: [{ name: 'pairs', label: '链路节点对', widget: 'multi-select-pairs', optionSource: 'topology.links', required: true }] },
    'subnet.delete': { label: '删除子网', category: 'subnet', submitTool: 'opencli_delete_node', fields: [{ name: 'target', label: '子网', widget: 'select', optionSource: 'topology.nodes[type=EMANE]', required: true }] },
    'interference.delete': { label: '删除干扰', category: 'interference', submitTool: 'opencli_delete_node', fields: [{ name: 'target', label: '干扰节点', widget: 'select', optionSource: 'topology.nodes[type=INODE]', required: true }] },
    'hardware.delete': { label: '删除半实物', category: 'hardware', submitTool: 'opencli_delete_node', fields: [{ name: 'target', label: '半实物节点', widget: 'select', optionSource: 'topology.nodes[type=RJ45]', required: true }] },
    'link.distributed': {
      label: '分布式链路配置',
      category: 'link',
      status: 'schema-only',
      fields: [
        { name: 'selectedDrones', label: '无人机节点', widget: 'multi-select', optionSource: 'topology.nodes[type=DRONE]' },
        { name: 'targetSubnet', label: '目标子网', widget: 'select', optionSource: 'topology.nodes[type=EMANE]' },
        { name: 'routerChain', label: '路由器链路', widget: 'ordered-multi-select', optionSource: 'topology.nodes[type=DEFAULT/ROUTER]' },
        { name: 'autoAssignIp', label: '自动IP分配', widget: 'switch', default: true },
      ],
    },
  },
};

function cloneNodeConfigCatalog(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(FRONTEND_NODE_CONFIG_CATALOG));
}

function cloneCreationConfigCatalog(): Record<string, any> {
  return JSON.parse(JSON.stringify(FRONTEND_CREATION_CONFIG_CATALOG));
}

export class OpenCliMcpExecutor {
  private readonly state: ExecutorState = {
    currentSessionId: null,
    currentSessionName: '',
    topoData: null,
  };
  private readonly pendingConfigRequests = new Map<string, PendingConfigRequest>();

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

  async runCommand(command: OpenCliMcpCommand): Promise<OpenCliResult> {
    return this.executeCommand(command);
  }

  async nodeConfigSchema(input: { target?: string; nodeType?: string } = {}): Promise<OpenCliResult> {
    const catalog = cloneNodeConfigCatalog();
    let topo: TopoData | null = this.state.topoData ? normalizeTopoArrays(this.state.topoData) : null;
    let node: Node | undefined;

    if (input.target) {
      topo = await this.requireLoadedTopo();
      node = this.findNode(input.target);
      if (!node) throw new Error(`找不到节点：${input.target}`);
    }

    const sections = (FRONTEND_NODE_CONFIG_CATALOG.sections as Array<{ fields: unknown[] }>);
    const fieldCount = sections.reduce((count, section) => count + section.fields.length, 0);
    const data: Record<string, unknown> = {
      ...catalog,
      target: input.target,
      requestedNodeType: input.nodeType,
      fieldCount,
      mcpTools: [
        'opencli_read_node_creation_options',
        'opencli_read_subnet_creation_options',
        'opencli_read_link_creation_options',
        'opencli_read_composite_creation_options',
        'opencli_update_node_config',
        'opencli_vm_templates',
        'opencli_update_vm_config',
        'opencli_get_node_protocol_config',
        'opencli_set_node_protocol_config',
        'opencli_generate_tdma_schedule',
      ],
    };

    if (topo) {
      data.scene = this.topoVerification(topo);
      data.options = {
        servers: this.serverOptions(topo),
        configServices: this.configServiceOptions(topo),
      };
    }

    if (node && topo) {
      data.currentNode = this.nodeConfigSnapshot(node, topo);
    }

    return {
      ok: true,
      message: input.target
        ? `已整理节点 ${node?.alias || node?.name} 的前端可配置字段，共 ${fieldCount} 项。`
        : `已整理前端节点配置字段 catalog，共 ${fieldCount} 项。`,
      data,
    };
  }

  async creationConfigSchema(input: CreationConfigSchemaInput = {}): Promise<OpenCliResult> {
    const catalog = cloneCreationConfigCatalog();
    const topo = this.state.topoData ? normalizeTopoArrays(this.state.topoData) : null;
    const selectedAction = this.findCreationAction(catalog, input);
    const data: Record<string, unknown> = {
      ...catalog,
      requested: {
        category: input.category,
        item: input.item,
        nodeType: input.nodeType,
        actionId: input.actionId,
        configStage: input.configStage,
        partialSelections: input.partialSelections,
        composite: input.composite,
      },
      selectedAction,
      flow: [
        '1. 正式创建流程先调用配置项读取工具：opencli_read_node_creation_options / opencli_read_subnet_creation_options / opencli_read_link_creation_options / opencli_read_composite_creation_options。',
        '2. AI 必须把配置读取工具的 structuredContent.configForm 展示给用户；重点是“可填什么/可选什么”，不是推荐默认值。',
        '3. 用户提交结构化 userSelections 后，AI 才按 selectedAction.submitTool 调用 opencli_add_node、opencli_connect_nodes 或删除类工具。',
        '4. 对已有节点的二次配置继续使用 opencli_node_config_schema、opencli_update_node_config、opencli_update_vm_config、opencli_set_node_protocol_config。',
      ],
    };

    if (topo) {
      data.scene = this.topoVerification(topo);
      data.sceneMode = this.isDistributedScene() ? 'distributed' : 'normal';
      data.activeCategories = this.isDistributedScene() ? catalog.distributedCategories : catalog.categories;
      data.dynamicOptions = {
        servers: this.serverOptions(topo),
        configServices: this.configServiceOptions(topo),
        nodes: (topo.nodes || []).map((node) => ({
          id: node.id,
          name: node.name,
          alias: node.alias,
          type: node.type,
          model: node.model,
          image: node.image,
        })),
        links: (topo.links || []).map((link) => ({
          node1_id: link.node1_id,
          node2_id: link.node2_id,
          node1: this.nodeLabelById(topo, link.node1_id),
          node2: this.nodeLabelById(topo, link.node2_id),
        })),
        availableRj45Interfaces: this.availableRj45Interfaces(topo),
      };
    }

    if (selectedAction && this.actionNeedsVmTemplates(selectedAction)) {
      data.vmTemplates = await this.safeVmTemplates();
    }

    if (input.composite) {
      return this.compositeCreationConfigSchema(input, data);
    }

    if (selectedAction) {
      data.configFields = this.expandCreationFields(selectedAction);
      data.configForm = this.creationConfigFormSpec(selectedAction, data);
      data.userDisplayText = this.formatUserDisplayOptions(selectedAction, data);
      if (this.actionRequiresCreationConfig(selectedAction)) {
        const key = this.configKeyForCreationAction(selectedAction);
        const incomingRequestId = this.stringFromRecord(input.partialSelections, 'configRequestId');
        const request = this.rememberConfigRequest(key, selectedAction.label || '配置', selectedAction.submitTool || 'opencli_add_node', {
          kind: 'single',
          stage: String((data.configForm as any)?.stage || input.configStage || 'review'),
          requestId: incomingRequestId,
          partialSelections: input.partialSelections,
          source: 'schema',
          forceNew: input.forceNewConfigRequest === true && !incomingRequestId,
        });
        data.requiresUserInput = true;
        data.submitTool = selectedAction.submitTool || 'opencli_add_node';
        data.configRequestKey = key;
        data.configRequestId = request.requestId;
        data.nextConfigStage = (data.configForm as any)?.nextConfigStage || null;
      }
    }

    const selectedLabel = selectedAction ? `：${selectedAction.label || selectedAction.nodeType || input.actionId}` : '';
    return {
      ok: true,
      message: selectedAction
        ? `已返回前端放置/配置需求${selectedLabel}。`
        : '已返回前端左侧菜单的放置/配置目录。请指定 item、nodeType 或 actionId 获取单个配置需求。',
      data,
    };
  }

  private sanitizeConfigForm(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeConfigForm(item));
    if (!value || typeof value !== 'object') return value;

    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (['displayMarkdown', 'userDisplayText', 'userFacingOptions'].includes(key)) return;
      next[key] = this.sanitizeConfigForm(item);
    });
    return next;
  }

  private formKeyForConfigForm(form: Record<string, unknown>, owner: Record<string, unknown>, fallback: string): string {
    const actionId = String(form.actionId || owner.actionId || '').trim();
    const nodeType = String(owner.nodeType || form.nodeType || '').trim();
    if (actionId === 'subnet.add' || nodeType === 'EMANE') {
      const stage = String(form.stage || 'subnet-model').trim();
      const selected = this.objectRecord(form.selected);
      const model = String(selected.emaneModel || '').trim();
      const phyType = String(selected.phyType || '').trim();
      return ['EMANE', stage, model, phyType].filter(Boolean).join('.');
    }
    if (actionId === 'link.add') return 'link.add';
    if (nodeType) return `${nodeType}.creation`;
    if (actionId) return `${actionId}.creation`;
    return fallback;
  }

  private compactCompositeConfigForm(configForm: Record<string, unknown>): ConfigFormEnvelope {
    const entities = this.arrayRecords(configForm.entities);
    const links = this.arrayRecords(configForm.links);
    if (String(configForm.actionId || '') !== 'composite.create') {
      return {
        ...(this.sanitizeConfigForm(configForm) as Record<string, unknown>),
        displayMode: 'structured_content',
      } as ConfigFormEnvelope;
    }

    const formDefinitions: Record<string, any> = {};
    const mapItem = (item: Record<string, unknown>, fallback: string): Record<string, unknown> => {
      const nestedForm = this.objectRecord(item.configForm);
      const formKey = nestedForm
        ? this.formKeyForConfigForm(nestedForm, item, fallback)
        : fallback;
      if (nestedForm && !formDefinitions[formKey]) {
        formDefinitions[formKey] = {
          ...(this.sanitizeConfigForm(nestedForm) as Record<string, unknown>),
          formKey,
        };
      }
      const { configForm: _configForm, ...rest } = item;
      return {
        ...(this.sanitizeConfigForm(rest) as Record<string, unknown>),
        formKey,
      };
    };

    const compact: ConfigFormEnvelope = {
      actionId: String(configForm.actionId || 'composite.create'),
      stage: String(configForm.stage || 'review'),
      nextConfigStage: typeof configForm.nextConfigStage === 'string' ? configForm.nextConfigStage : null,
      configRequestId: String(configForm.configRequestId || ''),
      submitPattern: configForm.submitPattern,
      displayMode: 'structured_content',
      entities: entities.map((entity, index) => mapItem(entity, `entity${index + 1}.creation`)),
      links: links.map((link, index) => mapItem(link, `link${index + 1}.add`)),
      formDefinitions,
    };
    return compact;
  }

  private compactConfigForm(value: unknown): ConfigFormEnvelope | undefined {
    const form = this.objectRecord(value);
    if (!form || Object.keys(form).length === 0) return undefined;
    return this.compactCompositeConfigForm(form);
  }

  private compactFormDisplay(title: string, data: Record<string, unknown>, configForm?: ConfigFormEnvelope): string {
    const form = configForm || this.compactConfigForm(data.configForm);
    const definitions = this.objectRecord(form?.formDefinitions);
    const entities = Array.isArray(form?.entities) ? form.entities.length : 0;
    const links = Array.isArray(form?.links) ? form.links.length : 0;
    const lines = [
      `${title}`,
      data.configRequestId ? `配置请求 ID：${String(data.configRequestId)}` : form?.configRequestId ? `配置请求 ID：${String(form.configRequestId)}` : '',
      form?.stage ? `当前阶段：${String(form.stage)}` : '',
      data.nextConfigStage ? `下一阶段：${String(data.nextConfigStage)}` : form?.nextConfigStage ? `下一阶段：${String(form.nextConfigStage)}` : '',
      data.submitTool ? `确认后写入工具：${String(data.submitTool)}` : '',
      entities || links ? `待配置对象：${entities} 个节点/实体，${links} 条链路` : '',
      definitions ? `表单定义：${Object.keys(definitions).join(', ')}` : '',
      '完整字段、选项、默认值和联动关系见 structuredContent.configForm。',
    ];
    return lines.filter(Boolean).join('\n');
  }

  private explicitFormResult(result: OpenCliResult, title: string): OpenCliResult {
    const data = this.objectRecord(result.data);
    const configForm = this.compactConfigForm(data.configForm);
    const displayMarkdown = this.compactFormDisplay(title, data, configForm);
    const nextData: Record<string, unknown> = {
      ...data,
      formToolResult: true,
      optionReadResult: true,
      requiresUserInput: true,
      requiresFormTool: false,
      mustDisplayToUser: true,
      displayPolicy: 'structured_content',
      interactionMode: 'display_options_then_wait_for_user',
      userFacingOptions: displayMarkdown,
      userDisplayText: displayMarkdown,
      displayMarkdown,
    };
    if (configForm) nextData.configForm = configForm;

    return {
      ok: true,
      message: `已返回${title}。`,
      data: nextData,
    };
  }

  async nodeCreationForm(input: NodeCreationFormInput): Promise<OpenCliResult> {
    const incomingRequestId = this.stringFromRecord(input.partialSelections, 'configRequestId');
    const schema = await this.creationConfigSchema({
      category: input.category,
      item: input.item,
      nodeType: input.nodeType,
      actionId: input.actionId,
      configStage: input.configStage,
      partialSelections: input.partialSelections,
      forceNewConfigRequest: !incomingRequestId,
    });
    const data = this.objectRecord(schema.data);
    const selectedAction = this.objectRecord(data.selectedAction);
    if (!selectedAction) return this.explicitFormResult(schema, '节点创建配置目录');

    const nodeType = String(selectedAction.nodeType || input.nodeType || 'DOCKER') as McpNodeType;
    const key = this.creationConfigKey(nodeType);
    const commandKind = Array.isArray(input.names) && input.names.length > 0
      ? 'addNodesBatch'
      : typeof input.count === 'number'
        ? 'addNodesGrid'
        : 'addNode';
    const command = {
      kind: commandKind,
      nodeType,
      name: input.name,
      names: input.names,
      count: input.count,
      clientId: input.clientId,
    } as NodeCreateOptions & { nodeType: McpNodeType; kind?: string; name?: string; names?: string[]; count?: number };
    const plannedEntities = this.creationPlannedEntities(command);
    const existingRequestId = String(data.configRequestId || '').trim();
    const request = this.rememberConfigRequest(key, String(selectedAction.label || '节点'), String(selectedAction.submitTool || 'opencli_add_node'), {
      requestId: existingRequestId || undefined,
      kind: plannedEntities.length > 1 ? 'composite' : 'single',
      entityIds: plannedEntities.length > 1 ? plannedEntities.map((entity) => String(entity.clientId)) : undefined,
      stage: String((data.configForm as any)?.stage || input.configStage || 'review'),
      partialSelections: input.partialSelections,
      source: 'form',
      forceNew: !incomingRequestId,
    });
    const configForm = this.creationCommandConfigForm(this.objectRecord(data.configForm), command, request);
    const submitTool = selectedAction.submitTool || 'opencli_add_node';
    const nextConfigStage = (configForm as any).nextConfigStage || null;
    const displayMarkdown = this.compactFormDisplay('节点创建配置表单', {
      configRequestId: request.requestId,
      submitTool,
      nextConfigStage,
    }, this.compactConfigForm(configForm));

    return this.explicitFormResult({
      ok: true,
      message: displayMarkdown,
      data: {
        ...data,
        userFacingOptions: displayMarkdown,
        userDisplayText: displayMarkdown,
        displayMarkdown,
        configForm,
        configRequestKey: key,
        configRequestId: request.requestId,
        submitTool,
        nextConfigStage,
      },
    }, '节点创建配置表单');
  }

  async subnetCreationForm(input: {
    configStage?: string;
    partialSelections?: Record<string, unknown>;
  } = {}): Promise<OpenCliResult> {
    const incomingRequestId = this.stringFromRecord(input.partialSelections, 'configRequestId');
    const schema = await this.creationConfigSchema({
      nodeType: 'EMANE',
      actionId: 'subnet.add',
      configStage: input.configStage,
      partialSelections: input.partialSelections,
      forceNewConfigRequest: !incomingRequestId,
    });
    const data = this.objectRecord(schema.data);
    const key = this.creationConfigKey('EMANE');
    const existingRequestId = String(data.configRequestId || '').trim();
    this.rememberConfigRequest(key, '添加子网', 'opencli_add_node', {
      requestId: existingRequestId || undefined,
      kind: 'single',
      stage: String((data.configForm as any)?.stage || input.configStage || 'subnet-model'),
      partialSelections: input.partialSelections,
      source: 'form',
      forceNew: !incomingRequestId,
    });
    return this.explicitFormResult(schema, '子网创建配置表单');
  }

  async linkCreationForm(input: LinkCreationFormInput = {}): Promise<OpenCliResult> {
    const schema = await this.creationConfigSchema({ actionId: 'link.add', forceNewConfigRequest: true });
    const data = this.objectRecord(schema.data);
    const key = this.linkConfigKey();
    const existingRequestId = String(data.configRequestId || '').trim();
    const linkDrafts = Array.isArray(input.pairs) && input.pairs.length > 0
      ? input.pairs.map((pair, index) => ({
        kind: 'link',
        clientId: pair.clientId || `link${index + 1}`,
        from: pair.from,
        to: pair.to,
        linkType: input.linkType,
      }))
      : [{
        kind: 'link',
        clientId: input.clientId || 'link1',
        from: input.from,
        to: input.to,
        linkType: input.linkType,
      }];
    const request = this.rememberConfigRequest(key, '添加链路', 'opencli_connect_nodes/opencli_add_links_batch', {
      requestId: existingRequestId || undefined,
      kind: linkDrafts.length > 1 ? 'composite' : 'single',
      entityIds: linkDrafts.length > 1 ? linkDrafts.map((link) => String(link.clientId)) : undefined,
      source: 'form',
      forceNew: true,
    });
    const submitTool = input.pairs?.length ? 'opencli_add_links_batch' : 'opencli_connect_nodes';
    const rawConfigForm = {
      ...(this.objectRecord(data.configForm)),
      configRequestId: request.requestId,
      plannedLinks: linkDrafts,
    };
    const displayMarkdown = this.compactFormDisplay('链路创建配置表单', {
      configRequestId: request.requestId,
      submitTool,
    }, this.compactConfigForm(rawConfigForm));

    return this.explicitFormResult({
      ok: true,
      message: displayMarkdown,
      data: {
        ...data,
        userFacingOptions: displayMarkdown,
        userDisplayText: displayMarkdown,
        displayMarkdown,
        configRequestKey: key,
        configRequestId: request.requestId,
        configForm: rawConfigForm,
        submitTool,
      },
    }, '链路创建配置表单');
  }

  async compositeCreationForm(input: CreationCompositeInput): Promise<OpenCliResult> {
    const incomingRequestId = this.stringFromRecord(input.partialSelections, 'configRequestId');
    const schema = await this.creationConfigSchema({
      composite: input,
      configStage: input.configStage,
      partialSelections: input.partialSelections,
      forceNewConfigRequest: !incomingRequestId,
    });
    const data = this.objectRecord(schema.data);
    const configForm = this.objectRecord(data.configForm);
    const requestId = String(data.configRequestId || configForm.configRequestId || '').trim();
    const entityIds = [
      ...this.arrayRecords(configForm.entities).map((entity) => String(entity.clientId || '').trim()).filter(Boolean),
      ...this.arrayRecords(configForm.links).map((link) => String(link.clientId || '').trim()).filter(Boolean),
    ];
    if (requestId) {
      this.rememberConfigRequest(this.compositeConfigKey(), String(input.title || '复合拓扑创建'), 'opencli_add_node/opencli_connect_nodes/opencli_add_links_batch', {
        requestId,
        kind: 'composite',
        stage: String(configForm.stage || data.nextConfigStage || 'review'),
        entityIds,
        partialSelections: input.partialSelections,
        source: 'form',
        forceNew: !incomingRequestId,
      });
    }
    return this.explicitFormResult(schema, '复合拓扑创建配置表单');
  }

  async updateNodeConfig(input: NodeConfigUpdateInput): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(input.target);
    if (!node) throw new Error(`找不到节点：${input.target}`);

    const updatedNode: any = this.cloneJson(node);
    const changedFields: string[] = [];

    if (this.hasOwn(input, 'alias')) {
      const alias = String(input.alias ?? '').trim();
      if (!alias) throw new Error('节点别名不能为空。');
      if (alias.length > 64) throw new Error('节点别名不能超过 64 个字符。');
      const duplicated = (topo.nodes || []).some((candidate) =>
        candidate.id !== node.id &&
        String(candidate.alias || candidate.name || '').trim().toLowerCase() === alias.toLowerCase()
      );
      if (duplicated) throw new Error(`节点名称 "${alias}" 已存在。`);
      updatedNode.alias = alias;
      changedFields.push('alias');
    }

    if (this.hasOwn(input, 'status')) {
      updatedNode.status = input.status;
      changedFields.push('status');
    }

    if (this.hasOwn(input, 'role')) {
      updatedNode.role = this.role(input.role);
      changedFields.push('role');
    }

    if (this.hasOwn(input, 'server')) {
      updatedNode.server = String(input.server ?? '').trim();
      changedFields.push('server');
    }

    if (this.hasOwn(input, 'configServices')) {
      updatedNode.config_services = this.normalizeStringList(input.configServices || []);
      changedFields.push('configServices');
    }

    if (this.hasOwn(input, 'lat') || this.hasOwn(input, 'lon') || this.hasOwn(input, 'alt')) {
      updatedNode.geo = {
        lat: this.numberOrExisting(input.lat, node.geo?.lat, DEFAULT_CENTER.lat),
        lon: this.numberOrExisting(input.lon, node.geo?.lon, DEFAULT_CENTER.lon),
        alt: this.numberOrExisting(input.alt, node.geo?.alt, DEFAULT_CENTER.alt),
      };
      changedFields.push('geo');
    }

    if (this.hasOwn(input, 'phyType')) {
      updatedNode.phy_type = String(input.phyType ?? '').trim();
      changedFields.push('phyType');
    }

    if (input.emaneConfig && Object.keys(input.emaneConfig).length > 0) {
      const emaneResult = this.applyEmaneConfigOverrides(updatedNode, input.emaneConfig);
      changedFields.push(...emaneResult.keys.map((key) => `emaneConfig.${key}`));
    }

    if (changedFields.length === 0) {
      return { ok: false, message: '没有提供可更新的节点配置字段。' };
    }

    const response = await this.backend.editNode(updatedNode, topo.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    const refreshedNode = refreshed.nodes.find((candidate) => candidate.id === node.id) || updatedNode;
    await this.notifyFrontendTopoSync(refreshed.id, 'node-config-updated');

    return this.verifiedResult(`已更新节点配置：${refreshedNode.alias || refreshedNode.name}`, refreshed, {
      changedFields,
      node: refreshedNode,
    });
  }

  async vmTemplates(): Promise<OpenCliResult> {
    const response = await this.backend.getVMTemplates();
    const templates = this.normalizeListResponse(response.data);
    return {
      ok: true,
      message: `已获取 VM 模板 ${templates.length} 个。`,
      data: {
        templates,
      },
    };
  }

  async updateVMConfig(input: VMConfigUpdateInput): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(input.target);
    if (!node) throw new Error(`找不到节点：${input.target}`);
    if (!this.isVMNode(node)) throw new Error(`节点 ${node.alias || node.name} 不是 VMNODE，不能使用 VM 参数编辑接口。`);

    const templateId = Number(input.templateId ?? (node as any).templateId ?? 1);
    const cpu = this.requireIntegerInRange(input.cpu ?? Number((node as any).vcpu || 1), 1, 16, 'cpu');
    const memoryMb = this.requireIntegerInRange(
      input.memoryMb ?? this.kbStringToMb(input.memory ?? (node as any).memory, 1024),
      512,
      32768,
      'memoryMb'
    );
    const currentMemoryMb = this.requireIntegerInRange(
      input.currentMemoryMb ?? this.kbStringToMb(input.currentMemory ?? (node as any).curMemory, memoryMb),
      512,
      memoryMb,
      'currentMemoryMb'
    );

    const editData = {
      sessionId: topo.id,
      userId,
      nodeId: node.id,
      templateId,
      cpu,
      currentMemory: String(currentMemoryMb * 1024),
      memory: String(memoryMb * 1024),
    };

    const response = await this.backend.editVMNode(editData);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    const refreshedNode = refreshed.nodes.find((candidate) => candidate.id === node.id);
    await this.notifyFrontendTopoSync(refreshed.id, 'vm-config-updated');

    return this.verifiedResult(`已更新虚拟机参数：${refreshedNode?.alias || refreshedNode?.name || node.alias || node.name}`, refreshed, {
      vm: editData,
      node: refreshedNode || node,
    });
  }

  async nodeProtocolConfig(target: string): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const node = this.findNode(target);
    if (!node) throw new Error(`找不到节点：${target}`);

    const container = `${node.name}-${topo.id}`;
    const interfaces = this.nodeInterfaceNames(node, topo);
    let current: unknown = null;
    let queryError: string | undefined;

    try {
      const response = await this.backend.getAllProtocols(topo.id, container);
      current = response.data;
    } catch (error) {
      queryError = error instanceof Error ? error.message : String(error);
    }

    return {
      ok: true,
      message: `已读取节点协议配置入口：${node.alias || node.name}，可选网卡 ${interfaces.length} 个。${queryError ? ` 当前配置读取失败：${queryError}` : ''}`,
      data: {
        node: this.nodeConfigSnapshot(node, topo),
        container,
        interfaces,
        isNestV3Docker: this.isNestV3Docker(node),
        current,
        queryError,
        fields: (cloneNodeConfigCatalog().sections as any[]).find((section) => section.id === 'protocol-config'),
      },
    };
  }

  async setNodeProtocolConfig(input: ProtocolConfigInput): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const node = this.findNode(input.target);
    if (!node) throw new Error(`找不到节点：${input.target}`);

    const payload = this.buildProtocolPayload(topo, node, input);
    await this.backend.insertRouterInfo(payload);

    return this.verifiedResult(`已保存节点协议配置：${node.alias || node.name}`, topo, {
      protocolPayload: payload,
      node: this.nodeConfigSnapshot(node, topo),
    });
  }

  async generateTdmaSchedule(input: TdmaScheduleInput): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const node = this.findNode(input.target);
    if (!node) throw new Error(`找不到节点：${input.target}`);

    const requestData = this.buildTdmaRequest(topo, node, input);
    const response = await this.backend.generateTDMA(requestData);

    return this.verifiedResult(`已生成 TDMA 调度文件：${requestData.savePath}`, topo, {
      request: requestData,
      response: response.data,
      node: this.nodeConfigSnapshot(node, topo),
    });
  }

  private async executeCommand(command: OpenCliMcpCommand): Promise<OpenCliResult> {
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
        return this.connectNodes(command as ConnectNodesCommand);
      case 'addLinksBatch':
        return this.addLinksBatch(command as AddLinksBatchCommand);
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
        '注意：前端添加类写操作会先返回配置表单；用户通过 userSelections 回传后才执行。',
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
    return this.rememberTopo(topo, Number(targetSessionId));
  }

  private async requireLoadedTopo(): Promise<TopoData> {
    if (this.state.topoData?.id) {
      this.state.topoData = normalizeTopoArrays(this.state.topoData);
      return this.state.topoData;
    }

    return this.refreshTopo();
  }

  private topoVerification(topo: TopoData): Record<string, unknown> {
    const normalized = normalizeTopoArrays(topo);
    return {
      sessionId: Number(normalized.id),
      sceneName: normalized.name || this.state.currentSessionName || `Scene${normalized.id}`,
      state: normalized.state || 'UNKNOWN',
      nodeCount: normalized.nodes.length,
      linkCount: normalized.links.length,
    };
  }

  private verificationLine(topo: TopoData): string {
    const verification = this.topoVerification(topo);
    return `Verification: sessionId=${verification.sessionId} state=${verification.state} nodes=${verification.nodeCount} links=${verification.linkCount}`;
  }

  private verifiedResult(message: string, topo: TopoData, data: Record<string, unknown> = {}): OpenCliResult {
    return {
      ok: true,
      message: `${message}\n${this.verificationLine(topo)}`,
      data: {
        ...data,
        verification: this.topoVerification(topo),
      },
    };
  }

  private hasOwn(value: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private normalizeStringList(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      result.push(trimmed);
    });
    return result;
  }

  private numberOrExisting(value: number | undefined, existing: number | undefined, fallback: number): number {
    if (typeof value === 'undefined') return Number(existing ?? fallback);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`无效数值：${value}`);
    return parsed;
  }

  private normalizeListResponse(value: any): any[] {
    const parsed = tryParseJson(value);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
    if (Array.isArray(parsed?.list)) return parsed.list;
    if (Array.isArray(parsed?.data)) return parsed.data;
    if (parsed?.data && parsed.data !== parsed) return this.normalizeListResponse(parsed.data);
    return [];
  }

  private findCreationAction(catalog: Record<string, any>, input: { category?: string; item?: string; nodeType?: string; actionId?: string }): Record<string, any> | null {
    const actions: Record<string, any> = catalog.actions || {};
    if (input.actionId && actions[input.actionId]) return { actionId: input.actionId, ...actions[input.actionId] };

    const normalize = (value?: string) => String(value || '').trim().toLowerCase();
    const item = normalize(input.item);
    const normalizeNodeType = (value?: string) => {
      const normalized = normalize(value);
      if (normalized === 'default') return 'router';
      if (normalized === 'inode') return 'interference';
      return normalized;
    };
    const nodeType = normalizeNodeType(input.nodeType);
    const category = normalize(input.category);

    const entry = Object.entries(actions).find(([id, action]) => {
      const actionCategory = normalize(action.category);
      if (category && actionCategory !== category) return false;

      return (
        normalize(id) === item ||
        normalize(action.label) === item ||
        normalizeNodeType(action.nodeType) === nodeType ||
        normalizeNodeType(action.nodeType) === item
      );
    });

    if (!entry) return null;
    return { actionId: entry[0], ...(entry[1] as Record<string, any>) };
  }

  private actionNeedsVmTemplates(action: Record<string, any>): boolean {
    if (String(action.nodeType || '') === 'VMNODE') return true;
    return JSON.stringify(action.fields || []).includes('opencli_vm_templates');
  }

  private async safeVmTemplates(): Promise<{ templates: any[]; error?: string }> {
    try {
      const response = await this.backend.getVMTemplates();
      return { templates: this.normalizeListResponse(response.data) };
    } catch (error) {
      return {
        templates: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async findVmTemplate(templateId: number): Promise<any | null> {
    const result = await this.safeVmTemplates();
    return result.templates.find((template) => Number(template?.id) === Number(templateId)) || null;
  }

  private serverOptions(topo: TopoData): Array<{ value: string; name?: string; host?: string }> {
    return ((topo as any).servers || [])
      .map((server: any) => ({
        value: String(server?.name || server?.host || '').trim(),
        name: server?.name,
        host: server?.host,
      }))
      .filter((server: any) => server.value);
  }

  private configServiceOptions(topo: TopoData): string[] {
    const services = new Set<string>(['zebra', 'OSPFv2', 'olsrd']);
    (topo.default_services || []).forEach((item: any) => {
      (item.services || []).forEach((service: string) => services.add(service));
    });
    (topo.nodes || []).forEach((node: any) => {
      (node.config_services || []).forEach((service: string) => services.add(service));
    });
    return Array.from(services).sort((a, b) => a.localeCompare(b));
  }

  private nodeLabelById(topo: TopoData, nodeId: number | string): string {
    const node = (topo.nodes || []).find((candidate) => String(candidate.id) === String(nodeId));
    return node?.alias || node?.name || String(nodeId);
  }

  private availableRj45Interfaces(topo: TopoData): Array<{ label: string; value: string; disabled: boolean }> {
    const used = new Set((topo.nodes || [])
      .filter((node) => node.type === 'RJ45')
      .map((node) => String(node.name || '').trim())
      .filter(Boolean));

    return ['ens52f0', 'ens52f1', 'ens52f2', 'ens52f3'].map((name) => ({
      label: name,
      value: name,
      disabled: used.has(name),
    }));
  }

  private expandCreationFields(action: Record<string, any>): Record<string, any>[] {
    const sharedFields = (FRONTEND_CREATION_CONFIG_CATALOG as any).sharedFields || {};
    const expanded: Record<string, any>[] = [];

    (action.fields || []).forEach((field: Record<string, any>) => {
      if (!field?.ref) {
        expanded.push(field);
        return;
      }

      const fields = Array.isArray(sharedFields[field.ref]) ? sharedFields[field.ref] : [];
      fields.forEach((sharedField: Record<string, any>) => {
        const next = this.cloneJson(sharedField);
        const override = this.isDistributedScene() ? field.distributedOverride || {} : {};
        if (next.name && this.hasOwn(override, next.name)) next.default = override[next.name];
        expanded.push(next);
      });
    });

    return expanded;
  }

  private compactValue(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.compactValue(item)).join(', ')}]`;
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => `${key}: ${this.compactValue(item)}`);
      return `{ ${entries.join(', ')} }`;
    }
    if (value === '') return '<空>';
    return String(value);
  }

  private formatOption(option: unknown): string {
    if (!option || typeof option !== 'object') return this.compactValue(option);

    const value = (option as any).value ?? (option as any).label ?? option;
    const label = (option as any).label && (option as any).label !== value ? `${(option as any).label}=${value}` : String(value);
    const backend = (option as any).backendModel ? ` -> 后端 ${String((option as any).backendModel)}` : '';
    const description = (option as any).description ? `（${String((option as any).description)}）` : '';
    return `${label}${backend}${description}`;
  }

  private optionList(options: unknown): string {
    if (!Array.isArray(options)) return this.compactValue(options);
    return options.map((option) => this.formatOption(option)).join('；');
  }

  private formatSourceOptions(field: Record<string, any>, schemaData: Record<string, unknown>): string | null {
    const source = String(field.optionSource || '');
    const dynamic = (schemaData as any).dynamicOptions || {};
    if (!source) return null;

    if (source === 'topology.nodes') {
      const nodes = Array.isArray(dynamic.nodes) ? dynamic.nodes : [];
      return nodes.length
        ? nodes.map((node: any) => `${node.alias || node.name || node.id}(id=${node.id}, type=${node.type})`).join('；')
        : '当前场景暂无节点';
    }

    if (source.startsWith('topology.nodes[type=')) {
      const typePart = source.match(/type=([^\]]+)/)?.[1] || '';
      const accepted = typePart.split('/').map((item) => item.trim()).filter(Boolean);
      const nodes = (Array.isArray(dynamic.nodes) ? dynamic.nodes : [])
        .filter((node: any) => accepted.length === 0 || accepted.includes(String(node.type)));
      return nodes.length
        ? nodes.map((node: any) => `${node.alias || node.name || node.id}(id=${node.id}, type=${node.type})`).join('；')
        : `当前场景暂无 ${typePart} 节点`;
    }

    if (source === 'topology.servers') {
      const servers = Array.isArray(dynamic.servers) ? dynamic.servers : [];
      return servers.length ? servers.map((server: any) => server.value || server.name || server.host).join('；') : '当前场景暂无服务器选项';
    }

    if (source === 'topology.links') {
      const links = Array.isArray(dynamic.links) ? dynamic.links : [];
      return links.length ? links.map((link: any) => `${link.node1} <-> ${link.node2}`).join('；') : '当前场景暂无链路';
    }

    if (source === 'opencli_vm_templates') {
      const templates = Array.isArray((schemaData as any).vmTemplates?.templates) ? (schemaData as any).vmTemplates.templates : [];
      return templates.length
        ? templates.map((template: any) => `${template.name || template.templateName || template.id}(id=${template.id})`).join('；')
        : '当前未读取到 VM 模板，请先查看 vmTemplates.error 或 opencli_vm_templates';
    }

    if (source === 'selected VM template') return '随用户选择的 VM 模板展示描述、CPU、内存、磁盘文件';
    return source;
  }

  private formatCreationField(field: Record<string, any>, schemaData: Record<string, unknown>): string {
    const parts = [
      `${field.label || field.name || field.ref} (${field.name || field.ref})`,
      `控件=${field.widget || 'unknown'}`,
    ];

    if (field.required) parts.push('必填');
    if (this.hasOwn(field, 'default')) parts.push(`默认=${this.compactValue(field.default)}`);
    if (field.defaultMode) parts.push(`默认规则=${field.defaultMode}`);
    if (field.unit) parts.push(`单位=${field.unit}`);
    if (this.hasOwn(field, 'min') || this.hasOwn(field, 'max') || this.hasOwn(field, 'step')) {
      parts.push(`范围=${this.compactValue(field.min ?? '')}..${this.compactValue(field.max ?? '')}${field.step ? ` step=${field.step}` : ''}`);
    }
    if (field.options) parts.push(`可选=${this.optionList(field.options)}`);
    if (field.optionsByEmaneModel) {
      const byModel = Object.entries(field.optionsByEmaneModel)
        .map(([model, options]) => {
          const choices = Array.isArray(options)
            ? options.map((option) => this.formatOption(option)).join(', ')
            : this.optionList(options);
          return `${model}: ${choices}`;
        })
        .join('；');
      parts.push(`按链路层可选=${byModel}`);
    }
    if (field.fields) parts.push(`子字段=${this.optionList(field.fields)}`);
    if (field.rowFields) parts.push(`行字段=${this.optionList(field.rowFields)}`);
    if (field.defaultByType) parts.push(`按类型默认=${this.compactValue(field.defaultByType)}`);
    if (field.examples) parts.push(`示例字段=${this.optionList(field.examples)}`);
    if (field.mapsTo) parts.push(`映射=${field.mapsTo}`);
    if (field.mcpArgument) parts.push(`MCP字段=${field.mcpArgument}`);
    if (field.schemaOnly) parts.push('当前 MCP 仅说明，尚无对应写入后端封装');

    const sourceOptions = this.formatSourceOptions(field, schemaData);
    if (sourceOptions) parts.push(`当前选项=${sourceOptions}`);

    return `- ${parts.join('；')}`;
  }

  private markdownCell(value: unknown): string {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return (text || '-').replace(/\|/g, '/');
  }

  private fieldRequiredText(field: Record<string, any>): string {
    if (field.required) return '是';
    if (field.name === 'role') return '普通模式前端隐藏并使用公共；攻防/分布式模式可选';
    if (field.visibleWhen) return `按条件显示：${field.visibleWhen}`;
    return '否/按场景';
  }

  private fieldPrefillText(field: Record<string, any>): string {
    const parts: string[] = [];
    if (this.hasOwn(field, 'default')) parts.push(`前端预填 ${this.compactValue(field.default)}`);
    if (field.defaultMode) parts.push(`规则：${field.defaultMode}`);
    if (field.defaultByType) parts.push(`按类型预填：${this.compactValue(field.defaultByType)}`);
    if (field.description) parts.push(String(field.description));
    if (field.mapsTo) parts.push(`写入映射：${field.mapsTo}`);
    if (field.mcpArgument) parts.push(`MCP 参数：${field.mcpArgument}`);
    if (field.schemaOnly) parts.push('当前 MCP 仅展示该前端字段，暂未封装专用写入接口');
    return parts.join('；') || '无固定值，由用户填写或由前端上下文生成';
  }

  private fieldChoiceText(field: Record<string, any>, schemaData: Record<string, unknown>): string {
    const parts: string[] = [];
    if (field.options) parts.push(`可选：${this.optionList(field.options)}`);
    if (!field.options && ['checkbox', 'switch'].includes(String(field.widget || ''))) {
      parts.push('可选：开 / 关');
    }
    const sourceOptions = this.formatSourceOptions(field, schemaData);
    if (sourceOptions) parts.push(`当前选项：${sourceOptions}`);
    if (field.optionsByEmaneModel) {
      const byModel = Object.entries(field.optionsByEmaneModel)
        .map(([model, options]) => `${model} -> ${Array.isArray(options) ? options.join('/') : this.optionList(options)}`)
        .join('；');
      parts.push(`联动选项：${byModel}`);
    }
    if (this.hasOwn(field, 'min') || this.hasOwn(field, 'max') || this.hasOwn(field, 'step')) {
      const range = [
        this.hasOwn(field, 'min') ? `min=${this.compactValue(field.min)}` : '',
        this.hasOwn(field, 'max') ? `max=${this.compactValue(field.max)}` : '',
        this.hasOwn(field, 'step') ? `step=${this.compactValue(field.step)}` : '',
      ].filter(Boolean).join(', ');
      parts.push(`范围：${range}`);
    }
    if (field.unit) parts.push(`单位：${field.unit}`);
    if (field.fields) parts.push(`子字段：${this.optionList(field.fields)}`);
    if (field.rowFields) parts.push(`行字段：${this.optionList(field.rowFields)}`);
    if (field.examples) parts.push(`示例字段：${this.optionList(field.examples)}`);
    if (field.optionSource && !sourceOptions) parts.push(`选项来源：${field.optionSource}`);
    return parts.join('；') || '自由输入';
  }

  private formatCreationFieldsTable(fields: Record<string, any>[], schemaData: Record<string, unknown>, indent = ''): string[] {
    if (fields.length === 0) return [];
    return [
      `${indent}| 字段 | 前端控件 | 是否必填 | 支持填写/可选内容 | 回传字段 | 预填/说明 |`,
      `${indent}| --- | --- | --- | --- | --- | --- |`,
      ...fields.map((field) => {
        const name = field.name || field.ref || '';
        const returnKey = field.mcpArgument || name;
        return [
          indent,
          '| ',
          this.markdownCell(`${field.label || name} (${name})`),
          ' | ',
          this.markdownCell(field.widget || 'unknown'),
          ' | ',
          this.markdownCell(this.fieldRequiredText(field)),
          ' | ',
          this.markdownCell(this.fieldChoiceText(field, schemaData)),
          ' | ',
          this.markdownCell(returnKey),
          ' | ',
          this.markdownCell(this.fieldPrefillText(field)),
          ' |',
        ].join('');
      }),
    ];
  }

  private formatFieldSection(title: string, fields: Record<string, any>[], schemaData: Record<string, unknown>): string[] {
    if (fields.length === 0) return [];
    return ['', title, ...this.formatCreationFieldsTable(fields, schemaData)];
  }

  private splitCreationFields(action: Record<string, any>): Record<string, Record<string, any>[]> {
    const groups: Record<string, Record<string, any>[]> = {
      basic: [],
      vm: [],
      placement: [],
      protocol: [],
      server: [],
      hardware: [],
      deviceSpecific: [],
      interference: [],
      other: [],
    };
    const fields = this.expandCreationFields(action);
    fields.forEach((field) => {
      const name = String(field.name || '');
      if (['name', 'alias', 'lat', 'lon', 'alt', 'role'].includes(name)) groups.basic.push(field);
      else if (['templateId', 'templatePreview'].includes(name)) groups.vm.push(field);
      else if (name.startsWith('formation')) groups.placement.push(field);
      else if (name.startsWith('enable')) groups.protocol.push(field);
      else if (name === 'server') groups.server.push(field);
      else if (name === 'rj45Interface') groups.hardware.push(field);
      else if (name.toLowerCase().includes('interfere') || ['azimuth', 'elevation'].includes(name)) groups.interference.push(field);
      else if (['tmvDeviceType', 'businessDeviceType', 'deviceType'].includes(name)) groups.deviceSpecific.push(field);
      else groups.other.push(field);
    });
    return groups;
  }

  private formatConfigDefaults(title: string, values: Record<string, string>): string {
    const items = Object.entries(values)
      .map(([key, value]) => `${key}=${value === '' ? '<空>' : value}`)
      .join('，');
    return `${title}: ${items}`;
  }

  private fieldSelectText(key: string): string {
    if (key === 'mode') return '；可选 0=802.11b / 1=802.11a / 2=802.11g / 3=802.11abg';
    if (key === 'compatibilitymode' || key === 'wmmenable') return '；可选 0=关闭 / 1=开启';
    if (key === 'unicastrate' || key === 'multicastrate') {
      return '；可选 1=1Mbps / 2=2Mbps / 3=5.5Mbps / 4=11Mbps / 5=6Mbps / 6=9Mbps / 7=12Mbps / 8=18Mbps / 9=24Mbps / 10=36Mbps / 11=48Mbps / 12=54Mbps';
    }
    if (SELECT_OPTIONS[key]) return `；可选 ${SELECT_OPTIONS[key].join(' / ')}`;
    if (BOOLEAN_ZERO_ONE_KEYS.has(key) || BOOLEAN_ON_OFF_KEYS.has(key) || key.includes('enable') || key.includes('averageall')) {
      return '；可选 0=关闭 / 1=开启';
    }
    return '';
  }

  private formatParameterFields(defaults: Record<string, string>, keys: string[], indent = '    '): string[] {
    return keys.map((key) => {
      const value = this.hasOwn(defaults, key) ? defaults[key] : '';
      const choices = this.fieldSelectText(key).replace(/^；/, '').trim();
      const widget = choices ? 'select' : 'input';
      return `${indent}- ${key}: 控件=${widget}${choices ? `；${choices}` : '；自由输入'}；前端预填=${value === '' ? '<空>' : value}`;
    });
  }

  private emaneFieldSpecs(defaults: Record<string, string>, keys: string[], group: string): Record<string, unknown>[] {
    return keys.map((key) => ({
      name: key,
      group,
      default: this.hasOwn(defaults, key) ? defaults[key] : '',
      widget: this.fieldSelectText(key) ? 'select' : 'input',
      options: SELECT_OPTIONS[key] || (this.fieldSelectText(key).includes('0=关闭') ? ['0', '1'] : undefined),
    }));
  }

  private objectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private arrayRecords(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.map((item) => this.objectRecord(item)).filter((item) => Object.keys(item).length > 0)
      : [];
  }

  private primarySubnetSelections(schemaData: Record<string, unknown>): Record<string, unknown> {
    const partial = this.objectRecord((schemaData as any).requested?.partialSelections);
    const subnets = this.arrayRecords(partial.subnets || partial.entities || partial.nodes);
    const subnet = subnets.find((item) =>
      String(item.nodeType || item.type || item.actionId || '').toLowerCase().includes('emane') ||
      String(item.actionId || '') === 'subnet.add'
    );
    return {
      ...partial,
      ...(subnet || {}),
    };
  }

  private subnetConfigStage(schemaData: Record<string, unknown>, selections: Record<string, unknown>): string {
    const requested = this.objectRecord((schemaData as any).requested);
    const explicit = String(requested.configStage || '').trim();
    if (explicit) return explicit;
    if (this.hasOwn(selections, 'emaneModel')) return 'subnet-parameters';
    return 'subnet-model';
  }

  private subnetMacDefaults(model: EmaneModel): Record<string, string> {
    if (model === 'tdma') return TDMA_MAC;
    if (model === 'ieee80211abg') return IEEE80211ABG_MAC;
    return RFPIPE_MAC;
  }

  private subnetMacKeys(model: EmaneModel): string[] {
    if (model === 'bypass' || model === 'commeffect') return [];
    if (model === 'tdma') return SUBNET_TDMA_MAC_EDITABLE_KEYS;
    if (model === 'ieee80211abg') return SUBNET_IEEE80211ABG_MAC_EDITABLE_KEYS;
    return SUBNET_RFPIPE_MAC_EDITABLE_KEYS;
  }

  private subnetUsesPhy(frontendModel: string | undefined, backendModel: EmaneModel): boolean {
    if (backendModel === 'bypass' || backendModel === 'commeffect') return false;
    if (isFrontendWiredLinkLayer(frontendModel)) return false;
    return ['rfpipe', 'tdma', 'ieee80211abg'].includes(backendModel);
  }

  private subnetParameterGroups(frontendModel?: string): Record<string, unknown> {
    const backendModel = normalizeEmaneModel(frontendModel);
    const macKeys = this.subnetMacKeys(backendModel);
    const parameterGroups: Record<string, unknown> = {
      external: this.emaneFieldSpecs(RFPIPE_EXTERNAL, SUBNET_EXTERNAL_EDITABLE_KEYS, 'External Parameters'),
      mac: this.emaneFieldSpecs(this.subnetMacDefaults(backendModel), macKeys, 'MAC Parameters'),
      platform: {
        basic: this.emaneFieldSpecs(RFPIPE_PLATFORM, SUBNET_PLATFORM_BASIC_KEYS, 'Platform Parameters'),
        eventService: this.emaneFieldSpecs(RFPIPE_PLATFORM, SUBNET_PLATFORM_EVENT_KEYS, 'Platform Parameters'),
        otaManager: this.emaneFieldSpecs(RFPIPE_PLATFORM, SUBNET_PLATFORM_OTA_KEYS, 'Platform Parameters'),
        stats: this.emaneFieldSpecs(RFPIPE_PLATFORM, SUBNET_PLATFORM_STATS_KEYS, 'Platform Parameters'),
      },
    };

    if (this.subnetUsesPhy(frontendModel, backendModel)) {
      parameterGroups.phy = {
        basic: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_BASIC_KEYS, 'PHY Parameters'),
        switches: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_SWITCH_KEYS, 'PHY Parameters'),
        noise: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_NOISE_KEYS, 'PHY Parameters'),
        fadingModel: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_FADING_MODEL_KEYS, 'PHY Parameters'),
        fadingConditionals: {
          lognormal: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_LOGNORMAL_KEYS, 'PHY Parameters'),
          nakagami: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_NAKAGAMI_KEYS, 'PHY Parameters'),
          rician: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_NAKAGAMI_KEYS, 'PHY Parameters'),
          rayleigh: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_NAKAGAMI_KEYS, 'PHY Parameters'),
          terahertz: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_TERAHERTZ_KEYS, 'PHY Parameters'),
          timevarying: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_TIMEVARYING_KEYS, 'PHY Parameters'),
        },
        stats: this.emaneFieldSpecs(RFPIPE_PHY, SUBNET_PHY_STATS_KEYS, 'PHY Parameters'),
      };
    }

    return parameterGroups;
  }

  private subnetConfigFormSpec(stage = 'subnet-model', selections: Record<string, unknown> = {}): Record<string, unknown> {
    const frontendModel = String(selections.emaneModel || '').trim();
    const phyType = String(selections.phyType || '').trim();
    const backendModel = frontendModel ? normalizeEmaneModel(frontendModel) : undefined;
    return {
      actionId: 'subnet.add',
      stage,
      nextConfigStage: stage === 'subnet-model' ? 'subnet-parameters' : 'review',
      displayMarkdown: this.formatSubnetUserDisplayOptions(stage, selections),
      requiredUserSelections: ['configRequestId', 'emaneModel', 'phyType or wired', 'emaneConfig'],
      basicFields: [
        { name: 'name', label: '子网名称/别名', widget: 'text', required: true },
        { name: 'lat', label: '纬度', widget: 'number', required: true },
        { name: 'lon', label: '经度', widget: 'number', required: true },
        { name: 'alt', label: '高度', widget: 'number', required: true, default: 200 },
        { name: 'role', label: '角色', widget: 'radio', required: true, default: 1, options: [{ value: 1, label: '公共' }, { value: 2, label: '红方' }, { value: 3, label: '蓝方' }] },
      ],
      linkLayerModels: FRONTEND_LINK_LAYER_MODELS,
      physicalLayerModels: FRONTEND_PHYSICAL_LAYER_MODELS,
      physicalLayerOptionsByLinkLayer: FRONTEND_PHY_OPTIONS_BY_LINK_LAYER,
      backendModelMappings: FRONTEND_LINK_LAYER_MODELS
        .filter((model) => model.backendModel)
        .map((model) => ({ frontendValue: model.value, backendModel: model.backendModel })),
      selected: frontendModel ? {
        emaneModel: frontendModel,
        backendModel,
        phyType: phyType || (isFrontendWiredLinkLayer(frontendModel) ? 'wired' : ''),
        isWired: isFrontendWiredLinkLayer(frontendModel),
      } : null,
      parameterGroups: stage === 'subnet-parameters' && frontendModel
        ? this.subnetParameterGroups(frontendModel)
        : undefined,
    };
  }

  private creationConfigFormSpec(action: Record<string, any>, schemaData: Record<string, unknown>): Record<string, unknown> {
    if (String(action.actionId) === 'subnet.add') {
      const selections = this.primarySubnetSelections(schemaData);
      return this.subnetConfigFormSpec(this.subnetConfigStage(schemaData, selections), selections);
    }
    return {
      actionId: action.actionId,
      label: action.label,
      submitTool: action.submitTool,
      fields: this.expandCreationFields(action).map((field) => ({
        ...field,
        currentOptions: this.formatSourceOptions(field, schemaData) || undefined,
      })),
      displayMarkdown: this.formatUserDisplayOptions(action, schemaData),
    };
  }

  private draftClientId(prefix: string, index: number, draft: Record<string, unknown>): string {
    const explicit = String(draft.clientId || '').trim();
    if (explicit) return explicit;
    const name = String(draft.name || draft.alias || '').trim();
    return name || `${prefix}${index + 1}`;
  }

  private compositeEntitySelection(partialSelections: unknown, clientId: string): Record<string, unknown> {
    const partial = this.objectRecord(partialSelections);
    const candidates = [
      ...this.arrayRecords(partial.entities),
      ...this.arrayRecords(partial.nodes),
      ...this.arrayRecords(partial.subnets),
      ...this.arrayRecords(partial.links),
    ];
    const matched = candidates.find((item) => String(item.clientId || '').trim() === clientId);
    return {
      ...partial,
      ...(matched || {}),
    };
  }

  private compositeConfigStage(nodes: Array<Record<string, unknown>>, partialSelections: unknown, explicitStage?: string): string {
    if (explicitStage) return explicitStage;
    const subnetNodes = nodes.filter((node) => String(node.actionId || '') === 'subnet.add' || String(node.nodeType || '') === 'EMANE');
    if (subnetNodes.length === 0) return 'review';
    const needsModel = subnetNodes.some((node) => {
      const selection = this.compositeEntitySelection(partialSelections, String(node.clientId || ''));
      return !this.hasOwn(selection, 'emaneModel');
    });
    if (needsModel) return 'subnet-model';
    const needsParameters = subnetNodes.some((node) => {
      const selection = this.compositeEntitySelection(partialSelections, String(node.clientId || ''));
      return !this.hasOwn(selection, 'emaneConfig');
    });
    return needsParameters ? 'subnet-parameters' : 'review';
  }

  private async compositeCreationConfigSchema(input: CreationConfigSchemaInput, data: Record<string, unknown>): Promise<OpenCliResult> {
    const composite = input.composite || {};
    const rawNodes = Array.isArray(composite.nodes) ? composite.nodes : [];
    const rawLinks = Array.isArray(composite.links) ? composite.links : [];
    const nodeDrafts: Array<CreationDraftNode & { clientId: string }> = rawNodes.map((draft, index) => {
      const record = this.objectRecord(draft) as CreationDraftNode;
      return {
        ...record,
        clientId: this.draftClientId('node', index, record),
      };
    });
    const linkDrafts: Array<CreationDraftLink & { clientId: string }> = rawLinks.map((draft, index) => {
      const record = this.objectRecord(draft) as CreationDraftLink;
      return {
        ...record,
        clientId: this.draftClientId('link', index, record),
      };
    });
    const stage = this.compositeConfigStage(nodeDrafts, input.partialSelections, input.configStage);
    const key = this.compositeConfigKey();
    const entityIds = [...nodeDrafts, ...linkDrafts].map((item) => String(item.clientId));
    const incomingRequestId = this.stringFromRecord(input.partialSelections, 'configRequestId');
    const request = this.rememberConfigRequest(key, composite.title || '复合拓扑创建', 'opencli_add_node/opencli_connect_nodes/opencli_add_links_batch', {
      kind: 'composite',
      stage,
      entityIds,
      requestId: incomingRequestId,
      partialSelections: input.partialSelections,
      source: 'schema',
      forceNew: input.forceNewConfigRequest === true && !incomingRequestId,
    });

    const nodeForms = nodeDrafts.map((draft, index) => {
      const action = this.findCreationAction(data, {
        actionId: String(draft.actionId || ''),
        nodeType: String(draft.nodeType || ''),
      }) || { actionId: draft.actionId, nodeType: draft.nodeType, label: draft.nodeType || `节点${index + 1}`, fields: [{ ref: 'basicNode' }] };
      const selection = this.compositeEntitySelection(input.partialSelections, String(draft.clientId));
      const formData = {
        ...data,
        requested: {
          ...(data as any).requested,
          configStage: String(action.actionId) === 'subnet.add' || String(action.nodeType) === 'EMANE' ? stage : input.configStage,
          partialSelections: selection,
        },
      };
      return {
        kind: 'node',
        clientId: draft.clientId,
        label: action.label || draft.nodeType || `节点${index + 1}`,
        actionId: action.actionId,
        nodeType: action.nodeType || draft.nodeType,
        draft,
        requiresConfig: this.actionRequiresCreationConfig(action),
        configForm: this.creationConfigFormSpec(action, formData),
      };
    });

    const dynamicOptions = this.objectRecord((data as any).dynamicOptions);
    const existingNodeOptions = Array.isArray((dynamicOptions as any).nodes) ? (dynamicOptions as any).nodes : [];
    const plannedNodeOptions = nodeForms.map((form) => ({
      id: form.clientId,
      value: form.clientId,
      name: form.draft?.name || form.draft?.alias || form.clientId,
      alias: form.draft?.alias || form.draft?.name || form.clientId,
      type: form.nodeType,
    }));
    const compositeDisplayData = {
      ...data,
      dynamicOptions: {
        ...dynamicOptions,
        nodes: [...plannedNodeOptions, ...existingNodeOptions],
      },
    };

    const linkAction = this.findCreationAction(data, { actionId: 'link.add' }) || { actionId: 'link.add', label: '添加链路', submitTool: 'opencli_connect_nodes', fields: [] };
    const linkForms = linkDrafts.map((draft, index) => ({
      kind: 'link',
      clientId: draft.clientId,
      label: `链路${index + 1}`,
      actionId: 'link.add',
      from: draft.from || draft.fromClientId,
      to: draft.to || draft.toClientId,
      draft,
      requiresConfig: true,
      configForm: this.creationConfigFormSpec(linkAction, compositeDisplayData),
    }));

    const configForm = {
      actionId: 'composite.create',
      stage,
      nextConfigStage: stage === 'subnet-model' ? 'subnet-parameters' : 'review',
      configRequestId: request.requestId,
      entities: nodeForms,
      links: linkForms,
      submitPattern: '用户确认后，混合节点/子网按 entity.clientId 分别调用 opencli_add_node；只有同类型节点组才使用 opencli_add_nodes_batch/opencli_add_nodes_grid。链路批量写入时保留每条 link.clientId，并在 userSelections 中带 configRequestId 与 clientId。',
    };
    const displayText = this.compactFormDisplay('复合拓扑创建配置表', {
      configRequestId: request.requestId,
      submitTool: 'opencli_add_node/opencli_connect_nodes/opencli_add_links_batch',
      nextConfigStage: configForm.nextConfigStage,
    }, this.compactConfigForm(configForm));

    return {
      ok: true,
      message: [
        '已返回复合拓扑创建配置表。',
        '',
        displayText,
      ].join('\n'),
      data: {
        ...data,
        selectedAction: { actionId: 'composite.create', label: composite.title || '复合拓扑创建' },
        requiresUserInput: true,
        submitTool: 'opencli_add_node/opencli_connect_nodes/opencli_add_links_batch',
        userFacingOptions: displayText,
        userDisplayText: displayText,
        configForm,
        configRequestKey: key,
        configRequestId: request.requestId,
        nextConfigStage: configForm.nextConfigStage,
      },
    };
  }

  private dynamicOptionText(schemaData: Record<string, unknown>, key: 'servers' | 'nodes'): string {
    const dynamic = (schemaData as any).dynamicOptions || {};
    const values = Array.isArray(dynamic[key]) ? dynamic[key] : [];
    if (values.length === 0) return key === 'servers' ? '当前无服务器可选' : '当前无节点可选';
    if (key === 'servers') return values.map((server: any) => server.value || server.name || server.host).join(' / ');
    return values.map((node: any) => `${node.alias || node.name || node.id}(id=${node.id}, type=${node.type})`).join(' / ');
  }

  private formatSubnetModelSelectionDisplay(): string {
    const basicFields = [
      { name: 'name', label: '子网名称/别名', widget: 'text', required: true, description: '前端显示为节点名称，后端 name/alias 会写入子网节点。' },
      { name: 'lat', label: '纬度', widget: 'number', required: true, description: 'AI 界面可让用户输入；前端由放置位置换算。' },
      { name: 'lon', label: '经度', widget: 'number', required: true, description: 'AI 界面可让用户输入；前端由放置位置换算。' },
      { name: 'alt', label: '高度/Z', widget: 'number', required: true, default: 200 },
      { name: 'role', label: '节点角色', widget: 'radio', required: true, options: [{ value: 1, label: '公共' }, { value: 2, label: '红方' }, { value: 3, label: '蓝方' }] },
    ];
    const linkRows = FRONTEND_LINK_LAYER_MODELS.map((model) => {
      const phy = FRONTEND_PHY_OPTIONS_BY_LINK_LAYER[model.value] || [];
      return `| ${this.markdownCell(model.label)} | ${this.markdownCell(model.value)} | ${this.markdownCell(model.description)} | ${this.markdownCell(phy.join(' / '))} | ${this.markdownCell(model.backendModel || model.value)} |`;
    });
    const phyRows = FRONTEND_PHYSICAL_LAYER_MODELS.map((model) =>
      `| ${this.markdownCell(model.label)} | ${this.markdownCell(model.value)} | ${this.markdownCell(model.description)} |`
    );
    const linkageRows = Object.entries(FRONTEND_PHY_OPTIONS_BY_LINK_LAYER).map(([model, options]) =>
      `| ${this.markdownCell(model)} | ${this.markdownCell(options.join(' / '))} |`
    );

    return [
      '添加子网配置表单（Stage 1：模型选择）',
      '',
      '1. 请选择/填写基本信息与坐标',
      ...this.formatCreationFieldsTable(basicFields, {}),
      '',
      '2. 请选择链路层模型（必须选择一个）',
      '| 显示名称 | 回传 emaneModel | 前端说明 | 允许的物理层 phyType | 后端实际模型 |',
      '| --- | --- | --- | --- | --- |',
      ...linkRows,
      '',
      '3. 请选择物理层模型（按链路层联动）',
      '| 显示名称 | 回传 phyType | 前端说明 |',
      '| --- | --- | --- |',
      ...phyRows,
      '',
      '4. 链路层到物理层联动表',
      '| emaneModel | 可选 phyType |',
      '| --- | --- |',
      ...linkageRows,
    ].join('\n');
  }

  private formatSubnetParameterDisplay(selections: Record<string, unknown>): string {
    const frontendModel = String(selections.emaneModel || '').trim();
    const phyType = String(selections.phyType || '').trim();
    const backendModel = normalizeEmaneModel(frontendModel);
    const macKeys = this.subnetMacKeys(backendModel);
    const usesPhy = this.subnetUsesPhy(frontendModel, backendModel);
    const lines = [
      '添加子网配置表单（Stage 2：模型参数）',
      '下面只列出当前链路层/物理层组合适用的 External/MAC/PHY/Platform 字段。前端预填值只是初始值，用户可以修改。',
      '',
      '1. 已选择模型',
      `  - 链路层 emaneModel：${frontendModel || '<未提供>'}${frontendDisplayModel(frontendModel, backendModel) ? `，后端实际模型 ${backendModel}` : ''}`,
      `  - 物理层 phyType：${isFrontendWiredLinkLayer(frontendModel) ? 'wired（有线模型，不要求无线物理层）' : (phyType || '<未提供>')}`,
      '',
      '2. 外部参数 External Parameters',
      ...this.formatParameterFields(RFPIPE_EXTERNAL, SUBNET_EXTERNAL_EDITABLE_KEYS),
      '',
      '3. MAC 参数',
      macKeys.length > 0
        ? `  - 当前后端模型 ${backendModel} 可填写：`
        : `  - 当前后端模型 ${backendModel} 前端 MAC 页无可填写项。`,
      ...this.formatParameterFields(this.subnetMacDefaults(backendModel), macKeys),
    ];

    if (usesPhy) {
      lines.push(
        '',
        '4. PHY 参数',
        '  - 基本参数：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_BASIC_KEYS),
        '  - 开关选项：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_SWITCH_KEYS),
        '  - 噪声配置：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_NOISE_KEYS),
        '  - 衰落模型选择：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_FADING_MODEL_KEYS),
        '  - 当 fading.model=lognormal 时，还需展示：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_LOGNORMAL_KEYS),
        '  - 当 fading.model=nakagami / rician / rayleigh 时，还需展示 Nakagami 参数；前端写入时 rician/rayleigh 会按 Nakagami 参数组处理：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_NAKAGAMI_KEYS),
        '  - 当 fading.model=terahertz 时，还需展示：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_TERAHERTZ_KEYS),
        '  - 当 fading.model=timevarying 时，还需展示：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_TIMEVARYING_KEYS),
        '  - 统计参数：',
        ...this.formatParameterFields(RFPIPE_PHY, SUBNET_PHY_STATS_KEYS)
      );
    } else {
      lines.push('', '4. PHY 参数', '  - 当前模型不要求用户选择或填写无线物理层参数。');
    }

    lines.push(
      '',
      '5. Platform Parameters',
      '  - 基本配置：',
      ...this.formatParameterFields(RFPIPE_PLATFORM, SUBNET_PLATFORM_BASIC_KEYS),
      '  - 事件服务配置：',
      ...this.formatParameterFields(RFPIPE_PLATFORM, SUBNET_PLATFORM_EVENT_KEYS),
      '  - OTA 管理器配置：',
      ...this.formatParameterFields(RFPIPE_PLATFORM, SUBNET_PLATFORM_OTA_KEYS),
      '  - 统计配置：',
      ...this.formatParameterFields(RFPIPE_PLATFORM, SUBNET_PLATFORM_STATS_KEYS)
    );

    return lines.join('\n');
  }

  private formatSubnetUserDisplayOptions(stage = 'subnet-model', selections: Record<string, unknown> = {}): string {
    if (stage === 'subnet-parameters') return this.formatSubnetParameterDisplay(selections);
    return this.formatSubnetModelSelectionDisplay();
  }

  private formatUserDisplayOptions(action: Record<string, any>, schemaData: Record<string, unknown>): string {
    const label = action.label || action.nodeType || action.actionId || '当前对象';
    if (String(action.actionId) === 'subnet.add') {
      const selections = this.primarySubnetSelections(schemaData);
      return this.formatSubnetUserDisplayOptions(this.subnetConfigStage(schemaData, selections), selections);
    }

    if (String(action.actionId) === 'link.add') {
      const groups = this.splitCreationFields(action);
      const lines = [
        `添加链路配置表单（${label}）`,
        '',
        '1. 端点选择',
        `- 源节点 from：从当前拓扑节点中选择；${this.dynamicOptionText(schemaData, 'nodes')}。`,
        `- 目标节点 to：从当前拓扑节点中选择；${this.dynamicOptionText(schemaData, 'nodes')}。`,
        '',
        '2. 源端/目标端接口',
        '| 字段 | 前端控件 | 支持填写/可选内容 | 说明 |',
        '| --- | --- | --- | --- |',
        '| iface.id | number input | 数字接口 ID | EMANE 节点不显示接口配置 |',
        '| iface.name | text input | 例如 eth0、eth1 | 普通节点按已有接口生成下一项，用户可改 |',
        '| iface.mac | text input | MAC 地址或留空 | 前端普通链路不自动分配 MAC |',
        '| iface.ip / iface.mask | text/number input | IPv4 与掩码，例如 10.0.0.1 / 24 | OVS/SWITCH/RJ45/SR/VM/EMANE 侧不显示 IP 字段 |',
        '| iface.ip6 / iface.ip6Mask | text/number input | IPv6 与掩码，例如 2001:db8::1 / 64 | 同上 |',
        '',
        '3. 链路参数',
        ...this.formatCreationFieldsTable(groups.other, schemaData)
      ];
      return lines.join('\n');
    }

    const groups = this.splitCreationFields(action);
    const lines = [
      `节点创建配置表单（${label}）`,
      '',
      `节点类型（只读）：${label}${action.nodeType ? ` / nodeType=${action.nodeType}` : ''}`,
      ...this.formatFieldSection('1. 请选择/填写基本信息与坐标信息', groups.basic, schemaData),
    ];

    if (String(action.actionId) === 'device.vm') {
      lines.push(...this.formatFieldSection('2. 请选择 VM 模板配置', groups.vm, schemaData));
    } else if (['device.drone', 'device.van'].includes(String(action.actionId))) {
      lines.push(
        ...this.formatFieldSection('2. 请选择/填写快速放置参数', groups.placement, schemaData),
        ...this.formatFieldSection('3. 请选择协议服务', groups.protocol, schemaData),
        ...this.formatFieldSection('4. 请选择 SERVER 配置（分布式场景显示）', groups.server, schemaData)
      );
    } else if (['device.basestation', 'device.satellite'].includes(String(action.actionId))) {
      lines.push(...this.formatFieldSection('2. 请选择协议服务', groups.protocol, schemaData));
    } else if (String(action.actionId) === 'device.router') {
      lines.push(
        ...this.formatFieldSection('2. 请选择/填写快速放置参数', groups.placement, schemaData),
        ...this.formatFieldSection('3. 请选择协议服务（分布式场景显示）', groups.protocol, schemaData),
        ...this.formatFieldSection('4. 请选择 SERVER 配置（分布式场景显示）', groups.server, schemaData)
      );
    } else if (String(action.actionId) === 'hardware.add') {
      lines.push(...this.formatFieldSection('2. 请选择物理网口配置', groups.hardware, schemaData));
    } else if (String(action.actionId) === 'interference.add') {
      lines.push(...this.formatFieldSection('2. 请选择/填写干扰参数', groups.interference, schemaData));
    } else if (String(action.actionId) === 'business.tmv') {
      lines.push(...this.formatFieldSection('2. 请选择流量终端配置', groups.deviceSpecific, schemaData));
    } else if (String(action.actionId) === 'business.transmitter') {
      lines.push(...this.formatFieldSection('2. 请选择传输器配置', groups.deviceSpecific, schemaData));
    } else if (String(action.category) === 'application') {
      lines.push('', `2. 应用层模型`, `- ${label} 在前端创建时除基本信息与坐标外没有额外配置弹窗；但基本信息仍需要用户填写/确认。`);
    }

    lines.push(...this.formatFieldSection('其他字段', groups.other, schemaData));
    return lines.join('\n');
  }

  private flattenEmaneConfig(node: Node): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    (Array.isArray(node.emane_configs) ? node.emane_configs : []).forEach((item) => {
      Object.entries(item.config || {}).forEach(([key, option]) => {
        result[key] = {
          value: option.value,
          type: option.type,
          select: option.select,
          group: option.group,
          model: item.model,
          ifaceId: item.ifaceId,
        };
      });
    });
    return result;
  }

  private isVMNode(node: Node): boolean {
    return node.type === 'VMNODE' || node.model === 'vm' || typeof (node as any).templateId !== 'undefined';
  }

  private isNestV3Docker(node: Node): boolean {
    return node.type === 'DOCKER' && node.image === 'nest:v3';
  }

  private nodeInterfaceNames(node: Node, topo: TopoData): string[] {
    return this.normalizeStringList(
      this.getNodeInterfaces(topo.links || [], node.id)
        .map((iface) => iface.name)
        .filter(Boolean)
    );
  }

  private connectedNonEmaneNodes(node: Node, topo: TopoData): Node[] {
    const byId = new Map<number, Node>();
    (topo.links || []).forEach((link) => {
      if (link.node1_id !== node.id && link.node2_id !== node.id) return;
      const otherId = link.node1_id === node.id ? link.node2_id : link.node1_id;
      const otherNode = (topo.nodes || []).find((candidate) => candidate.id === otherId);
      if (otherNode && otherNode.type !== 'EMANE') byId.set(otherNode.id, otherNode);
    });
    return Array.from(byId.values());
  }

  private nodeConfigSnapshot(node: Node, topo: TopoData): Record<string, unknown> {
    const connectedNodes = this.connectedNonEmaneNodes(node, topo).map((connected) => ({
      id: connected.id,
      name: connected.name,
      alias: connected.alias,
      type: connected.type,
    }));

    return {
      id: node.id,
      name: node.name,
      alias: node.alias,
      type: node.type,
      model: node.model,
      image: node.image,
      status: node.status || 'UP',
      role: node.role,
      server: node.server,
      configServices: node.config_services || [],
      geo: node.geo,
      phyType: node.phy_type,
      interfaces: this.nodeInterfaceNames(node, topo),
      connectedNodes,
      vm: this.isVMNode(node)
        ? {
            templateId: (node as any).templateId,
            templateName: (node as any).templateName,
            cpu: (node as any).vcpu,
            memoryKb: (node as any).memory,
            currentMemoryKb: (node as any).curMemory,
            disk: (node as any).disk,
            location: (node as any).location,
          }
        : undefined,
      protocol: {
        container: `${node.name}-${topo.id}`,
        isNestV3Docker: this.isNestV3Docker(node),
      },
      tdma: {
        scheduleNodeSlotMapKeys: connectedNodes.map((connected) => connected.id),
      },
      emaneConfig: this.flattenEmaneConfig(node),
    };
  }

  private applyEmaneConfigOverrides(node: any, overrides: Record<string, NodeConfigValue>): { keys: string[] } {
    const keys: string[] = [];
    const modelFromNode = String(node.emane || node.emane_configs?.[0]?.model || 'emane_rfpipe').replace(/^emane_/, '');
    const model = normalizeEmaneModel(modelFromNode);
    const modelName = `emane_${model}`;

    if (!Array.isArray(node.emane_configs)) {
      node.emane_configs = createDefaultEmaneConfig(model, {});
    }

    Object.entries(overrides).forEach(([key, value]) => {
      if (typeof value === 'undefined') return;
      const stringValue = stringifyConfigValue(value);
      const existing = node.emane_configs.find((item: EmaneConfig) =>
        item.config && Object.prototype.hasOwnProperty.call(item.config, key)
      );

      if (existing) {
        existing.config[key].value = stringValue;
      } else {
        const meta = emaneParamType(key, 'MCP Overrides');
        node.emane_configs.push(emaneConfigItem(modelName, key, stringValue, 'MCP Overrides', meta.type, meta.select));
      }
      keys.push(key);
    });

    return { keys };
  }

  private kbStringToMb(value: unknown, fallbackMb: number): number {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMb;
    return Math.round(parsed / 1024);
  }

  private requireIntegerInRange(value: unknown, min: number, max: number, label: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label} 必须是数字。`);
    const integer = Math.round(parsed);
    if (integer < min || integer > max) {
      throw new Error(`${label} 必须在 ${min} 到 ${max} 之间。`);
    }
    return integer;
  }

  private requireProtocolInterfaces(protocolName: string, config: ProtocolToggleInput, availableInterfaces: string[]): string[] {
    const interfaces = this.normalizeStringList(config.interfaces || []);
    if (interfaces.length === 0) {
      throw new Error(`${protocolName} 至少需要选择一个网卡。`);
    }

    if (availableInterfaces.length > 0) {
      const missing = interfaces.filter((iface) => !availableInterfaces.includes(iface));
      if (missing.length > 0) {
        throw new Error(`${protocolName} 网卡不存在：${missing.join(', ')}。可选网卡：${availableInterfaces.join(', ')}`);
      }
    }

    return interfaces;
  }

  private assertNestProtocolAllowed(node: Node, protocolName: string): void {
    if (!this.isNestV3Docker(node)) {
      throw new Error(`${protocolName} 协议配置只适用于 DOCKER 且 image=nest:v3 的节点；当前节点是 ${node.type}/${node.image || ''}。`);
    }
  }

  private buildProtocolPayload(topo: TopoData, node: Node, input: ProtocolConfigInput): Record<string, any> {
    const payload: Record<string, any> = {
      container: `${node.name}-${topo.id}`,
      sessionId: topo.id,
    };
    const availableInterfaces = this.nodeInterfaceNames(node, topo);

    if (input.ospf2?.enabled) {
      this.assertNestProtocolAllowed(node, 'OSPFv2');
      payload.ospf2Interfaces = this.requireProtocolInterfaces('OSPFv2', input.ospf2, availableInterfaces).join(',');
      payload.ospf2Area = String(input.ospf2.areaId ?? 0);
      payload.protocolOspf2 = 'on';
    }

    if (input.ospf3?.enabled) {
      this.assertNestProtocolAllowed(node, 'OSPFv3');
      payload.ospf3Interfaces = this.requireProtocolInterfaces('OSPFv3', input.ospf3, availableInterfaces).join(',');
      payload.ospf3Area = String(input.ospf3.areaId ?? '');
      payload.protocolOspf3 = 'on';
    }

    if (input.rip?.enabled) {
      this.assertNestProtocolAllowed(node, 'RIP');
      payload.ripInterfaces = this.requireProtocolInterfaces('RIP', input.rip, availableInterfaces).join(',');
      payload.protocolRip = 'on';
    }

    if (input.isis?.enabled) {
      this.assertNestProtocolAllowed(node, 'IS-IS');
      payload.isisInterfaces = this.requireProtocolInterfaces('IS-IS', input.isis, availableInterfaces).join(',');
      payload.isisProcess = String(input.isis.process ?? '');
      payload.isisNet = input.isis.netAddr || '';
      payload.protocolIsis = 'on';
    }

    if (input.pim?.enabled) {
      this.assertNestProtocolAllowed(node, 'PIM');
      payload.pimInterfaces = this.requireProtocolInterfaces('PIM', input.pim, availableInterfaces).join(',');
      payload.protocolPim = 'on';
    }

    if (input.bgp?.enabled) {
      this.assertNestProtocolAllowed(node, 'BGP');
      const neighbors = Array.isArray(input.bgp.neighbors) ? input.bgp.neighbors : [];
      payload.bgpLocalAs = String(input.bgp.localAs ?? '');
      payload.bgpNeighborIp = neighbors.map((neighbor) => neighbor.neighborIp || '').join(',');
      payload.bgpNeighborAs = neighbors.map((neighbor) => String(neighbor.neighborAs ?? '')).join(',');
      payload.protocolBgp = 'on';
    }

    if (input.snapshot?.enabled) {
      this.assertNestProtocolAllowed(node, 'Snapshot');
      payload.snapshotInterfaces = this.requireProtocolInterfaces('Snapshot', input.snapshot, availableInterfaces).join(',');
      payload.protocolSnapshot = 'on';
    }

    if (input.backpressure?.enabled) {
      this.assertNestProtocolAllowed(node, 'Backpressure');
      payload.backpressureInterfaces = this.requireProtocolInterfaces('Backpressure', input.backpressure, availableInterfaces).join(',');
      payload.protocolBackpressure = 'on';
    }

    const staticRoutes = (input.staticRoutes || [])
      .map((route) => ({
        destination: String(route.destination || '').trim(),
        nexthop: String(route.nexthop || '').trim(),
        interface: String(route.interface || '').trim(),
      }))
      .filter((route) => route.destination || route.nexthop || route.interface);

    if (staticRoutes.length > 0) {
      payload.exJson = {
        static_routes: staticRoutes,
      };
    }

    if (input.convergence?.targetCidr) {
      payload.targetCidr = input.convergence.targetCidr;
      payload.maxAttempts = Number(input.convergence.maxAttempts ?? 0);
    }

    return payload;
  }

  private resolveTdmaNodeId(target: string, connectedNodes: Node[]): number | null {
    const normalized = String(target || '').trim().toLowerCase();
    const node = connectedNodes.find((candidate) =>
      String(candidate.id) === normalized ||
      candidate.name?.toLowerCase() === normalized ||
      candidate.alias?.toLowerCase() === normalized
    );
    return node?.id ?? null;
  }

  private buildTdmaRequest(topo: TopoData, node: Node, input: TdmaScheduleInput): {
    savePath: string;
    slots: number;
    slotduration: number;
    slotList: Array<{ index: number; nodes: string }>;
  } {
    if (node.type !== 'EMANE') {
      throw new Error(`TDMA 时隙配置需要选择 EMANE 子网节点；当前节点是 ${node.type}。`);
    }

    const connectedNodes = this.connectedNonEmaneNodes(node, topo);
    const minSlotCount = Math.max(connectedNodes.length, 1);
    const slotCount = this.requireIntegerInRange(input.slotCount ?? minSlotCount, minSlotCount, 100, 'slotCount');
    const slotWidth = this.requireIntegerInRange(input.slotWidth ?? 10000, 1, 100000, 'slotWidth');
    const savePath = String(input.filePath || '/usr/local/share/core/tdmaschedule/schedule1.xml').trim();
    const nodeSlotMap: Record<number, number> = {};

    if (input.nodeSlotMap && Object.keys(input.nodeSlotMap).length > 0) {
      Object.entries(input.nodeSlotMap).forEach(([target, slotIndex]) => {
        const nodeId = this.resolveTdmaNodeId(target, connectedNodes);
        if (!nodeId) {
          throw new Error(`TDMA 映射里的节点不存在或未连接到该子网：${target}`);
        }
        nodeSlotMap[nodeId] = this.requireIntegerInRange(slotIndex, 0, slotCount - 1, `nodeSlotMap.${target}`);
      });
    } else {
      connectedNodes.forEach((connected, index) => {
        nodeSlotMap[connected.id] = index % slotCount;
      });
    }

    const slotToNodeMap: Record<number, string> = {};
    Object.entries(nodeSlotMap).forEach(([nodeId, slotIndex]) => {
      slotToNodeMap[slotIndex] = String(nodeId);
    });

    return {
      savePath,
      slots: slotCount,
      slotduration: slotWidth,
      slotList: Array.from({ length: slotCount }, (_, index) => ({
        index,
        nodes: slotToNodeMap[index] || '65535',
      })),
    };
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
    const links = this.state.topoData?.links || [];
    if (nodes.length === 0 && links.length === 0) return 1;
    const maxNodeId = nodes.length > 0 ? Math.max(...nodes.map((node) => Number(node.id) || 0)) : 0;
    return maxNodeId + links.length + 1;
  }

  private isBackendSafeNodeName(name: string): boolean {
    return /^[A-Za-z][A-Za-z0-9_-]*$/.test(name.trim());
  }

  private backendCompatibleNodeName(type: McpNodeType, name: string): string | null {
    const trimmed = name.trim();
    if (!this.isBackendSafeNodeName(trimmed)) return null;
    if (type !== 'DRONE' && type !== 'VAN') return trimmed;
    if (/DRONE/i.test(trimmed)) return trimmed.replace(/drone/gi, 'DRONE');
    return `${prefixByType[type] || 'DRONE'}_${trimmed}`;
  }

  private isNodeNameUsed(nodes: Node[], name: string): boolean {
    const normalized = name.toLowerCase();
    return nodes.some((node) =>
      node.name?.toLowerCase() === normalized ||
      node.alias?.toLowerCase() === normalized
    );
  }

  private nextNodeName(type: McpNodeType, nodes: Node[], customName?: string): string {
    if (type === 'EMANE') return this.nextSubnetName(nodes, customName);

    const prefix = prefixByType[type] || 'NODE';
    const baseName = customName ? this.backendCompatibleNodeName(type, customName) : null;

    if (baseName && !this.isNodeNameUsed(nodes, baseName)) return baseName;

    let index = 1;
    let candidate = `${prefix}${index}`;
    while (this.isNodeNameUsed(nodes, candidate)) {
      index += 1;
      candidate = `${prefix}${index}`;
    }
    return candidate;
  }

  private nextSubnetName(nodes: Node[], customName?: string): string {
    const trimmed = customName?.trim() || '';
    if (/^subnet-\d+$/i.test(trimmed) && !this.isNodeNameUsed(nodes, trimmed)) {
      return trimmed.toLowerCase();
    }

    let index = 1;
    let candidate = `subnet-${index}`;
    while (this.isNodeNameUsed(nodes, candidate)) {
      index += 1;
      candidate = `subnet-${index}`;
    }
    return candidate;
  }

  private nextSubnetAlias(nodes: Node[], customName?: string): string {
    const trimmed = customName?.trim();
    if (trimmed) return trimmed;

    let index = 1;
    let candidate = `\u5b50\u7f51${index}`;
    while (this.isNodeNameUsed(nodes, candidate)) {
      index += 1;
      candidate = `\u5b50\u7f51${index}`;
    }
    return candidate;
  }

  private nextInterferenceAlias(nodes: Node[], customName?: string): string {
    const trimmed = customName?.trim();
    if (trimmed) return trimmed;

    let index = 1;
    let candidate = `干扰${index}`;
    while (this.isNodeNameUsed(nodes, candidate)) {
      index += 1;
      candidate = `干扰${index}`;
    }
    return candidate;
  }

  private defaultServerName(topo: TopoData): string {
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    return String(servers[0]?.name || servers[0]?.host || '');
  }

  private normalizeState(state?: string | null): string {
    return String(state || '').trim().toUpperCase();
  }

  private isRuntimeState(state?: string | null): boolean {
    return ['RUNTIME', 'RUNNING', 'INSTANTIATION'].includes(this.normalizeState(state));
  }

  private shouldPreservePreviousTopo(next: TopoData, previous?: TopoData | null): boolean {
    if (!previous || Number(previous.id) !== Number(next.id)) return false;

    const previousNodes = Array.isArray(previous.nodes) ? previous.nodes : [];
    const nextNodes = Array.isArray(next.nodes) ? next.nodes : [];
    if (previousNodes.length === 0 || nextNodes.length > 0) return false;

    return this.isRuntimeState(next.state) || this.isRuntimeState(previous.state);
  }

  private mergeTopoForRuntime(next: TopoData, previous?: TopoData | null): TopoData {
    const normalizedNext = normalizeTopoArrays(next);
    const normalizedPrevious = previous ? normalizeTopoArrays(previous) : null;

    if (!this.shouldPreservePreviousTopo(normalizedNext, normalizedPrevious)) {
      return normalizedNext;
    }

    return normalizeTopoArrays({
      ...normalizedPrevious,
      ...normalizedNext,
      id: normalizedNext.id || normalizedPrevious!.id,
      name: normalizedNext.name || normalizedPrevious!.name,
      state: normalizedNext.state || normalizedPrevious!.state,
      nodes: normalizedPrevious!.nodes,
      links: normalizedPrevious!.links,
      servers: Array.isArray((normalizedNext as any).servers) && (normalizedNext as any).servers.length > 0
        ? (normalizedNext as any).servers
        : (normalizedPrevious as any).servers,
    } as TopoData);
  }

  private rememberTopo(topo: TopoData, fallbackSessionId?: number): TopoData {
    const normalizedInput = normalizeTopoArrays({
      ...topo,
      id: Number(topo.id || fallbackSessionId),
    } as TopoData);
    const normalized = this.mergeTopoForRuntime(normalizedInput, this.state.topoData);
    const targetSessionId = Number(normalized.id || fallbackSessionId);

    this.state.currentSessionId = targetSessionId || this.state.currentSessionId;
    this.state.currentSessionName = normalized.name || this.state.currentSessionName || `场景${targetSessionId}`;
    this.state.topoData = normalized;
    return normalized;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private websocketHeartbeatPayload(sessionId: number | null): Record<string, unknown> {
    return {
      action: 1,
      extand: null,
      senderId: config.userId || 'mcp',
      sessionId,
      role: 1,
    };
  }

  private async sendWebSocketPayload(payload: Record<string, unknown>, timeoutMs = 3000): Promise<boolean> {
    const WebSocketCtor = (globalThis as any).WebSocket;
    if (!config.websocketUrl || typeof WebSocketCtor !== 'function') {
      return false;
    }

    return new Promise((resolve) => {
      let finished = false;
      let socket: any = null;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        if (timeout) clearTimeout(timeout);
        try {
          socket?.close?.();
        } catch {
          // Ignore websocket cleanup failures; this notification is best-effort.
        }
        resolve(ok);
      };

      try {
        socket = new WebSocketCtor(config.websocketUrl);
      } catch {
        finish(false);
        return;
      }

      timeout = setTimeout(() => finish(false), timeoutMs);

      const onOpen = () => {
        try {
          const sessionId = Number(payload.sessionId || this.state.currentSessionId || this.state.topoData?.id || 0);
          socket.send(JSON.stringify(this.websocketHeartbeatPayload(Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null)));

          setTimeout(() => {
            try {
              socket.send(JSON.stringify(payload));
              setTimeout(() => finish(true), 500);
            } catch {
              finish(false);
            }
          }, 120);
        } catch {
          finish(false);
        }
      };

      const onErrorOrClose = () => finish(false);

      if (typeof socket.addEventListener === 'function') {
        socket.addEventListener('open', onOpen, { once: true });
        socket.addEventListener('error', onErrorOrClose, { once: true });
        socket.addEventListener('close', onErrorOrClose, { once: true });
      } else {
        socket.onopen = onOpen;
        socket.onerror = onErrorOrClose;
        socket.onclose = onErrorOrClose;
      }
    });
  }

  private async notifyFrontendTopoSync(sessionId: number, reason: string): Promise<boolean> {
    return this.sendWebSocketPayload({
      action: 11,
      sessionId,
      senderId: config.userId || 'mcp',
      extand: 'CROSS_PAGE_SYNC',
      source: 'mcp',
      reason,
      timestamp: Date.now(),
    });
  }

  private async notifyFrontendTopoSyncIfBackendComplete(referenceTopo: TopoData, reason: string): Promise<boolean> {
    const expected = normalizeTopoArrays(referenceTopo);
    try {
      const backendTopo = await this.fetchTopo(Number(expected.id));
      if (backendTopo.nodes.length < expected.nodes.length || backendTopo.links.length < expected.links.length) {
        return false;
      }
      return this.notifyFrontendTopoSync(Number(expected.id), reason);
    } catch {
      return false;
    }
  }

  private async waitForFrontendTopoSync(sessionId: number, reason: string): Promise<boolean> {
    const notified = await this.notifyFrontendTopoSync(sessionId, reason);
    if (notified && config.frontendSyncDelayMs > 0) {
      await this.sleep(config.frontendSyncDelayMs);
    }
    return notified;
  }

  private nodePositionPayload(topo: TopoData): Array<{ nodeId: number; geo: { lat: number; lon: number; alt: number } }> {
    return (topo.nodes || [])
      .map((node) => ({
        nodeId: Number(node.id),
        geo: {
          lat: Number(node.geo?.lat),
          lon: Number(node.geo?.lon),
          alt: Number(node.geo?.alt ?? 0),
        },
      }))
      .filter((item) =>
        Number.isFinite(item.nodeId) &&
        Number.isFinite(item.geo.lat) &&
        Number.isFinite(item.geo.lon) &&
        Number.isFinite(item.geo.alt)
      );
  }

  private async seedRuntimeNodePositions(topo: TopoData, reason: string): Promise<boolean> {
    const nodes = this.nodePositionPayload(topo);
    if (nodes.length === 0) return false;

    return this.sendWebSocketPayload({
      action: 5,
      extand: null,
      senderId: config.userId || 'mcp',
      sessionId: Number(topo.id),
      source: 'mcp',
      reason,
      nodes,
      timestamp: Date.now(),
    });
  }

  private findReferenceNode(referenceTopo: TopoData, node: Node): Node | undefined {
    const runtimeId = Number(node.id);
    const byId = (referenceTopo.nodes || []).find((candidate) => Number(candidate.id) === runtimeId);
    if (byId) return byId;

    const names = [
      String((node as any).name || '').trim().toLowerCase(),
      String((node as any).alias || '').trim().toLowerCase(),
    ].filter(Boolean);

    return (referenceTopo.nodes || []).find((candidate) => {
      const candidateNames = [
        String((candidate as any).name || '').trim().toLowerCase(),
        String((candidate as any).alias || '').trim().toLowerCase(),
      ].filter(Boolean);
      return candidateNames.some((name) => names.includes(name));
    });
  }

  private frontendRole(value: unknown): 'WHITE' | 'RED' | 'BLUE' | 'UNKNOWN' | null {
    if (value === null) return null;
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!normalized) return null;
    if (normalized === '2' || normalized === 'RED') return 'RED';
    if (normalized === '3' || normalized === 'BLUE') return 'BLUE';
    if (normalized === '0' || normalized === 'UNKNOWN' || normalized === 'ALL') return 'UNKNOWN';
    return 'WHITE';
  }

  private copyFrontendRenderFields(runtimeNode: Node, referenceNode: Node): Node {
    const fields = [
      'name',
      'type',
      'model',
      'image',
      'geo',
      'role',
      'status',
      'alias',
      'position',
      'emane',
      'icon',
      'server',
      'config_services',
      'dir',
      'channel',
      'canvas',
      'wlan_config',
      'mobility_config',
      'service_configs',
      'emane_configs',
      'displayModel',
      'phy_type',
      'isWired',
    ];
    const restored: any = { ...runtimeNode };

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(referenceNode as any, field)) {
        restored[field] = (referenceNode as any)[field];
      }
    });

    restored.id = runtimeNode.id;
    restored.geo = {
      lon: Number(referenceNode.geo?.lon),
      lat: Number(referenceNode.geo?.lat),
      alt: Number(referenceNode.geo?.alt ?? 0),
    };
    restored.role = this.frontendRole((referenceNode as any).role);

    return restored as Node;
  }

  private nodeRenderFieldsChanged(runtimeNode: Node, referenceNode: Node): boolean {
    const restored = this.copyFrontendRenderFields(runtimeNode, referenceNode) as any;
    const current = runtimeNode as any;
    const comparableFields = [
      'name',
      'type',
      'model',
      'image',
      'role',
      'status',
      'alias',
      'server',
      'config_services',
      'emane',
      'emane_configs',
      'displayModel',
      'phy_type',
      'isWired',
    ];

    if (!Number.isFinite(restored.geo.lat) || !Number.isFinite(restored.geo.lon)) {
      return false;
    }

    const currentLat = Number(current.geo?.lat);
    const currentLon = Number(current.geo?.lon);
    const currentAlt = Number(current.geo?.alt ?? 0);
    if (
      !Number.isFinite(currentLat) ||
      !Number.isFinite(currentLon) ||
      Math.abs(currentLat - restored.geo.lat) > 0.000001 ||
      Math.abs(currentLon - restored.geo.lon) > 0.000001 ||
      Math.abs(currentAlt - restored.geo.alt) > 0.1
    ) {
      return true;
    }

    return comparableFields.some((field) => JSON.stringify(current[field] ?? null) !== JSON.stringify(restored[field] ?? null));
  }

  private async restoreRuntimeFrontendTopology(
    referenceTopo: TopoData,
    currentTopo: TopoData,
    userId: string,
    reason: string
  ): Promise<{ topo: TopoData; restoredCount: number; failedCount: number }> {
    let latestTopo = normalizeTopoArrays(currentTopo);
    let restoredCount = 0;
    let failedCount = 0;

    for (const runtimeNode of latestTopo.nodes || []) {
      const referenceNode = this.findReferenceNode(referenceTopo, runtimeNode);
      if (!referenceNode || !this.nodeRenderFieldsChanged(runtimeNode, referenceNode)) continue;

      const restoredNode = this.copyFrontendRenderFields(runtimeNode, referenceNode);
      try {
        const response = await this.backend.editNode(restoredNode, Number(referenceTopo.id), userId);
        latestTopo = await this.updateTopoFromResponse(response, Number(referenceTopo.id));
        restoredCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    if (restoredCount > 0) {
      try {
        const waited = await this.waitForTopoCounts(referenceTopo.id, referenceTopo.nodes.length, referenceTopo.links.length, { strict: false });
        latestTopo = waited.topo || latestTopo;
      } catch {
        // Keep the last successful edit response.
      }
      await this.notifyFrontendTopoSyncIfBackendComplete(referenceTopo, reason);
    }

    return { topo: latestTopo, restoredCount, failedCount };
  }

  private runtimeRenderDiagnostics(referenceTopo: TopoData, runtimeTopo: TopoData): Array<Record<string, unknown>> {
    return (runtimeTopo.nodes || []).map((node) => {
      const referenceNode = this.findReferenceNode(referenceTopo, node);
      const role = (node as any).role;
      const geo = (node.geo || {}) as Partial<Node['geo']>;
      const type = String((node as any).type || '');
      const name = String((node as any).name || '');
      return {
        id: node.id,
        name,
        alias: (node as any).alias,
        type,
        role,
        geo,
        referenceName: referenceNode?.name,
        referenceType: referenceNode?.type,
        frontendRenderableType: ['DRONE', 'DEFAULT', 'VMNODE', 'DOCKER', 'SWITCH', 'EMANE', 'BASESTATION', 'INODE', 'RJ45'].includes(type),
        frontendRenderableName: type === 'DRONE' ? name.includes('DRONE') : true,
        finiteGeo:
          Number.isFinite(Number(geo.lat)) &&
          Number.isFinite(Number(geo.lon)) &&
          Number.isFinite(Number(geo.alt ?? 0)),
      };
    });
  }

  private summarizeNodesWithoutServer(nodes: Node[]): string {
    return nodes
      .slice(0, 8)
      .map((node) => node.alias || node.name || `#${node.id}`)
      .join(', ');
  }

  private async waitForTopoCounts(
    sessionId: number,
    expectedNodes: number,
    expectedLinks: number,
    options: { attempts?: number; intervalMs?: number; strict?: boolean } = {}
  ): Promise<TopoWaitResult> {
    const attempts = options.attempts ?? 12;
    const intervalMs = options.intervalMs ?? 300;
    let lastTopo: TopoData | null = null;
    let lastBest: TopoData | null =
      Number(this.state.topoData?.id || 0) === Number(sessionId)
        ? normalizeTopoArrays(this.state.topoData as TopoData)
        : null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        lastTopo = await this.fetchTopo(sessionId);
        if (lastTopo.nodes.length > 0 || lastTopo.links.length > 0) {
          lastBest = lastTopo;
        }

        if (lastTopo.nodes.length >= expectedNodes && lastTopo.links.length >= expectedLinks) {
          return {
            topo: this.rememberTopo(lastTopo, sessionId),
            attempts: attempt,
            settled: true,
          };
        }
      } catch {
        // Retry because topo writes and runtime transitions are eventually visible.
      }

      if (attempt < attempts) {
        await this.sleep(intervalMs);
      }
    }

    const finalTopo = lastBest || lastTopo;
    const actualNodes = finalTopo?.nodes.length || 0;
    const actualLinks = finalTopo?.links.length || 0;

    if (options.strict) {
      throw new Error(`Topology is not visible in backend before start: expected nodes>=${expectedNodes}, links>=${expectedLinks}; got nodes=${actualNodes}, links=${actualLinks}.`);
    }

    return {
      topo: this.rememberTopo(finalTopo || await this.requireLoadedTopo(), sessionId),
      attempts,
      settled: false,
    };
  }

  private async ensureServersAssigned(topo: TopoData, userId: string): Promise<{ topo: TopoData; assignedCount: number }> {
    const nodes = topo.nodes || [];
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    const server = this.defaultServerName(topo);
    const nodesWithoutServer = nodes.filter((node: any) => !String(node.server || '').trim());

    if (nodes.length === 0) {
      throw new Error('No nodes are available in the current scene; refusing to start an empty simulation.');
    }

    if (nodesWithoutServer.length === 0 || servers.length === 0 || !server) {
      return { topo, assignedCount: 0 };
    }

    let currentTopo = topo;
    for (const node of nodesWithoutServer) {
      const response = await this.backend.editNode({ ...node, server }, topo.id, userId);
      currentTopo = await this.updateTopoFromResponse(response, topo.id);
    }

    const waited = await this.waitForTopoCounts(topo.id, nodes.length, topo.links.length, { strict: true });
    currentTopo = waited.topo || currentTopo;

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const refreshed = await this.fetchTopo(topo.id);
      const missing = (refreshed.nodes || []).filter((node: any) => !String(node.server || '').trim());
      if (missing.length === 0) {
        return { topo: this.rememberTopo(refreshed, topo.id), assignedCount: nodesWithoutServer.length };
      }

      if (attempt < 12) {
        await this.sleep(300);
      }
    }

    throw new Error(`Failed to confirm server assignment for nodes: ${this.summarizeNodesWithoutServer(nodesWithoutServer)}.`);
  }

  private role(commandRole?: OpenCliRole | string | number | null): OpenCliRole {
    const normalized = String(commandRole || '').trim().toLowerCase();
    if (normalized === '2' || normalized === 'red') return 2;
    if (normalized === '3' || normalized === 'blue') return 3;
    return 1;
  }

  private optionValue(value: unknown): string {
    if (value && typeof value === 'object' && 'value' in (value as any)) {
      return String((value as any).value ?? '');
    }
    return String(value ?? '');
  }

  private isDistributedScene(topo: TopoData | null = this.state.topoData): boolean {
    const raw = topo as any;
    const candidates = [
      raw?.disturb,
      raw?.metadata?.disturb,
      raw?.options?.disturb,
      config.disturb,
    ].map((value) => this.optionValue(value).toLowerCase());

    return candidates.some((value) => value === '1' || value === 'true');
  }

  private backendNodeType(type: McpNodeType): { type: string; model: string; image: string } {
    if ((type === 'DEFAULT' || type === 'ROUTER') && this.isDistributedScene()) {
      return { type: 'DEFAULT', model: 'router', image: '' };
    }

    return toBackendNodeType(type);
  }

  private defaultConfigServices(type: McpNodeType): string[] | null {
    if (type === 'DRONE' || type === 'VAN') return this.isDistributedScene() ? ['OSPFv2', 'zebra'] : ['OSPFv2', 'zebra', 'olsrd'];
    if (type === 'BASESTATION' || type === 'SATELLITE') return ['OSPFv2', 'zebra', 'olsrd'];
    if ((type === 'DEFAULT' || type === 'ROUTER') && this.isDistributedScene()) return ['zebra', 'OSPFv2'];
    return null;
  }

  private configRequestKey(kind: string): string {
    return `${this.state.currentSessionId || this.state.topoData?.id || 'none'}:${kind}`;
  }

  private creationConfigKey(nodeType: McpNodeType): string {
    return this.configRequestKey(`creation:${nodeType}`);
  }

  private linkConfigKey(): string {
    return this.configRequestKey('creation:link.add');
  }

  private compositeConfigKey(): string {
    return this.configRequestKey('creation:composite');
  }

  private configKeyForCreationAction(action: Record<string, any>): string {
    if (String(action.actionId) === 'link.add') return this.linkConfigKey();
    const nodeType = String(action.nodeType || '').trim() as McpNodeType;
    return this.creationConfigKey(nodeType || 'DOCKER');
  }

  private actionRequiresCreationConfig(action: Record<string, any> | null | undefined): boolean {
    if (!action) return false;
    const actionId = String(action.actionId || '');
    if (actionId === 'link.add') return true;
    if (action.submitTool && String(action.submitTool).includes('opencli_add_node')) return true;
    return Boolean(action.nodeType && Array.isArray(action.fields));
  }

  private creationFormToolFor(action: Record<string, any> | null | undefined, nodeType?: McpNodeType): { name: string; args: Record<string, unknown> } {
    const actionId = String(action?.actionId || '');
    const type = String(action?.nodeType || nodeType || '').trim();
    if (actionId === 'link.add') return { name: 'opencli_read_link_creation_options', args: {} };
    if (actionId === 'subnet.add' || type === 'EMANE') return { name: 'opencli_read_subnet_creation_options', args: { configStage: 'subnet-model' } };
    return {
      name: 'opencli_read_node_creation_options',
      args: {
        ...(actionId ? { actionId } : {}),
        ...(type ? { nodeType: type } : {}),
      },
    };
  }

  private formRequiredResult(input: {
    label: string;
    submitTool: string;
    reason: string;
    formTool: string;
    formToolArgs?: Record<string, unknown>;
    missingFields?: string[];
    configRequestId?: string;
  }): OpenCliResult {
    const formArgsText = Object.keys(input.formToolArgs || {}).length > 0
      ? ` 参数：${JSON.stringify(input.formToolArgs)}`
      : '';
    return {
      ok: true,
      message: [
        `尚未执行写入：${input.label}。`,
        input.reason,
        `请先调用配置项读取工具 ${input.formTool}${formArgsText}，读取 structuredContent.configForm 并把可选项展示给用户。`,
        '用户填写后，再调用写工具，并在 userSelections 中携带该表单返回的 configRequestId 和结构化选择。',
      ].join('\n'),
      data: {
        requiresUserInput: true,
        requiresFormTool: true,
        submitTool: input.submitTool,
        formTool: input.formTool,
        formToolArgs: input.formToolArgs || {},
        missingFields: input.missingFields,
        configRequestId: input.configRequestId,
        nextStep: `Call ${input.formTool} first; full configuration form is returned in structuredContent.configForm.`,
      },
    };
  }

  private stringFromRecord(record: unknown, key: string): string | undefined {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
    const value = (record as Record<string, unknown>)[key];
    const text = String(value || '').trim();
    return text || undefined;
  }

  private nextConfigRequestId(key: string): string {
    return `${key}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private rememberConfigRequest(
    key: string,
    label: string,
    submitTool: string,
    options: Partial<PendingConfigRequest> = {}
  ): PendingConfigRequest {
    const existing = options.forceNew
      ? null
      : options.requestId
      ? this.findPendingConfigRequestById(options.requestId)
      : this.pendingConfigRequests.get(key);
    const source = options.source === 'form' || existing?.source === 'form'
      ? 'form'
      : options.source || existing?.source;
    const request: PendingConfigRequest = {
      ...(existing || {}),
      key,
      requestId: existing?.requestId || options.requestId || this.nextConfigRequestId(key),
      label,
      submitTool,
      createdAt: existing?.createdAt || Date.now(),
      kind: existing?.kind === 'composite' && options.kind === 'single' ? existing.kind : options.kind || existing?.kind,
      stage: options.stage || existing?.stage,
      entityIds: options.entityIds || existing?.entityIds,
      consumedEntityIds: options.consumedEntityIds || existing?.consumedEntityIds,
      partialSelections: options.partialSelections || existing?.partialSelections,
      source,
    };
    if (existing && existing.key !== key) {
      this.pendingConfigRequests.delete(existing.key);
    }
    this.pendingConfigRequests.set(key, request);
    return request;
  }

  private findPendingConfigRequestById(requestId?: unknown): PendingConfigRequest | null {
    const id = String(requestId || '').trim();
    if (!id) return null;
    for (const request of this.pendingConfigRequests.values()) {
      if (request.requestId === id) return request;
    }
    return null;
  }

  private hasAutoDefaultConfirmationSignal(selections: Record<string, unknown>): boolean {
    const visit = (value: unknown): boolean => {
      if (!value || typeof value !== 'object') return false;
      if (Array.isArray(value)) return value.some((item) => visit(item));
      return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
        AUTO_DEFAULT_CONFIRMATION_KEYS.has(key) || visit(item)
      );
    };
    return visit(selections);
  }

  private mergeEntitySelection(root: Record<string, unknown>, entity: Record<string, unknown>): Record<string, unknown> {
    const nested = this.objectRecord(entity.userSelections || entity.values || entity.config);
    return {
      configRequestId: root.configRequestId,
      ...entity,
      ...nested,
      clientId: entity.clientId || root.clientId,
    };
  }

  private roleFromSelection(value: unknown): unknown {
    if (typeof value === 'number') return value;
    const text = String(value || '').trim().toLowerCase();
    if (!text) return value;
    if (['1', '公共', 'public', 'white'].includes(text)) return 1;
    if (['2', '红方', 'red'].includes(text)) return 2;
    if (['3', '蓝方', 'blue'].includes(text)) return 3;
    return value;
  }

  private boolFromSelection(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const text = String(value || '').trim().toLowerCase();
    if (!text) return undefined;
    if (['true', '1', 'yes', 'on', '开', '开启', '启用'].includes(text)) return true;
    if (['false', '0', 'no', 'off', '关', '关闭', '禁用'].includes(text)) return false;
    return undefined;
  }

  private normalizeCreationSelections(nodeType: McpNodeType, selection: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...selection };

    if (!this.hasOwn(next, 'name') && this.hasOwn(next, 'alias')) {
      next.name = next.alias;
    }
    if (this.hasOwn(next, 'role')) {
      next.role = this.roleFromSelection(next.role);
    }

    const protocolKeys = ['enableZebra', 'enableOSPF', 'enableOLSR', 'enableBGP', 'enableRIP'];
    const hasProtocolToggles = protocolKeys.some((key) => this.hasOwn(next, key));
    if (!this.hasOwn(next, 'configServices') && hasProtocolToggles) {
      const services: string[] = [];
      if (this.boolFromSelection(next.enableZebra)) services.push('zebra');
      if (this.boolFromSelection(next.enableOSPF)) services.push('OSPFv2');
      if (this.boolFromSelection(next.enableOLSR)) services.push('olsrd');
      if (this.boolFromSelection(next.enableBGP)) services.push('BGP');
      if (this.boolFromSelection(next.enableRIP)) services.push('RIP');
      next.configServices = services;
    }

    if (nodeType === 'RJ45' && !this.hasOwn(next, 'rj45Interface') && this.hasOwn(next, 'name')) {
      next.rj45Interface = next.name;
    }
    if (nodeType === 'TMV' && !this.hasOwn(next, 'tmvDeviceType') && this.hasOwn(next, 'deviceType')) {
      next.tmvDeviceType = next.deviceType;
    }
    if (nodeType === 'BUSINESS_Transmitter' && !this.hasOwn(next, 'businessDeviceType') && this.hasOwn(next, 'deviceType')) {
      next.businessDeviceType = next.deviceType;
    }

    return next;
  }

  private effectiveCreationSelections(command: NodeCreateOptions & { nodeType: McpNodeType; name?: string }): Record<string, unknown> {
    const root = this.objectRecord(command.userSelections);
    if (Object.keys(root).length === 0) return root;
    const entities = [
      ...this.arrayRecords(root.entities),
      ...this.arrayRecords(root.nodes),
      ...this.arrayRecords(root.subnets),
    ];
    const commandClientId = String(command.clientId || '').trim();
    const commandName = String(command.name || '').trim();
    const matched = entities.find((entity) => {
      const entityClientId = String(entity.clientId || '').trim();
      const entityName = String(entity.name || entity.alias || '').trim();
      const entityType = String(entity.nodeType || entity.type || '').trim();
      return (
        (commandClientId && entityClientId === commandClientId) ||
        (commandName && entityName === commandName) ||
        (entityType && entityType === command.nodeType && entities.length === 1)
      );
    });
    return this.normalizeCreationSelections(command.nodeType, matched ? this.mergeEntitySelection(root, matched) : root);
  }

  private normalizeLinkSelections(selection: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...selection };
    const linkOptionKeys = ['jitter', 'key', 'mburst', 'mer', 'loss', 'bandwidth', 'burst', 'delay', 'dup', 'unidirectional', 'buffer', 'mtu'];
    const extracted: Record<string, unknown> = this.objectRecord(next.linkOptions);
    linkOptionKeys.forEach((key) => {
      if (this.hasOwn(next, key)) extracted[key] = next[key];
      const dotted = `linkOptions.${key}`;
      if (this.hasOwn(next, dotted)) extracted[key] = next[dotted];
    });
    if (Object.keys(extracted).length > 0) {
      next.linkOptions = extracted;
    }
    return next;
  }

  private effectiveLinkSelections(command: LinkCreateOptions & { from?: string; to?: string }): Record<string, unknown> {
    const root = this.objectRecord(command.userSelections);
    if (Object.keys(root).length === 0) return root;
    const links = [
      ...this.arrayRecords(root.links),
      ...this.arrayRecords(root.entities).filter((entity) => String(entity.kind || entity.type || '') === 'link'),
    ];
    const commandClientId = String(command.clientId || '').trim();
    const from = String(command.from || '').trim();
    const to = String(command.to || '').trim();
    const matched = links.find((link) => {
      const linkClientId = String(link.clientId || '').trim();
      const linkFrom = String(link.from || link.fromClientId || '').trim();
      const linkTo = String(link.to || link.toClientId || '').trim();
      return (
        (commandClientId && linkClientId === commandClientId) ||
        (from && to && ((linkFrom === from && linkTo === to) || (linkFrom === to && linkTo === from))) ||
        links.length === 1
      );
    });
    return this.normalizeLinkSelections(matched ? this.mergeEntitySelection(root, matched) : root);
  }

  private configReviewResult(input: {
    key: string;
    label: string;
    submitTool: string;
    schemaData: Record<string, unknown>;
    reason: string;
  }): OpenCliResult {
    const selectedAction = this.objectRecord((input.schemaData as any)?.selectedAction);
    const formTool = this.creationFormToolFor(selectedAction, String(selectedAction?.nodeType || '') as McpNodeType);
    const request = this.findPendingConfigRequestById((input as any).configRequestId) || this.pendingConfigRequests.get(input.key);
    const formRequestId = request?.source === 'form' ? request.requestId : undefined;
    return this.formRequiredResult({
      label: input.label,
      submitTool: input.submitTool,
      reason: [
        input.reason,
        '重复创建请求、继续使用默认配置、configConfirmed/useDefaultConfig 等字段都不能被 MCP 视为用户确认。',
      ].join(' '),
      formTool: formTool.name,
      formToolArgs: formTool.args,
      configRequestId: formRequestId,
    });
  }

  private configSelectionReviewGate(input: {
    key: string;
    label: string;
    submitTool: string;
    selections: Record<string, unknown>;
    schemaData: Record<string, unknown>;
    clientIds?: string[];
  }): OpenCliResult | null {
    if (this.hasAutoDefaultConfirmationSignal(input.selections)) {
      return this.configReviewResult({
        ...input,
        reason: '已收到 userSelections，但其中包含自动默认确认字段；MCP 不接受 agent 代替用户确认默认值。',
      });
    }

    const pending = input.selections.configRequestId
      ? this.findPendingConfigRequestById(input.selections.configRequestId)
      : this.pendingConfigRequests.get(input.key);
    if (!pending) {
      return this.configReviewResult({
        ...input,
        reason: '已收到 userSelections，但 MCP 没有检测到本场景中已先向用户返回过该类型的配置清单。',
      });
    }

    if (pending.source !== 'form') {
      return this.configReviewResult({
        ...input,
        reason: '已收到 userSelections，但这个 configRequestId 不是由配置项读取工具创建。请先调用对应的 opencli_read_*_creation_options 工具读取完整可选配置项。',
      });
    }

    const elapsed = Date.now() - pending.createdAt;
    if (elapsed > CONFIG_REQUEST_MAX_AGE_MS) {
      return this.configReviewResult({
        ...input,
        reason: '之前返回的配置清单已经过期，需要重新展示当前前端可选项。',
      });
    }

    if (input.selections.configRequestId !== pending.requestId) {
      return this.configReviewResult({
        ...input,
        reason: '已收到 userSelections，但缺少匹配的 configRequestId；MCP 需要确认这是针对上一轮配置清单的用户回复。',
      });
    }

    if (pending.kind === 'composite') {
      const clientIds = input.clientIds?.length
        ? input.clientIds.map((clientId) => String(clientId || '').trim()).filter(Boolean)
        : [String(input.selections.clientId || '').trim()].filter(Boolean);
      const uniqueClientIds = Array.from(new Set(clientIds));
      const entityIds = pending.entityIds || [];
      const invalidClientIds = uniqueClientIds.filter((clientId) => !entityIds.includes(clientId));
      if (uniqueClientIds.length === 0 || invalidClientIds.length > 0) {
        return this.configReviewResult({
          ...input,
          reason: `已收到复合配置 userSelections，但缺少有效 clientId；必须是这些实体之一：${entityIds.join(', ')}。`,
        });
      }
      const consumed = new Set(pending.consumedEntityIds || []);
      const repeatedClientIds = uniqueClientIds.filter((clientId) => consumed.has(clientId));
      if (repeatedClientIds.length > 0) {
        return this.configReviewResult({
          ...input,
          reason: `复合配置实体 ${repeatedClientIds.join(', ')} 已经使用过该 configRequestId，不能重复写入。`,
        });
      }
      uniqueClientIds.forEach((clientId) => consumed.add(clientId));
      pending.consumedEntityIds = Array.from(consumed);
      this.pendingConfigRequests.set(pending.key, pending);
      if (input.key !== pending.key) {
        this.pendingConfigRequests.delete(input.key);
      }
      if (entityIds.length > 0 && entityIds.every((entityId) => consumed.has(entityId))) {
        this.pendingConfigRequests.delete(pending.key);
      }
      return null;
    }

    this.pendingConfigRequests.delete(pending.key);
    return null;
  }

  private creationPlannedEntities(command: NodeCreateOptions & { nodeType: McpNodeType; kind?: string; name?: string; names?: string[]; count?: number }): Array<Record<string, unknown>> {
    if (command.kind === 'addNodesBatch' && Array.isArray(command.names)) {
      return command.names.map((name, index) => ({
        kind: 'node',
        clientId: String(name || '').trim() || `node${index + 1}`,
        nodeType: command.nodeType,
        name,
        source: 'opencli_add_nodes_batch.names',
      }));
    }

    if (command.kind === 'addNodesGrid') {
      const count = Math.max(1, Math.min(Number(command.count || 1), 30));
      return Array.from({ length: count }, (_, index) => ({
        kind: 'node',
        clientId: command.clientId ? `${command.clientId}-${index + 1}` : `node${index + 1}`,
        nodeType: command.nodeType,
        name: `<由用户填写第 ${index + 1} 个节点名称>`,
        source: 'opencli_add_nodes_grid.count',
      }));
    }

    return [{
      kind: 'node',
      clientId: command.clientId || command.name || String(command.nodeType || 'node').toLowerCase(),
      nodeType: command.nodeType,
      name: command.name || '<由用户填写>',
      source: 'opencli_add_node',
    }];
  }

  private creationCommandConfigForm(baseForm: Record<string, unknown>, command: NodeCreateOptions & { nodeType: McpNodeType; kind?: string; name?: string; names?: string[]; count?: number }, request: PendingConfigRequest): Record<string, unknown> {
    const plannedEntities = this.creationPlannedEntities(command).map((entity) => ({
      kind: entity.kind,
      clientId: entity.clientId,
      nodeType: entity.nodeType,
      source: entity.source,
    }));
    return {
      ...baseForm,
      configRequestId: request.requestId,
      formMode: 'collect-before-create',
      defaultPolicy: 'defaults_are_display_only_user_must_return_structured_values',
      plannedEntities,
      requiredUserSelections: {
        root: ['configRequestId'],
        perNode: this.creationRequiredFieldNames(command.nodeType, command.kind),
      },
      submissionSchema: {
        rootFields: ['configRequestId'],
        repeatedEntityField: command.kind === 'addNode' ? 'userSelections' : 'userSelections.nodes[]',
        perEntityFields: this.creationRequiredFieldNames(command.nodeType, command.kind),
        note: 'This is a schema only. Do not render it as filled values; collect actual choices from the user first.',
      },
    };
  }

  private async creationInputGate(command: NodeCreateOptions & { nodeType: McpNodeType }, submitTool: string): Promise<OpenCliResult | null> {
    if (command.skipConfigGate) return null;
    if (command.userSelections && Object.keys(command.userSelections).length > 0) return null;

    const catalog = cloneCreationConfigCatalog();
    const selectedAction = this.findCreationAction(catalog, { nodeType: command.nodeType });
    if (!selectedAction) return null;
    if (!this.actionRequiresCreationConfig(selectedAction)) return null;
    const formTool = this.creationFormToolFor(selectedAction, command.nodeType);
    const planned = command as any;
    const formToolArgs = {
      ...formTool.args,
      ...(planned.kind === 'addNodesBatch' ? { names: planned.names } : {}),
      ...(planned.kind === 'addNodesGrid' ? { count: planned.count, clientId: planned.clientId } : {}),
      ...(planned.kind === 'addNode' && planned.name ? { name: planned.name, clientId: planned.clientId } : {}),
    };
    return this.formRequiredResult({
      label: String(selectedAction.label || command.nodeType),
      submitTool,
      reason: '该写工具现在只负责写入和校验，不再返回完整配置表单。',
      formTool: formTool.name,
      formToolArgs,
    });
  }

  private creationSpecialFieldNames(nodeType: McpNodeType, selections: Record<string, unknown> = {}): string[] {
    switch (nodeType) {
      case 'EMANE': {
        const fields = ['emaneModel'];
        if (!this.hasOwn(selections, 'emaneModel') || !isFrontendWiredLinkLayer(String(selections.emaneModel))) {
          fields.push('phyType');
        }
        const hasModel = this.hasOwn(selections, 'emaneModel');
        const hasPhyChoice = isFrontendWiredLinkLayer(String(selections.emaneModel)) || this.hasOwn(selections, 'phyType');
        if (hasModel && hasPhyChoice) {
          fields.push('emaneConfig');
        }
        return fields;
      }
      case 'VMNODE':
        return ['templateId'];
      case 'RJ45':
        return ['rj45Interface'];
      case 'TMV':
        return ['tmvDeviceType'];
      case 'BUSINESS_Transmitter':
        return ['businessDeviceType'];
      case 'DRONE':
      case 'VAN':
      case 'BASESTATION':
      case 'SATELLITE':
        return ['configServices'];
      case 'ROUTER':
        return this.isDistributedScene() ? ['configServices'] : [];
      default:
        return [];
    }
  }

  private creationRequiredFieldNames(nodeType: McpNodeType, commandKind?: string, selections: Record<string, unknown> = {}): string[] {
    const base = commandKind === 'addNodesGrid'
      ? ['centerLat', 'centerLon', 'alt', 'role']
      : ['name', 'lat', 'lon', 'alt', 'role'];
    return [...base, ...this.creationSpecialFieldNames(nodeType, selections)];
  }

  private missingCreationFields(command: NodeCreateOptions & { nodeType: McpNodeType; kind?: string }, selections: Record<string, unknown>): string[] {
    return this.creationRequiredFieldNames(command.nodeType, command.kind, selections)
      .filter((key) => !this.hasOwn(selections, key));
  }

  private batchCreationSelections(command: AddNodesBatchCommand): Record<string, unknown>[] {
    return command.names.map((name) => this.effectiveCreationSelections({ ...command, name }));
  }

  private async creationValidationGate(command: NodeCreateOptions & { nodeType: McpNodeType }, submitTool: string): Promise<OpenCliResult | null> {
    if (command.skipConfigGate) return null;
    const commandKind = (command as { kind?: string }).kind;
    const isNamedBatch = commandKind === 'addNodesBatch';
    const isGridBatch = commandKind === 'addNodesGrid';
    const selections = this.effectiveCreationSelections(command);
    const batchSelections = isNamedBatch ? this.batchCreationSelections(command as AddNodesBatchCommand) : [];
    const missing = isNamedBatch
      ? batchSelections.flatMap((selection, index) => {
        const label = String(selection.clientId || (command as AddNodesBatchCommand).names[index] || `node${index + 1}`);
        return this.missingCreationFields(command as any, selection).map((field) => `${label}.${field}`);
      })
      : this.missingCreationFields(command as any, selections);

    const schemaInput = command.nodeType === 'EMANE' && this.hasOwn(selections, 'emaneModel')
      ? {
        nodeType: command.nodeType,
        configStage: 'subnet-parameters',
        partialSelections: selections,
      }
      : { nodeType: command.nodeType };
    const schema = await this.creationConfigSchema(schemaInput);
    const selectedAction = (schema.data as any)?.selectedAction;
    if (!this.actionRequiresCreationConfig(selectedAction)) return null;
    const key = this.creationConfigKey(command.nodeType);
    const label = selectedAction?.label || '节点';

    if (missing.length === 0) {
      const rootSelections = isNamedBatch || isGridBatch ? this.objectRecord(command.userSelections) : selections;
      const clientIds = isNamedBatch
        ? batchSelections.map((selection) => String(selection.clientId || '').trim()).filter(Boolean)
        : isGridBatch
          ? this.creationPlannedEntities(command as any).map((entity) => String(entity.clientId || '').trim()).filter(Boolean)
        : undefined;
      return this.configSelectionReviewGate({
        key,
        label,
        submitTool,
        selections: rootSelections,
        schemaData: schema.data as Record<string, unknown>,
        clientIds,
      });
    }

    const request = this.rememberConfigRequest(key, label, submitTool);
    const formTool = this.creationFormToolFor(selectedAction, command.nodeType);
    const formToolArgs = command.nodeType === 'EMANE' && this.hasOwn(selections, 'emaneModel')
      ? { configStage: 'subnet-parameters', partialSelections: selections }
      : formTool.args;
    return this.formRequiredResult({
      label,
      submitTool,
      reason: `已收到 userSelections，但缺少用户选择后的配置字段：${missing.join(', ')}。`,
      formTool: formTool.name,
      formToolArgs,
      missingFields: missing,
      configRequestId: request.source === 'form' ? request.requestId : undefined,
    });
  }

  private applyUserSelections<T extends NodeCreateOptions & { nodeType: McpNodeType }>(command: T): T {
    const selections = this.effectiveCreationSelections(command);
    const next: any = { ...command };
    [
      'name',
      'lat',
      'lon',
      'centerLat',
      'centerLon',
      'alt',
      'role',
      'count',
      'server',
      'configServices',
      'templateId',
      'rj45Interface',
      'tmvDeviceType',
      'businessDeviceType',
      'emaneModel',
      'phyType',
      'emaneConfig',
    ].forEach((key) => {
      if (this.hasOwn(selections, key)) {
        next[key] = selections[key];
      }
    });

    return next as T;
  }

  private async linkInputGate(command: LinkCreateOptions, submitTool: string): Promise<OpenCliResult | null> {
    if (command.skipConfigGate) return null;
    if (command.userSelections && Object.keys(command.userSelections).length > 0) return null;

    return this.formRequiredResult({
      label: '添加链路',
      submitTool,
      reason: '链路写工具现在只负责写入和校验，不再返回完整链路配置表单。',
      formTool: 'opencli_read_link_creation_options',
      formToolArgs: {
        ...((command as any).pairs ? { pairs: (command as any).pairs } : {}),
        ...((command as any).from ? { from: (command as any).from } : {}),
        ...((command as any).to ? { to: (command as any).to } : {}),
        ...(command.clientId ? { clientId: command.clientId } : {}),
      },
    });
  }

  private batchLinkSelections(command: AddLinksBatchCommand): Record<string, unknown>[] {
    return command.pairs.map((pair) => this.effectiveLinkSelections({
      ...command,
      clientId: pair.clientId || command.clientId,
      from: pair.from,
      to: pair.to,
    }));
  }

  private async linkValidationGate(command: LinkCreateOptions, submitTool: string): Promise<OpenCliResult | null> {
    if (command.skipConfigGate) return null;
    const isBatch = (command as { kind?: string }).kind === 'addLinksBatch';
    const selections = this.effectiveLinkSelections(command);
    const batchSelections = isBatch ? this.batchLinkSelections(command as AddLinksBatchCommand) : [];
    const missing = isBatch
      ? (batchSelections.every((selection) => this.hasOwn(selection, 'linkOptions')) ? [] : ['linkOptions'])
      : (this.hasOwn(selections, 'linkOptions') ? [] : ['linkOptions']);

    const schema = await this.creationConfigSchema({ actionId: 'link.add' });
    const key = this.linkConfigKey();
    const selectedAction = (schema.data as any)?.selectedAction;
    if (missing.length === 0) {
      const rootSelections = isBatch ? this.objectRecord(command.userSelections) : selections;
      const clientIds = isBatch
        ? batchSelections.map((selection, index) => String(
          selection.clientId ||
          (command as AddLinksBatchCommand).pairs[index]?.clientId ||
          ''
        ).trim()).filter(Boolean)
        : undefined;
      return this.configSelectionReviewGate({
        key,
        label: selectedAction?.label || '添加链路',
        submitTool,
        selections: rootSelections,
        schemaData: schema.data as Record<string, unknown>,
        clientIds,
      });
    }

    const request = this.rememberConfigRequest(key, selectedAction?.label || '添加链路', submitTool);
    return this.formRequiredResult({
      label: selectedAction?.label || '添加链路',
      submitTool,
      reason: `已收到 userSelections，但缺少用户选择后的链路配置字段：${missing.join(', ')}。`,
      formTool: 'opencli_read_link_creation_options',
      formToolArgs: {
        ...((command as any).pairs ? { pairs: (command as any).pairs } : {}),
        ...((command as any).from ? { from: (command as any).from } : {}),
        ...((command as any).to ? { to: (command as any).to } : {}),
        ...(command.clientId ? { clientId: command.clientId } : {}),
      },
      missingFields: missing,
      configRequestId: request.source === 'form' ? request.requestId : undefined,
    });
  }

  private applyLinkUserSelections<T extends LinkCreateOptions>(command: T): T {
    const selections = this.effectiveLinkSelections(command);
    const next: any = { ...command };
    ['linkOptions', 'fromIp', 'toIp'].forEach((key) => {
      if (this.hasOwn(selections, key)) {
        next[key] = selections[key];
      }
    });
    return next as T;
  }

  private defaultGeoByIndex(index: number): { lat: number; lon: number; alt: number } {
    if (index <= 0) return { ...DEFAULT_CENTER };

    const directions = [
      { lat: 0, lon: 1 },
      { lat: 1, lon: 0 },
      { lat: 0, lon: -1 },
      { lat: -1, lon: 0 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: -1 },
      { lat: -1, lon: -1 },
      { lat: -1, lon: 1 },
    ];
    const directionIndex = (index - 1) % directions.length;
    const ring = Math.floor((index - 1) / directions.length) + 1;
    const direction = directions[directionIndex];

    return {
      lat: DEFAULT_CENTER.lat + direction.lat * DEFAULT_POSITION_STEP * ring,
      lon: DEFAULT_CENTER.lon + direction.lon * DEFAULT_POSITION_STEP * ring,
      alt: DEFAULT_CENTER.alt,
    };
  }

  private hasDefaultPositionConflict(nodes: Node[], candidate: { lat: number; lon: number }): boolean {
    return nodes.some((node) => {
      const lat = Number(node.geo?.lat);
      const lon = Number(node.geo?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

      return (
        Math.abs(lat - candidate.lat) <= DEFAULT_POSITION_TOLERANCE &&
        Math.abs(lon - candidate.lon) <= DEFAULT_POSITION_TOLERANCE
      );
    });
  }

  private nextDefaultGeo(nodes: Node[]): { lat: number; lon: number; alt: number } {
    for (let index = 0; index < 200; index += 1) {
      const candidate = this.defaultGeoByIndex(index);
      if (!this.hasDefaultPositionConflict(nodes, candidate)) {
        return candidate;
      }
    }

    return this.defaultGeoByIndex(nodes.length);
  }

  private async makeNodeData(params: {
    nodeType: McpNodeType;
    name?: string;
    lat?: number;
    lon?: number;
    alt?: number;
    role?: OpenCliRole;
    emaneModel?: string;
    phyType?: string;
    emaneConfig?: Record<string, string | number | boolean | null | undefined>;
    server?: string;
    configServices?: string[];
    templateId?: number;
    rj45Interface?: string;
    tmvDeviceType?: 'transmitter' | 'receiver';
    businessDeviceType?: 'container' | 'transferTarget';
  }): Promise<any> {
    const topo = await this.requireLoadedTopo();
    const nodes = topo.nodes || [];
    const id = this.nextNodeId(nodes);
    if (params.nodeType === 'RJ45' && params.rj45Interface && this.isNodeNameUsed(nodes, params.rj45Interface)) {
      throw new Error(`物理网口 ${params.rj45Interface} 已被使用，请先调用 opencli_read_node_creation_options({ nodeType: "RJ45" }) 查看可用网口。`);
    }
    const requestedName = params.nodeType === 'RJ45' && params.rj45Interface
      ? params.rj45Interface
      : params.name;
    const name = this.nextNodeName(params.nodeType, nodes, requestedName);
    const alias = params.nodeType === 'EMANE'
      ? this.nextSubnetAlias(nodes, params.name)
      : (params.nodeType === 'INTERFERENCE' || params.nodeType === 'INODE')
        ? this.nextInterferenceAlias(nodes, params.name)
      : params.name?.trim() || name;
    const backend = this.backendNodeType(params.nodeType);
    const defaultGeo = this.nextDefaultGeo(nodes);
    const configServices = Array.isArray(params.configServices)
      ? params.configServices
      : this.defaultConfigServices(params.nodeType);

    const nodeData: any = {
      id,
      name,
      type: backend.type,
      model: backend.model,
      image: backend.image,
      geo: {
        lon: params.lon ?? defaultGeo.lon,
        lat: params.lat ?? defaultGeo.lat,
        alt: Number(params.alt ?? DEFAULT_CENTER.alt),
      },
      role: this.role(params.role),
      status: 'UP',
      alias,
    };

    if (configServices) {
      nodeData.config_services = configServices;
    }

    if (typeof params.server === 'string' && params.server.trim()) {
      nodeData.server = params.server.trim();
    }

    if (params.nodeType === 'EMANE') {
      const requestedEmaneModel = params.emaneModel;
      const emaneModel = normalizeEmaneModel(requestedEmaneModel);
      const phyType = normalizeFrontendPhyType(params.phyType, requestedEmaneModel, emaneModel);
      nodeData.emane = `emane_${emaneModel}`;
      nodeData.position = { x: 0, y: 0, z: 0 };
      nodeData.icon = '';
      nodeData.server = nodeData.server ?? '';
      nodeData.config_services = [];
      nodeData.dir = '';
      nodeData.channel = '';
      nodeData.canvas = 0;
      nodeData.wlan_config = {};
      nodeData.mobility_config = {};
      nodeData.service_configs = {};
      nodeData.emane_configs = createDefaultEmaneConfig(emaneModel, params.emaneConfig || {});
      nodeData.phy_type = phyType;
      nodeData.displayModel = frontendDisplayModel(requestedEmaneModel, emaneModel);
      nodeData.isWired = isFrontendWiredLinkLayer(requestedEmaneModel);
    }

    if (params.nodeType === 'TMV') {
      nodeData.tmvConfig = {
        deviceType: params.tmvDeviceType || 'transmitter',
      };
    }

    if (params.nodeType === 'BUSINESS_Transmitter') {
      nodeData.businessTransmitterConfig = {
        deviceType: params.businessDeviceType || 'container',
      };
    }

    if (params.nodeType === 'VMNODE' && params.templateId) {
      const template = await this.findVmTemplate(params.templateId);
      nodeData.templateId = params.templateId;
      if (template) {
        nodeData.templateName = template.name;
        nodeData.vcpu = template.vcpu;
        nodeData.memory = template.memory;
        nodeData.curMemory = template.curMemory;
        nodeData.disk = template.disk;
        nodeData.location = template.location;
        if (template.location) {
          nodeData.image = template.location;
        }
      }
    }

    return nodeData;
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
      unidirectional: false,
      buffer: 0,
      mtu: 0,
    };
  }

  private getNodeInterfaces(links: Link[], nodeId: number): NodeIface[] {
    const interfaces: NodeIface[] = [];
    links.forEach((link) => {
      if (link.iface1 && (link.iface1.node_id === nodeId || link.node1_id === nodeId)) interfaces.push(link.iface1);
      if (link.iface2 && (link.iface2.node_id === nodeId || link.node2_id === nodeId)) interfaces.push(link.iface2);
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

  private createEmanePeerIface(nodeId: number, links: Link[], ip4: string): NodeIface {
    const iface = this.createIface(nodeId, links);
    return {
      ...iface,
      ip4,
      ip6: '',
      ip6_mask: 64,
      net2_id: 0,
    };
  }

  private determineLinkType(node1: Node, node2: Node, preferred?: 'WIRED' | 'WIRELESS'): 'WIRED' | 'WIRELESS' {
    if (node1.type === 'EMANE' || node2.type === 'EMANE') return 'WIRED';
    return preferred || 'WIRED';
  }

  private normalizeLinkOptions(overrides?: Partial<LinkOptions>): LinkOptions {
    const options = { ...this.defaultOptions(), ...(overrides || {}) };
    return {
      jitter: Number(options.jitter) || 0,
      key: Number(options.key) || 0,
      mburst: Number(options.mburst) || 0,
      mer: Number(options.mer) || 0,
      loss: Number(options.loss) || 0,
      bandwidth: Number(options.bandwidth) || 0,
      burst: Number(options.burst) || 0,
      delay: Number(options.delay) || 0,
      dup: Number(options.dup) || 0,
      unidirectional: Boolean(options.unidirectional),
      buffer: Number(options.buffer) || 0,
      mtu: Number(options.mtu) || 0,
    };
  }

  private isBaseStationOtherNode(baseStation: Node, otherNode: Node): boolean {
    return baseStation.type === 'BASESTATION' && otherNode.type !== 'DRONE' && otherNode.type !== 'EMANE';
  }

  private baseStationOtherNodesConnectionCount(baseStationNodeId: number): number {
    const topo = this.state.topoData;
    const links = Array.isArray(topo?.links) ? topo!.links : [];
    const nodes = Array.isArray(topo?.nodes) ? topo!.nodes : [];

    return links.filter((link) => {
      if (link.node1_id !== baseStationNodeId && link.node2_id !== baseStationNodeId) return false;
      const otherNodeId = link.node1_id === baseStationNodeId ? link.node2_id : link.node1_id;
      const otherNode = nodes.find((node) => node.id === otherNodeId);
      return Boolean(otherNode && otherNode.type !== 'EMANE' && otherNode.type !== 'DRONE');
    }).length;
  }

  private clearIfaceNetworkFields(iface?: NodeIface): void {
    if (!iface) return;
    iface.ip4 = '';
    iface.ip4_mask = 0;
    iface.ip6 = '';
    iface.ip6_mask = 0;
    iface.mac = '';
  }

  private isNoIpInterfaceNode(node: Node): boolean {
    const name = String(node.name || '');
    const alias = String(node.alias || '');
    return (
      node.type === 'SWITCH' ||
      node.type === 'VMNODE' ||
      node.type === 'Ovs_SWITCH' ||
      name.includes('Ovs_SWITCH') ||
      alias.includes('Ovs_Switch') ||
      name.includes('SR_SWITCH')
    );
  }

  private assignFrontendDefaultIps(node1: Node, node2: Node, linkData: Partial<Link>, options?: LinkCreateOptions): void {
    if (linkData.iface1 && options?.fromIp) linkData.iface1.ip4 = options.fromIp;
    if (linkData.iface2 && options?.toIp) linkData.iface2.ip4 = options.toIp;

    if (!options?.fromIp && !options?.toIp) {
      if (this.isBaseStationOtherNode(node1, node2) || this.isBaseStationOtherNode(node2, node1)) {
        const baseStation = node1.type === 'BASESTATION' ? node1 : node2;
        const connectionId = this.baseStationOtherNodesConnectionCount(baseStation.id) + 1;
        const baseIp = `10.0.${connectionId}`;

        if (node1.type === 'BASESTATION') {
          if (linkData.iface1) linkData.iface1.ip4 = `${baseIp}.1`;
          if (linkData.iface2) linkData.iface2.ip4 = `${baseIp}.2`;
        } else {
          if (linkData.iface1) linkData.iface1.ip4 = `${baseIp}.2`;
          if (linkData.iface2) linkData.iface2.ip4 = `${baseIp}.1`;
        }
      } else {
        if (linkData.iface1) linkData.iface1.ip4 = '10.0.0.1';
        if (linkData.iface2) linkData.iface2.ip4 = '10.0.0.2';
      }
    }

    if (this.isNoIpInterfaceNode(node1)) this.clearIfaceNetworkFields(linkData.iface1);
    if (this.isNoIpInterfaceNode(node2)) this.clearIfaceNetworkFields(linkData.iface2);
  }

  private makeLinkData(node1: Node, node2: Node, preferredType?: 'WIRED' | 'WIRELESS', options?: LinkCreateOptions): Partial<Link> {
    const links = this.state.topoData?.links || [];
    const type = this.determineLinkType(node1, node2, preferredType);
    const emaneNode = node1.type === 'EMANE' ? node1 : node2.type === 'EMANE' ? node2 : null;
    const nonEmaneNode = emaneNode ? (node1.type === 'EMANE' ? node2 : node1) : null;
    const linkOptions = this.normalizeLinkOptions(options?.linkOptions);

    if (emaneNode && nonEmaneNode) {
      const emaneIndex = (this.state.topoData?.nodes || [])
        .filter((node) => node.type === 'EMANE')
        .findIndex((node) => node.id === emaneNode.id);
      const baseIp = `${(Math.max(emaneIndex, 0) + 1) * 10}.0.0`;
      const count = links.filter((link) => link.node1_id === emaneNode.id || link.node2_id === emaneNode.id).length;
      const nonEmaneIp = node1.type === 'EMANE' ? options?.toIp : options?.fromIp;
      const iface2 = this.createEmanePeerIface(nonEmaneNode.id, links, nonEmaneIp || `${baseIp}.${count + 1}`);
      if (this.isNoIpInterfaceNode(nonEmaneNode)) this.clearIfaceNetworkFields(iface2);

      return {
        node1_id: emaneNode.id,
        node2_id: nonEmaneNode.id,
        type,
        iface2,
        options: linkOptions,
        network_id: 0,
      };
    }

    const linkData: Partial<Link> = {
      node1_id: node1.id,
      node2_id: node2.id,
      type,
      options: linkOptions,
      network_id: 0,
    };

    if (node1.type !== 'EMANE') linkData.iface1 = this.createIface(node1.id, links);
    if (node2.type !== 'EMANE') linkData.iface2 = this.createIface(node2.id, links);
    this.assignFrontendDefaultIps(node1, node2, linkData, options);

    return linkData;
  }

  private async updateTopoFromResponse(responseData: any, fallbackSessionId?: number): Promise<TopoData> {
    const topo = normalizeTopoResponse(responseData);
    if (topo) {
      return this.rememberTopo(topo, fallbackSessionId);
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
    return this.verifiedResult([
      `已新建并加载场景：${sceneNameValue}，ID=${newSessionId}，节点数=${topo.nodes.length}`,
      '如果本轮用户请求还包含添加节点、子网或链路，下一步必须调用配置项读取工具获取前端可选配置项。',
      '节点用 opencli_read_node_creation_options，子网用 opencli_read_subnet_creation_options，链路用 opencli_read_link_creation_options，复合拓扑用 opencli_read_composite_creation_options；不要让写工具承担展示表单。',
    ].join('\n'), topo, {
      topo,
      nextStepForCompositeRequests: {
        rule: 'When the original user request includes topology creation after scene creation, immediately call the creation option read tool. Write tools only validate and write.',
        examples: [
          'opencli_read_composite_creation_options(composite={ nodes:[...], links:[...] })',
          'opencli_read_node_creation_options(nodeType=DRONE, names=[...])',
          'opencli_read_subnet_creation_options()',
          'opencli_read_link_creation_options(pairs=[...])',
        ],
        forbidden: 'Do not ask the user to reply "使用默认配置继续", and do not call write tools until the user returns structured userSelections with a configRequestId from the creation option read tool.',
      },
    });
  }

  private async closeScene(command: Extract<OpenCliCommand, { kind: 'closeScene' }>): Promise<OpenCliResult> {
    const sessionId = await this.resolveSceneId({ sessionId: command.sessionId, name: command.name });
    await this.backend.closeScene(sessionId);

    if (this.state.currentSessionId === sessionId && this.state.topoData) {
      this.state.topoData = { ...this.state.topoData, state: 'SHUTDOWN' };
      return this.verifiedResult(`已请求关闭场景：ID=${sessionId}`, this.state.topoData);
    }

    return { ok: true, message: `已请求关闭场景：ID=${sessionId}` };
  }

  private async addNode(command: AddNodeCommand): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const inputGate = await this.creationInputGate(command, 'opencli_add_node');
    if (inputGate) return inputGate;
    const validationGate = await this.creationValidationGate(command, 'opencli_add_node');
    if (validationGate) return validationGate;

    const userId = requireUserId();
    const preparedCommand = this.applyUserSelections(command);
    const nodeData = await this.makeNodeData(preparedCommand);
    const response = preparedCommand.nodeType === 'VMNODE' && preparedCommand.templateId
      ? await this.backend.addVMNode({ templateId: preparedCommand.templateId, node: nodeData }, topo.id, userId)
      : await this.backend.addNode(nodeData, topo.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    const created = refreshed.nodes.find((node) => node.name === nodeData.name || node.alias === nodeData.alias);
    await this.notifyFrontendTopoSync(refreshed.id, 'node-added');
    return this.verifiedResult(`已创建节点：${created?.alias || created?.name || nodeData.alias}，ID=${created?.id ?? nodeData.id}`, refreshed, {
      node: created || nodeData,
    });
  }

  private async addNodesGrid(command: AddNodesGridCommand): Promise<OpenCliResult> {
    const inputGate = await this.creationInputGate(command, 'opencli_add_nodes_grid');
    if (inputGate) return inputGate;
    const validationGate = await this.creationValidationGate(command, 'opencli_add_nodes_grid');
    if (validationGate) return validationGate;

    const preparedCommand = this.applyUserSelections(command);
    const count = Math.max(1, Math.min(preparedCommand.count, 30));
    const plannedEntities = this.creationPlannedEntities({ ...preparedCommand, count, kind: 'addNodesGrid' });
    const centerLat = preparedCommand.centerLat ?? DEFAULT_CENTER.lat;
    const centerLon = preparedCommand.centerLon ?? DEFAULT_CENTER.lon;
    const alt = preparedCommand.alt ?? DEFAULT_CENTER.alt;
    const cols = Math.ceil(Math.sqrt(count));
    const step = 0.006;
    const names: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const result = await this.addNode({
        kind: 'addNode',
        nodeType: command.nodeType,
        clientId: String(plannedEntities[index]?.clientId || ''),
        lat: centerLat + (row - Math.floor(cols / 2)) * step,
        lon: centerLon + (col - Math.floor(cols / 2)) * step,
        alt,
        role: preparedCommand.role,
        emaneModel: preparedCommand.emaneModel,
        phyType: preparedCommand.phyType,
        emaneConfig: preparedCommand.emaneConfig,
        server: preparedCommand.server,
        configServices: preparedCommand.configServices,
        userSelections: preparedCommand.userSelections,
        skipConfigGate: true,
      });
      names.push(result.message);
    }

    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已生成 ${count} 个节点：\n${names.join('\n')}`, refreshed, {
      results: names,
    });
  }

  private async addNodesBatch(command: AddNodesBatchCommand): Promise<OpenCliResult> {
    const inputGate = await this.creationInputGate(command, 'opencli_add_nodes_batch');
    if (inputGate) return inputGate;
    const validationGate = await this.creationValidationGate(command, 'opencli_add_nodes_batch');
    if (validationGate) return validationGate;

    const centerLat = command.centerLat ?? DEFAULT_CENTER.lat;
    const centerLon = command.centerLon ?? DEFAULT_CENTER.lon;
    const alt = command.alt ?? DEFAULT_CENTER.alt;
    const step = 0.004;
    const plannedEntities = this.creationPlannedEntities(command);
    const created: string[] = [];

    for (let index = 0; index < command.names.length; index += 1) {
      const result = await this.addNode({
        kind: 'addNode',
        nodeType: command.nodeType,
        clientId: String(plannedEntities[index]?.clientId || command.names[index] || ''),
        name: command.names[index],
        lat: centerLat + index * step,
        lon: centerLon + index * step,
        alt,
        role: command.role,
        emaneModel: command.emaneModel,
        phyType: command.phyType,
        emaneConfig: command.emaneConfig,
        server: command.server,
        configServices: command.configServices,
        userSelections: command.userSelections,
        skipConfigGate: true,
      });
      created.push(result.message);
    }

    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已批量添加 ${created.length} 个节点：\n${created.join('\n')}`, refreshed, {
      results: created,
    });
  }

  private findLinkBetween(from: Node, to: Node): Link | undefined {
    const links = Array.isArray(this.state.topoData?.links) ? this.state.topoData.links : [];
    return links.find((link) =>
      (link.node1_id === from.id && link.node2_id === to.id) ||
      (link.node1_id === to.id && link.node2_id === from.id)
    );
  }

  private async connectNodes(command: ConnectNodesCommand): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const inputGate = await this.linkInputGate(command, 'opencli_connect_nodes');
    if (inputGate) return inputGate;
    const validationGate = await this.linkValidationGate(command, 'opencli_connect_nodes');
    if (validationGate) return validationGate;
    const preparedCommand = this.applyLinkUserSelections(command);

    const userId = requireUserId();
    const from = this.findNode(preparedCommand.from);
    const to = this.findNode(preparedCommand.to);
    if (!from || !to) throw new Error(`找不到节点：${!from ? preparedCommand.from : preparedCommand.to}`);
    if (from.id === to.id) throw new Error('不能连接同一个节点。');
    if (this.findLinkBetween(from, to)) throw new Error(`链路已存在：${from.alias || from.name} - ${to.alias || to.name}`);

    const linkData = this.makeLinkData(from, to, preparedCommand.linkType, preparedCommand);
    const response = await this.backend.addLink(linkData, topo.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    const created = this.findLinkBetween(from, to);
    await this.notifyFrontendTopoSync(refreshed.id, 'link-added');
    return this.verifiedResult(`已添加链路：${from.alias || from.name} - ${to.alias || to.name}`, refreshed, {
      link: created || linkData,
    });
  }

  private async addLinksBatch(command: AddLinksBatchCommand): Promise<OpenCliResult> {
    const inputGate = await this.linkInputGate(command, 'opencli_add_links_batch');
    if (inputGate) return inputGate;
    const validationGate = await this.linkValidationGate(command, 'opencli_add_links_batch');
    if (validationGate) return validationGate;

    const results: string[] = [];
    for (const pair of command.pairs) {
      const result = await this.connectNodes({
        kind: 'connectNodes',
        clientId: pair.clientId || command.clientId,
        from: pair.from,
        to: pair.to,
        linkType: command.linkType,
        linkOptions: command.linkOptions,
        userSelections: command.userSelections,
        skipConfigGate: true,
      });
      results.push(result.message);
    }
    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已批量添加 ${results.length} 条链路：\n${results.join('\n')}`, refreshed, {
      results,
    });
  }

  private async deleteNode(target: string): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(target);
    if (!node) throw new Error(`找不到节点：${target}`);

    const response = await this.backend.deleteNode(topo.id, node.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    return this.verifiedResult(`已删除节点：${node.alias || node.name}`, refreshed, {
      deletedNode: {
        id: node.id,
        name: node.name,
        alias: node.alias,
      },
    });
  }

  private async deleteNodesBatch(targets: string[]): Promise<OpenCliResult> {
    const results: string[] = [];
    for (const target of targets) {
      const result = await this.deleteNode(target);
      results.push(result.message);
    }
    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已批量删除 ${results.length} 个节点：\n${results.join('\n')}`, refreshed, {
      results,
    });
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
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    return this.verifiedResult(`已删除链路：${from.alias || from.name} - ${to.alias || to.name}`, refreshed, {
      deletedLink: link,
    });
  }

  private async deleteLinksBatch(pairs: Array<{ from: string; to: string }>): Promise<OpenCliResult> {
    const results: string[] = [];
    for (const pair of pairs) {
      const result = await this.deleteLink(pair.from, pair.to);
      results.push(result.message);
    }
    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已批量删除 ${results.length} 条链路：\n${results.join('\n')}`, refreshed, {
      results,
    });
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
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    return this.verifiedResult(`已移动节点：${node.alias || node.name}`, refreshed, {
      node: updatedNode,
    });
  }

  private async setNodeStatus(target: string, status: 'UP' | 'DOWN'): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const node = this.findNode(target);
    if (!node) throw new Error(`找不到节点：${target}`);

    const response = await this.backend.editNode({ ...node, status }, topo.id, userId);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    return this.verifiedResult(`已设置节点 ${node.alias || node.name} 状态为 ${status}`, refreshed, {
      node: { ...node, status },
    });
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
    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`已清空场景拓扑：删除 ${ids.length} 个节点。`, refreshed, {
      deletedNodeIds: ids,
    });
  }

  private async sampleScene(): Promise<OpenCliResult> {
    const centerLat = DEFAULT_CENTER.lat;
    const centerLon = DEFAULT_CENTER.lon;
    const addCommands: AddNodeCommand[] = [
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE1', lat: centerLat, lon: centerLon, alt: 300, userSelections: { configServices: ['OSPFv2', 'zebra', 'olsrd'] }, skipConfigGate: true },
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE2', lat: centerLat + 0.004, lon: centerLon + 0.004, alt: 350, userSelections: { configServices: ['OSPFv2', 'zebra', 'olsrd'] }, skipConfigGate: true },
      { kind: 'addNode', nodeType: 'DRONE', name: 'DRONE3', lat: centerLat - 0.004, lon: centerLon + 0.004, alt: 320, userSelections: { configServices: ['OSPFv2', 'zebra', 'olsrd'] }, skipConfigGate: true },
      { kind: 'addNode', nodeType: 'EMANE', name: 'EMANE1', lat: centerLat + 0.002, lon: centerLon + 0.002, alt: 100, userSelections: { emaneModel: 'rfpipe', phyType: 'fhss', emaneConfig: {} }, skipConfigGate: true },
    ];

    for (const command of addCommands) {
      await this.addNode(command);
    }

    const sampleLinkSelections = { linkOptions: this.defaultOptions() };
    const linkMessages = [
      await this.connectNodes({ kind: 'connectNodes', from: 'DRONE1', to: 'EMANE1', linkType: 'WIRED', userSelections: sampleLinkSelections, skipConfigGate: true }),
      await this.connectNodes({ kind: 'connectNodes', from: 'DRONE2', to: 'EMANE1', linkType: 'WIRED', userSelections: sampleLinkSelections, skipConfigGate: true }),
      await this.connectNodes({ kind: 'connectNodes', from: 'DRONE3', to: 'EMANE1', linkType: 'WIRED', userSelections: sampleLinkSelections, skipConfigGate: true }),
    ];

    const refreshed = await this.requireLoadedTopo();
    return this.verifiedResult(`演示场景已创建。\n${linkMessages.map((item) => item.message).join('\n')}`, refreshed, {
      linkResults: linkMessages.map((item) => item.data || item.message),
    });
  }

  private async simulationCheck(): Promise<OpenCliResult> {
    const loadedTopo = await this.requireLoadedTopo();
    const topo = await this.refreshTopo(loadedTopo.id);
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    const nodes = topo.nodes || [];
    const nodesWithoutServer = nodes.filter((node: any) => !String(node.server || '').trim());
    const emaneCount = nodes.filter((node) => node.type === 'EMANE').length;
    const blockers = [
      nodes.length === 0 ? 'No nodes are visible to backend /topo.' : '',
      this.isRuntimeState(topo.state) ? `Scene is already in runtime state: ${topo.state}.` : '',
    ].filter(Boolean);
    const warnings = [
      servers.length === 0 ? 'No backend servers are listed in topology; MCP will call /start with an empty server list, matching the frontend behavior.' : '',
    ].filter(Boolean);

    return {
      ok: blockers.length === 0,
      message: [
        `仿真启动检查：sessionId=${topo.id}`,
        `状态=${topo.state || 'UNKNOWN'}，节点=${nodes.length}，链路=${topo.links.length}，EMANE=${emaneCount}，服务器=${servers.length}`,
        nodesWithoutServer.length > 0 ? `有 ${nodesWithoutServer.length} 个节点未分配服务器。` : '节点服务器分配看起来正常。',
        warnings.length > 0 ? `Warnings: ${warnings.join(' | ')}` : '',
        blockers.length > 0 ? `Blockers: ${blockers.join(' | ')}` : 'Backend /topo is ready for simulation start.',
      ].filter(Boolean).join('\n'),
      data: { servers, nodesWithoutServer, blockers, warnings },
    };
  }

  private dockerContainers(topo: TopoData): string[] {
    return (topo.nodes || [])
      .filter((node) => node.type === 'DOCKER')
      .map((node) => `${node.name}-${topo.id}`);
  }

  private routerProtocolNodes(topo: TopoData): Node[] {
    return (topo.nodes || []).filter((node: any) =>
      node.type === 'ROUTER' ||
      node.type === 'router' ||
      (typeof node.name === 'string' && node.name.startsWith('ROUTER'))
    );
  }

  private hasEnabledProtocol(data: any): boolean {
    if (!data || typeof data !== 'object') return false;

    return [
      'protocolOspf2',
      'protocolOspf3',
      'protocolRip',
      'protocolBgp',
      'protocolIsis',
      'protocolPim',
      'protocolSnapshot',
      'protocolBackpressure',
    ].some((key) => data[key] === 'on');
  }

  private async hasProtocolConfiguration(topo: TopoData): Promise<boolean> {
    const routerNodes = this.routerProtocolNodes(topo);
    if (routerNodes.length === 0) return false;

    for (const node of routerNodes) {
      try {
        const response = await this.backend.getAllProtocols(topo.id, `${node.name}-${topo.id}`);
        if (this.hasEnabledProtocol(response.data)) return true;
      } catch {
        // Match the frontend: skip per-node protocol query failures.
      }
    }

    return false;
  }

  private async applyProtocolIfConfigured(topo: TopoData): Promise<'applied' | 'skipped' | 'failed'> {
    try {
      if (!await this.hasProtocolConfiguration(topo)) return 'skipped';

      try {
        await this.backend.cancelProtocol(topo.id);
      } catch {
        // The frontend continues and tries to apply protocol settings after reset failure.
      }

      await this.backend.applyProtocol(topo.id);
      return 'applied';
    } catch {
      return 'failed';
    }
  }

  private async startPassiveMeasurement(topo: TopoData, durationMs: number): Promise<boolean> {
    const containerList = this.dockerContainers(topo);
    if (containerList.length === 0) return false;

    try {
      await this.backend.passiveMeasurement({
        controlType: 1,
        sessionId: topo.id,
        reportInterval: 1,
        containerList,
        duration: durationMs,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async stopPassiveMeasurement(topo: TopoData): Promise<boolean> {
    const containerList = this.dockerContainers(topo);
    if (containerList.length === 0) return false;

    try {
      await this.backend.passiveMeasurement({
        controlType: 2,
        sessionId: topo.id,
        reportInterval: 1,
        containerList,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async startSession(duration?: number): Promise<OpenCliResult> {
    let topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    const expectedNodes = topo.nodes.length;
    const expectedLinks = topo.links.length;
    const initialWait = await this.waitForTopoCounts(topo.id, expectedNodes, expectedLinks, { strict: true });
    topo = initialWait.topo;

    if (this.isRuntimeState(topo.state)) {
      throw new Error(`Scene is already in runtime state: ${topo.state}.`);
    }

    const serverAssignment = await this.ensureServersAssigned(topo, userId);
    topo = serverAssignment.topo;
    const readyWait = await this.waitForTopoCounts(topo.id, topo.nodes.length, topo.links.length, { strict: true });
    topo = readyWait.topo;

    const frontendTopoSyncNotified = await this.waitForFrontendTopoSync(topo.id, 'before-start');
    const servers = Array.isArray((topo as any).servers) ? (topo as any).servers : [];
    const durationMs = normalizeDurationMs(duration);
    const startResponse = await this.backend.startSession(topo.id, userId, servers, durationMs);
    let runtimeTopo = await this.updateTopoFromResponse(startResponse, topo.id);
    const afterStartRestore = await this.restoreRuntimeFrontendTopology(topo, runtimeTopo, userId, 'runtime-render-fields-restored-after-start');
    runtimeTopo = afterStartRestore.topo;
    const runtimePositionSeeded = await this.seedRuntimeNodePositions(topo, 'after-start');
    const protocolStatus = await this.applyProtocolIfConfigured(runtimeTopo);

    if ((runtimeTopo.nodes || []).some((node) => node.type === 'EMANE')) {
      try {
        await this.backend.getNemIds(topo.id);
      } catch {
        // NEM ID 获取失败不阻塞启动流程。
      }
    }

    await this.backend.startBroker({ duration: durationMs, stepLength: 1000, mode: 0 }, topo.id);
    let brokerTopo = runtimeTopo;
    try {
      brokerTopo = await this.fetchTopo(topo.id);
    } catch {
      // Keep the post-start topology if /topo is briefly unavailable while broker starts.
    }
    const afterBrokerRestore = await this.restoreRuntimeFrontendTopology(topo, brokerTopo, userId, 'runtime-render-fields-restored-after-broker');
    runtimeTopo = afterBrokerRestore.topo;
    const runtimePositionReseeded = await this.seedRuntimeNodePositions(topo, 'after-broker-start');
    try {
      runtimeTopo = await this.refreshTopo(topo.id);
    } catch {
      // Keep the last complete topo if the runtime endpoint is still transitioning.
    }
    const passiveMeasurementStarted = await this.startPassiveMeasurement(runtimeTopo, durationMs);
    const runtimeRenderFieldsRestored = afterStartRestore.restoredCount + afterBrokerRestore.restoredCount;
    const runtimeRenderFieldRestoreFailures = afterStartRestore.failedCount + afterBrokerRestore.failedCount;
    const runtimeTopoSyncNotified =
      runtimeRenderFieldRestoreFailures === 0
        ? await this.notifyFrontendTopoSyncIfBackendComplete(topo, 'runtime-started-render-ready')
        : false;

    return this.verifiedResult(`Started simulation: sessionId=${topo.id}, duration=${durationMs}ms.`, runtimeTopo, {
      durationMs,
      topoSettleAttempts: initialWait.attempts + readyWait.attempts,
      topoSettled: initialWait.settled && readyWait.settled,
      serverAssignedCount: serverAssignment.assignedCount,
      frontendTopoSyncNotified,
      frontendSyncDelayMs: frontendTopoSyncNotified ? config.frontendSyncDelayMs : 0,
      runtimeTopoSyncNotified,
      runtimeRenderFieldsRestored,
      runtimeRenderFieldRestoreFailures,
      runtimeRenderDiagnostics: this.runtimeRenderDiagnostics(topo, runtimeTopo),
      runtimePositionSeeded,
      runtimePositionReseeded,
      protocolStatus,
      passiveMeasurementStarted,
    });
  }

  private async pauseSession(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    const userId = requireUserId();
    await this.stopPassiveMeasurement(topo);
    try {
      await this.backend.stopBroker(topo.id);
    } catch {
      // pause 继续调用后端 pause。
    }

    const response = await this.backend.pauseSession(topo.id, userId, this.dockerContainers(topo));
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    return this.verifiedResult(`已请求暂停仿真：sessionId=${topo.id}`, refreshed);
  }

  private async stopSession(): Promise<OpenCliResult> {
    const topo = await this.requireLoadedTopo();
    await this.stopPassiveMeasurement(topo);
    try {
      await this.backend.stopBroker(topo.id);
    } catch {
      // stopSession 继续调用后端 stop。
    }

    const response = await this.backend.stopSession(topo.id);
    const refreshed = await this.updateTopoFromResponse(response, topo.id);
    try {
      await this.backend.cancelProtocol(topo.id);
    } catch {
      // Match frontend behavior: protocol reset failure should not hide the stop result.
    }
    return this.verifiedResult(`已请求停止仿真：sessionId=${topo.id}`, refreshed);
  }
}
