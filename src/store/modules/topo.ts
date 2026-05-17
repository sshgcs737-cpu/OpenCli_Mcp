import { defineStore } from 'pinia'
import type {
  Position,
  GeoPosition,
  LocationInfo,
  ConfigOption,
  ServiceData,
  ServiceConfig,
  ConfigServiceConfig,
  EmaneConfig,
  NodeIface,
  LinkOptions,
  Node,
  Link,
  Hook,
  Server,
  DefaultService,
  TopoData
} from '@/types/topo'
import { deleteNode, addNode as addNodeApi, editNode as editNodeApi } from '@/api/node/index'
import { addLink as addLinkApi, modifyLink as modifyLinkApi, signalStart as signalStartApi } from '@/api/link/index'
import { deleteLink as deleteLinkApi } from '@/api/link/index'
import { getTopoBySession } from '@/api/scene/index'
import { getUserInfo } from '@/store/user' // 导入用户信息获取函数
import { createUserIsolatedStorage } from '@/utils/userIsolatedStorage'

export const useTopoStore = defineStore('topo', {
  state: () => ({
    currentSessionId: null as number | null,
    currentSessionName: null as string | null,
    topoData: null as TopoData | null,
    loading: false,
    error: null as string | null,
    selectedNode: null as Node | null,
    selectedLink: null as Link | null,
    operationMode: 'select' as 'select' | 'add' | 'connect',
    selectedNodeType: 'DEVICE' as string, // 当前选中的节点类型
    selectedNodeSubType: null as string | null // 当前选中的节点子类型（用于机动车等特殊情况）
  }),

  getters: {
    // 基础信息
    nodeCount: (state) => state.topoData?.nodes.length || 0,
    linkCount: (state) => state.topoData?.links.length || 0,
    sceneName: (state) => state.topoData?.name || '未加载',
    hasTopoData: (state) => state.topoData !== null,

    // 数据访问
    nodes: (state): Node[] => state.topoData?.nodes || [],
    links: (state): Link[] => state.topoData?.links || [],

    // 节点过滤
    deviceNodes: (state): Node[] =>
      state.topoData?.nodes.filter(node => node.type === 'device') || [],

    subnetNodes: (state): Node[] =>
      state.topoData?.nodes.filter(node => node.type === 'subnet') || [],

    // 获取指定节点的所有连接
    getNodeLinks: (state) => (nodeId: number): Link[] =>
      state.topoData?.links.filter(
        link => link.node1_id === nodeId || link.node2_id === nodeId
      ) || []
  },

  actions: {
    // 会话管理
    setTopoData(sessionId: number, data: TopoData) {
      const nextSessionId = Number(data?.id || sessionId);
      const previousSessionId = Number(this.currentSessionId || this.topoData?.id || 0);
      const shouldKeepName = previousSessionId === nextSessionId && Boolean(this.currentSessionName);

      this.currentSessionId = nextSessionId;
      this.currentSessionName = data?.name || (shouldKeepName ? this.currentSessionName : `\u573a\u666f${nextSessionId}`);
      this.topoData = data;
      this.error = null;
    },

    setCurrentSessionName(name: string | null) {
      this.currentSessionName = name
    },

    initEmptyTopoData() {
      this.topoData = {
        id: 0,
        state: 'NONE',
        nodes: [],
        links: [],
        dir: '',
        user: '',
        default_services: [],
        location: {
          x: 0,
          y: 0,
          z: 0,
          lat: 0,
          lon: 0,
          alt: 0,
          scale: 1
        },
        hooks: [],
        metadata: {},
        file: '',
        options: {},
        servers: [],
        name: '新建场景'
      }
      this.error = null
    },

    clearTopoData() {
      this.currentSessionId = null
      this.currentSessionName = null
      this.topoData = null
      this.selectedNode = null
      this.selectedLink = null
      this.operationMode = 'select'
    },

    // 状态管理
    setLoading(loading: boolean) {
      this.loading = loading
    },

    setError(error: string) {
      this.error = error
    },

    // 链路操作
    addLink(link: Link) {
      if (this.topoData) {
        this.topoData.links.push(link)
      }
    },

    updateLink(node1Id: number, node2Id: number, updates: Partial<Link>) {
      if (this.topoData) {
        const linkIndex = this.topoData.links.findIndex(
          l => l.node1_id === node1Id && l.node2_id === node2Id
        )
        if (linkIndex !== -1) {
          this.topoData.links[linkIndex] = {
            ...this.topoData.links[linkIndex],
            ...updates
          }
        }
      }
    },

    removeLink(node1Id: number, node2Id: number) {
      if (this.topoData) {
        this.topoData.links = this.topoData.links.filter(
          l => !(l.node1_id === node1Id && l.node2_id === node2Id)
        )
      }
    },

    // 工具方法
    createDefaultNode(
      id: number,
      name: string,
      type: string = 'DEFAULT',
      lat: number = 0,
      lon: number = 0,
      alt: number = 0
    ): Node {
      return {
        id,
        name,
        type,
        model: '',
        position: { x: 0, y: 0, z: 0 },
        emane: '',
        icon: '',
        image: '',
        server: '',
        config_services: [],
        geo: { lat, lon, alt },
        dir: '',
        channel: '',
        canvas: 0,
        wlan_config: {},
        mobility_config: {},
        service_configs: {},
        emane_configs: [],
        status: 'UP', // 默认节点状态为正常
        alias: name // 默认别名使用节点名称
      }
    },

    createDefaultLink(
      node1Id: number,
      node2Id: number,
      type: string = 'WIRELESS'
    ): Link {
      const defaultIface = {
        id: 0,
        name: '',
        mac: '',
        ip4: '',
        ip4_mask: 24,
        ip6: '',
        ip6_mask: 64,
        netId: 0,
        flowId: 0,
        mtu: 0,
        node_id: 0,
        net2_id: 0
      }

      return {
        node1_id: node1Id,
        node2_id: node2Id,
        type,
        iface1: { ...defaultIface, id: 1, node_id: node1Id },
        iface2: { ...defaultIface, id: 2, node_id: node2Id },
        options: {
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
          mtu: 0
        },
        network_id: 0
      }
    },

    // 选择操作
    setSelectedNode(node: Node | null) {
      this.selectedNode = node
    },

    setSelectedLink(link: Link | null) {
      this.selectedLink = link
    },

    setOperationMode(mode: 'select' | 'add' | 'connect') {
      this.operationMode = mode
    },

    // 设置当前选中的节点类型
    setSelectedNodeType(type: string) {
      this.selectedNodeType = type
    },

    // 设置当前选中的节点子类型
    setSelectedNodeSubType(subType: string | null) {
      this.selectedNodeSubType = subType
    },

    async removeNodeRemote(nodeId: number) {
      if (!this.currentSessionId) {
        throw new Error('当前会话ID不存在');
      }

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      const params: any = { sessionId: this.currentSessionId, nodeId };
      if (userId) {
        params.userId = userId;
      }

      const res = await deleteNode(params);
      if (res.code !== 200) {
        throw new Error(res.msg || '删除节点失败');
      }
      // 删除成功后，重新调用topo接口获取最新数据
      try {
        const topoRes = await getTopoBySession(this.currentSessionId);
        if (topoRes.code === 200 && topoRes.data) {
          (this as any).setTopoData(topoRes.data.id, topoRes.data);
          return;
        }
      } catch (topoError) {
        console.warn('获取最新topo数据失败，使用删除返回的数据:', topoError);
      }
      // 如果获取topo失败，使用原返回数据
      (this as any).setTopoData(res.data.id, res.data);
    },

    async addNodeRemote(nodeData: any) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }

      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      const res = await addNodeApi(nodeData, sessionId, userId);
      if (res && res.code === 200) {
        // 添加成功后，重新调用topo接口获取最新数据
        try {
          const topoRes = await getTopoBySession(sessionId);
          if (topoRes.code === 200 && topoRes.data) {
            (this as any).setTopoData(topoRes.data.id, topoRes.data);
            return { res, newNode: nodeData };
          }
        } catch (topoError) {
          console.warn('获取最新topo数据失败，使用添加返回的数据:', topoError);
        }
        // 如果获取topo失败，使用原返回数据
        (this as any).setTopoData(res.data.id, res.data);
        return { res, newNode: nodeData };
      } else {
        throw new Error((res && res.msg) || '创建节点失败');
      }
    },

    async editNodeRemote(nodeData: any) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }

      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      const res = await editNodeApi(nodeData, sessionId, userId);
      if (res && res.code === 200) {
        // 编辑成功后，重新调用topo接口获取最新数据
        try {
          const topoRes = await getTopoBySession(sessionId);
          if (topoRes.code === 200 && topoRes.data) {
            (this as any).setTopoData(topoRes.data.id, topoRes.data);
            return { res, updatedNode: nodeData };
          }
        } catch (topoError) {
          console.warn('获取最新topo数据失败，使用编辑返回的数据:', topoError);
        }
        // 如果获取topo失败，使用原返回数据
        (this as any).setTopoData(res.data.id, res.data);
        return { res, updatedNode: nodeData };
      } else {
        throw new Error((res && res.msg) || '编辑节点失败');
      }
    },

    // 添加链路远程操作
    async addLinkRemote(linkData: Partial<Link>) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }
      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      try {
        const res = await addLinkApi(linkData, sessionId, userId);
        if (res.code === 200) {
          // 添加成功后，重新调用topo接口获取最新数据
          try {
            const topoRes = await getTopoBySession(sessionId);
            if (topoRes.code === 200 && topoRes.data) {
              (this as any).setTopoData(topoRes.data.id, topoRes.data);
              return { res, newLink: linkData };
            }
          } catch (topoError) {
            console.warn('获取最新topo数据失败，使用添加返回的数据:', topoError);
          }
          // 如果获取topo失败，使用原返回数据
          if (res.data) {
            (this as any).setTopoData(res.data.id, res.data);
          }
          return { res, newLink: linkData };
        } else {
          throw new Error(res.msg || '添加链路失败');
        }
      } catch (error: any) {
        console.error('添加链路时出错:', error);
        throw new Error(error?.message || '创建链路失败');
      }
    },

    // 删除链路远程操作
    async deleteLinkRemote(linkData: Partial<Link>) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }

      // 处理子网内部链路的特殊情况
      if (linkData.is_subnet_link) {
        // 子网内部链路是虚拟的，不需要实际删除
        // 只需要关闭面板，不需要调用API
        return { success: true };
      }

      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      try {
        // 查找完整的链路数据
        let completeLink: Partial<Link> = linkData;

        // 如果只传入了节点ID，则尝试找到完整的链路数据
        if (linkData.node1_id !== undefined && linkData.node2_id !== undefined &&
            !linkData.iface1 && !linkData.iface2 && !linkData.options && !linkData.type) {
          const link = this.topoData.links.find((l: any) =>
            (l.node1_id === linkData.node1_id && l.node2_id === linkData.node2_id) ||
            (l.node1_id === linkData.node2_id && l.node2_id === linkData.node1_id)
          );

          if (link) {
            completeLink = { ...link };
          }
        }

        // 检查是否是节点与子网之间的链路
        if (completeLink.node1_id !== undefined && completeLink.node2_id !== undefined) {
          const node1 = this.topoData.nodes.find((n: any) => n.id === completeLink.node1_id);
          const node2 = this.topoData.nodes.find((n: any) => n.id === completeLink.node2_id);
          
          if (node1 && node2) {
            const isEmaneLink = (node1.type === 'EMANE' && node2.type !== 'EMANE') || 
                               (node2.type === 'EMANE' && node1.type !== 'EMANE');
            
            if (isEmaneLink) {
              throw new Error('不能删除节点与子网之间的链路');
            }
          }
        }

        // 发送带完整链路数据的请求
        const res = await deleteLinkApi(completeLink, sessionId, userId);

        if (res.code === 200) {
          // 删除成功后，重新调用topo接口获取最新数据
          try {
            const topoRes = await getTopoBySession(sessionId);
            if (topoRes.code === 200 && topoRes.data) {
              (this as any).setTopoData(topoRes.data.id, topoRes.data);
              return { res };
            }
          } catch (topoError) {
            console.warn('获取最新topo数据失败，使用删除返回的数据:', topoError);
          }
          // 如果获取topo失败，使用原返回数据
          if (res.data) {
            (this as any).setTopoData(res.data.id, res.data);
          }
          return { res };
        } else {
          throw new Error(res.msg || '删除链路失败');
        }
      } catch (error: any) {
        console.error('删除链路时出错:', error);
        throw new Error(error?.message || '删除链路失败');
      }
    },

    // 修改链路远程操作
    async modifyLinkRemote(linkData: Partial<Link>) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }
      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      try {
        const res = await modifyLinkApi(linkData, sessionId, userId);
        if (res.code === 200) {
          // 修改成功后，重新调用topo接口获取最新数据
          // 因为modify接口在非运行状态下返回的topo可能为空
          try {
            const topoRes = await getTopoBySession(sessionId);
            if (topoRes.code === 200 && topoRes.data) {
              (this as any).setTopoData(topoRes.data.id, topoRes.data);
            }
          } catch (topoError) {
            console.warn('获取最新topo数据失败，使用modify返回的数据:', topoError);
            // 如果获取topo失败，尝试使用modify返回的数据（如果有效）
            if (res.data && res.data.nodes && res.data.nodes.length > 0) {
              (this as any).setTopoData(res.data.id, res.data);
            }
          }
          return { res };
        } else {
          throw new Error(res.msg || '修改链路失败');
        }
      } catch (error: any) {
        console.error('修改链路时出错:', error);
        throw new Error(error?.message || '修改链路失败');
      }
    },

    // 信号开始远程操作
    async signalStartRemote(linkData: Partial<Link>) {
      if (!this.topoData || !this.topoData.id) {
        throw new Error('拓扑数据未初始化');
      }
      const sessionId = this.topoData.id;

      // 获取当前用户ID
      const userInfo = getUserInfo();
      const userId = userInfo.id;

      try {
        const res = await signalStartApi(linkData, sessionId, userId);
        if (res.code === 200) {
          // 信号开始成功后，重新调用topo接口获取最新数据
          try {
            const topoRes = await getTopoBySession(sessionId);
            if (topoRes.code === 200 && topoRes.data) {
              (this as any).setTopoData(topoRes.data.id, topoRes.data);
              return { res };
            }
          } catch (topoError) {
            console.warn('获取最新topo数据失败，使用signalStart返回的数据:', topoError);
          }
          // 如果获取topo失败，使用原返回数据
          if (res.data) {
            (this as any).setTopoData(res.data.id, res.data);
          }
          return { res };
        } else {
          throw new Error(res.msg || '信号开始失败');
        }
      } catch (error: any) {
        console.error('信号开始时出错:', error);
        throw new Error(error?.message || '信号开始失败');
      }
    }

  },

  persist: {
    key: 'topo-store',
    storage: createUserIsolatedStorage(),
    paths: ['topoData', 'currentSessionId']
  }
}) 
