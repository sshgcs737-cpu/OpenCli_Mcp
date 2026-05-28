import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { OpenCliCommand, OpenCliResult } from '../src/opencli/types.ts';
import type { OpenCliMcpExecutor } from './opencliMcpExecutor.ts';
import { mcpError, mcpLog } from './logger.ts';

const READ_ONLY_TOOL: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const LOCAL_STATE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const CONFIG_OPTION_READ_TOOL: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const WRITE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

const DESTRUCTIVE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const nodeTypeSchema = z.enum([
  'DRONE',
  'VAN',
  'EMANE',
  'BASESTATION',
  'SATELLITE',
  'ROUTER',
  'DEFAULT',
  'VMNODE',
  'RJ45',
  'SWITCH',
  'INODE',
  'INTERFERENCE',
  'DOCKER',
  'TMV',
  'BUSINESS_Transmitter',
  'ATTACK_MACHINE',
  'SECURITY_MACHINE',
  'SDN_CONTROLLER',
  'Ovs_SWITCH',
  'P4_SWITCH',
  'SR_SWITCH',
  'HTTP',
  'FTP',
  'DNS',
  'SMTP',
  'VoIP-SIP',
  'TLS',
  'RTSP-RTP',
  'MQTT',
  'CoAP',
  'DDS',
  'SSH',
  'PKI',
]);
const roleSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const linkTypeSchema = z.enum(['WIRED', 'WIRELESS']);
const emaneModelSchema = z.enum([
  'bypass',
  'commeffect',
  'rfpipe',
  'tdma',
  'ieee80211abg',
  'ieee802.3',
  'ieee802.15.4',
  'ieee802.1Qbv',
  'ieee802.1CB',
  'ieee802.1Qbu',
  'ieee802.1AS',
  'LTE',
]).optional();
const phyTypeSchema = z.union([
  z.enum(['fhss', 'dsss', 'ofdm', 'pdcch', 'pbch', 'cdma', 'zigbee', 'prach', 'wired']),
  z.literal(''),
]).optional();
const emaneConfigSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
).optional();
const configServicesSchema = z.array(z.string().min(1)).optional();
const userSelectionsSchema = z.record(z.string(), z.unknown()).optional();
const USER_SELECTIONS_DESCRIPTION = '用户在 AI 界面中选择或填写后的配置字段。必须来自上一次 MCP 返回的配置清单，并包含对应的 configRequestId。没有该对象时 MCP 只返回配置项，不创建。';
const LINK_USER_SELECTIONS_DESCRIPTION = '用户在 AI 界面中选择或填写后的链路配置字段，至少包含 linkOptions 和上一次 MCP 返回的 configRequestId。没有该对象时 MCP 只返回配置项，不创建链路。';
const protocolToggleSchema = z.object({
  enabled: z.boolean().optional().describe('Whether this protocol is enabled. Disabled protocols can be omitted.'),
  interfaces: z.array(z.string().min(1)).optional().describe('Interface names such as eth0/eth1. Required for interface-based protocols when enabled.'),
  areaId: z.union([z.string(), z.number()]).optional().describe('OSPF area ID.'),
  process: z.union([z.string(), z.number()]).optional().describe('IS-IS process name/id.'),
  netAddr: z.string().optional().describe('IS-IS NET address.'),
  localAs: z.union([z.string(), z.number()]).optional().describe('BGP local AS.'),
  neighbors: z.array(z.object({
    neighborIp: z.string().optional(),
    neighborAs: z.union([z.string(), z.number()]).optional(),
  })).optional().describe('BGP neighbor rows.'),
}).optional();
const staticRouteSchema = z.object({
  destination: z.string().optional().describe('Destination CIDR.'),
  nexthop: z.string().optional().describe('Next-hop IP.'),
  interface: z.string().optional().describe('Outgoing interface.'),
});
const tdmaNodeSlotMapSchema = z.record(
  z.string(),
  z.number().int().min(0)
).optional();
const linkOptionsSchema = z.object({
  jitter: z.number().optional(),
  key: z.number().optional(),
  mburst: z.number().optional(),
  mer: z.number().optional(),
  loss: z.number().optional(),
  bandwidth: z.number().optional(),
  burst: z.number().optional(),
  delay: z.number().optional(),
  dup: z.number().optional(),
  unidirectional: z.boolean().optional(),
  buffer: z.number().optional(),
  mtu: z.number().optional(),
}).optional();
const linkPairSchema = z.object({
  clientId: z.string().optional().describe('复合配置表或批量链路表单中的链路 clientId。'),
  from: z.string().min(1).describe('起点节点名称、别名或 ID。'),
  to: z.string().min(1).describe('终点节点名称、别名或 ID。'),
});
const creationDraftNodeSchema = z.object({
  clientId: z.string().optional(),
  actionId: z.string().optional(),
  nodeType: nodeTypeSchema.optional(),
  name: z.string().optional(),
  alias: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  alt: z.number().optional(),
  role: roleSchema.optional(),
  count: z.number().int().positive().optional(),
}).catchall(z.unknown());
const creationDraftLinkSchema = z.object({
  clientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  fromClientId: z.string().optional(),
  toClientId: z.string().optional(),
  linkType: linkTypeSchema.optional(),
}).catchall(z.unknown());
const creationCompositeRequiredSchema = z.object({
  title: z.string().optional(),
  nodes: z.array(creationDraftNodeSchema).optional(),
  links: z.array(creationDraftLinkSchema).optional(),
  configStage: z.enum(['subnet-model', 'subnet-parameters', 'review']).optional(),
  partialSelections: z.record(z.string(), z.unknown()).optional(),
});

