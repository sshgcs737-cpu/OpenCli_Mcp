import mitt from 'mitt';

// 导入链路类型定义
import type { Link } from '../types/topo';

// 定义事件类型
export type Events = {
  switchViewMode: string;
  flyToHome: void;
  searchLocation: string;
  zoomIn: void;
  zoomOut: void;
  refreshScene: void;
  wsConnectionStateChange: boolean;
  'sidebar:item-selected': { name: string, icon: string, type?: string };
  'sidebar:distributed-link-config': { name: string, icon: string, type?: string };
  'sidebar:delete-subnet': { name: string, icon: string, type?: string };
  'sidebar:delete-interference': { name: string, icon: string, type?: string };
  'sidebar:delete-hardware': { name: string, icon: string, type?: string };
  startSimulation: void;
  stopSimulation: void;
  startEmaneMonitor: { link: Link };
  setRenderPerformance: string;
  startPathDrawing: void;
  openDroneControlPanel: void;
  openServerConfigDialog: void;
  openMatlabResults: any;
  matlabResults: any;
  showAllSpecialEffects: void;
  effectsVisibilityChanged: boolean;
  newChatMessage: void;
  clearUnreadMessages: void;
  mapClickedForTemplate: any;
  triggerPositionUpdate: void;
  startFlightPositionUpdates: void;
  stopFlightPositionUpdates: void;
  'websocket:sendNodesPositionUpdate': void;
  'websocket:syncTopoData': void;
  updateTopoData: any;
  toggleRenderingMode: void;
  toggleLinkLabels: boolean;
  refreshLinkLabels: void;
  toggleNodeNames: boolean;
  'opencli:simulationLifecycle': {
    status: 'loaded' | 'started' | 'paused' | 'stopped' | 'closed' | 'refreshed';
    sessionId?: number;
    duration?: number;
    stepLength?: number;
    mode?: number;
  };
  'opencli:sceneListChanged': {
    action: 'created' | 'updated' | 'deleted';
    sceneId?: number;
    name?: string;
    scope?: 'private' | 'public';
  };
  startTemplatePlacement: any;
  endTemplatePlacement: void;
  renderingModeChanged: boolean;
  topoDataUpdated: void;
  exitCurrentScene: void;
};

// 创建全局事件总线实例
const eventBus = mitt<Events>();

export default eventBus;
