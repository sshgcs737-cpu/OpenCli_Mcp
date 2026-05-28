# OpenCLI MCP 层工作总结

更新时间：2026-05-27

本文档总结当前项目 MCP 层的实现现状、代码结构、工具能力、调用链、运行配置和后续方向。范围聚焦 `mcp/`、OpenCLI 文本命令兼容层、MCP 运行脚本和相关前端数据类型，不展开 Cesium 页面本身的 UI 实现。

## 1. 当前定位

当前 MCP 层是 OpenCLI 仿真系统的 AI/自动化控制入口。它以独立 Node 进程运行，通过 MCP Streamable HTTP 协议暴露 tools、resources 和 prompts，让  MCP Client 能够用结构化方式操作场景、拓扑、节点配置和仿真生命周期。

整体链路：

```text
MCP Client / Claude Code
  -> HTTP /mcp
  -> mcp/server.ts
  -> tools / resources / prompts
  -> mcp/opencliMcpExecutor.ts
  -> mcp/backendClient.ts
  -> OpenCLI 后端 API / Router API
```

当前 MCP 层不依赖浏览器页面状态，不依赖 Pinia、Vue Router 或 Vite proxy。它读取 `.env.mcp` 中的后端地址、MCP key、后端 token、用户 ID 等配置，直接通过后端 API 完成操作。

## 2. 已完成能力

当前 MCP 层已经覆盖这些主要能力：

- MCP Streamable HTTP server。
- 入站 MCP token 鉴权。
- Host/Origin 安全校验。
- 单客户端兼容模式。
- 场景发现、创建、加载、关闭。
- 当前场景状态、拓扑摘要、完整 topo 导出。
- OpenCLI 文本命令兼容入口。
- 节点添加、批量添加、网格生成、移动、删除、批量删除、状态修改。
- 链路添加、批量添加、批量删除。
- 前端左侧添加入口配置项读取：设备、链路、子网、干扰、半实物、业务、应用层模型。
- `opencli_add_node` 已扩展到前端真实菜单类型，例如 VM、机动车、卫星、路由器、业务终端、应用层模型、SDN/OVS/P4/SR、干扰节点等。
- 新增创建配置项读取工具：`opencli_read_node_creation_options`、`opencli_read_subnet_creation_options`、`opencli_read_link_creation_options`、`opencli_read_composite_creation_options`。创建前端节点、子网、链路或复合拓扑时，先调用这些读工具获取 `structuredContent.configForm` 和 `configRequestId`。
- `opencli_add_node`、批量添加节点、添加链路工具改为强校验写工具：未传合法 `userSelections` 时，只返回短阻断和应调用的配置项读取工具，不再把完整配置表塞进写工具返回里。
- 配置确认门继续收紧：重复创建请求、`configConfirmed`、`useDefaultConfig` 等 agent 代填信号不能视为用户确认；MCP 返回配置清单时会返回 `configRequestId`，下一次写入必须把该 ID 和用户选择一起放入 `userSelections`。
- 复合创建草案由 `opencli_read_composite_creation_options` 返回一张结构化 `configForm` 和同一个 `configRequestId`；重复表单会合并到 `formDefinitions`，实体和链路只引用 `formKey`。
- 写工具会强校验 `configRequestId` 来源：只有配置项读取工具登记过的请求 ID 能授权写入；写工具短阻断临时生成的 ID 不能用于创建节点、子网或链路。
- 子网创建表单按前端逻辑拆成两阶段：先展示完整链路层模型、物理层模型和联动关系；用户选择 `emaneModel/phyType` 后，再返回该模型适用的 External/MAC/PHY/Platform 参数字段。有线模型不要求无线物理层字段。
- 节点创建表单对齐 `NodeConfigDialog.vue`：基本信息、坐标信息、快速放置、协议配置、VM 模板、半实物网口、业务/流量终端类型等按前端控件返回。用户可按前端复选框回传 `enableZebra/enableOSPF/enableOLSR/enableBGP/enableRIP`，MCP 会映射为后端 `config_services`。
- 链路创建表单对齐 `LinkConfigDialog.vue`：端点选择、源/目标接口字段、带宽/延迟/丢包/抖动/缓冲/重复/突发/最大突发/单向链路等参数都会返回给用户确认。
- 配置确认门现在覆盖所有前端添加节点动作：即使只有基础字段，也必须先把名称、位置、高度、角色等前端可配置项返回给用户；用户结构化回传后才写后端。
- 工具返回层会把配置项读取工具的 `configForm`、`configRequestId`、`nextConfigStage`、`submitTool` 提升到 `structuredContent` 顶层。读取工具文本只保留短摘要，完整字段、选项、默认值和联动关系在 `structuredContent.configForm`。
- 配置项读取工具本身返回 `requiresUserInput=true`、`optionReadResult=true`、`interactionMode=display_options_then_wait_for_user`，但不再作为错误返回；等待用户输入不是后端失败。写工具缺配置时仍返回 `requiresUserInput=true` 和 `requiresFormTool=true` 的短阻断，并以 `isError=true` 阻止继续写入。
- `opencli_create_scene` 返回中增加复合请求下一步约束：如果用户同一句话还要求添加节点/子网/链路，必须继续调用配置项读取工具，而不是让写工具返回表单或让用户回复“默认配置继续”。
- 前端节点配置字段 schema 暴露。
- 通用节点配置更新：别名、状态、角色、服务器、服务、位置、EMANE 参数。
- VM 模板查询与 VM 参数更新。
- 路由协议配置查询与保存。
- TDMA 时隙调度文件生成。
- 仿真启动前检查。
- 仿真启动、暂停、停止。
- 启动仿真时联动 broker、NEM ID、协议应用和被动测量。
- MCP resources 和 prompts。
- Smoke test 脚本。

