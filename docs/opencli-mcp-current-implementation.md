# OpenCLI MCP 当前版本代码实现总结

本文档整理当前代码已经实现的 OpenCLI MCP 能力，重点说明模块职责、调用链、协议兼容、工具能力、状态管理和当前边界。

## 1. 当前版本定位

当前项目新增了一个独立的 Node MCP Server，用来让 Claude Code 或其他 MCP 客户端通过 Streamable HTTP 控制 OpenCLI 仿真系统。

整体链路：

```text
Claude Code / MCP Client
  -> POST /mcp, GET /mcp, DELETE /mcp
  -> mcp/server.ts
  -> MCP tools/resources/prompts
  -> mcp/opencliMcpExecutor.ts
  -> mcp/backendClient.ts
  -> OpenCLI 后端 API
```

这个 MCP Server 不依赖浏览器页面状态，不使用 Pinia、router、Vite proxy 或浏览器登录态。它是一个本地 Node 进程，通过 `.env.mcp` 配置后端地址、MCP token、后端 token 和用户信息。

## 2. 已新增运行入口

`package.json` 已新增：

```json
{
  "mcp": "tsx mcp/server.ts",
  "mcp:dev": "tsx watch mcp/server.ts"
}
```

运行方式：

```bash
npm run mcp
```

开发监听：

```bash
npm run mcp:dev
```

## 3. 主要代码文件

| 文件 | 职责 |
|---|---|
| `mcp/server.ts` | MCP HTTP Server 入口，负责 Streamable HTTP、session、鉴权、安全 header、CORS、日志、health check |
| `mcp/config.ts` | 读取 `.env.mcp` 和环境变量，生成 MCP 与后端配置 |
| `mcp/backendClient.ts` | Node 侧后端 API client，封装场景、拓扑、仿真相关请求 |
| `mcp/opencliMcpExecutor.ts` | OpenCLI MCP 执行器，维护当前场景状态，执行文本命令和结构化命令 |
| `mcp/tools.ts` | 注册 MCP tools，定义参数 schema、tool annotations 和工具调用包装 |
| `mcp/resources.ts` | 注册 MCP resources，提供 runtime、当前场景、拓扑摘要、拓扑导出、流程说明 |
| `mcp/prompts.ts` | 注册 MCP prompts，提供操作员、拓扑规划、写操作安全检查提示 |
| `src/opencli/parser.ts` | 原有 OpenCLI 文本命令 parser，MCP 的 `opencli_run_text` 会复用它 |
| `src/opencli/types.ts` | OpenCLI 命令和结果类型定义 |
| `.env.mcp.example` | MCP 配置模板，不包含真实 token |
| `.claude/skills/opencli-mcp-operator/SKILL.md` | 当前项目级 Claude Code skill，规定操作流程和依赖顺序 |

## 4. 配置能力

配置入口：

```text
.env.mcp
```

模板：

```text
.env.mcp.example
```

当前支持的 MCP 配置：

| 配置项 | 作用 |
|---|---|
| `OPENCLI_MCP_HOST` | MCP 服务监听地址 |
| `OPENCLI_MCP_PORT` | MCP 服务端口 |
| `OPENCLI_MCP_NAME` | MCP serverInfo.name |
| `OPENCLI_MCP_VERSION` | MCP serverInfo.version |
| `OPENCLI_MCP_KEY` | MCP 入站 Bearer token |
| `OPENCLI_MCP_SINGLE_CLIENT` | 单客户端兼容模式 |
| `OPENCLI_MCP_ALLOWED_HOSTS` | Host header 白名单，留空时自动生成 |
| `OPENCLI_MCP_ALLOWED_ORIGINS` | Origin 白名单，留空时自动生成 |

当前支持的后端配置：

| 配置项 | 作用 |
|---|---|
| `OPENCLI_API_BASE` | 主后端 API 地址 |
| `OPENCLI_AUTH_API_BASE` | 鉴权后端 API 地址 |
| `OPENCLI_ROUTER_API_BASE` | 路由后端 API 地址 |
| `OPENCLI_BACKEND_TOKEN` | 转发给后端的 Bearer token |
| `OPENCLI_USER_ID` | 写操作使用的用户 ID |
| `OPENCLI_USERNAME` | 查询场景等操作使用的用户名 |
| `OPENCLI_ORDINARY` | 新建场景参数 |
| `OPENCLI_DISTURB` | 新建场景参数 |

## 5. MCP HTTP 协议实现

`mcp/server.ts` 使用：

```ts
createMcpExpressApp()
StreamableHTTPServerTransport
McpServer
```

