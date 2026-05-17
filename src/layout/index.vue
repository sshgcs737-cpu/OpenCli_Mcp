<template>
  <div class="layout-container">
    <!-- 告警提醒组件 -->
    <AlertNotification />
    
    <!-- 顶部导航栏 -->
    <div class="top-header">
      <!-- 北京时间 -->
      <div class="time-section">
        <div class="time-date">{{ currentDate }}</div>
        <div class="time-clock">{{ currentClock }}</div>
      </div>

      <!-- 中间导航区：左导航 + 标题 + 右导航 -->
      <div class="header-nav">
        <div class="nav-group">
          <el-dropdown trigger="hover" popper-class="dark-nav-dropdown"
            @command="(cmd: string) => handleNavCommand('/simu/view', cmd)">
            <button class="nav-btn" :class="{ active: $route.path === '/simu/view' }"
              @click="handleMenuClick('/simu/view')">
              <el-icon><Monitor /></el-icon>
              <span>仿真场景编辑</span>
              <el-icon class="btn-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="1-1">私有场景</el-dropdown-item>
                <el-dropdown-item command="1-2">公有场景</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <button class="nav-btn" :class="{ active: $route.path === '/simu/signal' }"
            @click="handleMenuClick('/simu/signal')">
            <el-icon><Histogram /></el-icon>
            <span>信号级仿真</span>
          </button>

                    <el-dropdown trigger="hover" popper-class="dark-nav-dropdown"
            @command="(cmd: string) => handleNavCommand('/simu/simulation', cmd)">
            <button class="nav-btn" :class="{ active: $route.path === '/simu/simulation' }"
              @click="handleMenuClick('/simu/simulation')">
              <el-icon><DataAnalysis /></el-icon>
              <span>测试工具</span>
              <el-icon class="btn-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="1-1">链路测量</el-dropdown-item>
                <el-dropdown-item command="1-2">节点测量</el-dropdown-item>
                <el-dropdown-item command="2-1" divided>链路测量结果</el-dropdown-item>
                <el-dropdown-item command="2-2">节点测量结果</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="center-title">
          <span class="title-text">机动网络环境仿真系统V2.0</span>
        </div>

        <div class="nav-group">

          <el-dropdown trigger="hover" popper-class="dark-nav-dropdown"
            @command="(cmd: string) => handleNavCommand('/simu/srclibrary', cmd)">
            <button class="nav-btn" :class="{ active: $route.path === '/simu/srclibrary' }"
              @click="handleMenuClick('/simu/srclibrary')">
              <el-icon><Collection /></el-icon>
              <span>资源库管理</span>
              <el-icon class="btn-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="1-1">典型装备库</el-dropdown-item>
                <el-dropdown-item command="1-2">协议库</el-dropdown-item>
                <el-dropdown-item command="1-3">链路库</el-dropdown-item>
                <el-dropdown-item command="1-4">无线模型库</el-dropdown-item>
                <el-dropdown-item command="1-5">目标库</el-dropdown-item>
                <el-dropdown-item command="1-6" divided>工具库</el-dropdown-item>
                <el-dropdown-item command="1-7">场景库</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-dropdown trigger="hover" popper-class="dark-nav-dropdown"
            @command="(cmd: string) => handleNavCommand('/simu/system', cmd)">
            <button class="nav-btn" :class="{ active: $route.path === '/simu/system' }"
              @click="handleSystemMenuClick">
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
              <el-icon class="btn-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="isAdmin" command="1-1">用户管理</el-dropdown-item>
                <el-dropdown-item command="1-2">系统日志</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 右侧操作区 -->
      <div class="action-section">
        <button class="action-btn earth-btn" :class="{ 'earth-btn-highlight': earthHighlight }" @click="enterEarthView">
          <span class="action-btn-icon">
            <el-icon><View /></el-icon>
          </span>
          <span class="action-btn-label">态势展示</span>
          <span class="action-btn-pulse"></span>
        </button>

        <div class="divider-line"></div>

        <div class="user-panel" :class="{ 'user-panel-normal': !userInfo.hasRole || userInfo.mode === 'normal' }">
            <div class="avatar-ring">
              <!-- 普通模式：UserFilled 图标 -->
              <template v-if="!userInfo.hasRole || userInfo.mode === 'normal'">
                <div class="avatar-icon normal-avatar-icon">
                  <el-icon :size="18"><UserFilled /></el-icon>
                </div>
              </template>
              <!-- 攻防模式：彩色头像 -->
              <template v-else>
                <el-avatar :size="30"
                  :style="{ backgroundColor: userInfo.bgColor }" />
              </template>
            </div>
            <div class="user-detail">
              <span class="username"
                :style="userInfo.mode === 'attack-defense' && userInfo.hasRole && userInfo.role !== 'white'
                  ? { color: userInfo.color }
                  : {}">
                {{ userInfo.mode === 'attack-defense' && userInfo.hasRole && userInfo.name
                  ? `${userInfo.name}(${userInfo.username})`
                  : (userInfo.username || '未登录') }}
              </span>
            </div>
          </div>

          <div class="divider-line"></div>

          <div class="logout-btn" @click="handleLogout" title="注销">
            <el-icon :size="18"><SwitchButton /></el-icon>
            <span>注销</span>
          </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted, onUnmounted, ref, computed } from 'vue';
