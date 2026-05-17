<template>
  <div class="timeline-player">

    <div class="player-controls">
      <el-button 
        :icon="ArrowLeft"
        circle
        size="large"
        @click="stepBackward"
        :disabled="!hasTimestamps || currentIndex <= 0"
        class="step-btn"
      />
      <el-button 
        :icon="isPlaying ? VideoPause : VideoPlay" 
        circle 
        size="large"
        @click="togglePlay"
        :disabled="!hasTimestamps"
        class="play-btn"
      />
      <el-button 
        :icon="ArrowRight"
        circle
        size="large"
        @click="stepForward"
        :disabled="!hasTimestamps || currentIndex >= timestamps.length - 1"
        class="step-btn"
      />
      <div class="time-display">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="separator">/</span>
        <span class="total-time">{{ formatTime(totalTime) }}</span>
      </div>

      <div v-if="timestamps.length > maxDisplayNodes" class="fisheye-controls">
        <el-button 
          size="small" 
          text
          @click="adjustFocusRadius(-0.1)"
          :disabled="focusRadius <= 0.1"
        >
          <el-icon><ZoomOut /></el-icon>
        </el-button>
        <span class="focus-info">焦点: {{ Math.round(focusRadius * 100) }}%</span>
        <el-button 
          size="small" 
          text
          @click="adjustFocusRadius(0.1)"
          :disabled="focusRadius >= 0.4"
        >
          <el-icon><ZoomIn /></el-icon>
        </el-button>
      </div>


      <div class="speed-control">
        <el-dropdown @command="handleSpeedChange" placement="top">
          <el-button size="small" text>
            {{ playbackSpeed }}x
            <el-icon class="el-icon--right"><ArrowUp /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="0.5">0.5x</el-dropdown-item>
              <el-dropdown-item command="1">1x</el-dropdown-item>
              <el-dropdown-item command="2">2x</el-dropdown-item>
              <el-dropdown-item command="4">4x</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="timeline-container" ref="timelineRef">

      <div class="timeline-info">
        <span class="info-text">
          显示 {{ fisheyeDisplayNodes.length }} / {{ timestamps.length }} 个时间点
          <span v-if="timestamps.length > maxDisplayNodes" class="fisheye-hint">
            (鱼眼视图 - 焦点区域详细显示)
          </span>
        </span>
        <el-popover
          v-if="timestamps.length > maxDisplayNodes"
          placement="top"
          width="300"
          trigger="hover"
        >
          <template #reference>
            <span class="usage-hint">
              💡 Shift+点击调整焦点 | 普通点击自动跟随
            </span>
          </template>
          <div class="fisheye-help">
            <h4>🐟 鱼眼时间轴使用说明：</h4>
            <ul>
              <li><strong>焦点区域（金色）：</strong>显示详细时间节点</li>
              <li><strong>压缩区域（蓝色）：</strong>稀疏显示，节省空间</li>
              <li><strong>普通点击：</strong>跳转播放，自动调整焦点</li>
              <li><strong>Shift+点击：</strong>手动调整焦点区域位置</li>
              <li><strong>焦点控制：</strong>使用 ⊖/⊕ 按钮调整焦点大小</li>
            </ul>
          </div>
        </el-popover>
      </div>
      

      <div class="timeline-track" @click="handleTimelineClick">

        <div 
          v-if="timestamps.length > maxDisplayNodes"
          class="focus-area"
          :style="{ 
            left: Math.max(0, (focusCenter - focusRadius) * 100) + '%',
            width: Math.min(100, focusRadius * 2 * 100) + '%'
          }"
        ></div>
        

        <div 
          class="timeline-progress" 
          :style="{ width: progressPercent + '%' }"
        ></div>
        

        <div 
          v-for="node in fisheyeDisplayNodes" 
          :key="node.timestamp"
          class="timestamp-marker"
          :class="{ 
            'in-focus': node.isInFocus,
            'compressed': !node.isInFocus
          }"
          :style="{ 
            left: node.displayPosition + '%',
            transform: `translateX(-50%) scale(${node.scale})`,
            zIndex: node.isInFocus ? 4 : 3
          }"
          :title="formatTime(node.timestamp) + (node.isInFocus ? '' : ' (压缩显示)')"
        ></div>
        

        <div 
          class="timeline-handle"
          :style="{ left: progressPercent + '%' }"
          @mousedown="startDragging"
        ></div>
      </div>
      

      <div class="timeline-scale">
        <div 
          v-for="scale in timeScales" 
          :key="scale.value"
          class="scale-mark"
          :style="{ left: scale.position + '%' }"
        >
          <span class="scale-label">{{ formatTime(scale.value) }}</span>
        </div>
      </div>
    </div>


    <div v-if="loading" class="loading-overlay">
      <el-icon class="loading-icon">
        <Loading />
      </el-icon>
      <span>加载时间戳数据...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoPlay, VideoPause, ArrowUp, Loading, ZoomIn, ZoomOut, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { getRecordTimestamps, getRecordSlice, type RecordSliceParams } from '../../../api/scene';
