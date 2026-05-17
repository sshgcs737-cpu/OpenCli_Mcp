# OpenCLI MCP 接入 Claude Code 学习文档

本文档整理了从 MCP 方案开始到当前验证完成的全部内容，包含设计目标、运行方式、鉴权方式、工具能力、测试流程，以及 MCP 相关代码文件逐个讲解。

当前第一版已经验证通过：

- MCP HTTP 服务可以启动并创建 session。
- Claude Code 或手动 HTTP 请求可以列出 MCP tools。
- MCP 可以连接后端并列出场景。
- MCP 可以加载场景到自己的内存状态。
- MCP 可以读取拓扑摘要。
- `opencli_run_text` 对写操作会先返回 `confirmationId`。
- `opencli_confirm` 可以确认并真正写入后端。
- 已测试成功添加节点 `DRONE_MCP`，拓扑摘要里节点数从 1 变为 2。

## 1. 背景和目标

项目原本有浏览器端 OpenCLI，主要运行在 Vue 前端里，依赖这些浏览器侧能力：

- Pinia store
- Vue Router
- Vite proxy
- 浏览器登录态
- 页面里的拓扑状态

现在的目标是让 Claude Code 通过 MCP 直接控制当前仿真系统。Claude Code 不应该嵌入浏览器页面，也不应该依赖浏览器登录态，所以新增了一个独立的 Node HTTP MCP Server。

最终链路是：

```text
Claude Code
  -> Streamable HTTP MCP
  -> 本地 Node MCP Server
  -> 后端 API
  -> 场景、拓扑、仿真状态
```

这个 MCP Server 与前端页面是两个入口：

- 前端 OpenCLI：给网页用户使用。
- MCP OpenCLI：给 Claude Code 使用。

两者可以操作同一个后端场景，但各自维护自己的当前场景状态。MCP 侧需要先调用 `opencli_load_scene`，让 MCP server 记住当前操作哪个场景。

## 2. 为什么不直接复用 `remoteTopoActions.ts`

`src/opencli/remoteTopoActions.ts` 更适合浏览器前端，因为它耦合了前端运行环境：

- 依赖 Pinia 状态。
- 依赖 router 和页面跳转。
- 依赖 Vite proxy。
- 依赖浏览器本地登录态。

MCP Server 是一个独立 Node 进程，不能假设这些浏览器能力存在。因此 MCP 侧只复用纯逻辑：

- `src/opencli/parser.ts`
- `src/opencli/types.ts`

然后在 `mcp/backendClient.ts` 里重新实现 Node-safe 的后端 API 调用。

## 3. 新增依赖和脚本

`package.json` 新增了 MCP 运行需要的依赖：

```json
{
  "@modelcontextprotocol/sdk": "^1.29.0",
  "zod": "^4.4.3",
  "express": "^5.2.1",
  "cors": "^2.8.6",
  "dotenv": "^17.4.2"
}
```

新增开发依赖：

```json
{
  "tsx": "^4.21.0",
  "@types/express": "^5.0.6",
  "@types/cors": "^2.8.19"
}
```

新增脚本：

```json
{
  "mcp": "tsx mcp/server.ts",
  "mcp:dev": "tsx watch mcp/server.ts"
}
```

常用启动命令：

```bash
npm run mcp
```

开发时如果希望自动监听文件变化：

```bash
npm run mcp:dev
```

## 4. 配置文件

新增了 `.env.mcp.example`，用于说明 MCP Server 需要的环境变量。

实际运行时要创建 `.env.mcp`。`.env.mcp` 已加入 `.gitignore`，不要提交真实 token。

示例：

```env
OPENCLI_MCP_HOST=127.0.0.1
OPENCLI_MCP_PORT=8787
OPENCLI_MCP_KEY=local-dev-key
OPENCLI_MCP_SINGLE_CLIENT=1

OPENCLI_API_BASE=http://10.16.65.106:7777
OPENCLI_AUTH_API_BASE=http://10.16.65.106:7776
OPENCLI_ROUTER_API_BASE=http://10.16.65.106:7780

OPENCLI_BACKEND_TOKEN=
OPENCLI_USER_ID=
OPENCLI_USERNAME=
OPENCLI_ORDINARY=1
OPENCLI_DISTURB=0
```

变量含义：

