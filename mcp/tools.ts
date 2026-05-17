import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OpenCliCommand, OpenCliResult } from '../src/opencli/types.ts';
import type { OpenCliMcpExecutor } from './opencliMcpExecutor.ts';

const nodeTypeSchema = z.enum([
  'DRONE',
  'EMANE',
  'BASESTATION',
  'DEFAULT',
  'VMNODE',
  'RJ45',
  'SWITCH',
  'INODE',
  'DOCKER',
]);
const roleSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const linkTypeSchema = z.enum(['WIRED', 'WIRELESS']);
const linkPairSchema = z.object({
  from: z.string().min(1).describe('起点节点名称、别名或 ID。'),
  to: z.string().min(1).describe('终点节点名称、别名或 ID。'),
});

function toToolResult(result: OpenCliResult): CallToolResult {
  return {
    isError: !result.ok,
    content: [
      {
        type: 'text',
        text: result.message,
      },
    ],
  };
}

function truncate(value: string, maxLength = 220): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function formatArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  return truncate(JSON.stringify(args));
}

async function runTool(
  toolName: string,
  args: unknown,
  action: () => Promise<OpenCliResult> | OpenCliResult
): Promise<CallToolResult> {
  const startedAt = Date.now();
  const argsText = formatArgs(args);
  console.log(`[OpenCLI MCP] tool:start ${toolName}${argsText ? ` args=${argsText}` : ''}`);

  try {
    const result = await action();
    const duration = Date.now() - startedAt;
    console.log(`[OpenCLI MCP] tool:end ${toolName} ok=${result.ok} ${duration}ms`);
    return toToolResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startedAt;
    console.error(`[OpenCLI MCP] tool:error ${toolName} ${duration}ms ${message}`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }
}

function runStructuredCommand(
  toolName: string,
  args: unknown,
  executor: OpenCliMcpExecutor,
  command: OpenCliCommand
): Promise<CallToolResult> {
  return runTool(toolName, args, () => executor.runCommand(command));
}

export function registerOpenCliTools(server: McpServer, executor: OpenCliMcpExecutor): void {
  server.registerTool('opencli_scene_list', {
    title: 'List OpenCLI scenes',
    description: '查询私有/公共/全部仿真场景列表。',
    inputSchema: {
      scope: z.enum(['private', 'public', 'all']).optional().default('all').describe('查询范围。'),
      name: z.string().optional().describe('按场景名过滤。'),
    },
  }, async ({ scope, name }) => runTool('opencli_scene_list', { scope, name }, () => executor.listScenes(scope, name)));

  server.registerTool('opencli_current_scene', {
    title: 'Current OpenCLI scene',
    description: '返回 MCP server 当前加载的场景状态。',
  }, async () => runTool('opencli_current_scene', {}, () => executor.currentScene()));

  server.registerTool('opencli_load_scene', {
    title: 'Load OpenCLI scene',
    description: '加载指定场景到 MCP server 内存状态，不改变后端仿真运行状态。',
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('场景 ID。'),
      name: z.string().optional().describe('场景名称。sessionId 优先。'),
    },
  }, async ({ sessionId, name }) => runTool('opencli_load_scene', { sessionId, name }, () => executor.loadScene({ sessionId, name })));

  server.registerTool('opencli_topo_summary', {
    title: 'Summarize OpenCLI topology',
    description: '返回当前或指定场景的拓扑摘要。',
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('可选场景 ID。缺省使用当前加载场景。'),
    },
  }, async ({ sessionId }) => runTool('opencli_topo_summary', { sessionId }, () => executor.topoSummary(sessionId)));

  server.registerTool('opencli_topo_export', {
    title: 'Export OpenCLI topology',
    description: '返回当前或指定场景的完整 topo JSON。',
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('可选场景 ID。缺省使用当前加载场景。'),
    },
  }, async ({ sessionId }) => runTool('opencli_topo_export', { sessionId }, () => executor.topoExport(sessionId)));

  server.registerTool('opencli_run_text', {
    title: 'Run OpenCLI text command',
    description: '运行现有 OpenCLI 文本命令。写操作会直接执行。',
    inputSchema: {
      input: z.string().min(1).describe('OpenCLI 文本命令。'),
    },
  }, async ({ input }) => runTool('opencli_run_text', { input }, () => executor.runText(input)));

  server.registerTool('opencli_refresh_topo', {
    title: 'Refresh OpenCLI topology',
    description: '刷新当前加载场景的拓扑数据。',
  }, async () => runStructuredCommand('opencli_refresh_topo', {}, executor, { kind: 'refreshTopo' }));

  server.registerTool('opencli_node_list', {
    title: 'List OpenCLI nodes',
    description: '列出当前加载场景的节点。',
  }, async () => runStructuredCommand('opencli_node_list', {}, executor, { kind: 'listNodes' }));

  server.registerTool('opencli_link_list', {
    title: 'List OpenCLI links',
    description: '列出当前加载场景的链路。',
  }, async () => runStructuredCommand('opencli_link_list', {}, executor, { kind: 'listLinks' }));

  server.registerTool('opencli_simulation_check', {
    title: 'Check OpenCLI simulation',
    description: '检查当前场景启动仿真前的关键状态。',
  }, async () => runStructuredCommand('opencli_simulation_check', {}, executor, { kind: 'simulationCheck' }));

  server.registerTool('opencli_create_scene', {
    title: 'Create OpenCLI scene',
    description: '新建仿真场景。写操作会直接执行。',
    inputSchema: {
      name: z.string().optional().describe('新场景名称。'),
    },
  }, async ({ name }) => runStructuredCommand('opencli_create_scene', { name }, executor, { kind: 'initScene', name }));

  server.registerTool('opencli_close_scene', {
    title: 'Close OpenCLI scene',
    description: '关闭指定仿真场景。高风险写操作，会直接执行。',
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('场景 ID。'),
      name: z.string().optional().describe('场景名称。sessionId 优先。'),
    },
  }, async ({ sessionId, name }) => runStructuredCommand('opencli_close_scene', { sessionId, name }, executor, {
    kind: 'closeScene',
    sessionId,
    name,
  }));

  server.registerTool('opencli_add_node', {
    title: 'Add OpenCLI node',
    description: '添加一个节点。写操作会直接执行。',
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      name: z.string().optional().describe('节点名称或别名。'),
      lat: z.number().optional().describe('纬度。缺省使用默认中心点。'),
      lon: z.number().optional().describe('经度。缺省使用默认中心点。'),
      alt: z.number().optional().describe('高度。缺省使用默认高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
    },
  }, async ({ nodeType, name, lat, lon, alt, role }) => runStructuredCommand('opencli_add_node', {
    nodeType,
    name,
    lat,
    lon,
    alt,
    role,
  }, executor, {
    kind: 'addNode',
    nodeType,
    name,
    lat,
    lon,
    alt,
    role,
  }));

  server.registerTool('opencli_add_nodes_grid', {
    title: 'Add OpenCLI node grid',
    description: '按网格批量生成节点，最多一次 30 个。写操作会直接执行。',
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      count: z.number().int().positive().max(30).describe('节点数量。'),
      centerLat: z.number().optional().describe('中心纬度。'),
      centerLon: z.number().optional().describe('中心经度。'),
      alt: z.number().optional().describe('高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
    },
  }, async ({ nodeType, count, centerLat, centerLon, alt, role }) => runStructuredCommand('opencli_add_nodes_grid', {
    nodeType,
    count,
    centerLat,
    centerLon,
    alt,
    role,
  }, executor, {
    kind: 'addNodesGrid',
    nodeType,
    count,
    centerLat,
    centerLon,
    alt,
    role,
  }));

  server.registerTool('opencli_add_nodes_batch', {
    title: 'Add OpenCLI nodes batch',
    description: '按名称批量添加节点。写操作会直接执行。',
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      names: z.array(z.string().min(1)).min(1).describe('节点名称列表。'),
      centerLat: z.number().optional().describe('中心纬度。'),
      centerLon: z.number().optional().describe('中心经度。'),
      alt: z.number().optional().describe('高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
    },
  }, async ({ nodeType, names, centerLat, centerLon, alt, role }) => runStructuredCommand('opencli_add_nodes_batch', {
    nodeType,
    names,
    centerLat,
    centerLon,
    alt,
    role,
  }, executor, {
    kind: 'addNodesBatch',
    nodeType,
    names,
    centerLat,
    centerLon,
    alt,
    role,
  }));

  server.registerTool('opencli_connect_nodes', {
    title: 'Connect OpenCLI nodes',
    description: '连接两个节点。写操作会直接执行。',
    inputSchema: {
      from: z.string().min(1).describe('起点节点名称、别名或 ID。'),
      to: z.string().min(1).describe('终点节点名称、别名或 ID。'),
      linkType: linkTypeSchema.optional().describe('链路类型。缺省根据节点类型自动判断。'),
    },
  }, async ({ from, to, linkType }) => runStructuredCommand('opencli_connect_nodes', { from, to, linkType }, executor, {
    kind: 'connectNodes',
    from,
    to,
    linkType,
  }));

  server.registerTool('opencli_add_links_batch', {
    title: 'Add OpenCLI links batch',
    description: '批量添加链路。写操作会直接执行。',
    inputSchema: {
      pairs: z.array(linkPairSchema).min(1).describe('链路节点对列表。'),
      linkType: linkTypeSchema.optional().describe('链路类型。缺省根据节点类型自动判断。'),
    },
  }, async ({ pairs, linkType }) => runStructuredCommand('opencli_add_links_batch', { pairs, linkType }, executor, {
    kind: 'addLinksBatch',
    pairs,
    linkType,
  }));

  server.registerTool('opencli_delete_node', {
    title: 'Delete OpenCLI node',
    description: '删除一个节点。高风险写操作，会直接执行。',
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
    },
  }, async ({ target }) => runStructuredCommand('opencli_delete_node', { target }, executor, { kind: 'deleteNode', target }));

  server.registerTool('opencli_delete_nodes_batch', {
    title: 'Delete OpenCLI nodes batch',
    description: '批量删除节点。高风险写操作，会直接执行。',
    inputSchema: {
      targets: z.array(z.string().min(1)).min(1).describe('节点名称、别名或 ID 列表。'),
    },
  }, async ({ targets }) => runStructuredCommand('opencli_delete_nodes_batch', { targets }, executor, {
    kind: 'deleteNodesBatch',
    targets,
  }));

  server.registerTool('opencli_delete_links_batch', {
    title: 'Delete OpenCLI links batch',
    description: '批量删除链路。高风险写操作，会直接执行。',
    inputSchema: {
      pairs: z.array(linkPairSchema).min(1).describe('链路节点对列表。'),
    },
  }, async ({ pairs }) => runStructuredCommand('opencli_delete_links_batch', { pairs }, executor, {
    kind: 'deleteLinksBatch',
    pairs,
  }));

  server.registerTool('opencli_move_node', {
    title: 'Move OpenCLI node',
    description: '移动节点到指定坐标。写操作会直接执行。',
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
      lat: z.number().describe('纬度。'),
      lon: z.number().describe('经度。'),
      alt: z.number().optional().describe('高度。'),
    },
  }, async ({ target, lat, lon, alt }) => runStructuredCommand('opencli_move_node', { target, lat, lon, alt }, executor, {
    kind: 'moveNode',
    target,
    lat,
    lon,
    alt,
  }));

  server.registerTool('opencli_set_node_status', {
    title: 'Set OpenCLI node status',
    description: '设置节点状态为 UP 或 DOWN。写操作会直接执行。',
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
      status: z.enum(['UP', 'DOWN']).describe('目标状态。'),
    },
  }, async ({ target, status }) => runStructuredCommand('opencli_set_node_status', { target, status }, executor, {
    kind: 'setNodeStatus',
    target,
    status,
  }));

  server.registerTool('opencli_clear_scene', {
    title: 'Clear OpenCLI scene',
    description: '清空当前场景拓扑。高风险写操作，会直接执行。',
  }, async () => runStructuredCommand('opencli_clear_scene', {}, executor, { kind: 'clearScene' }));

  server.registerTool('opencli_sample_scene', {
    title: 'Create OpenCLI sample scene',
    description: '在当前场景创建 OpenCLI 示例拓扑元素。写操作会直接执行。',
  }, async () => runStructuredCommand('opencli_sample_scene', {}, executor, { kind: 'sampleScene' }));

  server.registerTool('opencli_start_simulation', {
    title: 'Start OpenCLI simulation',
    description: '启动当前场景仿真。写操作会直接执行。',
    inputSchema: {
      duration: z.number().positive().optional().describe('仿真时长，秒或毫秒。小于等于 86400 时按秒处理。'),
    },
  }, async ({ duration }) => runStructuredCommand('opencli_start_simulation', { duration }, executor, {
    kind: 'startSession',
    duration,
  }));

  server.registerTool('opencli_pause_simulation', {
    title: 'Pause OpenCLI simulation',
    description: '暂停当前场景仿真。高风险写操作，会直接执行。',
  }, async () => runStructuredCommand('opencli_pause_simulation', {}, executor, { kind: 'pauseSession' }));

  server.registerTool('opencli_stop_simulation', {
    title: 'Stop OpenCLI simulation',
    description: '停止当前场景仿真。高风险写操作，会直接执行。',
  }, async () => runStructuredCommand('opencli_stop_simulation', {}, executor, { kind: 'stopSession' }));
}
