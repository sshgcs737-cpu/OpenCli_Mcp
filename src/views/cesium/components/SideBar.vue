<template>
  <aside class="sidebar">
    <div class="sidebar-panel">
      <div class="sidebar-content">
        <div v-for="(category, index) in categories" :key="index" class="sidebar-category">
          <div class="category-header" @click="toggleCategory(index)">
            <div class="header-content">
              <span class="header-title">{{ category.title }}</span>
            </div>
            <div class="collapse-icon">
              <el-icon :class="{ 'collapsed': collapsedCategories[index] }">
                <ArrowDown />
              </el-icon>
            </div>
          </div>
          <div class="category-content" :class="{ 'collapsed': collapsedCategories[index] }">
            <div 
              v-for="(item, idx) in category.items" 
              :key="idx" 
              class="category-item"
              :class="{ 'active': isItemActive(item) }"
              @click="handleItemClick(item, category.type)"
            >
              <div class="item-icon">
                <el-icon>
                  <component :is="getIconComponent(item.icon)" />
                </el-icon>
              </div>
              <div class="item-name">{{ item.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tech-effect-footer">
      <div class="tech-line-horizontal"></div>
      <div class="tech-line-vertical"></div>
      <div class="tech-scan-beam"></div>
      <div class="tech-dots">
        <div class="tech-dot" v-for="i in 6" :key="i"></div>
      </div>
      <div class="tech-glow"></div>
      <div class="tech-circles">
        <div class="tech-circle circle-1"></div>
        <div class="tech-circle circle-2"></div>
        <div class="tech-circle circle-3"></div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { type Component, ref, computed, onMounted, watch } from 'vue';
import {
  Monitor, Location, Connection, Link, Collection, CollectionTag,
  Delete, DataLine, SetUp, OfficeBuilding, ArrowDown, ChromeFilled,
  Message, MessageBox, Microphone, VideoCamera, Cloudy, Lock,Van

} from '@element-plus/icons-vue';
import { Drone, Server, NetworkDrive } from '@icon-park/vue-next';
import { getTopoBySession } from '../../../api/scene';
import { useTopoStore } from '../../../store/modules/topo';
import { useSystemLogStore } from '../../../store/modules/systemLog';
import { ElMessage } from 'element-plus';
import eventBus from '../../../utils/eventBus';
import type { Node } from '../../../types/topo';
import { useWebSocketState } from '../../../services/websocket';

const topoStore = useTopoStore();
const systemLogStore = useSystemLogStore();

const { isSimulationRunning } = useWebSocketState();

const WIRELESS_NODE_NAMES = ['无人机', '机动车', '基站', '卫星'];

const selectedItem = ref<{name: string, icon: string, type?: string} | null>(null);

const collapsedCategories = ref<Record<number, boolean>>({});

// 分布式场景设置
const isDistributedScene = ref(false);

// 获取场景分布式设置
const fetchSceneDistributedSetting = async () => {
  try {
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (sessionId) {
      // 尝试从 topo API 响应中获取场景信息
      const res = await getTopoBySession(sessionId);
      const data = res?.data?.data ?? res?.data;
      
      // 检查响应中是否包含 disturb 信息
      if (data && typeof data === 'object') {
        if ('disturb' in data) {
          isDistributedScene.value = data.disturb === 1;
          return;
        }
      }
      
      // 如果直接获取不到，检查 topoData 中的 metadata 或 options
      const topoData = topoStore.topoData;
      if (topoData?.metadata && topoData.metadata.disturb) {
        isDistributedScene.value = topoData.metadata.disturb === '1';
      } else if (topoData?.options && topoData.options.disturb) {
        isDistributedScene.value = topoStore.topoData.options.disturb === '1';
      } else {
        isDistributedScene.value = false;
      }
    }
  } catch (error) {
    console.error('SideBar - 获取场景分布式设置失败:', error);
    isDistributedScene.value = false;
  }
};

const toggleCategory = (index: number) => {
  if (collapsedCategories.value[index]) {
    collapsedCategories.value[index] = false;
  } else {
    collapsedCategories.value[index] = true;
  }
};

const getIconComponent = (iconName: string): Component => {
  const iconMap: Record<string, Component> = {
    'Monitor': Monitor,
    'Location': Location,
    'Connection': Connection,
    'Link': Link,
    'Collection': Collection,
    'CollectionTag': CollectionTag,
    'Delete': Delete,
    'DRONE':Drone,
    'Van': Van,
    'Server': Server,
    'NetworkDrive': NetworkDrive,
    'DataLine': DataLine,
    'SetUp': SetUp,
    'OfficeBuilding': OfficeBuilding,
    'ArrowDown': ArrowDown,
    'HTTP':ChromeFilled,
    'FTP': MessageBox,
    'SMTP': Message,
    'DNS': Cloudy,
    'VoIP-SIP': Microphone,
    'TLS': ChromeFilled,
    'RTSP-RTP': VideoCamera,
    'MQTT': Message,
    'CoAP': ChromeFilled,
    'DDS': DataLine,
    'SSH': SetUp,
    'PKI': ChromeFilled,
    'Lock': Lock,
  };

  return iconMap[iconName] || Monitor;
};

const isItemActive = (item: {name: string, icon: string, type?: string}): boolean => {
  return selectedItem.value?.name === item.name &&
         topoStore.operationMode === 'add';
};

const deviceTypeMap: Record<string, string> = {
  '虚拟机': 'VMNODE',
  '无人机': 'DRONE',
  '机动车': 'DRONE',
  '卫星': 'BASESTATION',
  '路由器': 'ROUTER',
  '交换机': 'SWITCH',
  '基站': 'BASESTATION',
  '视频服务器': 'RTSP-RTP',
  '流量终端': 'TMV',
  '攻击机': 'ATTACK_MACHINE',
  '安全机': 'SECURITY_MACHINE',
  'SDN控制器': 'SDN_CONTROLLER',
  'Ovs交换机': 'Ovs_SWITCH',
  'P4交换机': 'P4_SWITCH',
  'SR交换机': 'SR_SWITCH',
  '业务终端': 'BUSINESS_Transmitter',
  'PKI模型': 'PKI'
};

// 机动车和卫星的特殊标识映射
const deviceSubTypeMap: Record<string, string> = {
  '机动车': 'VAN',
  '卫星': 'SATELLITE'
};

const hardwareTypeMap: Record<string, string> = {
  '添加半实物': 'RJ45'
};

const applicationTypeMap: Record<string, string> = {
  'HTTP': 'HTTP',
  'FTP': 'FTP',
  'DNS': 'DNS',
  'SMTP': 'SMTP',
  'VoIP-SIP': 'VoIP-SIP',
  'TLS': 'TLS',
  'MQTT': 'MQTT',
  'CoAP': 'CoAP',
  'DDS': 'DDS',
  'SSH': 'SSH',
};

const subnetTypeMap: Record<string, string> = {
  '添加子网': 'EMANE'
};

const handleItemClick = (item: {name: string, icon: string, type?: string}, categoryType: string) => {
  if (categoryType === 'device' || categoryType === 'business') {
    // 场景运行时，禁止添加无线节点
    if (isSimulationRunning.value && WIRELESS_NODE_NAMES.includes(item.name)) {
      ElMessage.warning('对无线环境进行操作请先暂停场景');
      return;
    }

    selectedItem.value = item;

    const deviceType = deviceTypeMap[item.name] || 'DEVICE';
    const deviceSubType = deviceSubTypeMap[item.name] || null;

    // @ts-ignore: 忽略类型检查错误，该方法确实存在
    topoStore.setOperationMode('add');

    // @ts-ignore: 忽略类型检查错误，该方法确实存在
    topoStore.setSelectedNodeType(deviceType);

    // @ts-ignore: 设置节点子类型
    topoStore.setSelectedNodeSubType(deviceSubType);

    item.type = deviceType;

    systemLogStore.addLog({
      type: 'normal',
      module: 'ui',
      action: '切换操作模式',
      information: '操作模式切换',
      details: `进入${item.name}放置模式`
    });

    ElMessage.success(`已进入${item.name}放置模式，点击地图放置节点,右键退出放置模式`);
  } else if (categoryType === 'link') {
    if (item.name === '添加链路') {
      selectedItem.value = item;
      
      if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length < 2) {
        ElMessage.warning('至少需要两个节点才能创建链路');
        return;
      }
      
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('connect');
      
      eventBus.emit('sidebar:item-selected', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入链路连接模式'
      });
      
      ElMessage.success('已进入链路连接模式，请依次点击两个节点建立连接，右键退出连接模式');
    } else if (item.name === '删除链路') {
      selectedItem.value = item;
      
      if (!topoStore.topoData?.links || topoStore.topoData.links.length === 0) {
        ElMessage.warning('当前没有可删除的链路');
        return;
      }
      
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('connect');
      
      eventBus.emit('sidebar:item-selected', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入链路删除模式'
      });
      
      ElMessage.success('已进入链路删除模式，请点击要删除的链路，右键退出删除模式');
    } else if (item.name === '分布式链路配置') {
      selectedItem.value = item;

      // 检查是否有可配置的节点（无人机或路由器）
      const droneNodes = topoStore.topoData?.nodes?.filter((node: Node) => node.type === 'DRONE') || [];
      const routerNodes = topoStore.topoData?.nodes?.filter((node: Node) =>
        node.type === 'DEFAULT' && node.model === 'router'
      ) || [];
      const totalConfigurableNodes = droneNodes.length + routerNodes.length;

      if (totalConfigurableNodes === 0) {
        ElMessage.warning('当前场景中没有可配置的节点（无人机或路由器），无法进行分布式链路配置');
        return;
      }


      // 发送事件给父组件打开分布式链路配置对话框
      eventBus.emit('sidebar:distributed-link-config', item);

      systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '打开对话框',
        information: '分布式链路配置',
        details: '打开分布式链路配置对话框'
      });

      ElMessage.success('打开分布式链路配置面板');
    }
  } else if (categoryType === 'subnet') {
    if (item.name === '添加子网') {
      selectedItem.value = item;
      
      const subnetType = subnetTypeMap[item.name] || 'EMANE';
      
        // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('add');
      
        // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setSelectedNodeType(subnetType);
      // @ts-ignore: 子网节点无子类型，清空上次残留状态
      topoStore.setSelectedNodeSubType(null);
      
      item.type = subnetType;
      
      eventBus.emit('sidebar:item-selected', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入子网放置模式'
      });
      
      ElMessage.success('已进入子网放置模式，点击地图放置子网节点，右键退出放置模式');
    } else if (item.name === '删除子网') {
      selectedItem.value = item;
      
      const emaneNodes = topoStore.topoData?.nodes?.filter((node: Node) => node.type === 'EMANE') || [];
      if (emaneNodes.length === 0) {
        ElMessage.warning('当前没有可删除的子网');
        return;
      }
      
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('select');
      
      // @ts-ignore: 暂时忽略类型检查错误
      eventBus.emit('sidebar:delete-subnet', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入子网删除模式'
      });
      
      ElMessage.success('已进入子网删除模式，请点击要删除的子网节点');
    }
  } else if (categoryType === 'interference') {
    if (item.name === '添加干扰') {
      selectedItem.value = item;
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('add');
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setSelectedNodeType('INTERFERENCE');
      // @ts-ignore: 干扰节点无子类型，清空上次残留状态
      topoStore.setSelectedNodeSubType(null);
      item.type = 'INTERFERENCE';
      
      eventBus.emit('sidebar:item-selected', item); // Assuming generic item selection is sufficient for now

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入干扰放置模式'
      });
      
      ElMessage.success('已进入干扰放置模式，点击地图放置干扰节点，右键退出放置模式');
    } else if (item.name === '删除干扰') {
      selectedItem.value = item;
      const interferenceNodes = topoStore.topoData?.nodes?.filter((node: Node) => node.type === 'INTERFERENCE') || [];
      if (interferenceNodes.length === 0) {
        ElMessage.warning('当前没有可删除的干扰');
        return;
      }
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('select'); // Or a new mode like 'delete-interference'
      
      // @ts-ignore: 暂时忽略类型检查错误
      eventBus.emit('sidebar:delete-interference', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入干扰删除模式'
      });
      
      ElMessage.success('已进入干扰删除模式，请点击要删除的干扰节点');
    }
  } else if (categoryType === 'hardware') {
    if (item.name === '添加半实物') {
      selectedItem.value = item;

      const hardwareType = hardwareTypeMap[item.name] || 'RJ45';

        // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('add');

        // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setSelectedNodeType(hardwareType);
      // @ts-ignore: 半实物节点无子类型，清空上次残留状态
      topoStore.setSelectedNodeSubType(null);

      item.type = hardwareType;

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入半实物节点放置模式'
      });

      ElMessage.success('已进入半实物节点放置模式，点击地图放置节点，右键退出放置模式');
    } else if (item.name === '删除半实物') {
      selectedItem.value = item;

      const hardwareNodes = topoStore.topoData?.nodes?.filter((node: Node) => node.type === 'RJ45') || [];
      if (hardwareNodes.length === 0) {
        ElMessage.warning('当前没有可删除的半实物节点');
        return;
      }

      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('select');

      // @ts-ignore: 暂时忽略类型检查错误
      eventBus.emit('sidebar:delete-hardware', item);

        systemLogStore.addLog({
        type: 'normal',
        module: 'ui',
        action: '切换操作模式',
        information: '操作模式切换',
        details: '进入半实物节点删除模式'
      });

      ElMessage.success('已进入半实物节点删除模式，请点击要删除的半实物节点');
    }
  } else if (categoryType === 'application') {
    selectedItem.value = item;

    const appType = applicationTypeMap[item.name];
    if (appType) {
      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setOperationMode('add');

      // @ts-ignore: 忽略类型检查错误，该方法确实存在
      topoStore.setSelectedNodeType(appType);
      // @ts-ignore: 应用节点无子类型，清空上次残留状态
      topoStore.setSelectedNodeSubType(null);

      systemLogStore.addLog({
        type: 'normal',
        module: 'application',
        action: '进入放置模式',
        information: '应用层模型放置',
        details: `准备放置应用层模型: ${item.name}`
      });

      ElMessage.success(`已进入${item.name}模型放置模式，请在地图上点击放置位置`);
    } else {
      ElMessage.error(`未知的应用层模型类型: ${item.name}`);
    }
  } else {
    systemLogStore.addLog({
      type: 'normal',
      module: 'ui',
      action: '选择功能',
      information: '功能选择',
      details: `选择了功能: ${item.name}`
    });
    
    ElMessage.info('该功能尚未实现');
  }
};

