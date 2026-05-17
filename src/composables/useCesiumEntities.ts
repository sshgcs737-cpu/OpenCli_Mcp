import { ref, watch, onUnmounted, readonly } from 'vue';
import * as Cesium from 'cesium';
import type { Node, Link, NodeIface } from '../types/topo';
import { useTopoStore } from '../store/modules/topo';
import { useEmaneStore } from '../store/modules/emane';
import { useNemIdStore } from '../store/modules/nemId';
import { useInterferenceStore } from '../store/modules/interference';
import { getUserInfo } from '../store/user';

// 预定义的子网颜色，确保相同子网ID每次获得相同颜色
const SUBNET_COLORS = [
  Cesium.Color.fromCssColorString('#c6c628'),  // 深红
  Cesium.Color.fromCssColorString('#E65100'),  // 深橙
  Cesium.Color.fromCssColorString('#c015a6'),  // 深蓝
  Cesium.Color.fromCssColorString('#9E9D24'),  // 深黄绿
  Cesium.Color.fromCssColorString('#AD1457'),  // 深粉红
  Cesium.Color.fromCssColorString('#00838F'),  // 深青
  Cesium.Color.fromCssColorString('#EF6C00'),  // 深橙色
  Cesium.Color.fromCssColorString('#6A1B9A'),  // 深紫
  Cesium.Color.fromCssColorString('#283593'),  // 深靛蓝
  Cesium.Color.fromCssColorString('#2E7D32'),  // 深绿
];

const SUBNET_ATTACHMENT_LINE = {
  width: 1.5,
  alpha: 0.9,
  dashLength: 10.0
};

const getSubnetAttachmentColor = (subnetColor: Cesium.Color) => {
  const luminance = subnetColor.red * 0.299 + subnetColor.green * 0.587 + subnetColor.blue * 0.114;
  const adjustedColor = luminance > 0.7 ?
    new Cesium.Color(subnetColor.red * 0.65, subnetColor.green * 0.65, subnetColor.blue * 0.65, 1.0) :
    new Cesium.Color(subnetColor.red, subnetColor.green, subnetColor.blue, 1.0);

  return adjustedColor.withAlpha(SUBNET_ATTACHMENT_LINE.alpha);
};

// 全局状态控制是否使用简单渲染模式
const useSimpleRenderingMode = ref(false);

// 通信范围球体的半径（单位：米）
const COMMUNICATION_RANGE_RADIUS = 800.0;

// SINR信干噪比阈值配置（单位：dB）
const SINR_THRESHOLDS = {
  GOOD: 20,    // >= 20dB 为好（绿色）
  MEDIUM: 10,  // >= 10dB 且 < 20dB 为中等（黄色）
  // < 10dB 为差（红色）
};

// SINR对应的链路颜色
const SINR_COLORS = {
  GOOD: Cesium.Color.fromCssColorString('#00ff00'),      // 绿色 - 信号好
  MEDIUM: Cesium.Color.fromCssColorString('#ffff00'),    // 黄色 - 信号中等
  POOR: Cesium.Color.fromCssColorString('#ff0000'),      // 红色 - 信号差
  UNKNOWN: Cesium.Color.fromCssColorString('#ff9500'),   // 橙色 - 无数据（默认）
};

const WIRED_LINK_COLOR = Cesium.Color.fromCssColorString('#00eaff');
const FAULT_LINK_COLOR = Cesium.Color.fromCssColorString('#ff0000');
const FAULT_FLASH_COLOR = Cesium.Color.fromCssColorString('#ff2f2f');
const FAULT_FLASH_INTERVAL_SECONDS = 0.45;

/**
 * 根据SINR值获取对应的颜色
 * @param sinr - SINR值（dB）
 * @returns Cesium颜色对象
 */
/**
 * 根据背景颜色亮度选择对比文字颜色
 * 亮色背景（绿色、黄色）用深色字，暗色背景（蓝色、红色、橙色）用白色字
 */
const getLabelTextColor = (bgColor: Cesium.Color): Cesium.Color => {
  const luminance = bgColor.red * 0.299 + bgColor.green * 0.587 + bgColor.blue * 0.114;
  return luminance > 0.5 ? Cesium.Color.fromCssColorString('#1A1A2E') : Cesium.Color.WHITE;
};

const getSinrColor = (sinr: number | null | undefined): Cesium.Color => {
  if (sinr === null || sinr === undefined || !Number.isFinite(sinr)) {
    return SINR_COLORS.UNKNOWN;
  }
  if (sinr >= SINR_THRESHOLDS.GOOD) {
    return SINR_COLORS.GOOD;
  }
  if (sinr >= SINR_THRESHOLDS.MEDIUM) {
    return SINR_COLORS.MEDIUM;
  }
  return SINR_COLORS.POOR;
};

/**
 * 根据emane节点参数计算通信范围半径
 * @param node - 节点数据
 * @param topoStoreInstance - topo store实例
 * @returns 计算得出的通信范围半径（米）
 */
const calculateCommunicationRangeRadius = (node: any, topoStoreInstance: any): number => {
  // 如果是无人机节点，需要找到它连接的emane子网
  if (node.type === 'DRONE') {
    // 查找无人机连接的emane子网
    const connectedEmaneSubnet = findConnectedEmaneSubnet(node.id, topoStoreInstance);
    if (connectedEmaneSubnet) {
      return calculateRadiusFromEmaneConfig(connectedEmaneSubnet);
    }
  }
  // 如果是emane节点，直接计算
  else if (node.type === 'EMANE') {
    return calculateRadiusFromEmaneConfig(node);
  }

  // 如果没有找到相关配置，使用默认值
  return COMMUNICATION_RANGE_RADIUS;
};

/**
 * 查找无人机连接的emane子网
 * @param droneId - 无人机节点ID
 * @param topoStoreInstance - topo store实例
 * @returns 连接的emane子网节点，如果没有找到则返回null
 */
const findConnectedEmaneSubnet = (droneId: number, topoStoreInstance: any): any => {
  if (!topoStoreInstance.topoData?.links || !topoStoreInstance.topoData?.nodes) {
    return null;
  }

  // 查找连接到该无人机的链路
  const connectedLinks = topoStoreInstance.topoData.links.filter((link: any) => 
    link.node1_id === droneId || link.node2_id === droneId
  );

  // 在连接的链路中查找emane子网节点
  for (const link of connectedLinks) {
    const otherNodeId = link.node1_id === droneId ? link.node2_id : link.node1_id;
    const otherNode = topoStoreInstance.topoData.nodes.find((n: any) => n.id === otherNodeId);
    
    if (otherNode && otherNode.type === 'EMANE') {
      return otherNode;
    }
  }

  return null;
};

/**
 * 从emane配置中计算通信范围半径
 * @param emaneNode - emane节点数据
 * @returns 计算得出的通信范围半径（米）
 */
const calculateRadiusFromEmaneConfig = (emaneNode: any): number => {
  if (!emaneNode.emane_configs || !Array.isArray(emaneNode.emane_configs)) {
    return COMMUNICATION_RANGE_RADIUS; // 使用默认值
  }

  let systemnoisefigure: number | null = null;
  let txpower: number | null = null;

  // 遍历emane配置查找systemnoisefigure和txpower参数
  for (const config of emaneNode.emane_configs) {
    if (config.config) {
      // 查找systemnoisefigure参数
      if (config.config.systemnoisefigure) {
        const value = config.config.systemnoisefigure.value;
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          systemnoisefigure = parsed;
        }
      }
      
      // 查找txpower参数
      if (config.config.txpower) {
        const value = config.config.txpower.value;
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          txpower = parsed;
        }
      }
    }
  }

  // 如果找到了两个参数，则使用公式计算
  if (systemnoisefigure !== null && txpower !== null) {
    try {
      const radius = (Math.pow(10, (txpower + 174 - systemnoisefigure - 60) / 20) / 98357.24)*500;
      // 确保半径在合理范围内（100米到50000米之间）
      return Math.max(100, Math.min(50000, radius));
    } catch (error) {
      console.error('计算通信范围半径时出错:', error);
      return COMMUNICATION_RANGE_RADIUS;
    }
  }

  // 如果没有找到参数或参数无效，使用默认值
  return COMMUNICATION_RANGE_RADIUS;
}; 

// 通信范围外观配置
const COMMUNICATION_RANGE_APPEARANCE = {
  mainColor: new Cesium.Color(0.0, 1.0, 0.8, 0.15),  // 微调透明度以保持可见性
  pulseColor: new Cesium.Color(0.0, 1.0, 0.8, 0.3), 
  gridColor: new Cesium.Color(0.0, 1.0, 0.8, 0.2),  
};

// 干扰波束配置
const INTERFERENCE_BEAM_CONFIG = {
  mainColor: new Cesium.Color(1.0, 0.05, 0.05, 0.25),  
  edgeColor: new Cesium.Color(1.0, 0.05, 0.05, 0.2),  
  
  maxRange: 5000000000.0, // 50公里，更合理的最大干扰范围 
  minRange: 60.0, 
  maxPower: 100.0, 
  minPower: 10.0, 
  segmentCount: 48, 
  
  // 接收功率阈值 dBm
  rxPowerThreshold: -110,
  // 默认频率 Hz (2.4 GHz)
  defaultFrequencyHz: 2.4e9,

  // 中心光晕效果配置
  centerGlowEffect: true, 
  centerGlowBaseSize: 25, // 从15增大到25
  centerGlowPulseSpeed: 1.5, 
  centerGlowAccentColor: new Cesium.Color(1.0, 0.1, 0.05, 0.3), 

  // 新增：从球心扩散的脉冲波效果配置
  emanatingPulseWaveEffect: true, 
  emanatingPulseWaveCount: 3,     
  emanatingPulseWaveColor: new Cesium.Color(1.0, 0.15, 0.15, 0.6), 
  emanatingPulseWavePeriod: 2.5, 
};

// 全局跟踪已创建的干扰实体ID，避免重复创建
const createdInterferenceEntities = new Set<string>();

/**
 * Cesium实体管理组合式函数
 * 负责将Pinia状态数据同步到Cesium实体
 */