- `OPENCLI_MCP_HOST`：MCP 服务监听地址，本地使用 `127.0.0.1`。
- `OPENCLI_MCP_PORT`：MCP 服务端口，默认 `8787`。
- `OPENCLI_MCP_KEY`：Claude Code 访问 MCP Server 的本地密钥。
- `OPENCLI_MCP_SINGLE_CLIENT`：单客户端兼容模式。`1` 表示 initialize 后，即使后续请求不带 `mcp-session-id`，也会自动落到唯一 MCP session。
- `OPENCLI_API_BASE`：仿真主后端 API 地址。
- `OPENCLI_AUTH_API_BASE`：鉴权后端地址，第一版暂未大量使用。
- `OPENCLI_ROUTER_API_BASE`：路由相关后端地址，第一版暂未大量使用。
- `OPENCLI_BACKEND_TOKEN`：转发给后端 API 的 Bearer token。
- `OPENCLI_USER_ID`：写操作需要的用户 ID。
- `OPENCLI_USERNAME`：用户名称，部分场景列表接口会用到。
- `OPENCLI_ORDINARY`：场景类型参数，当前一般填 `1`。
- `OPENCLI_DISTURB`：新建场景时的扰动参数，当前一般填 `0`。

如果后端没有做鉴权，当前代码仍要求 `OPENCLI_BACKEND_TOKEN` 非空，可以填一个占位值，例如 `local-dev-token`。因为当前实现会统一加上：

```text
Authorization: Bearer ${OPENCLI_BACKEND_TOKEN}
```

如果未来要更贴合“后端无鉴权”的部署，可以把 `backendClient.ts` 改成 token 为空时不添加 Authorization header。

## 5. 鉴权设计

这里有两层鉴权。

第一层是 MCP 入站鉴权：

```text
Claude Code -> MCP Server
```

由 `OPENCLI_MCP_KEY` 控制。请求需要带：

```text
Authorization: Bearer local-dev-key
```

也支持：

```text
x-opencli-mcp-key: local-dev-key
```

如果没有带正确 header，访问 `/mcp` 会返回：

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

浏览器直接打开 `http://127.0.0.1:8787/mcp` 时没有 header，所以看到 Unauthorized 是正常的。

第二层是后端出站鉴权：

```text
MCP Server -> 后端 API
```

`mcp/backendClient.ts` 会把 `OPENCLI_BACKEND_TOKEN` 加到后端请求头：

```text
Authorization: Bearer <OPENCLI_BACKEND_TOKEN>
```

当前 MCP Server 自己不解析 JWT，也不校验 JWT 签名。它只负责转发 token。

## 6. Claude Code 连接方式

命令行方式：

```bash
claude mcp add --transport http opencli http://127.0.0.1:8787/mcp \
  --header "Authorization: Bearer local-dev-key"
```

如果使用图形界面里的“连接至自定义 MCP”，按下面填写：

```text
名称：opencli
类型：流式 HTTP
URL：http://127.0.0.1:8787/mcp
Bearer 令牌环境变量：留空
标头：
  键：Authorization
  值：Bearer local-dev-key
来自环境变量的标头：留空
```

`local-dev-key` 要和 `.env.mcp` 里的 `OPENCLI_MCP_KEY` 一致。

## 7. MCP Tools

第一版提供 8 个工具。

### `opencli_scene_list`

列出场景。

参数：

```json
{
  "scope": "private | public | all",
  "name": "可选，按名称过滤"
}
```

行为：

- 直接执行。
- 查询后端私有场景和公共场景。
- 最多返回前 30 条文本摘要，避免 Claude Code 输出过长。

### `opencli_current_scene`

查看 MCP Server 当前记住的场景。

行为：

- 不读取浏览器页面状态。
- 读取 MCP Server 内存里的 `currentSessionId/currentSessionName/topoData`。
- 如果没调用过 `opencli_load_scene`，会提示先加载场景。

### `opencli_load_scene`

加载指定场景到 MCP Server 内存状态。

参数：

```json
{
  "sessionId": 764
}
```

或：

```json
{
  "name": "场景名"
}
```

行为：

- 直接执行。
- 调后端 `/topo` 拉取拓扑。
- 只改变 MCP Server 自己的内存状态。
- 不会启动、停止或改变后端仿真状态。

### `opencli_topo_summary`