当前实现的 HTTP 入口：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/health` | 健康检查，返回服务名、版本、session 数量、单客户端状态 |
| `POST` | `/mcp` | MCP JSON-RPC 请求入口，包括 initialize、tools/list、tools/call 等 |
| `GET` | `/mcp` | MCP SSE stream |
| `DELETE` | `/mcp` | 结束 MCP session |

当前支持 MCP 标准流程：

```text
1. POST /mcp initialize
2. 服务端返回 mcp-session-id
3. 后续 POST /mcp 带 mcp-session-id
4. tools/list 发现工具
5. tools/call 调用工具
6. resources/list / resources/read 读取资源
7. prompts/list / prompts/get 获取 prompt
```

POST 请求的标准 header：

```text
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <OPENCLI_MCP_KEY>
Mcp-Session-Id: <initialize 返回的 session id>
```

兼容能力：

- 如果客户端只传 `Accept: text/event-stream`，服务层会补上 `application/json`。
- 如果客户端只传 `Accept: application/json`，服务层会补上 `text/event-stream`。
- 如果客户端传 `Accept: */*` 或没传，服务层会补成标准值。
- 如果启用 `OPENCLI_MCP_SINGLE_CLIENT=1`，initialize 后可兼容后续请求不带 `mcp-session-id` 的单客户端平台。

## 6. 鉴权和安全实现

MCP 入站鉴权：

```text
Authorization: Bearer <OPENCLI_MCP_KEY>
```

也支持：

```text
x-opencli-mcp-key: <OPENCLI_MCP_KEY>
```

鉴权失败返回 JSON-RPC 错误：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Unauthorized MCP request."
  },
  "id": null
}
```

并返回：

```text
WWW-Authenticate: Bearer realm="opencli-mcp"
```

安全相关实现：

- 使用 `createMcpExpressApp({ allowedHosts })` 校验 Host header。
- 使用 `originGuard` 校验 Origin。
- 无 Origin 的 CLI 请求允许通过。
- CORS 允许 MCP 标准 headers 和常见 Agent headers。
- 返回 `X-Content-Type-Options: nosniff`。
- 返回 `Referrer-Policy: no-referrer`。

## 7. Session 管理

当前 session 设计：

- 每次标准 `initialize` 会创建一个 `McpServer` 和一个 `StreamableHTTPServerTransport`。
- `sessions` 用 `mcp-session-id` 映射 `{ server, transport }`。
- 标准客户端必须在后续请求中带 `mcp-session-id`。
- `DELETE /mcp` 可关闭 session。
- SDK server 的 `onclose` 会触发 session 清理。

单客户端兼容模式：

```env
OPENCLI_MCP_SINGLE_CLIENT=1
```

开启后：

- 服务端记录最近初始化的唯一 session。
- 后续非 initialize 请求如果没带 `mcp-session-id`，会自动注入该 session。
- 仍然兼容标准 `mcp-session-id` 请求。

当前重要实现边界：

- `OpenCliBackendClient` 和 `OpenCliMcpExecutor` 是进程级单例。
- 多个 MCP session 当前共享同一个 executor 状态，也就是共享 `currentSessionId/currentSessionName/topoData`。
- 当前更适合本地单用户或单客户端使用。
- 如果未来要多用户并发，应该把 executor 放入 `SessionRecord`，做到每个 MCP session 独立当前场景状态。

## 8. Tools 实现

当前 tools 在 `mcp/tools.ts` 注册。所有 tools 都有：

- MCP tool name
- title
- description
- zod inputSchema
- annotations
- 统一日志包装
- 统一错误包装

tool 返回统一形态：

```ts
{
  isError: boolean,
  content: [
    {
      type: 'text',
      text: string
    }
  ]
}
```

### 8.1 Tool annotations

当前实现了 MCP 标准 annotations：

| 类型 | annotation |
|---|---|
| 只读工具 | `readOnlyHint: true` |
| 本地状态工具 | `readOnlyHint: false`, `destructiveHint: false`, `openWorldHint: false` |
| 普通写工具 | `readOnlyHint: false`, `destructiveHint: false` |
| 高风险写工具 | `destructiveHint: true` |

`opencli_run_text` 因为可能解析出删除、清空、关闭、暂停、停止等命令，所以标记为高风险。

### 8.2 只读和状态类 tools

| Tool | 功能 |
|---|---|
| `opencli_scene_list` | 查询私有、公共或全部场景列表，可按名称过滤 |
| `opencli_current_scene` | 返回 MCP 当前加载场景的 ID、名称、状态、节点数、链路数 |
| `opencli_load_scene` | 把指定场景加载到 MCP 内存状态，不改变后端仿真状态 |
| `opencli_topo_summary` | 返回当前或指定场景的拓扑摘要 |
| `opencli_topo_export` | 返回当前或指定场景的完整 topo JSON |
| `opencli_refresh_topo` | 刷新当前加载场景的拓扑数据 |
| `opencli_node_list` | 列出当前场景节点 |
| `opencli_link_list` | 列出当前场景链路 |
| `opencli_simulation_check` | 检查启动仿真前的关键状态 |

### 8.3 文本兼容 tool

| Tool | 功能 |
|---|---|
| `opencli_run_text` | 接收 OpenCLI 文本命令，复用 `src/opencli/parser.ts` 解析并执行 |

说明：

- 保留旧 OpenCLI 文本能力。
- 适合自然语言或模板化命令。
- 如果调用方已经知道明确参数，优先使用结构化 tools。

### 8.4 结构化写 tools

| Tool | 功能 |
|---|---|
| `opencli_create_scene` | 新建仿真场景 |
| `opencli_close_scene` | 关闭指定仿真场景 |
| `opencli_add_node` | 添加单个节点 |
| `opencli_add_nodes_grid` | 按网格批量创建节点，最多 30 个 |
| `opencli_add_nodes_batch` | 按名称列表批量创建节点 |
| `opencli_connect_nodes` | 连接两个节点 |
| `opencli_add_links_batch` | 批量添加链路 |
| `opencli_delete_node` | 删除单个节点 |
| `opencli_delete_nodes_batch` | 批量删除节点 |
| `opencli_delete_links_batch` | 批量删除链路 |
| `opencli_move_node` | 移动节点到指定坐标 |
| `opencli_set_node_status` | 设置节点 `UP/DOWN` 状态 |
| `opencli_clear_scene` | 清空当前场景拓扑 |
| `opencli_sample_scene` | 创建示例拓扑元素 |
| `opencli_start_simulation` | 启动当前场景仿真 |
| `opencli_pause_simulation` | 暂停当前场景仿真 |
| `opencli_stop_simulation` | 停止当前场景仿真 |

当前版本已经移除自定义 `confirmationId/opencli_confirm` 机制。写操作会直接调用后端执行；是否需要人工审批，由 Claude Code 或外部 Agent 平台根据 tool annotations 和自身策略处理。

## 9. Resources 实现

`mcp/resources.ts` 注册了固定 URI resources：

| Resource URI | 功能 |
|---|---|
| `opencli://runtime` | 返回 MCP 服务配置摘要、tools/resources/prompts 列表、后端地址等 |
| `opencli://current-scene` | 返回当前加载场景摘要 |
| `opencli://topology/summary` | 返回当前场景拓扑摘要 |
| `opencli://topology/export` | 返回当前场景完整 topo JSON |
| `opencli://workflow` | 返回推荐操作流程和安全约束 |

`resources/templates/list` 当前返回空数组。当前版本没有注册参数化 resource template。

## 10. Prompts 实现

`mcp/prompts.ts` 注册了 3 个 prompts：

| Prompt | 功能 | 参数 |
|---|---|---|
| `opencli_operator` | OpenCLI 仿真操作员流程指南 | `context` 可选 |
| `opencli_topology_planner` | 根据目标规划拓扑修改步骤 | `goal` 可选 |
| `opencli_write_safety` | 写操作前的安全检查提示 | `command` 可选 |

这些 prompts 的作用是让 Claude Code 在执行场景、拓扑、仿真操作时遵循固定流程。

## 11. Executor 实现

`mcp/opencliMcpExecutor.ts` 是业务执行核心。

当前维护的内存状态：

```ts
{
  currentSessionId: number | null,
  currentSessionName: string,
  topoData: TopoData | null
}
```

主要能力：

- 查询场景列表。
- 根据 `sessionId` 或 `name` 加载场景。
- 刷新拓扑。
- 输出当前场景摘要。
- 输出拓扑摘要。
- 输出完整 topo JSON。
- 执行文本命令。
- 执行结构化命令。
- 新建/关闭场景。
- 添加/批量添加/移动/删除节点。
- 添加/批量添加/删除链路。
- 设置节点状态。
- 清空场景。
- 创建示例场景元素。
- 启动/暂停/停止仿真。

重要实现细节：

- `loadScene()` 会调用后端获取 topo，并更新 MCP 内存状态。
- `topoSummary()` 默认使用当前加载场景，也支持传入 `sessionId` 查询指定场景。
- `createScene()` 新建成功且后端返回 ID 时，会自动刷新并加载新场景。
- `startSession()` 会先读取当前 topo，再调用后端 `/start`。
- 写操作执行后会尝试根据后端响应刷新当前 topo。
- 文本命令路径通过 `parseOpenCli()` 转成 `OpenCliCommand`，再进入同一个 `executeCommand()`。

## 12. Backend Client 实现

`mcp/backendClient.ts` 使用 axios 直连后端，不走 Vite proxy。

请求特点：

- 使用 `.env.mcp` 中的后端 base URL。
- 统一添加 `Authorization: Bearer ${OPENCLI_BACKEND_TOKEN}`。
- 使用 `OPENCLI_USER_ID`、`OPENCLI_USERNAME` 等配置构造后端请求。
- 捕获后端错误并转换成可读错误信息。

当前覆盖的后端能力：

- 查询私有/公共场景。
- 新建场景。
- 关闭场景。
- 获取 topo。
- 保存 topo。
- 添加节点。
- 删除节点。
- 更新节点。
- 启动仿真。
- 暂停仿真。
- 停止仿真。
- 获取 NEM ID。
- 启动监控相关请求。

## 13. Parser 兼容实现

`opencli_run_text` 复用：

```ts
src/opencli/parser.ts
```

这意味着 MCP 保留了原网页 OpenCLI 的文本命令兼容能力。

当前设计建议：

- 对 Agent 调用，优先使用结构化 tools。
- 对人类自然语言输入或历史命令模板，使用 `opencli_run_text`。
- `opencli_run_text` 不做大模型理解，只做当前 parser 已支持的规则解析。

## 14. 日志和调试能力

当前日志分两层：

HTTP 层日志：

```text
[OpenCLI MCP] -> POST /mcp session=<id> rpc=tools/call id=2 name=opencli_add_node args=...
[OpenCLI MCP] <- POST /mcp status=200 12ms
```

Tool 层日志：

```text
[OpenCLI MCP] tool:start opencli_add_node args=...
[OpenCLI MCP] tool:end opencli_add_node ok=true 100ms
```

错误日志：

```text
[OpenCLI MCP] tool:error <tool> <duration>ms <message>
```

健康检查：

```text
GET /health
```

返回示例：

```json
{
  "ok": true,
  "name": "opencli-mcp",
  "version": "1.0.0",
  "sessions": 1,
  "singleClient": true,
  "singleClientSession": true
}
```

## 15. Claude Code Skill

当前已经新增项目级 skill：

```text
.claude/skills/opencli-mcp-operator/SKILL.md
```

用途：

- 规定 OpenCLI MCP 的调用顺序。
- 写清每一步依赖关系。
- 说明什么时候先查场景、什么时候加载场景、什么时候验证拓扑。
- 说明高风险操作必须确认意图。
- 说明从新建场景到启动仿真的完整流程。

Claude Code 中可直接调用：

```text
/opencli-mcp-operator
```

如果当前会话看不到该 skill，重启 Claude Code。

## 16. 当前已验证事项

当前已经验证过：

- MCP server 可以启动。
- `/health` 可访问。
- 标准 `initialize` 可以返回 `mcp-session-id`。
- 标准 `tools/list` 可以返回 tools。
- tools/list 返回里包含 `annotations`、`readOnlyHint`、`destructiveHint`。
- 单客户端模式下，不带 `mcp-session-id` 的后续请求可以工作。
- 只传 `Accept: text/event-stream` 的兼容请求可以工作。
- 场景列表、加载场景、查看当前场景、拓扑摘要、添加节点、验证节点增加已经跑通过。

MCP 侧 TypeScript 检查命令：

```bash
npx tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module ESNext --target ES2022 --types node mcp/server.ts mcp/config.ts mcp/tools.ts mcp/resources.ts mcp/prompts.ts mcp/backendClient.ts mcp/opencliMcpExecutor.ts src/opencli/parser.ts src/opencli/types.ts
```

## 17. 当前边界和后续优化方向

当前边界：

- MCP executor 是进程级单例，多 session 会共享当前场景状态。
- 没有 OAuth，当前使用本地 Bearer token。
- 后端 token 由 `.env.mcp` 提供，MCP 不解析 JWT。
- `opencli_run_text` 仍然是规则 parser，不是网页端大模型自然语言理解。
- 写操作已经移除自定义确认机制，会直接调用后端；审批交给 Claude Code 或 Agent 平台。
- `resources/templates/list` 当前为空。
- tool result 当前主要返回文本，没有为每个 tool 单独定义 outputSchema。

后续优化方向：

- 每个 MCP session 持有独立 executor，支持真正多客户端并发。
- 为高价值 tools 增加结构化 `outputSchema` 和 `structuredContent`。
- 增加 resource templates，例如 `opencli://scene/{sessionId}/summary`。
- 把后端无鉴权场景配置成 token 可选。
- 增加更完整的自动化测试脚本。
- 继续扩展结构化 tools，减少对 `opencli_run_text` 的依赖。
- 在 Agent 平台审批策略中利用 tool annotations 区分只读、普通写、破坏性写。

