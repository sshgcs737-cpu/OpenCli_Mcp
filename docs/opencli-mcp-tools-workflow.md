# OpenCLI MCP Tools 与流程 Skill

本文档整理当前 OpenCLI MCP 已提供的工具能力，以及推荐给 Claude Code 或其他 MCP 客户端遵循的操作流程。

## 1. 当前定位

当前 OpenCLI MCP 已经实现了一个可用闭环：

```text
发现 MCP 能力
  -> 查询场景
  -> 加载场景
  -> 查看拓扑
  -> 提交 OpenCLI 命令
  -> 写操作直接执行
  -> 验证执行结果
```

MCP Server 运行在本地 Node 进程中，通过后端 API 操作仿真系统，不依赖浏览器页面状态。

## 2. Discovery 兼容情况

当前已兼容 MCP discovery 阶段常见请求：

```text
initialize
tools/list
resources/list
resources/templates/list
prompts/list
```

支持单客户端兼容模式：

```env
OPENCLI_MCP_SINGLE_CLIENT=1
```

开启后：

- `initialize` 后，后续请求即使不带 `mcp-session-id` 也可以继续使用唯一 session。
- 支持只发送 `Accept: text/event-stream` 的 POST 请求。
- 仍然兼容标准客户端显式传 `mcp-session-id`。

当前业务能力主要集中在 `tools`，同时已经正式注册 `resources` 和 `prompts`：

- `resources/list` 会返回 OpenCLI runtime、当前场景、拓扑摘要、拓扑导出和流程说明等资源。
- `resources/templates/list` 当前返回空数组，因为还没有注册参数化 resource template。
- `prompts/list` 会返回 OpenCLI 操作员、拓扑规划和写操作安全检查提示模板。

## 3. 当前 MCP Tools

| Tool | 类型 | 作用 | 是否写后端 |
|---|---|---|---|
| `opencli_scene_list` | 场景发现 | 查询私有、公共或全部场景 | 否 |
| `opencli_current_scene` | 当前状态 | 查看 MCP 当前加载的场景状态 | 否 |
| `opencli_load_scene` | 场景加载 | 把指定场景加载到 MCP Server 内存状态 | 否 |
| `opencli_topo_summary` | 拓扑摘要 | 查看当前或指定场景的节点、链路、状态摘要 | 否 |
| `opencli_topo_export` | 拓扑导出 | 返回完整 topo JSON | 否 |
| `opencli_run_text` | 文本命令入口 | 运行 OpenCLI 文本命令 | 写命令直接执行 |
| `opencli_refresh_topo` | 拓扑刷新 | 刷新当前场景拓扑 | 否 |
| `opencli_node_list` | 节点列表 | 列出当前场景节点 | 否 |
| `opencli_link_list` | 链路列表 | 列出当前场景链路 | 否 |
| `opencli_simulation_check` | 仿真检查 | 检查启动仿真前状态 | 否 |
| `opencli_create_scene` | 场景写操作 | 按参数新建场景 | 是 |
| `opencli_close_scene` | 场景写操作 | 按 `sessionId/name` 关闭场景 | 是 |
| `opencli_add_node` | 节点写操作 | 按 `nodeType/name/lat/lon/alt/role` 添加单节点 | 是 |
| `opencli_add_nodes_grid` | 节点写操作 | 按网格批量生成节点 | 是 |
| `opencli_add_nodes_batch` | 节点写操作 | 按名称列表批量添加节点 | 是 |
| `opencli_connect_nodes` | 链路写操作 | 按 `from/to/linkType` 连接两个节点 | 是 |
| `opencli_add_links_batch` | 链路写操作 | 按节点对列表批量添加链路 | 是 |
| `opencli_delete_node` | 节点写操作 | 删除单个节点 | 是 |
| `opencli_delete_nodes_batch` | 节点写操作 | 批量删除节点 | 是 |
| `opencli_delete_links_batch` | 链路写操作 | 批量删除链路 | 是 |
| `opencli_move_node` | 节点写操作 | 按 `target/lat/lon/alt` 移动节点 | 是 |
| `opencli_set_node_status` | 节点写操作 | 设置节点 `UP/DOWN` 状态 | 是 |
| `opencli_clear_scene` | 场景写操作 | 清空当前场景拓扑 | 是 |
| `opencli_sample_scene` | 示例写操作 | 创建示例拓扑元素 | 是 |
| `opencli_start_simulation` | 仿真写操作 | 启动当前场景仿真 | 是 |
| `opencli_pause_simulation` | 仿真写操作 | 暂停当前场景仿真 | 是 |
| `opencli_stop_simulation` | 仿真写操作 | 停止当前场景仿真 | 是 |

