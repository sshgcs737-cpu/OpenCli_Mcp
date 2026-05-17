<template>
  <div class="resource-guide">

    <!-- 左侧分类导航条 -->
    <nav class="cat-rail">
      <div
        v-for="(cat, idx) in categories"
        :key="idx"
        class="cat-rail-item"
        :class="{ active: activeCategoryIdx === idx }"
        :title="cat.name"
        @click="activeCategoryIdx = idx; activeItemIdx = 0"
      >
        <span class="cat-rail-icon">{{ cat.icon }}</span>
        <span class="cat-rail-label">{{ cat.name }}</span>
      </div>
    </nav>

    <!-- 中间当前分类的条目列表 -->
    <aside class="item-panel">
      <div class="item-panel-header">{{ activeCategory.name }}</div>
      <div
        v-for="(item, iIdx) in activeCategory.items"
        :key="iIdx"
        class="item-entry"
        :class="{ active: activeItemIdx === iIdx }"
        @click="activeItemIdx = iIdx"
      >
        <span class="item-entry-dot"></span>
        {{ item.name }}
      </div>
    </aside>

    <!-- 右侧详情面板 -->
    <main class="guide-content">
      <template v-if="activeItem">
        <div class="detail-header">
          <h2 class="detail-title">{{ activeItem.name }}</h2>
          <span class="detail-badge">{{ activeCategory.name }}</span>
        </div>

        <section class="detail-section">
          <h3 class="section-title">功能简介</h3>
          <p class="desc-text">{{ activeItem.description }}</p>
        </section>

        <section class="detail-section" v-if="activeItem.usage && activeItem.usage.length">
          <h3 class="section-title">使用方法</h3>
          <ol class="usage-steps">
            <li v-for="(step, sIdx) in activeItem.usage" :key="sIdx">{{ step }}</li>
          </ol>
        </section>

        <section class="detail-section" v-if="activeItem.params && activeItem.params.length">
          <h3 class="section-title">可配置参数</h3>
          <table class="params-table">
            <thead>
              <tr><th>参数名称</th><th>单位/类型</th><th>说明</th></tr>
            </thead>
            <tbody>
              <tr v-for="(p, pIdx) in activeItem.params" :key="pIdx">
                <td class="param-name">{{ p.name }}</td>
                <td class="param-unit">{{ p.unit }}</td>
                <td>{{ p.desc }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="detail-section" v-if="activeItem.options && activeItem.options.length">
          <h3 class="section-title">可选项 / 子类型</h3>
          <div class="option-cards">
            <div class="option-card" v-for="(opt, oIdx) in activeItem.options" :key="oIdx">
              <div class="option-card-title">{{ opt.label }}</div>
              <div class="option-card-desc">{{ opt.desc }}</div>
            </div>
          </div>
        </section>

        <section class="detail-section" v-if="activeItem.notes && activeItem.notes.length">
          <h3 class="section-title warning">注意事项</h3>
          <ul class="notes-list">
            <li v-for="(n, nIdx) in activeItem.notes" :key="nIdx">{{ n }}</li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeCategoryIdx = ref(0);
const activeItemIdx = ref(0);

const tabMap: Record<string, number> = { '1-1': 0, '1-2': 1, '1-3': 2, '1-4': 3, '1-5': 4, '1-6': 5, '1-7': 6 };
const initTab = (route.query.tab as string) || '1-1';
if (tabMap[initTab] !== undefined) activeCategoryIdx.value = tabMap[initTab];

watch(() => route.query.tab, (newTab) => {
  const tab = (newTab as string) || '1-1';
  if (tabMap[tab] !== undefined) {
    activeCategoryIdx.value = tabMap[tab];
    activeItemIdx.value = 0;
  }
});

interface Param { name: string; unit: string; desc: string }
interface Option { label: string; desc: string }
interface ResourceItem { name: string; description: string; usage?: string[]; params?: Param[]; options?: Option[]; notes?: string[] }
interface Category { name: string; icon: string; items: ResourceItem[] }

const categories = ref<Category[]>([
  {
    name: '典型装备库', icon: '',
    items: [
      {
        name: '路由器',
        description: '网络核心节点，基于容器运行的路由转发设备。支持IP地址配置、路由协议下发、与其他节点建立有线/无线链路。在态势展示页面中可通过右键菜单查看详细信息、配置协议、打开终端等。',
        usage: ['在"仿真场景编辑"页面先新建或加载场景', '进入"态势展示"页面，在左侧"设备管理"中点击"路由器"进入放置模式', '在地图上单击目标位置，弹出"节点配置"对话框后完成名称和坐标设置', '需要连线时，在左侧"链路管理"中点击"添加链路"，依次点击两个节点建立连接', '如需协议配置，可右键路由器→"节点操作"→"协议配置"，打开"网卡协议配置"窗口', '如需命令行，可右键路由器→"节点操作"→"打开终端"'],
        params: [{ name: '名称 (name)', unit: '字符串', desc: '路由器的显示名称' }, { name: 'X（东向）', unit: 'm', desc: 'ENU坐标系中的东向偏移量，由地图点击位置自动转换' }, { name: 'Y（北向）', unit: 'm', desc: 'ENU坐标系中的北向偏移量，由地图点击位置自动转换' }, { name: 'H（高度）', unit: 'm', desc: '节点高度，可手动输入' }, { name: '角色 (role)', unit: '选择', desc: '公共/红方/蓝方（攻防模式下）' }],
        notes: ['协议配置需在场景启动前完成，启动后自动生效', '"协议配置"入口主要面向支持 nest:v3 镜像的路由器节点']
      },
      {
        name: '虚拟机',
        description: '基于KVM虚拟化的完整虚拟机节点。支持从预置模板创建，可自定义CPU核心数、内存大小，提供VNC远程桌面访问。适合需要运行完整操作系统或特殊软件的场景。',
        usage: ['进入"态势展示"页面，在左侧"设备管理"中点击"虚拟机"进入放置模式', '在地图上放置节点后，在"节点配置"中选择一个 VM 模板', '创建完成后，可在节点信息面板或右键"节点操作"中执行"启动虚拟机"、"关闭虚拟机"、"编辑参数"', '启动成功后系统会建立 VNC 连接，用于远程桌面访问'],
        params: [{ name: 'CPU核心数', unit: '个', desc: '分配给虚拟机的处理器核心数' }, { name: '当前内存', unit: 'MB', desc: '虚拟机实际使用的内存' }, { name: '最大内存', unit: 'MB', desc: '虚拟机可使用的最大内存' }, { name: '模板ID', unit: '数字', desc: '从后端模板库选择的虚拟机模板标识' }],
        notes: ['虚拟机需要手动启动和停止', '虚拟机资源消耗较大，请合理规划', '停止场景前建议先停止虚拟机']
      },
      {
        name: '无人机',
        description: '可移动的空中网络节点，支持路径规划和移动控制。可在3D地图上绘制移动路径，设置航点和速度，仿真运行时无人机将沿预定路径移动。可通过分布式链路快速组网。',
        usage: ['在"态势展示"页面左侧"设备管理"中点击"无人机"进入放置模式', '在地图上单击放置节点，可在"节点配置"中设置名称、坐标、协议及多节点快速放置参数', '需要规划飞行路线时，点击顶部工具栏"绘制路径"打开无人机路径面板', '在分布式场景中，可通过左侧"链路管理"中的"分布式链路配置"完成批量组网', '启动仿真后，无人机按已配置路径进行运动'],
        params: [{ name: '名称', unit: '字符串', desc: '无人机显示名称' }, { name: '移动路径', unit: '航点序列', desc: '由X/Y/H坐标组成的移动路线，在地图上逐点点击生成' }, { name: '移动速度', unit: 'm/s', desc: '无人机沿路径移动的速度' }, { name: 'X/Y/H', unit: 'm', desc: '初始位置坐标（ENU坐标系，X东向/Y北向/H高度）' }],
        notes: ['路径绘制需在仿真启动前完成']
      },
      {
        name: '基站 / 交换机 / SDN',
        description: '基站为周围节点提供无线接入服务；交换机用于二层数据转发；SDN控制器和OVS交换机配合实现软件定义网络。',
        usage: ['在"态势展示"页面左侧"设备管理"中选择"基站"、"交换机"、"Ovs交换机"、"SDN控制器"等节点类型', '在地图上单击放置节点，并在弹出的"节点配置"中完成基础信息设置', '通过左侧"链路管理"→"添加链路"将其接入路由器、终端或子网', '子网节点可通过添加链路与基站或其它节点建立无线接入关系'],
        options: [{ label: '基站 (BASESTATION)', desc: '无线基站，通常与子网配合使用' }, { label: '普通交换机 (SWITCH)', desc: '基础二层数据转发' }, { label: 'Ovs交换机 (Ovs_SWITCH)', desc: 'Open vSwitch 虚拟交换机，支持与 SDN 控制器配合使用' }, { label: 'SDN控制器 (SDN_CONTROLLER)', desc: '软件定义网络控制平面，管理 OVS 流表' }, { label: 'P4交换机 (P4_SWITCH)', desc: '可编程数据平面交换机类型' }, { label: 'SR交换机 (SR_SWITCH)', desc: '面向 SR 场景的交换机类型' }],
        notes: ['交换机节点的接口IP地址会自动置空（二层设备不需要IP）']
      },
      {
        name: '干扰节点',
        description: '电磁干扰源节点，用于模拟无线环境中的干扰信号。可配置干扰功率、频率、方位角和俯仰角等参数。启动后会对指定方向和频段的无线通信产生干扰效果。',
        usage: ['在"态势展示"页面左侧"干扰管理"中点击"添加干扰"进入放置模式', '在地图上单击放置干扰节点，完成名称和坐标配置', '创建后可通过右键节点→"节点操作"→"配置干扰参数"设置功率、频率、方位角和俯仰角', '在干扰节点信息面板中使用"开启干扰"开关控制干扰启停'],
        params: [{ name: '干扰功率', unit: 'dB', desc: '干扰信号的发射功率' }, { name: '干扰频率', unit: 'Hz', desc: '干扰信号的工作频率' }, { name: '方位角', unit: '°', desc: '干扰方向的水平角度' }, { name: '俯仰角', unit: '°', desc: '干扰方向的垂直角度' }],
        notes: ['干扰节点需要手动开启和关闭', '干扰效果取决于子网的无线模型配置']
      },
      {
        name: '半实物',
        description: '半实物(RJ45)用于将真实物理网络设备接入仿真环境。',
        usage: ['在"态势展示"页面左侧"半实物管理"中点击"添加半实物"进入放置模式', '在地图上放置节点后，在"节点配置"中选择可用物理网口（ens52f0 ~ ens52f3）', '通过左侧"链路管理"→"添加链路"将半实物节点接入路由器或交换机'],
        options: [{ label: '半实物 (RJ45)', desc: '物理网口接入，实现仿真与真实网络互联' }],
        notes: ['半实物需要物理服务器有对应可用网络接口', '每个物理网口只能被一个半实物节点占用']
      },
      {
        name: '攻击机 / 安全机',
        description: '攻防对抗模式专用设备。攻击机用于模拟网络攻击行为，安全机用于模拟防御措施。',
        usage: ['在"态势展示"页面左侧"设备管理"中选择"攻击机"或"安全机"进入放置模式', '在地图上单击放置节点，并完成名称、坐标等基础配置', '通过"添加链路"将设备接入现有拓扑，必要时在非普通模式下为节点设置角色', '启动仿真后结合现有拓扑开展攻防演练'],
        notes: ['专为攻防模式设计']
      }
    ]
  },
  {
    name: '协议库', icon: '',
    items: [
      {
        name: 'OSPFv2',
        description: '开放最短路径优先协议第2版（IPv4）。链路状态路由协议，支持区域划分，适用于中大型IPv4网络。通过Dijkstra算法计算最短路径，收敛速度快，支持等价多路径（ECMP）。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"，打开"网卡协议配置"窗口', '勾选 OSPFv2，选择参与协议的网卡（可多选）', '填写区域 ID（如 0 或 0.0.0.0）后保存', '启动仿真后协议配置自动生效'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与OSPFv2协议的网络接口，可选多个' }, { name: '区域ID (areaId)', unit: '数字/点分十进制', desc: '所属OSPF区域，如 0（骨干区域）或 0.0.0.1（非骨干区域）' }],
        notes: ['OSPFv2仅支持IPv4，IPv6请使用OSPFv3', '骨干区域（Area 0）必须与其他区域相连', '启动仿真时系统自动调用接口使配置生效，停止时自动重置']
      },
      {
        name: 'OSPFv3',
        description: '开放最短路径优先协议第3版（IPv6）。OSPFv2的IPv6版本，与OSPFv2运行机制相同但支持IPv6地址空间，支持区域划分和多接口配置。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"，打开"网卡协议配置"窗口', '勾选 OSPFv3，选择参与协议的网卡（可多选）', '填写区域 ID 后保存，并在 IPv6 网络场景中启动仿真验证'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与OSPFv3协议的网络接口' }, { name: '区域ID (areaId)', unit: '数字', desc: '所属OSPF区域，如 0（对应0.0.0.0）' }],
        notes: ['OSPFv3专用于IPv6，IPv4请使用OSPFv2', '区域ID格式与OSPFv2相同，但运行在IPv6网络上']
      },
      {
        name: 'OLSR',
        description: '优化链路状态路由协议（Optimized Link State Routing）。一种面向自组织网络和无线 Mesh 网络的主动式路由协议，通过多点中继（MPR）机制减少控制报文泛洪开销，适合节点动态变化较频繁的无线网络场景。',
        usage: ['新增无人机或基站节点时，在弹出的"节点配置"对话框中找到"协议配置"区域', '勾选 OLSR 选项后完成节点创建', '再通过链路或子网把节点接入网络，启动仿真后验证路由收敛效果'],
        params: [{ name: '接口/服务', unit: '选择', desc: '参与 OLSR 路由发现与维护的网络接口或对应服务配置项' }],
        notes: ['OLSR适合拓扑变化较快的自组网与无线网络场景', '当前界面中的 OLSR 入口主要位于无人机/基站创建阶段，节点创建后可在信息面板查看已启用服务']
      },
      {
        name: 'RIP',
        description: '路由信息协议（Routing Information Protocol）。距离矢量路由协议，使用跳数作为度量值，最大跳数15。配置简单，适用于小型网络，收敛速度较慢。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 RIP', '选择参与 RIP 的网卡后保存', '启动仿真后验证路由学习结果'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与RIP路由协议的网络接口' }],
        notes: ['RIP最大跳数为15，超过则视为不可达，不适合大型网络', '收敛速度比OSPF慢，不建议在大型复杂拓扑中使用']
      },
      {
        name: 'BGP',
        description: '边界网关协议（Border Gateway Protocol）。路径矢量协议，用于自治系统（AS）之间的路由交换。支持配置本地AS号及多个BGP邻居（Peer）关系。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 BGP', '填写本地 AS 号，使用"添加邻居"录入邻居 IP 和邻居 AS', '保存后启动仿真，检查邻居建连情况'],
        params: [{ name: '本地AS号 (localAs)', unit: '整数', desc: '本节点所在自治系统的AS编号，如 65001' }, { name: '邻居IP (neighborIp)', unit: 'IP地址', desc: 'BGP对端路由器的IP地址' }, { name: '邻居AS (neighborAs)', unit: '整数', desc: 'BGP对端路由器所在的AS编号' }],
        notes: ['BGP邻居需双方均配置方可建立连接', '可配置多个BGP邻居，通过"添加邻居"按钮增加', 'IBGP（同AS）和EBGP（跨AS）均支持']
      },
      {
        name: 'IS-IS',
        description: '中间系统到中间系统路由协议（Intermediate System to Intermediate System）。链路状态协议，与OSPF类似，广泛用于ISP骨干网。使用NET地址标识路由器。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 IS-IS', '选择参与协议的网卡，填写进程名和 NET 地址', '保存后启动仿真验证域内连通性'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与IS-IS协议的网络接口' }, { name: '进程名 (process)', unit: '字符串', desc: 'IS-IS路由进程标识名称' }, { name: 'NET地址 (netAddr)', unit: 'NSAP格式', desc: '网络实体标题，如 49.0001.0000.0000.0000.00，唯一标识路由器' }],
        notes: ['NET地址需在整个IS-IS域内唯一', 'NET格式：区域地址 + 系统ID（6字节）+ SEL（00）']
      },
      {
        name: 'PIM',
        description: '协议无关组播路由协议（Protocol Independent Multicast）。支持组播流量转发，与底层单播路由协议无关。适用于需要视频流、广播等一对多通信的仿真场景。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 PIM', '选择参与组播的网卡后保存', '结合单播路由协议启动仿真，验证组播转发效果'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与PIM组播路由的网络接口' }],
        notes: ['PIM需配合单播路由协议（如OSPF）使用', '适用于需要组播流量转发的仿真场景']
      },
      {
        name: 'Snapshot',
        description: 'Snapshot路由协议。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 Snapshot', '选择参与协议的网卡后保存', '启动仿真后结合业务流量观察路由状态记录效果'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与Snapshot记录的网络接口' }],
        notes: ['Snapshot路由用于记录特定时刻的路由状态，便于仿真重放和对比']
      },
      {
        name: 'Backpressure',
        description: 'Backpressure协议。',
        usage: ['在"态势展示"页面右键支持协议配置的路由器节点', '选择"节点操作"→"协议配置"并勾选 Backpressure', '选择参与协议控制的网卡后保存', '启动仿真后观察队列积压对路径选择的影响'],
        params: [{ name: '接口 (interfaces)', unit: '多选', desc: '参与协议路由的网络接口' }],
        notes: ['背压路由通过队列积压信息动态调整路由，适合流量管控场景']
      },
      {
        name: '静态路由',
        description: '手动指定数据包转发路径的静态路由配置。通过明确指定目标网络、下一跳地址和出接口来控制流量走向，优先级高于动态路由协议',
        usage: ['对于 nest:v3 路由器：右键节点→"节点操作"→"协议配置"，在下方"静态路由配置"区域维护静态路由', '对于其他 DOCKER 节点：右键节点→"节点操作"→"静态路由"打开同一配置对话框', '点击"添加静态路由"，填写目标网络、下一跳和可选网卡名', '保存后在场景运行时按配置生效'],
        params: [{ name: '目标网络 (destination)', unit: 'CIDR', desc: '数据包的目标网络地址，如 10.0.0.0/24' }, { name: '下一跳 (nexthop)', unit: 'IP地址', desc: '数据包转发的下一跳路由器IP，如 10.0.1.20' }, { name: '出接口 (interface)', unit: '接口名', desc: '可选，指定从哪个接口发出，如 eth0；留空则由系统决定' }],
        notes: ['静态路由优先级高于动态路由协议', '该入口并非所有节点都显示，仅对相关 DOCKER 节点开放', '场景启动时自动生效，停止时自动重置']
      }
    ]
  },
  {
    name: '链路库', icon: '',
    items: [
      {
        name: '有线链路',
        description: '节点之间的有线网络连接。支持配置带宽、延迟、丢包率、抖动等网络参数，用于模拟真实有线网络环境的各种特性。',
        usage: ['在"态势展示"左侧"链路管理"中点击"添加链路"进入连接模式', '依次点击源节点和目标节点，弹出"链路配置"对话框', '为两端接口填写名称、IP / 掩码等信息，并设置带宽、延迟、丢包、抖动等参数', '确认后创建链路；如需删除，可在"链路管理"中点击"删除链路"后选中目标链路'],
        params: [{ name: '带宽 (bandwidth)', unit: 'bps', desc: '链路最大传输速率，0表示不限制' }, { name: '延迟 (delay)', unit: 'ms', desc: '数据包传输延迟时间' }, { name: '丢包率 (loss)', unit: '%', desc: '数据包丢失概率(0-100)' }, { name: '抖动 (jitter)', unit: 'ms', desc: '延迟波动范围' }, { name: '缓冲区 (buffer)', unit: 'KB', desc: '链路缓冲区大小' }, { name: '重复率 (dup)', unit: '%', desc: '数据包重复发送概率' }, { name: '突发流量 (burst)', unit: 'KB', desc: '突发数据量' }, { name: '最大突发 (mburst)', unit: 'KB', desc: '最大突发数据量' }, { name: 'MTU', unit: 'bytes', desc: '最大传输单元大小' }, { name: '单向链路', unit: '开关', desc: '是否设置为单向传输链路' }],
        notes: ['带宽设置为0表示不限制', '链路参数可在仿真运行过程中动态修改']
      },
      {
        name: '无线链路',
        description: '基于无线仿真引擎的无线链路连接。节点通过加入同一个子网自动建立无线链路。无线链路质量由子网的无线模型参数决定。',
        usage: ['在"态势展示"左侧"子网管理"中点击"添加子网"，在地图上放置子网节点', '在"子网配置"中选择链路层模型、物理层模型并完成参数设置', '再通过"链路管理"→"添加链路"把普通节点连接到该子网节点', '连接到同一子网的节点按子网模型参与无线通信'],
        notes: ['无线链路质量由子网模型的物理层参数决定', '节点之间的距离会影响信号强度和通信质量']
      },
      {
        name: '分布式链路（批量组网）',
        description: '快速将多个节点（如无人机群）连接到同一个子网的批量组网功能。可一次性选择多个节点，自动创建路由器中继链，并统一配置链路参数。',
        usage: ['该功能仅在分布式场景下使用', '在"态势展示"左侧"链路管理"中点击"分布式链路配置"', '在对话框中选择无人机、目标子网，可选配置路由器链、自动分配 IP 和链路参数', '确认后系统批量创建链路并完成组网'],
        params: [{ name: '目标子网', unit: '选择', desc: '连接到哪个子网' }, { name: '路由器链路', unit: '节点序列', desc: '中继路由器的串联顺序' }, { name: '自动IP分配', unit: '开关', desc: '是否自动分配IP地址' }, { name: 'IP地址范围', unit: 'CIDR', desc: '自动分配的IP段' }],
        notes: ['适合大规模无人机集群快速组网', '普通单服务器场景下不会显示该入口']
      }
    ]
  },
  {
    name: '无线模型库', icon: '',
    items: [
      {
        name: '链路层模型',
        description: '子网的MAC层模型选择，决定无线链路的数据链路层行为特性。系统提供12种链路层模型，覆盖WiFi、以太网、Zigbee、TSN、LTE等多种通信标准。',
        usage: ['在"态势展示"中通过"子网管理"→"添加子网"放置子网节点', '在弹出的"子网配置"中先选择链路层模型，再选择可用的物理层模型', '确认进入参数页后，在"MAC参数 / 物理层参数"标签页完成配置'],
        options: [
          { label: 'Bypass（透传）', desc: '简单旁路模型，数据直接透传，适用于直接测试。可选物理层：CDMA' },
          { label: 'CommEffect（通信效应）', desc: '通信效果模型，提供基础的延迟和丢包功能。可选物理层：CDMA' },
          { label: 'RF Pipe（射频管道）', desc: '无线频率管道模型，用于模拟基本射频通信。可选物理层：FHSS / DSSS / CDMA' },
          { label: 'TDMA（时分多址）', desc: '时分多址接入模型，适用于多用户时分接入场景。需配置时隙调度文件。可选物理层：FHSS / OFDM' },
          { label: 'IEEE 802.11 a/b/g（WiFi）', desc: 'WiFi模型，基于IEEE 802.11 a/b/g标准。可选物理层：DSSS / FHSS / OFDM' },
          { label: 'IEEE 802.3（以太网）', desc: '以太网模型，有线传输标准。' },
          { label: 'IEEE 802.15.4（Zigbee）', desc: 'Zigbee低功耗设备通信模型。可选物理层：DSSS / ZigBee。' },
          { label: 'IEEE 802.1Qbv（TSN时间调度）', desc: 'TSN模型，提供确定性传输调度。' },
          { label: 'IEEE 802.1CB（TSN冗余）', desc: 'TSN模型，帧复制与消除提升网络可靠性。' },
          { label: 'IEEE 802.1Qbu（TSN抢占）', desc: 'TSN模型，允许高优先级帧中断低优先级帧。' },
          { label: 'IEEE 802.1AS（TSN时钟同步）', desc: 'TSN模型，实现亚微秒级时钟同步。' },
          { label: 'LTE（4G移动通信）', desc: '长期演进模型，4G移动通信标准。可选物理层：OFDM / PDCCH / PBCH / PRACH' }
        ],
        notes: ['TDMA模型可在右键子网→"节点操作"→"时隙配置"中继续分配时隙', '当前界面展示的部分标准名称会映射到系统已实现模型：IEEE 802.3 / IEEE 802.15.4 / IEEE 802.1Qbu / LTE 映射到 TDMA，IEEE 802.1Qbv / IEEE 802.1CB / IEEE 802.1AS 映射到 IEEE 802.11 a/b/g']
      },
      {
        name: '物理层模型',
        description: '创建子网时可选择物理层模型，决定无线信号的调制和扩频方式。不同链路层模型可搭配不同的物理层模型，系统会自动过滤不可用的选项。',
        usage: ['先选择链路层模型后，系统会自动过滤当前可用的物理层模型', '选择物理层后继续在"物理层参数"标签页填写频率、带宽、功率等参数', '对于无物理层的模型，界面不会要求额外物理层配置'],
        options: [
          { label: 'FHSS（跳频扩频）', desc: '通过快速改变载波频率提高抗干扰能力。适用于：RF Pipe / TDMA / IEEE 802.11' },
          { label: 'DSSS（直接序列扩频）', desc: '提供更高的数据传输安全性和抗干扰能力。适用于：RF Pipe / IEEE 802.11 / IEEE 802.15.4' },
          { label: 'OFDM（正交频分复用）', desc: '高效利用频谱资源，提高传输速率。适用于：TDMA / IEEE 802.11 / LTE' },
          { label: 'CDMA（码分多址）', desc: '使用直接扩频实现多用户同频共享，具有抗干扰和软切换能力。适用于：Bypass / CommEffect / RF Pipe' },
          { label: 'ZigBee', desc: '基于IEEE 802.15.4的低功耗无线网状网络技术，支持O-QPSK调制和DSSS扩频。适用于：IEEE 802.15.4' },
          { label: 'PDCCH（物理下行控制信道）', desc: '用于LTE和5G网络的控制信息传输。适用于：LTE' },
          { label: 'PBCH（物理广播信道）', desc: '用于传输主要系统信息和网络配置。适用于：LTE' },
          { label: 'PRACH（物理随机接入信道）', desc: '使用Zadoff-Chu序列实现LTE/5G网络的初始接入和同步。适用于：LTE' }
        ],
        notes: ['系统会根据所选链路层模型自动过滤可用的物理层选项', '有线模型无物理层选择']
      },
      {
        name: '物理层参数配置',
        description: '子网的物理层参数配置，决定无线信号的传播特性。包括频率、功率、带宽、传播模型等核心射频参数。Bypass和CommEffect模型没有物理层参数。',
        usage: ['子网创建完成时，或后续右键子网→"节点操作"→"修改参数"，均可进入子网参数配置', '在"物理层参数"标签页设置频率、发射功率、带宽、传播模型等射频参数', '如使用 TDMA，还需结合"时隙配置"填写调度文件、时隙数和节点时隙映射'],
        params: [{ name: '带宽 (bandwidth)', unit: 'Hz', desc: '射频信号带宽' }, { name: '频率 (frequency)', unit: 'Hz', desc: '中心工作频率，默认2.4GHz' }, { name: '发射功率 (txpower)', unit: 'dBm', desc: '无线信号发射功率' }, { name: '传播模型 (propagationmodel)', unit: '选择', desc: 'freespace(自由空间) / 2ray(双射线) / precomputed(预计算)' }, { name: '系统噪声系数 (systemnoisefigure)', unit: 'dB', desc: '接收机系统噪声系数，默认7.0' }, { name: '信道编码 (channelcode)', unit: '选择', desc: 'none / ldpc12 / ldpc23' }, { name: '多普勒频移 (dopplershiftenable)', unit: '开关', desc: '是否启用多普勒效应模拟' }, { name: '固定天线增益 (fixedantennagain)', unit: 'dBi', desc: '天线增益值' }, { name: '频率兴趣点 (frequencyofinterest)', unit: 'Hz', desc: '感兴趣的频率点' }, { name: '噪声模式 (noisemode)', unit: '选择', desc: 'none / all / outofband / passthrough' }, { name: '随机损耗环境 (randomlossenvironment)', unit: '选择', desc: 'none / urban / suburban' }, { name: '衰落模型 (fadingmodel)', unit: '选择', desc: 'None(无) / Lognormal(对数正态) / Nakagami(纳加米) / Rician(莱斯) / Rayleigh(瑞利) / Terahertz(太赫兹) / TimeVarying(时变)' }, { name: 'TDMA时隙数 (slots)', unit: '个', desc: '仅TDMA模型：TDMA帧中的总时隙数量' }, { name: 'TDMA时隙时长 (slotduration)', unit: 'ms', desc: '仅TDMA模型：每个时隙的持续时间' }],
        notes: ['频率设置需与实际仿真场景匹配', 'Bypass和CommEffect模型没有物理层参数', '衰落模型：莱斯和瑞利在后端使用纳加米实现；Terahertz适用于300GHz以上频段', 'TDMA模型需要在时隙配置中分配节点并生成调度文件后方可使用，所有节点需至少分配一个时隙']
      }
    ]
  },
  {
    name: '目标库', icon: '',
    items: [
      {
        name: 'HTTP',
        description: '超文本传输协议模型，用于模拟典型 Web 访问业务。适用于浏览器访问、页面资源请求、接口调用等应用层交互场景。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"HTTP"进入放置模式', '在地图上放置 HTTP 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后观察 Web 请求类业务的连通性与时延表现'],
        params: [{ name: '服务类型', unit: 'HTTP', desc: '用于模拟基于请求/响应模式的 Web 业务通信' }],
        notes: ['适合验证网页访问、接口调用等基础应用层通信场景']
      },
      {
        name: 'TLS',
        description: '传输层安全协议模型，用于模拟加密会话建立与安全传输过程。适用于 HTTPS、安全控制信道和加密业务流量测试。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"TLS"进入放置模式', '在地图上放置 TLS 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后观察加密业务在当前网络条件下的通信效果'],
        params: [{ name: '安全传输', unit: 'TLS', desc: '用于模拟带有加密握手与安全会话的数据传输' }],
        notes: ['适合验证安全传输场景下的时延、连通性和业务可用性']
      },
      {
        name: 'FTP',
        description: '文件传输协议模型，用于模拟主机间的大文件上传、下载和目录访问业务。适合测试带宽占用、链路稳定性和长连接传输能力。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"FTP"进入放置模式', '在地图上放置 FTP 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后观察文件传输类业务对带宽和时延的敏感性'],
        params: [{ name: '传输业务', unit: 'FTP', desc: '用于模拟文件上传、下载等大流量业务行为' }],
        notes: ['适合评估链路带宽、丢包和时延对文件传输效率的影响']
      },
      {
        name: 'DNS',
        description: '域名解析协议模型，用于模拟域名到 IP 地址的查询与应答流程。适合用于业务访问前的解析过程验证与依赖分析。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"DNS"进入放置模式', '在地图上放置 DNS 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后观察解析请求与响应是否正常完成'],
        params: [{ name: '解析业务', unit: 'DNS', desc: '用于模拟域名查询、记录返回等解析过程' }],
        notes: ['适合与 HTTP、TLS 等上层业务联合验证完整访问链路']
      },
      {
        name: 'SMTP',
        description: '简单邮件传输协议模型，用于模拟邮件提交、转发和投递流程。适合验证消息类业务在复杂网络中的传输可用性。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"SMTP"进入放置模式', '在地图上放置 SMTP 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后测试邮件类业务在当前网络条件下的传输效果'],
        params: [{ name: '邮件业务', unit: 'SMTP', desc: '用于模拟邮件发送、转发与到达过程' }],
        notes: ['适合验证消息投递类业务在高时延或高丢包链路下的表现']
      },
      {
        name: 'VoIP-SIP',
        description: '基于 SIP 的语音业务模型，用于模拟实时语音呼叫建立、会话维护与控制流程。适合测试实时交互类通信业务。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"VoIP-SIP"进入放置模式', '在地图上放置 VoIP-SIP 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后测试呼叫建立与语音业务效果'],
        params: [{ name: '会话控制', unit: 'SIP', desc: '用于模拟实时语音业务的呼叫建立、保持与释放过程' }],
        notes: ['适合评估时延、抖动和丢包对实时语音业务质量的影响']
      },
      {
        name: 'MQTT',
        description: '消息队列遥测传输协议模型，用于模拟轻量级发布/订阅消息通信。适合物联网、遥测上报和事件通知等场景。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"MQTT"进入放置模式', '在地图上放置 MQTT 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后观察发布/订阅消息的分发效果'],
        params: [{ name: '消息模式', unit: '发布/订阅', desc: '用于模拟轻量级消息发布与订阅通信' }],
        notes: ['适合低带宽、弱网络或终端数量较多的消息通信场景']
      },
      {
        name: 'CoAP',
        description: '受限应用协议模型，用于模拟面向资源受限设备的轻量级应用层通信。常用于传感器、控制设备和低功耗终端。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"CoAP"进入放置模式', '在地图上放置 CoAP 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后测试轻量级请求/响应业务'],
        params: [{ name: '轻量通信', unit: 'CoAP', desc: '用于模拟资源受限场景下的应用层交互' }],
        notes: ['适合低功耗设备、边缘节点和轻量物联网控制场景']
      },
      {
        name: 'DDS',
        description: '数据分发服务模型，用于模拟面向实时系统的数据发布与订阅通信机制。适合无人系统、工业控制和高实时性协同场景。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"DDS"进入放置模式', '在地图上放置 DDS 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后测试实时数据分发与协同效果'],
        params: [{ name: '数据分发', unit: 'DDS', desc: '用于模拟高实时性发布/订阅型数据交换' }],
        notes: ['适合实时控制、协同决策和分布式感知类业务验证']
      },
      {
        name: 'SSH',
        description: '安全外壳协议模型，用于模拟远程登录、命令执行和安全管理链路。适合验证远程运维与控制平面的可达性。',
        usage: ['在"态势展示"左侧"应用层模型管理"中点击"SSH"进入放置模式', '在地图上放置 SSH 应用节点，并通过"添加链路"将其接入其它节点或子网', '启动仿真后测试远程登录和控制链路'],
        params: [{ name: '远程管理', unit: 'SSH', desc: '用于模拟远程登录、命令执行和安全控制连接' }],
        notes: ['适合验证运维管理链路在复杂网络环境下的稳定性与安全性']
      }
    ]
  },
  {
    name: '工具库', icon: '',
    items: [
      {
        name: '链路测量（主动测量）',
        description: '端到端的链路性能主动测量。从源节点主动发送测试数据包到目标节点，测量延迟、带宽、丢包率等性能指标。',
        usage: ['进入"测试工具"页面的主动测量功能', '系统会自动带入当前场景 ID，点击"从容器链路选择"添加待测链路', '选择测量类型并设置测试时长、带宽限制等参数后开始测量', '在结果页查看链路性能统计结果'],
        params: [{ name: '源容器', unit: '选择', desc: '测量的源节点容器名' }, { name: '目标容器', unit: '选择', desc: '测量的目标节点容器名' }, { name: '会话ID', unit: '数字', desc: '当前仿真场景的会话标识' }],
        notes: ['需要在场景运行状态下执行', '测量结果支持分页查询和状态过滤']
      },
      {
        name: '节点测量（被动测量）',
        description: '在指定节点上进行被动网络流量监测。不主动发送数据包，而是监听并统计经过该节点的网络流量特征。',
        usage: ['进入"测试工具"页面的被动测量功能', '选择要监测的容器节点', '配置监测参数并开始监测', '在结果页查看统计数据'],
        params: [{ name: '容器', unit: '选择', desc: '要进行被动监测的节点容器名' }, { name: '会话ID', unit: '数字', desc: '当前场景会话标识' }],
        notes: ['被动测量不产生额外网络流量']
      },
      {
        name: '节点控制',
        description: '对仿真场景中的可移动节点（如无人机）进行实时位置控制和运动管理。支持在态势展示地图上选中节点后，通过控制面板对节点进行移动、定位和状态调整。',
        usage: ['在"态势展示"顶部工具栏点击"控制节点"图标（Place 图标）', '系统打开无人机控制面板，列出当前场景中可控制的移动节点', '选择目标节点后，可在地图上点击设定新位置或通过面板输入坐标', '支持批量控制多个节点的运动状态'],
        notes: ['需要在仿真场景加载后使用', '主要用于无人机等可移动节点的实时位置调整', '控制操作在仿真运行期间实时生效']
      },
      {
        name: '绘制路径',
        description: '为可移动节点（如无人机）绘制预定义的飞行/移动路径。在3D地图上通过逐点点击的方式规划航点序列，设定移动速度，仿真启动后节点按路径自动移动。',
        usage: ['在"态势展示"顶部工具栏点击"绘制路径"图标（AddLocation 图标）', '系统打开无人机路径绘制面板', '在地图上依次点击航点位置，生成由 X/Y/H 坐标组成的移动路线', '设置移动速度后保存路径，仿真启动后节点沿路径运动'],
        params: [{ name: '航点坐标', unit: 'm', desc: '路径中每个航点的 X（东向）/Y（北向）/H（高度）坐标' }, { name: '移动速度', unit: 'm/s', desc: '节点沿路径移动的速度' }],
        notes: ['路径绘制需在仿真启动前完成', '支持多个节点分别设定不同路径', '路径航点在地图上以连线形式可视化展示']
      },
      {
        name: '即时通信',
        description: '仿真环境内置的即时通信工具，支持同一仿真场景中的多用户实时文字交流。适用于多人协同仿真时的沟通协调。',
        usage: ['在"态势展示"顶部工具栏点击"即时通信"图标（ChatDotRound 图标）', '系统打开聊天面板，显示当前场景的消息列表', '在输入框中输入消息并发送，所有在线用户可实时接收', '支持拖拽移动聊天面板位置，支持最小化'],
        notes: ['聊天面板关闭时，有新消息会在工具栏图标上显示未读角标', '消息仅在当前仿真场景内有效', '支持多人同时在线交流']
      },
    ]
  },
  {
    name: '场景库', icon: '',
    items: [
      {
        name: '场景管理',
        description: '仿真场景的全生命周期管理。支持创建、编辑、删除场景，支持私有/公有场景，支持普通模式和攻防模式。',
        usage: ['在"仿真场景编辑"页面查看私有/公有场景列表', '点击"新增场景"创建场景，可选择公有/私有以及单服务器/分布式场景', '加载场景后，再进入"态势展示"页面进行组网与仿真'],
        options: [{ label: '私有场景', desc: '仅创建者可见和编辑' }, { label: '公有场景', desc: '所有用户可见' }, { label: '单服务器场景', desc: '普通单机部署的场景类型' }, { label: '分布式场景', desc: '支持分布式链路配置与多服务器协同的场景类型' }],
        notes: ['分布式场景创建通常需要对应权限', '删除场景将同时删除其所有节点和链路数据']
      },
      {
        name: '仿真控制',
        description: '仿真运行控制，包括启动、暂停、停止仿真。启动时可配置仿真时长和步长。支持录制回放功能。',
        usage: ['在"态势展示"顶部工具栏点击启动按钮', '在仿真配置面板中设置持续时间、步长等参数并确认启动', '运行过程中可使用顶部按钮暂停或停止仿真'],
        params: [{ name: '仿真时长', unit: 's', desc: '仿真运行的总时间' }, { name: '步长', unit: 'ms', desc: '仿真时间推进的步长' }, { name: '模式', unit: '选择', desc: '启动仿真时的运行模式参数，由仿真配置面板统一下发' }],
        notes: ['启动前请确保协议配置已完成', '停止后协议配置自动重置']
      },
      {
        name: '快照与模板',
        description: '场景快照保存当前完整状态用于恢复；组网模板保存拓扑结构用于复用到新场景中。',
        usage: ['场景快照：在"态势展示"顶部工具栏点击"场景快照"图标，进入快照管理', '在快照管理中可保存、查看和恢复当前场景快照', '组网模板：点击"保存组网模板"保存当前拓扑，再通过"模板管理"选择并应用模板'],
        notes: ['快照包含完整拓扑和配置信息', '模板可跨场景复用', '模板会保存节点、链路和路由配置']
      },
      {
        name: '录制与回放',
        description: '仿真过程录制与回放功能。录制运行期间的全部网络状态数据，可在之后进行回放分析。',
        usage: ['仿真结束后，在"仿真场景编辑"页面点击场景对应的"回放"按钮', '在"录制历史记录"对话框中查看记录，并选择"播放"或"保存"', '播放会在新窗口打开回放模式的态势展示页面，并可使用时间轴控制进度'],
        notes: ['回放模式下导航栏和侧边栏自动隐藏', '回放数据按时间切片加载']
      }
    ]
  }
]);

