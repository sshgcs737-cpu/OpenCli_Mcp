<template>
  <div
    class="cesium-container"
    @contextmenu.prevent="handleRightClick"
    :class="{
      'add-mode': topoStore.operationMode === 'add',
      'connect-mode': topoStore.operationMode === 'connect',
    }"
  >
    <div id="cesiumContainer" ref="cesiumContainer"></div>

    <SubnetOverviewPanel />

    <!-- 右上角网格分辨率标注 -->
    <div v-if="gridResolutionText" class="grid-resolution-label">
      {{ gridResolutionText }}
    </div>

    <!-- 左下角平面坐标显示 -->
    <div v-if="mouseCoordText" class="mouse-coord-label">
      {{ mouseCoordText }}
    </div>

    <!-- 节点配置对话框 -->
    <NodeConfigDialog
      v-model:visible="configDialogVisible"
      :position="clickPosition"
      :node-type="selectedNodeType"
      @confirm="handleNodeConfirm"
      @cancel="handleNodeCancel"
    />
    <!-- 节点信息面板 -->
    <NodeInfoPanel
      ref="nodeInfoPanelRef"
      v-if="nodeInfoPanelVisible && selectedNode && selectedNode.type !== 'INODE'"
      :node="selectedNode"
      :showPanel="nodeInfoPanelShowUI"
      @close="() => {
        nodeInfoPanelVisible = false;
        nodeInfoPanelShowUI = true;
      }"
      @openTerminal="handleOpenTerminal"
      @openVnc="handleOpenVnc"
      @refresh-links="handleRefreshLinks"
    />
    <!-- 干扰节点信息面板 -->
    <InterferenceNodeInfoPanel
      v-if="interferenceNodeInfoPanelVisible && selectedInterferenceNode"
      :node="selectedInterferenceNode"
      @close="interferenceNodeInfoPanelVisible = false"
    />
    <!-- 节点右键菜单 -->
    <NodeContextMenu
      :visible="contextMenuVisible"
      :node="contextMenuNode"
      :position="contextMenuPosition"
      @close="contextMenuVisible = false"
      @openTerminal="handleOpenTerminal"
      @openSignalSim="handleOpenSignalSim"
      @openVnc="handleOpenVnc"
    />
    <!-- 有线链路信息面板 -->
    <LinkInfoPanel
      v-if="linkInfoPanelVisible && selectedLink?.type === 'WIRED'"
      :link="selectedLink"
      @close="linkInfoPanelVisible = false"
    />
    <!-- 无线链路信息面板 -->
    <WirelessLinkInfoPanel
      v-if="linkInfoPanelVisible && selectedLink?.type === 'WIRELESS'"
      :link="selectedLink"
      @close="linkInfoPanelVisible = false"
    />
    <!-- 链路配置对话框 -->
    <LinkConfigDialog
      v-model:visible="linkDialogVisible"
      :source-node="sourceNode"
      :target-node="targetNode"
      @confirm="handleLinkConfirm"
      @cancel="handleLinkCancel"
    />
    <!-- 分布式链路配置对话框 -->
    <DistributedLinkConfigDialog
      v-model:visible="distributedLinkDialogVisible"
      @confirm="handleDistributedLinkConfirm"
      @cancel="handleDistributedLinkCancel"
    />
    <!-- EMANE MAC信息面板 -->
    <EmaneMacInfoPanel
      v-if="emaneMacInfoPanelVisible"
      :link="selectedLinkForEmane"
      @close="emaneMacInfoPanelVisible = false"
    />
    <!-- 无人机路径绘制面板 -->
    <DronePathPanel
      v-model:visible="dronePathPanelVisible"
      :viewer="cesiumViewer ? cesiumViewer : null"
      @droneFlightManagerReady="setupDroneFlightManager"
    />
    <!-- 子网配置对话框 -->
    <SubnetConfigDialog
      v-model:visible="subnetConfigDialogVisible"
      :position="clickPosition"
      @confirm="handleSubnetConfirm"
      @cancel="handleSubnetCancel"
    />
    <!-- 干扰节点配置对话框 -->
    <InterferenceNodeConfigDialog
      :visible="showInterferenceConfigDialog"
      :position="currentInterferenceNodePosition"
      @update:visible="showInterferenceConfigDialog = $event"
      @confirm="handleInterferenceNodeConfigConfirm"
      @cancel="handleInterferenceNodeConfigCancel"
    />
    <!-- 无人机控制面板 -->
    <DroneControlPanel
      v-model:visible="droneControlPanelVisible"
      :viewer="cesiumViewer"
    />
    <!-- 添加服务器配置对话框 -->
    <ServerConfigDialog
      v-model:visible="serverConfigDialogVisible"
      @save="handleServerConfigSave"
      @add="handleServerConfigAdd"
    />

    <!-- MATLAB结果面板 -->
    <MatlabResultPanel v-model:visible="matlabResultPanelVisible" />

    <!-- 可拖拽的终端窗口 - 支持多个终端 -->
    <div
      v-for="[terminalId, terminal] in terminals"
      :key="terminalId"
      class="draggable-terminal"
      :ref="el => setTerminalRef(terminalId, el)"
      :style="{
        ...terminal.position,
        width: terminal.size.width,
        height: terminal.isMinimized ? 'auto' : terminal.size.height
      }"
      :class="{ 'active': activeTerminalId === terminalId, 'minimized': terminal.isMinimized }"
    >
      <div class="terminal-header" @mousedown="startDragging($event, terminalId)">
        <div class="terminal-title">
          <el-icon><Monitor /></el-icon>
          {{ terminal.node?.alias || terminal.node?.name || '节点' }} 终端
          <span v-if="terminal.terminalIndex && terminal.terminalIndex > 1" class="terminal-index">
            #{{ terminal.terminalIndex }}
          </span>
        </div>
        <div class="terminal-controls">
          <span class="terminal-control minimize" @click="minimizeTerminal(terminalId)" :title="terminal.isMinimized ? '还原' : '最小化'">
            <el-icon><FullScreen v-if="terminal.isMinimized" /><Minus v-else /></el-icon>
          </span>
          <span class="terminal-control close" @click="closeTerminal(terminalId)">
            <el-icon><Close /></el-icon>
          </span>
        </div>
      </div>
      <div class="terminal-body" :class="{ 'minimized': terminal.isMinimized }">
        <Terminal
          :wsUrl="terminal.wsUrl"
          :visible="!terminal.isMinimized"
          :key="terminalId"
          :terminalSize="terminal.size"
        />
      </div>

      <!-- 调整大小的手柄 -->
      <div class="resize-handles" v-if="!terminal.isMinimized">
        <!-- 右边缘 -->
        <div class="resize-handle resize-handle-e"
             @mousedown="startResizing($event, terminalId, 'e')"></div>
        <!-- 下边缘 -->
        <div class="resize-handle resize-handle-s"
             @mousedown="startResizing($event, terminalId, 's')"></div>
        <!-- 右下角 -->
        <div class="resize-handle resize-handle-se"
             @mousedown="startResizing($event, terminalId, 'se')"></div>
      </div>
    </div>

    <!-- Draggable VNC windows - support multiple VNC -->
    <div
      v-for="[vncId, vnc] in vncWindows"
      :key="vncId"
      class="draggable-vnc"
      :ref="el => setVncRef(vncId, el)"
      :style="{
        ...vnc.position,
        width: vnc.size.width,
        height: vnc.isMinimized ? 'auto' : vnc.size.height
      }"
      :class="{ 'active': activeVncId === vncId, 'minimized': vnc.isMinimized }"
    >
      <div class="vnc-header" @mousedown="startVncDragging($event, vncId)">
        <div class="vnc-title">
          <el-icon><Monitor /></el-icon>
          {{ vnc.node?.alias || vnc.node?.name }} VM
        </div>
        <div class="vnc-controls">
          <span class="vnc-control minimize" @click="minimizeVnc(vncId)" :title="vnc.isMinimized ? '还原' : '最小化'">
            <el-icon><FullScreen v-if="vnc.isMinimized" /><Minus v-else /></el-icon>
          </span>
          <span class="vnc-control close" @click="closeVnc(vncId)">
            <el-icon><Close /></el-icon>
          </span>
        </div>
      </div>
      <div class="vnc-body" :class="{ 'minimized': vnc.isMinimized }">
        <Vnc
          :wsUrl="vnc.wsUrl"
          :visible="!vnc.isMinimized"
          :key="vncId"
        />
      </div>

      <div class="resize-handles" v-if="!vnc.isMinimized">
        <div class="resize-handle resize-handle-e"
             @mousedown="startVncResizing($event, vncId, 'e')"></div>
        <div class="resize-handle resize-handle-s"
             @mousedown="startVncResizing($event, vncId, 's')"></div>
        <div class="resize-handle resize-handle-se"
             @mousedown="startVncResizing($event, vncId, 'se')"></div>
      </div>
    </div>

    <!-- 连接提示 -->
    <div v-if="topoStore.operationMode === 'connect'" class="connect-hint">
      <span>{{
        selectedItem && selectedItem.name === "删除链路"
          ? "请点击要删除的链路 (右键取消)"
          : "请依次点击两个节点建立链路连接 (右键取消)"
      }}</span>
    </div>

    <!-- 底图模式切换按钮 -->
    <div class="map-mode-toggle">
      <el-tooltip :content="'切换背景'" placement="left">
        <el-button
          :icon="isSimpleMapMode ? View : Picture"
          circle
          @click="toggleMapMode"
          :type="isSimpleMapMode ? 'primary' : 'default'"
        />
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  onBeforeUnmount,
  ref,
  reactive,
  computed,
  watch,
  nextTick,
} from "vue";
import * as Cesium from "cesium";
import { useTopoStore } from "../../../store/modules/topo";
import { useSystemLogStore } from "../../../store/modules/systemLog";
import { ElMessage, ElMessageBox } from "element-plus";
import { Monitor, Close, Minus, Picture, View, FullScreen } from '@element-plus/icons-vue';
import NodeConfigDialog from "./NodeConfigDialog.vue";
import InterferenceNodeConfigDialog from "./InterferenceNodeConfigDialog.vue";
import useCesiumEntities from "../../../composables/useCesiumEntities";
import eventBus from "../../../utils/eventBus";
import NodeInfoPanel from "./NodeInfoPanel.vue";
import LinkInfoPanel from "./LinkInfoPanel.vue";
import LinkConfigDialog from "./LinkConfigDialog.vue";
import DistributedLinkConfigDialog from "./DistributedLinkConfigDialog.vue";
import SubnetConfigDialog from "./SubnetConfigDialog.vue";
import EmaneMacInfoPanel from "./EmaneMacInfoPanel.vue";
import DronePathPanel from "./DronePathPanel.vue";
import WirelessLinkInfoPanel from "./WirelessLinkInfoPanel.vue";
import SubnetOverviewPanel from "./SubnetOverviewPanel.vue";
import { useSubnetLinks } from "../../../composables/useSubnetLinks";
import DroneControlPanel from "./DroneControlPanel.vue";
import InterferenceNodeInfoPanel from "./InterferenceNodeInfoPanel.vue";
import ServerConfigDialog from "./ServerConfigDialog.vue";
import MatlabResultPanel from "./MatlabResultPanel.vue";
import Terminal from "./Terminal.vue";
import Vnc from "./Vnc.vue";
import NodeContextMenu from "./NodeContextMenu.vue";
// 引入API函数
import { getTopoBySession } from "../../../api/scene";
import type { ApiResponse } from "../../../api/scene";
// 引入用户信息函数
import { getUserInfo } from "../../../store/user";
// 引入Cesium的CSS样式资源
import "../../../../node_modules/cesium/Build/Cesium/Widgets/widgets.css";

// 导入全局WebSocket服务
import websocketService, { useWebSocketState } from '../../../services/websocket';

// 使用全局WebSocket状态
const { isSimulationRunning } = useWebSocketState();

// Cesium配置常量
const CESIUM_CONFIG = {
  ION_TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMGY5N2EyNi1lMDkxLTRkZGMtYTY3Yi04NThmNjA0NGQ5ODQiLCJpZCI6Mjc5OTQ0LCJpYXQiOjE3NDA3MzQ1OTV9.GiRn-8ycUh9-uoH98e8wYshvrQgwYXZJSCrV09ir0TY",
  DEFAULT_VIEW: {
    longitude: 121.12783051473023,
    latitude: 23.828398440342344,
    height: 10000,
    heading: 6.075650371148749,
    pitch: -0.46381729464065646,
    roll: 0.0006880065372003585,
  },
};
// 获取状态管理store
const topoStore = useTopoStore();
const systemLogStore = useSystemLogStore();
const subnetLinksManager = useSubnetLinks(); // 使用子网链路管理

// 记录当前选中的侧边栏项目
const selectedItem = ref<{ name: string; icon: string; type?: string } | null>(null);
const handleSidebarItemSelected = (item: { name: string; icon: string; type?: string }) => {
  selectedItem.value = item;
};
const handleSidebarDistributedLinkConfig = () => {
  distributedLinkDialogVisible.value = true;
};
// 监听侧边栏选择事件
eventBus.on("sidebar:item-selected", handleSidebarItemSelected);
// 监听分布式链路配置事件
eventBus.on("sidebar:distributed-link-config", handleSidebarDistributedLinkConfig);

// 定义响应式引用，用于存储Cesium实例
// cesiumViewer: Cesium的核心可视化组件，管理整个3D场景
// cesiumContainer: 对应DOM元素的引用，Cesium将在此元素内渲染3D地球
const cesiumViewer = ref<Cesium.Viewer | null>(null);
const cesiumContainer = ref<HTMLElement | null>(null);
// 存储OSM建筑图层
const osmBuildings = ref<Cesium.Cesium3DTileset | null>(null);

// 底图模式状态：简洁模式 vs 卫星地图模式
const isSimpleMapMode = ref(false);
const gridImageryLayer = ref<Cesium.ImageryLayer | null>(null);
const satelliteImageryLayer = ref<Cesium.ImageryLayer | null>(null);

// 网格分辨率标注文本
const gridResolutionText = ref('');

// 鼠标平面坐标文本（ENU米制）
const mouseCoordText = ref('');

// 使用Cesium实体管理组合式函数
// 因为viewer可能在初始化后才有值，所以在onMounted中初始化
const cesiumEntities = ref<ReturnType<typeof useCesiumEntities> | null>(null);

// 配置框相关状态
const configDialogVisible = ref(false);
const showInterferenceConfigDialog = ref(false);
const clickPosition = reactive({
  lat: 0,
  lon: 0,
  alt: 0,
});
const currentInterferenceNodePosition = ref({ lat: 0, lon: 0, alt: 0 });

// 链路配置状态
const linkDialogVisible = ref(false);
const distributedLinkDialogVisible = ref(false);
const sourceNode = ref<any>(null);
const targetNode = ref<any>(null);

// 节点和链路信息面板状态
const selectedNode = ref<any>(null);
const nodeInfoPanelVisible = ref(false);
const nodeInfoPanelShowUI = ref(true); // 控制是否显示面板UI，信号仿真时为false
const selectedLink = ref<any>(null);
const linkInfoPanelVisible = ref(false);
const emaneMacInfoPanelVisible = ref(false);
const dronePathPanelVisible = ref(false);
const droneControlPanelVisible = ref(false);
const allEffectsVisible = ref(false); // 添加特效显示状态跟踪变量

// 子网配置对话框可见性
const subnetConfigDialogVisible = ref(false);

// 获取所选节点类型
const selectedNodeType = computed(() => {
  return topoStore.selectedNodeType || NODE_TYPES.DEVICE;
});

// 节点类型常量
const NODE_TYPES = {
  DEVICE: "DEVICE",
  STATION: "STATION",
  DRONE: "DRONE",
  MISSILE: "MISSILE",
} as const;

// 存储选中的链路信息，用于EMANE监控
const selectedLinkForEmane = ref<any>(null);

// 添加干扰节点信息面板的状态
const interferenceNodeInfoPanelVisible = ref(false);
const selectedInterferenceNode = ref<any>(null);

// 右键菜单相关状态
const contextMenuVisible = ref(false);
const contextMenuPosition = ref<{ x: number; y: number } | null>(null);
const contextMenuNode = ref<any>(null);

// NodeInfoPanel ref
const nodeInfoPanelRef = ref<any>(null);

// 服务器配置对话框状态
const serverConfigDialogVisible = ref(false);

// MATLAB结果面板状态
const matlabResultPanelVisible = ref(false);

// 模板放置相关状态
const isWaitingForTemplatePlacement = ref(false);
const templatePlacementCursor = ref<HTMLElement | null>(null);

// 终端相关状态 - 支持多个终端
interface TerminalInstance {
  id: string;
  node: any;
  wsUrl: string;
  isMinimized: boolean;
  position: { top: string; left: string };
  size: { width: string; height: string };
  isDragging: boolean;
  isResizing: boolean;
  dragOffset: { x: number; y: number };
  resizeHandle: string; // 记录当前调整大小的手柄类型
  terminalIndex?: number; // 终端序号，用于区分同一节点的多个终端
}

const terminals = ref<Map<string, TerminalInstance>>(new Map());
const activeTerminalId = ref<string | null>(null);

// VNC window management - support multiple VNC windows
interface VncInstance {
  id: string;
  node: any;
  wsUrl: string;
  isMinimized: boolean;
  position: { top: string; left: string };
  size: { width: string; height: string };
  isDragging: boolean;
  isResizing: boolean;
  dragOffset: { x: number; y: number };
  resizeHandle: string;
}

