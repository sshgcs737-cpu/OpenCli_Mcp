import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.ts';
import type { OpenCliMcpExecutor } from './opencliMcpExecutor.ts';
import type { OpenCliResult } from '../src/opencli/types.ts';

const TOOL_CAPABILITY_GROUPS = {
  readOnlyTools: [
    'opencli_scene_list',
    'opencli_current_scene',
    'opencli_topo_summary',
    'opencli_topo_export',
    'opencli_node_list',
    'opencli_link_list',
    'opencli_simulation_check',
    'opencli_node_config_schema',
    'opencli_vm_templates',
    'opencli_get_node_protocol_config',
  ],
  localStateTools: [
    'opencli_load_scene',
    'opencli_refresh_topo',
  ],
  creationOptionTools: [
    'opencli_read_node_creation_options',
    'opencli_read_subnet_creation_options',
    'opencli_read_link_creation_options',
    'opencli_read_composite_creation_options',
  ],
  writeTools: [
    'opencli_create_scene',
    'opencli_close_scene',
    'opencli_add_node',
    'opencli_add_nodes_grid',
    'opencli_add_nodes_batch',
    'opencli_connect_nodes',
    'opencli_add_links_batch',
    'opencli_update_node_config',
    'opencli_move_node',
    'opencli_set_node_status',
    'opencli_sample_scene',
    'opencli_start_simulation',
    'opencli_pause_simulation',
    'opencli_stop_simulation',
    'opencli_update_vm_config',
    'opencli_set_node_protocol_config',
    'opencli_generate_tdma_schedule',
  ],
  destructiveTools: [
    'opencli_run_text',
    'opencli_delete_node',
    'opencli_delete_nodes_batch',
    'opencli_delete_links_batch',
    'opencli_clear_scene',
  ],
} as const;

const REGISTERED_TOOL_NAMES = Object.values(TOOL_CAPABILITY_GROUPS).flat();

