<template>
  <div class="message-center">
    <div class="msg-header">
      <h2>消息中心</h2>
      <div class="user-role">
        <el-tag :type="roleTagType" effect="dark">{{userInfo.name+'('+ userInfo.username+')' }}</el-tag>
      </div>
    </div>

    <div class="msg-content">
      <div class="chat-container">
        <div class="chat-sidebar">
          <div class="chat-users">
            <h3>群组</h3>
            <ul class="user-list">
              <li 
                v-for="group in accessibleGroups" 
                :key="group.id"
                :class="{ active: selectedGroup === group.id }"
                @click="selectGroup(group.id)"
              >
                <div class="user-item">
                  <el-avatar :size="40" :style="{ backgroundColor: group.bgColor }" />
                  <div class="user-info">
                    <span class="user-name">{{ group.name }}</span>
                    <span class="user-status" :class="{ online: group.online }">
                      {{ group.online ? '在线' : '离线' }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="chat-main">
          <div class="chat-header" v-if="selectedGroup">
            <div class="chat-with">
              <span>当前群组: </span>
              <el-tag :type="selectedGroup === 'redGroup' ? 'danger' : 'primary'" size="small">
                {{ availableGroups.find(g => g.id === selectedGroup)?.name }}
              </el-tag>
              <el-button 
                type="text" 
                class="member-list-btn" 
                @click="showMemberList = true"
              >
                <el-icon><User /></el-icon>
                <span>成员列表</span>
              </el-button>
            </div>
          </div>
          
          <div v-if="!selectedGroup" class="no-chat-selected">
            <el-empty description="请选择一个群组开始聊天" />
          </div>
          
          <template v-else>
            <div class="chat-messages" ref="messagesContainer">
              <template v-if="currentMessages.length > 0">
                <div 
                  v-for="(message, index) in currentMessages" 
                  :key="index"
                  :class="['message-item', { 'self-message': message.sender === userInfo.role }]"
                >
                  <div class="message-avatar">
                    <el-avatar 
                      :size="36" 
                      :style="{ 
                        backgroundColor: getRoleColor(message.sender),
                        border: `2px solid rgba(0, 0, 0, 0.1)`
                      }"  
                    />
                  </div>
                  <div class="message-bubble">
                    <div class="message-info">
                      <span class="message-sender">{{ getRoleName(message.sender) }}</span>
                      <span class="message-time">{{ formatTime(message.time) }}</span>
                    </div>
                    <div class="message-text">{{ message.content }}</div>
                  </div>
                </div>
              </template>
              <div v-else class="no-messages">
                <el-empty description="暂无消息记录，开始发送消息吧" />
              </div>
            </div>

            <div class="chat-input">
              <el-input
                v-model="messageText"
                type="textarea"
                :rows="3"
                placeholder="请输入消息内容..."
                @keyup.enter.ctrl="sendMessage"
              />
              <div class="input-actions">
                <span class="send-tip">按 Ctrl + Enter 发送</span>
                <el-button type="primary" @click="sendMessage" :disabled="!messageText.trim() || !selectedGroup">
                  发送消息
                </el-button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 成员列表对话框 -->
    <el-dialog 
      v-model="showMemberList" 
      title="群组成员" 
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="member-list-content">
        <div v-for="user in currentGroupMembers" :key="user.role" class="member-item">
          <el-avatar :size="40" :style="{ backgroundColor: user.bgColor, border: '2px solid #A3A5A6' }" />
          <div class="member-info">
            <div class="member-name">{{ user.username }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showMemberList = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { User } from '@element-plus/icons-vue';
import { getUserInfo } from '../../store/user';
import { useThemeStore } from '../../store/modules/theme';
import { getUsers } from '../../api/auth';

// 用户信息类型
interface UserInfo {
  role: string;
  name: string;
  color: string;
  bgColor: string;
  username: string;
}

// 群组类型
interface GroupInfo {
  id: string;
  name: string;
  roles: string[]; 
  color: string;
  bgColor: string;
  online: boolean;
}

// 消息类型（群聊模式）
interface Message {
  sender: string;
  groupId: string; 
  content: string;
  time: Date;
}

// 角色信息类型
interface RoleInfo {
  role: string;
  name: string;
  color: string;
  bgColor: string;
  online: boolean;
  username: string; 
}

// 主题store
const themeStore = useThemeStore();

// 用户信息
const userInfo = ref<UserInfo>({
  role: '',
  name: '',
  color: '',
  bgColor: '',
  username: '',
});

// 所有用户列表
const allUsers = ref<RoleInfo[]>([]);

// 所有消息列表（按群组存储）
const groupMessages = ref<Record<string, Message[]>>({
  redGroup: [],
  blueGroup: []
});

// 当前显示的消息列表 (基于选定的群组)
const currentMessages = computed(() => {
  if (!selectedGroup.value) return [];
  return groupMessages.value[selectedGroup.value] || [];
});

const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const selectedGroup = ref(''); 
const showMemberList = ref(false); 

// 可用群组（红方群和蓝方群）
const availableGroups = ref<GroupInfo[]>([
  {
    id: 'redGroup',
    name: '红方群',
    roles: ['red', 'white'], 
    color: '#F56C6C',
    bgColor: '#F56C6C',
    online: true
  },
  {
    id: 'blueGroup',
    name: '蓝方群',
    roles: ['blue', 'white'], 
    color: '#1E90FF',
    bgColor: '#1E90FF',
    online: true
  }
]);

// 当前用户可以访问的群组
const accessibleGroups = computed(() => {
  return availableGroups.value.filter(group => 
    group.roles.includes(userInfo.value.role)
  );
});

// 用户标签类型
const roleTagType = computed(() => {
  switch(userInfo.value.role) {
    case 'white': return 'info';
    case 'red': return 'danger';
    case 'blue': return 'primary';
    default: return 'info';
  }
});

// 查询所有用户信息：确保 username 等字段补全，根据role设置color、bgColor
async function getAllUsers() { 
  try {
    const response = await getUsers();
    // 对获取到的用户数据进行处理
    allUsers.value = response.map((user: any) => {
      let roleNumber = Number(user.role);
      let color = '';
      let bgColor = '';
      let name = user.username; // 假设name用username填充，可根据实际改
      if (roleNumber === 1) {
        color = '#ffffff';
        bgColor = '#ffffff';
        name = name || '白方用户';
      } else if (roleNumber === 2) {
        color = '#F56C6C';
        bgColor = '#F56C6C';
        name = name || '红方用户';
      } else if (roleNumber === 3) {
        color = '#1E90FF';
        bgColor = '#1E90FF';
        name = name || '蓝方用户';
      } else {
        color = '#CCCCCC';
        bgColor = '#CCCCCC';
        name = name || '未知角色用户';
      }
      return {
        role: user.role,
        name: name,
        color: color,
        bgColor: bgColor,
        online: true, // 可根据实际接口返回调整
        username: user.username,
      } as RoleInfo;
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
  }
}

// 角色字符串到数字的映射表
const ROLE_MAPPING: Record<string, number> = {
  'white': 1,
  'red': 2,
  'blue': 3
};

// 当前群组成员（修改后的计算属性）
const currentGroupMembers = computed(() => {
  if (!selectedGroup.value) return [];
  const group = availableGroups.value.find(g => g.id === selectedGroup.value);
  if (!group) return [];
  
  // 将角色字符串转换为数字
  const roleNumbers = group.roles.map(role => ROLE_MAPPING[role] || 0);
  
  
  // 过滤出符合角色的用户
  const user= allUsers.value.filter(user => 
    roleNumbers.includes(Number(user.role))
  );
  return user;
});

// 初始化
onMounted(() => {
  // 获取用户信息
  const info = getUserInfo();
  if (info && info.role) {
    userInfo.value = {
      role: info.role,
      name: info.name,
      color: info.color,
      bgColor: info.bgColor,
      username: info.username,
    };

    // 根据用户角色设置主题
    if (info.hasRole && info.role) {
      themeStore.setThemeByRole(info.role);
    }

    // 如果只有一个可访问群组，自动选择
    if (accessibleGroups.value.length === 1) {
      selectGroup(accessibleGroups.value[0].id);
    }
  }

  getAllUsers(); 
  addDemoGroupMessages();
});

// 监听当前消息变化，自动滚动到底部
watch(currentMessages, () => {
  nextTick(() => {
    scrollToBottom();
  });
});

// 监听选定的群组变化
watch(selectedGroup, () => {
  messageText.value = ''; 
  nextTick(() => {
    scrollToBottom();
  });
});

// 获取角色颜色（优先从 allUsers 里的用户数据拿 bgColor）
const getRoleColor = (role: string): string => {
  const userFromAll = allUsers.value.find(r => r.role === role);
  if (userFromAll) {
    return userFromAll.bgColor;
  }
  const roleInfo = availableRoles.value.find(r => r.role === role);
  return roleInfo ? roleInfo.bgColor : '#CCCCCC';
};

// 获取角色名称
const getRoleName = (role: string): string => {
  const roleInfo = allUsers.value.find(r => r.role === role) || 
    availableRoles.value.find(r => r.role === role);
  return roleInfo ? roleInfo.name : '未知角色';
};

// 可用角色（用于头像颜色和名称）
const availableRoles = ref<RoleInfo[]>([
  {
    role: 'white',
    name: '白方',
    color: '#000000',
    bgColor: '#FFFFFF',
    online: true,
    username: '白方默认用户', 
  },
  {
    role: 'red',
    name: '红方',
    color: '#F56C6C',
    bgColor: '#F56C6C',
    online: true,
    username: '红方默认用户', 
  },
  {
    role: 'blue',
    name: '蓝方',
    color: '#1E90FF',
    bgColor: '#1E90FF',
    online: true,
    username: '蓝方默认用户', 
  }
]);

// 选择群组
const selectGroup = (groupId: string) => {
  selectedGroup.value = groupId;
};

// 发送群组消息
const sendMessage = () => {
  if (!messageText.value.trim() || !selectedGroup.value) return;
  
  const newMessage: Message = {
    sender: userInfo.value.role,
    groupId: selectedGroup.value,
    content: messageText.value,
    time: new Date()
  };
  
  groupMessages.value[selectedGroup.value].push(newMessage);
  messageText.value = ''; 
  
  setTimeout(() => {
    simulateGroupReply(selectedGroup.value);
  }, 1000 + Math.random() * 2000);
};

// 模拟群组回复
const simulateGroupReply = (groupId: string) => {
  const group = availableGroups.value.find(g => g.id === groupId);
  if (!group) return;
  
  const replyRoles = group.roles.filter(role => role !== userInfo.value.role);
  if (replyRoles.length === 0) return;
  
  const randomRole = replyRoles[Math.floor(Math.random() * replyRoles.length)];
  
  let replies: string[] = [];
  if (groupId === 'redGroup') {
    replies = [
      '红队监控系统已部署完毕。',
      '检测到异常网络流量，正在分析。',
    ];
  } else if (groupId === 'blueGroup') {
    replies = [
      '蓝队已就位，准备开始渗透测试。',
      '发现目标系统存在漏洞，正在分析。',
    ];
  }
  
  const randomReply = replies[Math.floor(Math.random() * replies.length)];
  
  const replyMessage: Message = {
    sender: randomRole,
    groupId: groupId,
    content: randomReply,
    time: new Date()
  };
  
  groupMessages.value[groupId].push(replyMessage);
};

// 添加演示群组消息
const addDemoGroupMessages = () => {
  groupMessages.value = {
    redGroup: [],
    blueGroup: []
  };
  
  if (userInfo.value.role === 'white') {
    groupMessages.value.redGroup.push(
      {
        sender: 'white',
        groupId: 'redGroup',
        content: '红方请注意，防御目标已设置，请部署防御策略。',
        time: new Date(Date.now() - 3600000)
      },
      {
        sender: 'red',
        groupId: 'redGroup',
        content: '了解，红队正在部署监控系统和防御措施。',
        time: new Date(Date.now() - 3300000)
      }
    );
    
    groupMessages.value.blueGroup.push(
      {
        sender: 'white',
        groupId: 'blueGroup',
        content: '蓝方请注意，已为您部署攻击目标环境，请开始行动。',
        time: new Date(Date.now() - 2400000)
      },
      {
        sender: 'blue',
        groupId: 'blueGroup',
        content: '收到，蓝队已就位，准备开始渗透测试。',
        time: new Date(Date.now() - 2100000)
      }
    );
  } else if (userInfo.value.role === 'red') {
    groupMessages.value.redGroup.push(
      {
        sender: 'white',
        groupId: 'redGroup',
        content: '红方请注意，已为您部署攻击目标环境，请开始行动。',
        time: new Date(Date.now() - 3600000)
      },
      {
        sender: 'red',
        groupId: 'redGroup',
        content: '收到，红队已就位，准备开始渗透测试。',
        time: new Date(Date.now() - 3300000)
      }
    );
  } else if (userInfo.value.role === 'blue') {
    groupMessages.value.blueGroup.push(
      {
        sender: 'white',
        groupId: 'blueGroup',
        content: '蓝方请注意，防御目标已设置，请部署防御策略。',
        time: new Date(Date.now() - 2400000)
      },
      {
        sender: 'blue',
        groupId: 'blueGroup',
        content: '了解，蓝队正在部署监控系统和防御措施。',
        time: new Date(Date.now() - 2100000)
      }
    );
  }
};

// 滚动到最新消息
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// 格式化时间
const formatTime = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};
</script>



<style scoped>
/* 基础容器样式 */
.message-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

/* 头部样式 */
.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
}

.msg-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.user-role {
  display: flex;
  align-items: center;
}

.user-role .el-tag {
  font-size: 14px;
  margin-right: 8px;
}

.role-description {
  font-size: 14px;
  color: #606266;
}

/* 内容区域样式 */
.msg-content {
  flex: 1;
  padding: 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.chat-container {
  flex: 1;
  display: flex;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* 侧边栏样式 */
.chat-sidebar {
  width: 240px;
  border-right: 1px solid #e6e6e6;
  background-color: #f9f9f9;
}

.chat-users h3 {
  padding: 16px;
  margin: 0;
  font-size: 16px;
  border-bottom: 1px solid #e6e6e6;
}

.user-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.user-list li {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.user-list li:hover {
  background-color: #f0f0f0;
}

.user-list li.active {
  background-color: #e6f7ff;
  border-right: 3px solid #1890ff;
}

.user-item {
  display: flex;
  align-items: center;
}

.user-info {
  margin-left: 12px;
  flex: 1;
}

.user-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.user-role-desc {
  display: block;
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.user-status {
  font-size: 12px;
  color: #999;
}

.user-status.online {
  color: #52c41a;
}

/* 主聊天区域样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
}

.chat-with {
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
  flex: 1;
}

.chat-with .el-tag {
  margin: 0 8px;
}

.member-list-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  padding: 0 8px;
}

.member-list-btn span {
  margin-left: 4px;
}

.no-chat-selected {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}

/* 消息列表样式 */
.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.message-item {
  display: flex;
  margin-bottom: 20px;
}

.message-item.self-message {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  background-color: #f9f9f9;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  margin-left: 12px;
}

.self-message .message-bubble {
  background-color: #e6f7ff;
  border: 1px solid #91d5ff;
  margin-left: 0;
  margin-right: 12px;
}

.message-info {
  margin-bottom: 6px;
}

.self-message .message-info {
  text-align: right;
}

.message-sender {
  font-weight: 500;
  margin-right: 8px;
}

.message-time {
  font-size: 12px;
  color: #999;
}

.message-text {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.no-messages {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}

/* 输入区域样式 */
.chat-input {
  border-top: 1px solid #e6e6e6;
  padding: 16px;
}

.chat-input .el-textarea {
  margin-bottom: 12px;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.send-tip {
  font-size: 12px;
  color: 999;
}

/* 成员列表样式 */
.member-list-content {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-info {
  margin-left: 12px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.member-role .el-tag {
  margin-right: 4px;
}
</style>