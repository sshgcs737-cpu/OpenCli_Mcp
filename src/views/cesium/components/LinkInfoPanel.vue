<template>
  <div class="neo-infobox" v-if="link" ref="linkPanelRef" :style="{ transform: `translate(${dragOffsetX}px, ${dragOffsetY}px)` }">
    <div class="neo-infobox-header">
      <span class="neo-infobox-title">
        <svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
          <rect
            x="3"
            y="8"
            width="12"
            height="2"
            rx="1"
            fill="#4caf50"
            fill-opacity="0.8"
          />
          <circle cx="3" cy="9" r="2" fill="#4caf50" fill-opacity="0.6" />
          <circle cx="15" cy="9" r="2" fill="#4caf50" fill-opacity="0.6" />
        </svg>
        链路信息
      </span>
      <span class="neo-infobox-close" @click="$emit('close')">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line
            x1="5"
            y1="5"
            x2="15"
            y2="15"
            stroke="#a5d6a7"
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="15"
            y1="5"
            x2="5"
            y2="15"
            stroke="#a5d6a7"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </span>
    </div>
    <div class="neo-infobox-content">
      <div class="neo-section">
        <div class="neo-section-title">
          <svg width="16" height="16" style="margin-right: 4px">
            <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18" />
          </svg>
          基本信息
        </div>

        <div class="node-info-block">
          <div class="node-info-title">源节点</div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">节点名称</div>
              <div class="item-value">{{ sourceNodeName }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">节点ID</div>
              <div class="item-value">{{ link.node1_id }}</div>
            </div>
          </div>
        </div>

        <div class="node-info-block">
          <div class="node-info-title">目标节点</div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">节点名称</div>
              <div class="item-value">{{ targetNodeName }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">节点ID</div>
              <div class="item-value">{{ link.node2_id }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="neo-section">
        <div class="neo-section-title">
          <svg width="16" height="16" style="margin-right: 4px">
            <circle cx="8" cy="8" r="7" fill="#4caf50" fill-opacity="0.18" />
          </svg>
          链路参数
        </div>
        <div class="neo-grid">
          <div class="neo-grid-item">
            <div class="item-label">带宽</div>
            <div class="item-value">{{ link.options?.bandwidth || 0 }} bps</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">延迟</div>
            <div class="item-value">{{ link.options?.delay || 0 }} ms</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">丢包率</div>
            <div class="item-value">{{ link.options?.loss || 0 }} %</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">抖动</div>
            <div class="item-value">{{ link.options?.jitter || 0 }} ms</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">缓冲区</div>
            <div class="item-value">{{ link.options?.buffer || 0 }} KB</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">重复</div>
            <div class="item-value">{{ link.options?.dup || 0 }} %</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">突发流量</div>
            <div class="item-value">{{ link.options?.burst || 0 }} KB</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">最大突发流量</div>
            <div class="item-value">{{ link.options?.mburst || 0 }} KB</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">类型</div>
            <div class="item-value">{{ linkTypeText }}</div>
          </div>
          <div class="neo-grid-item">
            <div class="item-label">单向连接</div>
            <div class="item-value">{{ link.options?.unidirectional ? "是" : "否" }}</div>
          </div>
        </div>
      </div>



      <div class="neo-actions">
        <button class="neo-btn edit-btn" @click="handleEditParams">
          <el-icon><Edit /></el-icon>
          修改参数
        </button>
        <button class="neo-btn delete-btn" @click="handleDeleteLink">
          <el-icon><Delete /></el-icon>
          删除链路
        </button>
      </div>
    </div>

    <LinkParamsDialog
      v-model:visible="showLinkParamsDialog"
      :link="link"
      @confirm="handleLinkParamsConfirm"
      @cancel="handleLinkParamsCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref} from "vue";
import { useTopoStore } from "../../../store/modules/topo";
import type { Link, Node } from "../../../types/topo";
import { Edit, Delete } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import LinkParamsDialog from "./LinkParamsDialog.vue";
import { useDraggable } from '../../../composables/useDraggable';


const props = defineProps<{ link: Link }>();
const emit = defineEmits(["close"]);

const linkPanelRef = ref<HTMLElement | null>(null);
const { offsetX: dragOffsetX, offsetY: dragOffsetY } = useDraggable(
  linkPanelRef,
  '.neo-infobox-header'
);

const topoStore = useTopoStore();

const showLinkParamsDialog = ref(false);



const linkTypeText = computed(() => {
  switch (props.link.type) {
    case "WIRED":
      return "有线连接";
    case "WIRELESS":
      return "无线连接";
    default:
      return props.link.type || "未知";
  }
});

const sourceNodeName = computed(() => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
    return "未知节点";
  }
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node1_id);
  return node ? (node.alias || node.name) : "未知节点";
});

const targetNodeName = computed(() => {
  if (!topoStore.topoData || !Array.isArray(topoStore.topoData.nodes)) {
    return "未知节点";
  }
  const node = topoStore.topoData.nodes.find((n: Node) => n.id === props.link.node2_id);
  return node ? (node.alias || node.name) : "未知节点";
});





const handleEditParams = () => {
  showLinkParamsDialog.value = true;
};

const handleLinkParamsConfirm = (updatedLink: Link) => {
  if (updatedLink) {
    // 更新options
    if (updatedLink.options) {
      Object.assign(props.link.options, updatedLink.options);
    }

    // 更新iface中的IP地址
    if (updatedLink.iface1) {
      Object.assign(props.link.iface1, updatedLink.iface1);
    }
    if (updatedLink.iface2) {
      Object.assign(props.link.iface2, updatedLink.iface2);
    }
  }

  showLinkParamsDialog.value = false;
};

const handleLinkParamsCancel = () => {
  showLinkParamsDialog.value = false;
};

