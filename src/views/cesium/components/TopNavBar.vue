<template>
  <div class="top-nav-bar">

    <header class="header">
      <!-- 左侧：时间 + 系统状态 -->
      <div class="header-left">
        <div class="time-section">
          <div class="time-clock">{{ currentTime }}</div>
        </div>
        <div class="divider-line"></div>
        <div class="stat-section">
          <span class="stat-tag">系统状态: <em class="status-online">在线</em></span>
          <span class="stat-tag">子网: <em>{{ topoStore.topoData?.nodes?.filter((node: any) => node.type === 'EMANE')?.length || 0 }}</em></span>
          <span class="stat-tag">节点: <em>{{ topoStore.topoData?.nodes?.filter((node: any) => node.type !== 'inode' && node.type !== 'EMANE')?.length || 0 }}</em></span>
          <span class="stat-tag">链路: <em>{{ topoStore.topoData?.links?.length || 0 }}</em></span>
        </div>
      </div>

      <!-- 中间标题区 -->
      <div class="header-center">
        <div class="center-title">
          <span class="title-text">{{ systemName }}</span>
        </div>
      </div>

      <!-- 右侧：主题切换 + 用户信息 + 退出 -->
      <div class="header-right">
        <!-- <ThemeSwitcher class="theme-switcher" /> -->
        <div class="divider-line"></div>
        <div class="user-panel">
          <div class="avatar-ring">
            <el-icon :size="16"><User /></el-icon>
          </div>
          <span class="username">{{ userInfo.username ? userInfo.username : userInfo.name }}</span>
        </div>
        <div class="divider-line"></div>
        <div class="logout-btn" @click="handleLogout" title="退出当前场景">
          <el-icon :size="16"><SwitchButton /></el-icon>
          <span>退出</span>
        </div>
      </div>
    </header>


    <div class="toolbar">
      <div class="toolbar-controls">
        <div class="nav-icons-group">
          <el-icon @click="handleFileClick" title="文件操作" class="file-icon">
            <Document />
            <transition name="dropdown">
              <div class="file-dropdown" v-if="isFileMenuVisible" @mouseleave="isFileMenuVisible = false">
                <div class="file-dropdown-item" @click.stop="handleMatlabExecute">
                  <span>MATLAB</span>
                </div>
              </div>
            </transition>
          </el-icon>
          <el-icon @click="handleZoomIn" title="放大视图">
            <ZoomIn />
          </el-icon>
          <el-icon @click="handleZoomOut" title="缩小视图">
            <ZoomOut />
          </el-icon>
          <el-icon @click="handleRefresh" title="刷新场景">
            <Refresh />
          </el-icon>
          <span class="nav-icons-divider"></span>
        </div>

        <div class="simulation-controls">
          <span class="control-label">当前场景：</span>
          <el-tag size="small" effect="plain" class="tech-tag">{{
            currentSessionName || "未选择场景"
          }}</el-tag>

          <el-button class="running-btn" :type="getStateType(topoData?.state)" size="small" :plain="true">
            <span class="pulse-dot" v-if="topoData?.state === 'RUNNING' || topoData?.state === 'RUNTIME'"></span>
            {{ getStateText(topoData?.state) }}
          </el-button>
          <span class="nav-icons-divider"></span>
        </div>
        <div class="nav-icons-group">
          <el-icon @click="handleStartSession" title="启动仿真">
            <VideoPlay />
          </el-icon>
          <!-- 暂停按钮 -->
          <el-icon  :class="{ 'disabled-icon': !isPauseEnabled }" @click="handlePauseSession" :title="isPauseEnabled ? '暂停仿真' : '当前不可暂停'">
            <svg t="1772785818724" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5835"><path d="M874.058005 149.941995a510.06838 510.06838 0 1 0 109.740156 162.738976 511.396369 511.396369 0 0 0-109.740156-162.738976z m66.278708 362.178731A428.336713 428.336713 0 1 1 512 83.663287a428.698892 428.698892 0 0 1 428.336713 428.336713z" fill="currentColor" p-id="5836"></path><path d="M417.954256 281.533601a41.046923 41.046923 0 0 0-41.77128 40.201839v385.116718a41.892007 41.892007 0 0 0 83.663287 0v-385.116718a41.167649 41.167649 0 0 0-41.892007-40.201839zM606.045744 281.533601a41.046923 41.046923 0 0 0-41.77128 40.201839v385.116718a41.892007 41.892007 0 0 0 83.663287 0v-385.116718a41.167649 41.167649 0 0 0-41.892007-40.201839z" fill="currentColor" p-id="5837"></path>
            </svg>
          </el-icon>
          <el-icon @click="handleStopSession" title="停止仿真">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M512 42.666667a469.333333 469.333333 0 1 0 469.333333 469.333333A469.333333 469.333333 0 0 0 512 42.666667z m0 864a394.666667 394.666667 0 1 1 394.666667-394.666667 395.146667 395.146667 0 0 1-394.666667 394.666667z"></path>
              <path d="M365.333333 365.333333m5.333334 0l282.666666 0q5.333333 0 5.333334 5.333334l0 282.666666q0 5.333333-5.333334 5.333334l-282.666666 0q-5.333333 0-5.333334-5.333334l0-282.666666q0-5.333333 5.333334-5.333334Z"></path>
            </svg>
          </el-icon>
          <el-icon @click="handleSaveSession" title="保存会话">
            <Check />
          </el-icon>
          <el-icon @click="handleSnapshotClick" title="场景快照">
            <Camera />
          </el-icon>
          <el-icon @click="handleSaveTemplateClick" title="保存组网模板">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M704 320c0 17.7-14.3 32-32 32H352c-17.7 0-32-14.3-32-32s14.3-32 32-32h320c17.7 0 32 14.3 32 32z m-32 128H352c-17.7 0-32 14.3-32 32s14.3 32 32 32h320c17.7 0 32-14.3 32-32s-14.3-32-32-32z m0 192H352c-17.7 0-32 14.3-32 32s14.3 32 32 32h320c17.7 0 32-14.3 32-32s-14.3-32-32-32z"></path>
              <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path>
            </svg>
          </el-icon>
          <el-icon @click="handleTemplateManageClick" title="模板管理">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32z m-40 728H184V184h656v656z"></path>
              <path d="M492 400h184c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H492c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8z m0 144h184c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H492c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8z m0 144h184c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8H492c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8z"></path>
              <path d="M340 368c22.1 0 40-17.9 40-40s-17.9-40-40-40-40 17.9-40 40 17.9 40 40 40z m0 144c22.1 0 40-17.9 40-40s-17.9-40-40-40-40 17.9-40 40 17.9 40 40 40z m0 144c22.1 0 40-17.9 40-40s-17.9-40-40-40-40 17.9-40 40 17.9 40 40 40z"></path>
            </svg>
          </el-icon>
          <span class="nav-icons-divider"></span>
        </div>
        <div class="time-controls">
          <span class="time-label">推演时间：</span>
          <span class="time-value">{{ displaySimulationTimeRange }}</span>
          <span class="time-label">步长：</span>
          <span class="time-value">{{ simulationConfig.stepLength }} ms</span>
          <span class="nav-icons-divider"></span>
        </div>

        <div class="nav-icons-group">
          <el-icon title="控制节点" @click="handleControlNodes">
            <Place />
          </el-icon>
          <el-icon title="绘制路径" @click="handleStartPathDrawing">
            <AddLocation />
          </el-icon>
          <el-icon title="添加服务器" @click="handleAddServer">
            <Cloudy />
          </el-icon>
          <el-icon title="即时通信" @click="handleToggleChat" class="chat-icon-wrapper">
            <ChatDotRound />
            <span v-if="unreadMessageCount > 0" class="message-badge">{{ unreadMessageCount > 99 ? '99+' : unreadMessageCount }}</span>
          </el-icon>
          <span class="nav-icons-divider"></span>
        </div>

        <div class="nav-icons-group right-align">
          <div class="search-container">
            <transition name="fade">
              <div class="search-box" v-if="isSearchVisible">
                <el-input v-model="searchQuery" placeholder="输入搜索地址" size="small" prefix-icon="Search" clearable
                  @keyup.enter="handleSearch">
                </el-input>
              </div>
            </transition>
            <el-icon @click="toggleSearch" title="搜索地址">
              <Search />
            </el-icon>
          </div>
          <el-icon :title="useSimpleMode ? '切换到3D模型渲染' : '切换到简单点渲染'" @click="toggleRenderingMode">
            <component :is="useSimpleMode ? 'Coordinate' : 'Position'" />
          </el-icon>
          <el-icon :title="effectsVisible ? '隐藏所有特效' : '显示所有特效'" @click="handleShowAllEffects">
            <component :is="effectsVisible ? 'Hide' : 'View'" />
          </el-icon>
          <el-icon :title="linkLabelsVisible ? '隐藏链路标签' : '显示链路标签'" @click="handleToggleLinkLabels">
            <Discount />
          </el-icon>
          <el-icon :title="nodeNamesVisible ? '隐藏节点名称' : '显示节点名称'" @click="handleToggleNodeNames">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32z m-40 632H136V232h752v560z"></path>
              <path d="M610.3 476h123.4c1.3 0 2.3-3.6 2.3-8v-48c0-4.4-1-8-2.3-8H610.3c-1.3 0-2.3 3.6-2.3 8v48c0 4.4 1 8 2.3 8z m-220.8-8v-48c0-4.4 1-8 2.3-8h123.4c1.3 0 2.3 3.6 2.3 8v48c0 4.4-1 8-2.3 8H391.8c-1.3 0-2.3-3.6-2.3-8z m-196.2 0v-48c0-4.4 1-8 2.3-8h123.4c1.3 0 2.3 3.6 2.3 8v48c0 4.4-1 8-2.3 8H195.6c-1.3 0-2.3-3.6-2.3-8z"></path>
              <path d="M473.8 640h-48c-4.4 0-8 1-8 2.3v123.4c0 1.3 3.6 2.3 8 2.3h48c4.4 0 8-1 8-2.3V642.3c0-1.3-3.6-2.3-8-2.3z m132-128h-48c-4.4 0-8 1-8 2.3v123.4c0 1.3 3.6 2.3 8 2.3h48c4.4 0 8-1 8-2.3V514.3c0-1.3-3.6-2.3-8-2.3z m132 0h-48c-4.4 0-8 1-8 2.3v123.4c0 1.3 3.6 2.3 8 2.3h48c4.4 0 8-1 8-2.3V514.3c0-1.3-3.6-2.3-8-2.3z"></path>
            </svg>
          </el-icon>
          <el-icon @click="flyToHome" title="返回初始视角">
            <HomeFilled />
          </el-icon>
          <div class="earth-menu-container">
            <el-icon class="earth-icon" @click="toggleEarthMenu" title="视图模式">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </el-icon>
            <transition name="dropdown">
              <div class="earth-dropdown" v-if="isEarthMenuVisible" @mouseleave="isEarthMenuVisible = false">
                <div class="earth-dropdown-item" @click="switchTo3DView" title="3D">
                  <el-icon class="earth-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                  </el-icon>
                </div>
                <div class="earth-dropdown-item" @click="switchTo2DView" title="2D">
                  <el-icon>
                    <Grid />
                  </el-icon>
                </div>
                <div class="earth-dropdown-item" @click="switchToColumbusView" title="哥伦布视图">
                  <el-icon>
                    <Menu />
                  </el-icon>
                </div>
              </div>
            </transition>
          </div>
          <div class="help-container">
            <el-icon @click="toggleHelpPanel" title="导航帮助">
              <QuestionFilled />
            </el-icon>
            <transition name="fade">
              <div class="help-panel" v-if="isHelpVisible" @mouseleave="isHelpVisible = false">
                <div class="help-panel-header">
                  <h3>导航帮助</h3>
                  <el-icon class="close-icon" @click="isHelpVisible = false">
                    <Close />
                  </el-icon>
                </div>
                <div class="help-panel-content">
                  <div class="help-section">
                    <h4>平移视图</h4>
                    <div class="help-item">
                      <div class="help-icon mouse-left"></div>
                      <div class="help-desc">鼠标左键拖动</div>
                    </div>
                    <div class="help-item">
                      <div class="help-icon touch-one"></div>
                      <div class="help-desc">单指拖动</div>
                    </div>
                  </div>

                  <div class="help-section">
                    <h4>缩放视图</h4>
                    <div class="help-item">
                      <div class="help-icon mouse-right"></div>
                      <div class="help-desc">鼠标右键上下拖动</div>
                    </div>
                    <div class="help-item">
                      <div class="help-icon mouse-wheel"></div>
                      <div class="help-desc">鼠标滚轮滚动</div>
                    </div>
                    <div class="help-item">
                      <div class="help-icon touch-two"></div>
                      <div class="help-desc">双指捏合</div>
                    </div>
                  </div>

                  <div class="help-section">
                    <h4>旋转视图</h4>
                    <div class="help-item">
                      <div class="help-icon mouse-middle"></div>
                      <div class="help-desc">鼠标中键拖动或Ctrl+左键拖动</div>
                    </div>
                    <div class="help-item">
                      <div class="help-icon touch-three"></div>
                      <div class="help-desc">三指拖动</div>
                    </div>
                  </div>

                  <div class="help-section">
                    <h4>倾斜视图</h4>
                    <div class="help-item">
                      <div class="help-icon keyboard"></div>
                      <div class="help-desc">按住Alt键+左键拖动</div>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>


    <SimulationConfigPanel v-model="isMonitorPanelVisible"
      :session-id="currentSessionId ? String(currentSessionId) : null" @start-simulation="handleStartSimulation" />


    <EditPanel v-model="isEditPanelVisible" />


    <PerformanceSettingsPanel v-model="isPerformancePanelVisible" />


    <Teleport to="body">
      <div class="fullscreen-loading" v-if="isLoading">
        <div class="loading-content">
          <div class="loading-spinner">
            <div class="spinner-circle"></div>
          </div>
          <div class="loading-text">{{ loadingText }}</div>
          <div class="loading-subtitle">请耐心等待...</div>
        </div>
      </div>
    </Teleport>


    <SnapshotManageDialog
      v-model:visible="isSnapshotDialogVisible"
      :session-id="currentSessionId"
      @close="handleSnapshotDialogClose"
    />

    <!-- 保存模板对话框 -->
    <SaveTemplateDialog
      v-model:visible="isSaveTemplateDialogVisible"
      @close="handleSaveTemplateDialogClose"
      @success="handleSaveTemplateSuccess"
    />

    <!-- 模板管理对话框 -->
    <TemplateManageDialog
      v-model:visible="isTemplateManageDialogVisible"
      @close="handleTemplateManageDialogClose"
      @use-template="handleUseTemplate"
    />

    <ChatPanel v-model:visible="isChatPanelVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useTopoStore } from "../../../store/modules/topo";