const workflowText = [
  'OpenCLI MCP 推荐流程：',
  '1. 调用 opencli_scene_list 查找场景。',
  '2. 调用 opencli_load_scene 加载要操作的场景。',
  '3. 调用 opencli_topo_summary 理解当前拓扑。',
  '4. 如需确认 MCP 能力分组，读取 opencli://capabilities；tools 负责执行，resources 负责上下文，prompts 负责流程约束。',
  '5. 只读命令优先使用 opencli_node_list、opencli_link_list、opencli_simulation_check 等结构化 tools，也可通过 opencli_run_text 兼容执行。',
  '6. 如果用户同一句话要求新建场景并添加节点/子网/链路，opencli_create_scene 后先调用配置项读取工具：节点用 opencli_read_node_creation_options，子网用 opencli_read_subnet_creation_options，链路用 opencli_read_link_creation_options，复合拓扑用 opencli_read_composite_creation_options。',
  '7. 添加任何前端节点前，必须先用配置项读取工具返回 structuredContent.configForm；不要依赖 opencli_add_node/opencli_connect_nodes 来展示完整表单。写工具缺少 userSelections 时只会短阻断并提示应调用哪个读取工具。',
  '8. 复合创建请求优先用 opencli_read_composite_creation_options 返回一张结构化配置表；后续写入必须保留同一个 configRequestId 和每个实体的 clientId。',
  '9. 用户填写或选择后，再调用写工具；批量节点只用于同类型节点，混合复合拓扑按实体逐个写入，批量链路的每个 pair 必须保留对应 clientId。创建动作必须把用户选择和读取工具返回的 configRequestId 放进 userSelections，默认值只可展示，不能由 AI 或 MCP 自动选择。',
  '10. 写工具只接受配置项读取工具登记过的 configRequestId；写工具短阻断返回的 ID 不能授权写入。',
  '11. 子网必须按 opencli_read_subnet_creation_options 的阶段执行：先展示完整链路层列表、物理层联动表，再用 subnet-parameters 展示对应 External/MAC/PHY/Platform 字段；不能只回复“使用默认配置继续”。',
  '12. 重复创建请求、继续默认配置、configConfirmed/useDefaultConfig 都不能视为用户确认；必须等用户下一次明确回复后再带 configRequestId 写入。',
  '13. 已有节点字段配置先调用 opencli_node_config_schema；写操作优先使用 opencli_update_node_config、opencli_update_vm_config、opencli_set_node_protocol_config、opencli_generate_tdma_schedule 等结构化 tools。',
  '14. 通过配置确认门后，写操作才会调用后端执行。',
  '15. 写操作后再次调用 opencli_topo_summary 验证结果。',
  '',
  '注意：只能调用 MCP 客户端当前实际暴露的工具名；不要根据 registeredToolNames 或服务器名自行拼接 mcp_<server>_<tool> 前缀。',
  '删除、清空以及可能执行删除/清空的 opencli_run_text 属于高风险操作；关闭、暂停、停止、状态修改按普通写操作标注，但仍应按用户明确意图执行并验证结果。',
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
    registeredToolNames: REGISTERED_TOOL_NAMES,
    capabilityGroups: TOOL_CAPABILITY_GROUPS,
    toolNamePolicy: [
      'registeredToolNames 是服务端注册名，不一定等于当前 MCP 客户端暴露给 agent 的可调用名称。',
      '客户端可能给工具自动加前缀，也可能只暴露其中一部分；agent 只能调用当前工具列表中真实存在的名称。',
      '不要发明 runtime_status、agent_open、tool_catalog 或 mcp_<server>_<tool> 这类名称；如果目标工具未暴露，应报告客户端工具不可用。',
    ],
    resources: [
      'opencli://runtime',
      'opencli://capabilities',
      'opencli://current-scene',
      'opencli://topology/summary',
      'opencli://topology/export',
      'opencli://node-config/schema',
      'opencli://workflow',
    ],
    prompts: [
      'opencli_operator',
      'opencli_topology_planner',
      'opencli_write_safety',
    ],
  }));

  server.registerResource('opencli_capabilities', 'opencli://capabilities', {
    title: 'OpenCLI MCP Capabilities',
    description: '按 MCP 语义分组的 OpenCLI 能力：只读、本地状态、配置读取、写入和高风险写入。',
    mimeType: 'application/json',
  }, () => jsonResource('opencli://capabilities', {
    ok: true,
    message: 'OpenCLI MCP capabilities grouped by MCP semantics.',
    data: {
      ...TOOL_CAPABILITY_GROUPS,
      notes: [
        '这些名称是 MCP 服务端注册工具名；实际可调用名称以当前 MCP 客户端 tools/list 或已暴露工具列表为准。',
        '不要自行构造 mcp_<server>_<tool> 前缀，也不要调用未出现在客户端可用工具列表里的名称。',
        'creationOptionTools 是低风险配置读取工具：只登记临时 pending config session，不写后端；完整表单位于 structuredContent.configForm，文本只保留短摘要。',
        'writeTools 会写入后端；创建类写工具必须带配置读取工具返回的 configRequestId 和 userSelections。',
        'destructiveTools 仅保留删除/清空类操作，以及可能执行删除/清空的 opencli_run_text；关闭、暂停、停止、状态修改按普通写操作归类。',
      ],
    },
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

  server.registerResource('opencli_node_config_schema', 'opencli://node-config/schema', {
    title: 'OpenCLI Node Config Schema',
    description: '前端节点配置字段、当前可用配置工具，以及当前节点可选值的结构化说明。',
    mimeType: 'application/json',
  }, async () => {
    const result = await safeResult(() => executor.nodeConfigSchema());
    return jsonResource('opencli://node-config/schema', {
      ok: result.ok,
      message: result.message,
      data: result.data,
    });
  });

  server.registerResource('opencli_workflow', 'opencli://workflow', {
    title: 'OpenCLI MCP Workflow',
    description: 'OpenCLI MCP 推荐操作流程和安全约束。',
    mimeType: 'text/plain',
  }, () => textResource('opencli://workflow', workflowText));
}