import { useTopoStore } from '../../../store/modules/topo';


function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const dataCache = new Map<number, any>(); // key: timestamp, value: sliceData



interface Props {
  recordId: string;
  sessionId: string;
  brokerId?: string;
}

const props = defineProps<Props>();


const topoStore = useTopoStore();


const timestamps = ref<number[]>([]);
const currentTime = ref(0);
const isPlaying = ref(false);
const playbackSpeed = ref(1);
const isDragging = ref(false);
const loading = ref(false);
const timelineRef = ref<HTMLElement | null>(null);


const focusCenter = ref(0.5); // 焦点中心位置 (0-1)
const focusRadius = ref(0.3); // 焦点区域半径 (0-1)
const focusScale = ref(2); // 焦点区域放大倍数
const maxDisplayNodes = ref(120); // 最大显示节点数


let playTimer: number | null = null;


const hasTimestamps = computed(() => timestamps.value.length > 0);

const totalTime = computed(() => {
  if (!hasTimestamps.value) return 0;
  return Math.max(...timestamps.value);
});

const minTime = computed(() => {
  if (!hasTimestamps.value) return 0;
  return Math.min(...timestamps.value);
});

const progressPercent = computed(() => {
  if (!hasTimestamps.value || totalTime.value === minTime.value) return 0;
  return ((currentTime.value - minTime.value) / (totalTime.value - minTime.value)) * 100;
});

const currentIndex = computed(() => timestamps.value.findIndex(t => t === currentTime.value));
const stepBackward = () => {
  if (!hasTimestamps.value || currentIndex.value <= 0) return;
  currentTime.value = timestamps.value[currentIndex.value - 1];
};
const stepForward = () => {
  if (!hasTimestamps.value || currentIndex.value >= timestamps.value.length - 1) return;
  currentTime.value = timestamps.value[currentIndex.value + 1];
};

const fisheyeDisplayNodes = computed(() => {
  if (!hasTimestamps.value || timestamps.value.length <= maxDisplayNodes.value) {
    // 如果时间戳数量少于最大显示数量，直接显示所有
    return timestamps.value.map((timestamp, index) => ({
      timestamp,
      originalIndex: index,
      displayPosition: getTimestampPosition(timestamp),
      isInFocus: true,
      scale: 1
    }));
  }
  
  const totalNodes = timestamps.value.length;
  const result = [];
  
  // 计算焦点区域的实际索引范围
  const focusStartIndex = Math.max(0, Math.floor((focusCenter.value - focusRadius.value) * totalNodes));
  const focusEndIndex = Math.min(totalNodes - 1, Math.ceil((focusCenter.value + focusRadius.value) * totalNodes));
  
  // 焦点区域内的详细节点数量
  const focusNodeCount = Math.min(60, focusEndIndex - focusStartIndex + 1);
  
  // 前压缩区域
  const beforeNodes = Math.max(0, Math.floor((maxDisplayNodes.value - focusNodeCount) * 0.25));
  // 后压缩区域  
  const afterNodes = Math.max(0, Math.floor((maxDisplayNodes.value - focusNodeCount) * 0.25));
  
  // 添加前压缩区域节点
  if (focusStartIndex > 0 && beforeNodes > 0) {
    const step = focusStartIndex / beforeNodes;
    for (let i = 0; i < beforeNodes; i++) {
      const index = Math.floor(i * step);
      if (index < focusStartIndex) {
        result.push({
          timestamp: timestamps.value[index],
          originalIndex: index,
          displayPosition: getTimestampPosition(timestamps.value[index]),
          isInFocus: false,
          scale: 0.6
        });
      }
    }
  }
  
  // 添加焦点区域节点
  const focusStep = Math.max(1, Math.floor((focusEndIndex - focusStartIndex) / focusNodeCount));
  for (let i = focusStartIndex; i <= focusEndIndex; i += focusStep) {
    result.push({
      timestamp: timestamps.value[i],
      originalIndex: i,
      displayPosition: getTimestampPosition(timestamps.value[i]),
      isInFocus: true,
      scale: 1
    });
  }
  
  // 添加后压缩区域节点
  if (focusEndIndex < totalNodes - 1 && afterNodes > 0) {
    const remainingNodes = totalNodes - focusEndIndex - 1;
    const step = remainingNodes / afterNodes;
    for (let i = 0; i < afterNodes; i++) {
      const index = focusEndIndex + 1 + Math.floor(i * step);
      if (index < totalNodes) {
        result.push({
          timestamp: timestamps.value[index],
          originalIndex: index,
          displayPosition: getTimestampPosition(timestamps.value[index]),
          isInFocus: false,
          scale: 0.6
        });
      }
    }
  }
  
  return result;
});

