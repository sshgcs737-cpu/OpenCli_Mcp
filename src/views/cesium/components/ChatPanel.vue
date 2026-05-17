<template>
  <Teleport to="body">
    <div v-if="visible" class="chat-panel-container" :style="panelStyle">
      <!-- 聊天面板头部 -->
      <div class="chat-panel-header" @mousedown="startDrag">
        <div class="chat-title">
          <el-icon class="chat-icon">
            <ChatDotRound />
          </el-icon>
          <span>即时通信</span>
        </div>
        <div class="chat-controls">
          <el-icon class="minimize-btn" @click="toggleMinimize" :title="isMinimized ? '展开' : '最小化'">
            <component :is="isMinimized ? 'ArrowUp' : 'Minus'" />
          </el-icon>
          <el-icon class="close-btn" @click="handleClose" title="关闭">
            <Close />
          </el-icon>
        </div>
      </div>

      <!-- 聊天面板内容 -->
      <div v-show="!isMinimized" class="chat-panel-content">
        <!-- 消息显示区域 -->
        <div class="chat-messages" ref="messagesContainer">
          <div v-if="messages.length === 0" class="no-messages">
            <el-empty description="暂无消息" :image-size="60" />
          </div>
          <div v-else>
            <div 
              v-for="(message, index) in messages" 
              :key="index"
              :class="['message-item', { 'self-message': message.senderId === currentUserId }]"
            >
              <div class="message-avatar">
                <el-avatar 
                  :size="32" 
                  :style="{ 
                    backgroundColor: getRoleColor(message.role),
                    color: message.role === 1 ? '#000000' : '#FFFFFF'
                  }"
                >
                  {{ getUserName(message.senderId).charAt(0) }}
                </el-avatar>
              </div>
              <div class="message-bubble">
                <div class="message-info">
                  <span class="message-sender">{{ message.senderName }}</span>
                  <span class="message-time">{{ formatTime() }}</span>
                </div>
                <div class="message-content">{{ message.message }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息输入区域 -->
        <div class="chat-input-area">
          <div class="input-container">
            <el-input
              v-model="inputMessage"
              type="textarea"
              :rows="2"
              placeholder="输入消息..."
              resize="none"
              @keydown.enter.prevent="handleSendMessage"
              @keydown.ctrl.enter="inputMessage += '\n'"
              class="message-input"
            />
          </div>
          <div class="input-actions">
            <el-select
              v-model="selectedTeam"
              placeholder="选择队伍"
              size="small"
              class="team-select"
            >
              <el-option
                v-for="option in teamOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.disabled"
              />
            </el-select>
            <el-button 
              type="primary" 
              size="small" 
              @click="handleSendMessage"
              :disabled="!inputMessage.trim()"
              class="send-btn"
            >
              <el-icon><Promotion /></el-icon>
              发送
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { 
  ChatDotRound, 
  Close, 
  Minus, 
  ArrowUp, 
  Promotion 
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getUserInfo } from '../../../store/user';
import { useTopoStore } from '../../../store/modules/topo';
import websocketService from '../../../services/websocket';
import { getUsers } from '../../../api/auth';
import eventBus from '../../../utils/eventBus';

// 消息接口定义
interface ChatMessage {
  action: number;
  extand: String;
  senderName: String;
  senderId: string;
  role: number;
  message: string;
  sessionId: number;
}

// 组件属性
const props = defineProps<{
  visible: boolean;
}>();

// 组件事件
const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

// 响应式数据
const isMinimized = ref(false);
const inputMessage = ref('');
const messages = ref<ChatMessage[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const userList = ref<any[]>([]);

// 获取用户信息和store
const userInfo = getUserInfo();
const topoStore = useTopoStore();
const currentUserId = userInfo.id;
const currentUserRole = getUserRoleNumber(userInfo.role);

// 根据用户角色设置默认选择的队伍
const getDefaultTeam = () => {
  if (currentUserRole === 2) return 'red'; // 红方默认选择红方
  if (currentUserRole === 3) return 'blue'; // 蓝方默认选择蓝方
  return 'all'; // 白方默认选择全部
};

const selectedTeam = ref(getDefaultTeam());

// 拖拽相关
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const position = ref({ x: window.innerWidth - 450, y: 100 });

// 队伍选项配置
const teamOptions = computed(() => {
  const baseOptions = [
    { label: '全部', value: 'all', disabled: false }
  ];

  // 根据用户角色添加可选项
  if (currentUserRole === 1) { // 白方可以选择所有队伍
    baseOptions.push(
      { label: '红方', value: 'red', disabled: false },
      { label: '蓝方', value: 'blue', disabled: false }
    );
  } else if (currentUserRole === 2) { // 红方只能选择全部或红方
    baseOptions.push(
      { label: '红方', value: 'red', disabled: false }
    );
  } else if (currentUserRole === 3) { // 蓝方只能选择全部或蓝方
    baseOptions.push(
      { label: '蓝方', value: 'blue', disabled: false }
    );
  }

  return baseOptions;
});

// 计算面板样式
const panelStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}));

// 获取角色数字
function getUserRoleNumber(role: string): number {
  switch (role) {
    case 'white': return 1;
    case 'red': return 2;
    case 'blue': return 3;
    default: return 1;
  }
}

// 获取角色颜色
function getRoleColor(role: number): string {
  switch (role) {
    case 1: return '#FFFFFF';
    case 2: return '#F56C6C';
    case 3: return '#409EFF';
    default: return '#CCCCCC';
  }
}