const vncWindows = ref<Map<string, VncInstance>>(new Map());
const activeVncId = ref<string | null>(null);

// 无人机列表
const flyingDrones = ref<Array<string>>([]);

// 处理右键点击
const handleRightClick = (event: MouseEvent) => {
  // 如果在放置或连接模式，则退出模式
  if (topoStore.operationMode === "add") {
    // @ts-ignore: 忽略类型检查错误，该方法确实存在
    topoStore.setOperationMode("select");
    ElMessage.info("已退出放置模式");
    return;
  } else if (topoStore.operationMode === "connect") {
    // @ts-ignore: 忽略类型检查错误，该方法确实存在
    topoStore.setOperationMode("select");
    // 重置节点选择状态
    sourceNode.value = null;
    targetNode.value = null;
    ElMessage.info("已退出连接模式");
    return;
  }

  // 通过点击位置获取实际的节点，而不是使用 selectedNode
  if (cesiumViewer.value) {
    const viewer = cesiumViewer.value;
    const canvasPosition = new Cesium.Cartesian2(
      event.clientX - viewer.container.getBoundingClientRect().left,
      event.clientY - viewer.container.getBoundingClientRect().top
    );

    const pickedObject = viewer.scene.pick(canvasPosition);

    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id;
      if (entity && typeof entity.id === "string" && /^\d+$/.test(entity.id)) {
        const nodeId = parseInt(entity.id, 10);
        const node = topoStore.topoData?.nodes?.find((n: any) => n.id === nodeId);
        if (node) {
          contextMenuVisible.value = true;
          contextMenuPosition.value = {
            x: event.clientX,
            y: event.clientY
          };
          contextMenuNode.value = node;
        }
      }
    }
  }
};

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false;
  contextMenuPosition.value = null;
  contextMenuNode.value = null;
};

// 从Cartesian2获取地表坐标
const getGroundPosition = (
  viewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2
): {
  cartesian: Cesium.Cartesian3;
  longitude: number;
  latitude: number;
  height: number;
} | null => {
  try {
    const scene = viewer.scene;
    const ray = scene.camera.getPickRay(windowPosition);
    if (!ray) return null;

    const cartesian = scene.globe.pick(ray, scene);
    if (!Cesium.defined(cartesian)) return null;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = scene.globe.getHeight(cartographic) || 0;

    return { cartesian, longitude, latitude, height };
  } catch (error) {
    console.error("获取地表位置时出错:", error);
    return null;
  }
};

// 更新点击位置并显示配置对话框
const updatePositionAndShowDialog = (position: {
  longitude: number;
  latitude: number;
  height: number;
}) => {
  // 先重置所有可能打开的对话框状态
  configDialogVisible.value = false;
  subnetConfigDialogVisible.value = false;
  showInterferenceConfigDialog.value = false;

  // 更新点击位置数据，格式化数值避免精度问题
  const formattedPosition = {
    lat: Number(position.latitude.toFixed(6)),
    lon: Number(position.longitude.toFixed(6)),
    alt: Number(position.height.toFixed(2)),
  };

  // 使用nextTick确保数据更新后再显示对话框
  nextTick(() => {
    if (topoStore.selectedNodeType === "EMANE") {
      // EMANE (子网) 有其自己的 clickPosition 和 subnetConfigDialogVisible
      clickPosition.lat = formattedPosition.lat;
      clickPosition.lon = formattedPosition.lon;
      clickPosition.alt = formattedPosition.alt;
      subnetConfigDialogVisible.value = true;
    } else if (topoStore.selectedNodeType === "INTERFERENCE") {
      currentInterferenceNodePosition.value = formattedPosition;
      showInterferenceConfigDialog.value = true;
    } else if (topoStore.selectedNodeType) {
      clickPosition.lat = formattedPosition.lat;
      clickPosition.lon = formattedPosition.lon;
      clickPosition.alt = formattedPosition.alt;
      configDialogVisible.value = true;
    } else {
      // Should not happen if sidebar selection is enforced before map click
      ElMessage.info("请先选择节点类型");
    }
    // 无论打开哪个对话框，都退出放置模式，让对话框处理后续
    // topoStore.setOperationMode("select"); // This was moved to dialog confirm/cancel handlers
  });
};

// 处理节点点击事件 - 链路连接模式
const handleNodeClickForConnect = (entity: any) => {
  // 确保是节点实体
  if (
    !entity ||
    !entity.id ||
    typeof entity.id !== "string" ||
    !/^\d+$/.test(entity.id)
  ) {
    ElMessage.warning("请点击有效的节点");
    return;
  }

  const nodeId = parseInt(entity.id, 10);

  // 确保 topoData 和 nodes 数组存在
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
    ElMessage.error("拓扑数据不完整，无法创建链路");
    return;
  }

  const node = topoStore.topoData.nodes.find((n: any) => n.id === nodeId);

  if (!node) {
    ElMessage.warning("节点数据不存在");
    return;
  }

  // 源节点还未选择
  if (!sourceNode.value) {
    sourceNode.value = node;
    ElMessage.info(`已选择源节点: ${node.alias || node.name}，请选择目标节点`);

    // 记录日志
    systemLogStore.addLog({
      type: "normal",
      module: "link",
      action: "选择链路起点",
      information: "链路起点选择",
      details: `为链路选择了起点节点: "${node.alias || node.name}"`,
    });

    return;
  }

  // 不允许连接到自己
  if (sourceNode.value.id === node.id) {
    ElMessage.warning("不能连接节点到自身");
    return;
  }

  // 节点连接限制规则
  const canConnect = validateNodeConnection(sourceNode.value, node);
  if (!canConnect.valid) {
    ElMessage.warning(canConnect.message);
    sourceNode.value = null; // 重置源节点
    return;
  }

  // 检查是否已存在连接
  // 确保 links 数组存在
  const existingLink = Array.isArray(topoStore.topoData.links)
    ? topoStore.topoData.links.find(
        (link: any) =>
          (link.node1_id === sourceNode.value.id && link.node2_id === node.id) ||
          (link.node1_id === node.id && link.node2_id === sourceNode.value.id)
      )
    : null;

  if (existingLink) {
    ElMessage.warning("这两个节点间已存在链路");
    // 重置选择
    sourceNode.value = null;
    return;
  }

  // 设置目标节点并显示配置对话框
  targetNode.value = node;
  linkDialogVisible.value = true;

  // 切换回选择模式
  // @ts-ignore: 忽略类型检查错误，该方法确实存在
  topoStore.setOperationMode("select");
};

// 验证两个节点是否可以连接
const validateNodeConnection = (
  node1: any,
  node2: any
): { valid: boolean; message: string } => {
  const getDroneType = (nodeType: string) => {
    return nodeType === "DRONE" ;
  };

  const isEmaneType = (nodeType: string) => nodeType === "EMANE";
  const isDroneType = (nodeType: string) => getDroneType(nodeType);
  const isBaseStationType = (nodeType: string) => nodeType === "BASESTATION";

  // 无人机节点只能接入EMANE
  if (isDroneType(node1.type) && !isEmaneType(node2.type)) {
    return { valid: false, message: "无人机只能接入子网(EMANE)节点" };
  }

  if (isDroneType(node2.type) && !isEmaneType(node1.type)) {
    return { valid: false, message: "无人机只能接入子网(EMANE)节点" };
  }

  // 只有无人机和基站节点可以接入EMANE
  if (
    isEmaneType(node1.type) &&
    !isDroneType(node2.type) &&
    !isBaseStationType(node2.type)
  ) {
    return { valid: false, message: "只有无人机和基站可以接入子网(EMANE)节点" };
  }

  if (
    isEmaneType(node2.type) &&
    !isDroneType(node1.type) &&
    !isBaseStationType(node1.type)
  ) {
    return { valid: false, message: "只有无人机和基站可以接入子网(EMANE)节点" };
  }

  // 检查节点角色是否匹配
  if (isEmaneType(node1.type) || isEmaneType(node2.type)) {
    const emaneNode = isEmaneType(node1.type) ? node1 : node2;
    const otherNode = isEmaneType(node1.type) ? node2 : node1;
    
    // 获取节点角色
    const emaneRole = emaneNode.role || 'WHITE';
    const otherRole = otherNode.role || 'WHITE';
    // 白方角色节点可与任何角色节点接入，仅当双方都不是白方且角色不同时才拒绝
    if (emaneRole !== 'WHITE' && otherRole !== 'WHITE' && emaneRole !== otherRole) {
      return { 
        valid: false, 
        message: `节点角色不匹配` 
      };
    }
  }

  // 辅助函数：获取节点的有效emane_configs（如果节点的emane_configs为null，则使用子网的配置）
  const getEffectiveEmaneConfigs = (node: any) => {
    if (node.emane_configs) {
      return node.emane_configs;
    }
    // 如果节点的emane_configs为null，尝试获取其接入的子网的配置
    const nodes = topoStore.topoData?.nodes || [];
    // 查找与该节点连接的子网节点
    for (const subnetNode of nodes) {
      if (subnetNode.type === "EMANE" && node.emane === subnetNode.emane) {
        return subnetNode.emane_configs;
      }
    }
    return null;
  };
  
  if (!isEmaneType(node1.type) && !isEmaneType(node2.type)) {

    if (node1.emane && node2.emane && node1.emane !== node2.emane) {
      return { valid: false, message: "两个节点必须连接到同一个子网节点" };
    }

    // 获取两个节点的有效emane_configs
    const configs1 = getEffectiveEmaneConfigs(node1);
    const configs2 = getEffectiveEmaneConfigs(node2);
    
    // 如果两个节点都有有效配置，则比较它们是否相同
    if (configs1 && configs2) {
      const emaneConfigs1 = JSON.stringify(configs1);
      const emaneConfigs2 = JSON.stringify(configs2);
      console.log('两个节点的emane_configs:', emaneConfigs1, emaneConfigs2);  
      
      if (configs1 != configs2) {
        return { valid: false, message: "两个节点的无线参数配置必须完全相同" };
      }
    }
  }
  
  // 对于EMANE节点与非EMANE节点之间的连接，非EMANE节点的emane_configs可以为空
  // 不需要强制检查emane_configs字段

  // 所有限制都通过
  return { valid: true, message: "" };
};

// 处理左键点击事件
const handleLeftClick = (movement: { position: Cesium.Cartesian2 }) => {
  if (!cesiumViewer.value) return;

  // 优先处理模板放置模式
  if (isWaitingForTemplatePlacement.value) {
    handleMapClick(movement);
    return;
  }

  // 获取点击的实体
  const picked = cesiumViewer.value.scene.pick(movement.position);

  // 添加节点模式
  if (topoStore.operationMode === "add") {
    // 获取点击位置的地理坐标
    const position = getGroundPosition(cesiumViewer.value, movement.position);

    if (!position) {
      ElMessage.warning("请点击地球表面");
      return;
    }

    // 更新位置并显示配置对话框
    updatePositionAndShowDialog(position);
  }
  // 链路连接模式
  else if (topoStore.operationMode === "connect") {
    // 如果是删除链路模式
    if (selectedItem.value?.name === "删除链路") {
      // 检查是否点击了链路实体
      if (
        Cesium.defined(picked) &&
        picked.id &&
        typeof picked.id.id === "string" &&
        picked.id.id.startsWith("link-")
      ) {
        // 解析链路ID以获取两个节点ID
        const linkIdMatch = picked.id.id.match(/link-(\d+)-(\d+)/);

        if (linkIdMatch && linkIdMatch.length === 3) {
          const node1Id = parseInt(linkIdMatch[1], 10);
          const node2Id = parseInt(linkIdMatch[2], 10);

          // 查找对应的链路
          const link = topoStore.topoData?.links?.find(
            (l: any) =>
              (l.node1_id === node1Id && l.node2_id === node2Id) ||
              (l.node1_id === node2Id && l.node2_id === node1Id)
          );

          if (link) {
            const node1 = topoStore.topoData?.nodes?.find((n: any) => n.id === link.node1_id);
            const node2 = topoStore.topoData?.nodes?.find((n: any) => n.id === link.node2_id);
            
            if (node1 && node2) {
              const isEmaneLink = (node1.type === 'EMANE' && node2.type !== 'EMANE') || 
                                 (node2.type === 'EMANE' && node1.type !== 'EMANE');
              
              if (isEmaneLink) {
                ElMessage.warning("不能删除节点与子网之间的链路");
                return;
              }
            }
            
            // 显示确认对话框
            ElMessageBox.confirm(
              `确定要删除 ${getNodeName(link.node1_id)} 和 ${getNodeName(
                link.node2_id
              )} 之间的链路吗？`,
              "删除链路",
              {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
              }
            )
              .then(async () => {
                try {
                  // 调用删除链路API，传递完整的链路对象
                  await (topoStore as any).deleteLinkRemote(link);

                  ElMessage.success("链路删除成功");
                  // 切换回选择模式
                  (topoStore as any).setOperationMode("select");
                } catch (error: any) {
                  ElMessage.error(error?.message || "删除链路失败");
                }
              })
              .catch(() => {
                ElMessage.info("已取消删除");
              });
            return;
          }
        }

        ElMessage.warning("请点击有效的链路");
        return;
      }

      ElMessage.warning("请点击链路进行删除");
      return;
    }
    // 否则是添加链路模式
    else if (Cesium.defined(picked) && picked.id) {
      handleNodeClickForConnect(picked.id);
    } else {
      ElMessage.warning("请点击节点");
    }
  }
  // 选择模式
  else {
    if (Cesium.defined(picked) && picked.id) {
      // 检查是否点击了链路实体
      if (
        typeof picked.id.id === "string" &&
        (picked.id.id.startsWith("link-") || picked.id.id.startsWith("subnet-"))
      ) {

        // 普通链路处理
        if (picked.id.id.startsWith("link-")) {
          // 解析链路ID以获取两个节点ID
          const linkIdMatch = picked.id.id.match(/link-(\d+)-(\d+)/);
          if (linkIdMatch && linkIdMatch.length === 3) {
            const node1Id = parseInt(linkIdMatch[1], 10);
            const node2Id = parseInt(linkIdMatch[2], 10);

            // 查找对应的链路
            const link = topoStore.topoData?.links?.find(
              (l: any) =>
                (l.node1_id === node1Id && l.node2_id === node2Id) ||
                (l.node1_id === node2Id && l.node2_id === node1Id)
            );

            if (link) {
              // 显示链路信息面板
              selectedLink.value = link;
              linkInfoPanelVisible.value = true;
              nodeInfoPanelVisible.value = false; // 关闭节点信息面板
              interferenceNodeInfoPanelVisible.value = false; // 关闭干扰节点信息面板
              return;
            }
          }
        }
        // 子网内部链路处理
        else if (picked.id.id.startsWith("subnet-")) {
          // 解析子网链路ID，格式为subnet-${subnetId}-link-${node1Id}-${node2Id}
          const subnetLinkMatch = picked.id.id.match(/subnet-(\d+)-link-(\d+)-(\d+)/);
          if (subnetLinkMatch && subnetLinkMatch.length === 4) {
            const subnetId = parseInt(subnetLinkMatch[1], 10);
            const node1Id = parseInt(subnetLinkMatch[2], 10);
            const node2Id = parseInt(subnetLinkMatch[3], 10);

            // 获取两个节点信息
            const node1 = topoStore.topoData?.nodes?.find((n: any) => n.id === node1Id);
            const node2 = topoStore.topoData?.nodes?.find((n: any) => n.id === node2Id);

            if (node1 && node2) {
              // 使用子网链路管理器创建临时链路对象
              const tempLink = subnetLinksManager.createSubnetLinkObject(
                subnetId,
                node1Id,
                node2Id
              );

              // 显示链路信息面板
              selectedLink.value = tempLink;
              linkInfoPanelVisible.value = true;
              nodeInfoPanelVisible.value = false; // 关闭节点信息面板
              interferenceNodeInfoPanelVisible.value = false; // 关闭干扰节点信息面板
              return;
            }
          }
        }
      }

      // 如果不是链路实体，则显示节点信息面板
      cesiumViewer.value.selectedEntity = picked.id;
    } else {
      // 点击空白处，关闭所有信息面板（除了EMANE信息面板）
      nodeInfoPanelVisible.value = false;
      linkInfoPanelVisible.value = false;
      // 移除了关闭EMANE信息面板的代码
      interferenceNodeInfoPanelVisible.value = false; // 添加关闭干扰节点信息面板的代码
    }
  }
};