import {
  Monitor,
  DataAnalysis,
  Setting,
  SwitchButton,
  ArrowDown,
  View,
  Histogram,
  Collection,
  UserFilled
} from '@element-plus/icons-vue';
import { getUserInfo, clearUserInfo } from '../store/user';
import { useThemeStore } from '../store/modules/theme';
import AlertNotification from '../components/AlertNotification.vue';

interface UserInfo {
  username: string;
  type?: number;
  hasRole?: boolean;
  role?: string;
  name?: string;
  color?: string;
  bgColor?: string;
  mode?: string;
}

const router = useRouter();
const themeStore = useThemeStore();
const userInfo = ref<UserInfo>({
  username: '',
  hasRole: false
});

// 检查当前用户是否为管理员
const isAdmin = computed(() => {
  return userInfo.value && userInfo.value.type === 1;
});

// 北京时间
const currentDate = ref('');
const currentClock = ref('');
let timer: number | null = null;

// 态势展示按钮高亮
const earthHighlight = ref(false);
let highlightTimer: number | null = null;

const onSceneLoaded = () => {
  earthHighlight.value = true;
  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => {
    earthHighlight.value = false;
    highlightTimer = null;
  }, 8000);
};

const updateTime = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const year = beijing.getFullYear();
  const month = (beijing.getMonth() + 1).toString().padStart(2, '0');
  const day = beijing.getDate().toString().padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[beijing.getDay()];
  const h = beijing.getHours().toString().padStart(2, '0');
  const m = beijing.getMinutes().toString().padStart(2, '0');
  const s = beijing.getSeconds().toString().padStart(2, '0');
  currentDate.value = `${year}年${month}月${day}日 ${weekDay}`;
  currentClock.value = `${h}:${m}:${s}`;
};

onMounted(() => {
  updateTime();
  timer = window.setInterval(updateTime, 1000);
  window.addEventListener('scene-loaded', onSceneLoaded);

  const info = getUserInfo();
  if (info && info.username) {
    userInfo.value = {
      username: info.username || '',
      type: info.type || 2,
      hasRole: info.hasRole || false,
      role: info.role || '',
      name: info.name || '',
      color: info.color || '',
      bgColor: info.bgColor || '',
      mode: info.mode || ''
    };
    if (info.hasRole && info.role) {
      themeStore.setThemeByRole(info.role);
    } else {
      themeStore.initTheme();
    }
  } else {
    router.push('/login');
  }
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  window.removeEventListener('scene-loaded', onSceneLoaded);
});

const handleMenuClick = (path: string) => {
  router.push(path);
};

const handleSystemMenuClick = () => {
  // 非admin用户直接跳转到系统日志，admin用户跳转到用户管理
  const tab = isAdmin.value ? '1-1' : '1-2';
  router.push({ path: '/simu/system', query: { tab } });
};

const handleNavCommand = (path: string, tab: string) => {
  router.push({ path, query: { tab } });
};

const handleLogout = () => {
  clearUserInfo();
  router.push('/login');
};

const enterEarthView = () => {
  window.open('/viewer', '_blank');
};
</script>

