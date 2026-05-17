<template>
  <div class="main-layout">
    <!-- 告警提醒组件 -->
    <AlertNotification />
    
    <!-- 顶部导航栏 - 回放模式下隐藏 -->
    <TopNavBar v-if="!isPlaybackMode" />
    
    <!-- 主内容区域 -->
    <div class="main-content" :class="{ 'playback-mode': isPlaybackMode }">
      <!-- 侧边栏 - 仅白方可见且非回放模式 -->
      <SideBar v-if="userRole === 'white' && !isPlaybackMode" />
      
      <!-- Cesium地球容器 -->
      <main class="cesium-container">
        <Cesium  />
      </main>
      
      <!-- 时间轴 - 仅回放模式显示 -->
      <div v-if="isPlaybackMode" class="timeline-container">
        <TimelinePlayer 
          :record-id="playbackRecordId"
          :session-id="playbackSessionId"
          :broker-id="playbackBrokerId"
        />
      </div>

    </div>
    
    <!-- 添加资源提醒组件 -->
    <ResourceReminder />
  </div>
</template>

<script setup lang="ts">
import TopNavBar from './components/TopNavBar.vue';
import SideBar from './components/SideBar.vue';
import Cesium from './components/Cesium.vue';
import TimelinePlayer from './components/TimelinePlayer.vue';
import AlertNotification from '../../components/AlertNotification.vue';
import ResourceReminder from '../../components/ResourceReminder.vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { getUserInfo } from '../../store/user';

// 获取路由信息
const route = useRoute();

// 计算用户角色
const userRole = computed(() => {
  const userInfo = getUserInfo();
  return userInfo.role;
});

// 检测是否为回放模式
const isPlaybackMode = computed(() => {
  return route.query.mode === 'playback';
});

// 获取回放相关参数
const playbackRecordId = computed(() => {
  return route.query.recordId as string || '';
});

const playbackSessionId = computed(() => {
  return route.query.sessionId as string || '';
});

const playbackBrokerId = computed(() => {
  return route.query.brokerId as string || '';
});

</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000;
  color: #fff;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
}

/* 主内容区域样式 */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100vh - 90px); /* 减去顶部导航栏高度 */
  width: 100%;
}

/* 回放模式下的主内容区域 */
.main-content.playback-mode {
  height: 100vh; /* 回放模式下占据全屏 */
  flex-direction: column; /* 垂直布局，时间轴在底部 */
}

/* Cesium容器样式 */
.cesium-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

/* 时间轴容器样式 */
.timeline-container {
  position: relative;
  height: 80px;
  background: transparent;
  z-index: 1000;
  min-height: 80px;
  display: flex;
  align-items: center;
}
</style> 
