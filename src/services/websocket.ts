import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import eventBus from '../utils/eventBus';
import { getUserInfo } from '../store/user';
import { useSystemLogStore } from '../store/modules/systemLog';
import { alertService } from './alertService';

// WebSocket连接状态和配置
const wsConnection = ref<WebSocket | null>(null);
const wsConnected = ref(false);
const heartbeatTimer = ref<number | null>(null);
const nodesUpdateTimer = ref<number | null>(null);
const topoSyncTimer = ref<number | null>(null);
const isSimulationRunning = ref(false);

// WebSocket配置常量
const WS_CONFIG = {
  URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/connect`,
  HEARTBEAT_INTERVAL: 25000, // 心跳间隔25秒
  NODES_UPDATE_INTERVAL: 500, // 节点位置更新间隔
  RECONNECT_DELAY: 3000, // 重连延迟3秒
};

// 消息处理器映射
type MessageHandler = (data: any) => void;
const messageHandlers = new Map<string, MessageHandler[]>();

// WebSocket服务类
class WebSocketService {
  private static instance: WebSocketService;
  private topoStoreGetter: (() => any) | null = null;
  private reconnectTimer: number | null = null;
  private activeConsumers = new Set<string>();
  private allowReconnect = false;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // 设置拓扑存储获取器
  setTopoStoreGetter(getter: () => any): void {
    this.topoStoreGetter = getter;
  }

  // 获取连接状态
  get connected(): boolean {
    return wsConnected.value;
  }

  get connection(): WebSocket | null {
    return wsConnection.value;
  }

  get simulationRunning(): boolean {
    return isSimulationRunning.value;
  }

  set simulationRunning(value: boolean) {
    isSimulationRunning.value = value;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private establishConnection(): void {
    if (
      wsConnection.value &&
      (wsConnection.value.readyState === WebSocket.OPEN ||
        wsConnection.value.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.clearReconnectTimer();

    try {
      wsConnection.value = new WebSocket(WS_CONFIG.URL);

      wsConnection.value.onopen = () => {
        wsConnected.value = true;

        const systemLogStore = useSystemLogStore();
        systemLogStore.addLog({
          type: 'important',
          module: 'websocket',
          action: 'WebSocket连接',
          information: 'WebSocket连接建立',
          details: `WebSocket连接已成功建立`
        });

        this.startHeartbeat();

        eventBus.emit("wsConnectionStateChange", true);
      };

      wsConnection.value.onmessage = this.handleMessage.bind(this);

      wsConnection.value.onclose = () => {
        wsConnected.value = false;
        wsConnection.value = null;

        const systemLogStore = useSystemLogStore();
        systemLogStore.addLog({
          type: 'warning',
          module: 'websocket',
          action: 'WebSocket连接',
          information: 'WebSocket连接断开',
          details: `WebSocket连接已关闭`
        });

        this.stopHeartbeat();
        this.stopNodesUpdate();
        this.stopTopoSync();

        eventBus.emit("wsConnectionStateChange", false);

        if (this.allowReconnect && this.activeConsumers.size > 0) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            if (!wsConnected.value && this.activeConsumers.size > 0) {
              this.establishConnection();
            }
          }, WS_CONFIG.RECONNECT_DELAY);
        }
      };

      wsConnection.value.onerror = (error) => {
        console.error("WebSocket连接出错:", error);
        wsConnected.value = false;

        const systemLogStore = useSystemLogStore();
        systemLogStore.addLog({
          type: 'warning',
          module: 'websocket',
          action: 'WebSocket连接',
          information: 'WebSocket连接错误',
          details: `WebSocket连接发生错误`
        });

        eventBus.emit("wsConnectionStateChange", false);
      };
    } catch (error) {
      console.error("创建WebSocket连接时出错:", error);
      ElMessage.error("创建WebSocket连接失败");
      eventBus.emit("wsConnectionStateChange", false);
    }
  }

  connect(consumerId: string = 'default'): void {
    this.activeConsumers.add(consumerId);
    this.allowReconnect = this.activeConsumers.size > 0;
    this.establishConnection();
  }

  disconnect(consumerId?: string): void {
    if (consumerId) {
      this.activeConsumers.delete(consumerId);
    } else {
      this.activeConsumers.clear();
    }

    this.allowReconnect = this.activeConsumers.size > 0;
    if (this.allowReconnect) {
      return;
    }

    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.stopNodesUpdate();
    this.stopTopoSync();

    if (wsConnection.value) {
      const currentConnection = wsConnection.value;
      wsConnection.value = null;
      wsConnected.value = false;
      currentConnection.close();
    }
  }

  // 发送消息
  send(data: any): void {
    if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify(data));
      console.log("ws发送：",data);
      
    } else {
      console.warn("WebSocket未连接，无法发送消息:", data);
    }
  }

  // 注册消息处理器
  onMessage(type: string, handler: MessageHandler): void {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, []);
    }
    messageHandlers.get(type)!.push(handler);
  }

  // 移除消息处理器
  offMessage(type: string, handler?: MessageHandler): void {
    if (!messageHandlers.has(type)) return;

    if (handler) {
      const handlers = messageHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      messageHandlers.delete(type);
    }
  }

  // 处理接收到的消息
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      // console.log('11111111111111',data)
      
      // 处理告警消息 (action=8)
      if (data.action === 8 && (data.type === 'warn' || data.type === 'error')) {
        alertService.handleDiskAlert(data);
        
        // 记录告警日志
        const systemLogStore = useSystemLogStore();
        systemLogStore.addLog({
          type: data.type === 'error' ? 'warning' : 'normal',
          module: 'alert',
          action: '磁盘告警',
          information: data.type === 'error' ? '严重磁盘告警' : '磁盘告警',
          details: data.data
        });
      }
      
      // 根据action类型分发消息
      const actionType = `action_${data.action}`;
      if (messageHandlers.has(actionType)) {
        messageHandlers.get(actionType)!.forEach(handler => {
          try {
            handler(data);
    
          } catch (error) {
            console.error(`处理${actionType}消息时出错:`, error);
          }
        });
      }

      // 处理特定数据类型的消息
      if (data.emaneInfo && messageHandlers.has('emane')) {
        messageHandlers.get('emane')!.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error('处理EMANE消息时出错:', error);
          }
        });
      }

      if (data.nemIds && Array.isArray(data.nemIds) && messageHandlers.has('nemIds')) {
        messageHandlers.get('nemIds')!.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error('处理NEM ID消息时出错:', error);
          }
        });
      }

    } catch (error) {
      console.error("解析WebSocket消息出错:", error);
    }
  }

  // 启动心跳机制
  startHeartbeat(): void {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value);
    }

    // 获取当前用户ID
    const userInfo = getUserInfo();
    const currentUserId = userInfo.id;

    // 立即发送一次心跳消息
    this.sendHeartbeat(currentUserId);

    // 设置定时发送心跳
    heartbeatTimer.value = window.setInterval(() => {
      this.sendHeartbeat(currentUserId);
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  }

  // 发送心跳消息
  private sendHeartbeat(userId: string): void {
    if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
      // 获取当前拓扑数据ID
      let sessionId = null;
      if (this.topoStoreGetter) {
        try {
          const topoStore = this.topoStoreGetter();
          sessionId = topoStore?.topoData?.id || null;
        } catch (error) {
          console.warn('获取拓扑存储失败:', error);
        }
      }

      // 获取当前用户角色
      const userInfo = getUserInfo();
      const userRole = userInfo.role; 
      let roleNumber = 1; 

      switch (userRole) {
        case 'white':
          roleNumber = 1;
          break;
        case 'red':
          roleNumber = 2;
          break;
        case 'blue':
          roleNumber = 3;
          break;
        default:
          roleNumber = 1;
      }

      const heartbeatData = {
        action: 1,
        extand: null,
        senderId: userId,
        sessionId: sessionId,
        role: roleNumber, 
      };
      this.send(heartbeatData);
    }
  }

  // 停止心跳机制
  stopHeartbeat(): void {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value);
      heartbeatTimer.value = null;
    }
  }

  // 启动节点位置更新
  startNodesUpdate(): void {
    if (nodesUpdateTimer.value) {
      clearInterval(nodesUpdateTimer.value);
    }

    nodesUpdateTimer.value = window.setInterval(() => {
      if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
        this.sendNodesPositionUpdate();
      }
    }, WS_CONFIG.NODES_UPDATE_INTERVAL);
  }

  // 停止节点位置更新
  stopNodesUpdate(): void {
    if (nodesUpdateTimer.value) {
      clearInterval(nodesUpdateTimer.value);
      nodesUpdateTimer.value = null;
    }
  }

  // 启动拓扑同步
  startTopoSync(): void {
    if (topoSyncTimer.value) {
      clearInterval(topoSyncTimer.value);
      topoSyncTimer.value = null;
    }

    // 执行一次初始同步
    this.syncTopoData();
  }

  // 停止拓扑同步
  stopTopoSync(): void {
    if (topoSyncTimer.value) {
      clearInterval(topoSyncTimer.value);
      topoSyncTimer.value = null;
    }
  }

  // 发送节点位置更新（需要从外部注入具体实现）
  private sendNodesPositionUpdate(): void {
    // 这个方法需要访问具体的拓扑数据，将通过事件总线触发
    // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
    eventBus.emit('websocket:sendNodesPositionUpdate');
  }

  // 同步拓扑数据（需要从外部注入具体实现）
  private syncTopoData(): void {
    // 这个方法需要访问具体的拓扑数据，将通过事件总线触发
    // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
    eventBus.emit('websocket:syncTopoData');
  }


}

// 导出单例实例
export const websocketService = WebSocketService.getInstance();

// 导出响应式状态供组件使用
export const useWebSocketState = () => ({
  wsConnected: wsConnected,
  isSimulationRunning: isSimulationRunning,
});

export default websocketService;