const timeScales = computed(() => {
  if (!hasTimestamps.value) return [];
  
  const scales = [];
  const duration = totalTime.value - minTime.value;
  const scaleCount = 5;
  
  for (let i = 0; i <= scaleCount; i++) {
    const value = minTime.value + (duration * i / scaleCount);
    const position = (i / scaleCount) * 100;
    scales.push({ value, position });
  }
  
  return scales;
});

const formatTime = (timestamp: number): string => {
  if (!timestamp) return '00:00:00';
  
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
};

const getTimestampPosition = (timestamp: number): number => {
  if (!hasTimestamps.value || totalTime.value === minTime.value) return 0;
  return ((timestamp - minTime.value) / (totalTime.value - minTime.value)) * 100;
};

const findNearestTimestamp = (targetTime: number): number => {
  if (!hasTimestamps.value) return 0;
  
  let nearest = timestamps.value[0];
  let minDistance = Math.abs(targetTime - nearest);
  
  for (const timestamp of timestamps.value) {
    const distance = Math.abs(targetTime - timestamp);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = timestamp;
    }
  }
  
  return nearest;
};

const togglePlay = () => {
  if (!hasTimestamps.value) return;
  
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
};

const startPlayback = () => {
  if (playTimer) clearInterval(playTimer);
  
  playTimer = window.setInterval(() => {
    const currentIndex = timestamps.value.findIndex(t => t === currentTime.value);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < timestamps.value.length) {
      currentTime.value = timestamps.value[nextIndex];
    } else {
      isPlaying.value = false;
      stopPlayback();
      ElMessage.success('回放完成');
    }
  }, 1000 / playbackSpeed.value);
};

const stopPlayback = () => {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
};

