# OpenCLI MCP 接入 Claude Code 当前说明

本文档记录当前 OpenCLI MCP 的架构、Claude Code 接入方式、协议兼容点、工具能力和测试流程。

## 1. 当前架构

```text
Claude Code
  -> Streamable HTTP MCP (/mcp)
  -> 本地 Node MCP Server
  -> OpenCLI 后端 API
  -> 场景、拓扑、仿真状态
```

MCP Server 是独立 Node 进程，不嵌入浏览器页面，也不依赖 Pinia、router、Vite proxy 或浏览器登录态。它只复用前端侧的纯逻辑：

- `src/opencli/parser.ts`
- `src/opencli/types.ts`

后端 API 调用在 Node 侧重新实现：

- `mcp/backendClient.ts`
- `mcp/opencliMcpExecutor.ts`

MCP Server 自己维护当前加载场景的内存状态。操作拓扑前需要先调用 `opencli_load_scene`。

## 2. Claude Code 标准接入

启动 MCP Server：

```bash
npm run mcp
```

Claude Code 添加 HTTP MCP：

```bash
claude mcp add --transport http opencli http://127.0.0.1:8787/mcp \
  --header "Authorization: Bearer local-dev-key"
```

如果监听地址改成局域网地址，例如 `10.16.39.51:8787`：

```bash
claude mcp add --transport http opencli http://10.16.39.51:8787/mcp \
  --header "Authorization: Bearer local-dev-key"
```

`.mcp.json` 写法：

```json
{
  "mcpServers": {
    "opencli": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp",
      "headers": {
        "Authorization": "Bearer local-dev-key"
      }
    }
  }
}
```

其中 `"type": "http"` 是 Claude Code 推荐写法，等价于 Streamable HTTP。

## 3. 协议兼容点

当前 `/mcp` 使用 MCP TypeScript SDK 的 Streamable HTTP transport，支持：

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `resources/templates/list`
- `prompts/list`
- `prompts/get`
- `GET /mcp` SSE stream
- `DELETE /mcp` session 结束

标准客户端流程：

```text
POST /mcp initialize
<- response header: mcp-session-id

POST /mcp tools/list
header: mcp-session-id: <id>

POST /mcp tools/call
header: mcp-session-id: <id>
```

MCP Streamable HTTP 对 POST 请求要求：

```text
Content-Type: application/json
Accept: application/json, text/event-stream
```

为了兼容部分平台只传 `Accept: text/event-stream` 或 `Accept: application/json`，服务层会自动补齐缺失的 Accept 值。

如果设置：

```env
OPENCLI_MCP_SINGLE_CLIENT=1
```

则开启单客户端兼容模式：`initialize` 后，后续请求即使不带 `mcp-session-id`，也会自动落到唯一 MCP session。标准 Claude Code 客户端仍然会正常携带 `mcp-session-id`。

## 4. 鉴权和安全

MCP 入站鉴权：

```text
Authorization: Bearer <OPENCLI_MCP_KEY>
```

也兼容：

```text
x-opencli-mcp-key: <OPENCLI_MCP_KEY>
```

后端出站鉴权：

```text
Authorization: Bearer <OPENCLI_BACKEND_TOKEN>
```

MCP Server 自己不解析 JWT，也不校验 JWT 签名。它只检查 MCP 入站 token，并把后端 token 转发给后端。

当前 HTTP 层还做了：

- Host header 白名单，防 DNS rebinding。
- Origin 白名单；无 Origin 的 CLI 请求允许通过。
- CORS 允许 MCP 标准 headers 和常见 Agent headers。
- 401 响应带 `WWW-Authenticate: Bearer realm="opencli-mcp"`。

相关配置：

```env
OPENCLI_MCP_HOST=127.0.0.1
OPENCLI_MCP_PORT=8787
OPENCLI_MCP_NAME=opencli-mcp
OPENCLI_MCP_VERSION=1.0.0
OPENCLI_MCP_KEY=local-dev-key
OPENCLI_MCP_SINGLE_CLIENT=0
OPENCLI_MCP_ALLOWED_HOSTS=
OPENCLI_MCP_ALLOWED_ORIGINS=
```

`OPENCLI_MCP_ALLOWED_HOSTS` 和 `OPENCLI_MCP_ALLOWED_ORIGINS` 留空时，会自动允许 `localhost`、`127.0.0.1`、`::1` 和 `OPENCLI_MCP_HOST` 对应地址。

## 5. 当前 Tools

只读/状态类：

- `opencli_scene_list`
- `opencli_current_scene`
- `opencli_load_scene`
- `opencli_topo_summary`
- `opencli_topo_export`
- `opencli_refresh_topo`
- `opencli_node_list`
- `opencli_link_list`
- `opencli_simulation_check`

文本兼容入口：

- `opencli_run_text`

结构化写操作：