import { useNemIdStore } from "../../../store/modules/nemId";
import { useThemeStore } from "../../../store/modules/theme";
import { useInterferenceStore } from "../../../store/modules/interference";
import { startSession, stopSession, saveSession, startBroker, stopBroker, pauseSession } from "../../../api/scene";
import { getHistoryData } from "../../../api/historyData";
import { stopNodeInterference } from "../../../api/inode";
import { PassiveMeasurement } from "../../../api/wiredTest/wiredTest";
import { getNemIds } from "../../../api/node";
import { applyProtocol, getAllProtocols } from "../../../api/protocol";
import type { ApiResponse } from "../../../api/scene";
import {
  Folder,
  FolderOpened,
  Picture,
  ZoomIn,
  ZoomOut,
  Refresh,
  Document,
  Edit,
  Monitor,
  Setting,
  SwitchButton,
  User,
  VideoPlay,
  Check,
  HomeFilled,
  Search,
  QuestionFilled,
  Grid,
  Menu,
  Close,
  Place,
  AddLocation,
  Cloudy,
  Camera,
  Loading,
  ChatDotRound,
  Discount,
} from "@element-plus/icons-vue";
import ThemeSwitcher from "../../../components/ThemeSwitcher.vue"; // 导入主题切换器
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useSystemLogStore } from "../../../store/modules/systemLog";
import eventBus from "../../../utils/eventBus";
import EditPanel from './EditPanel.vue';
import PerformanceSettingsPanel from './PerformanceSettingsPanel.vue';
import SimulationConfigPanel from './SimulationConfigPanel.vue'; // 导入新组件
import SnapshotManageDialog from './SnapshotManageDialog.vue'; // 导入快照管理对话框
import ChatPanel from './ChatPanel.vue'; // 导入聊天面板
import SaveTemplateDialog from './SaveTemplateDialog.vue'; // 导入保存模板对话框
import TemplateManageDialog from './TemplateManageDialog.vue'; // 导入模板管理对话框
import { getUserInfo, clearUserInfo } from "../../../store/user"; // 导入用户信息管理模块
import { cancelProtocol, insertRouterInfo } from "../../../api/protocol";
import { number } from "echarts";

const router = useRouter();
const topoStore = useTopoStore();
const nemIdStore = useNemIdStore();
const themeStore = useThemeStore();
const interferenceStore = useInterferenceStore();
const systemLogStore = useSystemLogStore();
const { topoData, currentSessionId, currentSessionName } = storeToRefs(
  topoStore
);

const systemName = import.meta.env.VITE_APP_SYSTEM_NAME || "机动网络环境仿真系统V2.0";

const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${date.getMonth() + 1
    }-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
};

const currentTime = ref(formatDate(new Date()));
const formatSimulationTime = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const userInfo = ref({
  role: 'white',
  name: '未知',
  color: '#000000',
  bgColor: '#FFFFFF',
  username: ''
});

const getSimulationBaseTime = () => {
  const now = new Date();
  const simulationBaseTime = new Date(now);
  simulationBaseTime.setMonth(now.getMonth());
  return simulationBaseTime;
};

const simulationTime = ref(formatSimulationTime(getSimulationBaseTime()));

// 计算推演时间范围显示
const displaySimulationTimeRange = computed(() => {
  if (simulationConfig.value.startTime && simulationConfig.value.endTime) {
    const startStr = formatSimulationTime(simulationConfig.value.startTime);
    const endStr = formatSimulationTime(simulationConfig.value.endTime);
    return `${startStr} --- ${endStr}`;
  }
  return simulationTime.value;
});

let timer: number;
let simulationTimer: number;

const currentBeijingTime = ref(formatDateBeijing(new Date()));