// 处理双击事件
const handleDoubleClick = (movement: { position: Cesium.Cartesian2 }) => {
  if (!cesiumViewer.value) return;

  // 获取双击的实体
  const picked = cesiumViewer.value.scene.pick(movement.position);

  // 只在选择模式下处理双击事件
  if (topoStore.operationMode === "select") {
    if (Cesium.defined(picked) && picked.id) {
      // 检查是否双击了链路实体
      if (
        typeof picked.id.id === "string" &&
        (picked.id.id.startsWith("link-") || picked.id.id.startsWith("subnet-"))
      ) {
        // 普通链路处理
        if (picked.id.id.startsWith("link-")) {
          // 解析链路ID以获取两个节点ID
          const linkIdMatch = picked.id.id.match(/link-(\d+)-(\d+)/);
          if (linkIdMatch && linkIdMatch.length === 3) {
            const node1Id = parseInt(linkIdMatch[1], 10);
            const node2Id = parseInt(linkIdMatch[2], 10);

            // 查找对应的链路
            const link = topoStore.topoData?.links?.find(
              (l: any) =>
                (l.node1_id === node1Id && l.node2_id === node2Id) ||
                (l.node1_id === node2Id && l.node2_id === node1Id)
            );

            if (link) {
              if (link.type === 'WIRELESS') {
                // 无线链路：打开EMANE MAC信息面板
                selectedLinkForEmane.value = { ...link };
                emaneMacInfoPanelVisible.value = true;
                // ElMessage.success("已打开链路EMANE监控面板");
              } else {
                // 有线链路：打开链路信息面板
                selectedLink.value = { ...link };
                linkInfoPanelVisible.value = true;
              }
              return;
            }
          }
        }
        // 子网内部链路处理
        else if (picked.id.id.startsWith("subnet-")) {
          // 解析子网链路ID，格式为subnet-${subnetId}-link-${node1Id}-${node2Id}
          const subnetLinkMatch = picked.id.id.match(/subnet-(\d+)-link-(\d+)-(\d+)/);
          if (subnetLinkMatch && subnetLinkMatch.length === 4) {
            const subnetId = parseInt(subnetLinkMatch[1], 10);
            const node1Id = parseInt(subnetLinkMatch[2], 10);
            const node2Id = parseInt(subnetLinkMatch[3], 10);

            // 获取两个节点信息
            const node1 = topoStore.topoData?.nodes?.find((n: any) => n.id === node1Id);
            const node2 = topoStore.topoData?.nodes?.find((n: any) => n.id === node2Id);

            if (node1 && node2) {
              // 使用子网链路管理器创建临时链路对象
              const tempLink = subnetLinksManager.createSubnetLinkObject(
                subnetId,
                node1Id,
                node2Id
              );

              // 直接打开EMANE MAC信息面板
              selectedLinkForEmane.value = { ...tempLink };
              emaneMacInfoPanelVisible.value = true;
              ElMessage.success("已打开子网链路EMANE监控面板");
              return;
            }
          }
        }
      }
    }
  }
};

// 辅助方法：根据节点ID获取节点名称
const getNodeName = (nodeId: number): string => {
  const node = topoStore.topoData?.nodes?.find((n: any) => n.id === nodeId);
  return node ? (node.alias || node.name) : `节点${nodeId}`;
};

// 处理节点配置确认
const handleNodeConfirm = async (nodeData: any) => {
  // 检查nodeData是否为数组（星形编队模式）
  if (Array.isArray(nodeData)) {
    ElMessage.success(`已创建${nodeData.length}个节点编队`);
    configDialogVisible.value = false; // Ensure dialog closes
    topoStore.operationMode = "select"; // Corrected: Exit placement mode

    // 记录日志
    systemLogStore.addLog({
      type: "important",
      module: "node",
      action: "创建节点编队",
      information: "节点编队创建成功",
      details: `创建了${nodeData.length}个节点编队`,
    });

    // 发送跨页面同步消息，通知其他页面（如资源库页面）
    await nextTick();
    sendCrossPageSyncMessage();

    return;
  }

  // 单个节点模式
  configDialogVisible.value = false; // Ensure dialog closes
  topoStore.operationMode = "select"; // Corrected: Exit placement mode

  // 记录日志
  systemLogStore.addLog({
    type: "normal",
    module: "node",
    action: "创建节点",
    information: "节点创建成功",
    details: `创建了节点 "${nodeData.alias || nodeData.name}"，类型: ${
      nodeData.type
    }, 位置: ${geoToXYHText(nodeData.geo.lon, nodeData.geo.lat, nodeData.geo.alt)}`,
  });

  // 节点已添加到Pinia仓库，Cesium实体会自动创建

  // 发送跨页面同步消息，通知其他页面（如资源库页面）
  await nextTick();
  sendCrossPageSyncMessage();
};

// 处理节点配置取消
const handleNodeCancel = () => {
  ElMessage.info("已取消创建节点");
  configDialogVisible.value = false; // Ensure this is closed
  topoStore.operationMode = "select"; // Corrected: Exit placement mode
};

// 处理链路配置确认
const handleLinkConfirm = (link: any) => {
  ElMessage.success(`链路添加成功`);

  // 记录日志
  const sourceNodeName = getNodeName(link.node1_id);
  const targetNodeName = getNodeName(link.node2_id);

  systemLogStore.addLog({
    type: "normal",
    module: "link",
    action: "创建链路",
    information: "链路创建成功",
    details: `创建了从 "${sourceNodeName}" 到 "${targetNodeName}" 的${
      link.type === "WIRED" ? "有线" : "无线"
    }链路`,
  });

  // 重置节点选择状态
  sourceNode.value = null;
  targetNode.value = null;
};

// 处理链路配置取消
const handleLinkCancel = () => {
  ElMessage.info("已取消创建链路");
  // 重置节点选择状态
  sourceNode.value = null;
  targetNode.value = null;
  linkDialogVisible.value = false; // Ensure dialog closes
  topoStore.operationMode = "select"; // Corrected: Exit placement mode
};

// 处理分布式链路配置确认
const handleDistributedLinkConfirm = (result: any) => {
  distributedLinkDialogVisible.value = false;

  if (result && result.createdLinks && result.createdLinks.length > 0) {
    ElMessage.success(`成功创建 ${result.createdLinks.length} 条分布式链路`);

    // 记录日志
    systemLogStore.addLog({
      type: "important",
      module: "link",
      action: "分布式链路配置",
      information: "分布式链路创建成功",
      details: `成功创建 ${result.createdLinks.length} 条分布式链路`
    });
  }
};

// 处理分布式链路配置取消
const handleDistributedLinkCancel = () => {
  distributedLinkDialogVisible.value = false;
  ElMessage.info("已取消分布式链路配置");
};

// 处理子网配置确认
const handleSubnetConfirm = async (subnet: any) => {
  subnetConfigDialogVisible.value = false; // Ensure dialog closes
  topoStore.operationMode = "select"; // Corrected: Exit placement mode

  // 记录日志
  systemLogStore.addLog({
    type: "important",
    module: "subnet",
    action: "创建子网",
    information: "子网创建成功",
    details: `创建了子网 "${subnet.name}"，位置: ${geoToXYHText(subnet.geo.lon, subnet.geo.lat, subnet.geo.alt)}`,
  });

  // 子网已添加到Pinia仓库，Cesium实体会自动创建

  // 发送跨页面同步消息，通知其他页面（如资源库页面）
  await nextTick();
  sendCrossPageSyncMessage();
};

// 处理子网配置取消
const handleSubnetCancel = () => {
  ElMessage.info("已取消创建子网");
  subnetConfigDialogVisible.value = false; // Ensure this is closed
  topoStore.operationMode = "select"; // Corrected: Exit placement mode
};

// 处理干扰节点配置确认
const handleInterferenceNodeConfigConfirm = async (nodeData: any) => {
  showInterferenceConfigDialog.value = false;
  topoStore.operationMode = "select"; // Corrected: Exit placement mode

  // 记录日志
  systemLogStore.addLog({
    type: "important",
    information: "操作成功",
    module: "interference",
    action: "创建干扰节点",
    details: `创建了干扰节点 "${nodeData.alias || nodeData.name}"，位置: ${geoToXYHText(nodeData.geo.lon, nodeData.geo.lat, nodeData.geo.alt)}`,
  });

  // 发送跨页面同步消息，通知其他页面（如资源库页面）
  await nextTick();
  sendCrossPageSyncMessage();
};

// 处理干扰节点配置取消
const handleInterferenceNodeConfigCancel = () => {
  showInterferenceConfigDialog.value = false;
  topoStore.operationMode = "select"; // Corrected: Exit placement mode
  ElMessage.info("已取消创建干扰节点");
};

// 确保topoData已初始化
const ensureTopoDataExists = () => {
  if (!topoStore.topoData) {
    // @ts-ignore: 忽略类型检查错误，该方法确实存在
    topoStore.initEmptyTopoData();
  }

  // 确保nodes和links数组存在
  if (topoStore.topoData) {
    if (!Array.isArray(topoStore.topoData.nodes)) {
      topoStore.topoData.nodes = [];
    }

    if (!Array.isArray(topoStore.topoData.links)) {
      topoStore.topoData.links = [];
    }
  }
};

// 同步已有节点到Cesium
const syncExistingNodes = () => {
  // 确保有持久化的节点数据和Cesium实体管理器
  if (!cesiumEntities.value) {
    console.warn("无法同步节点: cesiumEntities为null");
    return;
  }

  if (topoStore.topoData?.nodes?.length > 0) {
    // 使用Promise确保同步完成
    Promise.resolve()
      .then(() => {
        if (cesiumEntities.value) {
          cesiumEntities.value.syncNodesToEntities();
        }
      })
      .catch((error) => {
        console.error("同步节点时出错:", error);
      });
  }
};

// 同步已有链路到Cesium
const syncExistingLinks = () => {
  // 确保有持久化的链路数据和Cesium实体管理器
  if (!cesiumEntities.value) {
    console.warn("无法同步链路: cesiumEntities为null");
    return;
  }

  if (topoStore.topoData?.links?.length > 0) {
    // 使用Promise确保同步完成
    Promise.resolve()
      .then(() => {
        if (cesiumEntities.value) {
          cesiumEntities.value.syncLinksToEntities();
        }
      })
      .catch((error) => {
        console.error("同步链路时出错:", error);
      });
  }
};

// 自定义虚线网格瓦片 ImageryProvider
function createDashedGridImageryProvider(options?: {
  cells?: number;
  tileWidth?: number;
  tileHeight?: number;
  color?: string;
  lineWidth?: number;
  dashPattern?: number[];
}) {
  const cells = options?.cells ?? 4;
  const tileWidth = options?.tileWidth ?? 256;
  const tileHeight = options?.tileHeight ?? 256;
  const color = options?.color ?? '#cccccc';
  const lineWidth = options?.lineWidth ?? 1;
  const dashPattern = options?.dashPattern ?? [6, 4];
  const tilingScheme = new Cesium.GeographicTilingScheme();

  return {
    tilingScheme,
    tileWidth,
    tileHeight,
    rectangle: tilingScheme.rectangle,
    minimumLevel: 0,
    maximumLevel: 18,
    hasAlphaChannel: true,
    ready: true,
    readyPromise: Promise.resolve(true),
    getTileCredits() { return []; },
    requestImage(_x: number, _y: number, _level: number) {
      const canvas = document.createElement('canvas');
      canvas.width = tileWidth;
      canvas.height = tileHeight;
      const ctx = canvas.getContext('2d')!;

      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tileWidth, tileHeight);

      // 虚线网格
      ctx.setLineDash(dashPattern);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      const cellW = tileWidth / cells;
      const cellH = tileHeight / cells;

      for (let i = 0; i <= cells; i++) {
        // 竖线
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, tileHeight);
        ctx.stroke();
        // 横线
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(tileWidth, i * cellH);
        ctx.stroke();
      }

      return Promise.resolve(canvas as any);
    },
  };
}

function applyMapMode(showSatellite: boolean, viewerInstance?: Cesium.Viewer) {
  const viewer = viewerInstance ?? cesiumViewer.value;
  if (!viewer) return;

  if (gridImageryLayer.value) {
    gridImageryLayer.value.show = !showSatellite;
  }
  if (satelliteImageryLayer.value) {
    satelliteImageryLayer.value.show = showSatellite;
  }

  viewer.scene.globe.baseColor = showSatellite
    ? Cesium.Color.BLACK
    : Cesium.Color.WHITE;
  viewer.scene.backgroundColor = showSatellite
    ? Cesium.Color.BLACK
    : Cesium.Color.WHITE;
  isSimpleMapMode.value = showSatellite;
}

// 根据相机高度计算当前最小网格分辨率（米/格）
const GRID_CELLS_PER_TILE = 4;
const GRID_MAX_LEVEL = 18; // 与 provider maximumLevel 保持一致

/**
 * 从 imagery layer 读取屏幕中心点实际渲染的 tile level，
 * 再据此计算每格对应的米数。
 */
function computeGridResolutionFromViewer(viewer: Cesium.Viewer): string {
  // 尝试从 imagery layer 的 _tileProvider 获取实际 tile level
  const gridLayer = viewer.imageryLayers.get(0);
  let level = -1;

  // 方法1：通过 globe._surface._tilesToRender 获取实际渲染的 tile level
  try {
    const surface = (viewer.scene.globe as any)._surface;
    const tiles = surface?._tilesToRender;
    if (tiles && tiles.length > 0) {
      // 取所有渲染 tile 的最大 level（即最精细的）
      let maxLevel = 0;
      for (const tile of tiles) {
        if (tile.level > maxLevel) maxLevel = tile.level;
      }
      level = Math.min(maxLevel, GRID_MAX_LEVEL);
    }
  } catch (_) {
    // fallback below
  }

  // 方法2：如果无法获取，用改进的公式
  if (level < 0) {
    const height = viewer.camera.positionCartographic.height;
    const R = 6378137;
    // Cesium 的 GeographicTilingScheme level 0 有 2 列 1 行
    // 每个 tile 覆盖 180° 经度。level N 覆盖 180°/2^N
    // 相机视野约 60°，屏幕约能放 ~2-3 个 tile
    // Cesium 的 SSE 选择：tileSize(px) * height / (screenWidth * tileGeoSize) < SSE
    level = Math.max(0, Math.round(Math.log2((2 * Math.PI * R) / height)) - 2);
    level = Math.min(level, GRID_MAX_LEVEL);
  }

  // GeographicTilingScheme: level N 时，经度方向有 2^(N+1) 个 tile
  // 每个 tile 覆盖 360°/2^(N+1) 经度 → 赤道处 ≈ 40075km/2^(N+1) 米
  // 每个 tile 内有 GRID_CELLS_PER_TILE 个格子
  const cellMeters = 40075000 / (Math.pow(2, level + 1) * GRID_CELLS_PER_TILE);

  if (cellMeters >= 1000) {
    return `${(cellMeters / 1000).toFixed(1)} km/格`;
  }
  return `${Math.round(cellMeters)} m/格`;
}

// ===== 平面坐标系（ENU）转换 =====
import { cartesianToENU, formatCoord, geoToXYHText, originCartesian3 } from '../../../utils/coordTransform';

// 初始化Cesium Viewer
const initCesiumViewer = async (container: HTMLElement) => {
  try {
    // 创建Viewer实例 —— 白色网格底图，不加载卫星影像
    const viewer = new Cesium.Viewer(container as unknown as Element, {
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: true,
      baseLayerPicker: false,       // 不需要底图选择器
      animation: false,
      timeline: false,
      fullscreenButton: false,
      geocoder: true,
      homeButton: true,
      sceneModePicker: true,
    });

    // 设置白色地球底色
    viewer.scene.globe.baseColor = Cesium.Color.WHITE;

    // 添加网格底图（白底 + 灰色虚线网格）
    const gridProvider = createDashedGridImageryProvider({
      cells: 4,
      color: '#cccccc',
      dashPattern: [6, 4],
    });
    const gridLayer = viewer.imageryLayers.addImageryProvider(gridProvider as any);
    gridLayer.alpha = 1.0;
    gridImageryLayer.value = gridLayer;

    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: "/map-tiles/{z}/{x}/{reverseY}.png",
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      rectangle: Cesium.Rectangle.fromDegrees(-180, -85.0511, 180, 85.0511),
      minimumLevel: 0,
      maximumLevel: 14,
      tileWidth: 256,
      tileHeight: 256,
    });
    const satelliteLayer = viewer.imageryLayers.addImageryProvider(imageryProvider);
    satelliteImageryLayer.value = satelliteLayer;
    applyMapMode(false, viewer);

    // 在原点位置添加十字标注（屏幕空间固定像素，随缩放等比）
    viewer.entities.add({
      position: originCartesian3,
      label: {
        text: '+',
        font: '20px monospace',
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.TRANSPARENT,
        style: Cesium.LabelStyle.FILL,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(500, 1.5, 50000, 0.5),
      },
    });

    // 加载OSM建筑数据
    // try {
    //   const buildingTileset = await Cesium.Cesium3DTileset.fromIonAssetId(2602291);
    //   viewer.scene.primitives.add(buildingTileset);
    //   // 保存建筑图层引用
    //   osmBuildings.value = buildingTileset;
      
    //   // 只在3D模式显示建筑，初始化时默认为3D模式
    //   if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
    //     buildingTileset.show = false;
    //   } else {
    //     buildingTileset.show = true;
    
    //   }
      
    //   console.log("OSM建筑加载完成");
      
    // } catch (error) {
    //   console.warn("加载OSM建筑失败:", error);
    // }
    
    // 隐藏水印
    if (viewer.cesiumWidget?.creditContainer) {
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    }

    return viewer;
  } catch (error) {
    console.error("创建Cesium Viewer时出错:", error);
    ElMessage.error("初始化3D地球失败，请刷新页面重试");
    throw error;
  }
};

// 切换底图模式：白色网格（默认） <-> 卫星地图
const toggleMapMode = () => {
  if (!cesiumViewer.value) return;

  applyMapMode(!isSimpleMapMode.value);
};

