// 脚本用于批量更新日志格式
const fs = require('fs');
const path = require('path');

// 类型映射
const typeMapping = {
  'info': 'normal',
  'success': 'important',
  'error': 'important',
  'warning': 'warning'
};

// 生成 information 字段的函数
function generateInformation(action, type) {
  const actionMap = {
    '创建节点': '节点创建成功',
    '创建链路': '链路创建成功',
    '创建子网': '子网创建成功',
    '创建干扰节点': '干扰节点创建成功',
    '启动仿真': '仿真启动',
    '停止仿真': '仿真停止',
    '初始化地图': '地图初始化',
    '恢复快照': '场景恢复',
    '位置更新开始': '位置更新启动',
    '位置更新停止': '位置更新停止',
    '开始移动': '无人机移动开始',
    '结束移动': '无人机移动结束',
    '选择链路起点': '链路起点选择'
  };
  
  return actionMap[action] || action;
}

// 更新日志调用的正则表达式
function updateLogCalls(content) {
  // 匹配 systemLogStore.addLog 调用
  const logCallRegex = /systemLogStore\.addLog\(\s*\{\s*type:\s*["']([^"']+)["'],\s*module:\s*["']([^"']+)["'],\s*action:\s*["']([^"']+)["'],\s*details:\s*([^}]+)\s*\}\s*\)/g;
  
  return content.replace(logCallRegex, (match, type, module, action, details) => {
    const newType = typeMapping[type] || 'normal';
    const information = generateInformation(action, type);
    
    return `systemLogStore.addLog({
      type: "${newType}",
      module: "${module}",
      action: "${action}",
      information: "${information}",
      details: ${details}
    })`;
  });
}

// 处理文件
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = updateLogCalls(content);
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`已更新文件: ${filePath}`);
    } else {
      console.log(`文件无需更新: ${filePath}`);
    }
  } catch (error) {
    console.error(`处理文件 ${filePath} 时出错:`, error);
  }
}

// 要处理的文件列表
const filesToProcess = [
  'src/views/cesium/components/Cesium.vue'
];

// 处理所有文件
filesToProcess.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  } else {
    console.log(`文件不存在: ${fullPath}`);
  }
});

console.log('日志格式更新完成！');
