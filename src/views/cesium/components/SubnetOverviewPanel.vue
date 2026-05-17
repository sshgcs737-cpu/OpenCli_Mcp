<template>
  <div v-if="subnets.length > 0" class="subnet-overview-panel">
    <div class="panel-bar" :class="{ collapsed: panelCollapsed }">
      <button class="collapse-toggle" @click="panelCollapsed = !panelCollapsed" :title="panelCollapsed ? '展开子网面板' : '收起子网面板'">
        <span class="collapse-icon" :class="{ rotated: panelCollapsed }">&#9650;</span>
        <span v-if="panelCollapsed" class="collapse-label">子网 {{ subnets.length }}</span>
      </button>

      <template v-if="!panelCollapsed">
        <div class="panel-meta">子网数：{{ subnets.length }} </div>

        <el-scrollbar class="subnet-scrollbar" height="34px">
          <div class="subnet-list">
            <button
              v-for="subnet in subnets"
              :key="subnet.id"
              type="button"
              class="subnet-chip"
              :class="{ active: subnet.id === activeSubnetId && detailVisible }"
              @click="handleSubnetClick(subnet.id)"
            >
              <span class="chip-dot" :style="{ background: subnet.themeColor, boxShadow: `0 0 12px ${subnet.themeColor}` }"></span>
              <span class="chip-name">{{ subnet.displayName }}</span>
              <span class="chip-cidr">{{ subnet.cidrSummary }}</span>
            </button>
          </div>
        </el-scrollbar>
      </template>
    </div>

    <div v-if="activeSubnet && detailVisible && !panelCollapsed" class="subnet-detail">
      <div class="detail-header">
        <div class="detail-title-wrap">
          <div class="detail-title">{{ activeSubnet.displayName }}</div>
          <!-- <div class="detail-subtitle">{{ activeSubnet.modelText }}</div> -->
        </div>
        <div class="detail-badge">{{ activeSubnet.memberCount }} 节点</div>
      </div>

      <div class="detail-row">
        <div class="detail-label">网段</div>
        <div class="detail-value detail-value-inline">
          <template v-if="activeSubnet.cidrs.length > 0">
            <span v-for="cidr in activeSubnet.cidrs" :key="cidr" class="cidr-tag">{{ cidr }}</span>
          </template>
          <span v-else>未配置</span>
        </div>
      </div>

      <div class="detail-row detail-row-members">
        <div class="detail-label">成员</div>
        <el-scrollbar max-height="120px" class="member-scrollbar">
          <div class="member-list">
            <div v-for="member in activeSubnet.members" :key="member.id" class="member-item">
              <div class="member-main">
                <span class="member-name">{{ member.name }}</span>
                <!-- <span class="member-type">{{ member.type }}</span> -->
              </div>
              <div class="member-ip">{{ member.ipDisplay }}</div>
            </div>
            <div v-if="activeSubnet.members.length === 0" class="empty-text">暂无接入节点</div>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Link, Node, NodeIface } from '../../../types/topo';
import { useTopoStore } from '../../../store/modules/topo';

interface SubnetMemberInfo {
  id: number;
  name: string;
  type: string;
  ipDisplay: string;
}

interface SubnetOverviewItem {
  id: number;
  displayName: string;
  memberCount: number;
  members: SubnetMemberInfo[];
  cidrs: string[];
  cidrSummary: string;
  modelText: string;
  themeColor: string;
}

interface AggregatedSubnetMember {
  id: number;
  name: string;
  type: string;
  ipSet: Set<string>;
}

interface LinkDeviceSide {
  nodeId: number;
  iface?: NodeIface;
}

const topoStore = useTopoStore();
const activeSubnetId = ref<number | null>(null);
const detailVisible = ref(false);
const panelCollapsed = ref(false);
const subnetThemePalette = ['#ff0000', '#ffd700', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ffc0cb', '#6495ed', '#800080'];

const formatNodeName = (node: Node) => {
  return node.alias || node.name || `节点${node.id}`;
};

const getSubnetThemeColor = (node: Node) => {
  if (node.role === 'RED') {
    return '#ff0000';
  }
  if (node.role === 'BLUE') {
    return '#0000ff';
  }
  return subnetThemePalette[node.id % subnetThemePalette.length];
};

const formatModelText = (node: Node) => {
  if (Array.isArray(node.emane_configs) && node.emane_configs.length > 0) {
    const model = node.emane_configs[0]?.model;
    if (model) {
      return model.toUpperCase();
    }
  }
  if (node.phy_type) {
    return node.phy_type.toUpperCase();
  }
  return '未配置模型';
};

const ipv4ToInt = (ip: string) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return (((parts[0] << 24) >>> 0) | ((parts[1] << 16) >>> 0) | ((parts[2] << 8) >>> 0) | (parts[3] >>> 0)) >>> 0;
};