async function processSliceData(sliceData: any, timestamp: number) {
  if (sliceData.session) {
    const sessionData = sliceData.session;
    const currentSessionId = topoStore.currentSessionId || Number(props.sessionId);
    
    (topoStore as any).setTopoData(currentSessionId, {
      id: sessionData.id || currentSessionId,
      state: sessionData.state || 'NONE',
      nodes: sessionData.nodes || [],
      links: sessionData.links || [],
      dir: sessionData.dir || '',
      user: sessionData.user || '',
      default_services: sessionData.default_services || [],
      location: sessionData.location || {
        x: 0, y: 0, z: 0, lat: 0, lon: 0, alt: 0, scale: 1
      },
      hooks: sessionData.hooks || [],
      metadata: sessionData.metadata || {},
      file: sessionData.file || '',
      options: sessionData.options || {},
      servers: sessionData.servers || [],
      name: topoStore.currentSessionName || '回放场景'
    });
  }
  
  const emaneData = sliceData.emaneInfoMsgs || sliceData.emaneInfos || sliceData.emaneMessages || sliceData.emaneInfo;
  
  let nodeNemData = sliceData.nodeNemMap || sliceData.nodememmap || sliceData.nodeNemMaps || sliceData.nemIds;
  
  if (!nodeNemData && sliceData.session) {
    nodeNemData = sliceData.session.nodeNemMap || sliceData.session.nemIds;
  }
  
  if (!nodeNemData && emaneData && Array.isArray(emaneData)) {
    const extractedNemIds: any[] = [];
    
    emaneData.forEach((emaneMsg: any) => {
      const nemId = emaneMsg.nemId || emaneMsg.emaneInfo?.nemId;
      if (nemId !== undefined) {
        
        extractedNemIds.push({
          nodeId: nemId,
          ifaceNemMap: { "0": nemId }
        });
      }
    });
    
    if (extractedNemIds.length > 0) {
      nodeNemData = extractedNemIds;
    }
  }
  
  
  if (nodeNemData && Array.isArray(nodeNemData)) {
    const { useNemIdStore } = await import("../../../store/modules/nemId");
    const nemIdStore = useNemIdStore();
    
    const formattedNemIds = nodeNemData.map((nodeNem: any) => ({
      nodeId: nodeNem.nodeId || nodeNem.node_id,
      ifaceNemMap: nodeNem.ifaceNemMap || nodeNem.iface_nem_map || {}
    }));
    
    nemIdStore.setNemIds(Number(props.sessionId), formattedNemIds);
    
    
  } else {
    console.warn(`[回放] 未找到 nodeNemMap 数据，将影响链路数据显示`);
    
    if (emaneData && Array.isArray(emaneData)) {
      const { useNemIdStore } = await import("../../../store/modules/nemId");
      const nemIdStore = useNemIdStore();
      
      const fallbackNemIds: any[] = [];
      emaneData.forEach((emaneMsg: any) => {
        const nemId = emaneMsg.nemId || emaneMsg.emaneInfo?.nemId;
        if (nemId !== undefined) {
          fallbackNemIds.push({
            nodeId: nemId,
            ifaceNemMap: { "0": nemId }
          });
        }
      });
      
      if (fallbackNemIds.length > 0) {
        nemIdStore.setNemIds(Number(props.sessionId), fallbackNemIds);
      }
    }
  }
  
  if (emaneData) {
    const { useEmaneStore } = await import("../../../store/modules/emane");
    const emaneStore = useEmaneStore();
    
    let processedCount = 0;
    
             if (Array.isArray(emaneData)) {
       emaneData.forEach((emaneMsg: any, index: number) => {
         try {
           
           let viewpointNemId: number | null = null;
           let emaneInfo: any = null;
           
           if (emaneMsg.nemId !== undefined) {
             viewpointNemId = parseInt(emaneMsg.nemId, 10);
             emaneInfo = {
               neighborMetricTables: emaneMsg.neighborMetricTables || [],
               neighborStatusTables: emaneMsg.neighborStatusTables || [],
               rfSignalTables: emaneMsg.rfSignalTables || []
             };
           }
           else if (emaneMsg.emaneInfo && emaneMsg.emaneInfo.nemId !== undefined) {
             viewpointNemId = parseInt(emaneMsg.emaneInfo.nemId, 10);
             emaneInfo = {
               neighborMetricTables: emaneMsg.emaneInfo.neighborMetricTables || [],
               neighborStatusTables: emaneMsg.emaneInfo.neighborStatusTables || [],
               rfSignalTables: emaneMsg.emaneInfo.rfSignalTables || []
             };
           }
           
           if (viewpointNemId !== null && !isNaN(viewpointNemId) && emaneInfo) {
             
             emaneStore.updateViewpointData(viewpointNemId, emaneInfo);
             processedCount++;
             
           } else {
             console.warn(`[回放] EMANE 消息 ${index} 格式不正确或缺少必要字段:`, emaneMsg);
           }
         } catch (error) {
           console.warn(`[回放] 处理 EMANE 消息时出错:`, error, emaneMsg);
         }
       });
     } 
     else if (emaneData.nemId !== undefined) {
       try {
         const viewpointNemId = parseInt(emaneData.nemId, 10);
         
         if (!isNaN(viewpointNemId)) {
           const emaneInfo = {
             neighborMetricTables: emaneData.neighborMetricTables || [],
             neighborStatusTables: emaneData.neighborStatusTables || [],
             rfSignalTables: emaneData.rfSignalTables || []
           };
           
           
           emaneStore.updateViewpointData(viewpointNemId, emaneInfo);
           processedCount++;
         }
       } catch (error) {
         console.warn(`[回放] 处理单个 EMANE 数据时出错:`, error, emaneData);
       }
     }
    
    
  } else {
    console.warn(`[回放] 未找到 emaneInfoMsgs 数据`);
  }
  
  
  try {
    const { useNemIdStore } = await import("../../../store/modules/nemId");
    const { useEmaneStore } = await import("../../../store/modules/emane");
    const nemIdStore = useNemIdStore();
    const emaneStore = useEmaneStore();
    
  } catch (error) {
    console.error(`[回放] 验证store状态时出错:`, error);
  }
}