// 配置Cesium场景
const setupCesiumScene = (viewer: Cesium.Viewer) => {
  // 设置默认视角
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      CESIUM_CONFIG.DEFAULT_VIEW.longitude,
      CESIUM_CONFIG.DEFAULT_VIEW.latitude,
      CESIUM_CONFIG.DEFAULT_VIEW.height
    ),
    // orientation : new Cesium.HeadingPitchRoll(
    //   CESIUM_CONFIG.DEFAULT_VIEW.heading,
    //   CESIUM_CONFIG.DEFAULT_VIEW.pitch,
    //   CESIUM_CONFIG.DEFAULT_VIEW.roll
    // ),
    duration: 3,
  });

  // 配置场景效果 —— 白色网格主题
  if (viewer.scene) {
    const { scene } = viewer;
    scene.globe.enableLighting = false;            // 关闭光照，保持纯白
    scene.backgroundColor = Cesium.Color.WHITE;    // 场景背景白色
    scene.fog.enabled = false;
    scene.skyBox.show = false;
    scene.skyAtmosphere.show = false;              // 关闭大气效果
    scene.sun.show = false;                        // 隐藏太阳
    scene.moon.show = false;                       // 隐藏月亮
    scene.globe.showGroundAtmosphere = false;      // 关闭地面大气
    scene.screenSpaceCameraController.enableRotate = true;

    // 限制最大缩放，网格 provider maximumLevel=13 → 最小 611m/格
    scene.screenSpaceCameraController.minimumZoomDistance = 100;
  }

  // 监听相机变化，更新网格分辨率标注
  viewer.camera.percentageChanged = 0.1; // 灵敏度：10% 变化即触发
  const updateResolutionLabel = () => {
    gridResolutionText.value = computeGridResolutionFromViewer(viewer);
  };
  viewer.camera.changed.addEventListener(updateResolutionLabel);
  // 初始化一次
  updateResolutionLabel();

  // 监听鼠标移动，更新平面坐标显示
  viewer.screenSpaceEventHandler.setInputAction(
    (movement: { endPosition: typeof Cesium.Cartesian2.prototype }) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const enu = cartesianToENU(cartesian);
        mouseCoordText.value = `X: ${formatCoord(enu.x)}  Y: ${formatCoord(enu.y)}  Z: ${formatCoord(enu.h)}`;
      } else {
        mouseCoordText.value = '';
      }
    },
    Cesium.ScreenSpaceEventType.MOUSE_MOVE
  );

  // 添加事件监听
  viewer.screenSpaceEventHandler.setInputAction(
    handleLeftClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );

  // 添加双击事件监听
  viewer.screenSpaceEventHandler.setInputAction(
    handleDoubleClick,
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  // 监听实体选中事件，弹出节点信息面板
  viewer.selectedEntityChanged.addEventListener((entity: any) => {
    if (entity && typeof entity.id === "string" && /^\d+$/.test(entity.id)) {
      const nodeId = parseInt(entity.id, 10);
      const node = topoStore.topoData?.nodes?.find((n: any) => n.id === nodeId);
      if (node) {
        // 根据节点类型显示不同的信息面板
        if (node.type === "INODE") {
          // 显示干扰节点信息面板
          selectedInterferenceNode.value = node;
          interferenceNodeInfoPanelVisible.value = true;
          nodeInfoPanelVisible.value = false; // 确保关闭普通节点信息面板
        } else {
          // 显示普通节点信息面板
          selectedNode.value = node;
          nodeInfoPanelVisible.value = true;
          interferenceNodeInfoPanelVisible.value = false; // 确保关闭干扰节点信息面板
        }

        // 关闭链路信息面板
        linkInfoPanelVisible.value = false;
        // 不再关闭EMANE MAC信息面板
      }
    }
  });
};

// 飞回初始视角
const flyToHomeHandler = () => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法返回初始视角");
    return;
  }

  try {
    // 飞回初始视角，移动时间设为1秒
    cesiumViewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        CESIUM_CONFIG.DEFAULT_VIEW.longitude,
        CESIUM_CONFIG.DEFAULT_VIEW.latitude,
        CESIUM_CONFIG.DEFAULT_VIEW.height
      ),
      duration: 2, // 移动时间1秒
      complete: () => {
        // 返回初始视角完成
      },
    });
  } catch (error) {
    console.error("返回初始视角时出错:", error);
    ElMessage.error("返回初始视角失败");
  }
};

// 视图模式切换函数
const switchViewMode = (mode: string) => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法切换视图模式");
    return;
  }

  try {
    // 先处理OSM建筑，避免模式切换时的渲染错误
    if (osmBuildings.value) {
      // 无论切换到什么模式，先隐藏建筑
      osmBuildings.value.show = false;
    }
    
    // 切换视图模式
    switch (mode) {
      case "SCENE3D":
        cesiumViewer.value.scene.mode = Cesium.SceneMode.SCENE3D;
        
        // 从其他模式切换到3D模式时，需要重新加载OSM建筑以避免渲染错误
        // if (osmBuildings.value && cesiumViewer.value) {
        //   // 使用setTimeout延迟处理建筑，确保场景模式已完全切换
        //   setTimeout(async () => {
        //     if (!cesiumViewer.value) return; // 确保viewer仍然存在
            
        //     try {
        //       // 移除旧的建筑图层
        //       if (osmBuildings.value) {
        //         cesiumViewer.value.scene.primitives.remove(osmBuildings.value);
        //       }
              
        //       // 重新加载OSM建筑
        //       const buildingTileset = await Cesium.createOsmBuildingsAsync();
        //       cesiumViewer.value.scene.primitives.add(buildingTileset);
        //       osmBuildings.value = buildingTileset;
        //       console.log("3D模式：已重新加载OSM建筑");
        //     } catch (e) {
        //       console.error("重新加载OSM建筑时出错:", e);
        //     }
        //   }, 500); // 延迟500毫秒，确保场景模式已切换完成
        // }
        break;
        
      case "SCENE2D":
        cesiumViewer.value.scene.mode = Cesium.SceneMode.SCENE2D;
        // 2D模式下不显示建筑
        break;
        
      case "COLUMBUS_VIEW":
        cesiumViewer.value.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
        // 哥伦布视图模式下不显示建筑
        break;
        
      default:
        console.warn(`未知的视图模式: ${mode}`);
    }
  } catch (error) {
    console.error("切换视图模式时出错:", error);
    ElMessage.error("切换视图模式失败");
  }
};

// 处理渲染性能设置
const handleRenderPerformance = (mode: string) => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法设置渲染性能");
    return;
  }

  try {
    const viewer = cesiumViewer.value;
    const scene = viewer.scene;

    switch (mode) {
      case "high":
        // 高质量渲染模式：有地形、有地图影像、画面质量高，有水波纹等
        if (scene.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
          // 使用异步函数加载地形
          Cesium.createWorldTerrainAsync().then((terrainProvider) => {
            scene.terrainProvider = terrainProvider;
          });
        }
        scene.globe.enableLighting = true;
        scene.globe.showWaterEffect = true;
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        scene.skyAtmosphere.show = true;
        scene.globe.maximumScreenSpaceError = 2; // 更低的值 = 更高的质量
        scene.postProcessStages.fxaa.enabled = true;
        ElMessage.success("已切换到高质量渲染模式");
        break;

      case "medium":
        // 中质量渲染模式：有地形、有影像、画面质量一般
        if (scene.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
          // 使用异步函数加载地形
          Cesium.createWorldTerrainAsync().then((terrainProvider) => {
            scene.terrainProvider = terrainProvider;
          });
        }
        scene.globe.enableLighting = false;
        scene.globe.showWaterEffect = false;
        scene.fog.enabled = true;
        scene.fog.density = 0.0001;
        scene.skyAtmosphere.show = true;
        scene.globe.maximumScreenSpaceError = 4; // 中等质量
        scene.postProcessStages.fxaa.enabled = false;
        ElMessage.success("已切换到中质量渲染模式");
        break;

      case "low":
        // 低质量渲染模式：只有影像，不加载地形
        scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        scene.globe.enableLighting = false;
        scene.globe.showWaterEffect = false;
        scene.fog.enabled = false;
        scene.skyAtmosphere.show = false;
        scene.globe.maximumScreenSpaceError = 8; // 更高的值 = 更低的质量
        scene.postProcessStages.fxaa.enabled = false;
        ElMessage.success("已切换到低质量渲染模式");
        break;

      default:
        console.warn(`未知的渲染性能模式: ${mode}`);
    }

    // 强制刷新渲染
    scene.requestRender();
  } catch (error) {
    console.error("设置渲染性能时出错:", error);
    ElMessage.error("设置渲染性能失败");
  }
};

// 搜索位置并飞向该位置
const searchLocationHandler = async (searchQuery: string) => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法搜索位置");
    return;
  }

  try {
    // 显示加载状态
    const loadingInstance = ElMessage.info({
      message: `正在搜索: ${searchQuery}...`,
      duration: 0,
    });

    // 预定义常见城市位置
    const knownLocations: Record<string, { lon: number; lat: number; height: number }> = {
      北京: { lon: 116.4074, lat: 39.9042, height: 10000 },
      上海: { lon: 121.4737, lat: 31.2304, height: 10000 },
      广州: { lon: 113.2644, lat: 23.1291, height: 10000 },
      深圳: { lon: 114.0579, lat: 22.5431, height: 10000 },
      重庆: { lon: 106.5049, lat: 29.5332, height: 10000 },
      成都: { lon: 104.0647, lat: 30.6595, height: 10000 },
      西安: { lon: 108.9401, lat: 34.3416, height: 10000 },
      武汉: { lon: 114.3055, lat: 30.5928, height: 10000 },
      长沙: { lon: 112.9822, lat: 28.1941, height: 10000 },
      南京: { lon: 118.7969, lat: 32.0603, height: 10000 },
      杭州: { lon: 120.1536, lat: 30.2875, height: 10000 },
      香港: { lon: 114.1694, lat: 22.3193, height: 10000 },
      台北: { lon: 121.5654, lat: 25.033, height: 10000 },
      东京: { lon: 139.6917, lat: 35.6895, height: 10000 },
      纽约: { lon: -74.006, lat: 40.7128, height: 10000 },
      伦敦: { lon: -0.1278, lat: 51.5074, height: 10000 },
      巴黎: { lon: 2.3522, lat: 48.8566, height: 10000 },
      悉尼: { lon: 151.2093, lat: -33.8688, height: 10000 },
      莫斯科: { lon: 37.6173, lat: 55.7558, height: 10000 },
      柏林: { lon: 13.405, lat: 52.52, height: 10000 },
      罗马: { lon: 12.4964, lat: 41.9028, height: 10000 },
      首尔: { lon: 126.978, lat: 37.5665, height: 10000 },
      曼谷: { lon: 100.5018, lat: 13.7563, height: 10000 },
      新加坡: { lon: 103.8198, lat: 1.3521, height: 10000 },
      洛杉矶: { lon: -118.2437, lat: 34.0522, height: 10000 },
      芝加哥: { lon: -87.6298, lat: 41.8781, height: 10000 },
    };

    // 搜索常见位置
    const location = Object.keys(knownLocations).find(
      (name) =>
        searchQuery.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 关闭加载提示
    loadingInstance.close();

    if (location) {
      const { lon, lat, height } = knownLocations[location];
      // 飞向搜索结果位置
      cesiumViewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        duration: 2, // 移动时间2秒
        complete: () => {
          ElMessage.success(`已定位到: ${location}`);
        },
      });
    } else {
      ElMessage.warning(`未找到位置: ${searchQuery}，请尝试搜索常见城市名称`);
    }
  } catch (error) {
    console.error("搜索位置时出错:", error);
    ElMessage.error(`搜索位置时出错: ${error}`);
  }
};

// 放大视图函数
const handleZoomIn = () => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法操作");
    return;
  }

  try {
    // 获取当前高度
    const cameraPosition = cesiumViewer.value.camera.position;
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);
    const height = cartographic.height;

    // 新高度为当前高度的60%
    const newHeight = height * 0.6;

    // 执行放大操作
    cesiumViewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        newHeight
      ),
      duration: 1.0,
    });
  } catch (error) {
    console.error("放大视图时出错:", error);
    ElMessage.error("放大视图失败");
  }
};

// 缩小视图函数
const handleZoomOut = () => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法操作");
    return;
  }

  try {
    // 获取当前高度
    const cameraPosition = cesiumViewer.value.camera.position;
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);
    const height = cartographic.height;

    // 新高度为当前高度的1.7倍
    const newHeight = height * 1.7;

    // 执行缩小操作
    cesiumViewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        newHeight
      ),
      duration: 1.0,
    });
  } catch (error) {
    console.error("缩小视图时出错:", error);
    ElMessage.error("缩小视图失败");
  }
};

// 刷新场景函数
const handleRefreshScene = () => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化，无法刷新场景");
    return;
  }

  try {
    // 获取Viewer引用以避免TypeScript的null检查警告
    const viewer = cesiumViewer.value;

    // 显示加载提示
    const loadingInstance = ElMessage.info({
      message: "正在刷新场景...",
      duration: 0,
    });

    // 强制刷新 - 先移除所有实体和数据
    viewer.entities.removeAll();
    viewer.dataSources.removeAll();

    // 重新加载地形和影像图层
    const refreshLayers = async () => {
      try {
        // 确保viewer仍然存在
        if (!cesiumViewer.value) {
          loadingInstance.close();
          throw new Error("Cesium Viewer已被销毁");
        }

        // 使用已确认存在的viewer引用
        const currentViewer = cesiumViewer.value;

        // 清除所有现有图层
        while (currentViewer.imageryLayers.length > 0) {
          currentViewer.imageryLayers.remove(currentViewer.imageryLayers.get(0), true);
        }

        // 重新添加虚线网格底图
        const gridProvider = createDashedGridImageryProvider({
          cells: 4,
          color: '#cccccc',
          dashPattern: [6, 4],
        });
        const gridLayer = currentViewer.imageryLayers.addImageryProvider(gridProvider as any);
        gridLayer.alpha = 0.5;
        gridImageryLayer.value = gridLayer;

        const imageryProvider = new Cesium.UrlTemplateImageryProvider({
          url: "/map-tiles/{z}/{x}/{reverseY}.png",
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          rectangle: Cesium.Rectangle.fromDegrees(-180, -85.0511, 180, 85.0511),
          minimumLevel: 0,
          maximumLevel: 14,
          tileWidth: 256,
          tileHeight: 256,
        });
        const satelliteLayer = currentViewer.imageryLayers.addImageryProvider(imageryProvider);
        satelliteImageryLayer.value = satelliteLayer;
        applyMapMode(isSimpleMapMode.value, currentViewer);
        //     try {
        //       // 延迟加载建筑，确保场景已经准备好
        //       setTimeout(async () => {
        //         if (!cesiumViewer.value) return;
                
        //         try {
        //           const buildingTileset = await Cesium.createOsmBuildingsAsync();
        //           cesiumViewer.value.scene.primitives.add(buildingTileset);
        //           osmBuildings.value = buildingTileset;
        //           console.log("刷新场景：OSM建筑已重新加载");
        //         } catch (e) {
        //           console.warn("重新加载OSM建筑时出错:", e);
        //         }
        //       }, 1000); // 延迟1秒，确保场景已刷新
        //     } catch (e) {
        //       console.warn("设置OSM建筑延迟加载时出错:", e);
        //     }
        //   } else {
        //     console.log("非3D模式，不加载OSM建筑");
        //   }
        // }

        // 强制刷新地球
        if (currentViewer.scene && currentViewer.scene.globe) {
          currentViewer.scene.globe.show = false;
          setTimeout(() => {
            // 再次检查viewer是否存在
            if (cesiumViewer.value) {
              const finalViewer = cesiumViewer.value;
              finalViewer.scene.globe.show = true;

              // 飞回初始视角而不是保持当前视角
              finalViewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                  CESIUM_CONFIG.DEFAULT_VIEW.longitude,
                  CESIUM_CONFIG.DEFAULT_VIEW.latitude,
                  CESIUM_CONFIG.DEFAULT_VIEW.height
                ),
                duration: 1.5, // 移动时间1.5秒
                complete: () => {
                  // 重新加载实体数据
                  syncExistingNodes();
                  syncExistingLinks();

                  // 关闭加载提示
                  loadingInstance.close();

                  // 显示成功消息
                  ElMessage.success("场景已刷新");
                },
              });
            } else {
              loadingInstance.close();
            }
          }, 500);
        }
      } catch (error) {
        console.error("刷新图层时出错:", error);
        loadingInstance.close();
        ElMessage.error("刷新图层失败");
      }
    };

    // 执行刷新
    refreshLayers();

    // 强制刷新渲染
    viewer.scene.requestRender();
  } catch (error) {
    console.error("刷新场景时出错:", error);
    ElMessage.error("刷新场景失败");
  }
};

// 处理模板放置开始
const handleStartTemplatePlacement = (data: any) => {
  if (!cesiumViewer.value) {
    ElMessage.warning("Cesium未初始化");
    return;
  }

  isWaitingForTemplatePlacement.value = true;

  // 改变鼠标光标样式
  const viewerContainer = cesiumViewer.value.container as HTMLElement;
  viewerContainer.style.cursor = 'crosshair';

  if (data && data.message) {
    ElMessage.info(data.message);
  }
};

// 处理模板放置结束
const handleEndTemplatePlacement = () => {
  if (!cesiumViewer.value) return;

  isWaitingForTemplatePlacement.value = false;

  // 恢复鼠标光标样式
  const viewerContainer = cesiumViewer.value.container as HTMLElement;
  viewerContainer.style.cursor = 'default';
};