const activeCategory = computed(() => categories.value[activeCategoryIdx.value]);
const activeItem = computed(() => activeCategory.value?.items[activeItemIdx.value]);
</script>

<style scoped lang="scss">
.resource-guide {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: transparent;
  color: #a0d4ff;
  font-size: 14px;
}

/* ===== 左侧分类导航条 ===== */
.cat-rail {
  width: 110px;
  min-width: 110px;
  background: rgba(10, 30, 70, 0.50);
  border-right: 1px solid rgba(0, 150, 255, 0.2);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 6px 0;
  backdrop-filter: blur(4px);

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 150, 255, 0.3); border-radius: 2px; }
}

.cat-rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;
  text-align: center;

  &:hover {
    background: rgba(0, 100, 255, 0.1);
    .cat-rail-label { color: #a0d4ff; }
  }

  &.active {
    background: rgba(0, 100, 255, 0.15);
    border-left-color: #00e5ff;
    .cat-rail-label { color: #00e5ff; }
    .cat-rail-icon { opacity: 1; }
  }
}

.cat-rail-icon {
  font-size: 18px;
  opacity: 0.75;
  line-height: 1;
}

.cat-rail-label {
  font-size: 13px;
  color: #6a9fd8;
  line-height: 1.3;
  word-break: keep-all;
}

/* ===== 中间条目面板 ===== */
.item-panel {
  width: 176px;
  min-width: 176px;
  background: rgba(5, 20, 60, 0.48);
  border-right: 1px solid rgba(0, 150, 255, 0.15);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  backdrop-filter: blur(4px);

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 150, 255, 0.25); border-radius: 2px; }
}

