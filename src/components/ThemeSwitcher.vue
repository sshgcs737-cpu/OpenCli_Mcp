<template>
  <div class="theme-switcher">
    <el-dropdown trigger="click" @command="handleThemeChange" placement="bottom-start">
      <div class="theme-switcher-trigger">
        <el-tooltip content="切换主题" placement="bottom" effect="light">
          <el-icon class="theme-icon" size="20">
            <Brush />
          </el-icon>
        </el-tooltip>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item 
            v-for="theme in availableThemes" 
            :key="theme.value"
            :command="theme.value"
            :class="{ 'active-theme': currentTheme === theme.value }"
          >
            <div class="theme-item">
              <div class="theme-color-preview" :style="getThemePreviewStyle(theme.value)"></div>
              <span>{{ theme.label }}</span>
              <el-icon v-if="currentTheme === theme.value"><Check /></el-icon>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useThemeStore, type ThemeType } from '../store/modules/theme';
import { Check, Brush } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 获取主题 store
const themeStore = useThemeStore();
const currentTheme = computed(() => themeStore.currentTheme);

// 可用主题列表
const availableThemes = [
  { value: 'default', label: '默认主题' },
  { value: 'light', label: '明亮主题' },
  { value: 'dark', label: '暗黑主题' },
  { value: 'blue', label: '蓝色主题' },
  { value: 'red', label: '红色主题' },
  { value: 'green', label: '绿色主题' }
];

// 初始化主题
onMounted(() => {
  themeStore.initTheme();
});

// 生成主题预览样式
const getThemePreviewStyle = (themeType: string) => {
  const theme = themeStore.themes[themeType as ThemeType];
  return {
    background: `linear-gradient(135deg, ${theme.headerBgFrom} 0%, ${theme.headerBgTo} 100%)`,
    border: `1px solid ${theme.borderColor}`
  };
};

// 处理主题变更
const handleThemeChange = (theme: string) => {
  themeStore.setTheme(theme as ThemeType);
  ElMessage.success(`已切换到${availableThemes.find(t => t.value === theme)?.label || '新主题'}`);
};
</script>

<style scoped>
.theme-switcher {
  cursor: pointer;
}

.theme-switcher-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 4px;
}

.theme-icon {
  color: var(--secondary-text-color, #a6c9ff);
  transition: all 0.3s;
}

.theme-switcher-trigger:hover .theme-icon {
  color: var(--secondary-color, #ff3c78);
  transform: rotate(30deg);
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.active-theme {
  color: var(--secondary-color, #ff3c78);
  font-weight: 500;
}
</style> 