const allCategories = [
  {
    title: '设备管理',
    type: 'device',
    items: [
      { name: '虚拟机', icon: 'Server' },
      { name: '无人机', icon: 'Drone' },
      { name: '机动车', icon: 'Van' },
      { name: '卫星', icon: 'Cloudy' },
      { name: '路由器', icon: 'NetworkDrive' },
      { name: '交换机', icon: 'DataLine' },
      { name: '基站', icon: 'OfficeBuilding' },
      { name: '视频服务器', icon: 'RTSP-RTP' },
      { name: '攻击机', icon: 'Monitor' },
      { name: '安全机', icon: 'Lock' },
      { name: 'SDN控制器', icon: 'SetUp' },
      { name: 'Ovs交换机', icon: 'Connection' },
      { name: 'P4交换机', icon: 'DataLine' },
      { name: 'SR交换机', icon: 'DataLine' },
      { name: 'PKI模型', icon: 'PKI' },
    ]
  },
  {
    title: '链路管理',
    type: 'link',
    items: [
      { name: '添加链路', icon: 'Link' },
      { name: '删除链路', icon: 'Delete' }
    ]
  },
  {
    title: '子网管理',
    type: 'subnet',
    items: [
      { name: '添加子网', icon: 'Connection' },
      { name: '删除子网', icon: 'Delete' }
    ]
  },
  {
    title: '干扰管理',
    type: 'interference',
    items: [
      { name: '添加干扰', icon: 'SetUp' },
      { name: '删除干扰', icon: 'Delete' }
    ]
  },
  {
    title: '半实物管理',
    type: 'hardware',
    items: [
      { name: '添加半实物', icon: 'Collection' },
      { name: '删除半实物', icon: 'Delete' }
    ]
  }, 
 {
    title: '业务管理',
    type: 'business',
    items: [
      { name: '流量终端', icon: 'Monitor' },
      { name: '业务终端', icon: 'DataLine' },
    ]
  },
  {
    title: '应用层模型管理',
    type: 'application',
    items: [
      { name: 'HTTP', icon: 'HTTP' },
      { name: 'TLS', icon: 'TLS' },
      { name: 'FTP', icon: 'FTP' },
      { name: 'DNS', icon: 'DNS' },
      { name: 'SMTP', icon: 'SMTP' },
      { name: 'VoIP-SIP', icon: 'VoIP-SIP' },
      { name: 'MQTT', icon: 'MQTT' },
      { name: 'CoAP', icon: 'CoAP' },
      { name: 'DDS', icon: 'DDS' },
      { name: 'SSH', icon: 'SSH' },
    ]
  }
];