### 当前 MCP Resources

| Resource URI | 作用 | MIME |
|---|---|---|
| `opencli://runtime` | MCP 运行配置、兼容模式、已注册 tools/resources/prompts 摘要 | `application/json` |
| `opencli://current-scene` | 当前加载场景状态摘要 | `application/json` |
| `opencli://topology/summary` | 当前加载场景的拓扑摘要 | `application/json` |
| `opencli://topology/export` | 当前加载场景的完整 topo JSON | `application/json` |
| `opencli://workflow` | OpenCLI MCP 推荐流程和安全约束 | `text/plain` |

### 当前 MCP Prompts

| Prompt | 作用 | 参数 |
|---|---|---|
| `opencli_operator` | OpenCLI 仿真操作员流程指南 | `context` 可选 |
| `opencli_topology_planner` | 根据目标规划拓扑修改步骤 | `goal` 可选 |
| `opencli_write_safety` | 写操作前的安全检查清单 | `command` 可选 |

## 4. Tool 说明

### `opencli_scene_list`

查询场景列表。

参数：

```json
{
  "scope": "all",
  "name": "可选场景名过滤"
}
```

`scope` 可选值：

```text
private
public
all
```

推荐用途：

- 第一步查找可操作场景。
- 按 `name` 缩小场景范围。

### `opencli_load_scene`

加载场景到 MCP Server 的内存状态。

参数：

```json
{
  "sessionId": 764
}
```

或：

```json
{
  "name": "场景名称"
}
```

注意：

- 这个操作不会改变后端仿真状态。
- 它只是告诉 MCP Server 后续默认操作哪个场景。
- 操作拓扑前应先调用它。

### `opencli_current_scene`

查看 MCP Server 当前加载的场景。

返回内容通常包括：

```text
当前场景名称
ID
状态
节点数
链路数
```

如果还没有加载场景，会提示先调用 `opencli_load_scene`。

### `opencli_topo_summary`

查看拓扑摘要。

参数：

```json
{
  "sessionId": 764
}
```

`sessionId` 可选。不传则使用当前加载场景。

推荐用途：

- 操作前理解拓扑。
- 写操作后验证结果。
- 平时优先使用它，而不是直接导出完整 JSON。

### `opencli_topo_export`

导出完整 topo JSON。

推荐用途：

- 需要完整节点、链路、接口、坐标等结构时使用。
- 不建议每次都调用，因为完整 JSON 可能较大。

### `opencli_run_text`

运行 OpenCLI 文本命令，适合作为自然语言/模板兼容入口。

参数：

```json
{
  "input": "查看节点"
}
```

只读命令会直接执行，写命令也会直接调用后端执行。

如果客户端已经知道明确参数，优先使用结构化 tools，例如：

```json
{
  "tool": "opencli_add_node",
  "arguments": {
    "nodeType": "DRONE",
    "name": "DRONE_MCP",
    "lat": 30.523,
    "lon": 114.364,
    "alt": 300
  }
}
```

结构化写操作会直接执行。删除、清空、关闭、暂停、停止等高风险操作调用前，需要由调用方确认影响范围。

## 5. 推荐流程 Skill

### Skill：OpenCLI 仿真操作流程

目标：让 MCP 客户端安全、稳定地操作 OpenCLI 仿真系统。

推荐流程：

```text
1. 发现能力
   initialize
   tools/list
   resources/list
   resources/templates/list
   prompts/list

2. 选择场景
   opencli_scene_list
   opencli_load_scene

3. 理解当前拓扑
   opencli_current_scene
   opencli_topo_summary
   必要时 opencli_topo_export

4. 执行只读命令
   opencli_node_list
   opencli_link_list
   opencli_simulation_check
   或 opencli_run_text("查看节点")

5. 执行写命令
   优先使用 opencli_add_node / opencli_connect_nodes / opencli_move_node 等结构化 tools
   兼容入口可使用 opencli_run_text("添加无人机 名为 DRONE1 在 30.523,114.364,300")
   写操作会直接执行

6. 验证结果
   opencli_topo_summary
```

## 6. 推荐给 Claude Code 的操作原则

### 原则 1：先加载场景，再操作拓扑

推荐顺序：

```text
opencli_scene_list
opencli_load_scene
opencli_topo_summary
```

