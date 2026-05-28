---
name: opencli-mcp-operator
description: Use when an Agent operates OpenCLI through MCP and needs the common operating rules, tool selection principles, dependency order, result handling, and safety constraints before using scene, topology, or simulation-specific OpenCLI MCP skills.
---

# OpenCLI MCP Operator

Use OpenCLI MCP tools as the source of truth. Do not invent scene IDs, node IDs, node names, link endpoints, topology state, or simulation state.

Prefer structured MCP tools over `opencli_run_text`. Use `opencli_run_text` only when the user gives an existing OpenCLI text command or no structured tool fits.

## MCP Surfaces

- Tools execute reads, local-state changes, writes, and destructive actions.
- Resources provide read-only context and catalogs. Use `opencli://capabilities` when tool grouping matters.
- Prompts provide workflow guidance only; they do not execute anything.
- Call only tool names currently exposed by the MCP client. Do not invent `runtime_status`, `agent_open`, `tool_catalog`, or `mcp_<server>_<tool>` names from registered tool names.

## Core Rules

1. Establish the target scene before topology or simulation work.
2. Inspect current state before every write.
3. Verify state after every write.
4. Confirm nodes and links exist before connecting, moving, deleting, or changing status.
5. Run `opencli_simulation_check` before `opencli_start_simulation`.
6. Do not call destructive tools without explicit user intent or approval.
7. If a tool returns `isError: true`, stop the chain, report the blocker, and choose the smallest recovery step.
8. Prefer `structuredContent` over parsing text when present.

## Skill Split

Use the narrower skill that matches the task:

- `opencli-mcp-scene`: choose, create, load, inspect, close, or switch scenes.
- `opencli-mcp-topology`: inspect or change nodes, links, positions, status, or clear topology.
- `opencli-mcp-node-config`: discover or change frontend node configuration fields, including alias/status/role/server/services, VM settings, protocol settings, TDMA slots, and EMANE parameters.
- `opencli-mcp-simulation`: check readiness, start, pause, stop, and verify simulation lifecycle.

## Tool Result Contract

Read tool results in this order:

1. `isError`
2. `structuredContent.ok`
3. `structuredContent.data`
4. `structuredContent.data.verification`
5. `content[0].text`

If `structuredContent.requiresUserInput=true`, stop all write calls. If it has `requiresFormTool=true`, call the named option-read tool next and show that result to the user; write tools no longer carry full configuration forms. Do not treat repeated user requests or `useDefaultConfig/configConfirmed` style fields as confirmation.

If an option-read tool returns `optionReadResult=true`, show the choices from `structuredContent.configForm` and stop. Do not replace it with a filled template such as `drone1: name=...`, `subnet1: name=...`, or `link-...: from=...`.

`requiresUserInput=true` can be returned with `isError=true`. Treat that as an intentional MCP pause for user configuration, not as a backend failure.

For creation flows, read frontend options before writing: `opencli_read_node_creation_options`, `opencli_read_subnet_creation_options`, `opencli_read_link_creation_options`, or `opencli_read_composite_creation_options`. `configRequestId` is mandatory on the next write and must come from one of those option-read tools; IDs from a short write-tool blocker do not authorize writes. The write tool must receive structured `userSelections` that includes the user's actual choices. If the user accepts frontend prefilled values, pass those values explicitly; never pass only "use defaults". Protocol checkboxes may be returned as `enableZebra/enableOSPF/enableOLSR/enableBGP/enableRIP`; MCP maps them to backend `config_services`.

For composite creation forms, keep all entities under the same `configRequestId` and preserve each `clientId`. Use batch node tools only for same-type node groups; write mixed node/subnet composites entity by entity with `opencli_add_node`. For `opencli_add_links_batch`, include every returned `pairs[].clientId` or a `userSelections.links` entry with that `clientId`.

For subnet creation, honor `nextConfigStage`: first show the full link-layer/physical-layer option table from `opencli_read_subnet_creation_options`, then call `opencli_read_subnet_creation_options` again with `configStage=subnet-parameters` and the user's `emaneModel/phyType` before writing the subnet.

For write operations, use `structuredContent.data.verification` when available. It normally contains `sessionId`, `sceneName`, `state`, `nodeCount`, and `linkCount`.

Call a read tool after a write when entity-level confirmation is needed, the operation is destructive, or structured verification is missing or ambiguous.

## Dependency Order

Follow this order unless the user asks for a narrower read-only query:

```text
MCP tools/resources available
  -> optional opencli://capabilities when choosing tool category
  -> call only tools exposed in the current client tool list
  -> scene discovered or created
  -> scene loaded
  -> current scene verified
  -> topology inspected
  -> node config schema inspected if changing frontend node fields
  -> write operation if requested
  -> write verified
  -> simulation check if starting simulation
  -> simulation lifecycle action if requested
  -> final verification
```

## Delete Or Clear Tools

Treat only delete/clear operations as high risk:

- `opencli_delete_node`
- `opencli_delete_nodes_batch`
- `opencli_delete_links_batch`
- `opencli_clear_scene`
- `opencli_run_text` when the text might delete or clear data

`opencli_close_scene`, `opencli_pause_simulation`, `opencli_stop_simulation`, `opencli_set_node_status`, and `opencli_update_node_config(status=...)` are normal write tools. They still require clear user intent and verification, but they are not marked destructive.

Ask for explicit approval on delete/clear operations unless the user's latest instruction already names the exact action and target.

## Error Handling

Use exact tool error text. Do not hide backend failures.

Common recovery:

- No loaded scene: call `opencli_scene_list`, then `opencli_load_scene`.
- Missing user config: ask the user to check `OPENCLI_USER_ID` and `OPENCLI_USERNAME`.
- Backend unauthorized: ask the user to check `OPENCLI_BACKEND_TOKEN`.
- Scene not found: call `opencli_scene_list` with a broader or narrower name filter.
- Node not found: call `opencli_node_list` and ask for an exact target.
- Link not found: call `opencli_link_list` and ask for exact endpoints.
- Ambiguous write result: call `opencli_refresh_topo`, then `opencli_topo_summary`.

## Reporting

Keep responses short and grounded in tool output.

For success, report the scene ID/name, operation, changed entities, and verification result.

For blockers, report the failed step, exact tool error, missing dependency, and the next safe action.