// 根据场景类型过滤分类
const categories = computed(() => {
  if (isDistributedScene.value) {
    // 分布式场景只显示：设备管理中的无人机和路由器、链路管理、子网管理
    return [
      {
        title: '设备管理',
        type: 'device',
        items: [
          { name: '无人机', icon: 'Drone' },
          { name: '路由器', icon: 'NetworkDrive' }
        ]
      },
      {
        title: '链路管理',
        type: 'link',
        items: [
          { name: '添加链路', icon: 'Link' },
          { name: '分布式链路配置', icon: 'Connection' },
          { name: '删除链路', icon: 'Delete' }
        ]
      },
      {
        title: '子网管理',
        type: 'subnet',
        items: [
          { name: '添加子网', icon: 'Connection' },
          { name: '删除子网', icon: 'Delete' }
        ]
      }
    ];
  }
  // 非分布式场景显示所有分类
  return allCategories;
});

// 组件挂载时获取分布式设置
onMounted(() => {
  fetchSceneDistributedSetting();
});

// 监听 topoData 变化，重新获取分布式设置
watch(
  () => topoStore.topoData,
  (newTopoData) => {
    if (newTopoData) {
      fetchSceneDistributedSetting();
    }
  },
  { deep: true }
);

// 监听 currentSessionId 变化
watch(
  () => topoStore.currentSessionId,
  (newSessionId) => {
    if (newSessionId) {
      fetchSceneDistributedSetting();
    }
  }
);