返回当前或指定场景的拓扑摘要。

参数：

```json
{
  "sessionId": 764
}
```

`sessionId` 可选，不传则使用当前加载场景。

返回内容包括：

- 场景 ID
- 场景状态
- 子网数量
- 节点数量
- 链路数量
- 节点摘要
- 链路摘要

### `opencli_topo_export`

返回完整 topo JSON。

这是唯一适合返回完整拓扑的工具。其他工具都尽量短输出，避免 Claude Code 上下文被大量 JSON 占满。

### `opencli_run_text`

运行 OpenCLI 文本命令。

参数：

```json
{
  "input": "添加无人机 名为 DRONE_MCP 在 30.523,114.364,300"
}
```

它会复用 `src/opencli/parser.ts` 解析文本。

只读命令会直接执行，例如：

```text
查看节点
查看链路
当前场景
刷新拓扑
导出
仿真检查
```

写命令不会立即执行，而是返回确认项，例如：

```json
{
  "requiresConfirmation": true,
  "confirmationId": "47b69ded-a2b2-4be4-bca9-7eb3f2adbe58",
  "summary": "添加节点：DRONE_MCP (DRONE)",
  "riskLevel": "medium",
  "expiresAt": "2026-05-14T15:21:19.342Z"
}
```

### `opencli_confirm`

确认并执行一个待确认写操作。

参数：

```json
{
  "confirmationId": "47b69ded-a2b2-4be4-bca9-7eb3f2adbe58"
}
```

执行成功后，才会真正调用后端写接口。

### `opencli_pending_actions`

查看当前还没确认的写操作列表。

确认项默认 10 分钟过期。

## 8. 写操作确认流程

第一版把所有写操作都做成两步：

1. `opencli_run_text` 识别到写命令，只生成确认项。
2. `opencli_confirm` 收到 `confirmationId` 后，才真正调用后端。

写操作包括：

- 新建场景
- 关闭场景
- 添加节点
- 批量添加节点
- 删除节点
- 批量删除节点
- 移动节点
- 修改节点状态
- 添加链路
- 删除链路
- 清空拓扑
- 创建示例场景
- 启动仿真
- 暂停仿真
- 停止仿真

风险等级：

- `medium`：添加、移动、启动等可控写操作。
- `high`：删除、清空、关闭、暂停、停止等破坏性或运行态操作。

## 9. 目录和文件总览

新增或改动的 MCP 相关文件：

```text
mcp/server.ts
mcp/config.ts
mcp/backendClient.ts
mcp/opencliMcpExecutor.ts
mcp/confirmationStore.ts
mcp/tools.ts
.env.mcp.example
package.json
package-lock.json
tsconfig.node.json
.gitignore
```

复用的前端 OpenCLI 文件：

```text
src/opencli/parser.ts
src/opencli/types.ts
src/types/topo.ts
```

## 10. `mcp/server.ts`

职责：启动 MCP HTTP 服务。

主要做了几件事：

1. 创建 Express app。
2. 挂载 `/health`。
3. 挂载 `/mcp` 的 `POST/GET/DELETE`。
4. 使用 MCP SDK 的 `StreamableHTTPServerTransport`。
5. 为每个 MCP session 维护一个 transport。
6. 校验入站 Authorization header。
7. 注册 OpenCLI tools。

核心对象：

```ts
const backend = new OpenCliBackendClient();
const confirmations = new ConfirmationStore();
const executor = new OpenCliMcpExecutor(backend, confirmations);
const sessions = new Map<string, SessionRecord>();
```

这里有一个重要设计：`backend`、`confirmations`、`executor` 是 MCP Server 进程级单例。也就是说当前第一版所有 MCP session 共用同一个 OpenCLI executor 状态。

这对本地单用户 Claude Code 使用是可以接受的。未来如果要多用户并发，可以把 executor 也放进 `SessionRecord`，做到每个 MCP session 独立状态。

`/health`：

```text
GET http://127.0.0.1:8787/health
```

返回：

```json
{
  "ok": true,
  "name": "opencli-mcp",
  "sessions": 0
}
```

`sessions` 是当前 MCP 协议 session 数，不是后端场景数。看到 0 不代表 MCP 坏了，只表示当前没有活跃 MCP session。

`POST /mcp`：

