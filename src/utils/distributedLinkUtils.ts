import type {
  Node,
  Link,
  NodeIface,
  LinkOptions,
  DistributedLinkConfig,
  DistributedLinkResult,
  AutoIpConfig
} from '../types/topo';

/**
 * 分布式链路工具类
 */
export class DistributedLinkUtils {

  /**
   * 获取所有无人机节点
   */
  static getDroneNodes(nodes: Node[]): Node[] {
    return nodes.filter(node => node.type === 'DRONE');
  }

  /**
   * 获取所有EMANE子网节点
   */
  static getEmaneNodes(nodes: Node[]): Node[] {
    return nodes.filter(node => node.type === 'EMANE');
  }

  /**
   * 获取所有路由器节点（分布式场景）
   * 在分布式场景中，路由器节点的type为DEFAULT，model为router
   */
  static getRouterNodes(nodes: Node[]): Node[] {
    return nodes.filter(node =>
      node.type === 'DEFAULT' && node.model === 'router'
    );
  }

  /**
   * 生成基于节点ID的MAC地址
   */
  static generateMacAddress(nodeId: number): string {
    const safeNodeId = Math.abs(nodeId) & 0xFFFFFFFFFFFF;
    const hex = safeNodeId.toString(16).padStart(12, '0');
    const bytes = hex.match(/.{2}/g);

    if (bytes && bytes.length === 6) {
      return bytes.join(':');
    }

    const fallbackHex = (safeNodeId % 0xFFFFFFFFFFFF).toString(16).padStart(12, '0');
    return fallbackHex.match(/.{2}/g)?.join(':') || '00:00:00:00:00:01';
  }

  /**
   * 获取节点已使用的接口ID
   */
  static getUsedInterfaceIds(links: Link[], nodeId: number): number[] {
    const usedIds: number[] = [];

    links.forEach(link => {
      if (link.node1_id === nodeId && link.iface1) {
        usedIds.push(link.iface1.id);
      }
      if (link.node2_id === nodeId && link.iface2) {
        usedIds.push(link.iface2.id);
      }
    });

    return usedIds.sort((a, b) => a - b);
  }

  /**
   * 获取下一个可用的接口ID
   */
  static getNextInterfaceId(links: Link[], nodeId: number): number {
    const usedIds = this.getUsedInterfaceIds(links, nodeId);

    let nextId = 0;
    for (const id of usedIds) {
      if (id !== nextId) {
        break;
      }
      nextId++;
    }

    return nextId;
  }

  /**
   * 创建默认接口
   */
  static createDefaultInterface(nodeId: number, id: number, nodeType?: string): NodeIface {
    // 仅为分布式场景下的无人机节点自动分配MAC地址
    const shouldAutoAssignMac = nodeType === 'DRONE';

    return {
      id,
      name: `eth${id}`,
      mac: shouldAutoAssignMac ? this.generateMacAddress(nodeId) : '',
      ip4: '',
      ip4_mask: 24,
      ip6: '',
      ip6_mask: 64,
      netId: 0,
      flowId: 0,
      mtu: 0,
      node_id: nodeId,
      net2_id: 0
    };
  }

  /**
   * 解析IP范围
   */
  static parseIpRange(ipRange: string): AutoIpConfig {
    const [network, mask] = ipRange.split('/');
    const parts = network.split('.');
    const baseNetwork = parts.slice(0, 3).join('.');
    const subnetMask = parseInt(mask) || 24;

    return {
      baseNetwork,
      startIp: 1,
      subnetMask,
      usedIps: new Set<string>()
    };
  }

  /**
   * 自动分配IP地址
   */
  static allocateIpAddress(config: AutoIpConfig): string | null {
    for (let i = config.startIp; i <= 254; i++) {
      const ip = `${config.baseNetwork}.${i}`;
      if (!config.usedIps.has(ip)) {
        config.usedIps.add(ip);
        return ip;
      }
    }
    return null;
  }

  /**
   * 获取EMANE节点的网络索引
   */
  static getEmaneNetworkIndex(emaneNodes: Node[], emaneNodeId: number): number {
    const index = emaneNodes.findIndex(node => node.id === emaneNodeId);
    return index !== -1 ? index : 0;
  }