</script>

<style scoped>
.sidebar {
  width: 224px;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(5, 22, 52, 0.92) 0%, rgba(8, 28, 68, 0.94) 48%, rgba(10, 20, 54, 0.96) 100%),
    linear-gradient(180deg, var(--sidebar-bg-from, #0a1228) 0%, var(--sidebar-bg-middle, #1a1a40) 50%, var(--sidebar-bg-to, #2c0a16) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-right: 1px solid rgba(0, 170, 255, 0.16);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  color: var(--primary-text-color, #d6e5ff);
  position: relative;
  box-shadow: inset -8px 0 18px rgba(0, 0, 0, 0.25), 8px 0 30px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

.sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 190, 255, 0.35), transparent);
  z-index: 1;
}

.sidebar-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 14px 10px 8px;
}

.sidebar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px 10px;
  margin-bottom: 10px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(0, 68, 148, 0.3) 0%, rgba(0, 34, 88, 0.2) 100%);
  border: 1px solid rgba(0, 180, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.14);
}

.sidebar-head-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sidebar-head-label {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: rgba(118, 185, 255, 0.72);
}

.sidebar-head-title {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 600;
  color: #dff2ff;
  text-shadow: 0 0 12px rgba(0, 160, 255, 0.18);
}

.sidebar-head-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 190, 255, 0.2);
  background: rgba(0, 120, 210, 0.16);
  color: #8fd7ff;
  font-size: 11px;
  line-height: 1.4;
  box-shadow: inset 0 0 12px rgba(0, 170, 255, 0.08);
}

