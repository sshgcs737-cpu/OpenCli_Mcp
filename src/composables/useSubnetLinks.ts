import { useTopoStore } from '../store/modules/topo';
import { computed } from 'vue';
import type { Link } from '../types/topo';

/**
 * 子网内部链路管理的可组合函数
 * 用于处理子网内部链路（虚拟链路）的操作
 */
export function useSubnetLinks() {
  const topoStore = useTopoStore();
  
  // 获取当前拓扑中的所有子网ID
  const subnetIds = computed(() => {
    if (!topoStore.topoData || !topoStore.topoData.nodes) {
      return [];
    }
    
    // 查找所有EMANE类型的节点，这些节点代表子网
    const emaneNodes = topoStore.topoData.nodes.filter((node: any) => node.type === 'EMANE');
    return emaneNodes.map((node: any) => node.id);
  });
  
  /**
   * 获取子网内的所有节点
   * @param subnetId 子网ID
   * @returns 子网内的节点数组
   */
  const getSubnetNodes = (subnetId: number) => {
    if (!topoStore.topoData || !topoStore.topoData.nodes) {
      return [];
    }
    
    // 查找属于该子网的所有节点
    return topoStore.topoData.nodes.filter((node: any) => 
      node.parent_id === subnetId
    );
  };
  
  /**
   * 创建子网内部临时链路对象
   * @param subnetId 子网ID
   * @param node1Id 源节点ID
   * @param node2Id 目标节点ID
   */
  const createSubnetLinkObject = (subnetId: number, node1Id: number, node2Id: number): Link => {
    // 创建一个临时的链路对象，用于显示信息面板
    return {
      node1_id: node1Id,
      node2_id: node2Id,
      type: 'WIRELESS',
      options: {
        bandwidth: 0,
        delay: 0,
        loss: 0,
        jitter: 0,
        buffer: 0,
        burst: 0,
        mburst: 0,
        dup: 0,
        mtu: 0,
        unidirectional: false,
        key: 0,
        mer: 0
      },
      // 子网链路的特殊标识
      subnet_id: subnetId,
      is_subnet_link: true,
      // TypeScript需要这些属性，但我们可以提供空值
      iface1: null as any,
      iface2: null as any,
      network_id: 0
    };
  };
  
  /**
   * 从场景中视觉上删除子网内部链路
   * 
   * 注意：这不会影响实际的网络连接，只是视觉上的效果
   * @param subnetId 子网ID
   * @param node1Id 源节点ID
   * @param node2Id 目标节点ID
   */
  const removeSubnetLinkVisual = (subnetId: number, node1Id: number, node2Id: number) => {
    // TODO: 如果需要从Cesium场景中移除视觉链路，可以在这里添加代码
    
    // 这里可以调用Cesium的API移除对应的Entity
    // 例如：viewer.entities.removeById(`subnet-${subnetId}-link-${node1Id}-${node2Id}`);
    
    return true;
  };
  
  return {
    subnetIds,
    getSubnetNodes,
    createSubnetLinkObject,
    removeSubnetLinkVisual
  };
} 