const fetchPlaybackData = async (timestamp: number) => {
  if (!props.brokerId || !timestamp) return;

  if (dataCache.has(timestamp)) {
    const sliceData = dataCache.get(timestamp);
    await processSliceData(sliceData, timestamp);
    return;
  }

  try {
    const response = await getRecordSlice({
      brokerId: props.brokerId,
      start: timestamp,
      end: timestamp
    });
    if (response.code === 200 && response.data && response.data.length > 0) {
      const sliceData = response.data[0];
      dataCache.set(timestamp, sliceData); // 缓存
      await processSliceData(sliceData, timestamp);
    } else {
      console.warn(`[回放] 时间戳 ${timestamp} 没有数据`);
    }
  } catch (error) {
    console.error(`[回放] 获取时间戳 ${timestamp} 数据失败:`, error);
  }
};
const debouncedFetchPlaybackData = debounce(fetchPlaybackData, 100);

const handleSpeedChange = (speed: string | number | object) => {
  playbackSpeed.value = Number(speed);
  
  if (isPlaying.value) {
    stopPlayback();
    startPlayback();
  }
  
  ElMessage.success(`播放速度已设置为 ${playbackSpeed.value}x`);
};

const adjustFocusRadius = (delta: number) => {
  const newRadius = Math.max(0.1, Math.min(0.4, focusRadius.value + delta));
  focusRadius.value = newRadius;
  
  focusCenter.value = Math.max(newRadius, Math.min(1 - newRadius, focusCenter.value));
  
  ElMessage.success(`焦点区域已调整为 ${Math.round(newRadius * 100)}%`);
};

const handleTimelineClick = (event: MouseEvent) => {
  if (isDragging.value || !timelineRef.value || !hasTimestamps.value) return;
  
  const rect = timelineRef.value.getBoundingClientRect();
  const clickPercent = (event.clientX - rect.left) / rect.width;
  const targetTime = minTime.value + ((totalTime.value - minTime.value) * clickPercent);
  
  const nearestTimestamp = findNearestTimestamp(targetTime);
  currentTime.value = nearestTimestamp;
  
  if (timestamps.value.length > maxDisplayNodes.value) {
    if (event.shiftKey) {
      focusCenter.value = Math.max(focusRadius.value, Math.min(1 - focusRadius.value, clickPercent));
      ElMessage.success('焦点区域已调整');
    } else {
      const currentPercent = (currentTime.value - minTime.value) / (totalTime.value - minTime.value);
      if (currentPercent < focusCenter.value - focusRadius.value || 
          currentPercent > focusCenter.value + focusRadius.value) {
        focusCenter.value = Math.max(focusRadius.value, Math.min(1 - focusRadius.value, currentPercent));
      }
    }
  }
  
  if (isPlaying.value) {
    stopPlayback();
    startPlayback();
  }
};

const startDragging = (event: MouseEvent) => {
  isDragging.value = true;
  event.preventDefault();
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !timelineRef.value || !hasTimestamps.value) return;
    
    const rect = timelineRef.value.getBoundingClientRect();
    const dragPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = minTime.value + ((totalTime.value - minTime.value) * dragPercent);
    
    const nearestTimestamp = findNearestTimestamp(targetTime);
    currentTime.value = nearestTimestamp;
  };
  
  const handleMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (isPlaying.value) {
      stopPlayback();
      startPlayback();
    }
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const fetchTimestamps = async () => {
  if (!props.recordId) return;
  
  loading.value = true;
  
  try {
    const response = await getRecordTimestamps(Number(props.recordId));
    
    if (response.code === 200 && response.data) {
      const uniqueTimestamps = [...new Set(response.data)];
      timestamps.value = uniqueTimestamps.sort((a, b) => a - b);
      
      if (timestamps.value.length > 0) {
        currentTime.value = timestamps.value[0];
      }
      
      ElMessage.success(`时间戳数据加载完成，共 ${timestamps.value.length} 个时间点`);
    } else {
      throw new Error(response.msg || '获取时间戳数据失败');
    }
  } catch (error) {
    console.error('加载时间戳失败:', error);
    ElMessage.error('加载时间戳数据失败');
    
    const fallbackTimestamps = [
      1752029308261, 1752029309258, 1752029310260, 1752029311253,
      1752029312256, 1752029313262, 1752029314258, 1752029315255,
      1752029316253, 1752029317265, 1752029318255, 1752029319255,
      1752029320252, 1752029321251, 1752029322262, 1752029323259,
      1752029324258, 1752029325277, 1752029326257, 1752029327262
    ];
    
    timestamps.value = [...new Set(fallbackTimestamps)].sort((a, b) => a - b);
    if (timestamps.value.length > 0) {
      currentTime.value = timestamps.value[0];
    }
    ElMessage.warning('使用示例数据进行演示');
  } finally {
    loading.value = false;
  }
};