.sidebar-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.sidebar-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(3, 37, 86, 0.36) 0%, rgba(5, 26, 62, 0.24) 100%);
  border: 1px solid rgba(0, 150, 255, 0.12);
}

.sidebar-stat-value {
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
  color: #eef9ff;
}

.sidebar-stat-label {
  font-size: 11px;
  color: rgba(142, 200, 255, 0.72);
  letter-spacing: 0.6px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.28) transparent;
  -ms-overflow-style: none;
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(0, 170, 255, 0.22);
  border-radius: 999px;
}

.sidebar::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, transparent, var(--primary-color, rgba(120, 60, 255, 0.4)), var(--secondary-color, rgba(255, 60, 120, 0.4)), transparent);
  z-index: 1;
}

.sidebar-category {
  margin-bottom: 12px;
  padding: 10px;
  position: relative;
  border: 1px solid rgba(0, 140, 255, 0.12);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(2, 27, 68, 0.42) 0%, rgba(2, 19, 48, 0.3) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.sidebar-category:last-child {
  margin-bottom: 0;
}

.sidebar-category::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 190, 255, 0.24), transparent);
}

.category-header {
  padding: 10px 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #cfeaff;
  font-size: 14px;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, rgba(0, 110, 210, 0.18) 0%, rgba(0, 140, 255, 0.1) 50%, rgba(0, 80, 170, 0.16) 100%);
  border-radius: 12px;
  margin: 0;
  position: relative;
  overflow: hidden;
  text-shadow: 0 0 10px rgba(0, 140, 255, 0.24);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  border: 1px solid rgba(0, 180, 255, 0.12);
  transition: all 0.3s ease;
}