  /**
   * 为EMANE连接分配IP (已弃用 - 使用allocateIpAddress替代)
   * @deprecated 请使用统一的allocateIpAddress方法
   */
  static allocateEmaneIp(emaneNodes: Node[], emaneNodeId: number, nodeCount: number): string {
    const emaneIndex = this.getEmaneNetworkIndex(emaneNodes, emaneNodeId);
    const baseIp = `${(emaneIndex + 1) * 10}.0.0`;
    return `${baseIp}.${nodeCount + 1}`;
  }

  /**
   * 创建链路
   */
  static createLink(
    sourceNode: Node,
    targetNode: Node,
    linkOptions: LinkOptions,
    existingLinks: Link[],
    sourceIp?: string,
    targetIp?: string
  ): Partial<Link> {
    let sourceIface: NodeIface | undefined;
    let targetIface: NodeIface | undefined;

    // 检查源节点是否为EMANE，如果是则不创建接口
    if (sourceNode.type !== 'EMANE') {
      const sourceIfaceId = this.getNextInterfaceId(existingLinks, sourceNode.id);
      sourceIface = this.createDefaultInterface(sourceNode.id, sourceIfaceId, sourceNode.type);
      if (sourceIp) {
        sourceIface.ip4 = sourceIp;
      }
    }

    // 检查目标节点是否为EMANE，如果是则不创建接口
    if (targetNode.type !== 'EMANE') {
      const targetIfaceId = this.getNextInterfaceId(existingLinks, targetNode.id);
      targetIface = this.createDefaultInterface(targetNode.id, targetIfaceId, targetNode.type);
      if (targetIp) {
        targetIface.ip4 = targetIp;
      }
    }

    // 按照正确的格式创建链路对象，让后端处理label
    const link: Partial<Link> = {
      type: 'WIRED',
      node1_id: sourceNode.id,
      node2_id: targetNode.id,
      network_id: 0,
      options: { ...linkOptions }
    };

    // 只有在接口存在时才添加到链路对象中
    if (sourceIface) {
      link.iface1 = sourceIface;
    }
    if (targetIface) {
      link.iface2 = targetIface;
    }

    return link;
  }