- `opencli_create_scene`
- `opencli_close_scene`
- `opencli_add_node`
- `opencli_add_nodes_grid`
- `opencli_add_nodes_batch`
- `opencli_connect_nodes`
- `opencli_add_links_batch`
- `opencli_delete_node`
- `opencli_delete_nodes_batch`
- `opencli_delete_links_batch`
- `opencli_move_node`
- `opencli_set_node_status`
- `opencli_clear_scene`
- `opencli_sample_scene`
- `opencli_start_simulation`
- `opencli_pause_simulation`
- `opencli_stop_simulation`

当前已经给 tools 注册 MCP 标准 annotations：

- 只读工具：`readOnlyHint: true`
- 普通写工具：`destructiveHint: false`
- 删除、清空、关闭、暂停、停止等高风险工具：`destructiveHint: true`
- `opencli_run_text` 因为可能解析出删除/停止等命令，按高风险工具标注

确认机制说明：当前项目已经移除自定义 `confirmationId/opencli_confirm` 流程。写操作会直接调用后端执行；是否需要人工审批，由 Claude Code 或外部 Agent 平台根据 tool annotations 和自身策略处理。

## 6. 当前 Resources

- `opencli://runtime`
- `opencli://current-scene`
- `opencli://topology/summary`
- `opencli://topology/export`
- `opencli://workflow`

`resources/templates/list` 当前返回空数组，这是合法响应。

## 7. 当前 Prompts

- `opencli_operator`
- `opencli_topology_planner`
- `opencli_write_safety`

这些 prompt 用来指导 Claude Code 按“列场景 -> 加载场景 -> 查看拓扑 -> 执行操作 -> 验证结果”的流程操作。

## 8. 推荐操作流程

```text
1. initialize
2. tools/list
3. resources/list / prompts/list
4. opencli_scene_list
5. opencli_load_scene
6. opencli_current_scene
7. opencli_topo_summary
8. 执行结构化 tool，例如 opencli_add_node
9. 再次 opencli_topo_summary 验证结果
10. opencli_simulation_check
11. opencli_start_simulation
12. 再次 opencli_current_scene 或 opencli_topo_summary 验证状态
```

优先使用结构化 tools。只有用户输入是自然语言或旧 OpenCLI 文本时，再使用 `opencli_run_text`。

## 9. 手动测试最小流程

初始化并拿 session：

```powershell
$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "initialize"
  params = @{
    protocolVersion = "2025-03-26"
    capabilities = @{}
    clientInfo = @{
      name = "manual-test"
      version = "1.0.0"
    }
  }
} | ConvertTo-Json -Depth 10

$response = Invoke-WebRequest `
  -Uri "http://127.0.0.1:8787/mcp" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer local-dev-key"
    Accept = "application/json, text/event-stream"
  } `
  -ContentType "application/json; charset=utf-8" `
  -Body $body

$sessionId = $response.Headers["mcp-session-id"]
```

列 tools：

```powershell
$toolsBody = @{
  jsonrpc = "2.0"
  id = 2
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 10

Invoke-WebRequest `
  -Uri "http://127.0.0.1:8787/mcp" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer local-dev-key"
    Accept = "application/json, text/event-stream"
    "mcp-session-id" = $sessionId
  } `
  -ContentType "application/json; charset=utf-8" `
  -Body $toolsBody
```

加载场景：

```powershell
$loadBody = @{
  jsonrpc = "2.0"
  id = 3
  method = "tools/call"
  params = @{
    name = "opencli_load_scene"
    arguments = @{
      sessionId = 764
    }
  }
} | ConvertTo-Json -Depth 10
```

添加节点：

```powershell
$addBody = @{
  jsonrpc = "2.0"
  id = 4
  method = "tools/call"
  params = @{
    name = "opencli_add_node"
    arguments = @{
      nodeType = "DRONE"
      name = "DRONE_MCP"
      lat = 30.523
      lon = 114.364
      alt = 300
    }
  }
} | ConvertTo-Json -Depth 10
```

添加后调用 `opencli_topo_summary` 验证节点是否出现。

## 10. 关键文件

- `mcp/server.ts`：HTTP MCP Server、session、鉴权、Host/Origin/Accept 兼容。
- `mcp/config.ts`：读取 `.env.mcp`，生成后端和 MCP 运行配置。
- `mcp/tools.ts`：注册 MCP tools、参数 schema、tool annotations。
- `mcp/resources.ts`：注册 MCP resources。
- `mcp/prompts.ts`：注册 MCP prompts。
- `mcp/backendClient.ts`：Node 侧后端 API client。
- `mcp/opencliMcpExecutor.ts`：MCP 命令执行器，维护当前场景和拓扑状态。
- `src/opencli/parser.ts`：兼容文本命令解析。
- `src/opencli/types.ts`：OpenCLI 命令和结果类型。
