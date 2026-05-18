import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.ts';
import type { OpenCliMcpExecutor } from './opencliMcpExecutor.ts';
import type { OpenCliResult } from '../src/opencli/types.ts';

const TOOL_NAMES = [
  'opencli_scene_list',
  'opencli_current_scene',
  'opencli_load_scene',
  'opencli_topo_summary',
  'opencli_topo_export',
  'opencli_run_text',
  'opencli_refresh_topo',
  'opencli_node_list',
  'opencli_link_list',
  'opencli_simulation_check',
  'opencli_create_scene',
  'opencli_close_scene',
  'opencli_add_node',
  'opencli_add_nodes_grid',
  'opencli_add_nodes_batch',
  'opencli_connect_nodes',
  'opencli_add_links_batch',
  'opencli_delete_node',
  'opencli_delete_nodes_batch',
  'opencli_delete_links_batch',
  'opencli_move_node',
  'opencli_set_node_status',
  'opencli_clear_scene',
  'opencli_sample_scene',
  'opencli_start_simulation',
  'opencli_pause_simulation',
  'opencli_stop_simulation',
];

const workflowText = [
  'OpenCLI MCP 推荐流程：',
  '1. 调用 opencli_scene_list 查找场景。',
  '2. 调用 opencli_load_scene 加载要操作的场景。',
  '3. 调用 opencli_topo_summary 理解当前拓扑。',
  '4. 只读命令优先使用 opencli_node_list、opencli_link_list、opencli_simulation_check 等结构化 tools，也可通过 opencli_run_text 兼容执行。',
  '5. 写操作优先使用 opencli_add_node、opencli_connect_nodes、opencli_move_node 等结构化 tools，也可通过 opencli_run_text 兼容提交。',
  '6. 写操作会直接调用后端执行，不再生成待确认项。',
  '7. 写操作后再次调用 opencli_topo_summary 验证结果。',
  '',
  '注意：删除、清空、关闭、暂停、停止属于高风险操作，会直接执行，调用前需要明确影响范围。',
].join('\n');

function textResource(uri: string, text: string, mimeType = 'text/plain'): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}

function jsonResource(uri: string, value: unknown): ReadResourceResult {
  return textResource(uri, JSON.stringify(value, null, 2), 'application/json');
}

async function safeResult(run: () => Promise<OpenCliResult> | OpenCliResult): Promise<OpenCliResult> {
  try {
    return await run();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerOpenCliResources(server: McpServer, executor: OpenCliMcpExecutor): void {
  server.registerResource('opencli_runtime', 'opencli://runtime', {
    title: 'OpenCLI MCP Runtime',
    description: 'OpenCLI MCP 服务运行配置和已注册能力摘要。',
    mimeType: 'application/json',
  }, () => jsonResource('opencli://runtime', {
    name: config.name,
    version: config.version,
    transport: 'streamable-http',
    host: config.host,
    port: config.port,
    singleClient: config.singleClient,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    apiBase: config.apiBase,
    authApiBase: config.authApiBase,
    routerApiBase: config.routerApiBase,
    username: config.username,
    userId: config.userId,
    tools: TOOL_NAMES,
    resources: [
      'opencli://runtime',
      'opencli://current-scene',
      'opencli://topology/summary',
      'opencli://topology/export',
      'opencli://workflow',
    ],
    prompts: [
      'opencli_operator',
      'opencli_topology_planner',
      'opencli_write_safety',
    ],
  }));

  server.registerResource('opencli_current_scene', 'opencli://current-scene', {
    title: 'OpenCLI Current Scene',
    description: 'MCP Server 当前加载的场景状态摘要。',
    mimeType: 'application/json',
  }, async () => {
    const result = executor.currentScene();
    return jsonResource('opencli://current-scene', {
      ok: result.ok,
      message: result.message,
    });
  });

  server.registerResource('opencli_topology_summary', 'opencli://topology/summary', {
    title: 'OpenCLI Topology Summary',
    description: '当前加载场景的拓扑摘要。',
    mimeType: 'application/json',
  }, async () => {
    const result = await safeResult(() => executor.topoSummary());
    return jsonResource('opencli://topology/summary', {
      ok: result.ok,
      message: result.message,
      data: result.data,
    });
  });

  server.registerResource('opencli_topology_export', 'opencli://topology/export', {
    title: 'OpenCLI Topology Export',
    description: '当前加载场景的完整 topo JSON。仅在需要完整拓扑时读取。',
    mimeType: 'application/json',
  }, async () => {
    const result = await safeResult(() => executor.topoExport());
    if (!result.ok) {
      return jsonResource('opencli://topology/export', {
        ok: false,
        message: result.message,
      });
    }

    return textResource('opencli://topology/export', result.message, 'application/json');
  });

  server.registerResource('opencli_workflow', 'opencli://workflow', {
    title: 'OpenCLI MCP Workflow',
    description: 'OpenCLI MCP 推荐操作流程和安全约束。',
    mimeType: 'text/plain',
  }, () => textResource('opencli://workflow', workflowText));
}