<!-- 非作用域样式：下拉弹出层（teleport 到 body，scoped 无法覆盖） -->
<style lang="scss">
.dark-nav-dropdown {
  background: linear-gradient(180deg, rgba(0, 40, 110, 0.88) 0%, rgba(0, 25, 75, 0.92) 100%) !important;
  border: 1px solid rgba(0, 180, 255, 0.35) !important;
  border-radius: 8px !important;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 1px rgba(0, 180, 255, 0.6),
    0 0 24px rgba(0, 120, 255, 0.12) !important;
  backdrop-filter: blur(16px);
  overflow: hidden;

  /* 顶部光线 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 220, 255, 0.6), transparent);
    z-index: 1;
  }

  .el-dropdown-menu {
    background-color: transparent !important;
    border: none !important;
    padding: 6px 0 !important;
  }

  .el-dropdown-menu__item {
    color: #c0e4ff !important;
    padding: 10px 24px !important;
    font-size: 14px !important;
    letter-spacing: 1px;
    transition: all 0.25s;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 2px;
      height: 0;
      background: #00e5ff;
      border-radius: 1px;
      transition: height 0.25s;
    }

    &:hover,
    &:focus {
      background: linear-gradient(90deg, rgba(0, 150, 255, 0.25), rgba(0, 100, 255, 0.1)) !important;
      color: #ffffff !important;
      padding-left: 28px !important;
      text-shadow: 0 0 8px rgba(0, 200, 255, 0.4);

      &::before {
        height: 14px;
      }
    }

    &.is-disabled {
      color: #4a6a8a !important;
    }
  }

  .el-dropdown-menu__item--divided {
    border-top-color: rgba(0, 150, 255, 0.18) !important;
    margin-top: 4px;
    padding-top: 14px !important;
  }

  .el-popper__arrow::before {
    background: rgba(0, 40, 110, 0.9) !important;
    border-color: rgba(0, 180, 255, 0.35) !important;
  }
}

/* 全局 Element Plus 弹出层深色主题 */
.el-select__popper {
  background-color: rgba(0, 20, 55, 0.96) !important;
  border: 1px solid rgba(0, 150, 255, 0.25) !important;

  .el-select-dropdown__item {
    color: #8ec8ff !important;

    &:hover,
    &.hover {
      background-color: rgba(0, 100, 255, 0.2) !important;
    }

    &.is-selected {
      color: #00e5ff !important;
    }
  }

  .el-popper__arrow::before {
    background-color: rgba(0, 20, 55, 0.96) !important;
    border-color: rgba(0, 150, 255, 0.25) !important;
  }
}
</style>

<!-- 作用域样式 -->
<style scoped lang="scss">
/* ========== 根容器 + 背景 ========== */
.layout-container {
  width: var(--app-stage-width, 100%);
  height: var(--app-stage-height, 100vh);
  margin: 0;
  padding: 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background-image: url('../assets/image/bg.jpg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-color: #001a3a;

  /* Element Plus CSS 变量覆盖 — 深色主题 */
  --el-bg-color: rgba(0, 20, 60, 0.6);
  --el-bg-color-page: transparent;
  --el-bg-color-overlay: rgba(0, 25, 70, 0.95);
  --el-text-color-primary: #d0e8ff;
  --el-text-color-regular: #a0d4ff;
  --el-text-color-secondary: #6a9fd8;
  --el-text-color-placeholder: rgba(100, 160, 220, 0.5);
  --el-border-color: rgba(0, 150, 255, 0.2);
  --el-border-color-light: rgba(0, 150, 255, 0.15);
  --el-border-color-lighter: rgba(0, 150, 255, 0.1);
  --el-border-color-extra-light: rgba(0, 150, 255, 0.08);
  --el-fill-color: rgba(0, 30, 80, 0.4);
  --el-fill-color-light: rgba(0, 20, 60, 0.3);
  --el-fill-color-lighter: rgba(0, 15, 50, 0.2);
  --el-fill-color-extra-light: rgba(0, 10, 40, 0.15);
  --el-fill-color-blank: rgba(0, 20, 60, 0.5);
  --el-mask-color: rgba(0, 10, 30, 0.7);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: rgba(0, 15, 50, 0.4);
  --el-table-header-bg-color: rgba(0, 35, 90, 0.7);
  --el-table-row-hover-bg-color: rgba(0, 60, 150, 0.25);
  --el-table-border-color: rgba(0, 150, 255, 0.12);
  --el-table-header-text-color: #8ec8ff;
  --el-table-text-color: #a0d4ff;
  --el-table-current-row-bg-color: rgba(0, 80, 180, 0.3);
  --el-card-bg-color: rgba(0, 20, 60, 0.55);
  --el-card-border-color: rgba(0, 150, 255, 0.15);
  --el-dialog-bg-color: rgba(0, 20, 55, 0.96);
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #8ec8ff;
  --el-menu-active-color: #00e5ff;
  --el-menu-hover-bg-color: rgba(0, 100, 255, 0.15);
  --el-pagination-bg-color: rgba(0, 50, 120, 0.3);
  --el-pagination-text-color: #8ec8ff;
  --el-pagination-hover-color: #00e5ff;
  --el-pagination-button-bg-color: rgba(0, 50, 120, 0.3);
  --el-input-bg-color: rgba(0, 20, 60, 0.6);
  --el-input-text-color: #a0d4ff;
  --el-input-border-color: rgba(0, 150, 255, 0.2);
  --el-input-placeholder-color: rgba(100, 160, 220, 0.5);
  --el-button-bg-color: rgba(0, 50, 120, 0.3);
  --el-button-border-color: rgba(0, 150, 255, 0.25);
  --el-button-text-color: #8ec8ff;
  --el-button-hover-bg-color: rgba(0, 80, 160, 0.4);
  --el-button-hover-border-color: rgba(0, 180, 255, 0.4);
  --el-button-hover-text-color: #ffffff;
}

/* ========== 顶部导航栏 ========== */
.top-header {
  height: 80px;
  display: flex;
  align-items: flex-end;
  padding: 0 20px 10px;
  background: transparent;
  position: relative;
  z-index: 10;
}

/* 北京时间 — 科技面板风格 */
.time-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 170px;
  margin-left: 50px;
  position: relative;
  top: 20px;
  padding: 4px 14px;
  background: rgba(0, 40, 100, 0.25);
  border: 1px solid rgba(0, 180, 255, 0.18);
  border-radius: 6px;
  backdrop-filter: blur(6px);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.6), transparent);
  }

  .time-date {
    font-size: 11px;
    color: rgba(140, 200, 255, 0.75);
    letter-spacing: 1.5px;
    font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
    line-height: 1.4;
  }

  .time-clock {
    font-size: 24px;
    font-weight: bold;
    color: #00e5ff;
    text-shadow: 0 0 8px rgba(0, 229, 255, 0.5),
                 0 0 20px rgba(0, 150, 255, 0.25);
    font-family: 'Consolas', 'Courier New', monospace;
    letter-spacing: 3px;
    line-height: 1.2;
  }
}