## 3. 运行入口

`package.json` 中已有 MCP 相关脚本：

```json
{
  "mcp": "tsx mcp/server.ts",
  "mcp:dev": "tsx watch mcp/server.ts",
  "mcp:smoke": "node scripts/mcp-smoke-test.js"
}
```

常用命令：

```bash
npm run mcp
npm run mcp:dev
npm run mcp:smoke
```

- `npm run mcp` 启动 MCP server。
- `npm run mcp:dev` 用 watch 模式开发。
- `npm run mcp:smoke` 需要 MCP server 已启动，用于协议层 smoke test。

## 4. 代码结构总览

| 文件 | 作用 |
|---|---|
| `mcp/server.ts` | MCP HTTP server 入口，负责 Streamable HTTP、session、鉴权、Host/Origin/CORS、安全 header、日志、health check、tools/resources/prompts 注册 |
| `mcp/config.ts` | 读取 `.env.mcp` 和环境变量，生成 MCP 与后端配置，并提供必需配置校验 |
| `mcp/backendClient.ts` | Node 侧 Axios 后端客户端，封装主后端 API 和 Router API |
| `mcp/opencliMcpExecutor.ts` | MCP 业务执行核心，维护当前场景状态，执行场景、拓扑、节点配置、仿真等业务动作 |
| `mcp/tools.ts` | 注册 38 个 MCP tools，定义输入 schema、风险 annotations、统一日志和结果包装 |
| `mcp/resources.ts` | 注册 MCP resources，提供 runtime、能力分组、当前场景、拓扑摘要、拓扑导出、节点配置 schema、workflow |
| `mcp/prompts.ts` | 注册 MCP prompts，提供操作员流程、拓扑规划、写操作安全检查提示 |
| `src/opencli/parser.ts` | OpenCLI 文本命令 parser，供 `opencli_run_text` 复用 |
| `src/opencli/types.ts` | OpenCLI 文本命令和执行结果类型定义 |
| `src/types/topo.ts` | 前端/后端 topo、node、link、interface、EMANE config 等数据类型 |
| `scripts/mcp-smoke-test.js` | MCP 协议 smoke test，验证 health、initialize、tools/list、resources/list、prompts/list、tools/call |
| `.env.mcp` | 本地 MCP 运行配置，包含 token、后端地址、用户信息等 |
| `.env.mcp.example` | MCP 配置模板 |

## 5. `mcp/server.ts`

`server.ts` 是 MCP 层的 HTTP 入口。

主要职责：

- 创建 Express MCP app。
- 使用 `StreamableHTTPServerTransport` 提供 MCP Streamable HTTP。
- 处理 `POST /mcp`、`GET /mcp`、`DELETE /mcp`。
- 提供 `GET /health` 健康检查。
- 管理 MCP session。
- 支持标准 `mcp-session-id`。
- 支持 `OPENCLI_MCP_SINGLE_CLIENT=1` 的单客户端兼容模式。
- 校验 MCP 入站 token。
- 校验 Host 和 Origin。
- 兼容部分客户端不完整的 `Accept` header。
- 统一打印 HTTP 层日志。
- 为每个 MCP server 注册 tools、resources、prompts。