const initializeFocusArea = () => {
  if (!hasTimestamps.value) return;
  
  const currentPercent = (currentTime.value - minTime.value) / (totalTime.value - minTime.value);
  focusCenter.value = Math.max(focusRadius.value, Math.min(1 - focusRadius.value, currentPercent || 0.5));
};

watch(() => props.recordId, () => {
  if (props.recordId) {
    fetchTimestamps();
  }
}, { immediate: true });

watch(timestamps, () => {
  if (timestamps.value.length > maxDisplayNodes.value) {
    nextTick(() => {
      initializeFocusArea();
    });
  }
}, { immediate: true });

watch(currentTime, (newTime) => {
  if (newTime && props.brokerId) {
    debouncedFetchPlaybackData(newTime);
  }
}, { immediate: true });

onMounted(() => {
  fetchTimestamps();
});

onUnmounted(() => {
  stopPlayback();
});
</script>

<style scoped>
.timeline-player {
  width: 100%;
  height: auto;
  min-height: 70px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(0, 20, 40, 0.95) 0%, rgba(0, 40, 80, 0.95) 50%, rgba(0, 60, 120, 0.95) 100%);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  color: #e0f4ff;
  padding: 12px 20px;
  position: relative;
  border-top: 1px solid rgba(0, 212, 255, 0.6);
  box-shadow: 
    0 -5px 25px rgba(0, 212, 255, 0.3),
    0 0 20px rgba(0, 212, 255, 0.2);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  z-index: 1000;
}

/* 科技感边框效果 */
.timeline-player::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 153, 255, 0.6), rgba(0, 212, 255, 0.8), transparent);
  z-index: 1;
}

.timeline-player::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(0, 153, 255, 0.02) 0%, rgba(0, 212, 255, 0.03) 100%);
  z-index: 0;
  pointer-events: none;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 10px;
  position: relative;
  z-index: 10;
}

.play-btn {
  width: 40px !important;
  height: 40px !important;
  background: linear-gradient(135deg, rgba(0, 153, 255, 0.15), rgba(0, 212, 255, 0.15)) !important;
  border: 1px solid rgba(0, 212, 255, 0.4) !important;
  color: #00d4ff !important;
  border-radius: 50% !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2) !important;
  position: relative;
  overflow: hidden;
}

.play-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent);
  transition: left 0.5s;
}

.play-btn:hover::before {
  left: 100%;
}

.play-btn:hover {
  background: linear-gradient(135deg, rgba(0, 153, 255, 0.25), rgba(0, 212, 255, 0.25)) !important;
  border-color: rgba(0, 212, 255, 0.6) !important;
  color: #ffffff !important;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4) !important;
}

.play-btn:active {
  transform: scale(0.98);
}

.step-btn {
  background: linear-gradient(135deg, rgba(0, 153, 255, 0.15), rgba(0, 212, 255, 0.15)) !important;
  border: 1px solid rgba(0, 212, 255, 0.4) !important;
  color: #00d4ff !important;
  border-radius: 50% !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2) !important;
  position: relative;
  overflow: hidden;
}

.step-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 12px;
  background: rgba(0, 153, 255, 0.15);
  border-radius: 8px;
  border: 1px solid rgba(0, 212, 255, 0.5);
  box-shadow: 
    inset 0 0 8px rgba(0, 212, 255, 0.2),
    0 0 10px rgba(0, 212, 255, 0.3);
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
}

.current-time {
  color: #00d4ff;
  font-weight: 600;
}

.separator {
  color: rgba(102, 224, 255, 0.8);
  font-weight: bold;
}

.total-time {
  color: #e0f4ff;
}

.fisheye-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 6px;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.2);
}