const handleDeleteLink = () => {
  ElMessageBox.confirm(
    `确定要删除 ${sourceNodeName.value} 和 ${targetNodeName.value} 之间的链路吗？`,
    "删除链路",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }
  )
    .then(async () => {
      try {
        await (topoStore as any).deleteLinkRemote(props.link);

        emit("close");
      } catch (error: any) {
        console.error("删除链路失败:", error?.message || "未知错误");
      }
    })
    .catch(() => {
    });
};
</script>

<style scoped>
.neo-infobox {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.85) 0%,
    rgba(17, 23, 64, 0.9) 100%
  );
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: min(408px, calc(100vw - 40px));
  min-width: 300px;
  min-height: 150px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(76, 175, 80, 0.2);
  color: white;
  transform-origin: top right;
  animation: infobox-appear 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  display: flex;
  flex-direction: column;
  resize: both;
}
@keyframes infobox-appear {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.neo-infobox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(
    90deg,
    rgba(76, 175, 80, 0.4) 0%,
    rgba(76, 175, 80, 0.2) 100%
  );
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  font-weight: 600;
  font-size: 16px;
  color: #4caf50;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  position: relative;
  flex: 0 0 auto;
}
.neo-infobox-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 15%;
  width: 70%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.7), transparent);
}
.neo-infobox-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
  display: flex;
  align-items: center;
}
.neo-infobox-close {
  cursor: pointer;
  color: rgba(76, 175, 80, 0.8);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(76, 175, 80, 0.1);
  transition: all 0.2s ease;
}
.neo-infobox-close:hover {
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.3);
  transform: rotate(90deg);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
}
.neo-infobox-content {
  padding: 14px;
  overflow-y: auto;
  flex: 1 1 auto;
  max-height: calc(80vh - 60px);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.neo-infobox-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.neo-section {
  margin-bottom: 16px;
  animation: section-appear 0.5s ease forwards;
  opacity: 0;
  transform: translateY(10px);
}
.neo-section:nth-child(1) {
  animation-delay: 0.1s;
}
.neo-section:nth-child(2) {
  animation-delay: 0.2s;
}
.neo-section:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes section-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.neo-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: rgba(76, 175, 80, 0.9);
  letter-spacing: 0.5px;
  position: relative;
}
.neo-section-title .el-icon {
  color: #4caf50;
  font-size: 18px;
  background: rgba(76, 175, 80, 0.15);
  padding: 4px;
  border-radius: 6px;
}
.neo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 4px;
}
.neo-grid-item {
  display: flex;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(76, 175, 80, 0.05);
}
.neo-grid-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(76, 175, 80, 0.15);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.1);
  transform: scale(1.02);
}
.item-label {
  color: #a5d6a7;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}
.item-value {
  color: #e8f5e9;
  font-size: 15px;
  letter-spacing: 0.5px;
}

.node-info-block {
  margin-top: 14px;
  background: rgba(0, 60, 30, 0.06);
  border-radius: 8px;
  padding: 10px;
  border-left: 3px solid rgba(76, 175, 80, 0.4);
}

.node-info-title {
  font-size: 14px;
  color: #4caf50;
  margin-bottom: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.panel-icon {
  margin-right: 6px;
}

.neo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
}

.neo-btn {
  flex: 1;
  max-width: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 8px;
  letter-spacing: 0.5px;
}

.edit-btn {
  background: linear-gradient(to right, #2e7d32, #4caf50);
  color: #ffffff;
}

.edit-btn:hover {
  background: linear-gradient(to right, #4caf50, #66bb6a);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
}

.delete-btn {
  background: linear-gradient(to right, #c62828, #f44336);
  color: #ffffff;
}

.delete-btn:hover {
  background: linear-gradient(to right, #f44336, #e57373);
  box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
  transform: translateY(-2px);
}

.btn-icon {
  filter: drop-shadow(0 0 4px currentColor);
}



.item-value.highlight {
  color: #00bcd4;
  text-shadow: 0 0 8px rgba(0, 188, 212, 0.4);
}



.analyze-btn:hover {
  background: linear-gradient(to right, #00bcd4, #26c6da);
  box-shadow: 0 0 10px rgba(0, 188, 212, 0.5);
  transform: translateY(-2px);
}

.refresh-btn {
  cursor: pointer;
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 188, 212, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(0, 188, 212, 0.2);
  transform: rotate(180deg);
}

@media screen and (max-width: 768px) {
  .neo-infobox {
    width: min(350px, calc(100vw - 30px));
    top: 15px;
    right: 15px;
  }

  .neo-grid {
    grid-template-columns: 1fr;
  }
  
  .neo-actions {
    justify-content: center;
  }
  
  .neo-btn {
    max-width: none;
  }


}

@media screen and (max-width: 480px) {
  .neo-infobox {
    width: calc(100vw - 20px);
    top: 10px;
    right: 10px;
  }

  .neo-actions {
    flex-direction: column;
    gap: 8px;
  }

  .neo-infobox-title {
    max-width: 200px;
    font-size: 14px;
  }
  
  .neo-infobox-header {
    padding: 12px 14px;
  }
  
  .neo-infobox-content {
    padding: 12px 10px;
  }
  
  .neo-section-title {
    font-size: 13px;
  }
  
  .item-label {
    font-size: 12px;
  }
  
  .item-value {
    font-size: 14px;
  }
}

@media screen and (max-height: 700px) {
  .neo-infobox {
    max-height: 95vh;
    top: 10px;
  }
  
  .neo-infobox-content {
    max-height: calc(95vh - 60px);
  }
  
  .neo-section {
    margin-bottom: 12px;
  }
  
  .node-info-block {
    margin-top: 10px;
    padding: 8px;
  }
}
</style>