/* 中间导航区 */
.header-nav {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  margin-left: 90px;
  margin-bottom: -20px;
}

/* 导航按钮组 */
.nav-group {
  display: flex;
  align-items: center;
  margin-right:60px;
  gap: 10px;
  flex-shrink: 0;
}

/* 中间标题 */
.center-title {
  flex-shrink: 0;
  text-align: center;
  padding: 0 200px;
  position: relative;
  top: -30px;
  right: 40px;

  .title-text {
    font-size: 40px;
    font-weight: bold;
    color: #ffffff;
    text-shadow: 0 0 10px rgba(0, 200, 255, 0.6),
                 0 0 30px rgba(0, 150, 255, 0.3),
                 0 0 60px rgba(0, 100, 255, 0.15);
    letter-spacing: 8px;
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

    &::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 10%;
      right: 10%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.8), transparent);
      animation: titleUnderline 3s ease-in-out infinite;
    }
  }
}

/* 悬浮导航按钮 — 科技HUD风格 */
.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 22px;
  background: linear-gradient(180deg, rgba(0, 80, 180, 0.28) 0%, rgba(0, 40, 120, 0.12) 100%);
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-top-color: rgba(0, 200, 255, 0.45);
  color: #8ec8ff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  backdrop-filter: blur(8px);
  outline: none;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  position: relative;
  overflow: hidden;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);

  /* 顶部光线 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 220, 255, 0.6), transparent);
    transition: all 0.35s;
  }

  /* 底部光线 */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 25%;
    right: 25%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.35), transparent);
    transition: all 0.35s;
  }

  .el-icon {
    font-size: 16px;
    filter: drop-shadow(0 0 2px rgba(0, 200, 255, 0.3));
  }

  .btn-arrow {
    font-size: 11px;
    margin-left: 1px;
    opacity: 0.5;
    transition: transform 0.3s, opacity 0.3s;
  }

  &:hover {
    background: linear-gradient(180deg, rgba(0, 110, 240, 0.35) 0%, rgba(0, 60, 160, 0.18) 100%);
    border-color: rgba(0, 220, 255, 0.55);
    border-top-color: rgba(0, 240, 255, 0.7);
    color: #ffffff;
    box-shadow: 0 0 20px rgba(0, 180, 255, 0.18),
                0 2px 10px rgba(0, 120, 255, 0.12),
                inset 0 1px 15px rgba(0, 180, 255, 0.06);
    transform: translateY(-2px);
    text-shadow: 0 0 8px rgba(0, 200, 255, 0.4);

    &::before {
      left: 5%;
      right: 5%;
      background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.8), transparent);
    }

    &::after {
      left: 10%;
      right: 10%;
      background: linear-gradient(90deg, transparent, rgba(0, 220, 255, 0.6), transparent);
    }

    .el-icon {
      filter: drop-shadow(0 0 4px rgba(0, 230, 255, 0.5));
    }

    .btn-arrow {
      opacity: 1;
      transform: rotate(180deg);
    }
  }

  &.active {
    background: linear-gradient(180deg, rgba(0, 130, 255, 0.38) 0%, rgba(0, 80, 200, 0.2) 100%);
    border-color: rgba(0, 230, 255, 0.6);
    border-top-color: rgba(0, 240, 255, 0.8);
    color: #00e5ff;
    box-shadow: 0 0 22px rgba(0, 200, 255, 0.2),
                0 0 6px rgba(0, 200, 255, 0.15) inset;
    text-shadow: 0 0 6px rgba(0, 229, 255, 0.5);

    &::before {
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #00e5ff, transparent);
    }

    &::after {
      left: 5%;
      right: 5%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.7), transparent);
    }

    .el-icon {
      filter: drop-shadow(0 0 5px rgba(0, 229, 255, 0.6));
    }
  }
}

