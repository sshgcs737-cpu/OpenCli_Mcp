import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

function textPrompt(description: string, text: string) {
  return {
    description,
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text,
        },
      },
    ],
  };
}

export function registerOpenCliPrompts(server: McpServer): void {
  server.registerPrompt('opencli_operator', {
    title: 'OpenCLI Operator',
    description: 'OpenCLI 仿真操作员流程指南。',
    argsSchema: {
      context: z.string().optional().describe('可选：当前用户目标、场景 ID 或任务上下文。'),
    },
  }, ({ context }) => textPrompt(
    'OpenCLI 仿真操作员流程指南。',
    [
      '你正在通过 OpenCLI MCP 操作仿真系统。',
      '',
      context ? `当前上下文：${context}` : '',
      '',
      '操作流程：',
      '1. 先调用 opencli_scene_list 查找场景。',
      '2. 调用 opencli_load_scene 加载目标场景。',
      '3. 调用 opencli_topo_summary 理解拓扑。',
      '4. 只读查询优先使用 opencli_topo_summary、opencli_node_list、opencli_link_list 等结构化 tools。',
      '5. 写操作优先使用 opencli_add_node、opencli_connect_nodes、opencli_move_node 等结构化 tools。',
      '6. 写操作会直接调用后端执行，不再生成待确认项。',
      '7. 写操作后必须再次调用 opencli_topo_summary 验证结果。',
      '',
      '约束：',
      '- 不要在未加载场景时修改拓扑。',
      '- 平时不要直接导出完整 topo，除非确实需要完整 JSON。',
      '- 删除、清空、关闭、暂停、停止等高风险操作会直接执行，调用前需要说明影响范围。',
    ].filter(Boolean).join('\n')
  ));

  server.registerPrompt('opencli_topology_planner', {
    title: 'OpenCLI Topology Planner',
    description: '根据目标规划 OpenCLI 拓扑修改步骤。',
    argsSchema: {
      goal: z.string().optional().describe('可选：用户想要达成的拓扑目标。'),
    },
  }, ({ goal }) => textPrompt(
    'OpenCLI 拓扑修改规划提示。',
    [
      '请基于 OpenCLI MCP tools 规划拓扑修改。',
      '',
      goal ? `目标：${goal}` : '',
      '',
      '规划要求：',
      '1. 先读取 opencli_topo_summary，确认当前节点、链路和场景状态。',
      '2. 如果需要完整拓扑，再读取 opencli_topo_export。',
      '3. 将目标拆成小步：添加节点、移动节点、连接链路、验证结果。',
      '4. 每个写操作都通过结构化写 tool 或 opencli_run_text 直接执行。',
      '5. 每次写操作完成后调用 opencli_topo_summary 验证。',
      '',
      '输出时优先给出短计划和待执行的 OpenCLI 文本命令。',
    ].filter(Boolean).join('\n')
  ));

  server.registerPrompt('opencli_write_safety', {
    title: 'OpenCLI Write Safety',
    description: 'OpenCLI 写操作安全检查提示。',
    argsSchema: {
      command: z.string().optional().describe('可选：准备执行的 OpenCLI 写命令。'),
    },
  }, ({ command }) => textPrompt(
    'OpenCLI 写操作安全检查提示。',
    [
      '请在执行 OpenCLI 写操作前进行安全检查。',
      '',
      command ? `待执行命令：${command}` : '',
      '',
      '检查项：',
      '1. 是否已经调用 opencli_load_scene 加载正确场景？',
      '2. 当前场景 ID 和名称是否符合用户意图？',
      '3. 命令是否会删除、清空、关闭、暂停或停止仿真？',
      '4. 如果是高风险操作，是否已向用户说明影响范围？',
      '5. 写 tool 执行后是否需要调用 opencli_topo_summary 验证？',
      '6. 是否已经准备好处理后端写操作失败的错误信息？',
      '',
      '除非用户明确确认，否则不要执行高风险写操作。',
    ].filter(Boolean).join('\n')
  ));
}