  /**
   * 创建分布式链路配置
   */
  static async createDistributedLinks(
    config: DistributedLinkConfig,
    nodes: Node[],
    existingLinks: Link[]
  ): Promise<DistributedLinkResult> {
    const result: DistributedLinkResult = {
      createdLinks: [],
      ipAllocations: {},
      errors: []
    };

    try {
      // 初始化IP配置
      let ipConfig: AutoIpConfig | null = null;
      if (config.autoIpAllocation) {
        ipConfig = this.parseIpRange(config.ipRange);

        // 收集已使用的IP地址
        existingLinks.forEach(link => {
          if (link.iface1?.ip4) {
            ipConfig!.usedIps.add(link.iface1.ip4);
          }
          if (link.iface2?.ip4) {
            ipConfig!.usedIps.add(link.iface2.ip4);
          }
        });

        if (ipConfig.usedIps.size > 0) {
        }
      }

      // 获取所有EMANE节点用于IP分配
      const allEmaneNodes = this.getEmaneNodes(nodes);

      // 处理无人机到EMANE的连接
      if (config.selectedDrones.length > 0 && config.targetEmaneSubnet) {
        const emaneNode = nodes.find(node => node.id === config.targetEmaneSubnet);
        if (!emaneNode) {
          result.errors.push('未找到指定的EMANE子网节点');
        } else {
          const droneNodes = nodes.filter(node => config.selectedDrones.includes(node.id));

          // 创建无人机到EMANE的直接连接
          for (const drone of droneNodes) {
            await this.createDirectConnection(
              drone,
              emaneNode,
              config.linkOptions,
              existingLinks,
              result,
              ipConfig,
              allEmaneNodes
            );
          }
        }
      }

      // 处理路由器链配置（独立于无人机配置）
      if (config.routerChain.length > 0) {
        const routerNodes = nodes.filter(node => config.routerChain.includes(node.id));
        await this.createRouterChain(
          routerNodes,
          config.linkOptions,
          existingLinks,
          result,
          ipConfig
        );
      }

    } catch (error: any) {
      result.errors.push(`创建分布式链路失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 创建直接连接（无人机直接连EMANE）
   */
  private static async createDirectConnection(
    drone: Node,
    emane: Node,
    linkOptions: LinkOptions,
    existingLinks: Link[],
    result: DistributedLinkResult,
    ipConfig: AutoIpConfig | null,
    allEmaneNodes: Node[]
  ) {
    let droneIp = '';

    // 只为无人机节点分配IP，EMANE节点不需要IP配置
    if (ipConfig) {
      // 使用统一的IP分配方法，确保IP地址递增
      droneIp = this.allocateIpAddress(ipConfig) || '';
      if (droneIp) {
        result.ipAllocations[drone.id] = droneIp;
      }
    }

    // 创建链路：无人机连接到EMANE（无人机有接口和IP，EMANE无接口）
    const link = this.createLink(
      drone,
      emane,
      linkOptions,
      [...existingLinks, ...result.createdLinks],
      droneIp,
      undefined // EMANE节点不需要IP
    );

    result.createdLinks.push(link);
  }

  /**
   * 创建路由器链路（路由器串联）
   */
  private static async createRouterChain(
    routerNodes: Node[],
    linkOptions: LinkOptions,
    existingLinks: Link[],
    result: DistributedLinkResult,
    ipConfig: AutoIpConfig | null
  ) {
    if (routerNodes.length < 2) {
      result.errors.push('路由器链至少需要2个路由器节点');
      return;
    }


    // 按照用户配置的顺序串联路由器
    for (let i = 0; i < routerNodes.length - 1; i++) {
      const sourceRouter = routerNodes[i];
      const targetRouter = routerNodes[i + 1];

      let sourceIp = '';
      let targetIp = '';

      // 为路由器分配IP地址
      if (ipConfig) {
        sourceIp = this.allocateIpAddress(ipConfig) || '';
        targetIp = this.allocateIpAddress(ipConfig) || '';

        if (sourceIp) {
          result.ipAllocations[sourceRouter.id] = sourceIp;
        }
        if (targetIp) {
          result.ipAllocations[targetRouter.id] = targetIp;
        }

      }

      // 创建路由器之间的链路
      const link = this.createLink(
        sourceRouter,
        targetRouter,
        linkOptions,
        [...existingLinks, ...result.createdLinks],
        sourceIp,
        targetIp
      );

      result.createdLinks.push(link);
    }

  }

  /**
   * 验证配置有效性
   */
  static validateConfig(config: DistributedLinkConfig, nodes: Node[]): string[] {
    const errors: string[] = [];

    // 检查是否至少有一种配置：无人机到EMANE 或 路由器链
    const hasDroneConfig = config.selectedDrones.length > 0 && config.targetEmaneSubnet;
    const hasRouterConfig = config.routerChain.length > 0;

    if (!hasDroneConfig && !hasRouterConfig) {
      errors.push('请至少配置一种链路：无人机到EMANE子网 或 路由器链');
      return errors;
    }

    // 如果配置了无人机到EMANE，验证相关字段
    if (hasDroneConfig) {
      // 验证无人机选择
      if (config.selectedDrones.length === 0) {
        errors.push('配置无人机链路时必须至少选择一个无人机节点');
      }

      // 验证EMANE子网
      const emaneNode = nodes.find(node => node.id === config.targetEmaneSubnet);
      if (!emaneNode) {
        errors.push('配置无人机链路时必须选择一个有效的子网节点');
      }
    }

    // 如果配置了路由器链，验证相关字段
    if (hasRouterConfig) {
      if (config.routerChain.length < 2) {
        errors.push('路由器链至少需要2个路由器节点');
      }

      // 验证路由器节点是否存在
      const invalidRouters = config.routerChain.filter(
        routerId => !nodes.find(node => node.id === routerId && node.type === 'DEFAULT')
      );
      if (invalidRouters.length > 0) {
        errors.push(`无效的路由器节点ID: ${invalidRouters.join(', ')}`);
      }
    }

    // 验证IP范围格式
    if (config.autoIpAllocation) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!ipRegex.test(config.ipRange)) {
        errors.push('IP地址范围格式不正确，应为类似 10.0.0.0/24 的格式');
      }
    }

    return errors;
  }
}