.item-panel-header {
  padding: 12px 14px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #8ec8ff;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.12);
}

.item-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  font-size: 13px;
  color: #6a9fd8;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  border-left: 2px solid transparent;

  &:hover {
    background: rgba(0, 100, 255, 0.1);
    color: #a0d4ff;
  }

  &.active {
    background: rgba(0, 80, 200, 0.2);
    color: #d0e8ff;
    border-left-color: #00e5ff;
    .item-entry-dot { background: #00e5ff; opacity: 1; }
  }
}

.item-entry-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(0, 150, 255, 0.45);
  opacity: 0.6;
  flex-shrink: 0;
}

/* ===== 右侧详情 ===== */
.guide-content {
  flex: 1;
  overflow-y: auto;
  padding: 22px 28px 40px;
  min-width: 0;
  background: rgba(5, 15, 45, 0.38);
  backdrop-filter: blur(3px);

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 150, 255, 0.2); border-radius: 2px; }
}

.detail-header {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.15);
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #d0e8ff;
  margin: 0 0 6px;
}

.detail-badge {
  display: inline-block;
  font-size: 11px;
  color: #8ec8ff;
  background: rgba(0, 60, 160, 0.3);
  border: 1px solid rgba(0, 150, 255, 0.2);
  padding: 1px 8px;
  border-radius: 3px;
}