/* 右侧操作区 */
.action-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-right: 20px;
  margin-bottom: -10px;
}

/* 分隔线 */
.divider-line {
  width: 1px;
  height: 28px;
  background: linear-gradient(180deg, transparent, rgba(0, 180, 255, 0.4), transparent);
}

/* 态势展示按钮 — 独立脉冲风格 */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  position: relative;
  font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
  transition: all 0.35s;
}

.earth-btn {
  .action-btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 180, 0, 0.25) 0%, rgba(255, 120, 0, 0.08) 70%);
    border: 1.5px solid rgba(255, 200, 50, 0.45);
    position: relative;
    transition: all 0.35s;

    .el-icon {
      font-size: 17px;
      color: #ffd060;
      filter: drop-shadow(0 0 3px rgba(255, 200, 0, 0.4));
    }
  }

  .action-btn-label {
    font-size: 14px;
    color: #ffd060;
    letter-spacing: 1px;
    transition: all 0.3s;
  }

  /* 脉冲环 */
  .action-btn-pulse {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255, 200, 50, 0.3);
    animation: pulseRing 2.5s ease-out infinite;
    pointer-events: none;
  }

  &:hover {
    .action-btn-icon {
      background: radial-gradient(circle, rgba(255, 200, 50, 0.35) 0%, rgba(255, 140, 0, 0.12) 70%);
      border-color: rgba(255, 220, 80, 0.65);
      box-shadow: 0 0 18px rgba(255, 180, 0, 0.25);
      transform: scale(1.08);

      .el-icon {
        filter: drop-shadow(0 0 6px rgba(255, 220, 50, 0.6));
      }
    }

    .action-btn-label {
      color: #ffe890;
      text-shadow: 0 0 10px rgba(255, 200, 0, 0.4);
    }
  }
}