export function useCesiumEntities(viewer: Cesium.Viewer | null) {
  // 获取Topo状态管理
  const topoStore = useTopoStore();
  const emaneStore = useEmaneStore();
  const nemIdStore = useNemIdStore();
  const interferenceStore = useInterferenceStore();

  
  // 实体映射表：nodeId -> Cesium.Entity
  const nodeEntities = ref<Map<number, Cesium.Entity>>(new Map());
  // 链路映射表：`${node1_id}-${node2_id}` -> Cesium.Entity
  const linkEntities = ref<Map<string, Cesium.Entity>>(new Map());
  const subnetAttachmentEntities = ref<Map<string, Cesium.Entity>>(new Map());
  // 干扰波束实体映射表: nodeId -> Cesium.Entity[]
  const interferenceBeamEntities = ref<Map<number, Cesium.Entity[]>>(new Map());

  // 当前显示通信范围的无人机实体
  const currentDroneWithRange = ref<Cesium.Entity | null>(null);
  // 当前显示干扰范围的节点实体
  const currentInterferenceWithBeam = ref<Cesium.Entity | null>(null);

  let selectedEntityChangedListener: Cesium.Event.RemoveCallback | undefined;
  let screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | undefined;
  let faultFlashTimer: number | null = null;
  let faultFlashVisible = false;

  // 添加获取节点数量的函数
  const getNodeCount = () => {
    return viewer?.entities.values.filter(entity => 
      entity.properties?.getValue()?.nodeType !== undefined
    ).length || 0;
  };

  // 切换渲染模式
  const toggleRenderingMode = () => {
    useSimpleRenderingMode.value = !useSimpleRenderingMode.value;
    // 切换渲染模式后需要重新同步节点以应用新的渲染模式
    syncNodesToEntities();
  };

  // 获取当前渲染模式状态
  const getRenderingMode = () => readonly(useSimpleRenderingMode);

  const linkLabelsVisible = ref(true);
  // 子网实体是否被隐藏（仿真运行时隐藏子网节点和连线）
  const subnetEntitiesHidden = ref(false);

  const parseLinkEntityId = (linkId: string): { node1Id: number; node2Id: number; isSubnet: boolean } | null => {
    const subnetMatch = linkId.match(/^subnet-\d+-link-(\d+)-(\d+)$/);
    if (subnetMatch) {
      return {
        node1Id: Number(subnetMatch[1]),
        node2Id: Number(subnetMatch[2]),
        isSubnet: true
      };
    }

    const regularMatch = linkId.match(/^link-(\d+)-(\d+)$/);
    if (regularMatch) {
      return {
        node1Id: Number(regularMatch[1]),
        node2Id: Number(regularMatch[2]),
        isSubnet: false
      };
    }

    return null;
  };

  const resolveLinkIdFromLabelEntity = (entityId: string, node1Id: number, node2Id: number) => {
    if (entityId.startsWith('label-subnet-') || entityId.startsWith('label-link-')) {
      return entityId.replace('label-', '');
    }
    return `link-${node1Id}-${node2Id}`;
  };

  const isFaultedNode = (nodeId: number) => {
    return topoStore.topoData?.nodes?.some((node: Node) => node.id === nodeId && node.status === 'DOWN') || false;
  };

  const isFaultedLink = (node1Id: number, node2Id: number) => {
    return isFaultedNode(node1Id) || isFaultedNode(node2Id);
  };

  const getRegularLink = (node1Id: number, node2Id: number) => {
    return topoStore.topoData?.links?.find((link: Link) => {
      return (link.node1_id === node1Id && link.node2_id === node2Id) ||
        (link.node1_id === node2Id && link.node2_id === node1Id);
    });
  };

  const isDashLink = (linkId: string) => {
    const parsed = parseLinkEntityId(linkId);
    if (!parsed) {
      return false;
    }

    if (parsed.isSubnet) {
      return true;
    }

    return getRegularLink(parsed.node1Id, parsed.node2Id)?.type === 'WIRELESS';
  };

  const getBaseLinkColor = (linkId: string) => {
    const parsed = parseLinkEntityId(linkId);
    if (!parsed) {
      return Cesium.Color.WHITE;
    }

    if (parsed.isSubnet) {
      return SINR_COLORS.UNKNOWN;
    }

    const link = getRegularLink(parsed.node1Id, parsed.node2Id);
    if (link?.type === 'WIRED') {
      return WIRED_LINK_COLOR;
    }

    if (link?.type === 'WIRELESS') {
      return SINR_COLORS.UNKNOWN;
    }

    return Cesium.Color.WHITE;
  };

  const getRegularLinkLabelBackgroundColor = (linkType?: string) => {
    return linkType === 'WIRELESS' ? SINR_COLORS.UNKNOWN.withAlpha(0.5) : Cesium.Color.fromCssColorString('#1976d2').withAlpha(0.8);
  };

  const getRegularLinkIpLabelBackgroundColor = (linkType?: string) => {
    return linkType === 'WIRELESS' ? SINR_COLORS.UNKNOWN.withAlpha(0.7) : Cesium.Color.fromCssColorString('#1976d2').withAlpha(0.8);
  };

  const parseIpLabelEntityId = (entityId: string) => {
    const regularIpMatch = entityId.match(/^ip-label-(\d+)-(\d+)$/);
    if (regularIpMatch) {
      return {
        isSubnet: false,
        node1Id: Number(regularIpMatch[1]),
        node2Id: Number(regularIpMatch[2])
      };
    }

    const subnetIpMatch = entityId.match(/^ip-label-subnet-(\d+)-(\d+)$/);
    if (subnetIpMatch) {
      return {
        isSubnet: true,
        node1Id: Number(subnetIpMatch[1]),
        node2Id: Number(subnetIpMatch[2])
      };
    }

    return null;
  };

  const setLinkEntityColor = (linkId: string, color: Cesium.Color) => {
    if (!viewer) {
      return;
    }

    const linkEntity = linkEntities.value.get(linkId);
    if (!linkEntity?.polyline) {
      return;
    }

    const currentMaterial = linkEntity.polyline.material as any;
    const currentColor = currentMaterial?.color?.getValue ?
      currentMaterial.color.getValue(viewer.clock.currentTime) :
      currentMaterial?.color;

    if (currentColor?.toCssColorString && currentColor.toCssColorString() === color.toCssColorString()) {
      return;
    }

    linkEntity.polyline.material = isDashLink(linkId) ?
      new Cesium.PolylineDashMaterialProperty({
        color,
        dashLength: 16.0
      }) :
      new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color,
        taperPower: 0.2
      });
  };

  const setLabelVisibility = (entity: Cesium.Entity | undefined, visible: boolean) => {
    if (entity?.label) {
      entity.label.show = new Cesium.ConstantProperty(visible);
    }
  };

  const applyLinkLabelVisibility = (linkId: string, visible: boolean) => {
    if (!viewer) {
      return;
    }

    const parsed = parseLinkEntityId(linkId);
    if (!parsed) {
      return;
    }

    setLabelVisibility(viewer.entities.getById(`label-${linkId}`), visible);

    const ipLabelIds = parsed.isSubnet ? [
      `ip-label-subnet-${parsed.node1Id}-${parsed.node2Id}`,
      `ip-label-subnet-${parsed.node2Id}-${parsed.node1Id}`
    ] : [
      `ip-label-${parsed.node1Id}-${parsed.node2Id}`,
      `ip-label-${parsed.node2Id}-${parsed.node1Id}`
    ];

    ipLabelIds.forEach((ipLabelId) => {
      setLabelVisibility(viewer.entities.getById(ipLabelId), visible);
    });
  };

  const refreshFaultedLinkStyles = () => {
    if (!viewer) {
      return;
    }

    linkEntities.value.forEach((linkEntity, linkId) => {
      const parsed = parseLinkEntityId(linkId);
      if (!parsed) {
        return;
      }

      const faulted = isFaultedLink(parsed.node1Id, parsed.node2Id);
      if (faulted) {
        setLinkEntityColor(linkId, FAULT_LINK_COLOR);
        applyLinkLabelVisibility(linkId, false);
      } else {
        // 仅恢复之前处于故障状态（红色）的链路颜色为默认色，
        // 不覆盖已由 updateLinkLabels 根据 SINR 着色的链路，防止移动节点时闪烁
        if (linkEntity.polyline) {
          const currentMaterial = linkEntity.polyline.material as any;
          const currentColor = currentMaterial?.color?.getValue ?
            currentMaterial.color.getValue(viewer.clock.currentTime) :
            currentMaterial?.color;
          if (currentColor?.toCssColorString &&
              currentColor.toCssColorString() === FAULT_LINK_COLOR.toCssColorString()) {
            setLinkEntityColor(linkId, getBaseLinkColor(linkId));
          }
        }
        applyLinkLabelVisibility(linkId, linkLabelsVisible.value);
      }
    });
  };

  const applyFaultVisualState = (entity: Cesium.Entity, nodeId: number, flashVisible: boolean) => {
    const entityAny = entity as any;
    const faulted = isFaultedNode(nodeId);

    if (entity.model) {
      const defaultModelColor = entityAny._defaultModelColor || Cesium.Color.WHITE;

      entity.model.color = new Cesium.ConstantProperty(
        faulted && flashVisible ? FAULT_FLASH_COLOR.withAlpha(0.95) : defaultModelColor
      );
      entity.model.colorBlendMode = new Cesium.ConstantProperty(Cesium.ColorBlendMode.MIX);
      entity.model.colorBlendAmount = new Cesium.ConstantProperty(faulted && flashVisible ? 0.85 : 0.0);
    }

    if (entity.billboard) {
      const defaultBillboardColor = entityAny._defaultBillboardColor || Cesium.Color.WHITE;
      entity.billboard.color = new Cesium.ConstantProperty(
        faulted && flashVisible ? FAULT_FLASH_COLOR.withAlpha(0.85) : defaultBillboardColor
      );
    }

    if (entity.point) {
      const defaultPointColor = entityAny._defaultPointColor || Cesium.Color.WHITE;
      const defaultPointOutlineColor = entityAny._defaultPointOutlineColor || Cesium.Color.BLACK;

      entity.point.color = new Cesium.ConstantProperty(
        faulted && flashVisible ? FAULT_FLASH_COLOR : defaultPointColor
      );
      entity.point.outlineColor = new Cesium.ConstantProperty(
        faulted && flashVisible ? FAULT_FLASH_COLOR : defaultPointOutlineColor
      );
    }
  };

  const bindFaultVisualEffect = (entity: Cesium.Entity, nodeId: number) => {
    const entityAny = entity as any;
    const currentTime = viewer?.clock?.currentTime;

    if (entity.model && !entityAny._faultModelEffectBound) {
      entityAny._defaultModelColor = entity.model.color?.getValue?.(currentTime) || Cesium.Color.WHITE;
      entityAny._defaultSilhouetteColor = entity.model.silhouetteColor?.getValue?.(currentTime) || Cesium.Color.WHITE;
      entityAny._defaultSilhouetteSize = entity.model.silhouetteSize?.getValue?.(currentTime) || 3.0;

      entityAny._faultModelEffectBound = true;
    }

    if (entity.billboard && !entityAny._faultBillboardEffectBound) {
      entityAny._defaultBillboardColor = entity.billboard.color?.getValue?.(currentTime) || Cesium.Color.WHITE;
      entityAny._faultBillboardEffectBound = true;
    }

    if (entity.point && !entityAny._faultPointEffectBound) {
      entityAny._defaultPointColor = entity.point.color?.getValue?.(currentTime) || Cesium.Color.WHITE;
      entityAny._defaultPointOutlineColor = entity.point.outlineColor?.getValue?.(currentTime) || Cesium.Color.BLACK;

      entityAny._faultPointEffectBound = true;
    }

    applyFaultVisualState(entity, nodeId, faultFlashVisible);
  };

  const stopFaultFlashLoop = () => {
    if (faultFlashTimer !== null) {
      clearInterval(faultFlashTimer);
      faultFlashTimer = null;
    }
  };

  const refreshFaultedNodeVisuals = () => {
    if (!viewer || viewer.isDestroyed()) {
      stopFaultFlashLoop();
      return;
    }

    nodeEntities.value.forEach((entity, nodeId) => {
      bindFaultVisualEffect(entity, nodeId);
    });

    viewer.scene.requestRender();
  };

  const ensureFaultFlashLoop = () => {
    if (!viewer || viewer.isDestroyed()) {
      stopFaultFlashLoop();
      return;
    }

    const hasFaultedNodes = topoStore.topoData?.nodes?.some((node: Node) => node.status === 'DOWN') || false;

    if (!hasFaultedNodes) {
      faultFlashVisible = false;
      refreshFaultedNodeVisuals();
      stopFaultFlashLoop();
      return;
    }

    if (faultFlashTimer !== null) {
      return;
    }

    faultFlashVisible = true;
    refreshFaultedNodeVisuals();

    faultFlashTimer = window.setInterval(() => {
      if (!viewer || viewer.isDestroyed()) {
        stopFaultFlashLoop();
        return;
      }

      const stillHasFaultedNodes = topoStore.topoData?.nodes?.some((node: Node) => node.status === 'DOWN') || false;
      if (!stillHasFaultedNodes) {
        faultFlashVisible = false;
        refreshFaultedNodeVisuals();
        stopFaultFlashLoop();
        return;
      }

      faultFlashVisible = !faultFlashVisible;
      refreshFaultedNodeVisuals();
    }, FAULT_FLASH_INTERVAL_SECONDS * 1000);
  };

  // 清除所有实体
  const clearAllEntities = () => {
    if (!viewer) return;

    stopFaultFlashLoop();
    
    // 如果有无人机正在显示范围，清除它
    if (currentDroneWithRange.value) {
      // 找到并移除对应的范围实体
      const entityId = currentDroneWithRange.value.id;
      const rangeEntityId = `range-${entityId}`;
      const rangeEntity = viewer.entities.getById(rangeEntityId);
      if (rangeEntity) {
        viewer.entities.remove(rangeEntity);
      }
      currentDroneWithRange.value = null;
    }
    
    // 如果有干扰节点正在显示波束，清除它
    if (currentInterferenceWithBeam.value) {
      const nodeId = Number(currentInterferenceWithBeam.value.id);

      // 使用通用函数清理资源
      cleanupInterferenceBeamResources(nodeId);
    }

    // 清除所有干扰波束实体
    interferenceBeamEntities.value.forEach((entities, nodeId) => {
      cleanupInterferenceBeamResources(nodeId);
    });
    interferenceBeamEntities.value.clear();

    // 清除所有通信范围实体（以"range-"开头的实体ID）
    const rangeEntitiesToRemove = [];
    for (let i = 0; i < viewer.entities.values.length; i++) {
      const entity = viewer.entities.values[i];
      if (entity.id && typeof entity.id === 'string' && entity.id.startsWith('range-')) {
        rangeEntitiesToRemove.push(entity);
      }
    }
    rangeEntitiesToRemove.forEach(entity => {
      viewer.entities.remove(entity);
    });
    
    // 清除所有链路数据标签实体（包括IP标签和链路数据标签）
    const linkLabelEntitiesToRemove = [];
    for (let i = 0; i < viewer.entities.values.length; i++) {
      const entity = viewer.entities.values[i];
      if (entity.id && typeof entity.id === 'string') {
        // 清除所有类型的链路相关标签
        if (entity.id.startsWith('ip-label-') || // IP标签
            entity.id.startsWith('label-link-') || // 链路数据标签
            entity.id.startsWith('label-subnet-') || // 子网链路数据标签
            (entity.id.includes('-ip-') && entity.id.includes('label')) || // 备用IP标签模式
            (entity.properties && entity.properties.isLinkDataLabel && entity.properties.isLinkDataLabel.getValue()) // 通过属性识别的链路数据标签
           ) {
          linkLabelEntitiesToRemove.push(entity);
        }
      }
    };
    linkLabelEntitiesToRemove.forEach(entity => {
      viewer.entities.remove(entity);
    });
    if (linkLabelEntitiesToRemove.length > 0) {
    }
        
    // 移除所有现有节点实体
    nodeEntities.value.forEach(entity => {
      viewer.entities.remove(entity);
    });

    // 移除所有现有链路实体
    linkEntities.value.forEach(entity => {
      viewer.entities.remove(entity);
    });

    subnetAttachmentEntities.value.forEach(entity => {
      viewer.entities.remove(entity);
    });

    // 移除所有子网内部虚线连接
    const entitiesToRemove = [];
    for (let i = 0; i < viewer.entities.values.length; i++) {
      const entity = viewer.entities.values[i];
      if (entity.id && entity.id.toString().startsWith('subnet-')) {
        entitiesToRemove.push(entity);
      }
    }
    
    entitiesToRemove.forEach(entity => {
      viewer.entities.remove(entity);
    });

    // 清空映射表
    nodeEntities.value.clear();
    linkEntities.value.clear();
    subnetAttachmentEntities.value.clear();

    // 移除所有现有实体 (作为最后保障)
    viewer.entities.removeAll();
  };

  const ensureNodeLabelVisible = (label: Cesium.LabelGraphics | undefined) => {
    if (!label) return;

    label.disableDepthTestDistance = new Cesium.ConstantProperty(Number.POSITIVE_INFINITY);
  };

  // 创建节点实体
  const createNodeEntity = (node: Node): Cesium.Entity | undefined => {
    if (!viewer) return undefined;

    // 获取当前用户角色
    const userInfo = getUserInfo();
    const userRole = userInfo.role; // white, red, blue
    const userMode = userInfo.mode; // normal, attack-defense

    // 检查节点可见性
    const nodeRole = node.role; // 1-WHITE, 2-RED, 3-BLUE, 0-UNKNOWN (默认)

    // 判断用户是否可以查看该节点
    const isNodeVisible =
      userMode === 'normal' || // 普通模式可以查看所有节点
      userRole === 'white' || // 白方可以查看所有节点
      nodeRole === null || // 未定义角色的节点对所有人可见
      nodeRole === 'WHITE' || // WHITE角色的节点对所有人可见
      nodeRole === 'UNKNOWN' || // ALL角色的节点对所有人可见
      (userRole === 'red' && nodeRole === 'RED') || // 红方可以查看红方节点
      (userRole === 'blue' && nodeRole === 'BLUE'); // 蓝方可以查看蓝方节点
    
    if (!isNodeVisible) {
      return undefined;
    }

    const position = Cesium.Cartesian3.fromDegrees(
      node.geo.lon,
      node.geo.lat,
      node.geo.alt
    );

    const isEmaneNode = node.type === 'EMANENODE';
    
    // 根据节点角色设置标签颜色
    let labelColor;
    
    if (nodeRole === 'RED') {
      // 红方节点 - 深红
      labelColor = Cesium.Color.fromCssColorString('#C62828');
    } else if (nodeRole === 'BLUE') {
      // 蓝方节点 - 深蓝
      labelColor = Cesium.Color.fromCssColorString('#1565C0');
    } else {
      // 公共节点或默认 - 深色，白色背景上清晰可见
      labelColor = isEmaneNode ? Cesium.Color.fromCssColorString('#E65100') : Cesium.Color.fromCssColorString('#1A237E');
    }

    // 使用全局渲染模式状态替换节点数量判断
    const useSimplePoint = useSimpleRenderingMode.value;

    // 根据节点类型创建不同的实体
    let entity: Cesium.Entity | undefined;
    
    switch (node.type) {
      case 'DRONE':
      case 'DEFAULT':
      case 'VMNODE':
      case 'DOCKER':
      case 'SWITCH':
      case 'EMANE':
      case 'BASESTATION':
      case 'INODE':
      case 'RJ45':
        if (useSimplePoint) {
          // 使用点来表示节点 - 为不同类型的节点使用不同的颜色和大小
          let pointColor = Cesium.Color.WHITE;
          let pointSize = 10;
          
          switch (node.type) {
            case 'EMANE':
              pointColor = Cesium.Color.YELLOW;
              pointSize = 12;
              break;
            case 'DRONE':
              pointColor = Cesium.Color.CYAN;
              pointSize = 12;
              break;
            case 'INODE':
              pointColor = Cesium.Color.RED;
              pointSize = 12;
              break;
            case 'BASESTATION':
              pointColor = Cesium.Color.LIGHTSKYBLUE;
              pointSize = 14;
              break;
            case 'VMNODE':
              pointColor = Cesium.Color.LIGHTGREEN;
              pointSize = 12;
              break;
            case 'RJ45':
              pointColor = Cesium.Color.SKYBLUE;
              pointSize = 12;
              break;
            default:
              pointColor = Cesium.Color.WHITE;
              pointSize = 10;
          }
          
          entity = viewer.entities.add({
            id: String(node.id),
            name: node.name,
            position: position,
            point: {
              pixelSize: pointSize,
              color: pointColor,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.NONE
            },
            label: {
              text: node.server ? `${node.alias}（${node.server}）` : node.alias,
              font: '500 22px Microsoft YaHei, Arial, sans-serif',
              fillColor: labelColor,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -20),
              eyeOffset: new Cesium.Cartesian3(0, 0, -100),
              heightReference: Cesium.HeightReference.NONE,
              scale: 1.0,
              scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
            },
            properties: {
              isEmaneNode: isEmaneNode,
              subnetId: isEmaneNode ? node.id : undefined,
              nodeType: node.type
            }
          });
        } else {
          if (node.name.includes('DRONE')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, 0)
              ),
              model: {
                uri: '/models/uav.glb',
                minimumPixelSize: 64,
                maximumScale: 128,
                scale: 0.25,
                runAnimations: false,
                silhouetteColor: Cesium.Color.SKYBLUE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if (node.name.includes('VAN')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/CAR.png',
                width:95,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.name.includes('SATELLITE')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, 0)
              ),
              model: {
                uri: '/models/satellite.glb',
                minimumPixelSize: 64,
                maximumScale: 800,
                scale: 5.0,
                runAnimations: false,
                silhouetteColor: Cesium.Color.SKYBLUE,
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.type === 'RJ45') {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/电脑.png',
                width:110,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.type === 'DEFAULT') {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              model: {
                uri: '/models/router.glb',
                minimumPixelSize: 64,
                maximumScale: 1800,
                scale: 2.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if (node.type === 'VMNODE') {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/vmnode.glb',
              //   minimumPixelSize: 100,
              //   maximumScale: 5000,
              //   scale: 50.0,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/VMNODE.png',
                width:100,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if(node.name.includes('ATTACK_MACHINE')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/攻击机.png',
                width: 90,
                height: 70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('TMV')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/电脑2.png',
                width:100,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes( 'BUSINESS_Transmitter')){
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/电脑2.png',
                width:100,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('HTTP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, Cesium.Math.toRadians(45))
              ),
              model: {
                uri: '/models/http.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 100.0,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('FTP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, Cesium.Math.toRadians(45))
              ),
              model: {
                uri: '/models/ftp.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 100.0,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('DNS')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, Cesium.Math.toRadians(45))
              ),
              model: {
                uri: '/models/dns.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 125.0,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('SMTP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 90, Cesium.Math.toRadians(-180))
              ),
              model: {
                uri: '/models/smtp.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias ,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('VoIP_SIP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, Cesium.Math.toRadians(45))
              ),
              model: {
                uri: '/models/voip.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 125.0,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('DDS')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(0), -135, Cesium.Math.toRadians(-90))
              ),
              model: {
                uri: '/models/dds.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('SSH')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(0), -135, Cesium.Math.toRadians(-90))
              ),
              model: {
                uri: '/models/ssh.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('CoAP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(0), -135, Cesium.Math.toRadians(-90))
              ),
              model: {
                uri: '/models/coap.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('MQTT')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(0), 90, Cesium.Math.toRadians(-90))
              ),
              model: {
                uri: '/models/mqtt.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('RTSP_RTP')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/服务器.png',
                width: 70,
                height: 100,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('SECURITY_MACHINE')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/攻击机.png',
                width: 90,
                height: 70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.name.includes('TLS')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/攻击机.png',
                width: 90,
                height: 70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }
          else if(node.name.includes('PKI')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              billboard:{
                image:'/icons/攻击机.png',
                width: 90,
                height: 70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.name.includes('Ovs_SWITCH')){
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/switch.glb',
              //   minimumPixelSize: 64,
              //   maximumScale: 120,
              //   scale: 0.1,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/Switch.svg',
                width:50,
                height:50,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if(node.name.includes('SDN_CONTROLLER')){
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              orientation: Cesium.Transforms.headingPitchRollQuaternion(
                position,
                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)
              ),
              model: {
                uri: '/models/SDN_Controler.glb',
                minimumPixelSize: 100,
                maximumScale: 10000,
                scale: 12.5,
                runAnimations: false,
                silhouetteColor: Cesium.Color.WHITE, 
                silhouetteSize: 3.0
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.name.includes('ROUTER')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/router.glb',
              //   minimumPixelSize: 64,
              //   maximumScale: 9000,
              //   scale: 0.25,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/路由器.svg',
                width:50,
                height:60,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } 
          else if (node.name.includes('P4')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/switch.glb',
              //   minimumPixelSize: 64,
              //   maximumScale: 120,
              //   scale: 0.1,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE,
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/Switch.svg',
                width:50,
                height:50,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          }else if (node.name.includes('SR')) {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/switch.glb',
              //   minimumPixelSize: 64,
              //   maximumScale: 120,
              //   scale: 0.1,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/Switch.svg',
                width:50,
                height:50,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if (node.type === 'SWITCH') {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/switch.glb',
              //   minimumPixelSize: 64,
              //   maximumScale: 120,
              //   scale: 0.1,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/Switch.svg',
                width:50,
                height:50,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if (node.type === 'EMANE') {
            const colorIndex = node.id % SUBNET_COLORS.length;
            let subnetColor = SUBNET_COLORS[colorIndex];
            
            // 根据子网角色设置标签颜色
            if (nodeRole === 'RED') {
              subnetColor = Cesium.Color.fromCssColorString('#C62828');
            } else if (nodeRole === 'BLUE') {
              subnetColor = Cesium.Color.fromCssColorString('#1565C0');
            }
            // 如果是WHITE或未设置，保持原有的子网颜色
            
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/emane.glb', 
              //   minimumPixelSize: 48,
              //   maximumScale: 64,
              //   scale: 0.15,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/云.png',
                width:50,
                height:40,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: subnetColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined,
                nodeType: node.type
              }
            });
          } else if (node.type === 'BASESTATION') {
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/basestation.glb',
              //   minimumPixelSize: 250,
              //   maximumScale: 5000,
              //   scale: 0.125,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.LIGHTSKYBLUE,
              //   silhouetteSize: 4
              // },
              billboard:{
                image: '/icons/station.png',
                width:50,
                height:100,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isEmaneNode: isEmaneNode,
                subnetId: isEmaneNode ? node.id : undefined
              }
            });
          } else if (node.type === 'INODE') {
            // 干扰节点始终保持红色标签，不受角色影响
            entity = viewer.entities.add({
              id: String(node.id),
              name: node.name,
              position: position,
              // model: {
              //   uri: '/models/inode.glb',
              //   minimumPixelSize: 100,
              //   maximumScale: 8000,
              //   scale: 30,
              //   runAnimations: false,
              //   silhouetteColor: Cesium.Color.WHITE, 
              //   silhouetteSize: 3.0
              // },
              billboard:{
                image:'/icons/UAV.png',
                width:100,
                height:70,
                heightReference: Cesium.HeightReference.NONE
              },
              label: {
                text: node.server ? `${node.alias}（${node.server}）` : node.alias ,
                font: '500 22px Microsoft YaHei, Arial, sans-serif',
                fillColor: labelColor,
                outlineColor: Cesium.Color.TRANSPARENT,
                outlineWidth: 0,
                style: Cesium.LabelStyle.FILL,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -50),
                eyeOffset: new Cesium.Cartesian3(0, 0, -100),
                heightReference: Cesium.HeightReference.NONE,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
              },
              properties: {
                isInterferenceNode: true,
                nodeType: node.type,
                isShowingBeam: false
              }
            });
          }
        }
        break;

      default:
        // 通用设备 - 使用点或模型表示
        if (useSimplePoint) {
          entity = viewer.entities.add({
            id: String(node.id),
            name: node.name,
            position: position,
            point: {
              pixelSize: 10,
              color: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.NONE
            },
            label: {
              text: node.alias,
              font: '500 22px Microsoft YaHei, Arial, sans-serif',
              fillColor: labelColor,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -20),
              eyeOffset: new Cesium.Cartesian3(0, 0, -100),
              heightReference: Cesium.HeightReference.NONE,
              scale: 1.0,
              scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
            },
            properties: {
              isEmaneNode: isEmaneNode,
              subnetId: isEmaneNode ? node.id : undefined,
              nodeType: node.type
            }
          });
        } else {
          entity = viewer.entities.add({
            id: String(node.id),
            name: node.name,
            position: position,
            model: {
              uri: '/models/uav1.glb',
              minimumPixelSize: 96,
              maximumScale: 18000,
              scale: 15.0,
              runAnimations: false,
              silhouetteColor: Cesium.Color.WHITE, 
              silhouetteSize: 3.0
            },
            label: {
              text: node.server ? `${node.alias || node.name}（${node.server}）` : (node.alias || node.name),
              font: '500 22px Microsoft YaHei, Arial, sans-serif',
              fillColor: labelColor,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -50),
              eyeOffset: new Cesium.Cartesian3(0, 0, -100),
              heightReference: Cesium.HeightReference.NONE,
              scale: 1.0,
              scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.8)
            },
            properties: {
              isEmaneNode: isEmaneNode,
              subnetId: isEmaneNode ? node.id : undefined,
              nodeType: node.type
            }
          });
        }
    }

    // 将实体保存到映射表中
    if (entity) {
      ensureNodeLabelVisible(entity.label as Cesium.LabelGraphics | undefined);
      bindFaultVisualEffect(entity, node.id);
      ensureFaultFlashLoop();

      nodeEntities.value.set(node.id, entity);
      return entity;
    } else {
      console.warn('实体创建失败');
      return undefined;
    }
  };

  // 创建链路两端的IP地址标签
  const createLinkEndpointLabels = (
    link: Link,
    node1Entity: Cesium.Entity,
    node2Entity: Cesium.Entity,
    node1: Node,
    node2: Node
  ) => {
    if (!viewer) return;

    const ipLabelBackgroundColor = getRegularLinkIpLabelBackgroundColor(link.type);
    const ipLabelBgBase = link.type === 'WIRELESS' ? SINR_COLORS.UNKNOWN : Cesium.Color.fromCssColorString('#1976d2');
    const ipLabelTextColor = getLabelTextColor(ipLabelBgBase);


    // 节点1的IP地址标签
    if (link.iface1 && (link.iface1.ip4 || link.iface1.ip6)) {
      const node1IpLabelId = `ip-label-${link.node1_id}-${link.node2_id}`;
      // 检查标签是否已存在，如果存在则移除
      const existingLabel1 = viewer.entities.getById(node1IpLabelId);
      if (existingLabel1) {
        viewer.entities.remove(existingLabel1);
      }
      
      // 构建IP地址文本，接口名称只添加一次
      let ipText = '';
      if(node1.type != 'RJ45'){
      if (link.iface1.name) {
        ipText += `${link.iface1.name}:\n`;
      }
      if (link.iface1.ip4 ) {
        ipText += `${link.iface1.ip4}/${link.iface1.ip4_mask}`;
      }
      if (link.iface1.ip6 ) {
        if (link.iface1.ip4) ipText += '\n';
        ipText += `${link.iface1.ip6}/${link.iface1.ip6_mask}`;
      }
    }
      const ipLabel1Entity = viewer.entities.add({
        id: node1IpLabelId,
        position: new Cesium.CallbackProperty(() => {
          const currentTime = viewer.clock.currentTime;
          const pos1 = node1Entity.position?.getValue(currentTime);
          const pos2 = node2Entity.position?.getValue(currentTime);
          if (pos1 && pos2) {
            // 计算从pos1到pos2的方向向量
            const direction = Cesium.Cartesian3.subtract(pos2, pos1, new Cesium.Cartesian3());

            // 计算链路总长度
            const distance = Cesium.Cartesian3.magnitude(direction);

            // 避免距离为0的情况
            if (distance < 1.0) {
              return pos1; // 如果两点距离过近，直接返回节点1位置
            }

            // 归一化方向向量
            Cesium.Cartesian3.normalize(direction, direction);

            // 使用链路长度的1/4作为标签位置
            const labelDistance = distance * 0.25; // 链路长度的1/4
            const labelPos = Cesium.Cartesian3.multiplyByScalar(direction, labelDistance, new Cesium.Cartesian3());
            return Cesium.Cartesian3.add(pos1, labelPos, new Cesium.Cartesian3());
          }
          return undefined;
        }, false) as unknown as Cesium.PositionProperty,
        label: {
          text: ipText,
          font: '500 18px Microsoft YaHei, Arial, sans-serif',
          style: Cesium.LabelStyle.FILL,
          outlineWidth: 0,
          fillColor: ipLabelTextColor,
          backgroundColor: ipLabelBackgroundColor,
          backgroundPadding: new Cesium.Cartesian2(10, 8),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 0,
          scale: 1.0,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 3000, 0.7)
        }
      });

    }

    // 节点2的IP地址标签
    if (link.iface2 && (link.iface2.ip4 || link.iface2.ip6)) {
      const node2IpLabelId = `ip-label-${link.node2_id}-${link.node1_id}`;
      // 检查标签是否已存在，如果存在则移除
      const existingLabel2 = viewer.entities.getById(node2IpLabelId);
      if (existingLabel2) {
        viewer.entities.remove(existingLabel2);
      }
      
      // 构建IP地址文本，接口名称只添加一次
      let ipText = '';
      if(node2.type!='RJ45'){
        if (link.iface2.name) {
        ipText += `${link.iface2.name}:\n`;
      }
      if (link.iface2.ip4) {
        ipText += `${link.iface2.ip4}/${link.iface2.ip4_mask}`;
      }
      if (link.iface2.ip6) {
        if (link.iface2.ip4) ipText += '\n';
        ipText += `${link.iface2.ip6}/${link.iface2.ip6_mask}`;
      }
      }
      
      viewer.entities.add({
        id: node2IpLabelId,
        position: new Cesium.CallbackProperty(() => {
          const currentTime = viewer.clock.currentTime;
          const pos1 = node1Entity.position?.getValue(currentTime);
          const pos2 = node2Entity.position?.getValue(currentTime);
          if (pos1 && pos2) {
            // 计算从pos2到pos1的方向向量
            const direction = Cesium.Cartesian3.subtract(pos1, pos2, new Cesium.Cartesian3());

            // 计算链路总长度
            const distance = Cesium.Cartesian3.magnitude(direction);

            // 避免距离为0的情况
            if (distance < 1.0) {
              return pos2; // 如果两点距离过近，直接返回节点2位置
            }

            // 归一化方向向量
            Cesium.Cartesian3.normalize(direction, direction);

            // 使用链路长度的1/4作为标签位置
            const labelDistance = distance * 0.25; // 链路长度的1/4
            const labelPos = Cesium.Cartesian3.multiplyByScalar(direction, labelDistance, new Cesium.Cartesian3());
            return Cesium.Cartesian3.add(pos2, labelPos, new Cesium.Cartesian3());
          }
          return undefined;
        }, false) as unknown as Cesium.PositionProperty,
        label: {
          text: ipText,
          font: '500 18px Microsoft YaHei, Arial, sans-serif',
          style: Cesium.LabelStyle.FILL,
          outlineWidth: 0,
          fillColor: ipLabelTextColor,
          backgroundColor: ipLabelBackgroundColor,
          backgroundPadding: new Cesium.Cartesian2(10, 8),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 0,
          scale: 1.0,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 3000, 0.7)
        }
      });

    }

  };

  // 创建链路实体
  const createLinkEntity = (link: Link): Cesium.Entity | undefined => {
    if (!viewer) {
      console.warn('无法创建链路实体: Cesium Viewer不存在');
      return;
    }

    try {
      // 检查topoData和nodes数组是否存在
      if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
        console.warn('无法创建链路实体: 拓扑数据不完整');
        return;
      }

      // 获取两个节点实体
      const node1Entity = nodeEntities.value.get(link.node1_id);
      const node2Entity = nodeEntities.value.get(link.node2_id);

      if (!node1Entity || !node2Entity) {
        console.warn(`无法创建链路实体: 节点实体 ${link.node1_id} 或 ${link.node2_id} 不存在`);
        return;
      }

      // 获取节点信息
      const node1 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node1_id);
      const node2 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node2_id);

      if (!node1 || !node2) {
        console.warn('无法创建链路实体: 节点数据不存在');
        return;
      }

      // 检查链路是否连接了Emane节点和设备节点，如果是则不渲染链路
      if ((node1.type === 'EMANE' && node2.type !== 'EMANE') || 
          (node2.type === 'EMANE' && node1.type !== 'EMANE')) {
        return;
      }

      // 生成唯一的链路ID
      const linkId = `link-${link.node1_id}-${link.node2_id}`;

      // 检查实体是否已存在
      const existingEntity = viewer.entities.getById(linkId);
      if (existingEntity) {
        // 如果实体已存在，则不重新创建
        return existingEntity;
      }

      // 根据链路类型设置不同的样式
      let color;
      let width = 3; // 从2增大到3

      switch (link.type) {
        case 'WIRED':
          color = Cesium.Color.fromCssColorString('#00eaff');
          width = 3; // 从2增大到3
          break;
        case 'WIRELESS':
          // 无线链路初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
          color = SINR_COLORS.UNKNOWN;
          width = 3; // 从2增大到3
          break;
        default:
          color = Cesium.Color.WHITE;
          width = 2; // 从1增大到2
      }

      // 创建链路实体
      const entity = viewer.entities.add({
        id: linkId,
        name: `链路 ${node1.name}-${node2.name}`,
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const currentTime = viewer.clock.currentTime;
            const pos1 = node1Entity.position?.getValue(currentTime);
            const pos2 = node2Entity.position?.getValue(currentTime);
            if (pos1 && pos2) {
              return [pos1, pos2];
            }
            return [];
          }, false),
          width: width,
          material: link.type === 'WIRELESS' ?
            new Cesium.PolylineDashMaterialProperty({
              color: color,
              dashLength: 16.0
            }) :
            new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: color,
              taperPower: 0.2
            }),
          clampToGround: false
        }
      });

      // 将实体保存到映射表中
      if (entity) {
        linkEntities.value.set(linkId, entity);

        // 为无线链路创建数据标签
        if (link.type === 'WIRELESS') {
          const linkLabelId = `label-${linkId}`;
          
          // 检查标签是否已存在
          const existingLabel = viewer.entities.getById(linkLabelId);
          if (existingLabel) {
            viewer.entities.remove(existingLabel);
          }
          
          // 从节点中获取模型类型
          let model = "unknown";
          if (node1.type === 'EMANE' && node1.emane) {
            // 从emane属性中提取模型类型，例如"emane_rfpipe"提取为"rfpipe"
            const match = node1.emane.match(/emane_(.+)/);
            if (match && match[1]) {
              model = match[1];
            }
          } else if (node2.type === 'EMANE' && node2.emane) {
            const match = node2.emane.match(/emane_(.+)/);
            if (match && match[1]) {
              model = match[1];
            }
          }
          
          viewer.entities.add({
            id: linkLabelId,
            position: new Cesium.CallbackProperty(() => {
              const currentTime = viewer.clock.currentTime;
              const pos1 = node1Entity.position?.getValue(currentTime);
              const pos2 = node2Entity.position?.getValue(currentTime);
              if (pos1 && pos2) {
                const midPosition = Cesium.Cartesian3.midpoint(pos1, pos2, new Cesium.Cartesian3());
                const upVector = new Cesium.Cartesian3();
                Cesium.Cartesian3.normalize(midPosition, upVector);
                Cesium.Cartesian3.multiplyByScalar(upVector, 50, upVector); // 从30增加到50
                const labelPosition = new Cesium.Cartesian3();
                Cesium.Cartesian3.add(midPosition, upVector, labelPosition);
                return labelPosition;
              }
              return undefined;
            }, false) as unknown as Cesium.PositionProperty,
            properties: {
              isLinkDataLabel: true,
              node1Id: link.node1_id,
              node2Id: link.node2_id,
              node1Name: node1.alias || node1.name,
              node2Name: node2.alias || node2.name,
              model: model, // 添加模型类型属性
            },
            label: {
              text: "加载中...",
              font: '500 18px Microsoft YaHei, Arial, sans-serif',
              style: Cesium.LabelStyle.FILL,
              outlineWidth: 0,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              fillColor: getLabelTextColor(link.type === 'WIRELESS' ? SINR_COLORS.UNKNOWN : Cesium.Color.fromCssColorString('#1976d2')),
              outlineColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)'),
              // 无线链路标签初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
              backgroundColor: getRegularLinkLabelBackgroundColor(link.type),
              backgroundPadding: new Cesium.Cartesian2(10, 7),
              showBackground: true,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              disableDepthTestDistance: 0
            }
          });
        }
        
        createLinkEndpointLabels(link, node1Entity, node2Entity, node1, node2);


        return entity;
      } else {
        // console.warn('链路实体创建失败');
        return undefined;
      }
    } catch (error) {
      console.error('创建链路实体时出错:', error);
      return undefined;
    }
  };

  // 检查并刷新具有通信范围的无人机
  const refreshDroneWithRangeIfNeeded = () => {
    // 如果当前没有正在显示通信范围的无人机，则直接返回
    if (!currentDroneWithRange.value) {
      return;
    }

    const entityId = currentDroneWithRange.value.id;

    // 获取当前选中的实体
    const selectedEntity = viewer?.selectedEntity;
    
    // 如果当前选中的实体不是显示通信范围的无人机，则清除通信范围
    if (selectedEntity && selectedEntity.id !== entityId) {
      
      // 清除范围实体
      const rangeEntityId = `range-${entityId}`;
      const rangeEntity = viewer?.entities.getById(rangeEntityId);
      if (rangeEntity) {
        viewer?.entities.remove(rangeEntity);
      }
      
      // 清除引用
      if (currentDroneWithRange.value) {
        delete (currentDroneWithRange.value as any)._rangeEntity;
      }
      currentDroneWithRange.value = null;
      return;
    }

    // 获取无人机实体
    const droneEntity = viewer?.entities.getById(entityId);
    if (!droneEntity) {
      
      // 清除范围实体
      const rangeEntityId = `range-${entityId}`;
      const rangeEntity = viewer?.entities.getById(rangeEntityId);
      if (rangeEntity) {
        viewer?.entities.remove(rangeEntity);
      }
      
      currentDroneWithRange.value = null;
      return;
    }

    // 检查是否已存在范围实体
    const rangeEntityId = `range-${entityId}`;
    let rangeEntity = viewer?.entities.getById(rangeEntityId);
    
    // 如果范围实体不存在，重新创建
    if (!rangeEntity) {
      
      // 根据实体ID查找对应的节点数据
      const nodeId = Number(entityId);
      const nodeData = topoStore.topoData?.nodes?.find((node: any) => node.id === nodeId);
      
      // 计算通信范围半径
      const communicationRadius = nodeData ? calculateCommunicationRangeRadius(nodeData, topoStore) : COMMUNICATION_RANGE_RADIUS;
      
      // 创建动态材质
      const period = 2.0; // 动画周期（秒）
      
      // 使用回调函数计算当前偏移量
      const timeBasedOffset = new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
        if (!viewer || !viewer.clock || !viewer.clock.startTime || !time) return 0;
        const seconds = Cesium.JulianDate.secondsDifference(time, viewer.clock.startTime);
        return (seconds % period) / period;
      }, false);

      // 创建条纹材质
      const stripeMaterial = new Cesium.StripeMaterialProperty({
        evenColor: COMMUNICATION_RANGE_APPEARANCE.mainColor,
        oddColor: COMMUNICATION_RANGE_APPEARANCE.pulseColor,
        repeat: 4,
        orientation: Cesium.StripeOrientation.HORIZONTAL,
        offset: timeBasedOffset
      });

      // 创建新的范围实体，使用回调函数绑定到无人机位置
      rangeEntity = viewer?.entities.add({
        id: rangeEntityId,
        name: `${droneEntity.name || '无人机'} 通信范围`,
        position: new Cesium.CallbackProperty((time) => {
          // 每次请求位置时，直接获取无人机当前位置
          if (droneEntity && droneEntity.position) {
            return droneEntity.position.getValue(time);
          }
          return undefined;
        }, false) as unknown as Cesium.PositionProperty,
        ellipsoid: {
          radii: new Cesium.ConstantProperty(new Cesium.Cartesian3(
            communicationRadius,
            communicationRadius,
            communicationRadius
          )),
          material: stripeMaterial,
          outline: new Cesium.ConstantProperty(true),
          outlineColor: new Cesium.ConstantProperty(COMMUNICATION_RANGE_APPEARANCE.mainColor.withAlpha(0.4)),
          outlineWidth: new Cesium.ConstantProperty(1.0),
          slicePartitions: new Cesium.ConstantProperty(24),
          stackPartitions: new Cesium.ConstantProperty(24)
        }
      });
      
      if (rangeEntity) {
        // 保存引用关系
        (droneEntity as any)._rangeEntity = rangeEntity;
      }
    }
  };

  // 全量同步：每次都以topoData.nodes为唯一数据源
  const syncNodesToEntities = (forcePositionUpdate: boolean = false) => {
    if (!viewer) {
      console.warn('无法同步节点: Cesium Viewer为null');
      return;
    }
    
    // 获取当前存在的节点实体ID列表，用于后续比对
    const existingEntityIds = new Set<string>();
    nodeEntities.value.forEach(entity => {
      existingEntityIds.add(entity.id);
    });
    
    // 确保 topoData 和 nodes 数组存在
    if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
      // 如果无节点数据，清除所有实体
      clearAllEntities();
      return;
    }

    // 如果节点数组为空，清除所有实体并返回
    if (topoStore.topoData.nodes.length === 0) {
      clearAllEntities();
      return;
    }

    const nodes = topoStore.topoData.nodes;
    const currentNodeIds = new Set<string>();
    
    // 使用全局渲染模式状态替换节点数量判断
    const shouldUseSimplePoint = useSimpleRenderingMode.value;
    
    // 保存当前所有实体的位置 - 用于检测哪些已经通过移动更新过位置
    const entityPositions = new Map<string, {lat: number, lon: number, alt: number}>();
    
    // 处理所有节点，创建或更新实体
    nodes.forEach((node: Node) => {
      const nodeId = String(node.id);
      currentNodeIds.add(nodeId);
      
      // 检查实体是否已存在
      const existingEntity = viewer.entities.getById(nodeId);
      
      if (existingEntity) {
        const entityAny = existingEntity as any;
        
        // 如果实体正在由移动管理器更新，或者标记为移动状态，则跳过更新
        if (entityAny._updatingFromFlightManager || entityAny._isFlying) {
          // 只保留实体，不更新位置
          return;
        }
        
        // 检查当前实体渲染类型是否与期望渲染类型一致
        const isEntityUsingSimplePoint = existingEntity.point !== undefined;
        
        // 如果渲染类型不匹配(需要重新创建实体)：
        // 1. 从简单点切换到模型 (isEntityUsingSimplePoint为true, shouldUseSimplePoint为false)
        // 2. 从模型切换到简单点 (isEntityUsingSimplePoint为false, shouldUseSimplePoint为true)
        if (isEntityUsingSimplePoint !== shouldUseSimplePoint) {
          
          // 记录当前位置
          const position = existingEntity.position?.getValue(viewer.clock.currentTime);
          if (position) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            // 修改节点的地理位置信息为当前位置(确保重新创建后位置不变)
            node.geo = {
              lat: Cesium.Math.toDegrees(cartographic.latitude),
              lon: Cesium.Math.toDegrees(cartographic.longitude),
              alt: cartographic.height
            };
            
            // 移除旧实体
            viewer.entities.remove(existingEntity);
            nodeEntities.value.delete(node.id);
            
            // 创建新的实体
            createNodeEntity(node);
            return;
          }
        }
        
        // 如果实体已经完成移动，但有自定义路径标记，表示它已经移动过但现在停止了
        // 这时不应该重置它的位置到初始位置，而是保持当前位置
        // 但如果是强制位置更新（来自服务器同步），则应该更新位置
        if (entityAny._hasCustomPath && entityAny._pathData && !entityAny._isFlying && !forcePositionUpdate) {
          // 获取当前位置
          try {
            const position = existingEntity.position?.getValue(viewer.clock.currentTime);
            if (position) {
              const cartographic = Cesium.Cartographic.fromCartesian(position);
              // 保存当前位置信息
              entityPositions.set(nodeId, {
                lon: Cesium.Math.toDegrees(cartographic.longitude),
                lat: Cesium.Math.toDegrees(cartographic.latitude),
                alt: cartographic.height
              });

              // 检查是否当前位置与拓扑存储中的位置不匹配 - 如果不匹配，说明实体已移动但拓扑没更新
              const positionMatch = Math.abs(node.geo.lon - entityPositions.get(nodeId)!.lon) < 0.00001 &&
                                 Math.abs(node.geo.lat - entityPositions.get(nodeId)!.lat) < 0.00001 &&
                                 Math.abs(node.geo.alt - entityPositions.get(nodeId)!.alt) < 0.00001;

              if (!positionMatch) {
                return;
              }
            }
          } catch (e) {
            console.warn(`获取实体位置出错: ${e}`);
          }
        }
        
        // 更新实体位置（仅当不在移动状态，且不是已停止的无人机）
        const position = Cesium.Cartesian3.fromDegrees(node.geo.lon, node.geo.lat, node.geo.alt);
        existingEntity.name = node.name;
        if (existingEntity.label) {
          const label = existingEntity.label as Cesium.LabelGraphics;
          label.text = new Cesium.ConstantProperty(node.server ? `${node.alias}（${node.server}）` : node.alias);
          ensureNodeLabelVisible(label);
        }
        existingEntity.position = new Cesium.ConstantPositionProperty(position);
        bindFaultVisualEffect(existingEntity, node.id);
        ensureFaultFlashLoop();
        
        // 检查如果是当前显示通信范围的无人机，则刷新其通信范围
        if (currentDroneWithRange.value && currentDroneWithRange.value.id === existingEntity.id) {
          refreshDroneWithRangeIfNeeded();
        }
      } else {
        // 实体不存在，创建新实体
        createNodeEntity(node);
      }

      // 如果子网实体处于隐藏状态，隐藏新创建或已存在的EMANE节点
      if (subnetEntitiesHidden.value && node.type === 'EMANE') {
        const entity = nodeEntities.value.get(node.id);
        if (entity) {
          entity.show = false;
        }
      }
    });
    
    // 删除不再存在的节点实体
    const entitiesToRemove: Cesium.Entity[] = [];
    nodeEntities.value.forEach(entity => {
      if (!currentNodeIds.has(entity.id)) {
        entitiesToRemove.push(entity);
      }
    });
    
    // 从视图和集合中移除实体
    entitiesToRemove.forEach(entity => {
      viewer.entities.remove(entity);
      nodeEntities.value.delete(entity.id as unknown as number);
    });
    
    // 全局检查刷新所有通信范围
    refreshDroneWithRangeIfNeeded();
  };

  const normalizeEmaneConfigs = (configs: any) => {
    if (!configs || !Array.isArray(configs)) {
      return [];
    }
    
    try {
      const normalized = configs.map((configItem: any) => {
        if (!configItem.config) return configItem;
        
        const normalizedConfig = { ...configItem };
        const sortedConfig: any = {};
        
        Object.keys(configItem.config).sort().forEach(key => {
          const param = configItem.config[key];
          if (param && typeof param === 'object') {
            sortedConfig[key] = {
              ...param,
              value: String(param.value || ''),
              type: typeof param.type === 'number' ? param.type : 10,
              select: Array.isArray(param.select) ? param.select.sort() : []
            };
          }
        });
        
        normalizedConfig.config = sortedConfig;
        return normalizedConfig;
      });
      
      return normalized.sort((a: any, b: any) => {
        if (a.model !== b.model) return a.model.localeCompare(b.model);
        return a.ifaceId - b.ifaceId;
      });
    } catch (error) {
      console.warn('规范化EMANE配置时出错:', error);
      return configs;
    }
  };
  
  /**
   * 提取 OTA 管理器组和事件服务组的配置中的 otamanagergroup 和 eventservicegroup 字段和频率字段
   * @param configs 完整的 emane_configs 配置
   * @returns 只包含 otamanagergroup 和 eventservicegroup，frequency字段的对象
   */
  const extractOtaAndEventServiceGroups = (configs: any) => {
    if (!configs || !Array.isArray(configs)) {
      return { otamanagergroup: undefined, eventservicegroup: undefined, frequency: undefined };
    }
    
    const result: any = {
      otamanagergroup: undefined,
      eventservicegroup: undefined,
      frequency: undefined
    };
    
    configs.forEach((configItem: any) => {
      if (!configItem.config) return;
      
      // 查找 otamanagergroup 和 eventservicegroup 字段
      Object.keys(configItem.config).forEach(key => {
        const param = configItem.config[key];
        if (param && typeof param === 'object') {
          if (key === 'otamanagergroup') {
            result.otamanagergroup = param.value;
          } else if (key === 'eventservicegroup') {
            result.eventservicegroup = param.value;
          } else if (key === 'frequency') {
            result.frequency = param.value; 
          }
        }
      });
    });
    
    return result;
  };

  const getEffectiveEmaneConfigs = (node: Node, subnetId: number) => {
    // 始终使用子网（EMANE节点）的配置进行链路判断
    // 因为节点可能连接多个子网，节点自身的 emane_configs 会包含所有子网的混合配置，
    // 直接使用会导致取到其他子网的参数，判断不准确
    const subnetNode = topoStore.topoData?.nodes?.find((n: Node) => n.id === subnetId);
    if (subnetNode && subnetNode.emane_configs !== null && subnetNode.emane_configs !== undefined) {
      return normalizeEmaneConfigs(subnetNode.emane_configs);
    }
    
    // 如果子网节点没有配置，回退到节点自身配置
    if (node.emane_configs !== null && node.emane_configs !== undefined) {
      return normalizeEmaneConfigs(node.emane_configs);
    }
    
    return normalizeEmaneConfigs(null);
  };

  // 全量同步：每次都以topoData.links为唯一数据源
  const syncLinksToEntities = () => {
    if (!viewer) {
      console.warn('无法同步链路: Cesium Viewer为null');
      return;
    }

    // 立即清理所有链路相关标签和实体，以确保能获取最新数据
    // 这对处理链路IP修改等场景至关重要
    {
      const labelsToRemove = [];
      for (let i = 0; i < viewer.entities.values.length; i++) {
        const entity = viewer.entities.values[i];
        if (entity.id && typeof entity.id === 'string') {
          // 清除所有类型的链路标签
          if (entity.id.startsWith('ip-label-') || // IP标签
              entity.id.startsWith('label-link-') || // 链路数据标签
              entity.id.startsWith('label-subnet-') || // 子网链路数据标签
              (entity.id.includes('-ip-') && entity.id.includes('label')) || // 备用IP标签模式
              (entity.properties && entity.properties.isLinkDataLabel && entity.properties.isLinkDataLabel.getValue()) // 通过属性识别的链路数据标签
             ) {
            labelsToRemove.push(entity);
          }
        }
      }

      labelsToRemove.forEach(entity => {
        viewer.entities.remove(entity);
      });

      // 清除所有链路实体及其映射，以便后续重新创建（带有新的标签）
      const linkIdsToRemove = Array.from(linkEntities.value.keys());
      linkIdsToRemove.forEach(linkId => {
        const entity = linkEntities.value.get(linkId);
        if (entity) {
          viewer.entities.remove(entity);
          linkEntities.value.delete(linkId);
        }
      });

      const subnetAttachmentIdsToRemove = Array.from(subnetAttachmentEntities.value.keys());
      subnetAttachmentIdsToRemove.forEach(entityId => {
        const entity = subnetAttachmentEntities.value.get(entityId);
        if (entity) {
          viewer.entities.remove(entity);
          subnetAttachmentEntities.value.delete(entityId);
        }
      });
    }

    // 获取当前用户角色
    const userInfo = getUserInfo();
    const userRole = userInfo.role; // white, red, blue
    const userMode = userInfo.mode; // normal, attack-defense

    // 定义检查节点可见性的函数
    const isNodeVisibleToUser = (nodeId: number): boolean => {
      if (userMode === 'normal' || userRole === 'white') return true; // 普通模式或白方可以查看所有节点

      // 查找节点数据
      const node = topoStore.topoData?.nodes?.find((n: Node) => n.id === nodeId);
      if (!node) return false; // 节点不存在则不可见

      const nodeRole = node.role; // 1-WHITE, 2-RED, 3-BLUE, 0-ALL (默认)

      // 判断用户是否可以查看该节点
      return nodeRole === null || // 未定义角色的节点对所有人可见
             nodeRole === 'WHITE' || // WHITE角色的节点对所有人可见
             nodeRole === 'UNKNOWN' || // ALL角色的节点对所有人可见
             (userRole === 'red' && nodeRole === 'RED') || // 红方可以查看红方节点
             (userRole === 'blue' && nodeRole === 'BLUE'); // 蓝方可以查看蓝方节点
    };
    
    // 定义清理所有链路相关标签的辅助函数
    const cleanAllLinkLabels = () => {
      const labelsToRemove = [];

      for (let i = 0; i < viewer.entities.values.length; i++) {
        const entity = viewer.entities.values[i];
        if (entity.id && typeof entity.id === 'string') {
          // 清除所有类型的链路标签
          if (entity.id.startsWith('ip-label-') || // IP标签
              entity.id.startsWith('label-link-') || // 链路数据标签
              entity.id.startsWith('label-subnet-') || // 子网链路数据标签
              (entity.id.includes('-ip-') && entity.id.includes('label')) || // 备用IP标签模式
              (entity.properties && entity.properties.isLinkDataLabel && entity.properties.isLinkDataLabel.getValue()) // 通过属性识别的链路数据标签
             ) {
            labelsToRemove.push(entity);
          }
        }
      }

      labelsToRemove.forEach(entity => {
        viewer.entities.remove(entity);
      });

      // 清除所有链路实体及其映射，以便后续重新创建（带有新的标签）
      // 这确保了修改IP后，链路标签能够被正确更新
      // 注意：需要先收集所有linkId，再进行删除，不能在forEach中直接删除
      const linkIdsToRemove = Array.from(linkEntities.value.keys());
      linkIdsToRemove.forEach(linkId => {
        const entity = linkEntities.value.get(linkId);
        if (entity) {
          viewer.entities.remove(entity);
          linkEntities.value.delete(linkId);
        }
      });

      const subnetAttachmentIdsToRemove = Array.from(subnetAttachmentEntities.value.keys());
      subnetAttachmentIdsToRemove.forEach(entityId => {
        const entity = subnetAttachmentEntities.value.get(entityId);
        if (entity) {
          viewer.entities.remove(entity);
          subnetAttachmentEntities.value.delete(entityId);
        }
      });

      if (labelsToRemove.length > 0) {
      }
    };
    
    // 确保 topoData 和 links 数组存在
    if (!topoStore.topoData || !Array.isArray(topoStore.topoData.links)) {
      // 清理所有现有链路
      linkEntities.value.forEach(entity => viewer.entities.remove(entity));
      linkEntities.value.clear();

      // 清理所有链路相关标签
      cleanAllLinkLabels();
      return;
    }

    // 如果链接数组为空，清除所有链接实体
    if (topoStore.topoData.links.length === 0) {
      // 清理所有现有链路实体
      linkEntities.value.forEach(entity => viewer.entities.remove(entity));
      linkEntities.value.clear();

      // 清理所有链路相关标签
      cleanAllLinkLabels();
      return;
    }

    const links = topoStore.topoData.links;
    const requiredLinkIds = new Set<string>();

    // Step 1: Gather required REGULAR link IDs
    links.forEach((link: Link) => {
      const node1 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node1_id);
      const node2 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node2_id);
      if (!node1 || !node2 || (node1.type === 'EMANE' && node2.type !== 'EMANE') || (node2.type === 'EMANE' && node1.type !== 'EMANE')) {
        return; // Skip invalid or EMANE-to-device links
      }
      
      // 检查链路两端的节点对当前用户是否都可见
      if (!isNodeVisibleToUser(link.node1_id) || !isNodeVisibleToUser(link.node2_id)) {
        // 如果任一节点对当前用户不可见，则链路也不可见
        return;
      }
      
      const linkId = `link-${link.node1_id}-${link.node2_id}`;
      requiredLinkIds.add(linkId);
    });

    // 创建EMANE子网与设备的映射关系
    const emaneSubnets = new Map<number, Set<number>>();
    // NEW: 用于存储子网与设备之间的链路对象，便于后续创建链路数据标签时使用
    const subnetDeviceLinks = new Map<number, Map<number, Link>>();

    links.forEach((link: Link) => {
      const node1 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node1_id);
      const node2 = topoStore.topoData.nodes.find((n: Node) => n.id === link.node2_id);
      if (!node1 || !node2) return;
      if (node1.type === 'EMANE' || node2.type === 'EMANE') {
        // 检查链路两端的节点对当前用户是否都可见
        if (!isNodeVisibleToUser(link.node1_id) || !isNodeVisibleToUser(link.node2_id)) {
          // 如果任一节点对当前用户不可见，则不添加到子网中
          return;
        }

        const emaneNode = node1.type === 'EMANE' ? node1 : node2;
        const deviceNode = node1.type === 'EMANE' ? node2 : node1;

        // 检查角色是否匹配
        const emaneRole = emaneNode.role || 'WHITE'; // 默认为公共角色
        const deviceRole = deviceNode.role || 'WHITE'; // 默认为公共角色

        // 如果子网是公共角色，可以接入任何节点
        // 如果节点是公共角色，可以接入任何子网
        // 否则，角色必须匹配
        if (emaneRole !== 'WHITE' && deviceRole !== 'WHITE' && emaneRole !== deviceRole) {
          // 角色不匹配，不添加到子网中
          return;
        }

        const subnetId = emaneNode.id;
        if (!emaneSubnets.has(subnetId)) {
          emaneSubnets.set(subnetId, new Set<number>());
        }
        emaneSubnets.get(subnetId)?.add(deviceNode.id);

        // NEW: Store the link object for this device-subnet connection
        if (!subnetDeviceLinks.has(subnetId)) {
          subnetDeviceLinks.set(subnetId, new Map<number, Link>());
        }
        subnetDeviceLinks.get(subnetId)?.set(deviceNode.id, link);
      }
    });

    emaneSubnets.forEach((nodeIds, subnetId) => {
      if (nodeIds.size >= 2) {
        const nodeIdsArray = Array.from(nodeIds).filter(nodeId => {
          const node = topoStore.topoData?.nodes.find((n: Node) => n.id === nodeId);
          // 检查节点是否对当前用户可见
          return node && node.type !== 'INODE' && isNodeVisibleToUser(nodeId);
        });
        for (let i = 0; i < nodeIdsArray.length; i++) {
          for (let j = i + 1; j < nodeIdsArray.length; j++) {
            const node1Id = nodeIdsArray[i];
            const node2Id = nodeIdsArray[j];
            
            const node1 = topoStore.topoData?.nodes.find((n: Node) => n.id === node1Id);
            const node2 = topoStore.topoData?.nodes.find((n: Node) => n.id === node2Id);
            
            if (!node1 || !node2) continue;
            
            const configs1 = getEffectiveEmaneConfigs(node1, subnetId);
            const configs2 = getEffectiveEmaneConfigs(node2, subnetId);
            
            // 提取 otamanagergroup 和 eventservicegroup，frequency字段进行比较
            const groups1 = extractOtaAndEventServiceGroups(configs1);
            const groups2 = extractOtaAndEventServiceGroups(configs2);
            
            console.log('节点', node1.name, '和', node2.name, '的 OTA 管理器组和事件服务组，频率:', groups1, groups2);
            
            // 只有当 otamanagergroup 和 eventservicegroup，frequency字段都相同时才创建链路
            if (groups1.otamanagergroup === groups2.otamanagergroup && 
                groups1.eventservicegroup === groups2.eventservicegroup &&
                groups1.frequency === groups2.frequency) {
              const subnetLinkId = `subnet-${subnetId}-link-${node1Id}-${node2Id}`;
              requiredLinkIds.add(subnetLinkId);
            } else {
              //console.warn('节点', node1.name, '和', node2.name, '的 otamanagergroup 或 eventservicegroup，frequency配置不一致，不创建链路');
            }
          }
        }
      }
    });

    // 移除不再需要的链路实体和标签
    const linksToRemove: string[] = [];
    linkEntities.value.forEach((_, linkId) => {
      if (!requiredLinkIds.has(linkId)) {
        linksToRemove.push(linkId);
      }
    });

    linksToRemove.forEach(linkId => {
      const entity = linkEntities.value.get(linkId);
      if (entity) {
        viewer.entities.remove(entity);
        linkEntities.value.delete(linkId);
        const labelId = `label-${linkId}`;
        const labelEntity = viewer.entities.getById(labelId);
        if (labelEntity) {
          viewer.entities.remove(labelEntity);
        }
        
        // 移除链路IP地址标签
        if (linkId.startsWith('link-')) {
          // 普通链路标签处理
          const linkIdMatch = linkId.match(/link-(\d+)-(\d+)/);
          if (linkIdMatch && linkIdMatch.length === 3) {
            const node1Id = linkIdMatch[1];
            const node2Id = linkIdMatch[2];
            
            // 移除两个方向的IP地址标签
            const ipLabel1Id = `ip-label-${node1Id}-${node2Id}`;
            const ipLabel2Id = `ip-label-${node2Id}-${node1Id}`;
            
            const ipLabel1Entity = viewer.entities.getById(ipLabel1Id);
            if (ipLabel1Entity) {
              viewer.entities.remove(ipLabel1Entity);
            }
            
            const ipLabel2Entity = viewer.entities.getById(ipLabel2Id);
            if (ipLabel2Entity) {
              viewer.entities.remove(ipLabel2Entity);
            }
          }
        } else if (linkId.startsWith('subnet-')) {
          // 子网链路标签处理
          const subnetLinkIdMatch = linkId.match(/subnet-\d+-link-(\d+)-(\d+)/);
          if (subnetLinkIdMatch && subnetLinkIdMatch.length === 3) {
            const node1Id = subnetLinkIdMatch[1];
            const node2Id = subnetLinkIdMatch[2];
            
            // 移除两个方向的IP地址标签
            const ipLabel1Id = `ip-label-subnet-${node1Id}-${node2Id}`;
            const ipLabel2Id = `ip-label-subnet-${node2Id}-${node1Id}`;
            
            const ipLabel1Entity = viewer.entities.getById(ipLabel1Id);
            if (ipLabel1Entity) {
              viewer.entities.remove(ipLabel1Entity);
            }
            
            const ipLabel2Entity = viewer.entities.getById(ipLabel2Id);
            if (ipLabel2Entity) {
              viewer.entities.remove(ipLabel2Entity);
            }
            
            // 尝试移除其他可能的IP标签命名模式
            // 遍历所有实体，查找以这两个节点ID相关的IP标签
            const allEntities = viewer.entities.values;
            for (let i = 0; i < allEntities.length; i++) {
              const entity = allEntities[i];
              const entityId = entity.id;
              
              if (typeof entityId === 'string' && 
                  // 更精确地匹配IP标签实体
                  (entityId.startsWith('ip-label-') || entityId.includes('-ip-label-')) &&
                  (entityId.includes(`-${node1Id}-${node2Id}`) || 
                   entityId.includes(`-${node2Id}-${node1Id}`))) {
                viewer.entities.remove(entity);
              }
            }
          }
        }
      }
    });
    
    // 添加缺失的链路实体
    links.forEach((link: Link) => {
      const linkId = `link-${link.node1_id}-${link.node2_id}`;
      if (requiredLinkIds.has(linkId) && !linkEntities.value.has(linkId)) {
        createLinkEntity(link);
      }
    });

    // 处理EMANE子网链路的特殊显示逻辑
    emaneSubnets.forEach((nodeIds, subnetId) => {
      const colorIndex = subnetId % SUBNET_COLORS.length;
      let subnetColor = SUBNET_COLORS[colorIndex];
      
      // 获取子网节点
      const emaneNode = topoStore.topoData.nodes.find((n: Node) => n.id === subnetId);
      if (emaneNode) {
        // 根据子网角色设置颜色
        const nodeRole = emaneNode.role; // 1-WHITE, 2-RED, 3-BLUE, 0-UNKNOWN (默认)
        if (nodeRole === 'RED') {
          subnetColor = Cesium.Color.fromCssColorString('#C62828');
        } else if (nodeRole === 'BLUE') {
          subnetColor = Cesium.Color.fromCssColorString('#1565C0');
        }
        // 如果是WHITE或未设置，保持原有的子网颜色
      }
      
      const emaneEntity = nodeEntities.value.get(subnetId);
      if (emaneEntity?.label) {
        (emaneEntity.label as Cesium.LabelGraphics).fillColor = new Cesium.ConstantProperty(subnetColor);
      }
      
      nodeIds.forEach(nodeId => {
        const entity = nodeEntities.value.get(nodeId);
        if (entity?.label) {
          const label = entity.label as Cesium.LabelGraphics;
          label.fillColor = new Cesium.ConstantProperty(subnetColor);
          label.outlineWidth = new Cesium.ConstantProperty(2);
          label.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE);
          label.style = new Cesium.ConstantProperty(Cesium.LabelStyle.FILL_AND_OUTLINE);
        }

        const node = topoStore.topoData?.nodes.find((n: Node) => n.id === nodeId);
        if (node && node.type !== 'INODE') {
          createSubnetAttachmentEntity(viewer, subnetId, nodeId, subnetColor);
        }
      });
      
      if (nodeIds.size >= 2) {
        const nodeIdsArray = Array.from(nodeIds).filter(nodeId => {
          const node = topoStore.topoData?.nodes.find((n: Node) => n.id === nodeId);
          return node && node.type !== 'INODE';
        });
        
        nodeIdsArray.forEach(nodeId => {
          const nodeEntity = nodeEntities.value.get(nodeId);
          if (nodeEntity) {
            nodeEntity.position?.getValue(viewer.clock.currentTime);
          }
        });
        
        for (let i = 0; i < nodeIdsArray.length; i++) {
          for (let j = i + 1; j < nodeIdsArray.length; j++) {
            const node1Id = nodeIdsArray[i];
            const node2Id = nodeIdsArray[j];
            const subnetLinkId = `subnet-${subnetId}-link-${node1Id}-${node2Id}`;
            if (requiredLinkIds.has(subnetLinkId) && !linkEntities.value.has(subnetLinkId)) {
              const node1Entity = nodeEntities.value.get(node1Id);
              const node2Entity = nodeEntities.value.get(node2Id);
              const pos1 = node1Entity?.position?.getValue(viewer.clock.currentTime);
              const pos2 = node2Entity?.position?.getValue(viewer.clock.currentTime);
              
              if (pos1 && pos2) {
                createSubnetDashLink(
                  viewer!,
                  subnetId,
                  node1Id,
                  node2Id,
                  pos1,
                  pos2,
                  subnetColor,
                  topoStore,
                  emaneStore,
                  nemIdStore,
                  subnetDeviceLinks // NEW: Pass the link mapping
                );
              }
            }
          }
        }
      }
    });

    // 如果子网实体处于隐藏状态（仿真运行中），隐藏新创建的子网附属连接线
    if (subnetEntitiesHidden.value) {
      subnetAttachmentEntities.value.forEach((entity) => {
        entity.show = false;
      });
    }

    refreshFaultedLinkStyles();
  };

  const createSubnetAttachmentEntity = (
    viewerInstance: Cesium.Viewer,
    subnetId: number,
    nodeId: number,
    subnetColor: Cesium.Color
  ): Cesium.Entity | undefined => {
    const attachmentId = `subnet-attachment-${subnetId}-${nodeId}`;
    const subnetEntity = nodeEntities.value.get(subnetId);
    const nodeEntity = nodeEntities.value.get(nodeId);

    if (!subnetEntity || !nodeEntity) {
      return undefined;
    }

    const existingEntity = viewerInstance.entities.getById(attachmentId);
    if (existingEntity) {
      subnetAttachmentEntities.value.set(attachmentId, existingEntity);
      return existingEntity;
    }

    const entity = viewerInstance.entities.add({
      id: attachmentId,
      name: `子网${subnetId}接入提示`,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const currentTime = viewerInstance.clock.currentTime;
          const subnetPosition = subnetEntity.position?.getValue(currentTime);
          const nodePosition = nodeEntity.position?.getValue(currentTime);
          if (subnetPosition && nodePosition) {
            return [subnetPosition, nodePosition];
          }
          return [];
        }, false),
        width: SUBNET_ATTACHMENT_LINE.width,
        material: new Cesium.PolylineDashMaterialProperty({
          color: getSubnetAttachmentColor(subnetColor),
          dashLength: SUBNET_ATTACHMENT_LINE.dashLength
        }),
        clampToGround: false
      }
    });

    subnetAttachmentEntities.value.set(attachmentId, entity);
    return entity;
  };

  // 创建虚线链路和相关标签
  const createSubnetDashLink = (
    viewerInstance: Cesium.Viewer, // 参数名修改以避免与外部 viewer 冲突
    subnetId: number,
    node1Id: number,
    node2Id: number,
    pos1: Cesium.Cartesian3,
    pos2: Cesium.Cartesian3,
    subnetColor: Cesium.Color,
    topoStoreInstance: any, // 明确为实例参数
    emaneStoreInstance: any, // 明确为实例参数
    nemIdStoreInstance: any, // 明确为实例参数
    subnetDeviceLinks: Map<number, Map<number, Link>> // NEW: Link mapping parameter
  ) => {
    // 创建唯一的虚线链路ID
    const subnetLinkId = `subnet-${subnetId}-link-${node1Id}-${node2Id}`;
    const linkLabelId = `label-${subnetLinkId}`;
    
    // 获取节点实体
    const node1Entity = nodeEntities.value.get(node1Id);
    const node2Entity = nodeEntities.value.get(node2Id);
    if (!node1Entity || !node2Entity) return { dashEntity: null, labelEntity: null };

    // 检查实体是否已存在，防止重复创建
    const existingEntity = viewerInstance.entities.getById(subnetLinkId);
    if (existingEntity) {
      return { dashEntity: existingEntity, labelEntity: viewerInstance.entities.getById(linkLabelId) };
    }
    
    // 创建新的虚线连接
    const dashEntity = viewerInstance.entities.add({
      id: subnetLinkId,
      name: `子网${subnetId}内部连接`,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const currentTime = viewerInstance.clock.currentTime;
          const p1 = node1Entity.position?.getValue(currentTime);
          const p2 = node2Entity.position?.getValue(currentTime);
          if (p1 && p2) return [p1, p2];
          return [];
        }, false),
        width: 4,
        // 子网链路初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
        material: new Cesium.PolylineDashMaterialProperty({
          color: SINR_COLORS.UNKNOWN,
          dashLength: 16.0
        }),
        clampToGround: false,
      }
    });

    // 跟踪新的子网链路实体
    linkEntities.value.set(subnetLinkId, dashEntity);
    
    const node1 = topoStoreInstance.topoData?.nodes.find((n: Node) => n.id === node1Id);
    const node2 = topoStoreInstance.topoData?.nodes.find((n: Node) => n.id === node2Id);
    const node1Name = node1?.alias || node1?.name || `节点${node1Id}`;
    const node2Name = node2?.alias || node2?.name || `节点${node2Id}`;

    // NEW: Get the actual Link objects for each device from the mapping
    const node1Link = subnetDeviceLinks.get(subnetId)?.get(node1Id);
    const node2Link = subnetDeviceLinks.get(subnetId)?.get(node2Id);

    // 提取接口名称
    const node1InterfaceName = node1Link ?
      (node1Link.node1_id === node1Id ? node1Link.iface1?.name : node1Link.iface2?.name) : undefined;
    const node2InterfaceName = node2Link ?
      (node2Link.node1_id === node2Id ? node2Link.iface1?.name : node2Link.iface2?.name) : undefined;

    // 创建标签实体显示链路数据
    const labelEntity = viewerInstance.entities.add({
      id: linkLabelId,
      name: `${subnetLinkId}的数据标签`,
      position: new Cesium.CallbackProperty(() => {
        const p1 = node1Entity.position?.getValue(viewerInstance.clock.currentTime);
        const p2 = node2Entity.position?.getValue(viewerInstance.clock.currentTime);
        if (p1 && p2) {
          const mid = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
          const up = Cesium.Cartesian3.normalize(mid, new Cesium.Cartesian3());
          Cesium.Cartesian3.multiplyByScalar(up, 50, up); // 从45增加到50
          return Cesium.Cartesian3.add(mid, up, new Cesium.Cartesian3());
        }
        return undefined;
      }, false) as unknown as Cesium.PositionProperty,
      properties: {
        isLinkDataLabel: true,
        node1Id: node1Id,
        node2Id: node2Id,
        node1Name: node1Name,
        node2Name: node2Name,
        node1InterfaceName: node1InterfaceName,
        node2InterfaceName: node2InterfaceName,
      },
      label: {
        // text: "加载中...",
        font: '500 18px Microsoft YaHei, Arial, sans-serif',
        style: Cesium.LabelStyle.FILL,
        outlineWidth: 0,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        fillColor: getLabelTextColor(SINR_COLORS.UNKNOWN),
        outlineColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.6)'),
        // 子网链路标签初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
        backgroundColor: SINR_COLORS.UNKNOWN.withAlpha(0.7),
        backgroundPadding: new Cesium.Cartesian2(10, 8),
        showBackground: true,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: 0,
        scale: 1.0,
        scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 3000, 0.7) // 确保标签始终可见
      }
    });

    // 为子网内的节点添加IP地址标签
    // Use the Link objects obtained earlier (already defined at lines 2367-2369)
    createSubnetNodeIpLabels(
      viewerInstance,
      node1Id,
      node2Id,
      node1Entity,
      node2Entity,
      subnetColor,
      node1Link, // NEW: Pass the actual link for node1
      node2Link  // NEW: Pass the actual link for node2
    );
    
    return { dashEntity, labelEntity };
  };

  // 为子网内节点创建IP地址标签
  const createSubnetNodeIpLabels = (
    viewerInstance: Cesium.Viewer,
    node1Id: number,
    node2Id: number,
    node1Entity: Cesium.Entity,
    node2Entity: Cesium.Entity,
    subnetColor: Cesium.Color,
    node1Link: Link | undefined, // NEW: Direct link object for node1
    node2Link: Link | undefined  // NEW: Direct link object for node2
  ) => {
    if (!viewerInstance) return;

    // 根据传入的Link对象直接获取接口信息，而不是再次查找
    // 获取接口信息时，判断node1在link中是node1_id还是node2_id，以确定使用iface1还是iface2
    const node1Interface = node1Link ?
      (node1Link.node1_id === node1Id ? node1Link.iface1 : node1Link.iface2) : null;

    // 同样的逻辑适用于node2
    const node2Interface = node2Link ?
      (node2Link.node1_id === node2Id ? node2Link.iface1 : node2Link.iface2) : null;
    
    // 如果找到了节点1的IP地址，创建标签
    if (node1Interface && (node1Interface.ip4 || node1Interface.ip6)) {
      const node1IpLabelId = `ip-label-subnet-${node1Id}-${node2Id}`;
      
      // 检查标签是否已存在，如果存在则移除
      const existingLabel1 = viewerInstance.entities.getById(node1IpLabelId);
      if (existingLabel1) {
        viewerInstance.entities.remove(existingLabel1);
      }
      
      // 构建IP地址文本，接口名称只添加一次
      let ipText = '';
      if (node1Interface.name) {
        ipText += `${node1Interface.name}:\n`;
      }
      if (node1Interface.ip4) {
        ipText += `${node1Interface.ip4}/${node1Interface.ip4_mask}`;
      }
      if (node1Interface.ip6) {
        if (node1Interface.ip4) ipText += '\n';
        ipText += `${node1Interface.ip6}/${node1Interface.ip6_mask}`;
      }
      
      viewerInstance.entities.add({
        id: node1IpLabelId,
        position: new Cesium.CallbackProperty(() => {
          const pos1 = node1Entity.position?.getValue(viewerInstance.clock.currentTime);
          const pos2 = node2Entity.position?.getValue(viewerInstance.clock.currentTime);
          if (pos1 && pos2) {
            // 计算从pos1到pos2的方向向量
            const direction = Cesium.Cartesian3.subtract(pos2, pos1, new Cesium.Cartesian3());
            
            // 计算链路总长度
            const distance = Cesium.Cartesian3.magnitude(direction);
            
            // 归一化方向向量
            Cesium.Cartesian3.normalize(direction, direction);
            
            // 使用链路长度的1/4作为标签位置
            const labelDistance = distance * 0.25; // 链路长度的1/4
            const labelPos = Cesium.Cartesian3.multiplyByScalar(direction, labelDistance, new Cesium.Cartesian3());
            return Cesium.Cartesian3.add(pos1, labelPos, new Cesium.Cartesian3());
          }
          return undefined;
        }, false) as unknown as Cesium.PositionProperty,
        label: {
          text: ipText,
          font: '500 18px Microsoft YaHei, Arial, sans-serif',
          style: Cesium.LabelStyle.FILL,
          outlineWidth: 0,
          fillColor: getLabelTextColor(SINR_COLORS.UNKNOWN),
          // 子网IP标签初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
          backgroundColor: SINR_COLORS.UNKNOWN.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(10, 8),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 0,
          scale: 1.0,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 3000, 0.7)
        }
      });
    }

    // 如果找到了节点2的IP地址，创建标签
    if (node2Interface && (node2Interface.ip4 || node2Interface.ip6)) {
      const node2IpLabelId = `ip-label-subnet-${node2Id}-${node1Id}`;
      
      // 检查标签是否已存在，如果存在则移除
      const existingLabel2 = viewerInstance.entities.getById(node2IpLabelId);
      if (existingLabel2) {
        viewerInstance.entities.remove(existingLabel2);
      }
      
      // 构建IP地址文本，接口名称只添加一次
      let ipText = '';
      if (node2Interface.name) {
        ipText += `${node2Interface.name}:\n`;
      }
      if (node2Interface.ip4) {
        ipText += `${node2Interface.ip4}/${node2Interface.ip4_mask}`;
      }
      if (node2Interface.ip6) {
        if (node2Interface.ip4) ipText += '\n';
        ipText += `${node2Interface.ip6}/${node2Interface.ip6_mask}`;
      }
      
      viewerInstance.entities.add({
        id: node2IpLabelId,
        position: new Cesium.CallbackProperty(() => {
          const pos1 = node1Entity.position?.getValue(viewerInstance.clock.currentTime);
          const pos2 = node2Entity.position?.getValue(viewerInstance.clock.currentTime);
          if (pos1 && pos2) {
            // 计算从pos2到pos1的方向向量
            const direction = Cesium.Cartesian3.subtract(pos1, pos2, new Cesium.Cartesian3());
            
            // 计算链路总长度
            const distance = Cesium.Cartesian3.magnitude(direction);
            
            // 归一化方向向量
            Cesium.Cartesian3.normalize(direction, direction);
            
            // 使用链路长度的1/4作为标签位置
            const labelDistance = distance * 0.25; // 链路长度的1/4
            const labelPos = Cesium.Cartesian3.multiplyByScalar(direction, labelDistance, new Cesium.Cartesian3());
            return Cesium.Cartesian3.add(pos2, labelPos, new Cesium.Cartesian3());
          }
          return undefined;
        }, false) as unknown as Cesium.PositionProperty,
        label: {
          text: ipText,
          font: '500 18px Microsoft YaHei, Arial, sans-serif',
          style: Cesium.LabelStyle.FILL,
          outlineWidth: 0,
          fillColor: getLabelTextColor(SINR_COLORS.UNKNOWN),
          // 子网IP标签初始化时使用UNKNOWN颜色（橙色），将在updateLinkLabels中根据SINR更新
          backgroundColor: SINR_COLORS.UNKNOWN.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(10, 8),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 0,
          scale: 1.0,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 3000, 0.7)
        }
      });
    }
  };

  // 查找节点的所有带IP地址的接口
  const findNodeInterfacesWithIp = (nodeId: number): NodeIface[] => {
    if (!topoStore.topoData || !Array.isArray(topoStore.topoData.links)) {
      return [];
    }

    const interfacesWithIp: NodeIface[] = [];

    // 遍历所有链路，查找该节点的接口
    topoStore.topoData.links.forEach((link: Link) => {
      if (link.node1_id === nodeId && link.iface1 && link.iface1.ip4) {
        interfacesWithIp.push(link.iface1);
      }

      if (link.node2_id === nodeId && link.iface2 && link.iface2.ip4) {
        interfacesWithIp.push(link.iface2);
      }
    });

    return interfacesWithIp;
  };

  // 用于检测链路数据是否真正变化的辅助函数
  let lastLinksHash = '';
  const getLinksHash = () => {
    if (!topoStore.topoData?.links) return '';
    // 只比较链路的关键属性：id, node1_id, node2_id, type, ip地址等
    // 不包括节点位置，因为位置变化不需要重建链路
    return JSON.stringify(topoStore.topoData.links.map((link: any) => ({
      id: link.id,
      node1_id: link.node1_id,
      node2_id: link.node2_id,
      type: link.type,
      ip1: link.ip1,
      ip2: link.ip2,
      interface_one: link.interface_one,
      interface_two: link.interface_two
    })));
  };

  // 监听topoData整体变化（包括nodes和links变化）
  watch(
    () => topoStore.topoData,
    () => {
      // 始终同步节点（节点位置变化需要更新实体位置）
      syncNodesToEntities();
      ensureFaultFlashLoop();

      // 只有当链路数据真正变化时才同步链路，避免移动节点时重建链路导致闪烁
      const currentLinksHash = getLinksHash();
      if (currentLinksHash !== lastLinksHash) {
        lastLinksHash = currentLinksHash;
        syncLinksToEntities();
      } else {
        refreshFaultedLinkStyles();
      }
    },
    { deep: true }
  );

  // 监听场景状态变化，自动控制子网实体可见性
  // 解决多用户同时加载场景时，非启动者无法隐藏子网的问题
  watch(
    () => topoStore.topoData?.state,
    (newState, oldState) => {
      if (!viewer || newState === oldState) return;
      const isRunning = newState === 'RUNTIME' || newState === 'RUNNING';
      const wasRunning = oldState === 'RUNTIME' || oldState === 'RUNNING';
      if (isRunning && !wasRunning) {
        // 场景进入运行状态，隐藏子网实体
        setSubnetVisibility(false);
      } else if (!isRunning && wasRunning) {
        // 场景退出运行状态，恢复子网实体
        setSubnetVisibility(true);
      }
    },
    { immediate: true }
  );

  // 监听干扰节点配置变化
  watch(
    () => interferenceStore.interferenceConfigs,
    () => {
      // 当干扰配置变化时，更新所有干扰波束
      if (viewer) {
        updateInterferenceBeams(false); // 传入false表示不强制显示波束，只更新状态
      }
    },
    { deep: true }
  );

  // 组件卸载时清理资源
  onUnmounted(() => {
    clearAllEntities();
    if (selectedEntityChangedListener) {
      selectedEntityChangedListener();
      selectedEntityChangedListener = undefined;
    }
    if (screenSpaceEventHandler && !screenSpaceEventHandler.isDestroyed()) {
      screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      screenSpaceEventHandler.destroy();
      screenSpaceEventHandler = undefined;
    }
    stopUpdating(); // 清理链路标签更新定时器
    stopFaultFlashLoop();
    
    // 清理干扰波束相关资源
    if (currentInterferenceWithBeam.value) {
      currentInterferenceWithBeam.value = null;
    }
    
    // 额外检查并清理可能残留的primitive资源
    if (viewer && viewer.scene && viewer.scene.primitives) {
      const primitivesToRemove = [];
      const primitives = viewer.scene.primitives;
      
      // 遍历所有图元，找出干扰脉冲波相关的图元
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        if (primitive && primitive.id && typeof primitive.id === 'string' && 
            primitive.id.indexOf('pulse-geometry-') !== -1) {
          primitivesToRemove.push(primitive);
        }
      }
      
      // 移除找到的图元
      primitivesToRemove.forEach(primitive => {
        primitives.remove(primitive);
      });
      
      if (primitivesToRemove.length > 0) {
      }
    }
    
    interferenceBeamEntities.value.clear();
    
  });

  // 修改updateLinkLabels函数，添加更多日志输出
  const updateLinkLabels = () => {
    // 严格检查 viewer 是否有效
    if (!viewer || viewer.isDestroyed() || !viewer.entities) {
      stopUpdating(); // 如果viewer无效，停止更新
      return;
    }

    // 仿真未运行时跳过SINR数据更新，防止用旧数据重新着色
    const simState = topoStore.topoData?.state;
    if (simState !== 'RUNTIME' && simState !== 'RUNNING') {
      return;
    }

    try {
      // 获取所有拥有 isLinkDataLabel 属性的实体
      const entities = viewer.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i] as any;
        if (entity.properties?.isLinkDataLabel?.getValue()) {
          const node1Id = entity.properties.node1Id.getValue();
          const node2Id = entity.properties.node2Id.getValue();
          const node1Name = entity.properties.node1Name.getValue();
          const node2Name = entity.properties.node2Name.getValue();

          // 获取接口名称（如果存在）
          const node1InterfaceName = entity.properties.node1InterfaceName?.getValue();
          const node2InterfaceName = entity.properties.node2InterfaceName?.getValue();

          const currentLinkId = resolveLinkIdFromLabelEntity(entity.id as string, node1Id, node2Id);
          if (isFaultedLink(node1Id, node2Id)) {
            setLinkEntityColor(currentLinkId, FAULT_LINK_COLOR);
            applyLinkLabelVisibility(currentLinkId, false);
            continue;
          }

          applyLinkLabelVisibility(currentLinkId, linkLabelsVisible.value);

    

          const node1NemInfo = nemIdStore.getNemIdsByNodeId(node1Id);
          const node2NemInfo = nemIdStore.getNemIdsByNodeId(node2Id);

          let labelText = `暂无数据`;

          // 初始化时根据SINR数据更新链路和标签颜色
          let effectiveSinr: number | null = null;
          let sinrValue1to2: number | null = null;
          let sinrValue2to1: number | null = null;

          if (node1NemInfo?.ifaceNemMap && node2NemInfo?.ifaceNemMap) {
            // 辅助函数：从ifaceNemMap中根据接口名称获取NEM ID
            const getNemIdByInterfaceName = (ifaceNemMap: any, interfaceName: string | undefined): number | undefined => {
              if (!interfaceName) return undefined;

              // 尝试1：直接使用接口名称作为键
              if (ifaceNemMap[interfaceName] !== undefined) {
                return ifaceNemMap[interfaceName];
              }

              // 尝试2：从接口名称提取数字索引（如 "eth0" -> 0, "eth1" -> 1）
              const match = interfaceName.match(/(\d+)$/);
              if (match) {
                const index = match[1];
                if (ifaceNemMap[index] !== undefined) {
                  return ifaceNemMap[index];
                }
              }

              return undefined;
            };

            // 根据接口名称获取正确的NEM ID
            let node1NemId;
            let node2NemId;

            // 获取node1的NEM ID
            if (node1InterfaceName) {
              const nemId = getNemIdByInterfaceName(node1NemInfo.ifaceNemMap, node1InterfaceName);
              if (nemId !== undefined) {
                node1NemId = nemId;
              } else {
                node1NemId = Object.values(node1NemInfo.ifaceNemMap)[0];
              }
            } else {
              node1NemId = Object.values(node1NemInfo.ifaceNemMap)[0];
            }

            // 获取node2的NEM ID
            if (node2InterfaceName) {
              const nemId = getNemIdByInterfaceName(node2NemInfo.ifaceNemMap, node2InterfaceName);
              if (nemId !== undefined) {
                node2NemId = nemId;
              } else {
                node2NemId = Object.values(node2NemInfo.ifaceNemMap)[0];
              }
            } else {
              node2NemId = Object.values(node2NemInfo.ifaceNemMap)[0];
            }

            if (node1NemId && node2NemId) {
              // 从节点1视角获取关于节点2的数据
              const rfData1to2 = emaneStore.getRFSignalByNem(node2NemId, node1NemId);
              const metricData1to2 = emaneStore.getMetricByNem(node2NemId, node1NemId);
              
              // 从节点2视角获取关于节点1的数据
              const rfData2to1 = emaneStore.getRFSignalByNem(node1NemId, node2NemId);
              const metricData2to1 = emaneStore.getMetricByNem(node1NemId, node2NemId);

              // 截断节点名称以防止标签过长
              const shortName1 = node1Name.substring(0, 8);
              const shortName2 = node2Name.substring(0, 8);

              // 格式化数据，优先使用RF信号数据中的SINR，如果没有则使用指标数据
              const sinr1to2 = rfData1to2 && Number.isFinite(rfData1to2.avgSINR) 
                ? `${rfData1to2.avgSINR.toFixed(1)}dB` 
                : (metricData1to2 && Number.isFinite(metricData1to2.sinrAvg) 
                  ? `${metricData1to2.sinrAvg.toFixed(1)}dB` 
                  : 'N/A');
                  
              const sinr2to1 = rfData2to1 && Number.isFinite(rfData2to1.avgSINR) 
                ? `${rfData2to1.avgSINR.toFixed(1)}dB` 
                : (metricData2to1 && Number.isFinite(metricData2to1.sinrAvg) 
                  ? `${metricData2to1.sinrAvg.toFixed(1)}dB` 
                  : 'N/A');
              
              // 获取接收功率
              const rxPower1to2 = rfData1to2 && Number.isFinite(rfData1to2.avgRxPower) 
                ? `${rfData1to2.avgRxPower.toFixed(1)}dBm` 
                : 'N/A';
                
              const rxPower2to1 = rfData2to1 && Number.isFinite(rfData2to1.avgRxPower) 
                ? `${rfData2to1.avgRxPower.toFixed(1)}dBm` 
                : 'N/A';

              // 检查链路模型是否为rfpipe
              const isRfPipeModel = entity.properties.model?.getValue() === "rfpipe";

              // 构建标签文本
              labelText = `${shortName1}→${shortName2}\n信干噪比: ${sinr1to2}`;
              
              // 只有rfpipe模型才显示接收功率
              if (isRfPipeModel) {
                labelText += ` | Rx: ${rxPower1to2}`;
              }
              
              labelText += `\n${shortName2}→${shortName1}\n信干噪比: ${sinr2to1}`;
              
              // 只有rfpipe模型才显示接收功率
              if (isRfPipeModel) {
                labelText += ` | Rx: ${rxPower2to1}`;
              }

              // 根据SINR值更新链路颜色
              // 获取SINR数值（优先使用RF信号数据，否则使用指标数据）
              sinrValue1to2 = rfData1to2 && Number.isFinite(rfData1to2.avgSINR)
                ? rfData1to2.avgSINR
                : (metricData1to2 && Number.isFinite(metricData1to2.sinrAvg)
                  ? metricData1to2.sinrAvg
                  : null);

              sinrValue2to1 = rfData2to1 && Number.isFinite(rfData2to1.avgSINR)
                ? rfData2to1.avgSINR
                : (metricData2to1 && Number.isFinite(metricData2to1.sinrAvg)
                  ? metricData2to1.sinrAvg
                  : null);

              // 只有当至少有一个方向的SINR数据时，才更新链路颜色
              if (sinrValue1to2 !== null || sinrValue2to1 !== null) {
                // 使用双向链路中较差的SINR值来决定颜色（取较小值）
                if (sinrValue1to2 !== null && sinrValue2to1 !== null) {
                  effectiveSinr = Math.min(sinrValue1to2, sinrValue2to1);
                } else if (sinrValue1to2 !== null) {
                  effectiveSinr = sinrValue1to2;
                } else if (sinrValue2to1 !== null) {
                  effectiveSinr = sinrValue2to1;
                }
              }
            }
          }

          // 在外层更新链路颜色，确保所有链路都能根据SINR改变颜色
          // （即使节点没有NEM ID信息也要尝试更新）
          if (effectiveSinr !== null) {
            const linkColor = getSinrColor(effectiveSinr);

            // 同步更新链路和标签的颜色，保持视觉一致性
            // 根据标签实体ID确定正确的链路ID（支持普通链路和子网链路）
            const entityId = entity.id as string;
            let linkId: string | null = null;

            if (entityId.startsWith('label-subnet-')) {
              // 子网链路标签: label-subnet-{subnetId}-link-{node1Id}-{node2Id}
              // 对应链路ID: subnet-{subnetId}-link-{node1Id}-{node2Id}
              linkId = entityId.replace('label-', '');
            } else if (entityId.startsWith('label-link-')) {
              // 普通链路标签: label-link-{node1Id}-{node2Id}
              // 对应链路ID: link-{node1Id}-{node2Id}
              linkId = entityId.replace('label-', '');
            } else {
              // 尝试通过节点ID查找链路
              linkId = `link-${node1Id}-${node2Id}`;
            }

            // 尝试查找链路实体
            let linkEntity = linkEntities.value.get(linkId);

            // 如果没找到，尝试遍历所有链路找到匹配的
            if (!linkEntity) {
              // 遍历所有链路实体，找到包含这两个节点的子网链路
              for (const [id, ent] of linkEntities.value.entries()) {
                if (id.includes(`-${node1Id}-${node2Id}`) || id.includes(`-${node2Id}-${node1Id}`)) {
                  linkEntity = ent;
                  linkId = id;
                  break;
                }
              }
            }

            // 使用CSS颜色字符串进行比较，避免对象引用比较失败导致的闪烁
            const linkColorCss = linkColor.toCssColorString();

            if (linkEntity && linkEntity.polyline) {
              // 只有当颜色发生变化时才更新链路材质，避免闪烁
              const currentMaterial = linkEntity.polyline.material as any;
              let needsUpdate = true;

              if (currentMaterial && currentMaterial.color) {
                const currentColor = currentMaterial.color.getValue ?
                  currentMaterial.color.getValue(viewer.clock.currentTime) :
                  currentMaterial.color;
                if (currentColor && currentColor.toCssColorString &&
                    currentColor.toCssColorString() === linkColorCss) {
                  needsUpdate = false;
                }
              }

              if (needsUpdate) {
                linkEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                  color: linkColor,
                  dashLength: 16.0
                });
              }
            }

            // 只有当颜色发生变化时才更新标签背景颜色，避免闪烁
            // 使用CSS颜色字符串比较
            const newBgColorCss = linkColor.withAlpha(0.5).toCssColorString();
            if (entity.label.backgroundColor) {
              const currentBgColor = entity.label.backgroundColor.getValue ?
                entity.label.backgroundColor.getValue(viewer.clock.currentTime) :
                entity.label.backgroundColor;

              if (!currentBgColor || !currentBgColor.toCssColorString ||
                  currentBgColor.toCssColorString() !== newBgColorCss) {
                entity.label.backgroundColor = linkColor.withAlpha(0.5);
                entity.label.fillColor = getLabelTextColor(linkColor);
              }
            }

            // 同时更新IP标签的背景颜色（只有当颜色变化时才更新）
            // IP标签ID格式: ip-label-{node1Id}-{node2Id} 或 ip-label-subnet-{node1Id}-{node2Id}
            const ipLabelIds = [
              `ip-label-${node1Id}-${node2Id}`,
              `ip-label-${node2Id}-${node1Id}`,
              `ip-label-subnet-${node1Id}-${node2Id}`,
              `ip-label-subnet-${node2Id}-${node1Id}`
            ];

            const ipBgColorCss = linkColor.withAlpha(0.7).toCssColorString();
            ipLabelIds.forEach(ipLabelId => {
              const ipLabelEntity = viewer.entities.getById(ipLabelId) as any;
              if (ipLabelEntity && ipLabelEntity.label && ipLabelEntity.label.backgroundColor) {
                const currentIpBgColor = ipLabelEntity.label.backgroundColor.getValue ?
                  ipLabelEntity.label.backgroundColor.getValue(viewer.clock.currentTime) :
                  ipLabelEntity.label.backgroundColor;

                if (!currentIpBgColor || !currentIpBgColor.toCssColorString ||
                    currentIpBgColor.toCssColorString() !== ipBgColorCss) {
                  ipLabelEntity.label.backgroundColor = linkColor.withAlpha(0.7);
                  ipLabelEntity.label.fillColor = getLabelTextColor(linkColor);
                }
              }
            });
          }

          entity.label.text = labelText;
        }
      }
    } catch (error) {
      console.warn('[链路监控] 更新链路标签时发生错误:', error);
    }
  };

  // 重置所有无线链路颜色为初始状态（UNKNOWN/橙色）
  const resetWirelessLinkColors = () => {
    if (!viewer || viewer.isDestroyed()) return;

    try {
      const defaultColor = SINR_COLORS.UNKNOWN;
      const defaultLabelFillColor = getLabelTextColor(defaultColor);

      // 1. 重置所有无线链路实体的材质颜色
      linkEntities.value.forEach((entity) => {
        if (!entity.polyline) return;

        // 检查是否为无线链路（使用虚线材质 PolylineDashMaterialProperty）
        const material = entity.polyline.material as any;
        if (material && material instanceof Cesium.PolylineDashMaterialProperty) {
          entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
            color: defaultColor,
            dashLength: 16.0
          });
        }
      });

      // 2. 重置所有无线链路数据标签的文本和背景颜色
      const entities = viewer.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i] as any;

        // 重置链路数据标签
        if (entity.properties?.isLinkDataLabel?.getValue()) {
          if (entity.label) {
            entity.label.text = '加载中...';
            entity.label.fillColor = defaultLabelFillColor;
            entity.label.backgroundColor = defaultColor.withAlpha(0.5);
          }
        }

        // 重置无线链路关联的IP标签背景颜色
        if (entity.id && typeof entity.id === 'string' && entity.id.startsWith('ip-label-')) {
          if (entity.label) {
            const parsedIpLabel = parseIpLabelEntityId(entity.id);
            if (parsedIpLabel) {
              const ipBgBase = parsedIpLabel.isSubnet
                ? SINR_COLORS.UNKNOWN
                : (getRegularLink(parsedIpLabel.node1Id, parsedIpLabel.node2Id)?.type === 'WIRELESS' ? SINR_COLORS.UNKNOWN : Cesium.Color.fromCssColorString('#1976d2'));
              entity.label.fillColor = getLabelTextColor(ipBgBase);
              entity.label.backgroundColor = parsedIpLabel.isSubnet
                ? SINR_COLORS.UNKNOWN.withAlpha(0.7)
                : getRegularLinkIpLabelBackgroundColor(getRegularLink(parsedIpLabel.node1Id, parsedIpLabel.node2Id)?.type);
            }
          }
        }
      }

      refreshFaultedLinkStyles();
    } catch (error) {
      console.warn('[链路监控] 重置无线链路颜色时发生错误:', error);
    }
  };

  // 设置定时器定期更新链路标签
  const updateInterval = 2000; // 更新间隔2秒
  let updateTimer: number | null = null;
  let isUpdating = false; // 添加标志位来跟踪更新状态
  let lastUpdateTime = 0; // 上次更新时间，用于防抖
  const minUpdateInterval = 500; // 最小更新间隔500ms，避免过于频繁更新导致闪烁

  // 带防抖的更新函数
  const throttledUpdateLinkLabels = () => {
    const now = Date.now();
    if (now - lastUpdateTime < minUpdateInterval) {
      return; // 跳过过于频繁的更新
    }
    lastUpdateTime = now;
    updateLinkLabels();
  };

  // 修改开始定期更新函数
  const startUpdating = () => {
    // 如果已经在更新中，先停止
    if (isUpdating) {
      stopUpdating();
    }

    // 确保viewer存在且有效
    if (!viewer || viewer.isDestroyed()) {
      console.warn('[无线链路监控] Viewer不可用，无法启动标签更新');
      return;
    }

    isUpdating = true;

    // 延迟首次更新，给链路时间保持初始颜色
    // 这样可以确保链路显示为UNKNOWN（橙色），直到有足够的SINR数据
    setTimeout(() => {
      if (isUpdating && viewer && !viewer.isDestroyed()) {
        throttledUpdateLinkLabels();
      }
    }, 1000); // 延迟1秒

    updateTimer = window.setInterval(() => {
      // 每次更新前检查viewer是否有效
      if (!viewer || viewer.isDestroyed()) {
        stopUpdating();
        return;
      }
      throttledUpdateLinkLabels();
    }, updateInterval);
  };

  // 停止定期更新
  const stopUpdating = () => {
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    isUpdating = false;
  };

  // 修改监听逻辑，确保数据变化时立即更新（带防抖）
  watch(
    () => emaneStore.lastUpdated, // 监听全局更新时间戳
    () => {
      // 确保viewer存在且有效
      if (!viewer || viewer.isDestroyed()) {
        stopUpdating();
        return;
      }
      throttledUpdateLinkLabels();
    }
  );

  // 当组件卸载时清理定时器
  // onUnmounted 中已有 stopUpdating()

  // 初始化时开始更新
  startUpdating();

  // 处理实体选择变化
  if (viewer) {
    // 监听实体选择变化事件
    selectedEntityChangedListener = viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
      
      // 首先，如果之前有无人机正在显示范围，则清除它的范围显示
      if (currentDroneWithRange.value) {
        
        // 找到并移除对应的范围实体
        const entityId = currentDroneWithRange.value.id;
        const rangeEntityId = `range-${entityId}`;
        const rangeEntity = viewer.entities.getById(rangeEntityId);
        if (rangeEntity) {
          viewer.entities.remove(rangeEntity);
        }
        
        // 清除引用关系
        if (currentDroneWithRange.value) {
          delete (currentDroneWithRange.value as any)._rangeEntity;
        }
        
        currentDroneWithRange.value = null;
      }
      
      // 如果有干扰节点正在显示波束，清除它
      if (currentInterferenceWithBeam.value) {
        const nodeId = Number(currentInterferenceWithBeam.value.id);
        
        // 标记该实体不再显示波束
        if (currentInterferenceWithBeam.value.properties) {
          currentInterferenceWithBeam.value.properties.isShowingBeam = false;
        }
        
        // 使用通用函数清理资源
        cleanupInterferenceBeamResources(nodeId);
      }

      if (selectedEntity && selectedEntity.id) {
        const nodeIdString = String(selectedEntity.id).replace('link-', '');
        const nodeId = !isNaN(Number(nodeIdString)) ? Number(nodeIdString) : -1;
        const node: Node | undefined = topoStore.topoData?.nodes.find((n: Node) => n.id === nodeId);

        if (node) {
          if (node.type === 'DRONE' && nodeEntities.value.has(nodeId)) {
            // 点击无人机节点不再自动显示通信范围球体
          }
          else if (node.type === 'INODE' && nodeEntities.value.has(nodeId)) {
            // 点击干扰节点不再自动显示干扰波束
          }
          else {
            // 如果选中的不是DRONE或INODE，或者节点信息不完整，确保清除了之前的范围（已在开头处理）
          }
        } else {
          // 没有找到对应的节点
        }
      } else {
        // 没有选中任何实体 (例如点击了地图空白处)，确保清除了之前的范围（已在开头处理）
      }
    });

    // 设置屏幕空间事件处理器以处理地图点击
    // 恢复 ScreenSpaceEventHandler 的直接创建，因为 viewer.scene.canvas 在 viewer 传递时应该已经可用。
    // 之前的 readyPromise 使用不当导致了linter错误。
    if (viewer && viewer.scene && viewer.scene.canvas && !viewer.isDestroyed()) {
        screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        screenSpaceEventHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          const pickedObject = viewer.scene.pick(movement.position);
          if (!pickedObject && viewer.selectedEntity) {
            viewer.selectedEntity = undefined; 
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else {
        console.warn('[useCesiumEntities] 尝试设置屏幕空间事件处理器时，Viewer 或 scene 不可用或已销毁。');
    }
  }

  // 根据方位角和俯仰角计算方向向量
  const calculateDirectionFromAngles = (azimuth: number, elevation: number): Cesium.Cartesian3 => {
    // 将角度转换为弧度
    const azimuthRad = azimuth * (Math.PI / 180);
    const elevationRad = elevation * (Math.PI / 180);
    
    // 计算方向向量
    const x = Math.sin(azimuthRad) * Math.cos(elevationRad);
    const y = Math.cos(azimuthRad) * Math.cos(elevationRad);
    const z = Math.sin(elevationRad);
    
    return new Cesium.Cartesian3(x, y, z);
  };

  // 解析角度区间字符串为起始和结束值
  const parseAngleRange = (rangeStr: string | number | undefined, defaultStart: number, defaultEnd: number): {start: number, end: number} => {
    // 如果输入是数字，则视为兼容旧格式，使用该值作为中间值，前后各偏移30度创建一个区间
    if (typeof rangeStr === 'number') {
      return {
        start: Math.max(defaultStart, rangeStr - 30),
        end: Math.min(defaultEnd, rangeStr + 30)
      };
    }
    
    // 如果是字符串，尝试解析为区间
    if (typeof rangeStr === 'string') {
      const parts = rangeStr.split(',');
      if (parts.length === 2) {
        const start = parseFloat(parts[0]);
        const end = parseFloat(parts[1]);
        
        if (!isNaN(start) && !isNaN(end)) {
          return { start, end };
        }
      }
    }
    
    // 默认返回完整区间
    return { start: defaultStart, end: defaultEnd };
  };

  // 创建干扰波效果 - 完全重写
  const createInterferenceBeam = (nodeId: number, entity: Cesium.Entity): void => {
    if (!viewer) return;
    
    // 获取干扰节点配置
    const interferenceConfig = interferenceStore.getConfigByNodeId(nodeId);
    if (!interferenceConfig) {
      console.warn(`无法创建干扰波：找不到节点${nodeId}的干扰配置`);
      return;
    }
    
    // 检查干扰节点状态
    if (interferenceConfig.status !== 'RUNTIME') {
      console.warn(`无法创建干扰波：节点${nodeId}状态不是RUNTIME，当前状态: ${interferenceConfig.status}`);
      return;
    }
    
    
    // 清除当前节点的所有波束实体
    if (interferenceBeamEntities.value.has(nodeId)) {
      const oldEntities = interferenceBeamEntities.value.get(nodeId);
      if (oldEntities) {
        oldEntities.forEach(oldEntity => {
          // 从跟踪集合中移除ID
          if (oldEntity.id) {
            createdInterferenceEntities.delete(String(oldEntity.id));
          }
          viewer.entities.remove(oldEntity);
        });
      }
      interferenceBeamEntities.value.delete(nodeId);
    }
    
    // 获取节点位置
    const position = entity.position?.getValue(viewer.clock.currentTime);
    if (!position) {
      console.warn(`无法获取干扰节点${nodeId}的位置`);
      return;
    }
    
    // 解析干扰参数
    const txPowerDbm = parseFloat(interferenceConfig.interferePowerdb) || 30; // 默认30dBm
    // 从interfereFreq获取频率 (MHz)，转换为Hz，否则使用默认值 2.4 GHz
    const frequencyHz = parseFloat(interferenceConfig.interfereFreq)  || INTERFERENCE_BEAM_CONFIG.defaultFrequencyHz;
    // 使用固定的接收功率阈值
    const rxPowerDbm = INTERFERENCE_BEAM_CONFIG.rxPowerThreshold;
    
    // 解析方位角和俯仰角区间
    const azimuthRange = parseAngleRange(interferenceConfig.azimuth, 0, 360);

    const elevationRange = parseAngleRange(interferenceConfig.elevation, -90, 90);
    
    
    // 定义本地的干扰范围计算函数
    const calculateInterferenceRange = (txPowerDbm: number, frequencyHz: number): number => {
      // 使用干扰节点的参数
      const interferePowerdb = txPowerDbm;
      const interfereFreq = frequencyHz;
      
      // 获取所有可能受干扰影响的接收节点的emane参数
      const emaneParams = getEmaneParametersFromReceivingNodes();
      
      // 使用新公式计算范围
      const range = zeroImpactDistanceComplete(
        interferePowerdb, 
        emaneParams.systemnoisefigure, 
        interfereFreq, 
        emaneParams.randomlossenvironment, 
        emaneParams.threshold
      ) * 100
      
      
      // 确保范围在合理区间内
      return Math.min(Math.max(range, INTERFERENCE_BEAM_CONFIG.minRange), INTERFERENCE_BEAM_CONFIG.maxRange);
    };
    
    // 获取接收节点的emane参数函数
    const getEmaneParametersFromReceivingNodes = () => {
      let systemnoisefigure = 4;
      let randomlossenvironment = 'none'; 
      const threshold = 0.001;
      
      // 查找场景中的emane节点，获取它们的配置参数
      if (topoStore.topoData?.nodes) {
        const emaneNodes = topoStore.topoData.nodes.filter((node: any) => node.type === 'EMANE');
        
        // 存储所有找到的系统噪声系数，以便选择最敏感的（最小值）
        const systemnoisefigures: number[] = [];
        
        for (const emaneNode of emaneNodes) {
          if (emaneNode.emane_configs && Array.isArray(emaneNode.emane_configs)) {
            // 遍历emane配置查找systemnoisefigure和randomlossenvironment参数
            for (const config of emaneNode.emane_configs) {
              if (config.config) {
                // 查找systemnoisefigure参数
                if (config.config.systemnoisefigure && config.config.systemnoisefigure.value) {
                  const value = config.config.systemnoisefigure.value;
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed)) {
                    systemnoisefigures.push(parsed);
                  }
                }
                
                // 查找randomlossenvironment参数 (可能的参数名)
                if (config.config.randomlossenvironment && config.config.randomlossenvironment.value) {
                  randomlossenvironment = config.config.randomlossenvironment.value;
                }
                
                // 也可能是pathloss相关的配置
                if (config.config.pathlossmode && config.config.pathlossmode.value) {
                  const pathlossMode = config.config.pathlossmode.value;
                  if (pathlossMode === 'pathloss' || pathlossMode === 'urban') {
                    randomlossenvironment = 'urban';
                  }
                }
                
                // 检查其他可能的环境损耗参数名
                if (config.config.environment && config.config.environment.value) {
                  randomlossenvironment = config.config.environment.value;
                }
              }
            }
          }
        }
        
        // 如果找到了多个系统噪声系数，选择最小值（最敏感的接收机）
        if (systemnoisefigures.length > 0) {
          systemnoisefigure = Math.min(...systemnoisefigures);
        } else {
        }
      }      
      
      return {
        systemnoisefigure,
        randomlossenvironment,
        threshold
      };
    };
    
    // 使用新的范围计算函数计算干扰范围（球体半径）
    // 根据发射功率、接收功率阈值、频率计算传播距离
    const sphereRadius = calculateInterferenceRange(txPowerDbm, frequencyHz);
    
    
    // 创建实体集合
    const beamEntities: Cesium.Entity[] = [];
    
    // 确保实体ID唯一
    const getUniqueId = (baseId: string): string => {
      let uniqueId = `${baseId}-${nodeId}`;
      let counter = 1;
      
      // 如果ID已存在，则添加计数后缀
      while (createdInterferenceEntities.has(uniqueId)) {
        uniqueId = `${baseId}-${nodeId}-${counter}`;
        counter++;
      }
      
      // 记录创建的ID
      createdInterferenceEntities.add(uniqueId);
      return uniqueId;
    };
    
    // 1. 创建中心点光晕效果 (如果需要)
    if (INTERFERENCE_BEAM_CONFIG.centerGlowEffect && INTERFERENCE_BEAM_CONFIG.centerGlowBaseSize > 0) {
      const glowId = getUniqueId('interference-glow');
      const glowEntity = viewer.entities.add({
        id: glowId,
        name: `干扰光晕-${nodeId}`,
        position: position,
        ellipsoid: {
          radii: new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
            if (!viewer || !viewer.clock || !time) return new Cesium.Cartesian3(
              INTERFERENCE_BEAM_CONFIG.centerGlowBaseSize, 
              INTERFERENCE_BEAM_CONFIG.centerGlowBaseSize, 
              INTERFERENCE_BEAM_CONFIG.centerGlowBaseSize
            );
            
            const seconds = Cesium.JulianDate.secondsDifference(
              time, 
              viewer.clock.startTime // 使用viewer.clock.startTime
            );
            
            const baseSize = INTERFERENCE_BEAM_CONFIG.centerGlowBaseSize;
            const pulse = Math.sin(seconds * Math.PI * INTERFERENCE_BEAM_CONFIG.centerGlowPulseSpeed) * 0.5 + 0.5;
            const size = baseSize * (1 + pulse * 0.3);
            
            return new Cesium.Cartesian3(size, size, size);
          }, false),
          material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
            if (!viewer || !viewer.clock || !time) return INTERFERENCE_BEAM_CONFIG.centerGlowAccentColor;
            
            const seconds = Cesium.JulianDate.secondsDifference(
              time, 
              viewer.clock.startTime // 使用viewer.clock.startTime
            );
            
            const pulse = Math.sin(seconds * Math.PI * INTERFERENCE_BEAM_CONFIG.centerGlowPulseSpeed) * 0.5 + 0.5;
            
            return Cesium.Color.lerp(
              INTERFERENCE_BEAM_CONFIG.mainColor, 
              INTERFERENCE_BEAM_CONFIG.centerGlowAccentColor,
              pulse, 
              new Cesium.Color()
            );
          }, false)),
          outline: true,
          outlineColor: INTERFERENCE_BEAM_CONFIG.centerGlowAccentColor,
          outlineWidth: 1.0, // 调整光晕轮廓宽度
          slicePartitions: INTERFERENCE_BEAM_CONFIG.segmentCount / 2, // 光晕效果可以稍微粗糙一些
          stackPartitions: INTERFERENCE_BEAM_CONFIG.segmentCount / 2,
        }
      });
      beamEntities.push(glowEntity);
    }

    // 2. 创建干扰波束主体
    // 方位角 (azimuth) 对应 EllipsoidGraphics 的 clock angle
    //   0° 正北 (Cesium +Y) -> Cesium Clock 90° (PI/2)
    //   90° 正东 (Cesium +X) -> Cesium Clock 0° (0)
    //   180° 正南 (Cesium -Y) -> Cesium Clock 270° (3PI/2)
    //   270° 正西 (Cesium -X) -> Cesium Clock 180° (PI)
    // 转换: cesiumClock = (90 - azimuth + 360) % 360
    // 注意: EllipsoidGraphics 的 clock 是从 +X 轴逆时针旋转

    // 将用户方位角转换为Cesium clock角度（度）
    // user_azimuth_start: 用户定义的起始方位角 (顺时针, 0=北)
    // user_azimuth_end: 用户定义的结束方位角 (顺时针, 0=北)
    const userAzStart = azimuthRange.start;
    const userAzEnd = azimuthRange.end;

    // cesium_equivalent_for_user_start: 用户起始方位角在Cesium中的等效clock角 (逆时针, 0=东)
    const cesiumEqUserStartDeg = (90 - userAzStart + 360) % 360;
    // cesium_equivalent_for_user_end: 用户结束方位角在Cesium中的等效clock角 (逆时针, 0=东)
    const cesiumEqUserEndDeg = (90 - userAzEnd + 360) % 360;


    // Cesium的ellipsoid从minimumClock逆时针扫描到maximumClock
    // 用户顺时针扫描从 userAzStart 到 userAzEnd
    // 等效于Cesium从 cesiumEqUserEndDeg 逆时针扫描到 cesiumEqUserStartDeg

    let minimumClockDeg = cesiumEqUserEndDeg;
    let maximumClockDeg = cesiumEqUserStartDeg;


    // 特殊情况处理：完整圆周
    let isFullCircle = false;
    if (Math.abs(userAzEnd - userAzStart) >= 359.9 && userAzStart < userAzEnd) { // e.g. 0, 360 or 0, 720
        minimumClockDeg = 0;
        maximumClockDeg = 360;
        isFullCircle = true;
    } else if (userAzStart === userAzEnd) { // e.g. 90,90 - means full circle
        minimumClockDeg = 0;
        maximumClockDeg = 360;
        isFullCircle = true;
    }

    // 如果不是完整圆，并且根据初始计算 minimumClockDeg > maximumClockDeg (通常意味着期望的扫描弧度 > 180度)
    // 则尝试通过将 maximumClockDeg 增加360度来强制长路径扫描。
    if (!isFullCircle && minimumClockDeg > maximumClockDeg) {
        maximumClockDeg += 360;
    }

    let minimumClock = Cesium.Math.toRadians(minimumClockDeg);
    let maximumClock = Cesium.Math.toRadians(maximumClockDeg);


    // 俯仰角 (elevation) 对应 EllipsoidGraphics 的 cone angle
    //   +90° 向上 (天顶, Cesium +Z) -> Cesium Cone 0° (0)
    //   0° 水平 (Cesium XY平面) -> Cesium Cone 90° (PI/2)
    //   -90° 向下 (地心, Cesium -Z) -> Cesium Cone 180° (PI)
    // 转换: cesiumCone = (90 - elevation)
    // minimumCone 是从+Z轴开始的最小角度，maximumCone 是最大角度
    
    // 用户输入的 elevation.start 应该是俯仰角的下限，elevation.end 是上限
    // 例如 (0, 90) 表示从水平向上到天顶
    // cesiumConeStart = 90 - elevation.end
    // cesiumConeEnd = 90 - elevation.start
    let minimumCone = Cesium.Math.toRadians(90 - elevationRange.end);
    let maximumCone = Cesium.Math.toRadians(90 - elevationRange.start);

    // 确保 minimumCone <= maximumCone
    if (minimumCone > maximumCone) {
        [minimumCone, maximumCone] = [maximumCone, minimumCone];
    }
    // 确保 cone 角度在 [0, PI] 范围内
    minimumCone = Cesium.Math.clamp(minimumCone, 0, Math.PI);
    maximumCone = Cesium.Math.clamp(maximumCone, 0, Math.PI);
    

    const sphereId = getUniqueId('interference-main-beam');
    const sphereEntity = viewer.entities.add({
      id: sphereId,
      name: `干扰波束-${nodeId}`,
      position: position,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(0, 0, 0) // 默认方向，EllipsoidGraphics的角度参数会处理方向
      ),
      ellipsoid: {
        radii: new Cesium.Cartesian3(sphereRadius, sphereRadius, sphereRadius),
        minimumClock: minimumClock,
        maximumClock: maximumClock,
        minimumCone: minimumCone,
        maximumCone: maximumCone,
        material: INTERFERENCE_BEAM_CONFIG.mainColor.withAlpha(0.4), // 增加透明度，方便观察
        outline: true,
        outlineColor: INTERFERENCE_BEAM_CONFIG.edgeColor,
        outlineWidth: 1.5,
        slicePartitions: INTERFERENCE_BEAM_CONFIG.segmentCount,
        stackPartitions: INTERFERENCE_BEAM_CONFIG.segmentCount,
      },
    });
    beamEntities.push(sphereEntity);

    // 3. 创建从球心扩散的脉冲波效果
    if (INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveEffect && INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveCount > 0) {
      for (let i = 0; i < INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveCount; i++) {
        const pulseWaveId = getUniqueId(`interference-pulse-wave-${i}`);
        const delay = (INTERFERENCE_BEAM_CONFIG.emanatingPulseWavePeriod / INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveCount) * i;

        const pulseWaveEntity = viewer.entities.add({
          id: pulseWaveId,
          name: `干扰脉冲波-${nodeId}-${i}`,
          position: position,
          orientation: Cesium.Transforms.headingPitchRollQuaternion(
            position,
            new Cesium.HeadingPitchRoll(0, 0, 0)
          ),
          ellipsoid: {
            radii: new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
              if (!viewer || !viewer.clock || !time) return new Cesium.Cartesian3(0,0,0); // 开始时不可见
              const seconds = Cesium.JulianDate.secondsDifference(time, viewer.clock.startTime);
              const timeInCycle = (seconds + delay) % INTERFERENCE_BEAM_CONFIG.emanatingPulseWavePeriod;
              const t = timeInCycle / INTERFERENCE_BEAM_CONFIG.emanatingPulseWavePeriod; // 0 to 1

              const currentRadius = sphereRadius * t;
              return new Cesium.Cartesian3(currentRadius, currentRadius, currentRadius);
            }, false),
            minimumClock: minimumClock,
            maximumClock: maximumClock,
            minimumCone: minimumCone,
            maximumCone: maximumCone,
            material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
              if (!viewer || !viewer.clock || !time) return Cesium.Color.TRANSPARENT;
              const seconds = Cesium.JulianDate.secondsDifference(time, viewer.clock.startTime);
              const timeInCycle = (seconds + delay) % INTERFERENCE_BEAM_CONFIG.emanatingPulseWavePeriod;
              const t = timeInCycle / INTERFERENCE_BEAM_CONFIG.emanatingPulseWavePeriod; // 0 to 1
              
              // 脉冲波在接近表面时逐渐变淡
              const alpha = INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveColor.alpha * (1 - t) * (1 - t); // 透明度随t的平方反比变化
              return INTERFERENCE_BEAM_CONFIG.emanatingPulseWaveColor.withAlpha(alpha);
            }, false)),
            outline: false, // 脉冲波通常不需要轮廓
            slicePartitions: INTERFERENCE_BEAM_CONFIG.segmentCount,
            stackPartitions: INTERFERENCE_BEAM_CONFIG.segmentCount,
          }
        });
        beamEntities.push(pulseWaveEntity);
      }
    }

    
    // 保存所有创建的实体
    interferenceBeamEntities.value.set(nodeId, beamEntities);
    
    // 设置当前干扰节点
    currentInterferenceWithBeam.value = entity;
    
    // 确保时钟在运行，用于动画效果
    if (viewer) {
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1.0;
      viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    }
  };
  
  // 辅助函数：创建部分球面段
  const createPartialSphereSegment = (
    nodeId: number,
    center: Cesium.Cartesian3,
    radius: number,
    azimuthStart: number,
    azimuthEnd: number,
    elevationStart: number,
    elevationEnd: number,
    entityCollection: Cesium.Entity[],
    getUniqueId: (baseId: string) => string
  ): void => {
    if (!viewer) return;
    
    // 创建唯一ID
    const segmentId = getUniqueId(`interference-segment-${azimuthStart.toFixed(0)}-${azimuthEnd.toFixed(0)}-${elevationStart.toFixed(0)}-${elevationEnd.toFixed(0)}`);
    
    // 计算段中心点角度
    const centerAzimuth = (azimuthStart + azimuthEnd) / 2;
    const centerElevation = (elevationStart + elevationEnd) / 2;
    
    // 从球坐标转为笛卡尔坐标
    const azimuthRad = Cesium.Math.toRadians(centerAzimuth);
    const elevationRad = Cesium.Math.toRadians(centerElevation);
    
    // 计算方向向量 (球坐标系)
    const dirX = Math.cos(elevationRad) * Math.sin(azimuthRad);
    const dirY = Math.cos(elevationRad) * Math.cos(azimuthRad);
    const dirZ = Math.sin(elevationRad);
    
    // 计算实体位置 - 在球面上的点
    const segmentPosition = new Cesium.Cartesian3(
      center.x + radius * dirX * 0.95, // 稍微缩小一点，避免超出边界
      center.y + radius * dirY * 0.95,
      center.z + radius * dirZ * 0.95
    );
    
    // 计算实体尺寸 - 根据角度范围大小
    const azSpan = Cesium.Math.toRadians(azimuthEnd - azimuthStart);
    const elSpan = Cesium.Math.toRadians(elevationEnd - elevationStart);
    
    // 计算球面上的弧长
    const azimuthArcLength = radius * Math.sin(azSpan/2);
    const elevationArcLength = radius * Math.sin(elSpan/2);
    
    // 确保最小尺寸
    const minSize = radius * 0.15; // 至少是球体半径的15%
    const segmentSize = Math.max(minSize, Math.min(azimuthArcLength, elevationArcLength));
    
    // 创建贴片实体 - 使用扁球体形状以适应角度变化
    const patchEntity = viewer.entities.add({
      id: segmentId,
      name: `干扰部分-${nodeId}-${centerAzimuth.toFixed(0)}-${centerElevation.toFixed(0)}`,
      position: segmentPosition,
      ellipsoid: {
        radii: new Cesium.Cartesian3(segmentSize, segmentSize, segmentSize),
        material: INTERFERENCE_BEAM_CONFIG.mainColor.withAlpha(0.5) // 增加透明度以便看到重叠效果
      }
    });
    
    // 保存到实体集合
    entityCollection.push(patchEntity);
  };
  
  // 辅助函数：创建方位角线的位置点
  const createAzimuthLinePositions = (
    center: Cesium.Cartesian3,
    radius: number,
    azimuth: number,
    minElevation: number,
    maxElevation: number,
    pointCount: number
  ): Cesium.Cartesian3[] => {
    const positions: Cesium.Cartesian3[] = [];
    const azimuthRad = Cesium.Math.toRadians(azimuth);
    
    // 在指定的方位角上，沿着俯仰角变化生成点
    const minElevRad = Cesium.Math.toRadians(minElevation);
    const maxElevRad = Cesium.Math.toRadians(maxElevation);
    const elevStep = (maxElevRad - minElevRad) / (pointCount - 1);
    
    for (let i = 0; i < pointCount; i++) {
      const elevRad = minElevRad + elevStep * i;
      
      // 球坐标系转笛卡尔坐标
      const x = radius * Math.cos(elevRad) * Math.sin(azimuthRad);
      const y = radius * Math.cos(elevRad) * Math.cos(azimuthRad);
      const z = radius * Math.sin(elevRad);
      
      // 相对于中心点的位置
      const position = new Cesium.Cartesian3(
        center.x + x,
        center.y + y,
        center.z + z
      );
      
      positions.push(position);
    }
    
    return positions;
  };
  
  // 辅助函数：创建俯仰角线的位置点
  const createElevationLinePositions = (
    center: Cesium.Cartesian3,
    radius: number,
    elevation: number,
    minAzimuth: number,
    maxAzimuth: number,
    pointCount: number
  ): Cesium.Cartesian3[] => {
    const positions: Cesium.Cartesian3[] = [];
    const elevRad = Cesium.Math.toRadians(elevation);
    
    // 在指定的俯仰角上，沿着方位角变化生成点
    const minAzimuthRad = Cesium.Math.toRadians(minAzimuth);
    const maxAzimuthRad = Cesium.Math.toRadians(maxAzimuth);
    let azimuthStep = (maxAzimuthRad - minAzimuthRad) / (pointCount - 1);
    
    // 处理跨越0度/360度的情况
    if (maxAzimuth - minAzimuth > 180 && maxAzimuth - minAzimuth < 360) {
      azimuthStep = (maxAzimuthRad - minAzimuthRad + 2 * Math.PI) % (2 * Math.PI) / (pointCount - 1);
    }
    
    for (let i = 0; i < pointCount; i++) {
      let azimuthRad = (minAzimuthRad + azimuthStep * i) % (2 * Math.PI);
      
      // 球坐标系转笛卡尔坐标
      const x = radius * Math.cos(elevRad) * Math.sin(azimuthRad);
      const y = radius * Math.cos(elevRad) * Math.cos(azimuthRad);
      const z = radius * Math.sin(elevRad);
      
      // 相对于中心点的位置
      const position = new Cesium.Cartesian3(
        center.x + x,
        center.y + y,
        center.z + z
      );
      
      positions.push(position);
    }
    
    return positions;
  };

  // 清理特定节点的干扰波束资源
  const cleanupInterferenceBeamResources = (nodeId: number) => {
    if (!viewer) return;
    
    
    // 获取节点实体，更新其显示波束状态
    const entity = nodeEntities.value.get(nodeId);
    if (entity && entity.properties) {
      entity.properties.isShowingBeam = false;
    }
    
    // 清除该节点的所有波束实体
    if (interferenceBeamEntities.value.has(nodeId)) {
      const entities = interferenceBeamEntities.value.get(nodeId);
      if (entities) {
        entities.forEach(entity => {
          // 从跟踪集合中移除ID
          if (entity.id) {
            createdInterferenceEntities.delete(String(entity.id));
          }
          
          // 检查是否有关联的primitive需要清理
          if ((entity as any)._primitive && viewer.scene) {
            viewer.scene.primitives.remove((entity as any)._primitive);
            (entity as any)._primitive = undefined;
          }
          
          // 清理每帧回调
          if ((entity as any)._pulseCallback) {
            (entity as any)._pulseCallback();
            (entity as any)._pulseCallback = undefined;
          }
          
          viewer.entities.remove(entity);
        });
      }
      interferenceBeamEntities.value.delete(nodeId);
    }
    
    // 清理场景中可能残留的所有脉冲波图元
    if (viewer.scene && viewer.scene.primitives) {
      const primitivesToRemove = [];
      const primitives = viewer.scene.primitives;
      
      // 遍历所有图元，找出与该节点相关的图元
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        if (primitive && primitive.id && typeof primitive.id === 'string' && 
            (primitive.id.indexOf(`interference-sphere-instance-${nodeId}`) !== -1 ||
             primitive.id.indexOf(`pulse-geometry-${nodeId}`) !== -1)) {
          primitivesToRemove.push(primitive);
        }
      }
      
      // 移除找到的图元
      primitivesToRemove.forEach(primitive => {
        primitives.remove(primitive);
      });
      
      if (primitivesToRemove.length > 0) {
      }
    }
    
    // 如果当前选中的干扰节点是该节点，清除它
    if (currentInterferenceWithBeam.value && currentInterferenceWithBeam.value.id === String(nodeId)) {
      currentInterferenceWithBeam.value = null;
    }
  };

  // 更新所有干扰波束
  const updateInterferenceBeams = (forceShow: boolean = false) => {
    // 获取所有干扰节点并更新其波束状态
    if (!topoStore.topoData?.nodes) return;
    
    const interferenceNodes = topoStore.topoData.nodes.filter((n: Node) => n.type === 'INODE');
    
    // 记录当前存在的干扰节点ID
    const currentNodeIds = new Set<number>();
    interferenceNodes.forEach((node: Node) => {
      currentNodeIds.add(node.id);
    });
    
    // 清理已不存在或不在运行的干扰节点
    interferenceBeamEntities.value.forEach((_, nodeId) => {
      if (!currentNodeIds.has(nodeId)) {
        // 节点不存在了，清理资源
        cleanupInterferenceBeamResources(nodeId);
      }
    });
    
    // 更新所有干扰节点状态
    interferenceNodes.forEach((node: Node) => {
      const config = interferenceStore.getConfigByNodeId(node.id);
      const entity = nodeEntities.value.get(node.id);
      
      if (!entity) {
        return;
      }
      
      // 检查节点是否正在显示波束（通过属性标记）
      const isShowingBeam = entity.properties?.isShowingBeam?.getValue() || false;
      
      // 如果节点正在运行干扰，且是当前选中的节点或强制显示，则创建波束
      if (config && config.status === 'RUNTIME' && (isShowingBeam || forceShow)) {
        if (!interferenceBeamEntities.value.has(node.id)) {
          createInterferenceBeam(node.id, entity);
        }
      } 
      // 如果节点不在运行干扰，但已创建波束，则移除波束
      else if (interferenceBeamEntities.value.has(node.id)) {
        cleanupInterferenceBeamResources(node.id);
      }
    });
  };

  // 生成两点之间的弧线位置
  const generateArcPositions = (
    center: Cesium.Cartesian3,
    start: Cesium.Cartesian3,
    end: Cesium.Cartesian3,
    segments: number
  ): Cesium.Cartesian3[] => {
    const positions: Cesium.Cartesian3[] = [];
    
    // 计算圆弧需要的参数
    const v1 = Cesium.Cartesian3.subtract(start, center, new Cesium.Cartesian3());
    const v2 = Cesium.Cartesian3.subtract(end, center, new Cesium.Cartesian3());
    
    const radius1 = Cesium.Cartesian3.magnitude(v1);
    const radius2 = Cesium.Cartesian3.magnitude(v2);
    
    // 归一化向量
    const dir1 = Cesium.Cartesian3.normalize(v1, new Cesium.Cartesian3());
    const dir2 = Cesium.Cartesian3.normalize(v2, new Cesium.Cartesian3());
    
    // 计算夹角
    const dotProduct = Cesium.Cartesian3.dot(dir1, dir2);
    const angle = Math.acos(Cesium.Math.clamp(dotProduct, -1.0, 1.0));
    
    // 沿弧线生成点
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const currentAngle = angle * t;
      
      // 使用球面线性插值
      const sinRatio = Math.sin(currentAngle) / Math.sin(angle);
      const cosRatio = Math.sin(angle - currentAngle) / Math.sin(angle);
      
      // 计算当前点的方向
      const currentDir = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(dir1, cosRatio, currentDir);
      const temp = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(dir2, sinRatio, temp);
      Cesium.Cartesian3.add(currentDir, temp, currentDir);
      
      // 计算当前点位置，半径使用线性插值
      const currentRadius = radius1 * (1 - t) + radius2 * t;
      const currentPos = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(currentDir, currentRadius, currentPos);
      Cesium.Cartesian3.add(center, currentPos, currentPos);
      
      positions.push(currentPos);
    }
    
    return positions;
  };

  // 显示所有节点的特殊效果（无人机通信范围和干扰节点波束）
  const showAllSpecialEffects = () => {
    if (!viewer) return;
    
    
    // 1. 清除当前显示的效果
    // 清除无人机通信范围
    if (currentDroneWithRange.value) {
      const entityId = currentDroneWithRange.value.id;
      const rangeEntityId = `range-${entityId}`;
      const rangeEntity = viewer.entities.getById(rangeEntityId);
      if (rangeEntity) {
        viewer.entities.remove(rangeEntity);
      }
      currentDroneWithRange.value = null;
    }
    
    // 清除当前干扰波束
    if (currentInterferenceWithBeam.value) {
      const nodeId = Number(currentInterferenceWithBeam.value.id);
      cleanupInterferenceBeamResources(nodeId);
    }
    
    // 2. 获取所有无人机节点并显示通信范围
    if (topoStore.topoData?.nodes) {
      const droneNodes = topoStore.topoData.nodes.filter((n: Node) => n.type === 'DRONE');
      
      droneNodes.forEach((node: Node) => {
        const entity = nodeEntities.value.get(node.id);
        if (entity) {
          
          // 创建动态材质
          const period = 2.0; // 动画周期（秒）
          
          // 使用回调函数计算当前偏移量
          const timeBasedOffset = new Cesium.CallbackProperty((time: Cesium.JulianDate | undefined) => {
            if (!viewer || !viewer.clock || !viewer.clock.startTime || !time) return 0;
            const seconds = Cesium.JulianDate.secondsDifference(time, viewer.clock.startTime);
            return (seconds % period) / period;
          }, false);

          // 创建条纹材质
          const stripeMaterial = new Cesium.StripeMaterialProperty({
            evenColor: COMMUNICATION_RANGE_APPEARANCE.mainColor,
            oddColor: COMMUNICATION_RANGE_APPEARANCE.pulseColor,
            repeat: 4,
            orientation: Cesium.StripeOrientation.HORIZONTAL,
            offset: timeBasedOffset
          });

          // 为每个无人机创建独立的通信范围实体
          const rangeEntityId = `range-${node.id}`;

          // 先检查是否已存在范围实体，如果存在则移除
          const existingRangeEntity = viewer.entities.getById(rangeEntityId);
          if (existingRangeEntity) {
            viewer.entities.remove(existingRangeEntity);
          }

          // 创建新的范围实体，使用回调函数绑定到无人机位置
          const rangeEntity = viewer.entities.add({
            id: rangeEntityId,
            name: `${entity.name || '无人机'} 通信范围`,
            position: new Cesium.CallbackProperty((time) => {
              // 每次请求位置时，直接获取无人机当前位置
              if (entity && entity.position) {
                return entity.position.getValue(time);
              }
              return undefined;
            }, false) as unknown as Cesium.PositionProperty,
            ellipsoid: {
              radii: new Cesium.ConstantProperty(new Cesium.Cartesian3(
                calculateCommunicationRangeRadius(node, topoStore),
                calculateCommunicationRangeRadius(node, topoStore),
                calculateCommunicationRangeRadius(node, topoStore)
              )),
              material: stripeMaterial,
              outline: new Cesium.ConstantProperty(true),
              outlineColor: new Cesium.ConstantProperty(COMMUNICATION_RANGE_APPEARANCE.mainColor.withAlpha(0.4)),
              outlineWidth: new Cesium.ConstantProperty(1.0),
              slicePartitions: new Cesium.ConstantProperty(24),
              stackPartitions: new Cesium.ConstantProperty(24)
            }
          });
          
          // 保存引用关系
          (entity as any)._rangeEntity = rangeEntity;
        }
      });
    }
    
    // 3. 获取所有状态为RUNTIME的干扰节点并显示干扰波束
    if (topoStore.topoData?.nodes) {
      const interferenceNodes = topoStore.topoData.nodes.filter((n: Node) => n.type === 'INODE');
      
      interferenceNodes.forEach((node: Node) => {
        const config = interferenceStore.getConfigByNodeId(node.id);
        const entity = nodeEntities.value.get(node.id);
        
        if (entity && config && config.status === 'RUNTIME') {
          
          // 标记该实体正在显示波束
          if (entity.properties) {
            entity.properties.isShowingBeam = true;
          }
          
          // 创建干扰波束
          createInterferenceBeam(node.id, entity);
        }
      });
    }
    
    // 确保时钟在运行，用于动画效果
    if (viewer) {
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1.0;
      viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    }
  };

  // 添加隐藏所有节点的特殊效果函数
  const hideAllSpecialEffects = () => {
    if (!viewer) return;
    
    
    // 1. 清除所有无人机通信范围
    if (topoStore.topoData?.nodes) {
      const droneNodes = topoStore.topoData.nodes.filter((n: Node) => n.type === 'DRONE');
      
      droneNodes.forEach((node: Node) => {
        const entity = nodeEntities.value.get(node.id);
        const rangeEntityId = `range-${node.id}`;
        const rangeEntity = viewer.entities.getById(rangeEntityId);
        
        if (rangeEntity) {
          viewer.entities.remove(rangeEntity);
          
          // 清除引用关系
          if (entity) {
            delete (entity as any)._rangeEntity;
          }
        }
      });
    }
    
    // 2. 清除当前显示通信范围的无人机标记
    if (currentDroneWithRange.value) {
      currentDroneWithRange.value = null;
    }
    
    // 3. 清除所有干扰节点波束
    if (topoStore.topoData?.nodes) {
      const interferenceNodes = topoStore.topoData.nodes.filter((n: Node) => n.type === 'INODE');
      
      interferenceNodes.forEach((node: Node) => {
        const entity = nodeEntities.value.get(node.id);
        
        if (entity) {
          
          // 标记该实体不再显示波束
          if (entity.properties) {
            entity.properties.isShowingBeam = false;
          }
          
          // 清理干扰波束资源
          cleanupInterferenceBeamResources(node.id);
        }
      });
    }
    
    // 4. 清除当前干扰波束节点标记
    if (currentInterferenceWithBeam.value) {
      currentInterferenceWithBeam.value = null;
    }
  };

  // 设置子网实体（EMANE节点、节点与子网之间的细虚线）的可见性
  // 注意：节点之间的虚线连接（subnet-*-link-*）不隐藏
  const setSubnetVisibility = (visible: boolean) => {
    if (!viewer) return;

    subnetEntitiesHidden.value = !visible;

    // 1. 切换所有 EMANE 类型节点实体的显示
    const nodes = topoStore.topoData?.nodes;
    if (nodes) {
      nodes.forEach((node: Node) => {
        if (node.type === 'EMANE') {
          const entity = nodeEntities.value.get(node.id);
          if (entity) {
            entity.show = visible;
          }
        }
      });
    }

    // 2. 切换所有节点与子网之间的细虚线（subnet-attachment-*）的显示
    subnetAttachmentEntities.value.forEach((entity) => {
      entity.show = visible;
    });

    viewer.scene.requestRender();
  };

  // 切换链路标签显示/隐藏
  const toggleLinkLabels = (visible: boolean) => {
    if (!viewer) return;

    linkLabelsVisible.value = visible;
    refreshFaultedLinkStyles();

  };

  // 切换节点名称显示/隐藏
  const toggleNodeNames = (visible: boolean) => {
    if (!viewer) return;

    // 遍历所有节点实体，切换节点名称标签的显示状态
    nodeEntities.value.forEach(entity => {
      if (entity.label) {
        entity.label.show = new Cesium.ConstantProperty(visible);
      }
    });

  };

  // 返回实体管理方法 - 添加hideAllSpecialEffects到返回值中
  return {
    nodeEntities,
    linkEntities,
    interferenceBeamEntities,
    syncNodesToEntities,
    syncLinksToEntities,
    clearAllEntities,
    updateLinkLabels,
    createInterferenceBeam,
    updateInterferenceBeams,
    cleanupInterferenceBeamResources,
    showAllSpecialEffects,
    hideAllSpecialEffects,
    toggleRenderingMode,  // 添加切换渲染模式方法
    getRenderingMode,     // 添加获取渲染模式状态方法
    toggleLinkLabels,     // 添加切换链路标签方法
    toggleNodeNames,      // 添加切换节点名称方法
    resetWirelessLinkColors,  // 重置无线链路颜色为初始状态
    setSubnetVisibility       // 设置子网实体可见性（仿真时隐藏）
  };
}

