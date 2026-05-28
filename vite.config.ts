import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import cesium from 'vite-plugin-cesium'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 使用vite-plugin-cesium插件（zb分支）
    cesium(),
    // 复制Cesium资源到public目录（zxy分支，保留以防cesium插件配置有问题时使用）
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/cesium/Build/Cesium/Workers',
          dest: 'cesium'
        },
        {
          src: 'node_modules/cesium/Build/Cesium/ThirdParty',
          dest: 'cesium'
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Assets',
          dest: 'cesium'
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Widgets',
          dest: 'cesium'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  server: {
    open: true,
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      // 配置代理
      '/api': {
        target: 'http://10.16.37.102:7777/', // 实际后端服务器地址
        changeOrigin: true,//允许跨域
        rewrite: (path) => path.replace(/^\/api/, '') // 可选：移除/api前缀
      },
      '/router': {
        target: 'http://10.16.37.102:7780/', // 路由协议和测试服务
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/router/, '')
      },

      '/dockerTest/':{
        target: 'http://10.16.37.102:7780/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dockerTest/, '')
      },
      // 新增配置：认证服务
      '/auth-api': {
        target: 'http://10.16.37.102:7776/', // 认证服务器地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, '') // 移除/auth-api前缀
      },
      //流量模型
      '/trafficWork':{
        target: 'http://10.16.37.102:7780/', //流量模型服务器地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trafficWork/, '')
      },
      '/connect':{
        target: 'ws://10.16.37.102:10202',
        changeOrigin: true,
        ws: true,
      },
      // 地图影像代理
      '/map-tiles': {
        target: 'http://10.16.85.83:666',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-tiles/,'/map-tiles')
      },

      //有线测量
      '/wiredTest':{
        target:'http://10.16.37.102:7780',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wiredTest/, '')
      }  
    }
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/')
  } 
})