- 没有 `mcp-session-id` 时，只接受 `initialize` 请求。
- 初始化成功后，响应头会返回 `mcp-session-id`。
- 后续 tools 调用必须带同一个 `mcp-session-id`。

如果开启 `OPENCLI_MCP_SINGLE_CLIENT=1`：

- `initialize` 仍然正常创建 session。
- 后续 discovery 或 tool 请求即使没有 `mcp-session-id`，MCP Server 也会自动补到唯一 session。
- 仍然兼容标准客户端显式传 `mcp-session-id`。
- 同时兼容只发送 `Accept: text/event-stream` 的 POST 请求，服务端会补齐 SDK 需要的 `application/json`。

`GET /mcp` 和 `DELETE /mcp`：

- 给 Streamable HTTP transport 使用。
- 必须带有效 `mcp-session-id`。
- 单客户端模式下，如果没有 `mcp-session-id`，也会尝试使用当前唯一 session。

## 11. `mcp/config.ts`

职责：读取和校验 MCP 环境配置。

加载顺序：

```ts
dotenv.config({ path: '.env.mcp' });
dotenv.config();
```

这表示优先加载 `.env.mcp`，再加载普通 `.env`。

导出的 `config` 包含：

- MCP host/port/key
- 后端 API 地址
- 后端 token
- 用户 ID
- 用户名
- ordinary/disturb 参数

两个强校验函数：

```ts
requireBackendToken()
requireUserId()
```

当前含义：

- 后端 token 为空时，MCP 写读后端会报清晰错误。
- 用户 ID 为空时，写操作会报清晰错误。

注意：当前 `backendClient.ts` 在创建 axios client 时会调用 `requireBackendToken()`，所以即使后端无鉴权，也需要在 `.env.mcp` 里填一个非空占位 token。

## 12. `mcp/backendClient.ts`

职责：Node 侧后端 API client。

它不走 Vite proxy，不依赖浏览器 cookie，而是直接访问：

```text
OPENCLI_API_BASE
```

axios client 初始化时会设置：

```text
baseURL = config.apiBase
Authorization = Bearer <OPENCLI_BACKEND_TOKEN>
Content-Type = application/json
```

主要接口：

- `listScenes(options)`：查询私有/公共场景列表。
- `createScene(name)`：新建场景。
- `closeScene(sessionId)`：关闭或清理场景。
- `getTopo(sessionId)`：获取拓扑。
- `addNode(nodeData, sessionId, userId)`：添加节点。
- `editNode(nodeData, sessionId, userId)`：编辑节点。
- `deleteNode(sessionId, nodeId, userId)`：删除节点。
- `addLink(linkData, sessionId, userId)`：添加链路。
- `deleteLink(linkData, sessionId, userId)`：删除链路。
- `startSession(sessionId, userId, servers, duration)`：启动仿真。
- `pauseSession(sessionId, userId, containerList)`：暂停仿真。
- `stopSession(sessionId)`：停止仿真。
- `startBroker(params, sessionId)`：启动监控。
- `stopBroker(sessionId)`：停止监控。
- `getNemIds(sessionId)`：获取 NEM ID。

错误处理：

- `normalizeAxiosError()` 会把 axios 错误转成更容易读的 Error。
- 如果后端返回 401，会提示后端 token 可能无效。
- 如果后端超时或端口不可达，会显示类似 `connect ETIMEDOUT 10.16.65.106:7777`。

## 13. `mcp/confirmationStore.ts`

职责：管理待确认写操作。

核心数据结构：

```ts
Map<string, PendingAction>
```

`PendingAction` 包含：

- `confirmationId`
- `command`
- `summary`
- `riskLevel`
- `createdAt`
- `expiresAt`

核心方法：

- `create(command, summary, riskLevel)`：创建确认项。
- `list()`：列出未过期确认项。
- `consume(confirmationId)`：取出并删除确认项。
- `pruneExpired()`：清理过期项。

默认过期时间：

```text
10 分钟
```

`consume()` 是一次性的。确认成功或失败后，该确认项都会从 store 里被取出。这样可以避免重复执行同一个写操作。

## 14. `mcp/tools.ts`

职责：把 executor 的方法注册成 MCP tools。

它做两层转换：

第一层是 zod schema：

```ts
inputSchema: {
  sessionId: z.number().int().positive().optional()
}
```

