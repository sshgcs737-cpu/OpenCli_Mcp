import type { RouteRecordRaw } from 'vue-router'

export const constRoutes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    component: () => import('../views/login/index.vue'),
    name: 'login',
    meta: {
        title: '登录',
        hidden: true
    }
  },
  {
    path: '/viewer',
    component: () => import('../views/cesium/Index.vue'),
    name: '/viewer',
    meta: {
      title: '态势展示'
    }
  },
  {
    path: '/simu',
    component: () => import('../layout/index.vue'),
    name: 'simu',
    redirect: '/simu/view',
    meta: {
        title: '首页',
    },
    children: [
      {
        path: 'view',
        component: () => import('../views/scene/index.vue'),
        name: 'view',
        meta:{
          title: '仿真场景编辑'
        }
      },
      {
        path: 'signal',
        component: () => import('../views/signalSimulation/index.vue'),
        name: 'signal',
        meta:{
          title: '信号级仿真'
        }
      },
      {
        path: 'signal-data',
        component: () => import('../views/signalSimulation/signalDataViewer.vue'),
        name: 'signal-data',
        meta:{
          title: '信号数据展示'
        }
      },
      {
        path: 'simulation',
        component: () => import('../views/simulation/simuAssess.vue'),
        name:'simulation',
        meta:{
          title: '测试工具'
        }
      },
      {
        path: 'srclibrary',
        component: () => import('../views/srclibrary/srclibrary.vue'),
        name:'srclibrary',
        meta:{
          title: '资源库管理'
        }
      },
      {
        path: 'system',
        component: () => import('../views/system/systemManage.vue'),
        name:'system',
        meta:{
          title: '系统管理'
        }
      },
      {
        path: 'message',
        component: () => import('../views/message/index.vue'),
        name:'message',
        meta:{
          title: '消息中心'
        }
      },

    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]