import { defineStore } from 'pinia';

// 定义主题类型
export type ThemeType = 'default' | 'light' | 'dark' | 'blue' | 'green' | 'red';

// 定义主题变量接口
export interface ThemeVars {
  // 基础颜色
  primaryColor: string;
  primaryLightColor: string;
  primaryDarkColor: string;
  secondaryColor: string;
  
  // 背景颜色
  headerBgFrom: string;
  headerBgTo: string;
  sidebarBgFrom: string;
  sidebarBgTo: string;
  sidebarBgMiddle: string;
  
  // 文本颜色
  primaryTextColor: string;
  secondaryTextColor: string;
  
  // 边框和阴影
  borderColor: string;
  shadowColor: string;
  
  // 高亮和活跃状态
  activeColor: string;
  hoverColor: string;
  glowColor: string;
}

// 定义主题预设
const themePresets: Record<ThemeType, ThemeVars> = {
  // 默认红蓝主题 (当前使用的)
  default: {
    primaryColor: '#a48fff',
    primaryLightColor: '#a6c9ff',
    primaryDarkColor: '#783cff',
    secondaryColor: '#ff3c78',
    
    headerBgFrom: '#0a1228',
    headerBgTo: '#2c0a16',
    sidebarBgFrom: '#0a1228',
    sidebarBgTo: '#2c0a16',
    sidebarBgMiddle: '#1a1a40',
    
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#a6c9ff',
    
    borderColor: 'rgba(120, 60, 255, 0.15)',
    shadowColor: 'rgba(120, 60, 255, 0.4)',
    
    activeColor: '#ff3c78',
    hoverColor: 'rgba(120, 60, 255, 0.1)',
    glowColor: 'rgba(120, 60, 255, 0.6)'
  },
  
  // 明亮主题
  light: {
    primaryColor: '#409EFF',
    primaryLightColor: '#79bbff',
    primaryDarkColor: '#337ecc',
    secondaryColor: '#67C23A',
    
    headerBgFrom: '#ffffff',
    headerBgTo: '#f5f7fa',
    sidebarBgFrom: '#ffffff',
    sidebarBgTo: '#f5f7fa',
    sidebarBgMiddle: '#f0f2f5',
    
    primaryTextColor: '#303133',
    secondaryTextColor: '#606266',
    
    borderColor: '#dcdfe6',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    
    activeColor: '#409EFF',
    hoverColor: 'rgba(64, 158, 255, 0.1)',
    glowColor: 'rgba(64, 158, 255, 0.2)'
  },
  
  // 暗黑主题
  dark: {
    primaryColor: '#409EFF',
    primaryLightColor: '#79bbff',
    primaryDarkColor: '#337ecc',
    secondaryColor: '#E6A23C',
    
    headerBgFrom: '#1e1e1e',
    headerBgTo: '#141414',
    sidebarBgFrom: '#1e1e1e',
    sidebarBgTo: '#141414',
    sidebarBgMiddle: '#181818',
    
    primaryTextColor: '#E6E6E6',
    secondaryTextColor: '#A8ABB2',
    
    borderColor: '#4c4d4f',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    
    activeColor: '#409EFF',
    hoverColor: 'rgba(64, 158, 255, 0.2)',
    glowColor: 'rgba(64, 158, 255, 0.3)'
  },
  
  // 蓝色科技主题
  blue: {
    primaryColor: '#0088ff',
    primaryLightColor: '#40a9ff',
    primaryDarkColor: '#0066cc',
    secondaryColor: '#00d8ff',
    
    headerBgFrom: '#051b30',
    headerBgTo: '#0a3b66',
    sidebarBgFrom: '#051b30',
    sidebarBgTo: '#0a3b66',
    sidebarBgMiddle: '#072845',
    
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#a6e1ff',
    
    borderColor: 'rgba(0, 136, 255, 0.2)',
    shadowColor: 'rgba(0, 136, 255, 0.4)',
    
    activeColor: '#00d8ff',
    hoverColor: 'rgba(0, 136, 255, 0.15)',
    glowColor: 'rgba(0, 136, 255, 0.5)'
  },
  
  // 绿色环保主题
  green: {
    primaryColor: '#18a058',
    primaryLightColor: '#36ad6a',
    primaryDarkColor: '#0c7a43',
    secondaryColor: '#f0a020',

    headerBgFrom: '#0c2818',
    headerBgTo: '#0f3822',
    sidebarBgFrom: '#0c2818',
    sidebarBgTo: '#0f3822',
    sidebarBgMiddle: '#0d301d',

    primaryTextColor: '#ffffff',
    secondaryTextColor: '#b8e5ca',

    borderColor: 'rgba(24, 160, 88, 0.2)',
    shadowColor: 'rgba(24, 160, 88, 0.4)',

    activeColor: '#f0a020',
    hoverColor: 'rgba(24, 160, 88, 0.15)',
    glowColor: 'rgba(24, 160, 88, 0.5)'
  },

  // 红色战斗主题
  red: {
    primaryColor: '#ff4757',
    primaryLightColor: '#ff6b7a',
    primaryDarkColor: '#cc3a47',
    secondaryColor: '#ff3742',

    headerBgFrom: '#2c0a0a',
    headerBgTo: '#4a1515',
    sidebarBgFrom: '#2c0a0a',
    sidebarBgTo: '#4a1515',
    sidebarBgMiddle: '#3d1010',

    primaryTextColor: '#ffffff',
    secondaryTextColor: '#ffb3ba',

    borderColor: 'rgba(255, 71, 87, 0.2)',
    shadowColor: 'rgba(255, 71, 87, 0.4)',

    activeColor: '#ff3742',
    hoverColor: 'rgba(255, 71, 87, 0.15)',
    glowColor: 'rgba(255, 71, 87, 0.5)'
  }
};

