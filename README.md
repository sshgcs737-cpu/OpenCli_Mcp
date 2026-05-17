# CORE 仿真系统前端重构项目

## 项目简介
本项目是对 CORE 仿真系统的前端重构，使用 Vue3 + Cesium 实现 3D 可视化界面。主要功能是在 Cesium 3D 地图上放置节点并建立连接，通过 CORE 后端进行仿真，使用 EMANE 进行子网模拟。

## 技术栈
- Vue 3
- TypeScript
- Cesium
- Pinia
- Element Plus

## 系统架构
### 前端
- 基于 Vue3 + Cesium 的 3D 可视化界面
- 使用 Pinia 进行状态管理
- 使用 Element Plus 构建 UI 组件

### 后端
- CORE 作为仿真引擎
- EMANE 用于子网模拟

## 核心功能
1. 节点管理
   - 支持放置设备节点（无人机）
   - 支持放置子网节点
   - 节点位置包含经纬高信息
   - 支持预设移动轨迹

2. 连接管理
   - 设备节点之间通过有线方式连接
   - 设备节点与子网节点之间通过无线方式连接
   - 无线连接逻辑：设备 A 和 B 加入同一子网时自动建立无线链路

3. 数据持久化
   - 使用 Pinia 持久化插件保存拓扑数据
   - 支持场景的保存和加载

## 数据结构
### 节点（Node）
```typescript
interface Node {
  id: number;
  name: string;
  type: string;
  model: string;
  position: Position;  // 3D 位置
  geo: GeoPosition;    // 地理位置（经纬高）
  emane: string;
  icon: string;
  image: string;
  server: string;
  config_services: string[];
  dir: string;
  channel: string;
  canvas: number;
  wlan_config: Record<string, ConfigOption>;
  mobility_config: Record<string, ConfigOption>;
  service_configs: Record<string, ServiceConfig>;
  emane_configs: EmaneConfig[];
  role?: string;
  status?: string;  // 节点状态：UP表示正常，DOWN表示故障，默认为UP
  alias?: string;   // 节点别名，可设置节点的别名或者直接使用当前节点的name
  phy_type?: string; // 物理层模型类型，用于EMANE子网节点，如：ofdm、dsss、fhss等
}
```

### 链路（Link）
```typescript
interface Link {
  node1_id: number;
  node2_id: number;
  type: string;
  iface1: NodeIface;
  iface2: NodeIface;
  options: LinkOptions;
  network_id: number;
}
```

### 拓扑数据（TopoData）
```typescript
interface TopoData {
  id: number;
  state: string;
  nodes: Node[];
  links: Link[];
  dir: string;
  user: string;
  default_services: DefaultService[];
  location: LocationInfo;
  hooks: Hook[];
  metadata: Record<string, string>;
  file: string;
  options: Record<string, ConfigOption>;
  servers: Server[];
  name?: string;
}
```

## 状态管理
使用 Pinia 进行状态管理，主要包含以下功能：
1. 会话管理
   - 当前会话 ID
   - 拓扑数据加载状态
   - 错误处理

2. 节点操作
   - 添加/删除/更新节点
   - 节点位置更新
   - 节点选择

3. 链路操作
   - 添加/删除/更新链路
   - 链路选择

4. 工具方法
   - 创建默认节点
   - 创建默认链路
   - 节点和链路的过滤查询

## 开发进度
- [x] 项目基础架构搭建
- [x] 数据结构定义
- [x] 状态管理实现
- [ ] Cesium 节点放置功能
- [ ] 连线绘制功能
- [ ] 节点属性配置面板
- [ ] 侧边栏组件
- [ ] 与 CORE 后端集成

## 注意事项
1. 节点放置时需要考虑经纬高信息
2. 连线分为有线和无线两种方式
3. 无线连接通过子网实现
4. 节点不支持拖拽调整位置，但支持预设移动轨迹

# 子网角色与标签颜色修改

## 功能说明

本次修改实现了两个主要功能：

1. **子网标签颜色根据角色变化**：
   - 红方子网（`RED`）使用红色标签
   - 蓝方子网（`BLUE`）使用蓝色标签
   - 公共子网（`WHITE`）或未设置角色的子网保持原有的子网颜色

2. **节点连接限制**：
   - 节点只能接入匹配角色的子网
   - 子网内部链路的颜色与子网角色一致

## 角色匹配规则

1. **公共角色的灵活性**：
   - 公共（`WHITE`）角色的节点可以接入任何子网
   - 公共（`WHITE`）角色的子网可以接入任何节点

2. **专属角色的限制**：
   - 红方（`RED`）节点只能接入红方子网
   - 蓝方（`BLUE`）节点只能接入蓝方子网
   - 尝试连接不匹配角色的节点和子网时会显示错误提示

3. **子网内部连接**：
   - 只有角色匹配的节点才会在子网内部创建连接
   - 子网内部链路的颜色与子网角色一致

## 修改文件

1. `src/composables/useCesiumEntities.ts`：
   - 修改了 `createNodeEntity` 函数，使子网标签颜色根据节点角色变化
   - 修改了 `syncLinksToEntities` 函数，确保子网内部链路的颜色与子网角色一致
   - 添加了角色匹配检查，确保只有角色匹配的节点才会在子网内部创建连接

2. `src/views/cesium/components/Cesium.vue`：
   - 修改了 `validateNodeConnection` 函数，添加对节点角色的检查
   - 确保节点只能接入匹配角色的子网

## 使用方法

1. 创建节点或子网时，在配置对话框中选择相应的角色
2. 系统会自动根据角色设置标签颜色并限制连接
