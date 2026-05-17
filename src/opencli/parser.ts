import type { OpenCliCommand, OpenCliNodeType, OpenCliRole } from './types';

const typeMap: Array<[RegExp, OpenCliNodeType]> = [
  [/(无人机|uav|drone)/i, 'DRONE'],
  [/(emane|无线子网|无线网络|子网)/i, 'EMANE'],
  [/(基站|base\s*station|basestation)/i, 'BASESTATION'],
  [/(路由器|router)/i, 'DEFAULT'],
  [/(虚拟机|vmnode|vm)/i, 'VMNODE'],
  [/(终端|电脑|rj45|pc)/i, 'RJ45'],
  [/(交换机|switch)/i, 'SWITCH'],
  [/(干扰|干扰节点|inode)/i, 'INODE'],
  [/(docker|容器)/i, 'DOCKER'],
];

const roleMap: Array<[RegExp, OpenCliRole]> = [
  [/(公共|白方|white)/i, 1],
  [/(红方|red)/i, 2],
  [/(蓝方|blue)/i, 3],
];

function normalize(input: string): string {
  return input
    .trim()
    .replace(/[，。；：]/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseNumberAfter(input: string, keys: string[]): number | undefined {
  for (const key of keys) {
    const match = input.match(new RegExp(`${key}\\s*[=:：]?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
    if (match) return Number(match[1]);
  }
  return undefined;
}

function parsePosition(input: string): { lat?: number; lon?: number; alt?: number } {
  const lat = parseNumberAfter(input, ['lat', 'latitude', '纬度']);
  const lon = parseNumberAfter(input, ['lon', 'lng', 'longitude', '经度']);
  const alt = parseNumberAfter(input, ['alt', 'height', '高度', '海拔']);
  if (lat !== undefined || lon !== undefined || alt !== undefined) return { lat, lon, alt };

  const coordinateMatch = input.match(/(?:在|到|坐标|position|pos)\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)(?:\s*[,\s]\s*(-?\d+(?:\.\d+)?))?/i);
  if (coordinateMatch) {
    return {
      lat: Number(coordinateMatch[1]),
      lon: Number(coordinateMatch[2]),
      alt: coordinateMatch[3] !== undefined ? Number(coordinateMatch[3]) : undefined,
    };
  }

  return {};
}

function parseNodeType(input: string): OpenCliNodeType {
  const found = typeMap.find(([pattern]) => pattern.test(input));
  return found?.[1] ?? 'DEFAULT';
}

function parseRole(input: string): OpenCliRole | undefined {
  return roleMap.find(([pattern]) => pattern.test(input))?.[1];
}

function parseName(input: string): string | undefined {
  const named = input.match(/(?:名称|名字|叫|名为|name)\s*[=:：]?\s*([\w\-\u4e00-\u9fa5]+)/i);
  if (named) return named[1];

  const quoted = input.match(/["“']([^"”']+)["”']/);
  if (quoted) return quoted[1].trim();

  return undefined;
}

function parseSceneId(input: string): number | undefined {
  const match = input.match(/(?:场景|scene|session|会话)\s*(?:id)?\s*[=:：]?\s*(\d+)/i) ||
    input.match(/(?:id|session)\s*[=:：]\s*(\d+)/i) ||
    input.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : undefined;
}

function parseSceneName(input: string): string | undefined {
  const named = parseName(input);
  if (named) return named;

  const match = input.match(/(?:加载场景|打开场景|切换场景|切换到|load scene|load session)\s*([\w\-\u4e00-\u9fa5]+)/i);
  if (!match) return undefined;

  const value = match[1].trim();
  if (!value || /^\d+$/.test(value)) return undefined;
  return value;
}

function parseSceneScope(input: string): 'private' | 'public' | 'all' {
  if (/(私有|private)/i.test(input)) return 'private';
  if (/(公共|公有|public)/i.test(input)) return 'public';
  return 'all';
}

function parseTwoTargets(input: string): [string, string] | null {
  const match = input.match(/(?:连接|连线|connect|link)\s+([\w\-\u4e00-\u9fa5]+)\s+(?:到|和|with|to)?\s*([\w\-\u4e00-\u9fa5]+)/i);
  if (!match) return null;
  return [match[1], match[2]];
}

function stripOptionTail(input: string): string {
  return input
    .replace(/(?:lat|latitude|纬度|lon|lng|longitude|经度|alt|height|高度|海拔)\s*[=:：]?\s*-?\d+(?:\.\d+)?/gi, ' ')
    .replace(/(?:类型|type|角色|role)\s*[=:：]?\s*[\w\-\u4e00-\u9fa5]+/gi, ' ');
}

function splitCliList(input: string): string[] {
  return stripOptionTail(input)
    .replace(/[，、,;；]+/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isListNoiseToken(token: string): boolean {
  return /^(节点|链路|子网|无线子网|名称|名字|别名|批量|添加|创建|删除|连接|连线|到|和|及|与|有线|无线|node|nodes|link|links|name|names|add|create|delete|remove|connect|to|with|wired|wireless)$/i.test(token);
}

function parseTargetList(input: string, pattern: RegExp): string[] {
  const match = input.match(pattern);
  if (!match) return [];
  return splitCliList(match[1] || '')
    .filter((token) => !isListNoiseToken(token))
    .filter((token, index, list) => list.indexOf(token) === index);
}

function parseBatchNodeNames(input: string): string[] {
  const named = input.match(/(?:名称|名字|别名|names?|name)\s*[=:：]?\s*(.+)$/i);
  const commandTail = input.match(/(?:批量添加|批量创建|批量新增|add nodes|create nodes)\s*(.+)$/i);
  const raw = named?.[1] || commandTail?.[1] || '';

  return splitCliList(raw)
    .filter((token) => !isListNoiseToken(token))
    .filter((token) => !typeMap.some(([pattern]) => pattern.test(token)))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token, index, list) => list.indexOf(token) === index);
}

function parseLinkPairs(input: string): Array<{ from: string; to: string }> {
  const pairs: Array<{ from: string; to: string }> = [];
  const directPattern = /([\w\u4e00-\u9fa5]+)\s*(?:<->|--|-|到|和|与|to|with)\s*([\w\u4e00-\u9fa5]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = directPattern.exec(input))) {
    const from = match[1];
    const to = match[2];
    if (!isListNoiseToken(from) && !isListNoiseToken(to) && from !== to) {
      pairs.push({ from, to });
    }
  }

  if (pairs.length > 0) {
    return pairs.filter((pair, index, list) =>
      list.findIndex((item) => item.from === pair.from && item.to === pair.to) === index
    );
  }

  const tail = input.match(/(?:批量连接|批量添加链路|批量创建链路|批量删除链路|add links|create links|delete links|remove links)\s*(.+)$/i)?.[1] || '';
  const tokens = splitCliList(tail).filter((token) => !isListNoiseToken(token));

  for (let index = 0; index < tokens.length - 1; index += 2) {
    if (tokens[index] !== tokens[index + 1]) {
      pairs.push({ from: tokens[index], to: tokens[index + 1] });
    }
  }

  return pairs;
}

export function parseOpenCli(input: string): OpenCliCommand {
  const text = normalize(input);

  if (!text || /^(help|帮助|\?)$/i.test(text)) return { kind: 'help' };

  if (/(退出当前场景|离开当前场景|退出场景|返回场景列表|回到场景列表|exit scene|leave scene|back to scenes)/i.test(text)) {
    return { kind: 'exitCurrentScene' };
  }

  if (/(场景列表|查看场景|列出场景|list scenes|show scenes)/i.test(text)) {
    return { kind: 'listScenes', scope: parseSceneScope(text), name: parseName(text) };
  }

  if (/(当前场景|当前会话|current scene|current session)/i.test(text)) return { kind: 'currentScene' };

  if (/(打开态势|进入态势|态势展示|open viewer|viewer)/i.test(text)) return { kind: 'openViewer' };

  if (/(刷新拓扑|刷新场景|reload|refresh)/i.test(text)) return { kind: 'refreshTopo' };

  if (/(仿真检查|启动检查|检查仿真|检查启动|preflight|check simulation|check start)/i.test(text)) return { kind: 'simulationCheck' };

  if (/(关闭场景|强制关闭场景|close scene|clear session)/i.test(text)) {
    const sessionId = parseSceneId(text);
    const name = sessionId ? undefined : parseSceneName(text);
    if (!sessionId && !name) throw new Error('关闭场景需要提供 ID 或名称，例如：关闭场景 12');
    return { kind: 'closeScene', sessionId, name };
  }

  if (/(加载场景|打开场景|切换场景|切换到|load scene|load session)/i.test(text)) {
    const sessionId = parseSceneId(text);
    const name = sessionId ? undefined : parseSceneName(text);
    if (!sessionId && !name) throw new Error('加载场景需要提供 ID 或名称，例如：加载场景 12，或：切换到 OpenCLI测试');
    return { kind: 'loadScene', sessionId, name };
  }

  if (/(新建场景|创建场景|初始化场景|init|new scene)/i.test(text)) {
    return { kind: 'initScene', name: parseName(text) };
  }

  if (/(启动仿真|启动会话|start session|start simu)/i.test(text)) {
    return { kind: 'startSession', duration: parseNumberAfter(text, ['duration', '时长']) };
  }

  if (/(暂停仿真|暂停会话|pause session|pause simu)/i.test(text)) return { kind: 'pauseSession' };
  if (/(停止仿真|停止会话|stop session|stop simu)/i.test(text)) return { kind: 'stopSession' };
  if (/(演示场景|示例场景|样例场景|sample|demo)/i.test(text)) return { kind: 'sampleScene' };
  if (/(清空|清除|clear)/i.test(text) || /(?:删除|delete|remove).*(?:全部|所有|all).*(?:节点|链路|子网|拓扑|topo|scene)/i.test(text)) return { kind: 'clearScene' };
  if (/(查看节点|节点列表|list nodes|show nodes)/i.test(text)) return { kind: 'listNodes' };
  if (/(查看链路|链路列表|list links|show links)/i.test(text)) return { kind: 'listLinks' };
  if (/(导出|export)/i.test(text)) return { kind: 'exportScene' };

  if (/(批量删除链路|delete links|remove links)/i.test(text)) {
    const pairs = parseLinkPairs(text);
    if (pairs.length === 0) throw new Error('批量删除链路需要提供链路两端，例如：批量删除链路 DRONE1-EMANE1 DRONE2-EMANE1');
    return { kind: 'deleteLinksBatch', pairs };
  }

  if (/(批量删除节点|批量删除子网|delete nodes|remove nodes)/i.test(text)) {
    const targets = parseTargetList(text, /(?:批量删除节点|批量删除子网|delete nodes|remove nodes)\s*(.+)$/i);
    if (targets.length === 0) throw new Error('批量删除节点需要提供节点名称或 ID，例如：批量删除节点 DRONE1 DRONE2 EMANE1');
    return { kind: 'deleteNodesBatch', targets };
  }

  if (/(批量连接|批量添加链路|批量创建链路|add links|create links)/i.test(text)) {
    const pairs = parseLinkPairs(text);
    if (pairs.length === 0) throw new Error('批量添加链路需要提供节点对，例如：批量连接 DRONE1-EMANE1 DRONE2-EMANE1');
    return {
      kind: 'addLinksBatch',
      pairs,
      linkType: /(有线|wired)/i.test(text) ? 'WIRED' : /(无线|wireless)/i.test(text) ? 'WIRELESS' : undefined,
    };
  }

  const connectTargets = parseTwoTargets(text);
  if (connectTargets) {
    return {
      kind: 'connectNodes',
      from: connectTargets[0],
      to: connectTargets[1],
      linkType: /(有线|wired)/i.test(text) ? 'WIRED' : 'WIRELESS',
    };
  }

  const deleteMatch = text.match(/(?:删除|delete|remove)\s+([\w\-\u4e00-\u9fa5]+)/i);
  if (deleteMatch) return { kind: 'deleteNode', target: deleteMatch[1] };

  const faultMatch = text.match(/(?:故障|禁用|打掉|down)\s+([\w\-\u4e00-\u9fa5]+)/i);
  if (faultMatch) return { kind: 'setNodeStatus', target: faultMatch[1], status: 'DOWN' };

  const recoverMatch = text.match(/(?:恢复|启用|修复|up)\s+([\w\-\u4e00-\u9fa5]+)/i);
  if (recoverMatch) return { kind: 'setNodeStatus', target: recoverMatch[1], status: 'UP' };

  const moveMatch = text.match(/(?:移动|move)\s+([\w\-\u4e00-\u9fa5]+)/i);
  if (moveMatch) {
    const { lat, lon, alt } = parsePosition(text);
    if (lat === undefined || lon === undefined) {
      throw new Error('移动节点需要提供纬度和经度，例如：移动 DRONE1 到 lat=30.52 lon=114.32 alt=300');
    }
    return { kind: 'moveNode', target: moveMatch[1], lat, lon, alt };
  }

  const batchMatch = text.match(/(?:生成|创建|添加|add)\s*(\d+)\s*(?:个|架|台)?\s*(无人机|uav|drone|基站|路由器|router|终端|电脑|rj45|emane|无线子网|子网)/i);
  if (batchMatch) {
    const { lat, lon, alt } = parsePosition(text);
    return {
      kind: 'addNodesGrid',
      nodeType: parseNodeType(batchMatch[2]),
      count: Number(batchMatch[1]),
      centerLat: lat,
      centerLon: lon,
      alt,
      role: parseRole(text),
    };
  }

  if (/(批量添加|批量创建|批量新增|add nodes|create nodes)/i.test(text)) {
    const names = parseBatchNodeNames(text);
    const { lat, lon, alt } = parsePosition(text);
    if (names.length === 0) throw new Error('批量添加节点需要提供节点名称，例如：批量添加无人机 DRONE1 DRONE2 DRONE3');
    return {
      kind: 'addNodesBatch',
      nodeType: parseNodeType(text),
      names,
      centerLat: lat,
      centerLon: lon,
      alt,
      role: parseRole(text),
    };
  }

  if (/(添加|创建|add|create)/i.test(text)) {
    const { lat, lon, alt } = parsePosition(text);
    return {
      kind: 'addNode',
      nodeType: parseNodeType(text),
      name: parseName(text),
      lat,
      lon,
      alt,
      role: parseRole(text),
    };
  }

  throw new Error('暂时无法识别这条命令。输入“帮助”查看可用命令。');
}