.category-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 190, 255, 0.38), transparent);
  z-index: 1;
}

.category-header:hover {
  border-color: rgba(0, 190, 255, 0.2);
  background: linear-gradient(90deg, rgba(0, 120, 220, 0.22) 0%, rgba(0, 150, 255, 0.12) 50%, rgba(0, 90, 190, 0.18) 100%);
  box-shadow: 0 0 18px rgba(0, 150, 255, 0.08);
}

.collapse-icon {
  transition: transform 0.3s;
}

.collapse-icon .el-icon {
  color: #8fd7ff;
  font-size: 14px;
  transition: all 0.3s;
}

.collapse-icon .el-icon.collapsed {
  transform: rotate(-90deg);
}

.category-header:hover .el-icon {
  color: #ffffff;
  text-shadow: 0 0 8px rgba(0, 190, 255, 0.55);
}

.category-content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 0 2px;
  max-height: 1000px;
  overflow-y: auto;
  overflow-x: hidden;
  transition: max-height 0.3s ease;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.3) transparent;
}

.category-content::-webkit-scrollbar {
  width: 4px;
}

.category-content::-webkit-scrollbar-track {
  background: transparent;
}

.category-content::-webkit-scrollbar-thumb {
  background: rgba(0, 170, 255, 0.26);
  border-radius: 2px;
}

.category-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 170, 255, 0.4);
}

.category-content.collapsed {
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.header-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.header-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-item {
  box-sizing: border-box;
  min-height: 74px;
  padding: 10px 8px 8px;
  text-align: center;
  cursor: pointer;
  color: var(--primary-text-color, #d6e5ff);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  font-size: 12px;
  transition: all 0.3s;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(7, 44, 104, 0.3) 0%, rgba(4, 29, 72, 0.24) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 150, 255, 0.12);
}

.category-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.12), rgba(118, 185, 255, 0.2), transparent);
  transition: left 0.5s;
}

.category-item:hover::before {
  left: 100%;
}

.category-item:hover {
  background: linear-gradient(180deg, rgba(10, 68, 150, 0.38) 0%, rgba(5, 42, 102, 0.3) 100%);
  color: #ffffff;
  transform: translateY(-2px);
  border: 1px solid rgba(0, 190, 255, 0.24);
  box-shadow: 0 10px 24px rgba(0, 32, 84, 0.32), 0 0 16px rgba(0, 150, 255, 0.12);
}

.category-item.active {
  background: linear-gradient(135deg, rgba(0, 126, 255, 0.32) 0%, rgba(0, 180, 255, 0.18) 100%);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(0, 40, 92, 0.36), 0 0 18px rgba(0, 170, 255, 0.16);
  border: 1px solid rgba(0, 200, 255, 0.3);
  transform: translateY(-2px);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-bottom: 6px;
  border-radius: 10px;
  background: rgba(0, 124, 225, 0.12);
  color: #cfeaff;
  font-size: 17px;
  transition: all 0.3s;
  position: relative;
  border: 1px solid rgba(0, 170, 255, 0.12);
}