.fisheye-controls .el-button {
  background: rgba(255, 215, 0, 0.1) !important;
  border: 1px solid rgba(255, 215, 0, 0.3) !important;
  color: #ffd700 !important;
  border-radius: 4px !important;
  padding: 4px 6px !important;
  font-size: 12px !important;
  transition: all 0.3s ease !important;
  min-width: 28px !important;
}

.fisheye-controls .el-button:hover {
  background: rgba(255, 215, 0, 0.2) !important;
  border-color: rgba(255, 215, 0, 0.5) !important;
  color: #ffffff !important;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3) !important;
}

.fisheye-controls .el-button:disabled {
  background: rgba(255, 215, 0, 0.05) !important;
  border-color: rgba(255, 215, 0, 0.1) !important;
  color: rgba(255, 215, 0, 0.3) !important;
  box-shadow: none !important;
}

.focus-info {
  font-size: 10px;
  color: #ffd700;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  text-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
  min-width: 60px;
  text-align: center;
}

.speed-control {
  margin-left: auto;
}

.speed-control .el-button {
  background: rgba(0, 153, 255, 0.1) !important;
  border: 1px solid rgba(0, 212, 255, 0.3) !important;
  color: #00d4ff !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 12px !important;
  transition: all 0.3s ease !important;
}

.speed-control .el-button:hover {
  background: rgba(0, 153, 255, 0.2) !important;
  border-color: rgba(0, 212, 255, 0.5) !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2) !important;
}

.timeline-container {
  flex: 1;
  position: relative;
  min-height: 50px;
  z-index: 10;
  padding: 0 8px;
}

.timeline-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
}

.info-text {
  font-size: 11px;
  color: rgba(224, 244, 255, 0.8);
  font-family: 'Courier New', monospace;
}

.fisheye-hint {
  color: rgba(0, 212, 255, 0.9);
  font-weight: 500;
  text-shadow: 0 0 4px rgba(0, 212, 255, 0.5);
}

.usage-hint {
  font-size: 10px;
  color: rgba(224, 244, 255, 0.7);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  font-style: italic;
  background: rgba(0, 20, 40, 0.5);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  cursor: help;
  transition: all 0.3s ease;
}

.usage-hint:hover {
  color: rgba(224, 244, 255, 1);
  background: rgba(0, 20, 40, 0.8);
  border-color: rgba(0, 212, 255, 0.4);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.3);
}

.fisheye-help {
  color: #333;
  font-size: 12px;
  line-height: 1.5;
}

.fisheye-help h4 {
  margin: 0 0 8px 0;
  color: #0066cc;
  font-size: 13px;
  font-weight: 600;
}

.fisheye-help ul {
  margin: 0;
  padding-left: 16px;
}

.fisheye-help li {
  margin-bottom: 4px;
  color: #666;
}

.fisheye-help li strong {
  color: #333;
}

.focus-area {
  position: absolute;
  top: -2px;
  height: 8px;
  background: linear-gradient(90deg, 
    rgba(255, 215, 0, 0.15) 0%, 
    rgba(255, 215, 0, 0.25) 50%, 
    rgba(255, 215, 0, 0.15) 100%);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 6px;
  pointer-events: none;
  z-index: 1;
  transition: all 0.3s ease;
  box-shadow: 
    0 0 8px rgba(255, 215, 0, 0.3),
    inset 0 0 4px rgba(255, 215, 0, 0.2);
}

.focus-area::before {
  content: "焦点区域";
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(255, 215, 0, 0.9);
  background: rgba(0, 20, 40, 0.8);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.timeline-track {
  position: relative;
  height: 4px;
  background: linear-gradient(90deg, rgba(0, 153, 255, 0.3), rgba(0, 212, 255, 0.5));
  border: 1px solid rgba(0, 212, 255, 0.6);
  border-radius: 3px;
  cursor: pointer;
  margin: 8px 0;
  box-shadow: 
    inset 0 0 4px rgba(0, 0, 0, 0.4),
    0 0 10px rgba(0, 212, 255, 0.4);
  overflow: visible;
  transition: all 0.3s ease;
  z-index: 1;
}

.timeline-track::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(0, 153, 255, 0.1) 0%, rgba(0, 212, 255, 0.2) 100%);
  animation: timeline-pulse 2s infinite;
  border-radius: 3px;
}

