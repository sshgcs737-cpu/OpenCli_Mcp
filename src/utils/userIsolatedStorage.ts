// 用户隔离存储适配器
function createUserIsolatedStorage() {
  return {
    getItem(key: string) {
      try {
        // 获取当前会话ID
        const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
        
        // 尝试获取用户ID
        let userId = 'anonymous';
        const allKeys = Object.keys(localStorage);
        const userInfoKeys = allKeys.filter(k => 
          k.startsWith('userInfo_') && k.includes(sessionId)
        );
        
        if (userInfoKeys.length > 0) {
          try {
            const userInfo = JSON.parse(localStorage.getItem(userInfoKeys[0]) || '{}');
            userId = userInfo.id || 'anonymous';
          } catch (error) {
            console.warn('解析用户信息失败:', error);
          }
        }
        
        // 使用用户和会话隔离的存储键
        const isolatedKey = `${key}_${userId}_${sessionId}`;
        return localStorage.getItem(isolatedKey);
      } catch (error) {
        console.warn('获取存储数据失败:', error);
        return null;
      }
    },
    
    setItem(key: string, value: string) {
      try {
        // 获取当前会话ID
        const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
        
        // 尝试获取用户ID
        let userId = 'anonymous';
        const allKeys = Object.keys(localStorage);
        const userInfoKeys = allKeys.filter(k => 
          k.startsWith('userInfo_') && k.includes(sessionId)
        );
        
        if (userInfoKeys.length > 0) {
          try {
            const userInfo = JSON.parse(localStorage.getItem(userInfoKeys[0]) || '{}');
            userId = userInfo.id || 'anonymous';
          } catch (error) {
            console.warn('解析用户信息失败:', error);
          }
        }
        
        // 使用用户和会话隔离的存储键
        const isolatedKey = `${key}_${userId}_${sessionId}`;
        localStorage.setItem(isolatedKey, value);
      } catch (error) {
        console.warn('保存存储数据失败:', error);
      }
    },
    
    removeItem(key: string) {
      try {
        // 获取当前会话ID
        const sessionId = sessionStorage.getItem('currentSessionId') || 'default';
        
        // 尝试获取用户ID
        let userId = 'anonymous';
        const allKeys = Object.keys(localStorage);
        const userInfoKeys = allKeys.filter(k => 
          k.startsWith('userInfo_') && k.includes(sessionId)
        );
        
        if (userInfoKeys.length > 0) {
          try {
            const userInfo = JSON.parse(localStorage.getItem(userInfoKeys[0]) || '{}');
            userId = userInfo.id || 'anonymous';
          } catch (error) {
            console.warn('解析用户信息失败:', error);
          }
        }
        
        // 使用用户和会话隔离的存储键
        const isolatedKey = `${key}_${userId}_${sessionId}`;
        localStorage.removeItem(isolatedKey);
      } catch (error) {
        console.warn('删除存储数据失败:', error);
      }
    }
  };
}

export { createUserIsolatedStorage };