function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'undefined') return undefined;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function userInputPayload(result: OpenCliResult): Record<string, unknown> | null {
  const data = asRecord(result.data);
  if (!data || data.requiresUserInput !== true) return null;
  return data;
}

function isCreationOptionReadResult(userInput: Record<string, unknown> | null): boolean {
  return Boolean(userInput?.optionReadResult === true || userInput?.formToolResult === true);
}

function compactConfigFormSummary(userInput: Record<string, unknown>, result: OpenCliResult): string {
  const configForm = asRecord(userInput.configForm);
  const formDefinitions = asRecord(configForm?.formDefinitions);
  const entities = Array.isArray(configForm?.entities) ? configForm.entities.length : 0;
  const links = Array.isArray(configForm?.links) ? configForm.links.length : 0;
  const parts = [
    `【配置项读取结果】${result.message ? ` ${result.message}` : ''}`,
    userInput.configRequestId ? `配置请求 ID：${String(userInput.configRequestId)}` : '',
    configForm?.stage ? `当前阶段：${String(configForm.stage)}` : '',
    userInput.nextConfigStage ? `下一阶段：${String(userInput.nextConfigStage)}` : '',
    userInput.submitTool ? `确认后写入工具：${String(userInput.submitTool)}` : '',
    entities || links ? `待配置对象：${entities} 个节点/实体，${links} 条链路` : '',
    formDefinitions ? `表单定义：${Object.keys(formDefinitions).join(', ')}` : '',
    '完整字段、选项、默认值和联动关系在 structuredContent.configForm 中；请展示这些可选项，等待用户选择后再调用写工具。',
  ].filter(Boolean);
  return parts.join('\n');
}

function toolText(toolName: string, result: OpenCliResult): string {
  const userInput = userInputPayload(result);
  if (!userInput) return result.message;

  if (userInput.requiresFormTool === true) {
    const formTool = String(userInput.formTool || '');
    const formToolArgs = asRecord(userInput.formToolArgs);
    const formArgsText = formToolArgs && Object.keys(formToolArgs).length > 0
      ? `\n建议参数：${JSON.stringify(formToolArgs)}`
      : '';
    const missingFields = Array.isArray(userInput.missingFields)
      ? `\n缺少字段：${userInput.missingFields.join(', ')}`
      : '';
    return [
      '【MCP 已停止写入：需要先调用配置项读取工具】',
      result.message,
      missingFields,
      formTool ? `下一步工具：${formTool}${formArgsText}` : '',
      '说明：写工具不再返回完整配置表单；完整字段、选项和联动关系只由 opencli_read_*_creation_options 读取工具返回。',
    ].filter(Boolean).join('\n');
  }

  if (isCreationOptionReadResult(userInput)) {
    return compactConfigFormSummary(userInput, result);
  }

  const configRequestId = String(userInput.configRequestId || '');
  const submitTool = String(userInput.submitTool || toolName);
  const missingFields = Array.isArray(userInput.missingFields)
    ? `\n缺少字段：${userInput.missingFields.join(', ')}`
    : '';

  return [
    '【MCP 已停止写入：需要用户配置】',
    result.message,
    missingFields,
    configRequestId ? `配置请求 ID：${configRequestId}` : '',
    `下一步：先调用配置项读取工具获取 structuredContent.configForm；用户选择后再调用 ${submitTool}，并把 configRequestId 和结构化选择放入 userSelections。`,
  ].filter(Boolean).join('\n');
}