当前 HTTP 入口：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/health` | 返回 MCP 服务健康状态 |
| `POST` | `/mcp` | MCP JSON-RPC 主入口 |
| `GET` | `/mcp` | MCP SSE stream |
| `DELETE` | `/mcp` | 结束 MCP session |

当前架构中 `OpenCliBackendClient` 和 `OpenCliMcpExecutor` 是进程级单例，因此多个 MCP session 会共享同一个当前场景状态。它适合本地单用户或单客户端使用；如果未来要多用户并发，需要把 executor 下沉到 session 级别。

## 6. `mcp/config.ts`

`config.ts` 负责读取运行配置。

配置来源顺序：

```text
.env.mcp
普通环境变量
默认值
```

MCP 相关配置：

| 配置项 | 作用 |
|---|---|
| `OPENCLI_MCP_HOST` | MCP server 监听 host，默认 `127.0.0.1` |
| `OPENCLI_MCP_PORT` | MCP server 监听端口，默认 `8787` |
| `OPENCLI_MCP_NAME` | MCP server 名称，默认 `opencli-mcp` |
| `OPENCLI_MCP_VERSION` | MCP server 版本，默认 `1.0.0` |
| `OPENCLI_MCP_KEY` | MCP 入站鉴权 key，默认 `local-dev-key` |
| `OPENCLI_MCP_SINGLE_CLIENT` | 是否启用单客户端兼容模式 |
| `OPENCLI_MCP_ALLOWED_HOSTS` | Host 白名单 |
| `OPENCLI_MCP_ALLOWED_ORIGINS` | Origin 白名单 |

后端相关配置：

| 配置项 | 作用 |
|---|---|
| `OPENCLI_API_BASE` | 主后端 API 地址 |
| `OPENCLI_AUTH_API_BASE` | 鉴权后端 API 地址 |
| `OPENCLI_ROUTER_API_BASE` | Router API 地址 |
| `OPENCLI_WS_URL` | 前端同步 WebSocket 地址 |
| `OPENCLI_FRONTEND_SYNC_DELAY_MS` | 前端拓扑同步等待时间 |
| `OPENCLI_BACKEND_TOKEN` | 转发给后端的 Bearer token |
| `OPENCLI_USER_ID` | 写操作使用的用户 ID |
| `OPENCLI_USERNAME` | 查询场景等操作使用的用户名 |
| `OPENCLI_ORDINARY` | 新建场景参数 |
| `OPENCLI_DISTURB` | 新建场景参数 |

`requireBackendToken()` 和 `requireUserId()` 会在缺少关键配置时直接抛出可读错误，避免写操作在身份不完整时继续执行。

## 7. `mcp/backendClient.ts`

`backendClient.ts` 是后端 API 的 Node 侧封装，不走 Vite proxy。

它内部维护两个 Axios 实例：

- `api`：主 OpenCLI 后端，使用 `OPENCLI_API_BASE`。
- `routerApi`：路由/协议/测量后端，使用 `OPENCLI_ROUTER_API_BASE`。

主后端能力：

- `listScenes()`：查询私有/公共/全部场景。
- `createScene()`：新建场景。
- `closeScene()`：关闭场景。
- `getTopo()`：获取 topo。
- `addNode()`：添加节点。
- `editNode()`：编辑节点。
- `deleteNode()`：删除节点。
- `addLink()`：添加链路。
- `deleteLink()`：删除链路。
- `startSession()`：启动仿真。
- `pauseSession()`：暂停仿真。
- `stopSession()`：停止仿真。
- `startBroker()`：启动 broker/监控。
- `stopBroker()`：停止 broker/监控。
- `getNemIds()`：获取 NEM ID。
- `getVMTemplates()`：读取 VM 模板列表。
- `editVMNode()`：编辑 VM 节点参数。
- `generateTDMA()`：生成 TDMA 调度文件。

Router API 能力：

- `getAllProtocols()`：读取节点协议配置。
- `insertRouterInfo()`：保存协议配置。
- `cancelProtocol()`：重置协议配置。
- `applyProtocol()`：推送协议配置。
- `passiveMeasurement()`：下发被动测量命令。

错误处理：

- 统一识别 Axios 错误。
- 对 401 给出后端 token 相关提示。
- 统一检查后端 `code !== 200` 的业务失败。
- 把后端 `msg/message/error` 转成可读 Error。

## 8. `mcp/opencliMcpExecutor.ts`

`opencliMcpExecutor.ts` 是 MCP 业务执行核心。它接收 tools 或文本 parser 生成的命令，然后转换为后端 API 调用。

### 8.1 内部状态

Executor 维护当前加载场景：

```ts
{
  currentSessionId: number | null,
  currentSessionName: string,
  topoData: TopoData | null
}
```

`opencli_load_scene`、`opencli_create_scene`、`opencli_refresh_topo` 等操作会更新该状态。

### 8.2 场景能力

- `listScenes()`：查询场景列表并排序去重。
- `currentScene()`：返回当前 MCP 内存中加载的场景。
- `loadScene()`：按 `sessionId` 或 `name` 加载场景。
- `topoSummary()`：输出拓扑摘要。
- `topoExport()`：输出完整 topo JSON。
- `createScene()`：新建场景并在成功时自动加载。
- `closeScene()`：关闭指定场景。

### 8.3 文本命令兼容

- `runText()` 调用 `parseOpenCli()`。
- parser 输出 `OpenCliCommand`。
- `executeCommand()` 根据 `kind` 分发到具体执行函数。

这保留了原 OpenCLI 文本命令入口，但推荐优先使用结构化 tools。

### 8.4 拓扑与节点能力

- 创建单节点。
- 网格批量创建节点。
- 按名称批量创建节点。
- 连接节点。
- 批量连接链路。
- 删除节点。
- 批量删除节点。
- 批量删除链路。
- 移动节点。
- 设置节点 `UP/DOWN`。
- 清空场景。
- 创建示例拓扑。

节点创建时会处理：

- 默认中心点。
- 默认高度。
- 名称生成。
- 中文/自定义 alias。
- 后端节点类型映射。
- 默认服务配置。
- EMANE 默认参数。
- `emaneModel`、`phyType`、`emaneConfig` 覆盖。
- 服务器字段。

链路创建时会处理：

- 按节点类型推断链路类型。
- 自动生成接口。
- 默认 IP。
- EMANE 子网链路特殊字段。
- 链路参数覆盖。

### 8.5 前端节点配置封装

这是目前新增的重要能力，用来把前端中用户可输入/选择的节点配置字段暴露给 MCP。

相关方法：

- `creationConfigSchema()`：返回前端左侧添加入口的配置表单。支持单实体，也支持 `composite` 复合草案；支持 `configStage` 和 `partialSelections` 驱动子网联动表单。
- `nodeConfigSchema()`：返回前端节点配置字段 catalog。传入 `target` 时，还会返回该节点当前值、网卡、连接节点、VM 信息、协议 container、TDMA 上下文和 EMANE 参数。
- `updateNodeConfig()`：更新通用节点字段。
- `vmTemplates()`：读取 VM 模板。
- `updateVMConfig()`：更新 VM 参数。
- `nodeProtocolConfig()`：读取协议配置入口和当前配置。
- `setNodeProtocolConfig()`：保存协议配置。
- `generateTdmaSchedule()`：生成 TDMA 调度文件。

已覆盖的前端字段：

- 节点别名 `alias`。
- 故障状态 `status`。
- 阵营/角色 `role`。
- 服务器 `server`。
- 配置服务 `configServices`。
- 坐标 `lat/lon/alt`。
- EMANE `phyType`。
- EMANE 参数 `emaneConfig`。
- VM `templateId/cpu/memoryMb/currentMemoryMb`。
- 协议 OSPFv2、OSPFv3、RIP、BGP、IS-IS、PIM、Snapshot、Backpressure。
- 静态路由 `destination/nexthop/interface`。
- 收敛配置 `targetCidr/maxAttempts`。
- TDMA `filePath/slotCount/slotWidth/nodeSlotMap`。

#### 8.5.1 创建配置确认流

创建类写操作遵循“先展示前端配置表单，再执行写入”：

1. 新建场景可以先执行并加载，用于获得 topo、服务器等上下文。
2. 节点、子网、链路等拓扑写入前，必须先调用配置项读取工具获取 `structuredContent.configForm` 和 `configRequestId`。
3. 写工具只负责写入和校验。缺少合法 `userSelections` 时，写工具只返回 `requiresFormTool=true` 的短阻断，不返回完整配置表。
4. AI/UI 必须把 `structuredContent.configForm` 中的字段、选项、默认值和联动关系展示给用户。默认值只能说明“前端预填是多少”，不能由 agent 代替用户选择。
5. 用户确认后，写工具必须通过 `userSelections` 回传结构化字段和同一个 `configRequestId`；`useDefaultConfig/configConfirmed` 这类信号会被拒绝。
6. 复合请求使用同一个 pending config session。每个实体用 `clientId` 标识；同类型批量节点和批量链路写入时，也会按每个子实体的 `clientId` 校验和消费。混合类型复合拓扑不要硬塞进节点批量工具，链路批量写入要保留 `pairs[].clientId`。

复合配置表返回结构重点字段：

| 字段 | 作用 |
|---|---|
| `formToolResult` | 表示这是配置项读取工具的表单结果 |
| `displayMarkdown` | 短摘要；完整表单不再放在长文本里 |
| `configRequestId` | 本轮配置确认 ID，写入时必须放入 `userSelections` |
| `configForm.actionId` | 单实体 actionId，或 `composite.create` |
| `configForm.entities` | 复合请求中的节点/子网实体，每个实体包含 `clientId`、`nodeType`、`formKey` |
| `configForm.links` | 复合请求中的链路草案，每条链路包含 `clientId`、端点和 `formKey` |
| `configForm.formDefinitions` | 去重后的完整表单定义，供实体/链路通过 `formKey` 引用 |
| `nextConfigStage` | 下一阶段，例如子网从 `subnet-model` 进入 `subnet-parameters` |

子网配置阶段：

- `subnet-model`：展示完整链路层模型、完整物理层模型、链路层到物理层联动关系。
- `subnet-parameters`：在用户选择 `emaneModel/phyType` 后，只返回该模型适用的 External/MAC/PHY/Platform 字段；`ieee802.3`、TSN 等 wired 模型不要求无线 PHY 字段。
- `review`：字段已经收集完毕，可以按 `clientId` 调用写工具。

当前强制配置确认的添加动作：

- 子网 `EMANE`。
- VM `VMNODE`。
- 半实物 `RJ45`。
- 业务终端 `TMV`、`BUSINESS_Transmitter`。
- 链路 `link.add`。
- 无人机、机动车、基站、卫星的协议服务配置。
- 分布式场景中的路由器协议服务配置。

基础节点也进入配置确认门：HTTP/DNS/FTP/SMTP/TLS/VoIP-SIP/MQTT/CoAP/DDS/SSH、普通交换机、攻击机、安全机、SDN/OVS/P4/SR、PKI 等至少需要用户确认名称、位置、高度和角色后才写入。

### 8.6 仿真能力

仿真启动流程包括：

1. 确认当前 topo。
2. 等待拓扑节点/链路数量稳定。
3. 确保节点 server 分配。
4. 通知前端同步拓扑。
5. 调用后端 `/start`。
6. 尝试恢复运行态前端渲染字段。
7. 如果存在 EMANE 节点，获取 NEM ID。
8. 如果存在协议配置，重置并推送协议。
9. 启动 broker。
10. 启动被动测量。
11. 返回 verification 和诊断数据。

暂停/停止流程会优先尝试停止被动测量和 broker，然后调用后端 pause/stop。停止时还会尝试 reset router 协议。

## 9. `mcp/tools.ts`

`tools.ts` 注册当前全部 MCP tools，并定义输入 schema、风险 annotation、日志和返回包装。

### 9.1 Tool annotations

| 常量 | 作用 |
|---|---|
| `READ_ONLY_TOOL` | 只读、幂等 |
| `LOCAL_STATE_TOOL` | 修改 MCP 本地状态，不直接写后端 |
| `CONFIG_OPTION_READ_TOOL` | 低风险配置读取；只登记临时 `configRequestId`，不写后端或拓扑 |
| `WRITE_TOOL` | 普通写操作 |
| `DESTRUCTIVE_TOOL` | 删除/清空类高风险写操作，或可能执行删除/清空的文本命令入口 |

高风险工具只保留删除节点、批量删除节点、批量删除链路、清空拓扑，以及可能执行删除/清空文本命令的 `opencli_run_text`。关闭场景、暂停/停止仿真、节点状态修改和节点配置更新按普通写操作标注。

### 9.2 统一返回结构

所有工具统一通过 `runTool()` 包装，返回：

```ts
{
  isError: boolean,
  structuredContent: {
    ok: boolean,
    tool: string,
    message: string,
    data?: unknown
  },
  content: [
    {
      type: 'text',
      text: string
    }
  ]
}
```

对于写操作，executor 通常会返回：

```text
structuredContent.data.verification
```

里面包含：

- `sessionId`
- `sceneName`
- `state`
- `nodeCount`
- `linkCount`

### 9.3 当前 38 个 tools

场景与状态：

| Tool | 类型 | 作用 |
|---|---|---|
| `opencli_scene_list` | 只读 | 查询私有/公共/全部场景 |
| `opencli_current_scene` | 只读 | 查看当前 MCP 加载场景 |
| `opencli_load_scene` | 本地状态 | 加载场景到 MCP 内存 |
| `opencli_refresh_topo` | 本地状态 | 刷新当前场景拓扑 |
| `opencli_topo_summary` | 只读 | 查看拓扑摘要 |
| `opencli_topo_export` | 只读 | 导出完整 topo JSON |
| `opencli_run_text` | 高风险 | 执行 OpenCLI 文本命令；可能包含删除/清空 |

节点和链路：

| Tool | 类型 | 作用 |
|---|---|---|
| `opencli_node_list` | 只读 | 列出节点 |
| `opencli_link_list` | 只读 | 列出链路 |
| `opencli_add_node` | 写 | 添加单节点 |
| `opencli_add_nodes_grid` | 写 | 按网格批量生成同类型节点 |
| `opencli_add_nodes_batch` | 写 | 按名称批量添加同类型节点 |
| `opencli_connect_nodes` | 写 | 连接两个节点 |
| `opencli_add_links_batch` | 写 | 批量添加链路；复合配置中每个 `pair` 可携带 `clientId` |
| `opencli_move_node` | 写 | 移动节点 |
| `opencli_set_node_status` | 写 | 设置节点 `UP/DOWN` |
| `opencli_delete_node` | 高风险 | 删除节点 |
| `opencli_delete_nodes_batch` | 高风险 | 批量删除节点 |
| `opencli_delete_links_batch` | 高风险 | 批量删除链路 |
| `opencli_clear_scene` | 高风险 | 清空拓扑 |
| `opencli_sample_scene` | 写 | 创建示例拓扑 |

节点配置：

| Tool | 类型 | 作用 |
|---|---|---|
| `opencli_read_node_creation_options` | 低风险读取 | 读取节点创建配置项，并登记 pending config session |
| `opencli_read_subnet_creation_options` | 低风险读取 | 读取子网 Stage 1/Stage 2 创建配置项，并登记 pending config session |
| `opencli_read_link_creation_options` | 低风险读取 | 读取链路创建配置项，并登记 pending config session |
| `opencli_read_composite_creation_options` | 低风险读取 | 读取复合拓扑创建配置项，同一张表覆盖多个节点/子网/链路 |
| `opencli_node_config_schema` | 只读 | 返回前端节点配置字段 catalog 和当前节点配置上下文 |
| `opencli_update_node_config` | 写 | 更新别名、状态、角色、服务器、服务、坐标、EMANE 参数 |
| `opencli_vm_templates` | 只读 | 查询 VM 模板 |
| `opencli_update_vm_config` | 写 | 更新 VM 模板、CPU、内存、当前内存 |
| `opencli_get_node_protocol_config` | 只读 | 查询协议配置入口、可选网卡和当前协议配置 |
| `opencli_set_node_protocol_config` | 写 | 保存协议、静态路由和收敛参数 |
| `opencli_generate_tdma_schedule` | 写 | 生成 TDMA 调度文件 |

仿真：

| Tool | 类型 | 作用 |
|---|---|---|
| `opencli_simulation_check` | 只读 | 启动仿真前检查 |
| `opencli_start_simulation` | 写 | 启动仿真 |
| `opencli_pause_simulation` | 写 | 暂停仿真 |
| `opencli_stop_simulation` | 写 | 停止仿真 |

场景写操作：

| Tool | 类型 | 作用 |
|---|---|---|
| `opencli_create_scene` | 写 | 新建场景 |
| `opencli_close_scene` | 写 | 关闭场景 |

## 10. `mcp/resources.ts`

`resources.ts` 提供只读上下文，让 MCP Client 不调用 tool 也能读取运行态信息。

当前 resources：

| URI | MIME | 作用 |
|---|---|---|
| `opencli://runtime` | `application/json` | MCP 运行配置、tools/resources/prompts 列表 |
| `opencli://capabilities` | `application/json` | 按 MCP 语义分组的能力目录：只读、本地状态、配置读取、写入、删除/清空类高风险写入 |
| `opencli://current-scene` | `application/json` | 当前加载场景状态 |
| `opencli://topology/summary` | `application/json` | 当前拓扑摘要 |
| `opencli://topology/export` | `application/json` | 当前完整 topo JSON |
| `opencli://node-config/schema` | `application/json` | 前端节点配置字段 catalog |
| `opencli://workflow` | `text/plain` | 推荐操作流程和安全约束 |