const handleOpenServerConfigDialog = () => {
  serverConfigDialogVisible.value = true;
};

const handleOpenMatlabResults = (data: any) => {
  matlabResultPanelVisible.value = true;
  eventBus.emit('matlabResults', data);
};

const handleToggleRenderingMode = () => {
  if (cesiumEntities.value) {
    cesiumEntities.value.toggleRenderingMode();
    const currentMode = cesiumEntities.value.getRenderingMode();
    eventBus.emit("renderingModeChanged", currentMode.value);
  }
};

const handleToggleLinkLabels = (visible: boolean) => {
  if (cesiumEntities.value) {
    cesiumEntities.value.toggleLinkLabels(visible);
  }
};

const handleRefreshLinkLabels = () => {
  if (cesiumEntities.value) {
    cesiumEntities.value.syncLinksToEntities();
  }
};

const handleToggleNodeNames = (visible: boolean) => {
  if (cesiumEntities.value) {
    cesiumEntities.value.toggleNodeNames(visible);
  }
};

// 处理地图点击（用于模板放置）
const handleMapClick = (movement: any) => {
  if (!isWaitingForTemplatePlacement.value || !cesiumViewer.value) {
    return;
  }

  const viewer = cesiumViewer.value;

  // 获取点击位置的笛卡尔坐标
  const cartesian = viewer.camera.pickEllipsoid(
    movement.position,
    viewer.scene.globe.ellipsoid
  );

  if (!cartesian) {
    ElMessage.warning('无法获取点击位置，请点击地球表面');
    return;
  }

  // 将笛卡尔坐标转换为经纬度
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const altitude = cartographic.height;

  // 发射事件，传递位置信息
  eventBus.emit('mapClickedForTemplate', {
    position: {
      lat: latitude,
      lon: longitude,
      alt: altitude
    }
  });
};

// 处理开始监控EMANE MAC信息
const handleStartEmaneMonitor = (data?: any) => {
  // 如果有链路数据，存储它
  if (data && data.link) {
    // 确保传递了所有需要的信息，包括可能的视角NEM ID
    selectedLinkForEmane.value = { ...data.link };
    emaneMacInfoPanelVisible.value = true;
    const viewpointText = data.link.viewpoint_nem_id
      ? ` (视角NEM: ${data.link.viewpoint_nem_id})`
      : "";
    ElMessage.success(`已开启链路的EMANE详细监控${viewpointText}`);
  }
  // 如果有 NEM ID，直接传递给 EMANE 监控面板
  else if (data && data.nemId) {
    // 创建一个临时的链路对象，只包含必要的 NEM ID 信息
    selectedLinkForEmane.value = {
      nem_id: data.nemId,
      is_node_monitoring: true,
    };
    emaneMacInfoPanelVisible.value = true;
    ElMessage.success(`已开启 NEM ${data.nemId} 的 EMANE 信息监控`);
  }
  // 没有特定参数，打开通用监控
  else {
    selectedLinkForEmane.value = null;
    emaneMacInfoPanelVisible.value = true;
    ElMessage.success("已开启 EMANE MAC 信息监控");
  }
};

// 处理拓扑同步WebSocket消息 (action=11)
const handleTopoSyncMessage = (data: any) => {
  try {
    // 验证消息格式
    if (!data.sessionId) {
      console.warn("拓扑同步消息缺少sessionId");
      return;
    }

    // 检查是否是当前会话的消息
    if (topoStore.topoData && data.sessionId !== topoStore.topoData.id) {
      return;
    }

    // 检查senderId，只有当senderId与当前用户ID不同时才同步
    // 但如果是跨页面同步消息（CROSS_PAGE_SYNC），则允许同一用户的不同页面同步
    if (data.senderId && data.extand !== "CROSS_PAGE_SYNC") {
      const userInfo = getUserInfo();
      const currentUserId = userInfo.id;

      if (data.senderId === currentUserId) {
        return;
      }
    }

    // 触发拓扑数据同步
    syncTopoData();

    // 检查是否是GETNEMID扩展消息，如果是则需要获取NEM ID数据
    if (data.extand === "GETNEMID") {
      handleGetNemIdMessage(data);
    }

  } catch (error) {
    console.error("处理拓扑同步WebSocket消息出错:", error);
  }
};

// localStorage事件处理器（跨页面通信）
const handleStorageChange = (event: StorageEvent) => {
  if (event.key === 'topoSyncEvent' && event.newValue) {
    try {
      const syncEvent = JSON.parse(event.newValue);

      if (syncEvent.type === 'TOPO_SYNC' &&
          syncEvent.sessionId === topoStore.currentSessionId &&
          syncEvent.source !== 'cesium') {
        syncTopoData();
      }
    } catch (error) {
      console.error('处理localStorage同步事件出错:', error);
    }
  }
};

// 发送跨页面同步消息（Cesium页面版本）
const sendCrossPageSyncMessage = () => {
  if (!topoStore.currentSessionId) return;

  const userInfo = getUserInfo();
  const syncMessage = {
    action: 11, // 拓扑同步消息
    sessionId: topoStore.currentSessionId,
    senderId: userInfo.id,
    extand: "CROSS_PAGE_SYNC", // 标识这是跨页面同步消息
    source: "cesium" // 标识消息来源
  };

  // 方案1: 通过WebSocket发送消息
  if (websocketService.connected) {
    websocketService.send(syncMessage);
  }

  // 方案2: 通过localStorage事件实现跨页面通信（备用方案）
  const storageEvent = {
    type: 'TOPO_SYNC',
    sessionId: topoStore.currentSessionId,
    timestamp: Date.now(),
    source: 'cesium'
  };
  localStorage.setItem('topoSyncEvent', JSON.stringify(storageEvent));
};

// 处理GETNEMID扩展消息
const handleGetNemIdMessage = async (data: any) => {
  try {
    // 检查senderId，只有当senderId与当前用户ID不同时才获取NEM ID
    if (data.senderId) {
      const userInfo = getUserInfo();
      const currentUserId = userInfo.id;

      if (data.senderId === currentUserId) {
        return;
      }
    }

    // 获取NEM ID数据
    if (topoStore.topoData && topoStore.topoData.id) {
      try {
        // 动态导入getNemIds API
        const { getNemIds } = await import("../../../api/node/index");
        const nemIdResponse = await getNemIds(topoStore.topoData.id) as unknown as ApiResponse;

        if (nemIdResponse.code === 200) {
          // 异步导入NEM ID Store并更新数据
          const { useNemIdStore } = await import("../../../store/modules/nemId");
          const nemIdStore = useNemIdStore();
          nemIdStore.setNemIds(nemIdResponse.data.sessionId, nemIdResponse.data.nemIds);

        } else {
          console.error("GETNEMID: 获取NEM ID数据失败:", nemIdResponse);
        }
      } catch (error) {
        console.error("GETNEMID: 调用getNemIds API失败:", error);
      }
    }
  } catch (error) {
    console.error("处理GETNEMID扩展消息出错:", error);
  }
};

// 处理EMANE WebSocket消息
const handleEmaneWebSocketMessage = (data: any) => {
  try {
    // 异步导入EMANE仓库，减少初始加载负担
    import("../../../store/modules/emane")
      .then(({ useEmaneStore }) => {
        const emaneStore = useEmaneStore();
        // 直接将整个数据对象传递给store进行处理
        emaneStore.updateFromWebSocket(data);
      })
      .catch((error) => {
        console.error("加载EMANE仓库失败:", error);
      });
  } catch (error) {
    console.error("处理EMANE WebSocket消息出错:", error);
  }
};

// 处理action=10的WebSocket消息数据渲染
const handleAction10Message = (data: any) => {
  try {
    // 检查是否有EMANE数据需要渲染
    if (data.emaneInfo) {
      handleEmaneWebSocketMessage(data);
      console.log(data)
    }

    // 检查是否有NEM ID数据需要渲染
    if (data.nemIds && Array.isArray(data.nemIds)) {
      handleNemIdWebSocketMessage(data);
    }
  } catch (error) {
    console.error("处理action=10消息数据渲染出错:", error);
  }
};

// 处理action=7的WebSocket消息数据渲染
const handleAction7Message = (data: any) => {
  try {
    console.log("收到action=7的WebSocket消息:", data);

    // 若包含 EMANE 数据，交给 EMANE 处理器
    if (data.emaneInfo) {
      handleEmaneWebSocketMessage(data);
      console.log(data)
    }

    // 检查是否有NEM ID数据需要渲染
    if (data.nemIds && Array.isArray(data.nemIds)) {
      handleNemIdWebSocketMessage(data);
    }

    // 被动测量数据通常包含 container/cpu/mem/iface 等字段
    if (data.action === 7 || data.controlType !== undefined || data.iface) {
      // @ts-ignore
      eventBus.emit('passive:measurement', data);
    }
  } catch (error) {
    console.error("处理action=7消息数据渲染出错:", error);
  }
};

// WebSocket消息处理现在由全局服务管理，具体的消息处理函数在下面定义

// 创建WebSocket连接 - 现在使用全局服务
const createWebSocketConnection = () => {
  websocketService.connect('cesium-viewer');
};

// WebSocket相关功能现在由全局服务管理
// 为了保持兼容性，保留这些函数作为代理
const startHeartbeat = () => websocketService.startHeartbeat();
const stopHeartbeat = () => websocketService.stopHeartbeat();
const startNodesUpdate = () => websocketService.startNodesUpdate();
const stopNodesUpdate = () => websocketService.stopNodesUpdate();
const startTopoSync = () => websocketService.startTopoSync();
const stopTopoSync = () => websocketService.stopTopoSync();

// 检测节点位置是否有变化
const detectNodePositionChanges = (currentNodes: any[], newNodes: any[]) => {
  const positionChanges = [];

  // 创建节点ID到节点的映射，便于快速查找
  const currentNodeMap = new Map();
  const newNodeMap = new Map();

  currentNodes.forEach(node => currentNodeMap.set(node.id, node));
  newNodes.forEach(node => newNodeMap.set(node.id, node));

  // 检查每个节点的位置变化
  for (const [nodeId, currentNode] of currentNodeMap) {
    const newNode = newNodeMap.get(nodeId);
    if (newNode && currentNode.geo && newNode.geo) {
      const currentPos = currentNode.geo;
      const newPos = newNode.geo;

      // 检查位置是否有显著变化（精度到小数点后6位，约1米精度）
      const latChanged = Math.abs(currentPos.lat - newPos.lat) > 0.000001;
      const lonChanged = Math.abs(currentPos.lon - newPos.lon) > 0.000001;
      const altChanged = Math.abs(currentPos.alt - newPos.alt) > 0.1; // 高度精度到0.1米

      if (latChanged || lonChanged || altChanged) {
        positionChanges.push({
          nodeId,
          nodeName: currentNode.name || `节点${nodeId}`,
          oldPos: { ...currentPos },
          newPos: { ...newPos }
        });
      }
    }
  }

  return positionChanges;
};

// 检测场景状态是否有变化
const detectSceneStateChanges = (currentTopo: any, newTopo: any) => {
  const stateChanges = [];

  // 检查场景状态变化
  if (currentTopo.state !== newTopo.state) {
    stateChanges.push({
      type: 'state',
      field: '场景状态',
      oldValue: currentTopo.state,
      newValue: newTopo.state
    });
  }

  // 检查场景名称变化
  if (currentTopo.name !== newTopo.name) {
    stateChanges.push({
      type: 'name',
      field: '场景名称',
      oldValue: currentTopo.name || '未命名',
      newValue: newTopo.name || '未命名'
    });
  }

  // 检查用户变化
  if (currentTopo.user !== newTopo.user) {
    stateChanges.push({
      type: 'user',
      field: '场景用户',
      oldValue: currentTopo.user,
      newValue: newTopo.user
    });
  }

  // 检查场景位置信息变化
  if (currentTopo.location && newTopo.location) {
    const currentLoc = currentTopo.location;
    const newLoc = newTopo.location;

    // 检查位置坐标变化
    const locChanged =
      Math.abs(currentLoc.lat - newLoc.lat) > 0.000001 ||
      Math.abs(currentLoc.lon - newLoc.lon) > 0.000001 ||
      Math.abs(currentLoc.alt - newLoc.alt) > 0.1 ||
      Math.abs(currentLoc.scale - newLoc.scale) > 0.01;

    if (locChanged) {
      stateChanges.push({
        type: 'location',
        field: '场景位置',
        oldValue: `[${currentLoc.lat.toFixed(6)}, ${currentLoc.lon.toFixed(6)}, ${currentLoc.alt.toFixed(1)}, scale:${currentLoc.scale}]`,
        newValue: `[${newLoc.lat.toFixed(6)}, ${newLoc.lon.toFixed(6)}, ${newLoc.alt.toFixed(1)}, scale:${newLoc.scale}]`
      });
    }
  }

  // 检查元数据变化
  const currentMetadata = JSON.stringify(currentTopo.metadata || {});
  const newMetadata = JSON.stringify(newTopo.metadata || {});
  if (currentMetadata !== newMetadata) {
    stateChanges.push({
      type: 'metadata',
      field: '场景元数据',
      oldValue: currentMetadata,
      newValue: newMetadata
    });
  }

  // 检查配置选项变化
  const currentOptions = JSON.stringify(currentTopo.options || {});
  const newOptions = JSON.stringify(newTopo.options || {});
  if (currentOptions !== newOptions) {
    stateChanges.push({
      type: 'options',
      field: '场景配置',
      oldValue: currentOptions,
      newValue: newOptions
    });
  }

  return stateChanges;
};

// 同步拓扑数据
const syncTopoData = async () => {
  if (!topoStore.topoData || !topoStore.topoData.id) {
    return;
  }

  try {
    const sessionId = topoStore.topoData.id;
    const result = await getTopoBySession(sessionId);

    if (result && result.data) {
      // 检查数据是否有变化
      const currentNodeCount = topoStore.topoData.nodes?.length || 0;
      const currentLinkCount = topoStore.topoData.links?.length || 0;
      const newNodeCount = result.data.nodes?.length || 0;
      const newLinkCount = result.data.links?.length || 0;

      // 检测节点位置变化
      const positionChanges = detectNodePositionChanges(
        topoStore.topoData.nodes || [],
        result.data.nodes || []
      );

      // 检测场景状态变化
      const sceneStateChanges = detectSceneStateChanges(
        topoStore.topoData,
        result.data
      );

      // 更详细的变化检测
      let hasChanges = false;
      let changeDetails = [];

      if (currentNodeCount !== newNodeCount) {
        hasChanges = true;
        changeDetails.push(`节点数量: ${currentNodeCount} -> ${newNodeCount}`);
      }

      if (currentLinkCount !== newLinkCount) {
        hasChanges = true;
        changeDetails.push(`链路数量: ${currentLinkCount} -> ${newLinkCount}`);
      }

      if (positionChanges.length > 0) {
        hasChanges = true;
        changeDetails.push(`节点位置变化: ${positionChanges.length}个节点`);
      }

      if (sceneStateChanges.length > 0) {
        hasChanges = true;
        changeDetails.push(`场景状态变化: ${sceneStateChanges.length}项`);

        // 检查场景状态变化
        sceneStateChanges.forEach(change => {
          // 检查是否是仿真停止状态变化，如果是则清理数据缓存
          if (change.type === 'state' && change.newValue === 'SHUTDOWN') {
            // 清理NEM ID数据
            import("../../../store/modules/nemId")
              .then(({ useNemIdStore }) => {
                const nemIdStore = useNemIdStore();
                nemIdStore.resetNemIds();
              })
              .catch((error) => {
                console.error("加载NEM ID仓库失败:", error);
              });

            // 清理EMANE数据
            import("../../../store/modules/emane")
              .then(({ useEmaneStore }) => {
                const emaneStore = useEmaneStore();
                emaneStore.clearEmaneData();
              })
              .catch((error) => {
                console.error("加载EMANE仓库失败:", error);
              });

            // 触发停止仿真事件，确保其他组件也能响应
            eventBus.emit("stopSimulation");
          }
        });
      }

      // 如果有变化，进行更新
      if (hasChanges) {
        // 更新拓扑数据
        (topoStore as any).setTopoData(sessionId, result.data);

        // 延迟同步实体到Cesium，确保数据更新完成
        await nextTick();

        if (cesiumEntities.value) {
          try {
            // 如果有位置变化，需要强制更新节点位置
            if (positionChanges.length > 0) {
              cesiumEntities.value.syncNodesToEntities(true); // 传入true强制更新位置
            } else {
              // 只有数量变化时的常规同步
              cesiumEntities.value.syncNodesToEntities();
            }

            cesiumEntities.value.syncLinksToEntities();
          } catch (syncError) {
            console.error("同步实体到Cesium失败:", syncError);
          }
        }

        // 显示更新提示
        let message = "检测到节点变更";
        const messageDetails = [];

        if (positionChanges.length > 0) {
          messageDetails.push(`${positionChanges.length}个节点位置已更新`);
        }

        if (sceneStateChanges.length > 0) {
          // 根据变化类型生成具体的提示信息
          const stateChangeTypes = sceneStateChanges.map(change => {
            switch (change.type) {
              case 'state':
                return `场景状态: ${change.newValue}`;
              case 'name':
                return `场景名称: ${change.newValue}`;
              case 'user':
                return `场景用户: ${change.newValue}`;
              case 'location':
                return '场景位置已更新';
              case 'metadata':
                return '场景元数据已更新';
              case 'options':
                return '场景配置已更新';
              default:
                return '场景信息已更新';
            }
          });
          messageDetails.push(...stateChangeTypes);
        }

        if (messageDetails.length > 0) {
          message += `：${messageDetails.join('，')}`;
        }

        // 触发拓扑数据更新事件，通知其他组件
        eventBus.emit('topoDataUpdated');
      }

      // 当场景处于运行状态时，自动检查并获取缺失的NEM ID数据
      // 解决新用户打开已运行场景时因无NEM ID导致EMANE数据无法匹配的问题
      const currentState = result.data.state || topoStore.topoData?.state;
      if (currentState === 'RUNTIME' || currentState === 'RUNNING') {
        try {
          const { useNemIdStore } = await import("../../../store/modules/nemId");
          const nemIdStore = useNemIdStore();
          
          if (!nemIdStore.hasNemIds) {
            // 检查是否存在EMANE类型子网节点
            const nodes = result.data.nodes || [];
            const hasEmane = nodes.some((node: any) => node.type === 'EMANE');
            
            if (hasEmane) {
              const { getNemIds } = await import("../../../api/node/index");
              const nemIdResponse = await getNemIds(sessionId) as unknown as ApiResponse;
              
              if (nemIdResponse.code === 200 && nemIdResponse.data?.nemIds) {
                nemIdStore.setNemIds(nemIdResponse.data.sessionId, nemIdResponse.data.nemIds);
                console.log("[syncTopoData] 自动获取NEM ID成功，共", nemIdResponse.data.nemIds.length, "条");
              } else {
                console.warn("[syncTopoData] 自动获取NEM ID失败:", nemIdResponse.msg || "未知错误");
              }
            }
          }
        } catch (nemIdError) {
          console.warn("[syncTopoData] 自动获取NEM ID时出错:", nemIdError);
        }
      }
    }
  } catch (error) {
    console.error("同步拓扑数据失败:", error);
    // 如果是网络错误或服务器错误，可以考虑暂时停止同步
    if (error instanceof Error && (error.message.includes('Network') || error.message.includes('timeout'))) {
      console.warn("网络错误，暂时停止拓扑同步");
      stopTopoSync();
      // 5分钟后重新尝试启动同步
      setTimeout(() => {
        if (topoStore.topoData && topoStore.topoData.id) {
          console.log("重新尝试启动拓扑同步");
          startTopoSync();
        }
      }, 300000); // 5分钟
    }
  }
};