function structuredToolResult(toolName: string, result: OpenCliResult): Record<string, unknown> {
  const structured: Record<string, unknown> = {
    ok: result.ok,
    tool: toolName,
    message: result.message,
  };
  const data = toJsonSafe(result.data);
  const userInput = asRecord(data);

  if (userInput?.requiresUserInput === true && isCreationOptionReadResult(userInput)) {
    structured.requiresUserInput = true;
    structured.mustDisplayToUser = true;
    structured.displayPolicy = 'structured_content';
    structured.displayMarkdown = compactConfigFormSummary(userInput, result);
    structured.configForm = userInput.configForm;
    structured.configRequestId = userInput.configRequestId;
    structured.configRequestKey = userInput.configRequestKey;
    structured.nextConfigStage = userInput.nextConfigStage;
    structured.submitTool = userInput.submitTool;
    structured.selectedAction = userInput.selectedAction;
    structured.optionReadResult = true;
    structured.interactionMode = userInput.interactionMode || 'display_options_then_wait_for_user';
  } else if (userInput?.requiresUserInput === true) {
    structured.requiresUserInput = true;
    structured.mustDisplayToUser = true;
    structured.displayPolicy = 'short_blocking_message';
    structured.displayMarkdown = toolText(toolName, result);
    structured.configForm = userInput.configForm;
    structured.configRequestId = userInput.configRequestId;
    structured.configRequestKey = userInput.configRequestKey;
    structured.nextConfigStage = userInput.nextConfigStage;
    structured.submitTool = userInput.submitTool;
    structured.selectedAction = userInput.selectedAction;
    structured.missingFields = userInput.missingFields;
    structured.requiresFormTool = userInput.requiresFormTool;
    structured.formTool = userInput.formTool;
    structured.formToolArgs = userInput.formToolArgs;
    structured.interactionMode = userInput.interactionMode;
  } else if (userInput?.formToolResult === true || typeof userInput?.displayMarkdown === 'string') {
    structured.mustDisplayToUser = Boolean(userInput.mustDisplayToUser ?? true);
    structured.displayPolicy = userInput.displayPolicy || 'structured_content';
    structured.displayMarkdown = userInput.displayMarkdown || result.message;
    structured.configForm = userInput.configForm;
    structured.configRequestId = userInput.configRequestId;
    structured.configRequestKey = userInput.configRequestKey;
    structured.nextConfigStage = userInput.nextConfigStage;
    structured.submitTool = userInput.submitTool;
    structured.selectedAction = userInput.selectedAction;
  } else if (typeof data !== 'undefined') {
    structured.data = data;
  }

  return structured;
}