工具名注意事项：

- `opencli://runtime` 中的 `registeredToolNames` 是服务端注册名，不保证等同于 MCP Client 当前暴露给 agent 的可调用名称。
- 如果客户端自动给工具加前缀，agent 也不应手工拼接 `mcp_<server>_<tool>`；只能调用当前工具列表中真实存在的名称。
- 不要发明 `runtime_status`、`agent_open`、`tool_catalog` 等工具名。若目标工具没有暴露，应报告客户端工具不可用，而不是猜测前缀。
- 如果客户端声称“当前只有一个工具”，先运行 `npm run mcp:smoke`。该脚本直接调用 MCP 协议 `tools/list`，能判断服务端是否实际返回 38 个工具。若 smoke test 正常但客户端只暴露一个工具，问题在客户端工具映射、连接缓存、权限或懒加载策略，不在 MCP 服务端注册。

目前没有注册 resource templates，因此 `resources/templates/list` 返回空数组是正常情况。

## 11. `mcp/prompts.ts`

`prompts.ts` 注册了三个 MCP prompts。

| Prompt | 作用 | 参数 |
|---|---|---|
| `opencli_operator` | 操作员流程指南 | `context` 可选 |
| `opencli_topology_planner` | 根据目标规划拓扑修改步骤 | `goal` 可选 |
| `opencli_write_safety` | 写操作前安全检查 | `command` 可选 |

