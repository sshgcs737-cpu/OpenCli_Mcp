import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import router from './router'
import pinia from './store'
import '../node_modules/cesium/Build/Cesium/Widgets/widgets.css';
import { useThemeStore } from './store/modules/theme';

// 设置Cesium的静态资源路径
// @ts-ignore
window.CESIUM_BASE_URL = '/cesium/';

// 创建Vue应用
const app = createApp(App);

// 配置Element Plus
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default'
});

// 注册所有Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 使用路由
app.use(router);

// 使用Pinia
app.use(pinia);

// 挂载应用
app.mount('#app');

// 初始化并应用主题 - 在应用挂载后调用，确保存储已经准备就绪
const themeStore = useThemeStore();
themeStore.initTheme();