@keyframes timeline-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.timeline-track:hover {
  box-shadow: 
    inset 0 0 4px rgba(0, 0, 0, 0.4),
    0 0 15px rgba(0, 212, 255, 0.6);
  border-color: rgba(0, 212, 255, 0.8);
}

.timeline-progress {
  height: 100%;
  background: linear-gradient(90deg, 
    rgba(0, 153, 255, 1) 0%, 
    rgba(0, 212, 255, 1) 50%, 
    rgba(102, 224, 255, 1) 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
  position: relative;
  box-shadow: 
    0 0 10px rgba(0, 212, 255, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  z-index: 2;
}

.timeline-progress::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: progress-shimmer 2s infinite;
  border-radius: 5px;
}

@keyframes progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 隐藏时间轴小点点 */
.timestamp-marker {
  display: none !important;
}

.timestamp-marker.in-focus {
  width: 10px;
  height: 10px;
  top: -3px;
  background: radial-gradient(circle, rgba(255, 215, 0, 1), rgba(255, 165, 0, 0.8));
  box-shadow: 
    0 0 15px rgba(255, 215, 0, 0.8),
    0 0 8px rgba(255, 215, 0, 0.6);
  border-color: rgba(255, 255, 255, 1);
  z-index: 4;
}

.timestamp-marker.compressed {
  width: 5px;
  height: 5px;
  top: -1px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.8), rgba(0, 153, 255, 0.6));
  box-shadow: 
    0 0 8px rgba(0, 212, 255, 0.6),
    0 0 4px rgba(0, 212, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
  opacity: 0.7;
}

.timestamp-marker:hover {
  transform: translateX(-50%) scale(1.2) !important;
  box-shadow: 
    0 0 20px rgba(0, 212, 255, 1),
    0 0 10px rgba(102, 224, 255, 0.8);
  background: radial-gradient(circle, rgba(255, 255, 255, 1), rgba(0, 212, 255, 1));
  border-color: rgba(255, 255, 255, 1);
  opacity: 1;
}

.timestamp-marker.in-focus:hover {
  background: radial-gradient(circle, rgba(255, 255, 255, 1), rgba(255, 215, 0, 1));
  box-shadow: 
    0 0 25px rgba(255, 215, 0, 1),
    0 0 15px rgba(255, 215, 0, 0.8);
}

.timestamp-marker.compressed:hover {
  transform: translateX(-50%) scale(1.5) !important;
  background: radial-gradient(circle, rgba(255, 255, 255, 1), rgba(0, 212, 255, 1));
}

.timeline-handle {
  position: absolute;
  top: -8px;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, rgba(0, 153, 255, 1), rgba(0, 212, 255, 1));
  border: 2px solid rgba(255, 255, 255, 1);
  border-radius: 50%;
  cursor: grab;
  transform: translateX(-50%);
  box-shadow: 
    0 0 20px rgba(0, 212, 255, 0.8),
    0 0 10px rgba(0, 212, 255, 0.6),
    inset 0 0 8px rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
  z-index: 5;
}

.timeline-handle::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

.timeline-handle:hover {
  transform: translateX(-50%) scale(1.1);
  box-shadow: 
    0 0 25px rgba(0, 212, 255, 1),
    0 0 15px rgba(102, 224, 255, 0.8),
    inset 0 0 10px rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 1);
}

.timeline-handle:active {
  cursor: grabbing;
  transform: translateX(-50%) scale(1.05);
}

.timeline-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  position: relative;
}

.scale-mark {
  position: absolute;
  transform: translateX(-50%);
}

.scale-label {
  font-size: 10px;
  color: rgba(224, 244, 255, 1);
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 6px rgba(0, 212, 255, 0.6);
  padding: 2px 6px;
  background: rgba(0, 153, 255, 0.15);
  border-radius: 3px;
  border: 1px solid rgba(0, 212, 255, 0.4);
  font-weight: 500;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 20, 40, 0.9), rgba(0, 40, 80, 0.9));
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #e0f4ff;
  z-index: 10;
  border-radius: 6px;
}

.loading-icon {
  font-size: 24px;
  color: #00d4ff;
  animation: loading-spin 1.5s linear infinite;
  filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.6));
}

@keyframes loading-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-overlay span {
  font-size: 12px;
  text-shadow: 0 0 6px rgba(0, 212, 255, 0.5);
  animation: loading-pulse 2s infinite;
}

@keyframes loading-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
</style> 