这些 prompts 的目的不是替代 tool，而是让 AI 在调用工具前遵循固定流程：

1. 先查场景。
2. 再加载场景。
3. 再理解拓扑。
4. 节点配置先查 schema。
5. 写操作使用结构化工具。
6. 写后验证。
7. 删除/清空类高风险操作前确认影响范围。

## 12. `src/opencli/parser.ts` 和 `src/opencli/types.ts`

这两个文件提供 OpenCLI 文本命令兼容层。

- `parser.ts`：把文本命令解析成 `OpenCliCommand`。
- `types.ts`：定义 `OpenCliCommand`、`OpenCliResult`、节点类型、角色等类型。

MCP 的 `opencli_run_text` 会复用 parser：

```text
用户文本
  -> parseOpenCli()
  -> OpenCliCommand
  -> executor.executeCommand()
  -> 后端 API
```

当用户提供明确参数时，应优先使用结构化工具，而不是 `opencli_run_text`。

## 13. `src/types/topo.ts`

`topo.ts` 是拓扑数据结构定义，MCP 侧大量复用它。

重要类型：

- `TopoData`
- `Node`
- `Link`
- `NodeIface`
- `LinkOptions`
- `ConfigOption`
- `EmaneConfig`
- `Server`

MCP executor 依赖这些类型来生成和修改后端 payload，例如节点 geo、接口、链路参数、EMANE 参数、VM 字段等。