.category-item:hover .item-icon {
  color: #ffffff;
  transform: scale(1.1);
  text-shadow: 0 0 8px rgba(0, 190, 255, 0.5);
  background: rgba(0, 140, 255, 0.18);
}

.category-item.active .item-icon {
  color: #ffffff;
  text-shadow: 0 0 8px rgba(0, 200, 255, 0.5);
  background: rgba(0, 164, 255, 0.2);
}

.item-name {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  transition: all 0.3s;
  word-break: break-word;
}

.category-item:hover .item-name {
  text-shadow: 0 0 5px rgba(0, 190, 255, 0.32);
}

.category-item.active .item-name {
  text-shadow: 0 0 5px rgba(0, 190, 255, 0.36);
}

.tech-effect-footer {
  position: relative;
  height: 72px;
  min-height: 72px;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, transparent, rgba(0, 110, 215, 0.04), rgba(0, 170, 255, 0.08));
  border-top: 1px solid rgba(0, 150, 255, 0.12);
  margin-top: auto;
}

.tech-line-horizontal {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  height: 30px;
  background:
    linear-gradient(transparent, transparent 7px, rgba(120, 60, 255, 0.1) 7px, rgba(120, 60, 255, 0.1) 8px, transparent 8px) 0 0,
    linear-gradient(transparent, transparent 15px, rgba(255, 60, 120, 0.2) 15px, rgba(255, 60, 120, 0.2) 16px, transparent 16px) 0 0,
    linear-gradient(transparent, transparent 23px, rgba(120, 60, 255, 0.1) 23px, rgba(120, 60, 255, 0.1) 24px, transparent 24px) 0 0;
  animation: line-flow 15s linear infinite;
}

@keyframes line-flow {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.tech-line-vertical {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1px;
  height: 50px;
  background: linear-gradient(to top, rgba(255, 60, 120, 0.5), rgba(120, 60, 255, 0.3), transparent);
  transform: translateX(-50%);
}

.tech-line-vertical::before, .tech-line-vertical::after {
  content: "";
  position: absolute;
  width: 1px;
  height: 30px;
}

.tech-line-vertical::before {
  left: -10px;
  background: linear-gradient(to top, rgba(255, 60, 120, 0.3), transparent);
}

.tech-line-vertical::after {
  right: -10px;
  background: linear-gradient(to top, rgba(120, 60, 255, 0.3), transparent);
}

.tech-scan-beam {
  position: absolute;
  top: 0;
  left: -20%;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(120, 60, 255, 0.05), rgba(255, 60, 120, 0.05), transparent);
  animation: scan-move 4s linear infinite;
}

@keyframes scan-move {
  0% { left: -20%; }
  100% { left: 100%; }
}

.tech-dots {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
}

.tech-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  animation: dot-pulse 2s ease-in-out infinite;
}

.tech-dot:nth-child(odd) {
  background-color: rgba(120, 60, 255, 0.5);
}

.tech-dot:nth-child(even) {
  background-color: rgba(255, 60, 120, 0.5);
}

.tech-dot:nth-child(2n) {
  animation-delay: 0.4s;
}

.tech-dot:nth-child(3n) {
  animation-delay: 0.8s;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.5); opacity: 1; }
}

.tech-glow {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: radial-gradient(ellipse at center bottom, rgba(120, 60, 255, 0.2) 0%, rgba(255, 60, 120, 0.1) 40%, transparent 70%);
  animation: glow-pulse 4s ease-in-out infinite alternate;
}

@keyframes glow-pulse {
  0% { opacity: 0.3; }
  100% { opacity: 0.7; }
}

.tech-circles {
  position: absolute;
  bottom: 25px;
  right: 15px;
  width: 20px;
  height: 20px;
}

.tech-circle {
  position: absolute;
  border-radius: 50%;
  transform-origin: center;
}

.circle-1 {
  width: 12px;
  height: 12px;
  border: 1px solid rgba(255, 60, 120, 0.5);
  animation: circle-rotate 10s linear infinite;
}

.circle-2 {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(120, 60, 255, 0.5);
  animation: circle-rotate 15s linear infinite reverse;
}

.circle-3 {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(180, 60, 180, 0.5);
  animation: circle-rotate 20s linear infinite;
}

@keyframes circle-rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>