这样 Claude Code 能知道每个 tool 需要什么参数。

第二层是 OpenCLI result 到 MCP result：

```ts
function toToolResult(result: OpenCliResult): CallToolResult
```

OpenCLI 内部结果：

```ts
{
  ok: boolean;
  message: string;
  data?: unknown;
}
```

转换成 MCP 工具结果：

```ts
{
  isError: !result.ok,
  content: [{ type: 'text', text: result.message }]
}
```

这样 Claude Code 看到的是简洁文本，而不是内部对象。

## 15. `mcp/opencliMcpExecutor.ts`

职责：MCP 侧 OpenCLI 执行器，是这一版的核心文件。

它连接了三部分：

```text
parser.ts
  -> OpenCliCommand
  -> OpenCliMcpExecutor
  -> backendClient.ts
```

### 15.1 内存状态

```ts
interface ExecutorState {
  currentSessionId: number | null;
  currentSessionName: string;
  topoData: TopoData | null;
}
```

这就是 MCP Server 记住的当前场景状态。

调用 `opencli_load_scene` 后：

- `currentSessionId` 更新成加载的场景 ID。
- `currentSessionName` 更新成场景名。
- `topoData` 保存后端返回的 topo。

### 15.2 拓扑响应标准化

后端不同接口可能返回不同嵌套结构，例如：

```text
data
data.data
data.topo
topo
topology
result.data
```

`normalizeTopoResponse()` 会尝试从这些位置找出真正的 topo，并保证：

```ts
nodes: []
links: []
```

即使后端没返回数组，也会标准化为空数组。

### 15.3 摘要函数

这些函数负责把大对象压成短文本：

- `summarizeScenes()`
- `summarizeNodes()`
- `summarizeLinks()`

这样 Claude Code 平时拿到的是短摘要，而不是完整 JSON。

### 15.4 读写命令分类

`isWriteCommand()` 判断某个 `OpenCliCommand` 是否会改变后端状态。

只读命令直接执行：

- `help`
- `listScenes`
- `currentScene`
- `refreshTopo`
- `listNodes`
- `listLinks`
- `exportScene`
- `simulationCheck`

写命令进入确认流程：

- `addNode`
- `deleteNode`
- `connectNodes`
- `startSession`
- `stopSession`
- 等等

### 15.5 风险等级

`riskLevel()` 根据命令类型返回：

- `medium`
- `high`

高风险包括：

- 关闭场景
- 清空场景
- 删除节点
- 删除链路
- 暂停仿真
- 停止仿真

### 15.6 命令摘要

`commandSummary()` 用来生成确认提示，例如：

```text
添加节点：DRONE_MCP (DRONE)
批量添加 3 个 DRONE 节点：DRONE1, DRONE2, DRONE3
停止当前仿真
```

### 15.7 `runText(input)`

流程：

```text
输入文本
  -> parseOpenCli(input)
  -> OpenCliCommand
  -> executeCommand(command, confirmed=false)
```

如果是只读命令，直接执行。

如果是写命令，创建确认项并返回：

```json
{
  "requiresConfirmation": true,
  "confirmationId": "...",
  "summary": "...",
  "riskLevel": "medium",
  "expiresAt": "..."
}
```

### 15.8 `confirm(confirmationId)`

流程：

```text
confirmationStore.consume(id)
  -> 取出原始 OpenCliCommand
  -> executeCommand(command, confirmed=true)
  -> 真正调用后端
```

### 15.9 节点创建

`makeNodeData()` 根据命令生成后端节点对象。

会处理：

- 下一个可用 node id
- 节点名称和别名
- 经纬高
- 节点类型
- 节点角色
- 默认服务器
- 后端需要的 type/model/image

节点类型映射由 `toBackendNodeType()` 处理，例如：

- `DRONE` -> `type=DRONE, model=prouter`
- `BASESTATION` -> `type=BASESTATION, model=prouter`
- `EMANE` -> `type=EMANE, model=emane`
- `DOCKER` -> `type=DOCKER, model=docker`

### 15.10 链路创建

链路相关 helper：

- `findNode()`
- `findLinkBetween()`
- `getNodeInterfaces()`
- `getNextAvailableId()`
- `createIface()`
- `determineLinkType()`
- `makeLinkData()`

`determineLinkType()` 会根据节点类型判断默认链路类型：