## 14. `scripts/mcp-smoke-test.js`

Smoke test 脚本用于验证 MCP 协议层是否健康。

验证内容：

1. `GET /health`
2. MCP `initialize`
3. `ping`
4. `tools/list`
5. `resources/list`
6. `resources/templates/list`
7. `prompts/list`
8. `tools/call opencli_current_scene`
9. 检查 `structuredContent.ok` 和 `structuredContent.tool`

使用方式：

```bash
npm run mcp
npm run mcp:smoke
```

它不会执行后端写操作，只检查 MCP 协议发现和基础调用。

## 15. 标准操作流程

推荐 MCP Client 或 Agent 使用以下流程：

```text
1. tools/list / resources/list / prompts/list
2. opencli_scene_list
3. opencli_load_scene
4. opencli_current_scene
5. opencli_topo_summary
6. 如果是前端侧边栏添加动作，先调用配置项读取工具；复合拓扑请求使用 opencli_read_composite_creation_options
7. 把读取工具返回的 structuredContent.configForm 里的字段、预填提示、clientId 和全部可选项展示给用户
8. 用户填写后，把结构化字段和 configRequestId 放入 userSelections，再执行结构化写 tool
9. 读取 structuredContent.data.verification
10. 再 opencli_topo_summary 或对应 read tool 验证
11. 启动仿真前 opencli_simulation_check
12. opencli_start_simulation
13. opencli_current_scene / opencli_topo_summary 验证
```