// 添加默认导出
export default useCesiumEntities; 

// 完整的零影响距离计算（考虑环境因子）
const zeroImpactDistanceComplete = (interferePowerdb: number, systemnoisefigure: number, interfereFreq = 2347000000, randomlossenvironment = 'none', maxNoiseIncrease_dB = 0.001) => {
    const FSPL_CONST = 41.916900439033640;
    
    // 计算噪声功率
    const noisePower_dBm = -174 + systemnoisefigure + 60; // -110 dBm
    const noisePower_linear = Math.pow(10, noisePower_dBm / 10);
    
    // 计算允许的干扰功率
    // 当干扰+噪声 = 噪声 + maxSINRDegradation时
    const allowedTotalNoise_dBm = noisePower_dBm + maxNoiseIncrease_dB;
    const allowedTotalNoise_linear = Math.pow(10, allowedTotalNoise_dBm / 10);
    
    // 允许的干扰功率(线性) = 总噪声 - 原噪声
    const allowedInterference_linear = allowedTotalNoise_linear - noisePower_linear;
    const allowedInterference_dBm = 10 * Math.log10(allowedInterference_linear);
    
    // 根据EMANE公式计算距离
    // allowedInterference_dBm = interferePowerdb - FSPL - 20
    const requiredFSPL = interferePowerdb - 20 - allowedInterference_dBm;
    
    const frequency_MHz = interfereFreq/ 1e6;
    const baseDistance = Math.pow(10, requiredFSPL / 20) / (FSPL_CONST * frequency_MHz);
    
    const envFactor = randomlossenvironment === 'urban' ? 0.708 : 1.0;
    return baseDistance * envFactor; // km
};