// 获取用户名（根据senderId）
function getUserName(senderId: string): string {
  // 如果是当前用户，直接返回当前用户名
  if (senderId === currentUserId) {
    return userInfo.username || '我';
  }
  
  // 从用户列表中查找用户名
  const user = userList.value.find(u => u.id === senderId);
  if (user && user.username) {
    return user.username;
  }
  
  // 如果找不到，返回senderId的前8位作为显示名
  return senderId.length > 8 ? senderId.substring(0, 8) + '...' : senderId;
}

// 格式化时间
function formatTime(): string {
  const date = new Date();
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 发送消息
function handleSendMessage() {
  if (!inputMessage.value.trim()) return;
  
  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  if (!sessionId) {
    ElMessage.warning('请先选择场景');
    return;
  }

  const message: ChatMessage = {
    action: 3,
    extand: selectedTeam.value,
    senderName: getUserName(currentUserId),
    senderId: currentUserId,
    role: currentUserRole,
    message: inputMessage.value.trim(),
    sessionId: sessionId
  };

  // 发送WebSocket消息
  websocketService.send(message);
  
  // 添加到本地消息列表
  messages.value.push(message);
  
  // 清空输入框
  inputMessage.value = '';
  
  // 滚动到底部
  nextTick(() => {
    scrollToBottom();
  });
}

// 滚动到底部
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

// 处理接收到的聊天消息
function handleChatMessage(data: any) {
  if (data.action === 3 && data.senderId !== currentUserId) {
    const message: ChatMessage = {
      action: data.action,
      extand: data.extand,
      senderName:data.senderName,
      senderId: data.senderId,
      role: data.role,
      message: data.message,
      sessionId: data.sessionId
    };
    
    messages.value.push(message);
    
    // 发送新消息事件通知TopNavBar
    eventBus.emit('newChatMessage');
    
    nextTick(() => {
      scrollToBottom();
    });
  } 
}

// 切换最小化状态
function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
}

// 关闭聊天面板
function handleClose() {
  emit('update:visible', false);
}

// 拖拽功能
function startDrag(event: MouseEvent) {
  isDragging.value = true;
  dragOffset.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  
  const newX = event.clientX - dragOffset.value.x;
  const newY = event.clientY - dragOffset.value.y;
  
  // 限制拖拽范围
  const maxX = window.innerWidth - 420;
  const maxY = window.innerHeight - 100;
  
  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  };
}

function stopDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// 监听可见性变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // 当聊天面板打开时，通知TopNavBar清除未读消息计数
    eventBus.emit('clearUnreadMessages');
    nextTick(() => {
      scrollToBottom();
    });
  }
});

// 获取用户列表
async function fetchUserList() {
  try {
    const users = await getUsers();
    userList.value = users || [];
  } catch (error) {
    console.error('获取用户列表失败:', error);
  }
}

// 组件挂载时注册WebSocket消息处理器
onMounted(() => {
  websocketService.onMessage('action_3', handleChatMessage);
  fetchUserList(); // 获取用户列表
});

// 组件卸载时移除WebSocket消息处理器
onUnmounted(() => {
  websocketService.offMessage('action_3', handleChatMessage);
});
</script>

<style scoped>
.chat-panel-container {
  position: fixed;
  width: 420px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #00eaff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 234, 255, 0.3);
  z-index: 9999;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.chat-panel-header {
  background: linear-gradient(90deg, #00eaff 0%, #0099cc 100%);
  color: #000;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
}

.chat-icon {
  font-size: 16px;
}

.chat-controls {
  display: flex;
  gap: 8px;
}

.minimize-btn,
.close-btn {
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.minimize-btn:hover,
.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.chat-panel-content {
  height: 500px;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
}

.no-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
}

.message-item {
  display: flex;
  margin-bottom: 12px;
  gap: 8px;
}

.message-item.self-message {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 234, 255, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
}

.self-message .message-bubble {
  background: rgba(0, 234, 255, 0.2);
  border-color: rgba(0, 234, 255, 0.5);
}

.message-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
}

.message-sender {
  font-weight: 600;
  color: #00eaff;
}

.message-time {
  color: #888;
}

.message-content {
  color: #fff;
  line-height: 1.4;
  word-wrap: break-word;
}

.chat-input-area {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(0, 234, 255, 0.3);
}

.input-container {
  margin-bottom: 8px;
}

.message-input {
  background: rgba(255, 255, 255, 0.1) !important;
}

.message-input :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 234, 255, 0.3);
  color: #fff;
  border-radius: 4px;
}

.message-input :deep(.el-textarea__inner):focus {
  border-color: #00eaff;
  box-shadow: 0 0 0 2px rgba(0, 234, 255, 0.2);
}

.message-input :deep(.el-textarea__inner)::placeholder {
  color: #888;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.team-select {
  width: 100px;
}

.team-select :deep(.el-input__inner) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 234, 255, 0.3);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
}

.team-select :deep(.el-input__inner):focus {
  border-color: #00eaff;
  box-shadow: 0 0 0 2px rgba(0, 234, 255, 0.2);
}

.team-select :deep(.el-select__caret) {
  color: #00eaff;
}

.send-btn {
  background: linear-gradient(90deg, #00eaff 0%, #0099cc 100%);
  border: none;
  color: #000;
  font-weight: 600;
}

.send-btn:hover {
  background: linear-gradient(90deg, #00d4e6 0%, #0088bb 100%);
}

.send-btn:disabled {
  background: #666;
  color: #999;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 234, 255, 0.3);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 234, 255, 0.5);
}
</style>