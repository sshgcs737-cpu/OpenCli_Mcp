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
      '5. 如果需要确认能力分组，先读取 resource opencli://capabilities；tools 负责执行，resources 负责上下文，prompts 负责流程约束。',
      '6. 只调用当前 MCP 客户端实际暴露的工具名；不要自行构造 runtime_status、agent_open、tool_catalog 或 mcp_<server>_<tool> 这类名称。若目标工具未暴露，报告客户端工具不可用。',
      '7. 如果用户同一句话要求新建场景并添加节点/子网/链路，opencli_create_scene 后必须先调用配置项读取工具：节点用 opencli_read_node_creation_options，子网用 opencli_read_subnet_creation_options，链路用 opencli_read_link_creation_options，复合拓扑用 opencli_read_composite_creation_options。',
      '8. 添加任何前端节点前，不要让 add/connect 写工具承担展示表单；读取工具的完整表单在 structuredContent.configForm，写工具缺少 userSelections 时只会短阻断。',
      '9. 复合创建请求优先用 opencli_read_composite_creation_options 返回一张结构化配置表；后续写入必须保留同一个 configRequestId 和每个实体的 clientId。',
      '10. 用户填写或选择后，按配置项读取工具返回的 submitTool 调用写工具；批量节点只用于同类型节点，批量链路的每个 pair 必须保留对应 clientId。',
      '11. 创建动作必须把用户选择和读取工具返回的 configRequestId 放进 userSelections，默认值只可展示，不能由 AI 或 MCP 自动选择。',
      '12. 写工具只接受配置项读取工具登记过的 configRequestId；写工具短阻断返回的 ID 不能授权写入。',
      '13. 子网必须按 opencli_read_subnet_creation_options 的 nextConfigStage 展示完整链路层列表、物理层联动表，再展示对应 External/MAC/PHY/Platform 字段；不能只回复“使用默认配置继续”。',
      '14. 重复用户的创建请求、继续使用默认配置、configConfirmed/useDefaultConfig 都不等于用户确认；必须等用户下一次明确回复后再带 configRequestId 和 userSelections 写入。',
      '15. 已有节点配置先调用 opencli_node_config_schema；写操作优先使用 opencli_update_node_config、opencli_update_vm_config、opencli_set_node_protocol_config、opencli_generate_tdma_schedule 等结构化 tools。',
      '16. 通过配置确认门后，写操作才会调用后端执行。',
      '17. 写操作后必须再次调用 opencli_topo_summary 验证结果。',
      '',
      '约束：',
      '- 不要在未加载场景时修改拓扑。',
      '- 平时不要直接导出完整 topo，除非确实需要完整 JSON。',
      '- 删除、清空以及可能执行删除/清空的 opencli_run_text 属于高风险操作；关闭、暂停、停止、状态修改按普通写操作处理，但仍要验证结果。',
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
      '3. 如果是新建场景并添加拓扑的复合请求，先 create_scene，然后调用 opencli_read_composite_creation_options 读取 structuredContent.configForm。',
      '4. 如果涉及前端侧边栏添加动作，先调用配置项读取工具获取 structuredContent.configForm：节点 opencli_read_node_creation_options，子网 opencli_read_subnet_creation_options，链路 opencli_read_link_creation_options。',
      '5. 不要把重复创建请求当成默认配置确认；必须等用户看过选项并明确回复后，才能提交带 configRequestId 和结构化 userSelections 的写工具。',
      '6. 写工具只接受配置项读取工具返回并登记过的 configRequestId。',
      '7. 将目标拆成小步：添加节点、移动节点、连接链路、验证结果。',
      '8. 创建类写操作必须先通过 userSelections 校验；已确认配置的写操作再执行。',
      '9. 每次写操作完成后调用 opencli_topo_summary 验证。',
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
      '3. 命令是否会删除、清空，或通过 opencli_run_text 执行可能删除/清空的文本命令？',
      '4. 如果是删除/清空类高风险操作，是否已向用户说明影响范围？',
      '5. 写 tool 执行后是否需要调用 opencli_topo_summary 验证？',
      '6. 是否已经准备好处理后端写操作失败的错误信息？',
      '',
      '除非用户明确确认，否则不要执行删除/清空类高风险写操作。',
    ].filter(Boolean).join('\n')
  ));
}