/* ===== 内容区块 — 对齐 --el-card-bg-color ===== */
.detail-section {
  margin-bottom: 12px;
  padding: 14px 16px;
  background: rgba(0, 30, 80, 0.35);
  border: 1px solid rgba(0, 150, 255, 0.22);
  border-radius: 4px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #8ec8ff;
  margin: 0 0 10px;
  padding-bottom: 7px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.12);
  letter-spacing: 1px;

  &.warning { color: #c8a040; }
}

.desc-text {
  color: #a0d4ff;
  font-size: 13px;
  line-height: 1.85;
  margin: 0;
}

/* ===== 步骤列表（用 ::before counter 代替 ::marker，保证颜色可控）===== */
.usage-steps {
  padding-left: 0;
  margin: 0;
  list-style: none;
  counter-reset: step-counter;

  li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 4px 0;
    font-size: 13px;
    color: #a0d4ff;
    line-height: 1.7;
    counter-increment: step-counter;

    &::before {
      content: counter(step-counter);
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      line-height: 18px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #00e5ff;
      background: rgba(0, 150, 255, 0.12);
      border: 1px solid rgba(0, 200, 255, 0.25);
      border-radius: 50%;
    }
  }
}

/* ===== 参数表格 — 对齐 --el-table-* 变量 ===== */
.params-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  border: 1px solid rgba(0, 150, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;

  th {
    text-align: left;
    padding: 8px 14px;
    background: rgba(0, 50, 120, 0.50);
    color: #b8daff;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid rgba(0, 150, 255, 0.30);
    border-right: 1px solid rgba(0, 150, 255, 0.22);
    &:last-child { border-right: none; }
  }

  td {
    padding: 7px 14px;
    color: #b0d8ff;
    font-size: 13px;
    border-bottom: 1px solid rgba(0, 150, 255, 0.18);
    border-right: 1px solid rgba(0, 150, 255, 0.12);
    &:last-child { border-right: none; }
  }

  .param-name {
    color: #d0e8ff;
    font-family: 'Consolas', 'Courier New', monospace;
    white-space: nowrap;
  }

  .param-unit {
    color: #6a9fd8;
    font-size: 12px;
    white-space: nowrap;
  }

  tbody tr:nth-child(even) td { background: rgba(0, 30, 80, 0.20); }
  tbody tr:hover td { background: rgba(0, 70, 160, 0.22); }
}

/* ===== 可选项卡片 ===== */
.option-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}

.option-card {
  background: rgba(0, 25, 70, 0.28);
  border: 1px solid rgba(0, 150, 255, 0.20);
  border-radius: 4px;
  padding: 10px 13px;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(0, 40, 120, 0.45);
    border-color: rgba(0, 150, 255, 0.28);
  }

  .option-card-title {
    font-size: 13px;
    font-weight: 600;
    color: #8ec8ff;
    margin-bottom: 4px;
  }

  .option-card-desc {
    font-size: 12px;
    color: #6a9fd8;
    line-height: 1.6;
  }
}

/* ===== 注意事项 ===== */
.notes-list {
  padding-left: 0;
  margin: 0;
  list-style: none;

  li {
    padding: 5px 10px;
    margin-bottom: 4px;
    font-size: 13px;
    color: #c8a040;
    background: rgba(180, 140, 0, 0.07);
    border-left: 2px solid rgba(200, 160, 0, 0.4);
    border-radius: 0 3px 3px 0;
    line-height: 1.6;

    &::before { content: '⚠ '; color: #c8a040; }
  }
}
</style>
