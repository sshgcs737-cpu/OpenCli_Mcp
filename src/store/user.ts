import { reactive } from 'vue';
import { useThemeStore } from './modules/theme';

// 定义用户状态接口
interface UserState {
  role: string; // 用户角色：white, red, blue
  name: string; // 用户名称
  color: string; // 用户颜色：对应的hex值
  bgColor: string; // 头像背景色
  id: string; // 用户ID
  username: string; // 用户名
  type: number; // 用户类型：1-管理员，2-普通用户
  hasRole: boolean; // 是否已分配角色
  mode: string; // 仿真模式：'' | 'normal' | 'attack-defense'
  disturb: number; // 分布式场景权限：1-有权限，0-无权限
}

// 角色配置接口
interface RoleConfig {
  [key: string]: {
    name: string;
    color: string;
    bgColor: string;
  };
}

// 用户类型配置接口
interface TypeConfig {
  [key: number]: {
    name: string;
  };
}

// 会话级别的用户状态存储
const sessionUserStates = new Map<string, UserState>();

// 角色配置
const roleConfig: RoleConfig = {
  white: {
    name: '白方',
    color: '#000000',
    bgColor: '#FFFFFF', // 纯白色背景
  },
  red: {
    name: '红方',
    color: '#F56C6C',
    bgColor: '#F56C6C',
  },
  blue: {
    name: '蓝方',
    color: '#1E90FF',
    bgColor: '#1E90FF',
  },
};

// 用户类型配置
const typeConfig: TypeConfig = {
  1: {
    name: '管理员',
  },
  2: {
    name: '普通用户',
  },
};

// 生成会话唯一标识符
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取当前会话ID，如果不存在则创建新的
function getCurrentSessionId(): string {
  let sessionId = sessionStorage.getItem('currentSessionId');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('currentSessionId', sessionId);
  }
  return sessionId;
}

// 获取用户特定的存储键
function getUserStorageKey(baseKey: string, userId?: string): string {
  const sessionId = getCurrentSessionId();
  const userKey = userId || 'anonymous';
  return `${baseKey}_${userKey}_${sessionId}`;
}

// 获取当前会话的用户状态，如果不存在则创建
function getCurrentUserState(): UserState {
  const sessionId = getCurrentSessionId();
  
  if (!sessionUserStates.has(sessionId)) {
    // 创建新的用户状态
    const newUserState: UserState = {
      role: '', // 用户角色：white, red, blue
      name: '', // 用户名称
      color: '', // 用户颜色
      bgColor: '', // 头像背景色
      id: '', // 用户ID
      username: '', // 用户名
      type: 0, // 用户类型：1-管理员，2-普通用户
      hasRole: false, // 默认未分配角色
      mode: '', // 仿真模式
      disturb: 0, // 默认无分布式场景权限
    };
    
    sessionUserStates.set(sessionId, reactive(newUserState));
    
    // 尝试从存储中恢复用户数据
    const storedInfo = tryLoadUserFromStorage();
    if (storedInfo) {
      Object.assign(sessionUserStates.get(sessionId)!, storedInfo);
    }
  }
  
  return sessionUserStates.get(sessionId)!;
}

// 尝试从存储中加载用户数据
function tryLoadUserFromStorage(): UserState | null {
  try {
    const sessionId = getCurrentSessionId();
    
    // 尝试从多个可能的存储键获取用户信息
    const possibleKeys = [
      `userInfo_anonymous_${sessionId}`,
      'userInfo' // 兼容旧版本
    ];
    
    // 也尝试根据已知用户ID构建键
    const allKeys = Object.keys(localStorage);
    const userInfoKeys = allKeys.filter(key => 
      key.startsWith('userInfo_') && key.includes(sessionId)
    );
    possibleKeys.push(...userInfoKeys);
    
    for (const key of possibleKeys) {
      const info = localStorage.getItem(key);
      if (info) {
        const parsed = JSON.parse(info);
        return {
          role: parsed.role || '',
          type: parsed.type || 2,
          name: parsed.name || '',
          color: parsed.color || '',
          bgColor: parsed.bgColor || '',
          id: parsed.id || '',
          username: parsed.username || '',
          hasRole: parsed.hasRole || false,
          mode: parsed.mode || '',
          disturb: parsed.disturb ?? 0,
        };
      }
    }
  } catch (error) {
    console.error('解析本地存储的用户信息失败:', error);
  }
  
  return null;
}