/* 态势展示按钮高亮提示 — 场景加载后触发 */
.earth-btn-highlight {
  .action-btn-icon {
    animation: earthIconPulse 1.2s ease-in-out infinite;
    border-color: rgba(255, 220, 50, 0.8) !important;
    box-shadow: 0 0 20px rgba(255, 180, 0, 0.4), 0 0 40px rgba(255, 180, 0, 0.15);
    background: radial-gradient(circle, rgba(255, 200, 50, 0.4) 0%, rgba(255, 140, 0, 0.15) 70%) !important;
  }

  .action-btn-label {
    color: #ffe890 !important;
    text-shadow: 0 0 12px rgba(255, 200, 0, 0.5);
    animation: earthTextBlink 1.5s ease-in-out infinite;
  }

  .action-btn-pulse {
    animation: pulseRing 1.2s ease-out infinite !important;
    border-color: rgba(255, 220, 50, 0.6) !important;
  }

  /* 添加提示箭头 */
  &::before {
    content: '👆 点击进入场景';
    position: absolute;
    bottom: -28px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: #ffd060;
    white-space: nowrap;
    text-shadow: 0 0 8px rgba(255, 200, 0, 0.4);
    animation: earthTextBlink 1.5s ease-in-out infinite;
  }
}

@keyframes earthIconPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