const intToIpv4 = (value: number) => {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
};

const toCidr = (ip?: string, mask?: number) => {
  if (!ip || mask === undefined || mask === null || mask < 0 || mask > 32) {
    return null;
  }
  const ipValue = ipv4ToInt(ip);
  if (ipValue === null) {
    return null;
  }
  const subnetMask = mask === 0 ? 0 : ((0xffffffff << (32 - mask)) >>> 0);
  const networkAddress = ipValue & subnetMask;
  return `${intToIpv4(networkAddress)}/${mask}`;
};

const getLinkDeviceSide = (link: Link, subnetId: number): LinkDeviceSide | null => {
  if (link.node1_id === subnetId) {
    return {
      nodeId: link.node2_id,
      iface: link.iface2,
    };
  }
  if (link.node2_id === subnetId) {
    return {
      nodeId: link.node1_id,
      iface: link.iface1,
    };
  }
  return null;
};

const subnets = computed<SubnetOverviewItem[]>(() => {
  const topoData = topoStore.topoData;
  if (!topoData?.nodes) {
    return [];
  }

  const nodes = topoData.nodes as Node[];
  const links = (topoData.links || []) as Link[];
  const nodeMap = new Map<number, Node>(nodes.map((node: Node) => [node.id, node]));

  return nodes
    .filter((node: Node) => node.type === 'EMANE')
    .map((subnetNode: Node) => {
      const relatedLinks = links.filter((link: Link) => link.node1_id === subnetNode.id || link.node2_id === subnetNode.id);
      const memberMap = new Map<number, AggregatedSubnetMember>();
      const cidrSet = new Set<string>();

      relatedLinks.forEach((link: Link) => {
        const deviceSide = getLinkDeviceSide(link, subnetNode.id);
        if (!deviceSide) {
          return;
        }

        const memberNode = nodeMap.get(deviceSide.nodeId);
        if (!memberNode || memberNode.type === 'INODE') {
          return;
        }

        const memberName = formatNodeName(memberNode);
        const existingMember = memberMap.get(memberNode.id);
        if (existingMember) {
          if (deviceSide.iface?.ip4) {
            existingMember.ipSet.add(`${deviceSide.iface.ip4}/${deviceSide.iface.ip4_mask ?? 24}`);
          }
        } else {
          const ipSet = new Set<string>();
          if (deviceSide.iface?.ip4) {
            ipSet.add(`${deviceSide.iface.ip4}/${deviceSide.iface.ip4_mask ?? 24}`);
          }

          memberMap.set(memberNode.id, {
            id: memberNode.id,
            name: memberName,
            type: memberNode.type,
            ipSet,
          });
        }

        const cidr = toCidr(deviceSide.iface?.ip4, deviceSide.iface?.ip4_mask);
        if (cidr) {
          cidrSet.add(cidr);
        }
      });

      const members: SubnetMemberInfo[] = Array.from(memberMap.values())
        .map((member: AggregatedSubnetMember) => ({
          id: member.id,
          name: member.name,
          type: member.type,
          ipDisplay: member.ipSet.size > 0 ? Array.from(member.ipSet).join(' / ') : '未配置 IP',
        }))
        .sort((a: SubnetMemberInfo, b: SubnetMemberInfo) => a.name.localeCompare(b.name, 'zh-CN'));

      const cidrs = Array.from(cidrSet);

      return {
        id: subnetNode.id,
        displayName: formatNodeName(subnetNode),
        memberCount: members.length,
        members,
        cidrs,
        cidrSummary: cidrs[0] || '未配置网段',
        modelText: formatModelText(subnetNode),
        themeColor: getSubnetThemeColor(subnetNode),
      };
    })
    .sort((a: SubnetOverviewItem, b: SubnetOverviewItem) => a.id - b.id);
});

const activeSubnet = computed(() => {
  return subnets.value.find(subnet => subnet.id === activeSubnetId.value) || subnets.value[0] || null;
});

const handleSubnetClick = (subnetId: number) => {
  if (activeSubnetId.value === subnetId) {
    detailVisible.value = !detailVisible.value;
    return;
  }

  activeSubnetId.value = subnetId;
  detailVisible.value = true;
};