// 设置用户信息
export function setUserInfo(role: string, id?: string, username?: string, type: number = 2): void {

  const userState = getCurrentUserState();
  
  // 设置用户类型
  userState.type = type || 2; // 默认为普通用户

  // 设置用户ID和用户名（如果有的话）
  if (id) {
    userState.id = id;
  }
  if (username) {
    userState.username = username;
  }

  // 保存到用户隔离的存储
  const userInfo = {
    type: userState.type,
    id: userState.id,
    username: userState.username,
    hasRole: userState.hasRole,
    role: userState.role,
    name: userState.name,
    color: userState.color,
    bgColor: userState.bgColor,
    mode: userState.mode,
    disturb: userState.disturb,
  };

  const storageKey = getUserStorageKey('userInfo', userState.id);
  localStorage.setItem(storageKey, JSON.stringify(userInfo));
}

// 设置仿真模式
export function setUserMode(mode: string): void {
  const userState = getCurrentUserState();
  userState.mode = mode;

  if (mode === 'normal') {
    // 普通模式：内部设为 white 角色，获得全部权限
    userState.role = 'white';
    userState.name = '普通模式';
    userState.color = '#000000';
    userState.bgColor = '#FFFFFF';
    userState.hasRole = true;

    try {
      const themeStore = useThemeStore();
      themeStore.setThemeByRole('white');
    } catch (error) {
      console.warn('主题设置失败:', error);
    }
  }
  // attack-defense 模式等待后续 setUserRole 设置角色

  // 持久化
  const userInfo = {
    type: userState.type,
    id: userState.id,
    username: userState.username,
    hasRole: userState.hasRole,
    role: userState.role,
    name: userState.name,
    color: userState.color,
    bgColor: userState.bgColor,
    mode: userState.mode,
    disturb: userState.disturb,
  };
  const storageKey = getUserStorageKey('userInfo', userState.id);
  localStorage.setItem(storageKey, JSON.stringify(userInfo));
}

// 设置用户角色信息
export function setUserRole(role: string): void {
  if (roleConfig[role]) {
    const userState = getCurrentUserState();

    userState.role = role;
    userState.name = roleConfig[role].name;
    userState.color = roleConfig[role].color;
    userState.bgColor = roleConfig[role].bgColor;
    userState.hasRole = true;

    // 更新用户隔离的存储
    const userInfo = {
      type: userState.type,
      id: userState.id,
      username: userState.username,
      hasRole: userState.hasRole,
      role: userState.role,
      name: userState.name,
      color: userState.color,
      bgColor: userState.bgColor,
      mode: userState.mode,
      disturb: userState.disturb,
    };

    const storageKey = getUserStorageKey('userInfo', userState.id);
    localStorage.setItem(storageKey, JSON.stringify(userInfo));

    // 根据角色自动设置主题
    try {
      const themeStore = useThemeStore();
      themeStore.setThemeByRole(role);
    } catch (error) {
      console.warn('主题设置失败:', error);
    }
  }
}

// 获取用户信息
export function getUserInfo(): UserState {
  return getCurrentUserState();
}

// 获取ordinary参数值：普通模式返回1，攻防模式返回2
export function getOrdinaryValue(): number {
  const userState = getCurrentUserState();
  return userState.mode === 'attack-defense' ? 2 : 1;
}

// 设置分布式场景创建权限
export function setDisturbPermission(disturb: number): void {
  const userState = getCurrentUserState();
  userState.disturb = disturb;

  // 持久化
  const userInfo = {
    type: userState.type,
    id: userState.id,
    username: userState.username,
    hasRole: userState.hasRole,
    role: userState.role,
    name: userState.name,
    color: userState.color,
    bgColor: userState.bgColor,
    mode: userState.mode,
    disturb: userState.disturb,
  };
  const storageKey = getUserStorageKey('userInfo', userState.id);
  localStorage.setItem(storageKey, JSON.stringify(userInfo));
}

// 清除用户信息
export function clearUserInfo(): void {
  const userState = getCurrentUserState();
  
  // 清除当前会话的用户数据
  const storageKey = getUserStorageKey('userInfo', userState.id);
  localStorage.removeItem(storageKey);
  localStorage.removeItem('userInfo'); // 兼容旧版本
  
  // 从会话状态中移除
  const sessionId = getCurrentSessionId();
  sessionUserStates.delete(sessionId);
  
  // 清除会话ID
  sessionStorage.removeItem('currentSessionId');
}

export default {
  setUserInfo,
  getUserInfo,
  clearUserInfo,
  setUserRole,
  setUserMode,
  roleConfig,
  typeConfig,
};