@keyframes earthTextBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 用户面板 — 信息卡风格 */
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
  min-width: 140px;
  max-width: 180px;

  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.5), transparent);
    transition: all 0.3s;
  }

  &:hover {
    background: linear-gradient(135deg, rgba(0, 70, 160, 0.4) 0%, rgba(0, 40, 100, 0.2) 100%);
    border-color: rgba(0, 210, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 150, 255, 0.12),
                inset 0 0 15px rgba(0, 150, 255, 0.04);

    &::before {
      left: 10%;
      right: 10%;
      background: linear-gradient(90deg, transparent, rgba(0, 230, 255, 0.7), transparent);
    }
  }

  .avatar-ring {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 1.5px solid rgba(0, 200, 255, 0.35);
      animation: avatarGlow 3s ease-in-out infinite;
    }

    .avatar-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(0, 180, 255, 0.2);
    }

    .normal-avatar-icon {
      background: linear-gradient(135deg, rgba(100, 200, 255, 0.5), rgba(60, 140, 220, 0.35));
      color: #e0f4ff;
    }

    :deep(.el-avatar) {
      border: none;
      box-shadow: 0 0 8px rgba(0, 180, 255, 0.2);
    }
  }

  .user-detail {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
    flex: 1;
    overflow: hidden;

    .username {
      font-size: 13px;
      font-weight: 500;
      color: #e0f0ff;
      font-family: '微软雅黑', 'Microsoft YaHei', sans-serif;
      transition: all 0.3s;
      letter-spacing: 0.5px;
      text-shadow: 0 0 6px rgba(0, 180, 255, 0.2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &:hover .user-detail .username {
    color: #ffffff;
    text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
  }
}

/* 普通模式用户面板 — 区别于攻防模式的颜色 */
.user-panel-normal {
  border-color: rgba(100, 200, 255, 0.25);
  background: linear-gradient(135deg, rgba(30, 80, 140, 0.25) 0%, rgba(20, 60, 110, 0.12) 100%);

  &::before {
    background: linear-gradient(90deg, transparent, rgba(100, 210, 255, 0.4), transparent);
  }

  .avatar-ring::before {
    border-color: rgba(100, 200, 255, 0.3);
  }

  .user-detail .username {
    color: rgba(180, 220, 255, 0.9);
    text-shadow: 0 0 4px rgba(100, 200, 255, 0.15);
  }

  &:hover {
    border-color: rgba(100, 210, 255, 0.4);
    background: linear-gradient(135deg, rgba(40, 90, 160, 0.35) 0%, rgba(30, 70, 130, 0.18) 100%);

    .user-detail .username {
      color: #d0eaff;
      text-shadow: 0 0 8px rgba(100, 200, 255, 0.4);
    }
  }
}

/* 注销按钮 */
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

  &:hover {
    color: #ff6b6b;
    border-color: rgba(255, 100, 100, 0.4);
    background: rgba(255, 80, 80, 0.1);
    text-shadow: 0 0 8px rgba(255, 100, 100, 0.4);
  }
}

/* ========== 主内容区 ========== */
.main-content {
  height: var(--app-main-content-height, calc(90vh - 90px));
  padding: 50px 48px 25px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 20, 60, 0.3);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 150, 255, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 150, 255, 0.5);
    }
  }

  /* ========== 子组件深层样式覆盖 ========== */

  :deep(.scene-container),
  :deep(.simulation-container),
  :deep(.network-container),
  :deep(.system-container),
  :deep(.signal-simulation-container),
  :deep(.signal-data-viewer),
  :deep(.message-center) {
    background-color: transparent !important;
  }

  :deep(.content-area) {
    background-color: transparent !important;
    padding: 0 !important;
  }

  :deep(.scene-manager-container),
  :deep(.library-container) {
    background-color: rgba(0, 20, 60, 0.5) !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
    color: #a0d4ff !important;
  }

  :deep(.el-table) {
    background-color: transparent !important;

    &::before,
    &::after {
      background-color: rgba(0, 150, 255, 0.12) !important;
    }

    th.el-table__cell {
      background-color: rgba(0, 35, 90, 0.7) !important;
      color: #8ec8ff !important;
      border-bottom-color: rgba(0, 150, 255, 0.2) !important;
    }

    tr {
      background-color: rgba(0, 15, 50, 0.4) !important;
    }

    .el-table__row--striped td.el-table__cell {
      background-color: rgba(0, 20, 65, 0.5) !important;
    }

    td.el-table__cell {
      border-bottom-color: rgba(0, 150, 255, 0.1) !important;
    }

    .el-table__empty-text {
      color: #6a9fd8 !important;
    }

    .el-table__inner-wrapper::before {
      background-color: rgba(0, 150, 255, 0.12) !important;
    }

    &.el-table--border .el-table__inner-wrapper {
      border-color: rgba(0, 150, 255, 0.12) !important;
    }

    &.el-table--border th.el-table__cell,
    &.el-table--border td.el-table__cell {
      border-right-color: rgba(0, 150, 255, 0.1) !important;
    }
  }

  :deep(.el-card) {
    background-color: rgba(0, 20, 60, 0.55) !important;
    border: 1px solid rgba(0, 150, 255, 0.15) !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;

    .el-card__header {
      border-bottom-color: rgba(0, 150, 255, 0.15) !important;
      color: #ffffff !important;
    }
  }

  :deep(.el-dialog) {
    background-color: rgba(0, 20, 55, 0.96) !important;
    border: 1px solid rgba(0, 150, 255, 0.2) !important;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5) !important;

    .el-dialog__header {
      border-bottom: 1px solid rgba(0, 150, 255, 0.15);
    }

    .el-dialog__title {
      color: #ffffff !important;
    }

    .el-dialog__body {
      color: #a0d4ff !important;
    }
  }

  :deep(.el-input) {
    .el-input__wrapper {
      background-color: rgba(0, 20, 60, 0.6) !important;
      box-shadow: 0 0 0 1px rgba(0, 150, 255, 0.2) inset !important;

      &:hover {
        box-shadow: 0 0 0 1px rgba(0, 180, 255, 0.35) inset !important;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px rgba(0, 200, 255, 0.5) inset !important;
      }
    }

    .el-input__inner {
      color: #a0d4ff !important;

      &::placeholder {
        color: rgba(100, 160, 220, 0.5) !important;
      }
    }
  }

  :deep(.el-select) {
    .el-select__wrapper {
      background-color: rgba(0, 20, 60, 0.6) !important;
      box-shadow: 0 0 0 1px rgba(0, 150, 255, 0.2) inset !important;
    }
  }

  :deep(.el-button--default) {
    background-color: rgba(0, 50, 120, 0.3) !important;
    border-color: rgba(0, 150, 255, 0.25) !important;
    color: #8ec8ff !important;

    &:hover {
      background-color: rgba(0, 80, 160, 0.4) !important;
      border-color: rgba(0, 180, 255, 0.4) !important;
      color: #ffffff !important;
    }
  }

  :deep(.el-button--primary) {
    background-color: rgba(0, 100, 200, 0.5) !important;
    border-color: rgba(0, 150, 255, 0.4) !important;

    &:hover {
      background-color: rgba(0, 120, 220, 0.6) !important;
    }
  }

  :deep(.el-button--success) {
    background-color: rgba(50, 150, 50, 0.5) !important;
    border-color: rgba(80, 200, 80, 0.4) !important;

    &:hover {
      background-color: rgba(60, 170, 60, 0.6) !important;
    }
  }

  :deep(.el-button--danger) {
    background-color: rgba(200, 50, 50, 0.5) !important;
    border-color: rgba(255, 80, 80, 0.4) !important;

    &:hover {
      background-color: rgba(220, 60, 60, 0.6) !important;
    }
  }

  :deep(.el-button--warning) {
    background-color: rgba(200, 150, 0, 0.5) !important;
    border-color: rgba(255, 200, 0, 0.4) !important;

    &:hover {
      background-color: rgba(220, 170, 0, 0.6) !important;
    }
  }

  :deep(.el-pagination) {
    button, .el-pager li {
      background-color: rgba(0, 50, 120, 0.3) !important;
      color: #8ec8ff !important;
      border: 1px solid rgba(0, 150, 255, 0.15);

      &:hover {
        color: #00e5ff !important;
      }

      &.is-active {
        background-color: rgba(0, 100, 200, 0.4) !important;
        color: #00e5ff !important;
      }
    }
  }

  :deep(.el-form-item__label) {
    color: #8ec8ff !important;
  }

  :deep(.el-tabs) {
    .el-tabs__item {
      color: #8ec8ff !important;

      &:hover { color: #00e5ff !important; }
      &.is-active { color: #00e5ff !important; }
    }

    .el-tabs__active-bar {
      background-color: #00e5ff !important;
    }

    .el-tabs__nav-wrap::after {
      background-color: rgba(0, 150, 255, 0.15) !important;
    }
  }

  :deep(.el-alert) {
    background-color: rgba(0, 30, 80, 0.5) !important;
    border-color: rgba(0, 150, 255, 0.2) !important;

    .el-alert__description {
      color: #a0d4ff !important;
    }
  }

  :deep(.el-tag) {
    &.el-tag--plain {
      background-color: rgba(0, 30, 80, 0.4) !important;
      border-color: rgba(0, 150, 255, 0.2) !important;
      color: #8ec8ff !important;
    }
  }

  :deep(.el-loading-mask) {
    background-color: rgba(0, 10, 30, 0.7) !important;
  }

  :deep(.el-loading-text) {
    color: #8ec8ff !important;
  }

  :deep(.dialog-header) {
    background-color: rgba(0, 30, 80, 0.5) !important;
    border-left-color: #00b0ff !important;
    color: #ffffff !important;
  }

  :deep(.log-detail .detail-content) {
    background-color: rgba(0, 15, 50, 0.7) !important;
    border-color: rgba(0, 150, 255, 0.15) !important;
    color: #8ec8ff !important;
  }

  :deep(.card-header) {
    color: #a0d4ff !important;
  }

  :deep(.msg-header) {
    background-color: rgba(0, 20, 60, 0.7) !important;
    border-bottom-color: rgba(0, 150, 255, 0.15) !important;
  }

  :deep(.chat-container) {
    background-color: rgba(0, 20, 60, 0.5) !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
    border-color: rgba(0, 150, 255, 0.15) !important;
  }

  :deep(.chat-sidebar) {
    background-color: rgba(0, 15, 50, 0.6) !important;
    border-right-color: rgba(0, 150, 255, 0.15) !important;
  }

  :deep(.page-header),
  :deep(.control-panel),
  :deep(.chart-container) {
    background: rgba(0, 20, 60, 0.6) !important;
    border-color: rgba(0, 150, 255, 0.15) !important;
    color: #a0d4ff !important;
  }

  :deep(.chart-header) {
    background-color: rgba(0, 30, 80, 0.5) !important;
    border-bottom-color: rgba(0, 150, 255, 0.15) !important;
    color: #8ec8ff !important;
  }

  :deep(.chart-content),
  :deep(.chart-element) {
    background-color: rgba(0, 15, 50, 0.4) !important;
    border-color: rgba(0, 150, 255, 0.1) !important;
  }
}

/* 标题动画 */
@keyframes titleShimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes titleUnderline {
  0%, 100% { left: 10%; right: 10%; opacity: 0.6; }
  50% { left: 5%; right: 5%; opacity: 1; }
}

@keyframes pulseRing {
  0% { transform: translateY(-50%) scale(1); opacity: 0.6; }
  70% { transform: translateY(-50%) scale(1.8); opacity: 0; }
  100% { transform: translateY(-50%) scale(1.8); opacity: 0; }
}

@keyframes avatarGlow {
  0%, 100% { border-color: rgba(0, 200, 255, 0.25); box-shadow: 0 0 4px rgba(0, 200, 255, 0.1); }
  50% { border-color: rgba(0, 200, 255, 0.5); box-shadow: 0 0 10px rgba(0, 200, 255, 0.2); }
}
</style>