// 发送节点位置更新
const sendNodesPositionUpdate = () => {
  // 检查仿真是否正在运行 - 使用topo store状态而不是WebSocket状态
  if (!topoStore.topoData || (topoStore.topoData.state !== 'RUNTIME' && topoStore.topoData.state !== 'RUNNING')) {
    return;
  }

  if (!topoStore.topoData || !topoStore.topoData.nodes || !topoStore.topoData.id) {
    console.warn("没有可用的拓扑数据或节点");
    return;
  }

  // 获取当前用户ID
  const userInfo = getUserInfo();
  const currentUserId = userInfo.id;

  const nodePositions = topoStore.topoData.nodes.map((node: any) => ({
    nodeId: node.id,
    geo: {
      lat: node.geo.lat,
      lon: node.geo.lon,
      alt: node.geo.alt,
    },
  }));

  const positionData = {
    action: 5,
    extand: null,
    senderId: currentUserId, // 使用当前用户ID而不是固定的SENDER_ID
    sessionId: topoStore.topoData.id,
    nodes: nodePositions,
  };

  // 使用全局WebSocket服务发送消息
  websocketService.send(positionData);
};

// 关闭WebSocket连接 - 现在使用全局服务
const closeWebSocketConnection = () => {
  websocketService.disconnect('cesium-viewer');
};

const FLIGHT_MANAGER_SYNC_GUARD_MS = 800;

// 将启动仿真的函数导出，供事件总线调用
const startSimulation = () => {
  // 设置仿真状态为运行
  isSimulationRunning.value = true;

  // 隐藏子网节点和子网连接线，仅显示节点间拓扑
  if (cesiumEntities.value) {
    cesiumEntities.value.setSubnetVisibility(false);
  }

  const sessionId = topoStore.topoData?.id ?? topoStore.currentSessionId ?? "未知";
  const nodeCount = topoStore.topoData?.nodes?.length || 0;
  const linkCount = topoStore.topoData?.links?.length || 0;

  // 通知TMV流量模型Store仿真已开始
  import("../../../store/modules/tmvTraffic")
    .then(({ useTMVTrafficStore }) => {
      const tmvTrafficStore = useTMVTrafficStore();
      tmvTrafficStore.setSimulationRunning(true);
    })
    .catch((error) => {
      console.error("加载TMV流量模型Store失败:", error);
    });

  // 记录日志
  systemLogStore.addLog({
    type: "important",
    module: "simulation",
    action: "启动仿真",
    information: "仿真启动",
    details: `启动仿真会话，ID: ${sessionId}, 节点数量: ${nodeCount}, 链路数量: ${linkCount}`,
  });

  // 在启动位置更新定时器前，确保已设置位置是最新的
  // 1. 查找所有具有自定义路径的实体，确保它们的位置被保存到topoStore
  if (cesiumViewer.value) {
    const entities = cesiumViewer.value.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityAny = entity as any;

      // 检查这个实体是否是无人机并且已经移动过（有自定义路径但不在移动状态）
      if (entityAny._hasCustomPath && entityAny._pathData && !entityAny._isFlying) {
        // 获取当前位置并更新到topoStore
        try {
          const position = entity.position?.getValue(
            cesiumViewer.value.clock.currentTime
          );
          if (position && entity.id && /^\d+$/.test(entity.id)) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const currentPosition = {
              longitude: Cesium.Math.toDegrees(cartographic.longitude),
              latitude: Cesium.Math.toDegrees(cartographic.latitude),
              height: cartographic.height,
            };

            // 更新到topoStore
            updateNodePositionInStore(entity.id, currentPosition);
          }
        } catch (e) {
          // 忽略位置获取错误
        }
      }
    }
  }

  // 模拟接收 NEM ID 数据的过程（实际应该从 WebSocket 收到）
  // 这里只是为了演示，实际应该从后端接收
  setTimeout(updateNemIdMapping, 2000);
};

// 更新 NEM ID 映射关系
const updateNemIdMapping = () => {
  try {
    // 异步导入 NEM ID Store
    import("../../../store/modules/nemId")
      .then(({ useNemIdStore }) => {
        const nemIdStore = useNemIdStore();

      })
      .catch((error) => {
        console.error("加载 NEM ID 仓库失败:", error);
      });
  } catch (error) {
    console.error("更新 NEM ID 映射时出错:", error);
  }
};

// 处理 WebSocket 消息中的 NEM ID 数据更新
const handleNemIdWebSocketMessage = (data: any) => {
  if (!data || !data.nemIds || !Array.isArray(data.nemIds)) return;

  try {
    // 异步导入 NEM ID Store
    import("../../../store/modules/nemId")
      .then(({ useNemIdStore }) => {
        const nemIdStore = useNemIdStore();

        // 更新 NEM ID 数据
        nemIdStore.setNemIds(data.sessionId || topoStore.topoData.id, data.nemIds);
      })
      .catch((error) => {
        console.error("加载 NEM ID 仓库失败:", error);
      });
  } catch (error) {
    console.error("处理 NEM ID WebSocket 消息时出错:", error);
  }
};

// 组件挂载时初始化Cesium
onMounted(async () => {
  // 清除EMANE数据，确保每次组件加载时都是空状态
  import("../../../store/modules/emane")
    .then(({ useEmaneStore }) => {
      const emaneStore = useEmaneStore();
      // 使用已定义的action来清除数据
      emaneStore.clearEmaneData();
    })
    .catch((error) => {
      console.error("加载EMANE仓库失败:", error);
    });

  // 监听视图模式切换事件
  eventBus.on("switchViewMode", switchViewMode);

  // 监听飞回初始视角事件
  eventBus.on("flyToHome", flyToHomeHandler);

  // 监听搜索位置事件
  eventBus.on("searchLocation", searchLocationHandler);

  // 监听放大、缩小和刷新事件
  eventBus.on("zoomIn", handleZoomIn);
  eventBus.on("zoomOut", handleZoomOut);
  eventBus.on("refreshScene", handleRefreshScene);
  
  // 监听仿真开始和停止事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("startSimulation", startSimulation);
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("stopSimulation", stopSimulation);

  // 监听EMANE监控事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("startEmaneMonitor", handleStartEmaneMonitor);

  // 监听路径绘制事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("startPathDrawing", handleStartPathDrawing);

  // 监听无人机控制面板事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("openDroneControlPanel", handleOpenDroneControlPanel);

  // 监听无人机控制位置更新事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("triggerPositionUpdate", sendNodesPositionUpdate);
  
  // 监听无人机开始/停止移动事件，控制位置更新定时器
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("startFlightPositionUpdates", startNodesUpdate);

  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("stopFlightPositionUpdates", stopNodesUpdate);

  // 监听渲染性能设置事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("setRenderPerformance", handleRenderPerformance);

  // 监听显示所有特殊效果事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("showAllSpecialEffects", handleShowAllSpecialEffects);
  
  // 监听恢复快照事件，用于更新地图数据
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("updateTopoData", handleTopoDataUpdate);
  eventBus.on("topoDataUpdated", handleTopoDataUpdated);
  eventBus.on("exitCurrentScene", handleExitCurrentScene);

  // 确保topoData存在
  ensureTopoDataExists();

  // 设置Cesium Ion令牌
  Cesium.Ion.defaultAccessToken = CESIUM_CONFIG.ION_TOKEN;

  try {
    if (!cesiumContainer.value) {
      throw new Error("Cesium容器DOM元素不存在");
    }

    // 初始化Cesium Viewer
    cesiumViewer.value = await initCesiumViewer(cesiumContainer.value as HTMLElement);

    // 配置Cesium场景
    setupCesiumScene(cesiumViewer.value);

    const now = new Date();
    const nyTime = new Date(now.getTime());
    nyTime.setUTCHours(3, 0, 0, 0);
    cesiumViewer.value.clock.currentTime = Cesium.JulianDate.fromDate(nyTime);
    cesiumViewer.value.clock.shouldAnimate = false; // 停止时间动画

    // 初始化实体管理
    cesiumEntities.value = useCesiumEntities(cesiumViewer.value);

    // 等待Cesium完全加载后同步已有节点和链路 - 添加双重检查
    if (cesiumViewer.value && cesiumEntities.value) {
      window.requestAnimationFrame(() => {
        if (cesiumViewer.value && cesiumEntities.value) {
          syncExistingNodes();
          syncExistingLinks();
        }
      });
    }

    // 设置拓扑存储获取器
    websocketService.setTopoStoreGetter(() => topoStore);

    // 初始化WebSocket连接
    createWebSocketConnection();

    // 注册WebSocket消息处理器
    websocketService.onMessage('action_10', handleAction10Message);
    websocketService.onMessage('action_11', handleTopoSyncMessage);
    websocketService.onMessage('action_7', handleAction7Message);
    websocketService.onMessage('emane', handleEmaneWebSocketMessage);
    websocketService.onMessage('nemIds', handleNemIdWebSocketMessage);

    // 注册WebSocket服务需要的事件监听器
    // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
    eventBus.on('websocket:sendNodesPositionUpdate', sendNodesPositionUpdate);
    // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
    eventBus.on('websocket:syncTopoData', syncTopoData);

  } catch (error) {
    console.error("初始化Cesium出错:", error);
    ElMessage.error("加载3D地球失败，请刷新页面重试");
  }

  // 添加localStorage事件监听器（跨页面通信）
  window.addEventListener('storage', handleStorageChange);

  // 监听添加服务器事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("openServerConfigDialog", handleOpenServerConfigDialog);

  // 监听MATLAB结果显示事件
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.on("openMatlabResults", handleOpenMatlabResults);

  // 启动拓扑同步（仅在有拓扑数据时启动）
  if (topoStore.topoData && topoStore.topoData.id) {
    startTopoSync();
  }

  // 监听拓扑数据变化，重新启动同步
  watch(
    () => topoStore.topoData?.id,
    (newSessionId, oldSessionId) => {
      if (newSessionId && newSessionId !== oldSessionId) {
        stopTopoSync();
        startTopoSync();
      } else if (!newSessionId) {
        stopTopoSync();
      }
    }
  );

  // 记录日志 - 加载地图
  systemLogStore.addLog({
    type: "normal",
    information: "系统信息",
    module: "map",
    action: "初始化地图",
    details: "初始化3D地球和Cesium可视化组件",
  });

  // 监听渲染模式切换事件
  eventBus.on("toggleRenderingMode", handleToggleRenderingMode);

  // 监听链路标签切换事件
  eventBus.on("toggleLinkLabels", handleToggleLinkLabels);

  // 监听链路标签刷新事件
  eventBus.on("refreshLinkLabels", handleRefreshLinkLabels);

  // 监听链路刷新事件（无线参数修改后）
  eventBus.on("refreshLinks", () => {
    if (cesiumEntities.value) {
      cesiumEntities.value.syncLinksToEntities();
    }
  });

  // 监听节点名称切换事件
  eventBus.on("toggleNodeNames", handleToggleNodeNames);

  // 监听模板放置相关事件
  eventBus.on("startTemplatePlacement", handleStartTemplatePlacement);
  eventBus.on("endTemplatePlacement", handleEndTemplatePlacement);

  // 初始化useCesiumEntities后，同步初始渲染模式状态
  nextTick(() => {
    if (cesiumEntities.value) {
      const currentMode = cesiumEntities.value.getRenderingMode();
      eventBus.emit("renderingModeChanged", currentMode.value);
    }
  });

  // 添加终端拖拽事件监听器
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDragging);
});

// 组件卸载前清理资源
onBeforeUnmount(() => {
  // 移除事件监听
  eventBus.off("sidebar:item-selected", handleSidebarItemSelected);
  eventBus.off("sidebar:distributed-link-config", handleSidebarDistributedLinkConfig);
  eventBus.off("switchViewMode", switchViewMode);
  eventBus.off("flyToHome", flyToHomeHandler);
  eventBus.off("searchLocation", searchLocationHandler);
  eventBus.off("zoomIn", handleZoomIn);
  eventBus.off("zoomOut", handleZoomOut);
  eventBus.off("refreshScene", handleRefreshScene);

  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("startSimulation", startSimulation);
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("stopSimulation", stopSimulation);

  // 移除EMANE监控事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("startEmaneMonitor", handleStartEmaneMonitor);

  // 移除路径绘制事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("startPathDrawing", handleStartPathDrawing);

  // 移除无人机控制面板事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("openDroneControlPanel", handleOpenDroneControlPanel);

  // 移除渲染性能设置事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("setRenderPerformance", handleRenderPerformance);

  // 移除无人机控制位置更新事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("triggerPositionUpdate", sendNodesPositionUpdate);

  // 移除无人机移动状态事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("startFlightPositionUpdates", startNodesUpdate);

  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("stopFlightPositionUpdates", stopNodesUpdate);

  // 移除显示所有特殊效果事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("showAllSpecialEffects", handleShowAllSpecialEffects);
  
  // 移除快照数据更新事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("updateTopoData", handleTopoDataUpdate);
  eventBus.off("topoDataUpdated", handleTopoDataUpdated);
  eventBus.off("exitCurrentScene", handleExitCurrentScene);

  // 移除添加服务器配置对话框事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("openServerConfigDialog", handleOpenServerConfigDialog);

  // 移除MATLAB结果显示事件监听
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off("openMatlabResults", handleOpenMatlabResults);

  // 确保资源被正确释放
  if (cesiumViewer.value) {
    // 移除事件监听
    try {
      cesiumViewer.value.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );
    } catch (e) {
      console.error("移除点击事件监听时出错:", e);
    }

    // 清理OSM建筑资源
    if (osmBuildings.value && cesiumViewer.value) {
      try {
        cesiumViewer.value.scene.primitives.remove(osmBuildings.value);
        osmBuildings.value = null;
      } catch (e) {
        console.error("清理OSM建筑资源时出错:", e);
      }
    }

    try {
      // 销毁Viewer实例
      cesiumViewer.value.destroy();
    } catch (e) {
      console.error("销毁Cesium Viewer时出错:", e);
    }

    // 重置引用
    cesiumViewer.value = null;
    cesiumEntities.value = null;
  }

  // 停止拓扑同步
  stopTopoSync();

  // 关闭WebSocket连接
  closeWebSocketConnection();

  // 移除WebSocket消息处理器
  websocketService.offMessage('action_10', handleAction10Message);
  websocketService.offMessage('action_11', handleTopoSyncMessage);
  websocketService.offMessage('action_7', handleAction7Message);
  websocketService.offMessage('emane', handleEmaneWebSocketMessage);
  websocketService.offMessage('nemIds', handleNemIdWebSocketMessage);

  // 移除WebSocket服务事件监听器
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off('websocket:sendNodesPositionUpdate', sendNodesPositionUpdate);
  // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
  eventBus.off('websocket:syncTopoData', syncTopoData);

  // 移除渲染模式切换事件监听
  eventBus.off("toggleRenderingMode", handleToggleRenderingMode);

  // 移除链路标签刷新事件监听
  eventBus.off("toggleLinkLabels", handleToggleLinkLabels);
  eventBus.off("refreshLinkLabels", handleRefreshLinkLabels);
  eventBus.off("toggleNodeNames", handleToggleNodeNames);
  eventBus.off("startTemplatePlacement", handleStartTemplatePlacement);
  eventBus.off("endTemplatePlacement", handleEndTemplatePlacement);

  // 移除localStorage事件监听器
  window.removeEventListener('storage', handleStorageChange);

  // 移除终端拖拽事件监听器
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDragging);
});