- 任一端是 EMANE：默认无线。
- 任一端是 DRONE：默认无线。
- 否则默认有线，除非命令指定无线。

### 15.11 仿真启动、暂停、停止

启动前会做一些整理：

- 检查当前是否已加载 topo。
- 计算 docker 容器名。
- 根据 topo 里的 server 信息组织启动参数。
- 调用后端 start。
- 启动 broker。

暂停：

- 根据 docker 节点生成 container list。
- 调后端 pause。

停止：

- 调后端 stop。
- 停止 broker。

## 16. `src/opencli/parser.ts`

职责：把用户文本解析成结构化命令。

输入：

```text
添加无人机 名为 DRONE_MCP 在 30.523,114.364,300
```

输出：

```json
{
  "kind": "addNode",
  "nodeType": "DRONE",
  "name": "DRONE_MCP",
  "lat": 30.523,
  "lon": 114.364,
  "alt": 300
}
```

它不是大模型理解，而是规则解析。大致流程：

1. `normalize()` 清理空格和标点。
2. 通过正则识别场景、节点、链路、仿真命令。
3. 用 helper 提取参数：
   - `parseNodeType()`
   - `parseRole()`
   - `parseName()`
   - `parseSceneId()`
   - `parsePosition()`
   - `parseTwoTargets()`
   - `parseBatchNodeNames()`
   - `parseLinkPairs()`
4. 返回 `OpenCliCommand`。

当前支持中英文混合模板，例如：

```text
查看节点
list nodes
加载场景 764
load scene 764
添加无人机 名为 DRONE1 在 30.523,114.364,300
add drone name DRONE1 position 30.523,114.364,300
连接 DRONE1 EMANE1
connect DRONE1 to EMANE1
启动仿真 时长=300
start session duration=300
```

接入 Claude Code 后，Claude Code 可以把自然语言转成更接近这些模板的命令，所以用户不一定要手工输入很严格的模板。

## 17. `src/opencli/types.ts`

职责：定义 OpenCLI parser 和 executor 之间的结构化协议。

核心类型：

```ts
export type OpenCliCommand = ...
```

它是一组 discriminated union，每个命令都有 `kind` 字段。

例如：

```ts
{ kind: 'listScenes'; scope?: 'private' | 'public' | 'all'; name?: string }
{ kind: 'loadScene'; sessionId?: number; name?: string }
{ kind: 'addNode'; nodeType: OpenCliNodeType; name?: string; lat?: number; lon?: number; alt?: number }
{ kind: 'connectNodes'; from: string; to: string; linkType?: 'WIRED' | 'WIRELESS' }
```

`parser.ts` 只负责把文本变成这些对象。

`opencliMcpExecutor.ts` 负责执行这些对象。

这种分层让前端 OpenCLI 和 MCP OpenCLI 可以共享同一套命令语义。

## 18. `src/types/topo.ts`

职责：定义拓扑数据结构。

MCP 中主要使用：

- `TopoData`
- `Node`
- `Link`
- `NodeIface`
- `LinkOptions`

这些类型让 MCP executor 能用项目已有拓扑结构组织节点、链路、接口和地理坐标。

## 19. `tsconfig.node.json`

MCP Server 是 Node 侧 TypeScript，不是浏览器侧 Vue 代码，所以 `tsconfig.node.json` 做了补充：

```json
{
  "types": ["node"],
  "include": ["vite.config.ts", "mcp/**/*.ts"]
}
```

这样可以让 TypeScript 识别 Node API，例如：

- `node:crypto`
- `process`
- Node 环境类型

验证命令：

```bash
npx tsc -p tsconfig.node.json --noEmit
```

## 20. 手动测试流程

### 20.1 检查后端端口

```powershell
Test-NetConnection 10.16.65.106 -Port 7777
```

成功时：

```text
TcpTestSucceeded : True
```

如果是 `False`，说明 MCP Server 即使启动了，也无法连接后端。

### 20.2 启动 MCP Server

```powershell
npm run mcp
```

应该看到类似：

```text
[OpenCLI MCP] Listening on http://127.0.0.1:8787/mcp
[OpenCLI MCP] MCP key auth is enabled.
```

### 20.3 健康检查

浏览器打开：

```text
http://127.0.0.1:8787/health
```

返回：