前端添加配置推荐流程：

```text
opencli_read_node_creation_options / opencli_read_subnet_creation_options / opencli_read_link_creation_options / opencli_read_composite_creation_options
  -> MCP 返回短文本摘要，以及 structuredContent.configForm、configRequestId、nextConfigStage
  -> AI/UI 根据 structuredContent.configForm 展示可选项，不摘要成默认推荐
  -> 如果 nextConfigStage=subnet-parameters，先收集 emaneModel/phyType，再带 partialSelections 继续调用 opencli_read_subnet_creation_options
  -> 用户选择或填写字段；即使选择前端预填值，也要把结构化字段和 configRequestId 显式写入 userSelections
  -> opencli_add_node / opencli_add_nodes_batch（同类型）/ opencli_connect_nodes / opencli_add_links_batch（保留 pairs[].clientId）
  -> opencli_topo_summary 验证
```

已有节点配置推荐流程：

```text
opencli_node_config_schema(target?)
  -> opencli_update_node_config
  -> opencli_update_vm_config
  -> opencli_get_node_protocol_config
  -> opencli_set_node_protocol_config
  -> opencli_generate_tdma_schedule
  -> opencli_topo_summary 或再次读取 schema 验证
```

## 16. 安全和风险策略

MCP 层目前通过 tool annotations 标注风险，不做自定义二次确认弹窗。