// 处理开始绘制路径
const handleStartPathDrawing = () => {
  dronePathPanelVisible.value = true;
  ElMessage.success("已开启路径绘制面板");
};

const syncTopoStoreToCesium = (clearFirst = false) => {
  if (!cesiumViewer.value || !cesiumEntities.value) return;

  const topo = topoStore.topoData;

  if (clearFirst || !topo?.nodes?.length) {
    cesiumEntities.value.clearAllEntities();
  }

  if (topo?.nodes?.length) {
    cesiumEntities.value.syncNodesToEntities(true);
  }

  if (topo) {
    cesiumEntities.value.syncLinksToEntities();
  }

  cesiumViewer.value.scene?.requestRender();
};

const handleTopoDataUpdated = () => {
  syncTopoStoreToCesium(false);
};

const handleExitCurrentScene = () => {
  stopTopoSync();
  stopNodesUpdate();
  syncTopoStoreToCesium(true);

  selectedItem.value = null;
  selectedNode.value = null;
  selectedLink.value = null;
  selectedLinkForEmane.value = null;
  selectedInterferenceNode.value = null;
  sourceNode.value = null;
  targetNode.value = null;
  contextMenuNode.value = null;
  contextMenuPosition.value = null;

  configDialogVisible.value = false;
  showInterferenceConfigDialog.value = false;
  linkDialogVisible.value = false;
  distributedLinkDialogVisible.value = false;
  nodeInfoPanelVisible.value = false;
  nodeInfoPanelShowUI.value = true;
  linkInfoPanelVisible.value = false;
  emaneMacInfoPanelVisible.value = false;
  dronePathPanelVisible.value = false;
  droneControlPanelVisible.value = false;
  subnetConfigDialogVisible.value = false;
  interferenceNodeInfoPanelVisible.value = false;
  contextMenuVisible.value = false;
  serverConfigDialogVisible.value = false;
  matlabResultPanelVisible.value = false;

  topoStore.setSelectedNode(null);
  topoStore.setSelectedLink(null);
  topoStore.setOperationMode("select");

  terminals.value.clear();
  terminalRefs.value.clear();
  activeTerminalId.value = null;
  vncWindows.value.clear();
  activeVncId.value = null;
  flyingDrones.value = [];
};

// 处理恢复快照后的拓扑数据更新
const handleTopoDataUpdate = (topoData: any) => {
  if (cesiumViewer.value && cesiumEntities.value) {
    // 清除现有实体
    cesiumEntities.value.clearAllEntities();
    
    // 更新topoStore中的数据
    if (topoData) {
      // 同步节点和链路
      cesiumEntities.value.syncNodesToEntities();
      cesiumEntities.value.syncLinksToEntities();
      
      // 记录日志
      systemLogStore.addLog({
        type: "normal",
        information: "场景恢复",
        module: "map",
        action: "恢复快照",
        details: `已从快照恢复场景，共 ${topoData.nodes?.length || 0} 个节点和 ${topoData.links?.length || 0} 条链路`,
      });
      
      ElMessage.success('已成功恢复场景快照');
    }
  } else {
    ElMessage.error('更新地图失败：Cesium视图未初始化');
  }
};

// 更新节点在topoStore中的位置
const updateNodePositionInStore = (
  nodeId: string,
  position: { longitude: number; latitude: number; height: number }
) => {
  // 确保拓扑数据存在
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    console.warn("无法更新节点位置：拓扑数据不存在");
    return;
  }

  // 节点ID是字符串，需要转换为数字
  const nodeIdNumber = parseInt(nodeId, 10);
  if (isNaN(nodeIdNumber)) {
    console.warn(`无法更新节点位置：无效的节点ID "${nodeId}"`);
    return;
  }

  // 查找节点
  const node = topoStore.topoData.nodes.find((n: any) => n.id === nodeIdNumber);
  if (!node) {
    console.warn(`找不到ID为${nodeIdNumber}的节点`);
    return;
  }

  // 更新节点位置 - 使用直接赋值而不是替换整个对象，减少响应式系统的重新渲染
  const roundDecimals = (num: number, decimals = 6) => Number(num.toFixed(decimals));

  // 检查位置是否发生了实质性变化，如果基本相同，则不更新
  const currentLat = roundDecimals(node.geo.lat);
  const currentLon = roundDecimals(node.geo.lon);
  const currentAlt = roundDecimals(node.geo.alt);

  const newLat = roundDecimals(position.latitude);
  const newLon = roundDecimals(position.longitude);
  const newAlt = roundDecimals(position.height);

  // 如果位置实际上没有变化，则跳过更新
  if (currentLat === newLat && currentLon === newLon && currentAlt === newAlt) {
    return;
  }

  // 使用直接赋值的方式更新，而不是重新创建对象
  node.geo.lat = newLat;
  node.geo.lon = newLon;
  node.geo.alt = newAlt;
};

// 设置无人机移动管理器
const setupDroneFlightManager = (droneFlightManager: any) => {
  if (!droneFlightManager) {
    console.warn("无人机移动管理器未初始化");
    return;
  }

  // 设置位置更新回调
  droneFlightManager.setPositionUpdateCallback((entityId: string, position: any) => {
    // 标记此更新来自移动管理器，避免其他实体更新逻辑被触发
    const entity = cesiumViewer.value?.entities.getById(entityId);
    const entityAny = entity as any;
    if (entity) {
      entityAny._updatingFromFlightManager = true;

      if (entityAny._flightManagerSyncGuardTimer) {
        clearTimeout(entityAny._flightManagerSyncGuardTimer);
      }
    }

    // 更新topoStore中的节点位置
    updateNodePositionInStore(entityId, position);

    // 延迟清除标记，避免 topoStore 的深度监听立即回写实体位置
    if (entity) {
      entityAny._flightManagerSyncGuardTimer = window.setTimeout(() => {
        if (entityAny._flightManagerSyncGuardTimer) {
          clearTimeout(entityAny._flightManagerSyncGuardTimer);
          delete entityAny._flightManagerSyncGuardTimer;
        }

        entityAny._updatingFromFlightManager = false;
      }, FLIGHT_MANAGER_SYNC_GUARD_MS);
    }
  });

  droneFlightManager.setFlightStatusCallback((activeEntityIds: string[]) => {
    if (activeEntityIds.length > 0) {
      // 存在移动中的无人机，开始发送节点位置更新
      startNodesUpdate();

      // 记录日志
      systemLogStore.addLog({
        type: "normal",
        module: "drone",
        action: "位置更新开始",
        information: "位置更新启动",
        details: `开始发送无人机位置更新，活动无人机数量: ${activeEntityIds.length}`,
      });
    } else {
      // 没有移动中的无人机，停止定期发送节点位置更新
      stopNodesUpdate();

      // DroneFlightManager.stopFly 通过 setTimeout(100ms/500ms) 延迟提交最终位置到 topoStore
      // 定期WS定时器已被停止，需要在最终位置提交后手动发送一次WS位置更新
      setTimeout(() => {
        sendNodesPositionUpdate();
      }, 700);

      // 记录日志
      systemLogStore.addLog({
        type: "normal",
        module: "drone",
        action: "位置更新停止",
        information: "位置更新停止",
        details: "所有无人机已停止移动，停止位置更新",
      });
    }

    // 在状态回调中添加移动状态变更的日志记录功能
    // 比较上一次活动的无人机列表和当前活动列表，记录变化
    const prevFlying = flyingDrones.value || [];

    // 新开始移动的无人机
    const newlyStarted = activeEntityIds.filter((id: string) => !prevFlying.includes(id));
    // 刚刚停止移动的无人机
    const newlyStopped = prevFlying.filter((id: string) => !activeEntityIds.includes(id));

    // 为新开始移动的无人机记录日志
    newlyStarted.forEach((droneId: string) => {
      const drone = topoStore.topoData?.nodes?.find(
        (n: any) => n.id.toString() === droneId
      );
      const droneName = drone ? drone.alias || drone.name : `无人机${droneId}`;

      systemLogStore.addLog({
        type: "normal",
        module: "drone",
        action: "开始移动",
        information: "无人机移动开始",
        details: `无人机 "${droneName}" 开始移动`,
      });
    });

    // 为刚停止移动的无人机记录日志
    newlyStopped.forEach((droneId: string) => {
      const drone = topoStore.topoData?.nodes?.find(
        (n: any) => n.id.toString() === droneId
      );
      const droneName = drone ? drone.alias || drone.name : `无人机${droneId}`;

      systemLogStore.addLog({
        type: "normal",
        module: "drone",
        action: "结束移动",
        information: "无人机移动结束",
        details: `无人机 "${droneName}" 结束移动`,
      });
    });

    // 更新移动中的无人机列表
    flyingDrones.value = activeEntityIds;
  });
};

// 将停止仿真的函数导出，供事件总线调用
const stopSimulation = () => {
  // 设置仿真状态为停止
  isSimulationRunning.value = false;

  // 恢复子网节点和子网连接线的显示
  if (cesiumEntities.value) {
    cesiumEntities.value.setSubnetVisibility(true);
  }

  const sessionId = topoStore.topoData?.id ?? topoStore.currentSessionId ?? "未知";

  // 通知TMV流量模型Store仿真已停止
  import("../../../store/modules/tmvTraffic")
    .then(({ useTMVTrafficStore }) => {
      const tmvTrafficStore = useTMVTrafficStore();
      tmvTrafficStore.setSimulationRunning(false);
    })
    .catch((error) => {
      console.error("加载TMV流量模型Store失败:", error);
    });

  // 记录日志
  systemLogStore.addLog({
    type: "important",
    module: "simulation",
    action: "停止仿真",
    information: "仿真停止",
    details: `停止仿真会话，ID: ${sessionId}`,
  });

  // 无论是否有无人机在移动，都强制停止节点位置更新
  stopNodesUpdate();

  // 清除EMANE数据，防止updateLinkLabels定时器使用旧数据重新着色
  import("../../../store/modules/emane")
    .then(({ useEmaneStore }) => {
      const emaneStore = useEmaneStore();
      emaneStore.clearEmaneData();
    })
    .catch((error) => {
      console.error("加载EMANE仓库失败:", error);
    });

  // 重置无线链路颜色为初始状态，避免停止场景后残留运行时的SINR颜色
  if (cesiumEntities.value) {
    cesiumEntities.value.resetWirelessLinkColors();
  }
};

// 处理无人机控制面板事件
const handleOpenDroneControlPanel = () => {
  droneControlPanelVisible.value = true;
  ElMessage.success("已开启无人机控制面板");
};

// 修改处理显示/隐藏所有特殊效果的函数，添加状态更新事件
const handleShowAllSpecialEffects = () => {
  if (!cesiumEntities.value) {
    console.warn("无法操作特效：cesiumEntities为null");
    return;
  }

  // 根据当前状态决定是显示还是隐藏特效
  if (allEffectsVisible.value) {
    // 当前是显示状态，需要隐藏特效
    cesiumEntities.value.hideAllSpecialEffects();
    allEffectsVisible.value = false;
    ElMessage.success("已隐藏所有节点特效");
  } else {
    // 当前是隐藏状态，需要显示特效
    cesiumEntities.value.showAllSpecialEffects();
    allEffectsVisible.value = true;
    ElMessage.success("已显示所有节点特效");
  }

  // 发送状态更新事件，通知其他组件
  eventBus.emit("effectsVisibilityChanged", allEffectsVisible.value);
};

// 处理服务器配置保存
const handleServerConfigSave = (config: any) => {
  console.log("保存服务器配置:", config);
  // 仅作展示，不实现实际功能
};

// 处理添加服务器
const handleServerConfigAdd = (config: any) => {
  console.log("添加服务器:", config);
  // 仅作展示，不实现实际功能
};

// 终端相关方法
const terminalRefs = ref<Map<string, HTMLElement>>(new Map());

// 设置终端DOM引用
const setTerminalRef = (terminalId: string, el: any) => {
  if (el) {
    terminalRefs.value.set(terminalId, el);
  } else {
    terminalRefs.value.delete(terminalId);
  }
};

// 生成唯一的终端ID
const generateTerminalId = (nodeId: string) => {
  return `terminal_${nodeId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

// 计算新终端的位置
const calculateTerminalPosition = (index: number) => {
  const baseTop = 100;
  const baseLeft = 150;
  const offset = 30;

  return {
    top: `${baseTop + (index * offset)}px`,
    left: `${baseLeft + (index * offset)}px`
  };
};

// Handle open VNC event from NodeInfoPanel
const handleOpenVnc = (params: { nodeId: number; nodeName: string; wsUrl: string }) => {
  // Check if a VNC window with the same WebSocket URL already exists
  const existingVncEntry = Array.from(vncWindows.value.entries()).find(
    ([_, vnc]) => vnc.wsUrl === params.wsUrl
  );
  
  if (existingVncEntry) {
    const [existingId, existingVnc] = existingVncEntry;
    existingVnc.isMinimized = false;
    activeVncId.value = existingId;
    ElMessage.warning('This VM is already open in another VNC window. Showing existing window.');
    return;
  }
  
  // Generate unique VNC ID with timestamp
  const timestamp = Date.now();
  const vncId = `vnc-${params.nodeId}-${timestamp}`;

  const existingCount = vncWindows.value.size;
  const baseTop = 100;
  const baseLeft = 400;
  const offset = existingCount * 30;

  const newVnc: VncInstance = {
    id: vncId,
    node: { id: params.nodeId, name: params.nodeName, alias: params.nodeName },
    wsUrl: params.wsUrl,
    isMinimized: false,
    position: {
      top: `${baseTop + offset}px`,
      left: `${baseLeft + offset}px`
    },
    size: {
      width: '800px',
      height: '600px'
    },
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    resizeHandle: ''
  };

  vncWindows.value.set(vncId, newVnc);
  activeVncId.value = vncId;
  
  // Warn user if multiple VNC windows might connect to same VM (backend limitation)
  if (vncWindows.value.size > 1) {
    ElMessage.warning({
      message: 'Note: Multiple VNC windows may show the same VM due to backend configuration. If you see duplicates, this is a backend issue with VM instance management.',
      duration: 5000,
      showClose: true
    });
  }
  
  ElMessage.success('VNC window opened');
};

const handleOpenTerminal = async (node: any) => {
  try {
    // 获取当前会话ID
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;

    let response;
    // 根据节点类型调用不同的API接口
    if (node?.type === 'DRONE' || node?.type === 'BASESTATION') {
      // 调用getExecVnode接口
      const { getExecVnode } = await import("../../../api/node");
      response = await getExecVnode({
        sessionId: sessionId,
        nodeName: node?.name || node?.alias
      });
    } else {
      // 调用getExecDocker接口
      const { getExecDocker } = await import("../../../api/node");
      response = await getExecDocker({
        sessionId: sessionId,
        nodeId: node?.id
      });
    }

    if (response && response.data) {
      const terminalId = generateTerminalId(node.id);
      const position = calculateTerminalPosition(terminals.value.size);

      // 计算该节点已有的终端数量，用于显示序号
      const nodeTerminalCount = Array.from(terminals.value.values()).filter(
        terminal => terminal.node.id === node.id
      ).length;

      // 创建新的终端实例
      const newTerminal: TerminalInstance = {
        id: terminalId,
        node: node,
        wsUrl: response.data,
        isMinimized: false,
        position: position,
        size: { width: '600px', height: '400px' },
        isDragging: false,
        isResizing: false,
        dragOffset: { x: 0, y: 0 },
        resizeHandle: '',
        terminalIndex: nodeTerminalCount + 1 // 添加终端序号
      };

      // 添加到终端列表
      terminals.value.set(terminalId, newTerminal);
      activeTerminalId.value = terminalId;

      const terminalLabel = nodeTerminalCount > 0
        ? `${node.alias || node.name} 终端 #${nodeTerminalCount + 1}`
        : `${node.alias || node.name} 终端`;

      ElMessage.success(`已打开 ${terminalLabel}`);
    } else {
      ElMessage.error("获取终端连接失败");
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "获取终端连接失败");
  }
};

// 打开信号级仿真
const handleOpenSignalSim = async (node: any) => {
  try {
    if (!node) {
      ElMessage.warning('请选择有效的节点');
      return;
    }

    // 关闭context menu
    contextMenuVisible.value = false;

    // 设置选中的节点，隐藏面板UI只显示对话框
    selectedNode.value = node;
    nodeInfoPanelShowUI.value = false;
    nodeInfoPanelVisible.value = true;

    // 等待DOM更新
    await nextTick();

    // 延迟一帧，确保NodeInfoPanel已完全加载
    await new Promise(resolve => setTimeout(resolve, 0));

    // 调用NodeInfoPanel中的方法打开信号仿真对话框
    if (nodeInfoPanelRef.value && nodeInfoPanelRef.value.openSignalSimDialog) {
      nodeInfoPanelRef.value.openSignalSimDialog();
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "打开信号仿真失败");
  }
};

