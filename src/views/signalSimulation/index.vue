<template>
  <div class="signal-simulation-container">
    <div class="page-header">
      <div class="title-section">
        <div v-if="topoStore.currentSessionId" class="session-info">
          <el-tag type="success" effect="dark" class="session-tag">
            <h3>场景：{{ topoStore.currentSessionName || '未命名场景' }}</h3>
          </el-tag>
          <el-tag type="info" effect="plain" class="session-tag">
            <h3>场景ID：{{ topoStore.currentSessionId }}</h3>
          </el-tag>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="refreshNodeList">
          <el-icon><Refresh /></el-icon>
          刷新列表
        </el-button>
      </div>
    </div>

    <div class="node-list-container">
      <el-card v-if="!topoStore.currentSessionId" class="empty-state">
        <el-empty description="请先加载仿真场景" />
      </el-card>
      <el-card v-else-if="loading" class="loading-state">
        <div class="loading-container">
          <el-icon class="loading-icon"><Loading /></el-icon>
          <span>正在加载节点信息...</span>
        </div>
      </el-card>
      <el-card v-else-if="emaneConnectedNodes.length === 0" class="empty-state">
        <el-empty description="当前场景中没有接入信号级仿真的节点" />
      </el-card>
      <el-card v-else class="node-list-card">
        <template #header>
          <div class="card-header">
            <span>信号级仿真节点列表</span>
            <span class="node-count">共 {{ emaneConnectedNodes.length }} 个节点</span>
          </div>
        </template>
        
        <el-table :data="paginatedNodes" style="width: 100%" border stripe>
          <el-table-column prop="id" label="节点ID" min-width="80" align="center" />
          <el-table-column prop="name" label="节点名称" min-width="120" align="center" />
          <el-table-column label="接口信息" min-width="200" align="center">
            <template #default="scope">
              <div v-if="scope.row.interfaces && scope.row.interfaces.length > 0" class="interface-tags-container">
                <el-tag 
                  v-for="iface in scope.row.interfaces" 
                  :key="iface.id"
                  class="interface-tag"
                  type="info"
                >
                  {{ iface.name || 'iface'+iface.id }} (ID: {{ iface.id }})
                </el-tag>
              </div>
              <span v-else>无接口信息</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="150" align="center">
            <template #default="scope">
              <el-button 
                type="primary" 
                size="small" 
                @click="viewSignalData(scope.row)"
                :icon="DataAnalysis"
              >
                查看仿真数据
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 分页控件 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="pagination.currentPage"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="emaneConnectedNodes.length"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTopoStore } from '../../store/modules/topo';
import { websocketService } from '../../services/websocket';
import { 
  Refresh, 
  Loading, 
  DataAnalysis,
} from '@element-plus/icons-vue';
import type { Link, Node, NodeIface } from '../../types/topo';
import { ElMessage } from 'element-plus';

// 路由
const router = useRouter();

// 加载状态
const loading = ref(false);

// 获取拓扑数据
const topoStore = useTopoStore();

// 分页相关
const pagination = ref({
  currentPage: 1,
  pageSize: 10
});

// 接入EMANE的节点列表 - 改为计算属性，实现响应式更新
const emaneConnectedNodes = computed(() => {
  if (!topoStore.topoData || !topoStore.topoData.nodes || !topoStore.topoData.links) {
    return [];
  }
  
  try {
    // 获取所有EMANE节点
    const emaneNodes: Node[] = topoStore.topoData.nodes.filter(
      (node: Node) => node.type === 'EMANE'
    );
    
    // 如果没有EMANE节点，则直接返回
    if (emaneNodes.length === 0) {
      return [];
    }
    
    // 获取所有链路
    const links: Link[] = topoStore.topoData.links || [];
    
    // 查找与EMANE节点相连的节点
    const connectedNodeIds = new Set<number>();
    
    // 遍历所有链路，找到与EMANE节点相连的节点
    links.forEach((link: Link) => {
      const emaneNodeIndex = emaneNodes.findIndex(
        (node: Node) => node.id === link.node1_id || node.id === link.node2_id
      );
      
      if (emaneNodeIndex !== -1) {
        // 找到与EMANE节点相连的另一个节点
        const connectedNodeId = link.node1_id === emaneNodes[emaneNodeIndex].id 
          ? link.node2_id 
          : link.node1_id;
        
        // 将该节点ID加入集合
        connectedNodeIds.add(connectedNodeId);
      }
    });
    
    // 根据ID获取完整的节点信息
    const nodes = topoStore.topoData.nodes || [];
    const connectedNodes = nodes.filter((node: Node) => connectedNodeIds.has(node.id));
    
    // 为每个节点获取接口信息并构建结果
    const result: {id: number, name: string, interfaces: NodeIface[]}[] = [];
    
    connectedNodes.forEach((node: Node) => {
      const nodeInterfaces: NodeIface[] = [];
      
      // 查找与该节点相连的链路
      links.forEach((link: Link) => {
        if (link.node1_id === node.id && link.iface1) {
          nodeInterfaces.push(link.iface1);
        } else if (link.node2_id === node.id && link.iface2) {
          nodeInterfaces.push(link.iface2);
        }
      });
      
      // 添加到结果列表
      result.push({
        id: node.id,
        name: node.alias || node.name || `节点${node.id}`,
        interfaces: nodeInterfaces
      });
    });

    return result;
    
  } catch (error) {
    console.error('计算接入EMANE的节点时出错:', error);
    return [];
  }
});