不要在未加载场景时直接添加、删除或连接节点。

### 原则 2：写操作会直接执行

写操作流程：

```text
结构化写 tool 或 opencli_run_text
  -> 直接调用后端执行
opencli_topo_summary
  -> 验证结果
```

删除、清空、关闭、暂停、停止等高风险操作前，需要明确说明影响范围。

### 原则 3：执行后必须验证

添加节点后：

```text
opencli_topo_summary
```

删除节点后：

```text
opencli_topo_summary
```

启动、暂停或停止仿真后：

```text
opencli_current_scene
opencli_topo_summary
```

### 原则 4：优先摘要，必要时导出完整 topo

平时使用：

```text
opencli_topo_summary
```

只有需要完整结构时才使用：

```text
opencli_topo_export
```

### 原则 5：高风险操作要明确说明影响

高风险操作包括：

```text
关闭场景
清空拓扑
删除节点
批量删除节点
删除链路
暂停仿真
停止仿真
```

执行这类操作前，应先说明将影响哪些场景、节点、链路或仿真状态。

## 7. 常用 OpenCLI 文本命令

查看类：

```text
查看节点
查看链路
当前场景
刷新拓扑
仿真检查
```

场景类：

```text
列出场景
加载场景 764
新建场景 名为 MCP_TEST
关闭场景 764
```

节点类：

```text
添加无人机 名为 DRONE_MCP 在 30.523,114.364,300
add drone name DRONE_MCP position 30.523,114.364,300
添加路由器 名为 ROUTER1 在 30.523,114.365,100
生成 3 个无人机 在 30.523,114.364,300
移动 DRONE_MCP 到 lat=30.524 lon=114.365 alt=320
删除 DRONE_MCP
```

链路类：

```text
连接 DRONE1 EMANE1
connect DRONE1 to EMANE1
批量连接 DRONE1-EMANE1 DRONE2-EMANE1
删除链路 DRONE1-EMANE1
```

仿真类：

```text
启动仿真 时长=300
暂停仿真
停止仿真
```

## 8. 典型完整示例

目标：加载场景 764，并添加一架无人机。

### 第一步：加载场景

调用：

```text
opencli_load_scene
```

参数：

```json
{
  "sessionId": 764
}
```

### 第二步：查看当前拓扑

调用：

```text
opencli_topo_summary
```

### 第三步：执行写命令

调用：

```text
opencli_add_node
```

参数：

```json
{
  "nodeType": "DRONE",
  "name": "DRONE_MCP",
  "lat": 30.523,
  "lon": 114.364,
  "alt": 300
}
```

也可以用兼容文本入口：

```text
opencli_run_text("add drone name DRONE_MCP position 30.523,114.364,300")
```

写操作会直接执行。

### 第四步：验证

调用：

```text
opencli_topo_summary
```

期望看到：

```text
DRONE_MCP type=DRONE geo=(30.523, 114.364, 300)
```

## 9. 当前能力边界

当前已经能做：

- 场景发现
- 场景加载
- 当前场景状态查看
- 拓扑摘要
- 完整 topo 导出
- MCP resources 注册和读取
- MCP prompts 注册和获取
- 参数化结构化 tools 调用
- OpenCLI 文本命令解析
- 写操作直接执行
- 添加、删除、移动节点
- 添加、删除链路
- 启动、暂停、停止仿真相关调用

当前还没有做：

- 每个 MCP session 独立 executor。
- 使用 `X-Agent-User-Authorization` 覆盖后端 token。
- 网页端与 MCP 状态实时同步。
- MCP 内部大模型自然语言解析。

## 10. 给 MCP 客户端的简短操作说明

可以把下面这段作为客户端操作约束：

```text
你正在通过 OpenCLI MCP 操作仿真系统。

操作前必须先调用 opencli_scene_list 和 opencli_load_scene 选择场景。
理解拓扑时优先调用 opencli_topo_summary。
只有需要完整 JSON 时才调用 opencli_topo_export。
只读命令优先使用 opencli_node_list、opencli_link_list、opencli_simulation_check 等结构化 tools，也可通过 opencli_run_text 兼容执行。
写操作优先使用 opencli_add_node、opencli_connect_nodes、opencli_move_node 等结构化 tools，也可通过 opencli_run_text 兼容提交。
写操作执行后必须再次调用 opencli_topo_summary 验证结果。
删除、清空、关闭、暂停、停止等高风险操作前，需要明确说明影响范围。
```