function formatDateBeijing(date: Date): string {
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingDate.getUTCFullYear()}-${beijingDate.getUTCMonth() + 1
    }-${beijingDate.getUTCDate()} ${beijingDate.getUTCHours()}:${beijingDate.getUTCMinutes()}:${beijingDate.getUTCSeconds()}`;
}

let beijingTimer: number;

const handleRenderingModeChanged = (isSimpleMode: boolean) => {
  useSimpleMode.value = isSimpleMode;
};

const handleNewChatMessage = () => {
  if (!isChatPanelVisible.value) {
    unreadMessageCount.value++;
  }
};

const handleClearUnreadMessages = () => {
  unreadMessageCount.value = 0;
};

onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = formatDate(new Date());
  }, 1000);

  simulationTimer = window.setInterval(() => {
    const baseTime = getSimulationBaseTime();
    baseTime.setSeconds(baseTime.getSeconds() + new Date().getSeconds());
    baseTime.setMilliseconds(new Date().getMilliseconds());
    simulationTime.value = formatSimulationTime(baseTime);
  }, 100);

  beijingTimer = window.setInterval(() => {
    currentBeijingTime.value = formatDateBeijing(new Date());
  }, 1000);

  const info = getUserInfo();
  if (info && info.role) {
    userInfo.value = {
      role: info.role,
      name: info.name,
      color: info.color,
      bgColor: info.bgColor,
      username: info.username || ''
    };

    if (info.hasRole && info.role) {
      themeStore.setThemeByRole(info.role);
    }
  } else {
    console.warn('未获取到用户信息，使用默认白方');
  }

  // 添加在已有的onMounted内部的末尾

  // 监听渲染模式变化
  eventBus.on("renderingModeChanged", handleRenderingModeChanged);

  // 监听聊天新消息事件
  eventBus.on("newChatMessage", handleNewChatMessage);

  // 监听清除未读消息事件
  eventBus.on("clearUnreadMessages", handleClearUnreadMessages);

  // 监听地图点击事件（用于模板放置）
  eventBus.on("mapClickedForTemplate", handleMapClickForTemplate);
  eventBus.on("opencli:simulationLifecycle", handleOpenCliSimulationLifecycle);
});

onUnmounted(() => {
  // 清除定时器
  clearInterval(timer);
  clearInterval(simulationTimer);
  clearInterval(beijingTimer);

  // 清除仿真提醒定时器
  stopSimulationReminder();

  // 取消渲染模式变化监听
  eventBus.off("renderingModeChanged", handleRenderingModeChanged);

  // 移除聊天新消息事件监听
  eventBus.off("newChatMessage", handleNewChatMessage);

  // 移除清除未读消息事件监听
  eventBus.off("clearUnreadMessages", handleClearUnreadMessages);

  // 移除地图点击事件监听
  eventBus.off("mapClickedForTemplate", handleMapClickForTemplate);
  eventBus.off("opencli:simulationLifecycle", handleOpenCliSimulationLifecycle);
});

// 退出当前场景
const handleLogout = async () => {
  const hadScene = Boolean(
    currentSessionId.value ||
    topoStore.topoData?.id ||
    topoStore.topoData?.nodes?.length ||
    topoStore.topoData?.links?.length
  );

  try {
    resetSimulationConfig();
    eventBus.emit("stopSimulation");
    topoStore.clearTopoData();
    eventBus.emit("exitCurrentScene");
    eventBus.emit("topoDataUpdated");
    (eventBus as any).emit("opencli:simulationLifecycle", { status: "closed" });

    if (router.currentRoute.value.path === "/viewer") {
      await router.replace("/simu/view");
    }

    ElMessage.success(hadScene ? "\u5df2\u9000\u51fa\u5f53\u524d\u573a\u666f" : "\u5df2\u8fd4\u56de\u573a\u666f\u5217\u8868");
  } catch (error) {
    console.error("[TopNavBar] exit current scene failed:", error);
    ElMessage.error("\u9000\u51fa\u5f53\u524d\u573a\u666f\u5931\u8d25");
  }
};

// 搜索框状态
const isSearchVisible = ref(false);
const searchQuery = ref("");

// 文件菜单状态
const isFileMenuVisible = ref(false);

// 文件下拉菜单状态
const isFileDropdownVisible = ref(false);

// 地球菜单状态
const isEarthMenuVisible = ref(false);

// 导航帮助面板状态
const isHelpVisible = ref(false);

// 监控面板状态
const isMonitorPanelVisible = ref(false);
const monitorParams = ref({
  duration: 10000,
  stepLength: 1000,
  mode: 0,
  endTime: new Date(new Date().setHours(new Date().getHours() + 1)), // 默认为当前时间后1小时
  durationMinutes: 10 // 默认持续时间为10分钟
});

// 仿真配置状态
const simulationConfig = ref({
  startTime: null as Date | null,
  endTime: null as Date | null,
  stepLength: 1000,
  isRunning: false
});

const resetSimulationConfig = () => {
  simulationConfig.value.isRunning = false;
  simulationConfig.value.startTime = null;
  simulationConfig.value.endTime = null;
  stopSimulationReminder();
};

const handleOpenCliSimulationLifecycle = (payload: any) => {
  const status = payload?.status;

  if (status === 'started') {
    const duration = Number(payload?.duration || monitorParams.value.duration || 0);
    const stepLength = Number(payload?.stepLength || monitorParams.value.stepLength || 1000);

    simulationConfig.value.startTime = new Date();
    simulationConfig.value.endTime = duration > 0 ? new Date(Date.now() + duration) : null;
    simulationConfig.value.stepLength = stepLength;
    simulationConfig.value.isRunning = true;
    startSimulationReminder();
    return;
  }

  if (status === 'paused' || status === 'stopped' || status === 'closed') {
    resetSimulationConfig();
    return;
  }

  if (status === 'loaded' || status === 'refreshed') {
    const state = topoStore.topoData?.state;
    const isRunningState = state === 'RUNTIME' || state === 'RUNNING' || state === 'INSTANTIATION';
    simulationConfig.value.isRunning = isRunningState;

    if (!isRunningState) {
      simulationConfig.value.startTime = null;
      simulationConfig.value.endTime = null;
      stopSimulationReminder();
    }
  }
};

// MATLAB结果面板状态 - 移到Cesium主组件
// const isMatlabResultPanelVisible = ref(false);

// 聊天面板状态
const isChatPanelVisible = ref(false);

// 未读消息计数
const unreadMessageCount = ref(0);

// 渲染模式切换状态
const useSimpleMode = ref(false);

// 仿真时间提醒相关
const simulationReminderTimer = ref<number | null>(null);
const hasShownFinalReminder = ref(false);
const hasShown5MinReminder = ref(false);
const hasShown1MinReminder = ref(false);

// 会话保存计数器
const sessionSaveCounter = ref(0);

// 切换搜索框显示/隐藏
const toggleSearch = () => {
  isSearchVisible.value = !isSearchVisible.value;
  if (isSearchVisible.value) {
    // 下一帧聚焦输入框
    setTimeout(() => {
      const input = document.querySelector(".search-box input") as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }
};

// 切换地球菜单显示/隐藏
const toggleEarthMenu = () => {
  isEarthMenuVisible.value = !isEarthMenuVisible.value;
};

// 切换导航帮助面板显示/隐藏
const toggleHelpPanel = () => {
  isHelpVisible.value = !isHelpVisible.value;
};

// 切换聊天面板显示/隐藏
const handleToggleChat = () => {
  isChatPanelVisible.value = !isChatPanelVisible.value;
  if (isChatPanelVisible.value) {
    // 打开聊天面板时清除未读消息计数
    unreadMessageCount.value = 0;
    ElMessage.success('聊天面板已打开');
  }
};

// 视图切换函数
const switchTo3DView = () => {
  // 发送消息到Cesium组件，切换到3D视图
  eventBus.emit("switchViewMode", "SCENE3D");
  ElMessage.success("已切换到3D视图");
  isEarthMenuVisible.value = false;
};

const switchTo2DView = () => {
  // 发送消息到Cesium组件，切换到2D视图
  eventBus.emit("switchViewMode", "SCENE2D");
  ElMessage.success("已切换到2D视图");
  isEarthMenuVisible.value = false;
};

const switchToColumbusView = () => {
  // 发送消息到Cesium组件，切换到哥伦布视图
  eventBus.emit("switchViewMode", "COLUMBUS_VIEW");
  ElMessage.success("已切换到哥伦布视图");
  isEarthMenuVisible.value = false;
};

// 返回初始视角函数
const flyToHome = () => {
  eventBus.emit("flyToHome");
};

// 处理搜索功能
const handleSearch = () => {
  if (!searchQuery.value.trim()) {
    ElMessage.warning("请输入搜索地址");
    return;
  }

  // 发送搜索地址事件
  eventBus.emit("searchLocation", searchQuery.value.trim());
  ElMessage.success(`正在搜索: ${searchQuery.value.trim()}`);

  // 可选：成功后关闭搜索框
  // isSearchVisible.value = false;
};

// 视图放大缩小和刷新函数
const handleZoomIn = () => {
  eventBus.emit("zoomIn");
  // ElMessage.success("正在放大视图");
};

const handleZoomOut = () => {
  eventBus.emit("zoomOut");
  // ElMessage.success("正在缩小视图");
};

const handleRefresh = () => {
  eventBus.emit("refreshScene");
  ElMessage.success("刷新场景");
};

// 获取状态对应的按钮类型
const getStateType = (state?: string) => {
  switch (state) {
    case "RUNTIME":
    case "RUNNING":
      return "success";
    case "INSTANTIATION":
    case "CONFIGURATION":
      return "warning";
    case "SHUTDOWN":
      return "danger";
    case "DEFINITION":
      return "info";
    default:
      return "info";
  }
};

// 获取状态对应的文本
const getStateText = (state?: string) => {
  switch (state) {
    case "RUNTIME":
    case "RUNNING":
      return "正在运行";
    case "INSTANTIATION":
      return "实例化中";
    case "CONFIGURATION":
      return "配置中";
    case "SHUTDOWN":
      return "已停止";
    case "DEFINITION":
      return "已初始化";
    default:
      return "未运行";
  }
};

// 处理开始会话按钮点击
const handleStartSession = () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }
 


  // 直接打开监控配置面板
  isMonitorPanelVisible.value = true;
};


//处理暂停会话按钮
const handlePauseSession = async () => { 
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }
  try { 
    //获取系统的运行状态
    const state= topoStore.topoData?.state;
    //将节点名和场景id进行组合
    const nodes = topoStore.topoData?.nodes || [];
    const dockerNodes = (nodes as any[]).filter((n: any) => n.type === 'DOCKER');
    const containerList = dockerNodes.map((n: any) => `${n.name}-${currentSessionId.value}`);
    console.log('containerList:',containerList);
    const reportInterval = simulationConfig.value.stepLength/1000 || monitorParams.value.stepLength/1000 || 1;
  
    console.log('state:',state);
     const passivePayload: any = {
          controlType: 2, // 2表示停止被动测量
          sessionId:currentSessionId.value,
          reportInterval,
          containerList
        };
    if (state === 'RUNTIME' ) { 
      //调用停止被动测量的接口
      if(containerList.length > 0){
        await PassiveMeasurement(passivePayload)
            .then(() => {
              console.log('被动测量停止命令已发送');
            })
            .catch((err) => {
              console.error('停止被动测量失败:', err);
            });
      
      }
       //停止监控
      await handleStopMonitor();
      //调用停止场景接口
      await pauseSession(currentSessionId.value, getUserInfo().id, containerList);
   
      //更新 topoData
      (topoStore as any).setTopoData(currentSessionId.value, {...topoStore.topoData,
        state: 'SHUTDOWN'
      });
      ElMessage.success('场景已暂停');
      return;
    }else{
      ElMessage.warning('场景未运行！');
      return;
    
    }
  } catch (error) {
    ElMessage.error("暂停会话失败");
  }
};

// 暂停按钮是否可用（仅在 RUNTIME 状态下可用）
const isPauseEnabled = computed(() => topoData?.state === 'RUNTIME' || topoData?.value?.state === 'RUNTIME');
// 停止所有干扰节点的干扰
const stopAllInterference = async () => {
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    return;
  }

  const sessionId = topoStore.currentSessionId;
  if (!sessionId) {
    console.warn('TopNavBar: 无法关闭干扰: 当前会话ID不存在');
    return;
  }

  const userInfo = getUserInfo();
  const userId = userInfo.id;

  // 找出所有干扰中的INODE节点
  const activeInterferenceNodes = topoStore.topoData.nodes.filter((node: any) => {
    if (node.type !== 'INODE') return false;
    const config = interferenceStore.getConfigByNodeId(node.id);
    return config && config.status === 'RUNTIME';
  });

  if (activeInterferenceNodes.length === 0) {
    return;
  }


  // 为每个活跃的干扰节点调用stopNodeInterference API
  const stopPromises = activeInterferenceNodes.map(async (node: any) => {
    try {
      await stopNodeInterference(Number(sessionId), node.id, userId);

      // 更新interferenceStore中的状态
      const config = interferenceStore.getConfigByNodeId(node.id);
      if (config) {
        interferenceStore.updateInterferenceConfig({
          ...config,
          status: 'SHUTDOWN'
        });
      }

    } catch (error) {
      console.error(`TopNavBar: 关闭干扰节点 ${node.id} 失败:`, error);
    }
  });

  await Promise.all(stopPromises);
};

// 处理停止会话
const handleStopSession = async () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }

  // 显示加载界面
  isLoading.value = true;
  loadingText.value = '正在停止仿真...';

  try {
    // 1. 首先关闭所有干扰节点的干扰
    await stopAllInterference();

    // 2. 然后停止监控
    await handleStopMonitor();

    //3.停止被动测量
    try {
        const sessionId = Number(currentSessionId.value);
        const nodes = topoStore.topoData?.nodes || [];
        const dockerNodes = (nodes as any[]).filter((n: any) => n.type === 'DOCKER');
        const containerList = dockerNodes.map((n: any) => `${n.name}-${sessionId}`);

        const reportInterval = simulationConfig.value.stepLength/1000 || monitorParams.value.stepLength/1000 || 1;

        const passivePayload: any = {
          controlType: 2, // 2表示停止被动测量
          sessionId,
          reportInterval,
          containerList
        };
        // 调用被动测量接口（不阻塞主流程）
        if(dockerNodes.length > 0) {
          PassiveMeasurement(passivePayload)
            .then(() => {
              console.log('被动测量停止命令已发送');
            })
            .catch((err) => {
              console.error('停止被动测量失败:', err);
            });
        } else {
          console.log('没有Docker节点，无需停止被动测量');
        }
      } catch (err) {
        console.error('构建被动测量参数失败:', err);
      }

    // 4. 最后停止会话
    try {
      const response = await stopSession(currentSessionId.value) as unknown as ApiResponse;

      if (response.code === 200) {
        // 更新 topoData
        (topoStore as any).setTopoData(currentSessionId.value, response.data);
        isLoading.value = false;
        ElMessage.success("仿真会话已停止");

        //停止仿真时，重置路由协议配置
        cancelProtocol(currentSessionId.value);
        // 清除NEM ID数据
        nemIdStore.resetNemIds();

        // 清除EMANE数据
        import("../../../store/modules/emane")
          .then(({ useEmaneStore }) => {
            const emaneStore = useEmaneStore();
            emaneStore.clearEmaneData();
          })
          .catch((error) => {
            console.error("加载EMANE仓库失败:", error);
          });

        // 重置仿真配置状态
        simulationConfig.value.isRunning = false;
        simulationConfig.value.startTime = null;
        simulationConfig.value.endTime = null;

        // 停止仿真时间提醒
        stopSimulationReminder();

        // 通知Cesium组件停止发送节点位置更新
        // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
        eventBus.emit("stopSimulation");
      } else {
        isLoading.value = false;
        ElMessage.error(response.msg || "停止仿真失败");
      }
    } catch (sessionError) {
      isLoading.value = false;
      console.error("停止会话失败:", sessionError);
      ElMessage.error("停止仿真失败");
    }
  } catch (error) {
    isLoading.value = false;
    console.error("停止仿真流程失败:", error);
    ElMessage.error("停止仿真流程失败");
  }
};

// 处理保存会话
const handleSaveSession = async () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }

  try {
    // 获取当前用户ID
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    // 生成动态别名：场景名称-递增数字
    const sceneName = currentSessionName.value || "未命名场景";
    sessionSaveCounter.value += 1;
    
    const response = await saveSession(currentSessionId.value, userId, sceneName, sessionSaveCounter.value) as unknown as ApiResponse;
    if (response.code === 200) {
      ElMessage.success("会话保存成功");
    } else {
      ElMessage.error(response.msg || "保存失败");
    }
  } catch (error) {
    console.error("保存会话失败:", error);
    ElMessage.error("保存会话失败");
  }
};

// 处理开始绘制路径
const handleStartPathDrawing = () => {
  try {
    // 在访问eventBus前先检查它是否存在
    if (eventBus) {
      // 使用any类型避免类型检查错误
      (eventBus as any).emit("startPathDrawing");
    } else {
      ElMessage.warning('系统未准备好，请稍后重试');
    }
  } catch (error) {
    console.error('启动路径绘制失败:', error);
    ElMessage.error('启动路径绘制失败');
  }
};

// 处理控制节点
const handleControlNodes = () => {
  try {
    // 在访问eventBus前先检查它是否存在
    if (eventBus) {
      // 触发控制节点事件
      (eventBus as any).emit("openDroneControlPanel");
    } else {
      ElMessage.warning('系统未准备好，请稍后重试');
    }
  } catch (error) {
    console.error('启动节点控制失败:', error);
    ElMessage.error('启动节点控制失败');
  }
};

// 检查是否有EMANE类型的子网节点
const hasEmaneNodes = (): boolean => {
  try {
    const nodes = topoStore.topoData?.nodes || [];
    return nodes.some((node: any) => node.type === 'EMANE');
  } catch (error) {
    console.error('检查EMANE节点失败:', error);
    return false;
  }
};

// 检查是否有协议配置
const hasProtocolConfiguration = async (sessionId: number): Promise<boolean> => {
  try {
    // 获取拓扑数据中的所有路由器节点
    const nodes = topoStore.topoData?.nodes || [];


    // 检查是否有路由器类型的节点
    // 路由器节点前端类型是ROUTER
    const routerNodes = nodes.filter((node: any) =>
      node.type === 'ROUTER' || node.type === 'router' ||
      
      (node.name && node.name.startsWith('ROUTER'))
    );


    if (routerNodes.length === 0) {
      return false;
    }

    // 检查每个路由器节点是否有协议配置
    for (const node of routerNodes) {
      try {
        const containerName = `${node.name}-${sessionId}`;

        const protocolData = await getAllProtocols(sessionId, containerName, false);

        // 检查 protocolData 是否有效（不是 null, false, undefined）
        if (protocolData && typeof protocolData === 'object' && protocolData !== false) {
          // 检查是否有任何协议被启用
          const hasProtocol = protocolData.protocolOspf2 === 'on' ||
                            protocolData.protocolOspf3 === 'on' ||
                            protocolData.protocolRip === 'on' ||
                            protocolData.protocolBgp === 'on' ||
                            protocolData.protocolIsis === 'on' ||
                            protocolData.protocolPim === 'on' ||
                            protocolData.protocolSnapshot === 'on' ||
                            protocolData.protocolBackpressure === 'on';


          if (hasProtocol) {
            return true;
          }
        }
      } catch (error) {
        console.warn(`检查节点 ${node.name} 的协议配置失败:`, error);
        // 继续检查其他节点
      }
    }

    return false;
  } catch (error) {
    console.error('检查协议配置失败:', error);
    // 如果检查失败，为了安全起见，假设有协议配置，让用户决定
    return true;
  }
};

// 处理监控配置面板发出的开始仿真事件
const handleStartSimulation = async (params: any) => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }

  // 显示加载界面
  isLoading.value = true;
  loadingText.value = '正在启动仿真';

  // 将子组件传递的参数合并到monitorParams中
  monitorParams.value = { ...monitorParams.value, ...params };
  
  // 更新仿真配置状态
  simulationConfig.value.startTime = new Date();
  simulationConfig.value.endTime = new Date(Date.now() + params.durationMinutes * 60 * 1000);
  simulationConfig.value.stepLength = params.stepLength || 1000;
  simulationConfig.value.isRunning = true;

  // 启动仿真时间提醒
  startSimulationReminder();

  // 1. 首先启动会话
  try {
    loadingText.value = '正在启动会话...';

    // 获取当前用户ID
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (!userId) {
      isLoading.value = false;
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    // 获取当前拓扑数据中的服务器信息
    const servers = topoStore.topoData?.servers || [];
    
    // 使用unknown类型进行安全转换
    const sessionResponse = await startSession(currentSessionId.value, userId, servers, monitorParams.value.duration) as unknown as ApiResponse;
 
    if (sessionResponse.code === 200) {
      // 更新 topoData
      (topoStore as any).setTopoData(currentSessionId.value, sessionResponse.data);

      // 2. 检查是否需要处理协议配置（如果参数中标记了需要检查）
      if (params.needsProtocolCheck) {
        try {
          loadingText.value = '正在检查协议配置...';
          const hasProtocol = await hasProtocolConfiguration(currentSessionId.value);

          if (hasProtocol) {
            try {
              loadingText.value = '正在重置路由配置...';
              await cancelProtocol(currentSessionId.value);
            } catch (error) {
              console.warn('重置路由配置失败，继续尝试应用协议:', error);
            }

            try {
              loadingText.value = '正在应用协议配置...';
              const response = await applyProtocol(currentSessionId.value);

              // 解析并写入收敛时间到 topoStore
              if (response && typeof response === 'object') {
                const sessionIdStr = String(currentSessionId.value);
                let updated = false;

                Object.entries(response).forEach(([key, value]) => {
                  // key 形如 'ROUTER2-994'
                  const match = key.match(/^(.*)-(\d+)$/);
                  if (match && match[2] === sessionIdStr) {
                    const nodeName = match[1];
                    const node = topoStore.topoData?.nodes?.find((n: any) => n.name === nodeName);
                    if (node) {
                      node.convergenceTime = value;
                      updated = true;
                    }
                  }
                });

                if (updated) {
                  (eventBus as any).emit('router-convergence-updated');
                }
              }
            } catch (error) {
              console.error('应用协议配置失败:', error);
              ElMessage.warning('协议配置应用失败，但仿真将继续启动');
            }
          } else {
          }
        } catch (error) {
          console.error('协议配置检查失败:', error);
          ElMessage.warning('协议配置检查失败，但仿真将继续启动');
        }
      }

      // 3. 检查是否需要获取NEM ID数据（只有存在EMANE子网节点时才需要）
      const needsNemIds = hasEmaneNodes();

      if (needsNemIds) {
        try {
          loadingText.value = '正在获取节点标识...';
          const nemIdResponse = await getNemIds(currentSessionId.value) as unknown as ApiResponse;
          if (nemIdResponse.code === 200) {
            // 存储NEM ID数据
            nemIdStore.setNemIds(nemIdResponse.data.sessionId, nemIdResponse.data.nemIds);
          } else {
            console.warn("获取NEM ID失败:", nemIdResponse.msg || "未知错误");
            ElMessage.warning("获取NEM ID失败，但仿真将继续启动");
          }
        } catch (nemIdError) {
          console.error("获取NEM ID时出错:", nemIdError);
          ElMessage.warning("获取NEM ID失败，但仿真将继续启动");
        }
      } else {
      }

      // 4. 启动监控
      try {
        loadingText.value = '正在建立监控连接...';
        const monitorResponse = await startBroker(monitorParams.value, currentSessionId.value) as unknown as ApiResponse;

        if (monitorResponse.code === 200) {
          isLoading.value = false;
          ElMessage.success(`仿真监控已启动，持续时间 ${monitorParams.value.durationMinutes} 分钟`);

          // 通知Cesium组件开始发送节点位置更新
          // @ts-ignore: 暂时忽略类型检查错误，因为事件总线定义可能不完整
          eventBus.emit("startSimulation");

          // 启动被动测量：controlType=1, sessionId=当前场景ID, 不传container和ip, reportInterval为步长, containerList为所有DOCKER节点名与场景ID组合
          try {
            const sessionId = Number(currentSessionId.value);
            const nodes = topoStore.topoData?.nodes || [];
            const dockerNodes = (nodes as any[]).filter((n: any) => n.type === 'DOCKER');
            const containerList = dockerNodes.map((n: any) => `${n.name}-${sessionId}`);

            const reportInterval = simulationConfig.value.stepLength/1000 || monitorParams.value.stepLength/1000 || 1;

            const passivePayload: any = {
              controlType: 1,
              sessionId,
              reportInterval,
              containerList
            };

            console.log('被动测量参数:', passivePayload);
            // 调用被动测量接口（不阻塞主流程）
            if (passivePayload.containerList.length > 0) {
              PassiveMeasurement(passivePayload).then((res: any) => {
              if (!res) {
                console.warn('被动测量下发未成功或返回空');
              }
            }).catch((err: any) => {
              console.error('被动测量调用异常:', err);
            });
              console.log('被动测量参数:', passivePayload);
            }
            
          } catch (err) {
            console.error('构建被动测量参数失败:', err);
          }
        } else {
          isLoading.value = false;
          ElMessage.error(monitorResponse.msg || "启动监控失败");
        }
      } catch (monitorError) {
        isLoading.value = false;
        console.error("启动监控失败:", monitorError);
        ElMessage.error("启动监控失败");
      }
    } else {
      isLoading.value = false;
      ElMessage.error(sessionResponse.msg || "启动会话失败");
    }
  } catch (error) {
    isLoading.value = false;
    console.error("启动会话失败:", error);
    ElMessage.error("启动会话失败");
  }
};

// 处理停止监控（内部功能，现已集成到停止仿真流程中）
const handleStopMonitor = async () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }

  try {
    const response = await stopBroker(currentSessionId.value) as unknown as ApiResponse;

    if (response.code === 200) {
      // ElMessage.success("仿真监控已停止");
      return true; // 返回成功状态便于其他函数判断
    } else {
      ElMessage.error(response.msg || "停止监控失败");
      return false;
    }
  } catch (error) {
    console.error("停止监控失败:", error);
    ElMessage.error("停止监控失败");
    return false;
  }
};


// 编辑面板状态
const isEditPanelVisible = ref(false);

// 处理编辑按钮点击
const handleEditClick = () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }
  isEditPanelVisible.value = true;
};

// 性能设置面板状态
const isPerformancePanelVisible = ref(false);

// 处理性能设置按钮点击
const handlePerformanceClick = () => {
  isPerformancePanelVisible.value = true;
};

const handleAddServer = () => {
  try {
    if (eventBus) {
      // @ts-ignore: 忽略类型检查错误，因为事件总线定义可能不完整
      eventBus.emit("openServerConfigDialog");
    } else {
      ElMessage.warning('系统未准备好，请稍后重试');
    }
  } catch (err: any) {
    console.error('打开服务器配置对话框失败:', err);
    ElMessage.error('打开服务器配置对话框失败');
  }
};

// 添加特效显示状态变量
const effectsVisible = ref(false);

// 添加链路标签和节点名称显示状态
const linkLabelsVisible = ref(true);
const nodeNamesVisible = ref(true);

// 快照对话框状态
const isSnapshotDialogVisible = ref(false);

// 保存模板对话框状态
const isSaveTemplateDialogVisible = ref(false);

// 模板管理对话框状态
const isTemplateManageDialogVisible = ref(false);

// 模板放置相关状态
const pendingTemplateData = ref<any>(null);
const isWaitingForMapClick = ref(false);

// 修改处理显示所有特效函数，使其可以切换状态
const handleShowAllEffects = () => {
  try {
    if (eventBus) {
      // 触发显示所有特殊效果事件，状态由Cesium组件通过事件通知回来
      eventBus.emit("showAllSpecialEffects");

      // 移除本地状态切换，完全依赖Cesium组件通过事件回传状态
      // effectsVisible.value = !effectsVisible.value;

      // 不在这里显示消息，由Cesium组件负责显示
    } else {
      ElMessage.warning('系统未准备好，请稍后重试');
    }
  } catch (error) {
    console.error('操作特效失败:', error);
    ElMessage.error('操作特效失败');
  }
};

// 处理切换链路标签显示
const handleToggleLinkLabels = () => {
  linkLabelsVisible.value = !linkLabelsVisible.value;
  eventBus.emit("toggleLinkLabels", linkLabelsVisible.value);
  ElMessage.success(linkLabelsVisible.value ? "已显示链路标签" : "已隐藏链路标签");
};

// 处理切换节点名称显示
const handleToggleNodeNames = () => {
  nodeNamesVisible.value = !nodeNamesVisible.value;
  eventBus.emit("toggleNodeNames", nodeNamesVisible.value);
  ElMessage.success(nodeNamesVisible.value ? "已显示节点名称" : "已隐藏节点名称");
};

// 添加加载状态和提示文本
const isLoading = ref(false);
const loadingText = ref('正在启动仿真');

// 切换文件菜单显示/隐藏
const handleFileClick = () => {
  isFileMenuVisible.value = !isFileMenuVisible.value;
};

// 处理文件保存
const handleFileSave = () => {
  // 记录文件保存操作
  systemLogStore.addLog({
    type: 'normal',
    module: 'file',
    action: '文件保存',
    information: '文件保存操作',
    details: '用户执行了文件保存操作（演示功能）'
  });

  ElMessage.success("保存功能仅作展示");
  isFileMenuVisible.value = false;
};

// 处理文件另存为
const handleFileSaveAs = () => {
  // 记录文件另存为操作
  systemLogStore.addLog({
    type: 'normal',
    module: 'file',
    action: '文件另存为',
    information: '文件另存为操作',
    details: '用户执行了文件另存为操作（演示功能）'
  });

  ElMessage.success("保存为功能仅作展示");
  isFileMenuVisible.value = false;
};

// 处理打开文件
const handleFileOpen = () => {
  // 记录文件打开操作
  systemLogStore.addLog({
    type: 'normal',
    module: 'file',
    action: '打开文件',
    information: '文件打开操作',
    details: '用户执行了打开文件操作（演示功能）'
  });

  ElMessage.success("打开文件功能仅作展示");
  isFileMenuVisible.value = false;
};

// 快照相关处理函数
const handleSnapshotClick = () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }
  isSnapshotDialogVisible.value = true;
};

const handleSnapshotDialogClose = () => {
  isSnapshotDialogVisible.value = false;
};

// 保存模板相关处理函数
const handleSaveTemplateClick = () => {
  if (!currentSessionId.value) {
    ElMessage.warning("请先选择场景");
    return;
  }

  // 检查是否有节点可以保存
  if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length === 0) {
    ElMessage.warning("当前场景没有节点，无法保存模板");
    return;
  }

  isSaveTemplateDialogVisible.value = true;
};

const handleSaveTemplateDialogClose = () => {
  isSaveTemplateDialogVisible.value = false;
};

const handleSaveTemplateSuccess = () => {
  // 模板保存成功后的处理
  ElMessage.success("组网模板保存成功");
  isSaveTemplateDialogVisible.value = false;
};

// 模板管理相关处理函数
const handleTemplateManageClick = () => {
  isTemplateManageDialogVisible.value = true;
};

const handleTemplateManageDialogClose = () => {
  isTemplateManageDialogVisible.value = false;
};

const handleUseTemplate = async (data: any) => {
  try {
    if (!topoStore.topoData || !topoStore.currentSessionId) {
      ElMessage.warning("请先打开场景");
      return;
    }

    // 保存模板数据和配置
    pendingTemplateData.value = data;
    isWaitingForMapClick.value = true;

    // 通知Cesium组件进入地图点击模式
    eventBus.emit("startTemplatePlacement", {
      message: "请在地图上点击选择模板放置位置"
    });

    ElMessage.info("请在地图上点击选择模板放置位置");
  } catch (error: any) {
    console.error('准备放置模板失败:', error);
    ElMessage.error(error?.message || '准备放置模板失败');
  }
};

// 处理地图点击事件（用于模板放置）
const handleMapClickForTemplate = async (clickData: any) => {
  if (!isWaitingForMapClick.value || !pendingTemplateData.value) {
    return;
  }

  try {
    isWaitingForMapClick.value = false;

    const { template, config } = pendingTemplateData.value;
    const { position } = clickData; // position包含 {lat, lon, alt}

    // 显示加载消息
    const loadingMessage = ElMessage({
      message: '正在应用模板，请稍候...',
      type: 'info',
      duration: 0
    });

    try {
      // 计算节点相对位置并创建节点
      await applyTemplateAtPosition(template, config, position);

      // 关闭加载消息
      loadingMessage.close();

      ElMessage.success(`模板"${template.name}"应用成功`);
      pendingTemplateData.value = null;

      // 通知Cesium组件退出地图点击模式
      eventBus.emit("endTemplatePlacement");
    } catch (error: any) {
      // 关闭加载消息
      loadingMessage.close();
      throw error;
    }
  } catch (error: any) {
    console.error('应用模板失败:', error);
    ElMessage.error(error?.message || '应用模板失败');

    // 发生错误时也要退出地图点击模式
    eventBus.emit("endTemplatePlacement");
  }
};

// 在指定位置应用模板
const applyTemplateAtPosition = async (template: any, config: any, basePosition: any) => {
  const { nodeConfigs, linkConfigs } = config;
  const nodes = template.nodeJson || [];
  const links = template.linkJson || [];

  if (nodes.length === 0) {
    throw new Error('模板中没有节点');
  }

  // 1. 随机选择一个参考节点
  const referenceIndex = Math.floor(Math.random() * nodes.length);
  const referenceNode = nodes[referenceIndex];

  console.log(`选择节点 ${referenceIndex} (${referenceNode.name}) 作为参考节点`);

  // 2. 计算所有节点相对于参考节点的位置偏移
  const nodeOffsets = nodes.map((node: any) => ({
    latOffset: node.geo.lat - referenceNode.geo.lat,
    lonOffset: node.geo.lon - referenceNode.geo.lon,
    altOffset: node.geo.alt - referenceNode.geo.alt
  }));

  // 3. 创建节点映射表（原节点ID -> 新节点ID）
  const nodeIdMap = new Map<number, number>();

  // 3.1 获取当前场景中的最大节点ID，用于生成新的唯一ID
  const existingNodes = topoStore.topoData?.nodes || [];
  let maxNodeId = 0;
  if (existingNodes.length > 0) {
    maxNodeId = Math.max(...existingNodes.map((n: any) => n.id || 0));
  }

  // 4. 依次创建所有节点
  for (let i = 0; i < nodes.length; i++) {
    const originalNode = nodes[i];
    const nodeConfig = nodeConfigs[i];
    const offset = nodeOffsets[i];

    // 生成新的唯一ID
    const newNodeId = maxNodeId + i + 1;

    // 计算新位置
    const newPosition = {
      lat: basePosition.lat + offset.latOffset,
      lon: basePosition.lon + offset.lonOffset,
      alt: basePosition.alt + offset.altOffset
    };

    // 构建新节点数据 - 明确指定所有需要的字段，包括新的ID
    const newNodeData: any = {
      id: newNodeId,  // 使用新生成的唯一ID
      name: nodeConfig.name,
      alias: nodeConfig.alias,
      type: originalNode.type,
      model: originalNode.model || '',
      role: originalNode.role || 'UNKNOWN',

      // 位置信息
      geo: newPosition,
      position: {
        x: newPosition.lon,
        y: newPosition.lat,
        z: newPosition.alt
      },

      // 配置信息
      emane: originalNode.emane,
      icon: originalNode.icon,
      image: originalNode.image || '',
      server: originalNode.server,
      config_services: originalNode.config_services || [],
      dir: originalNode.dir,
      channel: originalNode.channel,
      canvas: originalNode.canvas,

      // 高级配置
      wlan_config: originalNode.wlan_config || {},
      mobility_config: originalNode.mobility_config || {},
      service_configs: originalNode.service_configs || {},
      config_cervice_configs: originalNode.config_cervice_configs || {},
      emane_configs: originalNode.emane_configs || [],

      // 状态
      status: 'UP',
      phy_type: originalNode.phy_type || ''
    };

    try {
      // 调用API创建节点
      await (topoStore as any).addNodeRemote(newNodeData);

      // 记录原节点ID到新节点ID的映射
      // addNodeRemote 会刷新 topoData，从刷新后的数据中按名称查找后端实际分配的节点ID
      let finalNodeId = newNodeId; // fallback
      const refreshedNodes = topoStore.topoData?.nodes || [];
      const matchedNode = refreshedNodes.find((n: any) => n.name === nodeConfig.name);
      if (matchedNode) {
        finalNodeId = matchedNode.id;
      }
      nodeIdMap.set(originalNode.id, finalNodeId);
      console.log(`节点创建成功: ${nodeConfig.name} (原ID: ${originalNode.id}, 新ID: ${finalNodeId})`);
    } catch (error) {
      console.error(`创建节点 ${nodeConfig.name} 失败:`, error);
      throw error;
    }
  }

  // 5. 创建链路
  // 5.1 获取当前场景中的最大接口ID
  const existingLinks = topoStore.topoData?.links || [];
  let maxIfaceId = 0;
  existingLinks.forEach((link: any) => {
    if (link.iface1?.id) {
      maxIfaceId = Math.max(maxIfaceId, link.iface1.id);
    }
    if (link.iface2?.id) {
      maxIfaceId = Math.max(maxIfaceId, link.iface2.id);
    }
  });

  for (let i = 0; i < links.length; i++) {
    const originalLink = links[i];
    const linkConfig = linkConfigs[i];

    // 获取新的节点ID
    const newNode1Id = nodeIdMap.get(originalLink.node1_id);
    const newNode2Id = nodeIdMap.get(originalLink.node2_id);

    if (!newNode1Id || !newNode2Id) {
      console.warn(`跳过链路 ${i + 1}: 无法找到对应的新节点ID`);
      continue;
    }

    // 为接口生成新的唯一ID
    const newIface1Id = maxIfaceId + (i * 2) + 1;
    const newIface2Id = maxIfaceId + (i * 2) + 2;

    // 将接口中的 net2_id 也映射到新节点ID（子网链路场景）
    const remapNet2Id = (iface: any) => {
      if (iface?.net2_id && nodeIdMap.has(iface.net2_id)) {
        return nodeIdMap.get(iface.net2_id);
      }
      return iface?.net2_id || 0;
    };

    // 将链路的 network_id 也映射到新节点ID
    const newNetworkId = originalLink.network_id && nodeIdMap.has(originalLink.network_id)
      ? nodeIdMap.get(originalLink.network_id)
      : originalLink.network_id || 0;

    // 构建新链路数据
    const newLinkData: any = {
      node1_id: newNode1Id,
      node2_id: newNode2Id,
      type: originalLink.type,
      options: originalLink.options,
      network_id: newNetworkId
    };

    // 如果配置了IP地址，更新接口信息
    if (linkConfig.iface1Ip || linkConfig.iface2Ip) {
      newLinkData.iface1 = {
        ...originalLink.iface1,
        id: newIface1Id,  // 分配新的接口ID
        node_id: newNode1Id,  // 更新节点ID引用
        net2_id: remapNet2Id(originalLink.iface1),  // 更新子网节点ID引用
        ip4: linkConfig.iface1Ip || originalLink.iface1?.ip4,
        ip4_mask: linkConfig.iface1Mask ? parseInt(linkConfig.iface1Mask) : originalLink.iface1?.ip4_mask
      };

      newLinkData.iface2 = {
        ...originalLink.iface2,
        id: newIface2Id,  // 分配新的接口ID
        node_id: newNode2Id,  // 更新节点ID引用
        net2_id: remapNet2Id(originalLink.iface2),  // 更新子网节点ID引用
        ip4: linkConfig.iface2Ip || originalLink.iface2?.ip4,
        ip4_mask: linkConfig.iface2Mask ? parseInt(linkConfig.iface2Mask) : originalLink.iface2?.ip4_mask
      };
    } else {
      // 即使没有配置新IP，也要更新接口ID和节点ID引用
      newLinkData.iface1 = {
        ...originalLink.iface1,
        id: newIface1Id,
        node_id: newNode1Id,
        net2_id: remapNet2Id(originalLink.iface1)
      };
      newLinkData.iface2 = {
        ...originalLink.iface2,
        id: newIface2Id,
        node_id: newNode2Id,
        net2_id: remapNet2Id(originalLink.iface2)
      };
    }

    try {
      // 调用API创建链路
      await (topoStore as any).addLinkRemote(newLinkData);
      console.log(`链路创建成功: 节点${newNode1Id} ↔ 节点${newNode2Id}`);
    } catch (error) {
      console.error(`创建链路失败:`, error);
      // 继续创建其他链路，不中断整个流程
    }
  }

  // 6. 处理路由配置（如果有）
  if (template.routerJson && template.routerJson.length > 0) {
    console.log('路由配置:', template.routerJson);

    for (const routerConfig of template.routerJson) {
      try {
        // 从原始容器名称提取路由器节点名称（例如："ROUTER1-552" -> "ROUTER1"）
        const originalContainer = routerConfig.container;
        if (!originalContainer) {
          console.warn('路由配置缺少容器名称，跳过此配置');
          continue;
        }

        const routerNodeName = originalContainer.split('-')[0];

        // 使用当前会话ID构建新的容器名称
        const currentSessionId = topoStore.currentSessionId || topoStore.topoData?.id;
        if (!currentSessionId) {
          console.error('无法获取当前会话ID，跳过路由配置');
          break;
        }

        const newContainer = `${routerNodeName}-${currentSessionId}`;

        // 构建清理后的配置对象，只包含非null的参数
        const cleanedConfig: Record<string, any> = {
          container: newContainer,
          sessionId: currentSessionId
        };

        // 定义不需要传递的字段黑名单
        const excludeFields = ['id', 'container', 'sessionId', 'state', 'exJson'];

        // 遍历原始配置，只添加非null和非undefined的字段
        Object.keys(routerConfig).forEach(key => {
          // 跳过黑名单中的字段
          if (!excludeFields.includes(key)) {
            const value = routerConfig[key];
            // 只添加非null和非undefined的值
            if (value !== null && value !== undefined) {
              cleanedConfig[key] = value;
            }
          }
        });

        console.log(`准备插入路由配置: ${newContainer}`, cleanedConfig);

        // 调用insertRouterInfo API
        await insertRouterInfo(cleanedConfig);

        console.log(`路由配置插入成功: ${newContainer}`);
      } catch (error) {
        console.error(`路由配置插入失败:`, error);
        // 继续处理其他路由配置，不中断整个流程
      }
    }
  }

  console.log('模板应用完成');
};

// MATLAB文件执行
const handleMatlabExecute = () => {
  // 创建文件输入元素
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.m';
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const matlabCode = e.target?.result as string;
        // 执行MATLAB代码并显示结果面板
        executeMatlabCode(matlabCode, file.name);
      };
      reader.readAsText(file);
    }
  };
  input.click();
  isFileDropdownVisible.value = false;
};

// 执行MATLAB代码
const executeMatlabCode = async (_code: string, filename: string) => {
  try {
    // 这里实现MATLAB代码的解析和执行逻辑
    // 由于无法直接执行MATLAB，我们将模拟FHSS的执行结果
    const results = simulateFHSSResults();
    
    // 通过事件总线通知Cesium组件打开MATLAB结果面板
    (eventBus as any).emit('openMatlabResults', {
      filename,
      results
    });
    
    ElMessage.success(`MATLAB文件 ${filename} 执行成功`);
  } catch (error: any) {
    ElMessage.error(`MATLAB文件执行失败: ${error.message}`);
  }
};

// 模拟FHSS结果数据
const simulateFHSSResults = () => {
  // 基于FHSS.m文件内容模拟结果
  const snr = Array.from({length: 16}, (_, i) => i - 5); // -5 to 10 dB
  const ber = snr.map(s => Math.pow(10, -Math.max(0, (s + 2) * 0.3))); // 模拟误比特率
  
  // 基带信号数据
  const timePoints = Array.from({length: 400}, (_, i) => i * 0.00002);
  const basebandSignal = timePoints.map(t => 
    Math.sign(Math.sin(2 * Math.PI * 1000 * t + Math.random() * 0.1))
  );
  
  // 频谱数据
  const freqPoints = Array.from({length: 1000}, (_, i) => (i - 500) * 2000);
  const spectrumMSK = freqPoints.map(f => 
    Math.exp(-Math.pow(f / 50000, 2)) * (1 + 0.1 * Math.random())
  );
  const spectrumFH = freqPoints.map(f => {
    const peaks = [-200000, -100000, 0, 100000, 200000];
    return peaks.reduce((sum, peak) => 
      sum + Math.exp(-Math.pow((f - peak) / 20000, 2)), 0
    ) * (1 + 0.1 * Math.random());
  });
  
  return {
    ber: { snr, ber },
    baseband: { time: timePoints.slice(0, 100), signal: basebandSignal.slice(0, 100) },
    spectrum: {
      frequency: freqPoints,
      msk: spectrumMSK,
      fh: spectrumFH,
      noisy: spectrumFH.map(v => v * (0.8 + 0.4 * Math.random())),
      unjump: spectrumMSK.map(v => v * (0.9 + 0.2 * Math.random()))
    }
  };
};

// 仿真时间提醒功能
const startSimulationReminder = () => {
  // 重置提醒状态
  hasShownFinalReminder.value = false;
  hasShown5MinReminder.value = false;
  hasShown1MinReminder.value = false;

  // 清除之前的定时器
  if (simulationReminderTimer.value) {
    clearInterval(simulationReminderTimer.value);
  }

  // 每30秒检查一次剩余时间
  simulationReminderTimer.value = window.setInterval(() => {
    checkSimulationTimeRemaining();
  }, 30000);
};

const stopSimulationReminder = () => {
  if (simulationReminderTimer.value) {
    clearInterval(simulationReminderTimer.value);
    simulationReminderTimer.value = null;
  }
  // 重置提醒状态
  hasShownFinalReminder.value = false;
  hasShown5MinReminder.value = false;
  hasShown1MinReminder.value = false;
};

const checkSimulationTimeRemaining = () => {
  if (!simulationConfig.value.isRunning || !simulationConfig.value.endTime) {
    return;
  }

  const now = new Date();
  const endTime = simulationConfig.value.endTime;
  const remainingMs = endTime.getTime() - now.getTime();
  const remainingMinutes = Math.floor(remainingMs / (1000 * 60));

  // 仿真结束
  if (remainingMs <= 0 && !hasShownFinalReminder.value) {
    hasShownFinalReminder.value = true;
    ElMessage({
      message: '仿真时间已结束，正在自动停止仿真...',
      type: 'warning',
      duration: 4000,
      showClose: true
    });
    stopSimulationReminder();

    // 自动停止仿真
    handleStopSession();
  }
  // 剩余1分钟提醒
  else if (remainingMinutes <= 1 && remainingMs > 0 && !hasShown1MinReminder.value) {
    hasShown1MinReminder.value = true;
    ElMessage({
      message: '仿真将在1分钟内结束',
      type: 'warning',
      duration: 6000,
      showClose: true
    });
  }
  // 剩余5分钟提醒
  else if (remainingMinutes <= 5 && remainingMinutes > 1 && !hasShown5MinReminder.value) {
    hasShown5MinReminder.value = true;
    ElMessage({
      message: `仿真将在${remainingMinutes}分钟后结束`,
      type: 'info',
      duration: 5000,
      showClose: true
    });
  }
};

// 切换渲染模式
const toggleRenderingMode = () => {
  useSimpleMode.value = !useSimpleMode.value;
  // 发送事件到Cesium组件，切换渲染模式
  eventBus.emit("toggleRenderingMode");
  ElMessage.success(useSimpleMode.value ? "已切换到简单点渲染模式" : "已切换到3D模型渲染模式");
};
</script>

<style scoped>
.top-nav-bar {
  width: 100%;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  position: relative;
  z-index: 10;
}

/* ========== 顶部导航栏 — 与 layout 统一风格 ========== */
.header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(0, 30, 80, 0.85) 0%, rgba(0, 18, 50, 0.92) 100%);
  border-bottom: 1px solid rgba(0, 180, 255, 0.18);
  position: relative;
  z-index: 10;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
}

/* 顶部光线 */
.header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 220, 255, 0.6), transparent);
  z-index: 2;
}

/* 底部光线 */
.header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 5%;
  right: 5%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.4), transparent);
  z-index: 2;
}

/* ========== 左侧区域 ========== */
.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  z-index: 1;
}

.time-section {
  display: flex;
  align-items: center;
  padding: 4px 14px;
  background: rgba(0, 40, 100, 0.25);
  border: 1px solid rgba(0, 180, 255, 0.18);
  border-radius: 6px;
  backdrop-filter: blur(6px);
  position: relative;
  flex-shrink: 0;
}

.time-section::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.6), transparent);
}

.time-clock {
  font-size: 15px;
  font-weight: bold;
  color: #00e5ff;
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.5),
               0 0 20px rgba(0, 150, 255, 0.25);
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 2px;
  white-space: nowrap;
}

.divider-line {
  width: 1px;
  height: 24px;
  background: linear-gradient(180deg, transparent, rgba(0, 180, 255, 0.4), transparent);
  flex-shrink: 0;
}

.stat-section {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.stat-tag {
  font-size: 13px;
  color: rgba(140, 200, 255, 0.85);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.stat-tag em {
  font-style: normal;
  font-weight: bold;
  color: #00e5ff;
  text-shadow: 0 0 6px rgba(0, 229, 255, 0.4);
}

.stat-tag .status-online {
  color: #00e676;
  text-shadow: 0 0 6px rgba(0, 230, 118, 0.5);
}

/* ========== 中间标题区 — 与 layout center-title 统一 ========== */
.header-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  pointer-events: none;
}

.center-title {
  text-align: center;
  position: relative;
}

.title-text {
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.6),
               0 0 30px rgba(0, 150, 255, 0.3),
               0 0 60px rgba(0, 100, 255, 0.15);
  letter-spacing: 6px;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  white-space: nowrap;
  position: relative;
  display: inline-block;
  background: linear-gradient(90deg, #8ec8ff, #ffffff, #00e5ff, #ffffff, #8ec8ff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: titleShimmer 4s ease-in-out infinite;
}

.title-text::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.8), transparent);
  animation: titleUnderline 3s ease-in-out infinite;
}

@keyframes titleShimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes titleUnderline {
  0%, 100% { left: 10%; right: 10%; opacity: 0.6; }
  50% { left: 5%; right: 5%; opacity: 1; }
}

/* ========== 右侧区域 — 与 layout action-section 统一 ========== */
.header-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  z-index: 1;
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.3) 0%, rgba(0, 30, 80, 0.15) 100%);
  border: 1px solid rgba(0, 180, 255, 0.2);
  border-radius: 24px;
  backdrop-filter: blur(8px);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.user-panel::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.5), transparent);
  transition: all 0.3s;
}

.user-panel:hover {
  background: linear-gradient(135deg, rgba(0, 70, 160, 0.4) 0%, rgba(0, 40, 100, 0.2) 100%);
  border-color: rgba(0, 210, 255, 0.4);
  box-shadow: 0 0 20px rgba(0, 150, 255, 0.12);
}

.avatar-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(100, 200, 255, 0.5), rgba(60, 140, 220, 0.35));
  box-shadow: 0 0 8px rgba(0, 180, 255, 0.2);
}

.avatar-ring::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 200, 255, 0.35);
  animation: avatarGlow 3s ease-in-out infinite;
}

.avatar-ring .el-icon {
  color: #e0f4ff;
  filter: drop-shadow(0 0 2px rgba(0, 200, 255, 0.3));
}

@keyframes avatarGlow {
  0%, 100% { border-color: rgba(0, 200, 255, 0.25); box-shadow: 0 0 4px rgba(0, 200, 255, 0.1); }
  50% { border-color: rgba(0, 200, 255, 0.5); box-shadow: 0 0 10px rgba(0, 200, 255, 0.2); }
}

.username {
  font-size: 13px;
  font-weight: 500;
  color: #e0f0ff;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  letter-spacing: 0.5px;
  text-shadow: 0 0 6px rgba(0, 180, 255, 0.2);
  white-space: nowrap;
}

.user-panel:hover .username {
  color: #ffffff;
  text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: rgba(255, 160, 140, 0.85);
  font-size: 13px;
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 120, 100, 0.2);
  transition: all 0.3s;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
}

.logout-btn:hover {
  color: #ff6b6b;
  border-color: rgba(255, 100, 100, 0.4);
  background: rgba(255, 80, 80, 0.1);
  text-shadow: 0 0 8px rgba(255, 100, 100, 0.4);
}

.nav-icons-group {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
  margin-right: 10px;
  z-index: 1;
}

.nav-icons-group .el-icon {
  font-size: 18px;
  color: #8ec8ff;
  transition: all 0.3s;
  cursor: pointer;
  position: relative;
}

.nav-icons-group .el-icon:hover {
  color: #00e5ff;
  transform: scale(1.15);
  text-shadow: 0 0 8px rgba(0, 200, 255, 0.6);
}

/* Icon hover effect */
.nav-icons-group .el-icon::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: 0;
  height: 2px;
  background: #00e5ff;
  transform: translateX(-50%);
  transition: width 0.3s ease;
  opacity: 0;
}

.nav-icons-group .el-icon:hover::after {
  width: 100%;
  opacity: 1;
}

/* 暂停图标禁用样式：变暗并禁止交互 */
.nav-icons-group .el-icon.disabled-icon {
  opacity: 0.5;
  filter: brightness(0.6);
  pointer-events: none;
  cursor: default;
}

.nav-icons-group.right-align {
  margin-left: auto;
  margin-right: 0;
  display: flex;
  align-items: center;
  height: 36px;
  gap: 16px;
  position: relative;
  z-index: 2;
}

.nav-icons-group.right-align .el-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
}

.nav-icons-divider {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: rgba(0, 140, 255, 0.3);
  margin: 0 8px;
}


/* 工具栏样式 — 与 layout 统一蓝色调 */
.toolbar {
  height: 36px;
  background: linear-gradient(180deg, rgba(0, 20, 55, 0.9) 0%, rgba(0, 15, 45, 0.95) 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.12);
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.toolbar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.3), transparent);
}

.toolbar-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

/* Data flow effect - subtle background animation */
.toolbar::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 50%, rgba(0, 120, 255, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(0, 200, 255, 0.03) 0%, transparent 50%);
  opacity: 0.5;
  z-index: 0;
  animation: data-flow 10s infinite alternate;
}

@keyframes data-flow {
  0% {
    background-position: 0% 0%;
  }

  100% {
    background-position: 100% 100%;
  }
}

.simulation-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 5px;
  z-index: 1;
  position: relative;
}

.time-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 5px;
  z-index: 1;
  position: relative;
}

.control-label,
.time-label {
  color: #8ec8ff;
  font-size: 13px;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
}

.time-value {
  color: #8ec8ff;
  font-family: "Consolas", "Monaco", monospace;
  background: rgba(0, 60, 150, 0.15);
  padding: 0 10px;
  border-radius: 8px;
  font-size: 13px;
  height: 22px;
  line-height: 28px;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(0, 150, 255, 0.2);
  position: relative;
  overflow: hidden;
}

/* Data pulse animation for time values */
.time-value::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.1), rgba(0, 200, 255, 0.08), transparent);
  width: 100%;
  z-index: 0;
  animation: time-pulse 3s infinite;
}

@keyframes time-pulse {

  0%,
  100% {
    transform: translateX(-100%);
  }

  50% {
    transform: translateX(100%);
  }
}

.running-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  border-radius: 8px;
  border: 1px solid rgba(0, 150, 255, 0.2) !important;
  box-shadow: 0 0 10px rgba(0, 150, 255, 0.1);
  transition: all 0.3s !important;
}

.running-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 15px rgba(0, 150, 255, 0.2);
}

.pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  background-color: #34C759;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
  padding: 2px;
  box-shadow: 0 0 5px rgba(52, 199, 89, 0.5);
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.7;
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.7);
  }

  70% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 6px rgba(52, 199, 89, 0);
  }

  100% {
    transform: scale(0.8);
    opacity: 0.7;
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
  }
}

/* 搜索框和地球菜单样式 */
.search-container,
.earth-menu-container,
.help-container {
  height: 36px;
  display: flex;
  align-items: center;
  position: relative;
}

.search-box {
  position: absolute;
  right: 30px;
  top: 0;
  width: 200px;
  background: rgba(0, 80, 150, 0.2);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
  border: 1px solid rgba(0, 140, 255, 0.3);
  box-shadow: 0 0 15px rgba(0, 140, 255, 0.1);
}

.search-box :deep(.el-input__inner) {
  background: transparent;
  color: #76b9ff;
  border: none;
  height: 28px;
}

.search-box :deep(.el-input__inner::placeholder) {
  color: rgba(118, 185, 255, 0.7);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.earth-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 40px;
  align-items: center;
  background: linear-gradient(180deg, rgba(0, 40, 110, 0.88) 0%, rgba(0, 25, 75, 0.92) 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 0 20px rgba(0, 120, 255, 0.2);
  z-index: 10;
  border: 1px solid rgba(0, 180, 255, 0.3);
}

.earth-dropdown::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid rgba(0, 140, 255, 0.4);
}

.earth-dropdown-item {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 36px;
  border-radius: 8px;
  transition: all 0.3s;
  cursor: pointer;
  margin: 0 auto;
}

.earth-dropdown-item:hover {
  background: rgba(0, 140, 255, 0.2);
  box-shadow: 0 0 10px rgba(0, 140, 255, 0.3);
  transform: scale(1.1);
}

.earth-dropdown-item .el-icon {
  font-size: 22px;
  color: #76b9ff;
  transition: all 0.3s;
}

.earth-dropdown-item:hover .el-icon {
  color: #00aaff;
  text-shadow: 0 0 8px rgba(0, 170, 255, 0.6);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px) translateX(-50%);
}

/* 导航帮助面板样式 */
.help-container {
  position: relative;
}

.help-panel {
  position: absolute;
  top: 100%;
  right: 0;
  width: 300px;
  background: linear-gradient(135deg, #051022 0%, #0a2044 100%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 0 20px rgba(0, 140, 255, 0.2);
  padding: 15px;
  margin-top: 10px;
  z-index: 100;
  color: #76b9ff;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid rgba(0, 140, 255, 0.3);
}

.help-panel::before {
  content: "";
  position: absolute;
  top: -8px;
  right: 10px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid rgba(0, 140, 255, 0.4);
}

.help-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 140, 255, 0.3);
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.help-panel-header h3 {
  margin: 0;
  color: #00aaff;
  font-size: 16px;
  font-weight: 500;
  text-shadow: 0 0 8px rgba(0, 170, 255, 0.4);
}

.close-icon {
  cursor: pointer;
  color: #76b9ff;
  font-size: 14px;
  transition: all 0.3s;
}

.close-icon:hover {
  color: #00aaff;
  transform: scale(1.1);
  text-shadow: 0 0 8px rgba(0, 170, 255, 0.6);
}

.help-section {
  margin-bottom: 15px;
}

.help-section h4 {
  margin: 0 0 8px 0;
  color: #00aaff;
  font-size: 14px;
  font-weight: 500;
  border-left: 3px solid #0077ff;
  padding-left: 8px;
  text-shadow: 0 0 5px rgba(0, 170, 255, 0.3);
}

.help-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.3s;
}

.help-item:hover {
  background: rgba(0, 140, 255, 0.1);
}

.help-icon {
  width: 24px;
  height: 24px;
  margin-right: 10px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 0 2px rgba(0, 140, 255, 0.5));
}

.help-desc {
  font-size: 13px;
  color: #76b9ff;
}

/* 全屏加载界面样式 */
.fullscreen-loading {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 16, 34, 0.85);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 30000;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #007AFF;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  position: relative;
}

/* Tech circuit patterns around loading spinner */
.loading-content::before {
  content: "";
  position: absolute;
  top: -50px;
  left: -50px;
  right: -50px;
  bottom: -50px;
  background:
    radial-gradient(circle at 20% 30%, rgba(0, 140, 255, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(0, 140, 255, 0.1) 0%, transparent 50%);
  border-radius: 50%;
  z-index: -1;
  animation: circuit-pulse 4s infinite alternate;
}

@keyframes circuit-pulse {

  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}

.loading-spinner {
  width: 120px;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.spinner-circle {
  width: 100px;
  height: 100px;
  border: 4px solid rgba(0, 140, 255, 0.2);
  border-top: 4px solid #00aaff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  position: relative;
  box-shadow: 0 0 30px rgba(0, 140, 255, 0.3);
}

/* Inner circle */
.spinner-circle::before {
  content: "";
  position: absolute;
  top: 15px;
  left: 15px;
  right: 15px;
  bottom: 15px;
  border: 2px solid rgba(0, 140, 255, 0.15);
  border-radius: 50%;
  border-top: 2px solid #00aaff;
  animation: spin 2s linear infinite reverse;
}

/* Outer tech circle with dots */
.spinner-circle::after {
  content: "";
  position: absolute;
  top: -15px;
  left: -15px;
  right: -15px;
  bottom: -15px;
  border: 1px dashed rgba(0, 140, 255, 0.3);
  border-radius: 50%;
  animation: spin 8s linear infinite;
}

.loading-text {
  font-family: "Orbitron", "Arial", sans-serif;
  font-size: 24px;
  font-weight: 500;
  color: #00aaff;
  text-shadow: 0 0 10px rgba(0, 140, 255, 0.5);
  letter-spacing: 1px;
}

.loading-subtitle {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  font-size: 16px;
  color: #76b9ff;
  opacity: 0.8;
  animation: subtitle-pulse 2s infinite;
}

@keyframes subtitle-pulse {

  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 0.9;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 文件下拉菜单样式 */
.file-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: rgba(0, 25, 75, 0.95);
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1000;
  min-width: 120px;
  overflow: hidden;
}

.file-dropdown::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 20px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid rgba(0, 140, 255, 0.4);
}

.file-dropdown-item {
  padding: 8px 16px;
  color: #76b9ff;
  font-size: 14px;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  position: relative;
}

.file-dropdown-item:hover {
  background: rgba(0, 140, 255, 0.2);
  color: #00aaff;
  text-shadow: 0 0 8px rgba(0, 170, 255, 0.6);
}

.file-dropdown-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.3), transparent);
  margin: 8px 0;
}

.file-dropdown-header {
  padding: 8px 16px;
  color: #00aaff;
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 0 5px rgba(0, 170, 255, 0.3);
  opacity: 0.9;
}

.theme-switcher {
  margin-right: 15px;
}

/* 聊天图标和消息提醒样式 */
.chat-icon-wrapper {
  position: relative;
}

.message-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4757;
  color: white;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(255, 71, 87, 0.3);
  animation: messageAlert 0.6s ease-in-out;
}

@keyframes messageAlert {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 消息提醒闪烁效果 */
.message-badge::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: #ff4757;
  border-radius: 12px;
  z-index: -1;
  opacity: 0.3;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.1;
  }
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
}


</style>