// 计算当前页的节点数据
const paginatedNodes = computed(() => {
  const startIndex = (pagination.value.currentPage - 1) * pagination.value.pageSize;
  const endIndex = startIndex + pagination.value.pageSize;
  return emaneConnectedNodes.value.slice(startIndex, endIndex);
});

// 监听节点列表变化，自动重置分页
watch(emaneConnectedNodes, (newNodes, oldNodes) => {
  // 当节点数量发生变化时，重置到第一页
  if (newNodes.length !== oldNodes?.length) {
    pagination.value.currentPage = 1;
  }
}, { deep: true });

// 监听拓扑数据变化
watch(
  () => topoStore.topoData,
  (newData, oldData) => {
    if (newData !== oldData) {
    }
  },
  { deep: true }
);

// 处理页码变化
const handleCurrentChange = (page: number) => {
  pagination.value.currentPage = page;
};

// 处理每页数量变化
const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size;
  pagination.value.currentPage = 1; // 重置到第一页
};


onMounted(() => {
  // 移除原来的 findEmaneConnectedNodes() 调用，因为现在使用计算属性
  
  // 初始化WebSocket连接用于信号级仿真数据
  initializeWebSocketConnection();
});

onBeforeUnmount(() => {
  
  // 清理WebSocket连接
  cleanupWebSocketConnection();
});

// 初始化WebSocket连接
const initializeWebSocketConnection = () => {
  // 设置拓扑存储获取器，用于心跳消息中的sessionId
  websocketService.setTopoStoreGetter(() => topoStore);
  
  // 建立WebSocket连接
  websocketService.connect('signal-simulation-index');
  
};

// 清理WebSocket连接
const cleanupWebSocketConnection = () => {
  // 断开WebSocket连接
  websocketService.disconnect('signal-simulation-index');
  
};

// 刷新节点列表 - 现在主要是强制重新加载拓扑数据
const refreshNodeList = async () => {
  loading.value = true;
  
  try {
    // 如果有当前场景ID，重新加载拓扑数据
    if (topoStore.currentSessionId) {
      // 导入API函数
      const { getTopoBySession } = await import('../../api/scene/index');
      
      // 调用API获取最新拓扑数据
      const response = await getTopoBySession(topoStore.currentSessionId);
      
      if (response.code === 200 && response.data) {
        // 更新拓扑数据
        (topoStore as any).setTopoData(topoStore.currentSessionId, response.data);
        ElMessage.success('节点列表已刷新');
      } else {
        ElMessage.error(response.msg || '获取拓扑数据失败');
      }
    } else {
      ElMessage.warning('请先加载仿真场景');
    }
  } catch (error) {
    console.error('刷新节点列表失败:', error);
    ElMessage.error('刷新节点列表失败');
  } finally {
    loading.value = false;
  }
};

// 查看信号数据
const viewSignalData = (node: {id: number, name: string, interfaces: NodeIface[]}) => {
  // 跳转到信号数据展示页面，传递节点信息
  router.push({
    path: '/simu/signal-data',
    query: {
      nodeId: node.id.toString(),
      nodeName: node.name
    }
  });
};
</script>

<style scoped lang="scss">
.signal-simulation-container {
  padding: clamp(10px, 2vw, 20px);
  background-color: #f5f7fa;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: clamp(16px, 3vh, 24px);
  
  .title-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .session-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      
      .session-tag {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: clamp(4px, 1vw, 8px) clamp(8px, 1.5vw, 12px);
        font-size: clamp(14px, 1.2vw, 16px);
        
        h3 {
          margin: 0;
          font-size: inherit;
          font-weight: normal;
        }
      }
    }
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
    margin-left: auto;
  }
}

.node-list-container {
  margin-bottom: clamp(16px, 3vh, 24px);
}

.empty-state,
.loading-state {
  margin-bottom: clamp(16px, 3vh, 24px);
  min-height: clamp(200px, 40vh, 300px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  
  .loading-icon {
    font-size: clamp(28px, 5vw, 36px);
    animation: rotate 1.5s linear infinite;
  }
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  
  .node-count {
    font-size: clamp(14px, 1.1vw, 16px);
    color: #909399;
  }
}

.interface-tags-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.interface-tag {
  margin: 2px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(13px, 1.1vw, 15px);
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式布局 */
@media screen and (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    
    .header-actions {
      margin-left: 0;
      width: 100%;
    }
  }
  
  .session-info {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    
    .session-tag {
      width: 100%;
    }
  }
  
  .pagination-container {
    overflow-x: auto;
    padding-bottom: 10px;
  }
}

/* 确保表格在小屏幕上可滚动 */
:deep(.el-table) {
  max-width: 100%;
  overflow-x: auto;
}

/* 优化按钮在小屏幕上的显示 */
:deep(.el-button--small) {
  padding: clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 12px);
  font-size: clamp(14px, 1.1vw, 16px);
}
</style> 