// 刷新链路
const handleRefreshLinks = () => {
  if (cesiumEntities.value) {
    cesiumEntities.value.syncLinksToEntities();
  }
};

// 关闭终端
const closeTerminal = (terminalId: string) => {
  const closingTerminal = terminals.value.get(terminalId);
  const nodeId = closingTerminal?.node?.id;

  terminals.value.delete(terminalId);
  terminalRefs.value.delete(terminalId);

  // 如果关闭的是当前活动终端，切换到其他终端
  if (activeTerminalId.value === terminalId) {
    const remainingTerminals = Array.from(terminals.value.keys());
    activeTerminalId.value = remainingTerminals.length > 0 ? remainingTerminals[0] : null;
  }

  // 重新计算同一节点其他终端的序号
  if (nodeId) {
    updateTerminalIndices(nodeId);
  }
};

// 更新指定节点的所有终端序号
const updateTerminalIndices = (nodeId: number) => {
  const nodeTerminals = Array.from(terminals.value.values())
    .filter(terminal => terminal.node.id === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id)); // 按ID排序保持一致性

  nodeTerminals.forEach((terminal, index) => {
    terminal.terminalIndex = index + 1;
  });
};

// 最小化/最大化终端
const minimizeTerminal = (terminalId: string) => {
  const terminal = terminals.value.get(terminalId);
  if (terminal) {
    terminal.isMinimized = !terminal.isMinimized;
  }
};

// 开始拖拽
const startDragging = (event: MouseEvent, terminalId: string) => {
  // 忽略控制按钮的点击
  if ((event.target as HTMLElement).closest('.terminal-control')) {
    return;
  }

  const terminal = terminals.value.get(terminalId);
  const element = terminalRefs.value.get(terminalId);

  if (!terminal || !element) return;

  // 设置当前终端为活动终端
  activeTerminalId.value = terminalId;
  terminal.isDragging = true;

  // 计算鼠标点击位置与元素左上角的相对位置
  const rect = element.getBoundingClientRect();
  terminal.dragOffset = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };

  // 防止选择文本
  event.preventDefault();
};

// 拖拽移动
const onDrag = (event: MouseEvent) => {
  if (!activeTerminalId.value) return;

  const terminal = terminals.value.get(activeTerminalId.value);
  if (!terminal) return;

  // 处理拖拽
  if (terminal.isDragging) {
    // 计算新位置
    const x = event.clientX - terminal.dragOffset.x;
    const y = event.clientY - terminal.dragOffset.y;

    // 确保窗口不会被拖出视口
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const boundedX = Math.max(0, Math.min(x, viewportWidth - parseInt(terminal.size.width)));
    const boundedY = Math.max(0, Math.min(y, viewportHeight - 50));

    terminal.position = {
      top: `${boundedY}px`,
      left: `${boundedX}px`
    };
  }

  // 处理调整大小
  if (terminal.isResizing) {
    onResize(event);
  }
};

// 结束拖拽和调整大小
const stopDragging = () => {
  // 停止所有终端的拖拽和调整大小状态
  terminals.value.forEach(terminal => {
    terminal.isDragging = false;
    terminal.isResizing = false;
    terminal.resizeHandle = '';
  });
};

// 开始调整大小
const startResizing = (event: MouseEvent, terminalId: string, handle: string) => {
  event.preventDefault();
  event.stopPropagation();

  const terminal = terminals.value.get(terminalId);
  if (!terminal) return;

  // 设置当前终端为活动终端
  activeTerminalId.value = terminalId;
  terminal.isResizing = true;
  terminal.resizeHandle = handle;

  // 记录初始鼠标位置
  terminal.dragOffset = {
    x: event.clientX,
    y: event.clientY
  };
};

// 调整大小移动
const onResize = (event: MouseEvent) => {
  if (!activeTerminalId.value) return;

  const terminal = terminals.value.get(activeTerminalId.value);
  if (!terminal || !terminal.isResizing) return;

  const deltaX = event.clientX - terminal.dragOffset.x;
  const deltaY = event.clientY - terminal.dragOffset.y;

  const element = terminalRefs.value.get(activeTerminalId.value);
  if (!element) return;

  const currentWidth = parseInt(terminal.size.width);
  const currentHeight = parseInt(terminal.size.height);

  let newWidth = currentWidth;
  let newHeight = currentHeight;

  // 根据调整手柄类型计算新尺寸
  if (terminal.resizeHandle.includes('e')) {
    newWidth = Math.max(300, currentWidth + deltaX); // 最小宽度300px
  }
  if (terminal.resizeHandle.includes('s')) {
    newHeight = Math.max(200, currentHeight + deltaY); // 最小高度200px
  }

  // 限制最大尺寸
  const maxWidth = window.innerWidth - parseInt(terminal.position.left) - 20;
  const maxHeight = window.innerHeight - parseInt(terminal.position.top) - 20;

  newWidth = Math.min(newWidth, maxWidth);
  newHeight = Math.min(newHeight, maxHeight);

  // 更新终端尺寸
  terminal.size = {
    width: `${newWidth}px`,
    height: `${newHeight}px`
  };

  // 更新鼠标位置记录
  terminal.dragOffset = {
    x: event.clientX,
    y: event.clientY
  };

  // 通知Terminal组件调整大小
  nextTick(() => {
    // 触发Terminal组件的resize事件
    const terminalComponent = element.querySelector('.terminal');
    if (terminalComponent) {
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
    }
  });
};



const getTopoRenderKey = () => {
  const topo = topoStore.topoData;
  if (!topo) return 'empty';

  const nodeKey = (topo.nodes || [])
    .map((node: any) => [
      node.id,
      node.name,
      node.alias,
      node.type,
      node.status,
      node.server,
      node.geo?.lat,
      node.geo?.lon,
      node.geo?.alt,
    ].join(':'))
    .join('|');

  const linkKey = (topo.links || [])
    .map((link: any) => [
      link.node1_id,
      link.node2_id,
      link.type,
      link.network_id,
      link.iface1?.ip4,
      link.iface2?.ip4,
    ].join(':'))
    .join('|');

  return `${topo.id}:${topo.state}:${nodeKey}:${linkKey}`;
};

// 监听完整拓扑签名，切换到节点数量相同的场景时也要重绘 Cesium 实体
watch(
  getTopoRenderKey,
  (newKey, oldKey) => {
    if (!cesiumEntities.value || newKey === oldKey) return;

    const newSessionId = newKey.split(':')[0];
    const oldSessionId = oldKey?.split(':')[0];
    const sessionChanged = Boolean(oldSessionId && newSessionId !== oldSessionId);

    syncTopoStoreToCesium(sessionChanged);
  },
  { flush: 'post' }
);

// VNC window management functions
const setVncRef = (vncId: string, el: any) => {
  if (el && vncWindows.value.has(vncId)) {
    activeVncId.value = vncId;
  }
};

const minimizeVnc = (vncId: string) => {
  const vnc = vncWindows.value.get(vncId);
  if (vnc) {
    vnc.isMinimized = !vnc.isMinimized;
  }
};

const closeVnc = (vncId: string) => {
  vncWindows.value.delete(vncId);
  if (activeVncId.value === vncId) {
    activeVncId.value = null;
  }
  ElMessage.info('VNC window closed');
};

const startVncDragging = (e: MouseEvent, vncId: string) => {
  const vnc = vncWindows.value.get(vncId);
  if (!vnc || vnc.isDragging) return;
  
  vnc.isDragging = true;
  activeVncId.value = vncId;
  
  const vncElement = (e.target as HTMLElement).closest('.draggable-vnc');
  if (!vncElement) return;
  
  const rect = vncElement.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  
  const onMouseMove = (e: MouseEvent) => {
    if (!vnc || !vnc.isDragging) return;
    
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    const maxX = window.innerWidth - parseInt(vnc.size.width);
    const maxY = window.innerHeight - parseInt(vnc.size.height);
    const boundedX = Math.max(0, Math.min(x, maxX));
    const boundedY = Math.max(0, Math.min(y, maxY));
    
    vnc.position = {
      top: `${boundedY}px`,
      left: `${boundedX}px`
    };
  };
  
  const onMouseUp = () => {
    if (vnc) {
      vnc.isDragging = false;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const startVncResizing = (e: MouseEvent, vncId: string, handle: string) => {
  e.preventDefault();
  e.stopPropagation();
  const vnc = vncWindows.value.get(vncId);
  if (!vnc) return;
  vnc.isResizing = true;
  vnc.resizeHandle = handle;
  activeVncId.value = vncId;
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = parseInt(vnc.size.width);
  const startHeight = parseInt(vnc.size.height);
  const onMouseMove = (e: MouseEvent) => {
    if (!vnc.isResizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (handle.includes('e')) {
      const newWidth = Math.max(600, startWidth + dx);
      vnc.size.width = `${newWidth}px`;
    }
    if (handle.includes('s')) {
      const newHeight = Math.max(400, startHeight + dy);
      vnc.size.height = `${newHeight}px`;
    }
  };
  const onMouseUp = () => {
    if (vnc) {
      vnc.isResizing = false;
      vnc.resizeHandle = '';
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};
</script>

<style scoped>
/* Cesium容器样式 */
.cesium-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 右上角网格分辨率标注 */
.grid-resolution-label {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  pointer-events: none;
  user-select: none;
  line-height: 1.4;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

/* 左下角平面坐标显示 */
.mouse-coord-label {
  position: absolute;
  bottom: 20px;
  left: 8px;
  z-index: 10;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  pointer-events: none;
  user-select: none;
  line-height: 1.4;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
}

/* 放置模式下的鼠标样式 */
.add-mode {
  cursor: crosshair;
}

/* 连接模式下的鼠标样式 */
.connect-mode {
  cursor: pointer;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: black;
}

/* 连接提示样式 */
.connect-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.7);
  color: #00eaff;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
  box-shadow: 0 0 10px rgba(0, 198, 255, 0.5);
  border: 1px solid rgba(0, 198, 255, 0.3);
}

/* 底图模式切换按钮 */
.map-mode-toggle {
  position: absolute;
  bottom: 28px;
  right: 20px;
  z-index: 100;
}

.map-mode-toggle .el-button {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 198, 255, 0.5);
  color: #00eaff;
  box-shadow: 0 0 10px rgba(0, 198, 255, 0.3);
  transition: all 0.3s ease;
}

.map-mode-toggle .el-button:hover {
  background: rgba(0, 198, 255, 0.2);
  border-color: #00eaff;
  box-shadow: 0 0 15px rgba(0, 198, 255, 0.5);
}

.map-mode-toggle .el-button.is-primary {
  background: rgba(0, 198, 255, 0.3);
  border-color: #00eaff;
}

/* 隐藏Cesium的logo和水印 */
:deep(.cesium-viewer-bottom),
:deep(.cesium-widget-credits) {
  display: none !important;
}

:deep(.cesium-viewer-toolbar) {
  display: none;
}

/* 可拖拽终端样式 */
.draggable-terminal {
  position: fixed;
  z-index: 20;
  min-width: 300px;
  min-height: 200px;
  max-width: 95vw;
  max-height: 90vh;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.9) 0%,
    rgba(17, 23, 64, 0.95) 100%
  );
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 122, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: terminal-appear 0.3s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  will-change: transform;
  transition: box-shadow 0.2s, z-index 0.2s;
  /* 确保终端内容能够适当显示 */
  display: flex;
  flex-direction: column;
  resize: none; /* 禁用浏览器默认的resize */
}

/* 活动终端样式 */
.draggable-terminal.active {
  z-index: 250;
  border: 1px solid rgba(0, 200, 255, 0.6);
  box-shadow: 0 12px 40px rgba(0, 200, 255, 0.3);
}

@keyframes terminal-appear {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(
    90deg,
    rgba(0, 52, 134, 0.8) 0%,
    rgba(0, 86, 179, 0.6) 100%
  );
  padding: 10px 12px;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(0, 122, 255, 0.2);
  /* 确保头部不会滚动 */
  flex: 0 0 auto;
}

.terminal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
}

.terminal-index {
  background-color: rgba(0, 122, 255, 0.8);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 4px;
}

.terminal-controls {
  display: flex;
  gap: 8px;
}

.terminal-control {
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.terminal-control:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.terminal-control.close:hover {
  background-color: rgba(255, 0, 0, 0.6);
}

.terminal-control.minimize:hover {
  background-color: rgba(255, 165, 0, 0.6);
}

.terminal-body {
  overflow: hidden;
  transition: height 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  /* 允许终端主体自适应父容器 */
  flex: 1 1 auto;
  min-height: 150px; /* 最小高度 */
  /* 隐藏滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* 隐藏终端区域的WebKit滚动条 */
.terminal-body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.terminal-body.minimized {
  height: 0;
  min-height: 0;
  flex: 0 0 0px;
  overflow: hidden;
}

.draggable-terminal.minimized {
  min-height: unset !important;
  max-height: unset !important;
}

/* 调整大小手柄样式 */
.resize-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  pointer-events: all;
  background: transparent;
}

/* 右边缘调整手柄 */
.resize-handle-e {
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
}

/* 下边缘调整手柄 */
.resize-handle-s {
  left: 0;
  right: 0;
  bottom: -3px;
  height: 6px;
  cursor: ns-resize;
}

/* 右下角调整手柄 */
.resize-handle-se {
  right: -3px;
  bottom: -3px;
  width: 12px;
  height: 12px;
  cursor: nw-resize;
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 40%,
    rgba(0, 122, 255, 0.3) 40%,
    rgba(0, 122, 255, 0.3) 60%,
    transparent 60%,
    transparent 100%
  );
}

.resize-handle-se::after {
  content: '';
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 8px;
  height: 8px;
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 30%,
    rgba(0, 122, 255, 0.6) 30%,
    rgba(0, 122, 255, 0.6) 70%,
    transparent 70%,
    transparent 100%
  );
}

/* 调整大小时的视觉反馈 */
.draggable-terminal:hover .resize-handle-e,
.draggable-terminal:hover .resize-handle-s {
  background: rgba(0, 122, 255, 0.2);
}

.draggable-terminal:hover .resize-handle-se {
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 40%,
    rgba(0, 122, 255, 0.5) 40%,
    rgba(0, 122, 255, 0.5) 60%,
    transparent 60%,
    transparent 100%
  );
}

/* 响应式终端调整 */
@media screen and (max-width: 768px) {
  .draggable-terminal {
    min-width: 280px;
    max-width: 95vw;
    max-height: 70vh;
  }

  .terminal-body {
    min-height: 120px;
  }

  /* 在小屏幕上隐藏调整大小手柄，避免误触 */
  .resize-handle-e,
  .resize-handle-s {
    display: none;
  }

  .resize-handle-se {
    width: 16px;
    height: 16px;
  }
}

/* 针对较低高度屏幕的终端优化 */
@media screen and (max-height: 700px) {
  .draggable-terminal {
    max-height: 60vh;
  }

  .terminal-body {
    min-height: 100px;
  }
}

.chat-fab {
  position: absolute;
  right: 32px;
  bottom: 32px;
  z-index: 1002;
  width: 56px;
  height: 56px;
  background: none;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 16px #07c16033;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.2s;
}
.chat-fab:hover {
  box-shadow: 0 8px 32px #07c16055;
}
.chat-float {
  position: fixed;
  z-index: 2000;
  width: 380px;
  height: 540px;
  background: #f7f7f7;
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(0,0,0,0.18);
  border: 1.5px solid #07c160;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}
.chat-float-header {
  background: #ededed;
  color: #222;
  font-size: 17px;
  font-weight: 600;
  padding: 10px 18px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
}
.chat-float-close {
  font-size: 22px;
  color: #888;
  cursor: pointer;
  margin-left: 12px;
  font-weight: 700;
  transition: color 0.2s;
}
.chat-float-close:hover {
  color: #07c160;
}
@media (max-width: 500px) {
  .chat-float {
    width: 98vw;
    height: 60vh;
    left: 1vw !important;
    top: 20vh !important;
  }
  .chat-fab {
    right: 10px;
    bottom: 10px;
  }
}

/* VNC window styles */
.draggable-vnc {
  position: fixed;
  z-index: 1000;
  background: linear-gradient(135deg, rgba(8, 15, 39, 0.95) 0%, rgba(17, 23, 64, 0.95) 100%);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  min-width: 600px;
  min-height: 400px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.draggable-vnc.active {
  z-index: 1001;
  box-shadow: 0 16px 56px rgba(0, 0, 0, 0.7);
}

.vnc-header {
  background: linear-gradient(90deg, rgba(24, 29, 40, 0.9) 0%, rgba(31, 38, 54, 0.9) 100%);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}

.vnc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.vnc-controls {
  display: flex;
  gap: 8px;
}

.vnc-control {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.vnc-control.minimize {
  background: linear-gradient(135deg, #e6a23c 0%, #cf9236 100%);
  color: #ffffff;
}

.vnc-control.minimize:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.4);
}

.vnc-control.close {
  background: linear-gradient(135deg, #f56c6c 0%, #e85656 100%);
  color: #ffffff;
}

.vnc-control.close:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}

.vnc-body {
  flex: 1;
  overflow: hidden;
}

.vnc-body.minimized {
  display: none;
}

.draggable-vnc.minimized {
  min-height: unset !important;
  max-height: unset !important;
}
</style>