export const useThemeStore = defineStore('theme', {
  state: () => ({
    currentTheme: 'default' as ThemeType,
    themes: themePresets
  }),
  
  getters: {
    // 获取当前主题的所有变量
    themeVars: (state) => state.themes[state.currentTheme],
    
    // 获取CSS变量对象
    cssVars: (state) => {
      const vars = state.themes[state.currentTheme];
      return {
        '--primary-color': vars.primaryColor,
        '--primary-light-color': vars.primaryLightColor,
        '--primary-dark-color': vars.primaryDarkColor,
        '--secondary-color': vars.secondaryColor,
        
        '--header-bg-from': vars.headerBgFrom,
        '--header-bg-to': vars.headerBgTo,
        '--sidebar-bg-from': vars.sidebarBgFrom,
        '--sidebar-bg-middle': vars.sidebarBgMiddle,
        '--sidebar-bg-to': vars.sidebarBgTo,
        
        '--primary-text-color': vars.primaryTextColor,
        '--secondary-text-color': vars.secondaryTextColor,
        
        '--border-color': vars.borderColor,
        '--shadow-color': vars.shadowColor,
        
        '--active-color': vars.activeColor,
        '--hover-color': vars.hoverColor,
        '--glow-color': vars.glowColor
      };
    }
  },
  
  actions: {
    // 设置当前主题
    setTheme(theme: ThemeType) {
      this.currentTheme = theme;

      // 将主题保存到本地存储
      localStorage.setItem('app-theme', theme);

      // 应用CSS变量到根元素
      this.applyTheme();
    },

    // 根据用户角色自动设置主题
    setThemeByRole(userRole: string) {
      let targetTheme: ThemeType = 'default';

      switch (userRole) {
        case 'white':
          targetTheme = 'default';
          break;
        case 'red':
          targetTheme = 'red';
          break;
        case 'blue':
          targetTheme = 'blue';
          break;
        default:
          targetTheme = 'default';
          break;
      }

      this.setTheme(targetTheme);
    },

    // 应用主题到HTML根元素
    applyTheme() {
      const rootElement = document.documentElement;
      Object.entries(this.cssVars).forEach(([key, value]) => {
        rootElement.style.setProperty(key, value);
      });
    },

    // 初始化主题，从本地存储加载或使用默认主题
    initTheme() {
      const savedTheme = localStorage.getItem('app-theme') as ThemeType;
      if (savedTheme && Object.keys(themePresets).includes(savedTheme)) {
        this.currentTheme = savedTheme;
      }
      this.applyTheme();
    }
  }
}); 