function toToolResult(toolName: string, result: OpenCliResult): CallToolResult {
  const text = toolText(toolName, result);
  const userInput = userInputPayload(result);
  const blockingUserInput = Boolean(userInput && !isCreationOptionReadResult(userInput));
  return {
    isError: !result.ok || blockingUserInput,
    structuredContent: structuredToolResult(toolName, result),
    content: [
      {
        type: 'text',
        text,
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
  mcpLog(`[OpenCLI MCP] tool:start ${toolName}${argsText ? ` args=${argsText}` : ''}`);

  try {
    const result = await action();
    const duration = Date.now() - startedAt;
    mcpLog(`[OpenCLI MCP] tool:end ${toolName} ok=${result.ok} ${duration}ms`);
    return toToolResult(toolName, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startedAt;
    mcpError(`[OpenCLI MCP] tool:error ${toolName} ${duration}ms ${message}`);
    return toToolResult(toolName, { ok: false, message });
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
  // MCP read-only tools: query backend or current executor state without changing topology.
  server.registerTool('opencli_scene_list', {
    title: 'List OpenCLI scenes',
    description: '查询私有/公共/全部仿真场景列表。',
    annotations: READ_ONLY_TOOL,
    inputSchema: {
      scope: z.enum(['private', 'public', 'all']).optional().default('all').describe('查询范围。'),
      name: z.string().optional().describe('按场景名过滤。'),
    },
  }, async ({ scope, name }) => runTool('opencli_scene_list', { scope, name }, () => executor.listScenes(scope, name)));

  server.registerTool('opencli_current_scene', {
    title: 'Current OpenCLI scene',
    description: '返回 MCP server 当前加载的场景状态。',
    annotations: READ_ONLY_TOOL,
  }, async () => runTool('opencli_current_scene', {}, () => executor.currentScene()));

  server.registerTool('opencli_load_scene', {
    title: 'Load OpenCLI scene',
    description: '加载指定场景到 MCP server 内存状态，不改变后端仿真运行状态。',
    annotations: LOCAL_STATE_TOOL,
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('场景 ID。'),
      name: z.string().optional().describe('场景名称。sessionId 优先。'),
    },
  }, async ({ sessionId, name }) => runTool('opencli_load_scene', { sessionId, name }, () => executor.loadScene({ sessionId, name })));

  server.registerTool('opencli_topo_summary', {
    title: 'Summarize OpenCLI topology',
    description: '返回当前或指定场景的拓扑摘要。',
    annotations: READ_ONLY_TOOL,
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('可选场景 ID。缺省使用当前加载场景。'),
    },
  }, async ({ sessionId }) => runTool('opencli_topo_summary', { sessionId }, () => executor.topoSummary(sessionId)));

  server.registerTool('opencli_topo_export', {
    title: 'Export OpenCLI topology',
    description: '返回当前或指定场景的完整 topo JSON。',
    annotations: READ_ONLY_TOOL,
    inputSchema: {
      sessionId: z.number().int().positive().optional().describe('可选场景 ID。缺省使用当前加载场景。'),
    },
  }, async ({ sessionId }) => runTool('opencli_topo_export', { sessionId }, () => executor.topoExport(sessionId)));

  server.registerTool('opencli_run_text', {
    title: 'Run OpenCLI text command',
    description: '运行现有 OpenCLI 文本命令。因为文本命令可能包含删除/清空，仍按高风险入口标注。',
    annotations: DESTRUCTIVE_TOOL,
    inputSchema: {
      input: z.string().min(1).describe('OpenCLI 文本命令。'),
    },
  }, async ({ input }) => runTool('opencli_run_text', { input }, () => executor.runText(input)));

  server.registerTool('opencli_refresh_topo', {
    title: 'Refresh OpenCLI topology',
    description: '刷新当前加载场景的拓扑数据。',
    annotations: LOCAL_STATE_TOOL,
  }, async () => runStructuredCommand('opencli_refresh_topo', {}, executor, { kind: 'refreshTopo' }));

  server.registerTool('opencli_node_list', {
    title: 'List OpenCLI nodes',
    description: '列出当前加载场景的节点。',
    annotations: READ_ONLY_TOOL,
  }, async () => runStructuredCommand('opencli_node_list', {}, executor, { kind: 'listNodes' }));

  server.registerTool('opencli_link_list', {
    title: 'List OpenCLI links',
    description: '列出当前加载场景的链路。',
    annotations: READ_ONLY_TOOL,
  }, async () => runStructuredCommand('opencli_link_list', {}, executor, { kind: 'listLinks' }));

  server.registerTool('opencli_simulation_check', {
    title: 'Check OpenCLI simulation',
    description: '检查当前场景启动仿真前的关键状态。',
    annotations: READ_ONLY_TOOL,
  }, async () => runStructuredCommand('opencli_simulation_check', {}, executor, { kind: 'simulationCheck' }));

  server.registerTool('opencli_node_config_schema', {
    title: 'Describe frontend node config fields',
    description: '返回前端节点信息/创建/VM/协议/TDMA 配置里用户可输入或选择的字段，以及 MCP 对应工具。',
    annotations: READ_ONLY_TOOL,
    inputSchema: {
      target: z.string().min(1).optional().describe('可选：节点名称、别名或 ID。提供后会同时返回该节点当前值和可选网卡。'),
      nodeType: nodeTypeSchema.optional().describe('可选：按节点类型理解字段适用范围。'),
    },
  }, async ({ target, nodeType }) => runTool('opencli_node_config_schema', { target, nodeType }, () => executor.nodeConfigSchema({ target, nodeType })));

  // Low-risk config option reads: allocate a transient configRequestId but never write backend topology.
  server.registerTool('opencli_read_node_creation_options', {
    title: 'Read node creation options',
    description: '读取前端为某类节点创建动作提供给用户的可选配置项。用于“用户想创建节点”后的第一步：返回 structuredContent.configForm/configRequestId，不写后端。',
    annotations: CONFIG_OPTION_READ_TOOL,
    inputSchema: {
      nodeType: nodeTypeSchema.describe('要创建的前端节点类型。子网建议用 opencli_read_subnet_creation_options。'),
      actionId: z.string().optional().describe('可选精确 actionId，例如 device.drone、application.http。'),
      item: z.string().optional().describe('可选前端菜单项中文名。'),
      name: z.string().optional().describe('计划创建的单个节点名；仅用于表单里的 plannedEntities/clientId。'),
      names: z.array(z.string().min(1)).optional().describe('计划批量创建的节点名列表；用于一次读取覆盖多个节点。'),
      count: z.number().int().positive().max(30).optional().describe('计划网格/计数创建的节点数量。'),
      clientId: z.string().optional().describe('复合或单实体 clientId。'),
    },
  }, async (args) => runTool('opencli_read_node_creation_options', args, () => executor.nodeCreationForm(args)));

  server.registerTool('opencli_read_subnet_creation_options', {
    title: 'Read subnet creation options',
    description: '读取前端子网创建配置项。Stage 1 返回完整链路层/物理层/联动表；Stage 2 根据用户选择返回对应 External/MAC/PHY/Platform 参数，不写后端。',
    annotations: CONFIG_OPTION_READ_TOOL,
    inputSchema: {
      configStage: z.enum(['subnet-model', 'subnet-parameters', 'review']).optional().describe('子网配置阶段。首次使用 subnet-model；选择 emaneModel/phyType 后使用 subnet-parameters。'),
      partialSelections: z.record(z.string(), z.unknown()).optional().describe('上一阶段用户已选字段，例如 configRequestId、emaneModel、phyType、subnets/entities。'),
    },
  }, async ({ configStage, partialSelections }) => runTool('opencli_read_subnet_creation_options', { configStage, partialSelections }, () => executor.subnetCreationForm({ configStage, partialSelections })));

  server.registerTool('opencli_read_link_creation_options', {
    title: 'Read link creation options',
    description: '读取前端链路创建配置项。添加链路前先调用它获取端点、接口、IP/MAC 和链路参数字段，不写后端。',
    annotations: CONFIG_OPTION_READ_TOOL,
    inputSchema: {
      from: z.string().optional().describe('计划源节点名称、别名或 ID。'),
      to: z.string().optional().describe('计划目标节点名称、别名或 ID。'),
      clientId: z.string().optional().describe('计划链路 clientId。'),
      pairs: z.array(z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        clientId: z.string().optional(),
      })).optional().describe('批量链路草案。'),
      linkType: linkTypeSchema.optional().describe('计划链路类型。'),
    },
  }, async ({ from, to, clientId, pairs, linkType }) => runTool('opencli_read_link_creation_options', { from, to, clientId, pairs, linkType }, () => executor.linkCreationForm({ from, to, clientId, pairs, linkType })));

  server.registerTool('opencli_read_composite_creation_options', {
    title: 'Read composite topology creation options',
    description: '读取复合拓扑创建配置项，用于“两个无人机 + 一个子网 + 两条链路”这类请求；同一张表共享 configRequestId 和每个实体的 clientId，不写后端。',
    annotations: CONFIG_OPTION_READ_TOOL,
    inputSchema: {
      composite: creationCompositeRequiredSchema.describe('复合创建草案：同一张表里描述多个待创建节点和链路。'),
    },
  }, async ({ composite }) => runTool('opencli_read_composite_creation_options', { composite }, () => executor.compositeCreationForm(composite)));

  // MCP node-configuration tools: update existing node dialogs after explicit user choices.
  server.registerTool('opencli_update_node_config', {
    title: 'Update OpenCLI node config',
    description: '更新前端节点信息面板里的通用配置字段：别名、故障状态、阵营、服务器、服务、位置、EMANE 参数等。',
    annotations: WRITE_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
      alias: z.string().max(64).optional().describe('节点显示名称/别名，不能为空且不能与其他节点重复。'),
      status: z.enum(['UP', 'DOWN']).optional().describe('节点状态；前端故障开关打开时为 DOWN，关闭时为 UP。'),
      role: roleSchema.optional().describe('阵营/角色：1 白方/公共，2 红方，3 蓝方。'),
      server: z.string().optional().describe('后端服务器名称；传空字符串可清空。'),
      configServices: configServicesSchema.describe('节点配置服务列表，例如 zebra、OSPFv2、olsrd。传空数组可清空。'),
      lat: z.number().optional().describe('纬度。'),
      lon: z.number().optional().describe('经度。'),
      alt: z.number().optional().describe('高度。'),
      phyType: phyTypeSchema.describe('EMANE 物理层类型；必须按 MCP 返回的链路层联动表选择，wired/空字符串表示前端有线模型不需要无线物理层。'),
      emaneConfig: emaneConfigSchema.describe('EMANE 参数覆盖，key 为前端参数名，例如 frequency、bandwidth、txpower。'),
    },
  }, async (args) => runTool('opencli_update_node_config', args, () => executor.updateNodeConfig(args)));

  server.registerTool('opencli_vm_templates', {
    title: 'List VM templates',
    description: '读取前端虚拟机模板下拉框使用的模板列表。',
    annotations: READ_ONLY_TOOL,
  }, async () => runTool('opencli_vm_templates', {}, () => executor.vmTemplates()));

  server.registerTool('opencli_update_vm_config', {
    title: 'Update VM node config',
    description: '更新 VM 节点编辑弹窗里的模板、CPU、内存、当前内存配置。',
    annotations: WRITE_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('VM 节点名称、别名或 ID。'),
      templateId: z.number().int().positive().optional().describe('VM 模板 ID。'),
      cpu: z.number().int().min(1).max(16).optional().describe('CPU 核数。'),
      memoryMb: z.number().int().min(512).max(32768).optional().describe('最大内存，单位 MB；后端存为 KB 字符串。'),
      currentMemoryMb: z.number().int().min(512).max(32768).optional().describe('当前内存，单位 MB；不能大于 memoryMb。'),
      memory: z.string().optional().describe('兼容字段：最大内存 KB 字符串。优先使用 memoryMb。'),
      currentMemory: z.string().optional().describe('兼容字段：当前内存 KB 字符串。优先使用 currentMemoryMb。'),
    },
  }, async (args) => runTool('opencli_update_vm_config', args, () => executor.updateVMConfig(args)));

  server.registerTool('opencli_get_node_protocol_config', {
    title: 'Get node protocol config',
    description: '读取节点协议配置入口，包含可选网卡、当前协议配置和前端字段说明。',
    annotations: READ_ONLY_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
    },
  }, async ({ target }) => runTool('opencli_get_node_protocol_config', { target }, () => executor.nodeProtocolConfig(target)));

  server.registerTool('opencli_set_node_protocol_config', {
    title: 'Set node protocol config',
    description: '保存前端协议配置弹窗字段：OSPF/RIP/BGP/IS-IS/PIM/Snapshot/Backpressure、静态路由和收敛参数。',
    annotations: WRITE_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。动态协议仅适用于 DOCKER 且 image=nest:v3 的节点。'),
      ospf2: protocolToggleSchema.describe('OSPFv2: enabled/interfaces/areaId。'),
      ospf3: protocolToggleSchema.describe('OSPFv3: enabled/interfaces/areaId。'),
      rip: protocolToggleSchema.describe('RIP: enabled/interfaces。'),
      bgp: protocolToggleSchema.describe('BGP: enabled/localAs/neighbors。'),
      isis: protocolToggleSchema.describe('IS-IS: enabled/interfaces/process/netAddr。'),
      pim: protocolToggleSchema.describe('PIM: enabled/interfaces。'),
      snapshot: protocolToggleSchema.describe('Snapshot: enabled/interfaces。'),
      backpressure: protocolToggleSchema.describe('Backpressure: enabled/interfaces。'),
      staticRoutes: z.array(staticRouteSchema).optional().describe('静态路由表，每项包含 destination/nexthop/interface。'),
      convergence: z.object({
        targetCidr: z.string().optional().describe('收敛目标网段。'),
        maxAttempts: z.number().int().min(0).optional().describe('最大尝试次数。'),
      }).optional().describe('路由收敛配置。'),
    },
  }, async (args) => runTool('opencli_set_node_protocol_config', args, () => executor.setNodeProtocolConfig(args)));

  server.registerTool('opencli_generate_tdma_schedule', {
    title: 'Generate TDMA schedule',
    description: '封装前端时隙配置弹窗，生成 TDMA 调度文件。',
    annotations: WRITE_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('EMANE 子网节点名称、别名或 ID。'),
      filePath: z.string().optional().describe('调度文件保存路径，默认 /usr/local/share/core/tdmaschedule/schedule1.xml。'),
      slotCount: z.number().int().min(1).max(100).optional().describe('时隙数量，不能小于连接到该子网的节点数量。'),
      slotWidth: z.number().int().min(1).max(100000).optional().describe('时隙宽度，单位微秒。'),
      nodeSlotMap: tdmaNodeSlotMapSchema.describe('节点到时隙索引的映射。key 可用节点 ID、名称或别名，value 从 0 开始。'),
    },
  }, async (args) => runTool('opencli_generate_tdma_schedule', args, () => executor.generateTdmaSchedule(args)));

  // MCP write tools: mutate scenes/topology only after the required configuration gate passes.
  server.registerTool('opencli_create_scene', {
    title: 'Create OpenCLI scene',
    description: '新建仿真场景。写操作会直接执行。注意：如果用户同一句话还要求添加节点、子网或链路，创建场景后先调用 opencli_read_*_creation_options 配置读取工具获取表单；不要让写工具承担展示表单。',
    annotations: WRITE_TOOL,
    inputSchema: {
      name: z.string().optional().describe('新场景名称。'),
    },
  }, async ({ name }) => runStructuredCommand('opencli_create_scene', { name }, executor, { kind: 'initScene', name }));

  server.registerTool('opencli_close_scene', {
    title: 'Close OpenCLI scene',
    description: '关闭指定仿真场景。普通写操作，会直接执行。',
    annotations: WRITE_TOOL,
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
    description: '写入一个前端侧边栏节点/子网/半实物/业务/应用模型。必须先通过 opencli_read_node_creation_options 或 opencli_read_subnet_creation_options 读取配置项并让用户填写；若未传合法 userSelections，本工具只返回短阻断和应调用的读取工具，不返回完整表单。',
    annotations: WRITE_TOOL,
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      clientId: z.string().optional().describe('复合配置表中的实体 clientId；使用复合 configRequestId 写入时必须提供。'),
      name: z.string().optional().describe('节点名称或别名。'),
      lat: z.number().optional().describe('纬度。缺省使用默认中心点。'),
      lon: z.number().optional().describe('经度。缺省使用默认中心点。'),
      alt: z.number().optional().describe('高度。缺省使用默认高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
      server: z.string().optional().describe('Optional backend server name. If omitted, MCP follows the frontend default and leaves it unset.'),
      configServices: configServicesSchema.describe('Optional config_services override. If omitted, MCP uses the frontend defaults for the node type.'),
      templateId: z.number().int().positive().optional().describe('VMNODE 创建时使用的 VM 模板 ID。'),
      rj45Interface: z.enum(['ens52f0', 'ens52f1', 'ens52f2', 'ens52f3']).optional().describe('RJ45/半实物节点使用的物理网口名称；提供后会作为后端节点 name。'),
      tmvDeviceType: z.enum(['transmitter', 'receiver']).optional().describe('流量终端设备类型。'),
      businessDeviceType: z.enum(['container', 'transferTarget']).optional().describe('业务终端设备类型。'),
      userSelections: userSelectionsSchema.describe(USER_SELECTIONS_DESCRIPTION),
      emaneModel: emaneModelSchema.describe('EMANE 链路层模型；必须来自 MCP 返回的完整前端选项，不要替用户默认选择。'),
      phyType: phyTypeSchema.describe('EMANE 物理层模型；必须按所选链路层的联动选项填写，wired/空字符串表示前端有线模型。'),
      emaneConfig: emaneConfigSchema.describe('Optional EMANE parameter overrides, keyed by frontend config parameter name.'),
    },
  }, async ({ nodeType, clientId, name, lat, lon, alt, role, server, configServices, templateId, rj45Interface, tmvDeviceType, businessDeviceType, userSelections, emaneModel, phyType, emaneConfig }) => runStructuredCommand('opencli_add_node', {
    nodeType,
    clientId,
    name,
    lat,
    lon,
    alt,
    role,
    server,
    configServices,
    templateId,
    rj45Interface,
    tmvDeviceType,
    businessDeviceType,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  }, executor, {
    kind: 'addNode',
    nodeType,
    clientId,
    name,
    lat,
    lon,
    alt,
    role,
    server,
    configServices,
    templateId,
    rj45Interface,
    tmvDeviceType,
    businessDeviceType,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  } as OpenCliCommand));

  server.registerTool('opencli_add_nodes_grid', {
    title: 'Add OpenCLI node grid',
    description: '按网格批量写入同类型节点，最多一次 30 个。必须先通过 opencli_read_node_creation_options 读取配置项并让用户填写；复合拓扑里不同类型节点应逐个调用 opencli_add_node。',
    annotations: WRITE_TOOL,
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      clientId: z.string().optional().describe('复合配置表中的实体 clientId；批量/网格作为一个实体确认时使用。'),
      count: z.number().int().positive().max(30).describe('节点数量。'),
      centerLat: z.number().optional().describe('中心纬度。'),
      centerLon: z.number().optional().describe('中心经度。'),
      alt: z.number().optional().describe('高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
      server: z.string().optional().describe('Optional backend server name. If omitted, MCP follows the frontend default and leaves it unset.'),
      configServices: configServicesSchema.describe('Optional config_services override. If omitted, MCP uses the frontend defaults for the node type.'),
      userSelections: userSelectionsSchema.describe(USER_SELECTIONS_DESCRIPTION),
      emaneModel: emaneModelSchema.describe('EMANE 链路层模型；必须来自 MCP 返回的完整前端选项，不要替用户默认选择。'),
      phyType: phyTypeSchema.describe('EMANE 物理层模型；必须按所选链路层的联动选项填写，wired/空字符串表示前端有线模型。'),
      emaneConfig: emaneConfigSchema.describe('Optional EMANE parameter overrides, keyed by frontend config parameter name.'),
    },
  }, async ({ nodeType, clientId, count, centerLat, centerLon, alt, role, server, configServices, userSelections, emaneModel, phyType, emaneConfig }) => runStructuredCommand('opencli_add_nodes_grid', {
    nodeType,
    clientId,
    count,
    centerLat,
    centerLon,
    alt,
    role,
    server,
    configServices,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  }, executor, {
    kind: 'addNodesGrid',
    nodeType,
    clientId,
    count,
    centerLat,
    centerLon,
    alt,
    role,
    server,
    configServices,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  } as OpenCliCommand));

  server.registerTool('opencli_add_nodes_batch', {
    title: 'Add OpenCLI nodes batch',
    description: '按名称批量写入同类型节点。必须先通过 opencli_read_node_creation_options 读取配置项并让用户填写；复合拓扑里不同类型节点应逐个调用 opencli_add_node。',
    annotations: WRITE_TOOL,
    inputSchema: {
      nodeType: nodeTypeSchema.describe('节点类型。'),
      clientId: z.string().optional().describe('复合配置表中的实体 clientId；批量作为一个实体确认时使用。'),
      names: z.array(z.string().min(1)).min(1).describe('节点名称列表。'),
      centerLat: z.number().optional().describe('中心纬度。'),
      centerLon: z.number().optional().describe('中心经度。'),
      alt: z.number().optional().describe('高度。'),
      role: roleSchema.optional().describe('角色：1 公共/白方，2 红方，3 蓝方。'),
      server: z.string().optional().describe('Optional backend server name. If omitted, MCP follows the frontend default and leaves it unset.'),
      configServices: configServicesSchema.describe('Optional config_services override. If omitted, MCP uses the frontend defaults for the node type.'),
      userSelections: userSelectionsSchema.describe(USER_SELECTIONS_DESCRIPTION),
      emaneModel: emaneModelSchema.describe('EMANE 链路层模型；必须来自 MCP 返回的完整前端选项，不要替用户默认选择。'),
      phyType: phyTypeSchema.describe('EMANE 物理层模型；必须按所选链路层的联动选项填写，wired/空字符串表示前端有线模型。'),
      emaneConfig: emaneConfigSchema.describe('Optional EMANE parameter overrides, keyed by frontend config parameter name.'),
    },
  }, async ({ nodeType, clientId, names, centerLat, centerLon, alt, role, server, configServices, userSelections, emaneModel, phyType, emaneConfig }) => runStructuredCommand('opencli_add_nodes_batch', {
    nodeType,
    clientId,
    names,
    centerLat,
    centerLon,
    alt,
    role,
    server,
    configServices,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  }, executor, {
    kind: 'addNodesBatch',
    nodeType,
    clientId,
    names,
    centerLat,
    centerLon,
    alt,
    role,
    server,
    configServices,
    userSelections,
    emaneModel,
    phyType,
    emaneConfig,
  } as OpenCliCommand));

  server.registerTool('opencli_connect_nodes', {
    title: 'Connect OpenCLI nodes',
    description: '写入两个节点之间的链路。必须先通过 opencli_read_link_creation_options 读取前端链路配置项并让用户填写；若未传合法 userSelections，本工具只返回短阻断，不返回完整表单。',
    annotations: WRITE_TOOL,
    inputSchema: {
      from: z.string().min(1).describe('起点节点名称、别名或 ID。'),
      clientId: z.string().optional().describe('复合配置表中的链路 clientId；使用复合 configRequestId 写入时必须提供。'),
      to: z.string().min(1).describe('终点节点名称、别名或 ID。'),
      linkType: linkTypeSchema.optional().describe('链路类型。缺省根据节点类型自动判断。'),
      linkOptions: linkOptionsSchema.describe('Optional link options override. Omitted fields use frontend defaults.'),
      fromIp: z.string().optional().describe('Optional IPv4 address for the source node interface.'),
      toIp: z.string().optional().describe('Optional IPv4 address for the target node interface.'),
      userSelections: userSelectionsSchema.describe(LINK_USER_SELECTIONS_DESCRIPTION),
    },
  }, async ({ from, clientId, to, linkType, linkOptions, fromIp, toIp, userSelections }) => runStructuredCommand('opencli_connect_nodes', { from, clientId, to, linkType, linkOptions, fromIp, toIp, userSelections }, executor, {
    kind: 'connectNodes',
    clientId,
    from,
    to,
    linkType,
    linkOptions,
    fromIp,
    toIp,
    userSelections,
  } as OpenCliCommand));

  server.registerTool('opencli_add_links_batch', {
    title: 'Add OpenCLI links batch',
    description: '批量写入链路。必须先通过 opencli_read_link_creation_options 或 opencli_read_composite_creation_options 读取配置项并让用户填写；复合配置中每条 pair 应携带对应 clientId。',
    annotations: WRITE_TOOL,
    inputSchema: {
      pairs: z.array(linkPairSchema).min(1).describe('链路节点对列表。'),
      clientId: z.string().optional().describe('复合配置表中的链路组 clientId；批量作为一个实体确认时使用。'),
      linkType: linkTypeSchema.optional().describe('链路类型。缺省根据节点类型自动判断。'),
      linkOptions: linkOptionsSchema.describe('Optional link options override shared by all pairs. Omitted fields use frontend defaults.'),
      userSelections: userSelectionsSchema.describe(LINK_USER_SELECTIONS_DESCRIPTION),
    },
  }, async ({ pairs, clientId, linkType, linkOptions, userSelections }) => runStructuredCommand('opencli_add_links_batch', { pairs, clientId, linkType, linkOptions, userSelections }, executor, {
    kind: 'addLinksBatch',
    clientId,
    pairs,
    linkType,
    linkOptions,
    userSelections,
  } as OpenCliCommand));

  // MCP destructive tools: delete, clear, or arbitrary text operations that may delete/clear.
  server.registerTool('opencli_delete_node', {
    title: 'Delete OpenCLI node',
    description: '删除一个节点。高风险写操作，会直接执行。',
    annotations: DESTRUCTIVE_TOOL,
    inputSchema: {
      target: z.string().min(1).describe('节点名称、别名或 ID。'),
    },
  }, async ({ target }) => runStructuredCommand('opencli_delete_node', { target }, executor, { kind: 'deleteNode', target }));

  server.registerTool('opencli_delete_nodes_batch', {
    title: 'Delete OpenCLI nodes batch',
    description: '批量删除节点。高风险写操作，会直接执行。',
    annotations: DESTRUCTIVE_TOOL,
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
    annotations: DESTRUCTIVE_TOOL,
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
    annotations: WRITE_TOOL,
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
    annotations: WRITE_TOOL,
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
    annotations: DESTRUCTIVE_TOOL,
  }, async () => runStructuredCommand('opencli_clear_scene', {}, executor, { kind: 'clearScene' }));

  server.registerTool('opencli_sample_scene', {
    title: 'Create OpenCLI sample scene',
    description: '在当前场景创建 OpenCLI 示例拓扑元素。写操作会直接执行。',
    annotations: WRITE_TOOL,
  }, async () => runStructuredCommand('opencli_sample_scene', {}, executor, { kind: 'sampleScene' }));

  server.registerTool('opencli_start_simulation', {
    title: 'Start OpenCLI simulation',
    description: '启动当前场景仿真。写操作会直接执行。',
    annotations: WRITE_TOOL,
    inputSchema: {
      duration: z.number().positive().optional().describe('仿真时长，秒或毫秒。小于等于 86400 时按秒处理。'),
    },
  }, async ({ duration }) => runStructuredCommand('opencli_start_simulation', { duration }, executor, {
    kind: 'startSession',
    duration,
  }));

  server.registerTool('opencli_pause_simulation', {
    title: 'Pause OpenCLI simulation',
    description: '暂停当前场景仿真。普通写操作，会直接执行。',
    annotations: WRITE_TOOL,
  }, async () => runStructuredCommand('opencli_pause_simulation', {}, executor, { kind: 'pauseSession' }));

  server.registerTool('opencli_stop_simulation', {
    title: 'Stop OpenCLI simulation',
    description: '停止当前场景仿真。普通写操作，会直接执行。',
    annotations: WRITE_TOOL,
  }, async () => runStructuredCommand('opencli_stop_simulation', {}, executor, { kind: 'stopSession' }));
}