高风险操作：

- 删除节点。
- 批量删除节点。
- 删除链路。
- 清空场景。
- 可能执行删除/清空动作的 `opencli_run_text`。

是否需要人工审批由 MCP Client 或 Agent 平台根据 annotations 和用户意图处理。

## 17. 当前边界

当前已知边界：

- executor 是进程级单例，多 MCP session 共享当前场景状态。
- 主要支持 Streamable HTTP，没有 stdio MCP 入口。
- `.env.mcp` 中的后端 token 由本地配置提供，MCP 不解析 JWT。
- `opencli_run_text` 是规则 parser，不是大模型自然语言理解。
- 删除/清空类高风险操作没有服务端二次确认参数。
- resource templates 尚未实现。
- 分布式链路配置、干扰参数编辑等复杂二级面板目前以创建配置读取结果中的字段形式暴露，后续可继续补专用写 tool。
- 部分复杂前端纯 UI 状态不属于 MCP 控制范围。

## 18. 后续方向

建议后续继续做：

1. 每个 MCP session 独立 executor，支持多客户端隔离。
2. 给高价值工具补 outputSchema。
3. 增加 resource templates，例如 `opencli://scene/{sessionId}/summary`。
4. 给批量操作增加部分成功/失败汇总。
5. 为删除/清空类高风险操作增加可选确认参数。
6. 增加 stdio MCP server 入口。
7. 给分布式链路配置、干扰参数编辑、业务流量模型、主动测量、终端命令等复杂面板补专用写 tool。
8. 给前端添加配置 schema 和节点配置工具补 live 后端集成测试。

## 19. 验证命令

MCP 目标文件 TypeScript 检查：

```bash
npx tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module ESNext --target ES2022 --types node mcp/backendClient.ts mcp/opencliMcpExecutor.ts mcp/tools.ts mcp/resources.ts mcp/prompts.ts
```

协议层 smoke test：

```bash
npm run mcp
npm run mcp:smoke
```

Markdown 文档空白检查：

```bash
git diff --check -- docs/opencli-mcp-work-summary.md
```

