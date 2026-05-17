// 位置接口
export interface Position {
  x: number;
  y: number;
  z: number;
}

// 地理位置接口
export interface GeoPosition {
  lat: number;
  lon: number;
  alt: number;
}

// 完整位置信息
export interface LocationInfo {
  x: number;
  y: number;
  z: number;
  lat: number;
  lon: number;
  alt: number;
  scale: number;
}

// 配置选项接口
export interface ConfigOption {
  label: string;
  name: string;
  value: string;
  type: number;
  select: string[];
  group: string;
}

// 服务数据接口
export interface ServiceData {
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

// 服务配置接口
export interface ServiceConfig {
  nodeId: number;
  service: string;
  data: ServiceData;
  files: Record<string, string>;
}

// 配置服务配置接口
export interface ConfigServiceConfig {
  nodeId: number;
  name: string;
  templates: Record<string, string>;
  config: Record<string, string>;
}

// EMANE配置接口
export interface EmaneConfig {
  ifaceId: number;
  model: string;
  config: Record<string, ConfigOption>;
}

// 接口接口
export interface NodeIface {
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

// 链路选项接口
export interface LinkOptions {
  jitter: number;
  key: number;
  mburst: number;
  mer: number;
  loss: number;
  bandwidth: number;
  burst: number;
  delay: number;
  dup: number;
  unidirectional: boolean;
  buffer: number;
  mtu: number;
}

// 分布式链路配置接口
export interface DistributedLinkConfig {
  selectedDrones: number[]; // 选择的无人机节点ID列表
  targetEmaneSubnet: number; // 目标EMANE子网节点ID
  routerChain: number[]; // 路由器串联ID列表
  autoIpAllocation: boolean; // 是否启用IP自动分配
  ipRange: string; // IP地址范围（如：10.0.0.0/24）
  linkOptions: LinkOptions; // 链路参数配置
}

// 自动分配的IP配置
export interface AutoIpConfig {
  baseNetwork: string; // 基础网络地址（如：10.0.0）
  startIp: number; // 起始IP最后一位
  subnetMask: number; // 子网掩码位数
  usedIps: Set<string>; // 已使用的IP地址集合
}

// 分布式链路创建结果
export interface DistributedLinkResult {
  createdLinks: Partial<Link>[]; // 创建的链路列表
  ipAllocations: Record<number, string>; // 节点ID到IP地址的映射
  errors: string[]; // 错误信息列表
}

// 节点接口
export interface Node {
  id: number;
  name: string;
  type: string; // DEVICE, DRONE, STATION, EMANE, INODE, SERVER, ROUTER, SWITCH
  model?: string;
  position: Position;
  emane: string;
  icon: string;
  image?: string;
  server: string;
  config_services: string[];
  geo: GeoPosition;
  dir: string;
  channel: string;
  canvas: number;
  wlan_config: Record<string, ConfigOption>;
  mobility_config: Record<string, ConfigOption>;
  service_configs: Record<string, ServiceConfig>;
  config_cervice_configs?: Record<string, ConfigServiceConfig>;
  emane_configs: EmaneConfig[];
  role?: string;
  status?: string; // 节点状态：UP表示正常，DOWN表示故障，默认为UP
  alias?: string; // 节点别名，可设置节点的别名或者直接使用当前节点的name
  phy_type?: string; // 物理层模型类型，用于EMANE子网节点，如：ofdm、dsss、fhss等

  // VM模板相关字段（仅对虚拟机节点有效）
  templateId?: number; // 模板ID
  templateName?: string; // 模板名称
  vcpu?: number; // CPU核数
  memory?: string; // 内存大小（KB）
  curMemory?: string; // 当前内存大小（KB）
  disk?: string; // 磁盘文件名
  location?: string; // 模板文件位置

  // TMV配置相关字段（仅对TMV节点有效）
  tmvConfig?: {
    modelType: 'transmitter' | 'receiver'; // 模型类型：发送机或接收机
    trafficModel?: string; // 流量模型（仅发送机）
    testDuration?: number; // 测试时长（仅接收机）
  };
}

// 链路接口
export interface Link {
  node1_id: number;
  node2_id: number;
  label: Label;
  type: string;
  iface1?: NodeIface; // EMANE节点连接时可能为undefined
  iface2?: NodeIface; // EMANE节点连接时可能为undefined
  options: LinkOptions;
  network_id: number;
  is_subnet_link?: boolean;
  subnet_id?: number;
}

export interface Label {
  session_id: number;
  node_id: number;
  iface_id: number;
}

// 钩子接口
export interface Hook {
  state: string;
  file: string;
  data: string;
}

// 服务器接口
export interface Server {
  name: string;
  host: string;
}

// 默认服务配置
export interface DefaultService {
  node_type: string;
  services: string[];
}

// 拓扑数据接口
export interface TopoData {
  id: number;
  state: string;
  nodes: Node[];
  links: Link[];
  dir: string;
  user: string;
  default_services: DefaultService[];
  location: LocationInfo;
  hooks: Hook[];
  metadata: Record<string, string>;
  file: string;
  options: Record<string, ConfigOption>;
  servers: Server[];
  name?: string; // 可选字段，用于显示场景名称
} 