watch(
  subnets,
  (nextSubnets) => {
    if (nextSubnets.length === 0) {
      activeSubnetId.value = null;
      detailVisible.value = false;
      return;
    }

    const hasActive = nextSubnets.some(subnet => subnet.id === activeSubnetId.value);
    if (!hasActive) {
      activeSubnetId.value = nextSubnets[0].id;
      detailVisible.value = false;
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.subnet-overview-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  display: inline-flex;
  flex-direction: column;
  z-index: 220;
  width: fit-content;
  max-width: min(980px, calc(100% - 48px));
  color: #eaf6ff;
}

.panel-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 4px 8px;
  border-radius: 10px;
  transition: all 0.25s ease;
  background:
    linear-gradient(90deg, rgba(7, 20, 42, 0.7) 0%, rgba(11, 28, 54, 0.62) 100%),
    linear-gradient(rgba(89, 146, 196, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(89, 146, 196, 0.09) 1px, transparent 1px);
  background-size: auto, 20px 20px, 20px 20px;
  border: 1px solid rgba(88, 148, 198, 0.24);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(6px);
  overflow: hidden;
}

.panel-bar.collapsed {
  padding: 2px 4px;
  min-height: 28px;
  gap: 0;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: none;
  border-radius: 999px;
  background: rgba(88, 148, 198, 0.08);
  color: rgba(215, 238, 255, 0.72);
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.collapse-toggle:hover {
  background: rgba(88, 148, 198, 0.2);
}

.collapse-icon {
  display: inline-block;
  font-size: 8px;
  line-height: 1;
  transition: transform 0.25s ease;
}

.collapse-icon.rotated {
  transform: rotate(180deg);
}

.collapse-label {
  font-size: 11px;
  font-weight: 600;
}

.panel-meta {
  flex-shrink: 0;
  padding: 1px 10px;
  border-radius: 999px;
  background: rgba(88, 148, 198, 0.1);
  border: 1px solid rgba(88, 148, 198, 0.2);
  font-size: 11px;
  white-space: nowrap;
  color: rgba(215, 238, 255, 0.72);
}

.subnet-scrollbar {
  flex: 0 1 auto;
  min-width: 0;
  max-width: calc(100% - 74px);
}

.subnet-list {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 1px 2px 1px 0;
}

.subnet-chip {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 140px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(88, 140, 188, 0.18);
  background: rgba(12, 31, 56, 0.42);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.subnet-chip:hover,
.subnet-chip.active {
  border-color: rgba(95, 178, 228, 0.42);
  background: rgba(16, 41, 69, 0.72);
  box-shadow: inset 0 0 0 1px rgba(95, 178, 228, 0.12);
}

.chip-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.chip-name {
  min-width: 0;
  max-width: 54px;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-cidr {
  min-width: 0;
  font-size: 10px;
  color: rgba(205, 226, 242, 0.58);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subnet-detail {
  margin-top: 8px;
  width: min(420px, calc(100vw - 40px));
  padding: 9px 10px 10px;
  border-radius: 10px;
  background: rgba(8, 21, 40, 0.76);
  border: 1px solid rgba(88, 148, 198, 0.2);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.detail-title-wrap {
  min-width: 0;
}

.detail-title {
  font-size: 12px;
  font-weight: 700;
}

.detail-subtitle {
  margin-top: 2px;
  font-size: 10px;
  color: rgba(214, 235, 255, 0.5);
}

.detail-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(88, 148, 198, 0.1);
  border: 1px solid rgba(88, 148, 198, 0.16);
  font-size: 10px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 7px;
  border-top: 1px solid rgba(135, 181, 218, 0.1);
}

.detail-row-members {
  margin-top: 6px;
}

.detail-label {
  width: 34px;
  flex-shrink: 0;
  padding-top: 2px;
  font-size: 10px;
  color: rgba(214, 235, 255, 0.5);
}

.detail-value {
  font-size: 11px;
  font-weight: 500;
}

.detail-value-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.cidr-tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(28, 69, 108, 0.26);
  border: 1px solid rgba(96, 160, 210, 0.14);
  color: #d9f1ff;
  font-size: 10px;
}

.member-scrollbar {
  flex: 1;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.028);
}

.member-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.member-name {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-type {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(56, 113, 170, 0.14);
  color: #94d7ff;
  font-size: 10px;
  flex-shrink: 0;
}

.member-ip {
  font-size: 10px;
  color: rgba(214, 235, 255, 0.62);
  white-space: nowrap;
}

.empty-text {
  padding: 10px 0;
  text-align: center;
  font-size: 11px;
  color: rgba(214, 235, 255, 0.6);
}

@media (max-width: 1100px) {
  .subnet-overview-panel {
    max-width: calc(100% - 32px);
  }
}

@media (max-width: 900px) {
  .panel-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .subnet-scrollbar {
    width: 100%;
  }

  .subnet-detail {
    width: calc(100vw - 32px);
  }

  .member-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