```json
{"ok":true,"name":"opencli-mcp","sessions":0}
```

### 20.4 initialize

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
$sessionId
```

关键是拿到：

```text
mcp-session-id
```

后续所有 tools 调用都要带这个 header。

### 20.5 查看工具列表

```powershell
$toolsBody = @{
  jsonrpc = "2.0"
  id = 2
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 10

$toolsResponse = Invoke-WebRequest `
  -Uri "http://127.0.0.1:8787/mcp" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer local-dev-key"
    Accept = "application/json, text/event-stream"
    "mcp-session-id" = $sessionId
  } `
  -ContentType "application/json; charset=utf-8" `
  -Body $toolsBody

$toolsResponse.Content
```

应该看到 8 个工具。

### 20.6 列场景

```powershell
$sceneBody = @{
  jsonrpc = "2.0"
  id = 3
  method = "tools/call"
  params = @{
    name = "opencli_scene_list"
    arguments = @{
      scope = "all"
    }
  }
} | ConvertTo-Json -Depth 10
```

发送方式同上。

我们已验证返回了类似：

```text
#764 111 [公共] state=DEFINITION updated=2026-05-13...
```

PowerShell 里中文可能乱码，但结构正常即可。

### 20.7 加载场景

```powershell
$loadBody = @{
  jsonrpc = "2.0"
  id = 4
  method = "tools/call"
  params = @{
    name = "opencli_load_scene"
    arguments = @{
      sessionId = 764
    }
  }
} | ConvertTo-Json -Depth 10
```

我们已验证加载成功：

```text
已加载场景：场景764，ID=764，节点 1 个，链路 0 条
```

### 20.8 当前场景

```powershell
$currentBody = @{
  jsonrpc = "2.0"
  id = 5
  method = "tools/call"
  params = @{
    name = "opencli_current_scene"
    arguments = @{}
  }
} | ConvertTo-Json -Depth 10
```

我们已验证：

```text
当前场景：场景764
ID=764
状态=DEFINITION
节点=1
链路=0
```

### 20.9 写操作生成确认项

建议 PowerShell 手动测试时先用英文命令，避免终端中文编码干扰：

```powershell
$writeBody = @{
  jsonrpc = "2.0"
  id = 6
  method = "tools/call"
  params = @{
    name = "opencli_run_text"
    arguments = @{
      input = "add drone name DRONE_MCP position 30.523,114.364,300"
    }
  }
} | ConvertTo-Json -Depth 10
```

已验证返回：

```json
{
  "requiresConfirmation": true,
  "confirmationId": "47b69ded-a2b2-4be4-bca9-7eb3f2adbe58",
  "summary": "添加节点：DRONE_MCP (DRONE)",
  "riskLevel": "medium",
  "expiresAt": "2026-05-14T15:21:19.342Z"
}
```

### 20.10 确认写操作

```powershell
$confirmBody = @{
  jsonrpc = "2.0"
  id = 7
  method = "tools/call"
  params = @{
    name = "opencli_confirm"
    arguments = @{
      confirmationId = "47b69ded-a2b2-4be4-bca9-7eb3f2adbe58"
    }
  }
} | ConvertTo-Json -Depth 10
```

已验证成功：

```text
已确认并执行：添加节点：DRONE_MCP (DRONE)
已创建节点：DRONE_MCP，ID=2
```

### 20.11 拓扑摘要验证

```powershell
$summaryBody = @{
  jsonrpc = "2.0"
  id = 8
  method = "tools/call"
  params = @{
    name = "opencli_topo_summary"
    arguments = @{}
  }
} | ConvertTo-Json -Depth 10
```

已验证返回里有：

```text
场景：场景764 (ID=764)
状态：DEFINITION
子网=1，节点=1，链路=0

节点摘要：
#1 测试链1 type=EMANE status=UP geo=(40.720036, -74.032455, 0)
#2 DRONE_MCP type=DRONE status=UP geo=(30.523, 114.364, 300)
```

注意这里的“子网=1，节点=1”表示：

- EMANE 子网 1 个。
- 普通节点 1 个。
- topo 总 nodes 数组里有 2 个对象。

## 21. 常见问题

### 21.1 浏览器打开 `/mcp` 显示 Unauthorized

正常。浏览器没有带 Authorization header。

应该用 Claude Code 或 PowerShell 带 header 调用：

```text
Authorization: Bearer local-dev-key
```

### 21.2 `/health` 一直显示 `sessions: 0`

不一定是问题。

`sessions` 表示 MCP 协议 session 数，不是后端场景数。只有完成 initialize 并保持 session 时，它才会增加。

### 21.3 `Not Acceptable: Client must accept both application/json and text/event-stream`

请求头缺少 Accept。

PowerShell 里要加：

```powershell
Accept = "application/json, text/event-stream"
```

### 21.4 `connect ETIMEDOUT 10.16.65.106:7777`

MCP Server 通了，但后端主 API 不通。

检查：

```powershell
Test-NetConnection 10.16.65.106 -Port 7777
```

如果失败，检查 `.env.mcp` 里的 `OPENCLI_API_BASE` 是否是当前后端地址，以及后端是否启动。

### 21.5 `当前 MCP server 没有加载场景`

正常。先调用：

```text
opencli_load_scene
```

MCP 不会自动读取浏览器页面当前在哪个场景。

### 21.6 写命令返回 `暂时无法识别这条命令`

可能原因：

- 输入文本不符合 `parser.ts` 当前规则。
- MCP server 进程还在跑旧代码，需要 Ctrl+C 后重启 `npm run mcp`。
- PowerShell 中文编码影响了请求体。

手动测试时可以用英文：

```text
add drone name DRONE_MCP position 30.523,114.364,300
```

Claude Code 使用时一般不会受 PowerShell 中文编码影响。

### 21.7 PowerShell 输出中文乱码

这只是终端编码显示问题，不代表 MCP 或后端坏了。

判断是否成功主要看：

- `isError: false`
- 是否返回 `confirmationId`
- 是否返回节点 ID
- topo summary 里是否出现目标节点

如果想改善显示，可以在 PowerShell 里设置 UTF-8：

```powershell
chcp 65001
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

## 22. 当前能力边界

第一版 MCP 已能完成：

- 场景列表
- 加载场景
- 当前场景状态
- 拓扑摘要
- 完整 topo 导出
- MCP resources 注册和读取
- MCP prompts 注册和获取
- 参数化结构化 tools 调用
- 文本命令解析
- 写操作确认
- 节点和链路操作
- 仿真启动、暂停、停止相关调用

暂时没有做：

- OAuth。
- 多用户隔离。
- MCP 状态和浏览器页面状态实时同步。
- 在网页端直接接入 Claude 或其他 LLM。
- LLM 自然语言理解内置到 MCP Server。

当前自然语言理解主要由 Claude Code 完成。MCP 的 `opencli_run_text` 仍然复用规则 parser。

## 23. 后续优化方向

可以考虑逐步增强：

1. 后端无鉴权模式  
   `OPENCLI_BACKEND_TOKEN` 为空时不加 Authorization header。

2. 每个 MCP session 独立 executor  
   避免多个 Claude Code 会话共享同一个当前场景。

3. 更细的 tool schema  
   例如单独增加 `opencli_add_node`、`opencli_connect_nodes`，让 Claude Code 不必总通过文本 parser。

4. 更强的自然语言解析  
   在 MCP Server 内部接 LLM，把自然语言转成 `OpenCliCommand`。

5. 前端同步刷新  
   MCP 写后端成功后，前端页面可以通过轮询、WebSocket 或手动刷新看到变化。

6. 更完整的测试  
   为 `parser.ts`、`opencliMcpExecutor.ts`、`backendClient.ts` 增加单元测试和 mock 后端测试。

## 24. 给网页版 GPT 的学习提示词

可以把这份文档发给网页版 GPT，然后这样问：

```text
请基于这份文档，帮我按“架构、MCP 协议、鉴权、工具注册、命令解析、确认流程、后端调用”七个部分讲解这个 OpenCLI MCP 实现。请假设我是前端开发，正在学习 Node MCP Server。
```

也可以进一步问：

```text
请逐个解释 mcp/server.ts、mcp/tools.ts、mcp/opencliMcpExecutor.ts、mcp/backendClient.ts 的职责和调用链，并画出一次“添加无人机”的完整时序。
```

或者：

```text
请帮我评审这个 MCP 方案的风险点，包括安全、状态管理、并发、错误处理、测试覆盖，以及后续重构建议。
```
