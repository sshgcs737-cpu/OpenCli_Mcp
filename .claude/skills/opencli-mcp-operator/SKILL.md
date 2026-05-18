---
name: opencli-mcp-operator
description: Use when operating OpenCLI through the opencli MCP server: create or load simulation scenes, inspect topology, add/move/delete nodes and links, start/pause/stop simulation, and verify dependent steps in order.
---

# OpenCLI MCP Operator

Use this skill to operate the OpenCLI simulation system through MCP tools. Treat the MCP tools as the source of truth. Do not invent scene IDs, node IDs, node names, link endpoints, topology state, or simulation state.

Prefer structured MCP tools over `opencli_run_text`. Use `opencli_run_text` only when the user gives an existing OpenCLI text command or a natural-language command that has no suitable structured tool.

## Critical Rules

1. Always establish the target scene before topology or simulation work.
2. Always inspect current state before writing.
3. Always verify state after each write operation.
4. Never connect, move, delete, or change status of a node before confirming that the node exists.
5. Never start simulation before checking scene status and topology with `opencli_simulation_check`.
6. Never call high-risk destructive tools without explicit user intent or explicit user approval.
7. If a tool returns `isError: true`, stop the current chain, explain the blocker, and choose the smallest safe recovery step.

High-risk destructive tools:

- `opencli_close_scene`
- `opencli_delete_node`
- `opencli_delete_nodes_batch`
- `opencli_delete_links_batch`
- `opencli_set_node_status`
- `opencli_clear_scene`
- `opencli_pause_simulation`
- `opencli_stop_simulation`
- `opencli_run_text` when the text might delete, clear, close, pause, stop, or change status

## Dependency Map

Use this dependency order unless the user explicitly asks for a narrower read-only query.

```text
MCP available
  -> scene chosen or created
  -> scene loaded in MCP memory
  -> current scene verified
  -> topology summarized
  -> optional full export only if needed
  -> write operation
  -> refresh or summarize topology
  -> simulation check
  -> simulation start/pause/stop if requested
  -> final verification
```

Tool-level dependencies:

- `opencli_scene_list`: no scene dependency. Use first when choosing an existing scene.
- `opencli_create_scene`: requires backend user config. Creates a backend scene and usually loads it into MCP memory when the backend returns an ID.
- `opencli_load_scene`: requires a known `sessionId` or resolvable `name`. Loads scene into MCP memory but does not start or change simulation state.
- `opencli_current_scene`: requires loaded scene. Use after load/create and after simulation state changes.
- `opencli_topo_summary`: requires loaded scene unless a `sessionId` is provided. Use before and after writes.
- `opencli_topo_export`: requires loaded scene unless a `sessionId` is provided. Use only when summary is not enough.
- `opencli_refresh_topo`: requires loaded scene. Use after a write if the writing tool's response is ambiguous.
- `opencli_node_list`: requires loaded scene. Use before node-specific writes if summary is stale or too terse.
- `opencli_link_list`: requires loaded scene. Use before link-specific writes if summary is stale or too terse.
- `opencli_add_node`: requires loaded scene.
- `opencli_add_nodes_grid`: requires loaded scene.
- `opencli_add_nodes_batch`: requires loaded scene.
- `opencli_connect_nodes`: requires loaded scene and both endpoint nodes to exist.
- `opencli_add_links_batch`: requires loaded scene and all endpoint nodes to exist.
- `opencli_move_node`: requires loaded scene and target node to exist.
- `opencli_set_node_status`: requires loaded scene, target node to exist, and explicit intent to change availability.
- `opencli_delete_node`: requires loaded scene, target node to exist, and explicit destructive intent.
- `opencli_delete_nodes_batch`: requires loaded scene, all targets to exist, and explicit destructive intent.
- `opencli_delete_links_batch`: requires loaded scene, target links to exist, and explicit destructive intent.
- `opencli_clear_scene`: requires loaded scene and explicit destructive intent to remove all topology.
- `opencli_sample_scene`: requires loaded scene.
- `opencli_simulation_check`: requires loaded scene. Use before `opencli_start_simulation`.
- `opencli_start_simulation`: requires loaded scene and a recent successful `opencli_simulation_check`.
- `opencli_pause_simulation`: requires loaded scene and explicit intent to pause.
- `opencli_stop_simulation`: requires loaded scene and explicit intent to stop.

## Standard Workflow For Existing Scene

Use this when the user wants to operate an existing scene.

1. Find candidate scenes.

   Call `opencli_scene_list`.

   Use arguments:

   ```json
   {
     "scope": "all",
     "name": "optional name filter"
   }
   ```

   Purpose: discover real scene IDs, names, visibility, update time, and state.

   Next dependency: choose one exact scene. If multiple scenes match the user's description, ask the user to choose or use the newest exact match only when the user clearly implied it.

2. Load the chosen scene.

   Call `opencli_load_scene`.

   Prefer `sessionId` over `name`:

   ```json
   {
     "sessionId": 764
   }
   ```

   Purpose: set MCP server memory so later tools know which scene is current.

   Next dependency: verify the loaded scene.

3. Verify current scene.

   Call `opencli_current_scene`.

   Purpose: confirm the scene ID, name, state, node count, and link count that MCP remembers.

   If this says no scene is loaded, call `opencli_load_scene` again with the intended `sessionId`.

4. Inspect topology baseline.

   Call `opencli_topo_summary`.

   Purpose: get current nodes, links, status, and coordinates before any changes.

   If the task requires exact full topology fields not visible in the summary, call `opencli_topo_export`. Otherwise avoid full export.

5. Execute the requested operation.

   Choose the most specific structured tool. Do not use `opencli_run_text` when a structured tool exists.

6. Verify result.

   Call `opencli_topo_summary` after every topology write.

   Use `opencli_current_scene` after scene-level or simulation-level writes.

   Report the final state using actual tool output.

## Standard Workflow For New Scene

Use this when the user asks to create a new scene from scratch.

1. Create the scene.

   Call `opencli_create_scene`.

   Example:

   ```json
   {
     "name": "test-mcp-01"
   }
   ```

   Purpose: create a backend simulation scene. If the backend returns a scene ID, the MCP executor loads the new scene automatically.

   If the tool returns `未查询到该用户`, stop and tell the user to check `OPENCLI_USER_ID` and `OPENCLI_USERNAME` in `.env.mcp`.

2. Confirm the new scene is loaded.

   Call `opencli_current_scene`.

   Purpose: verify the new scene ID and name. Do not proceed to add topology until this succeeds.

   If current scene is missing, call `opencli_scene_list` with the new name, then call `opencli_load_scene` with the returned `sessionId`.

3. Inspect empty or initial topology.

   Call `opencli_topo_summary`.

   Purpose: establish baseline node/link counts.

4. Add initial topology.

   For a single node, call `opencli_add_node`.

   Example:

   ```json
   {
     "nodeType": "DRONE",
     "name": "DRONE_01",
     "lat": 30.523,
     "lon": 114.364,
     "alt": 300,
     "role": 1
   }
   ```

   For many named nodes, call `opencli_add_nodes_batch`.

   For a grid, call `opencli_add_nodes_grid`.

   Purpose: create nodes in the loaded scene.

5. Verify nodes.

   Call `opencli_topo_summary`.

   Confirm each expected node appears before linking, moving, deleting, or starting simulation.

6. Add links only after endpoints exist.

   Call `opencli_connect_nodes` for one link or `opencli_add_links_batch` for many links.

   Example:

   ```json
   {
     "from": "DRONE_01",
     "to": "BASE_01",
     "linkType": "WIRELESS"
   }
   ```

   Purpose: connect existing nodes.

7. Verify links.

   Call `opencli_topo_summary` or `opencli_link_list`.

   Confirm expected links exist before starting simulation.

8. Check simulation readiness.

   Call `opencli_simulation_check`.

   Purpose: detect missing topology, invalid scene state, or other start blockers.

   Do not call `opencli_start_simulation` if the check fails.

9. Start simulation only if requested.

   Call `opencli_start_simulation`.

   Example:

   ```json
   {
     "duration": 3600
   }
   ```

   Purpose: start backend simulation for the loaded scene. Values up to `86400` are treated as seconds by the executor.

10. Verify simulation state.

    Call `opencli_current_scene`, then call `opencli_topo_summary` if topology status matters.

    Report the scene ID, state, node count, and any important warnings.

## Operation-Specific Procedures

### Add A Node

1. Ensure a scene is loaded with `opencli_current_scene`.
2. Inspect existing nodes with `opencli_topo_summary`.
3. If the requested name already exists, ask whether to reuse, rename, or skip.
4. Call `opencli_add_node`.
5. Call `opencli_topo_summary`.
6. Report the created node name, ID if returned, type, and coordinates.

### Add Multiple Nodes

1. Ensure a scene is loaded.
2. Inspect current node names to avoid collisions.
3. Use `opencli_add_nodes_batch` when names are specified.
4. Use `opencli_add_nodes_grid` when the user asks for a count around a center point.
5. Keep batch size within tool schema limits.
6. Verify with `opencli_topo_summary`.

### Connect Nodes

1. Ensure a scene is loaded.
2. Call `opencli_topo_summary` or `opencli_node_list`.
3. Confirm both endpoints exist.
4. If a matching link already exists, do not duplicate it unless the user explicitly requests another link.
5. Call `opencli_connect_nodes` or `opencli_add_links_batch`.
6. Verify with `opencli_link_list` or `opencli_topo_summary`.

### Move A Node

1. Ensure a scene is loaded.
2. Confirm target node exists.
3. Confirm the target coordinates are explicit. If latitude or longitude is missing, ask for it.
4. Call `opencli_move_node`.
5. Verify with `opencli_topo_summary`.

### Delete Nodes Or Links

1. Ensure a scene is loaded.
2. Inspect current topology.
3. Identify exact targets by name or ID from tool output.
4. Explain the destructive effect.
5. Ask for explicit approval unless the user's latest instruction already explicitly says to delete those exact targets.
6. Call the delete tool.
7. Verify with `opencli_topo_summary`.

### Clear Or Close A Scene

1. Ensure the exact target scene ID and name are known.
2. Explain the effect:
   - `opencli_clear_scene` removes topology from the loaded scene.
   - `opencli_close_scene` closes a backend scene.
3. Ask for explicit approval unless already given in the latest user request.
4. Call the tool.
5. Verify with `opencli_current_scene` or `opencli_scene_list`.

### Start Simulation

1. Ensure a scene is loaded.
2. Call `opencli_current_scene`.
3. Call `opencli_topo_summary`.
4. Call `opencli_simulation_check`.
5. If the check reports blockers, stop and explain them.
6. Call `opencli_start_simulation` only when the user requested start and readiness check passed.
7. Call `opencli_current_scene`.
8. Report the final state and duration.

### Pause Or Stop Simulation

1. Ensure a scene is loaded.
2. Call `opencli_current_scene`.
3. Explain whether this is pause or stop.
4. Ask for explicit approval unless the user's latest request directly asks to pause or stop.
5. Call `opencli_pause_simulation` or `opencli_stop_simulation`.
6. Verify with `opencli_current_scene`.

## Error Handling

Use exact error messages from tool output. Do not hide backend failures.

Common errors and recovery:

- `当前 MCP server 没有加载场景`: call `opencli_scene_list`, then `opencli_load_scene`.
- `未查询到该用户`: tell the user to check `.env.mcp` values `OPENCLI_USER_ID` and `OPENCLI_USERNAME`; do not retry writes blindly.
- Backend 401 or unauthorized: tell the user to check `OPENCLI_BACKEND_TOKEN`.
- Connection timeout or refused: tell the user to verify backend API base addresses and backend processes.
- Scene not found by name: call `opencli_scene_list` with a narrower or broader `name` filter.
- Node target not found: call `opencli_node_list` and ask the user to choose an exact target.
- Link target not found: call `opencli_link_list` and ask for exact endpoints.
- Start simulation fails: run `opencli_simulation_check` again and report blockers.

If a write partially succeeds or returns ambiguous output, call `opencli_refresh_topo`, then `opencli_topo_summary`.

## Reporting Format

Keep responses short but grounded in tool results.

After a successful workflow, report:

- scene ID and scene name
- operation performed
- key changed entities
- verification result
- next safe action if relevant

After a blocked workflow, report:

- the exact step that failed
- the tool error text
- what dependency is missing
- the next command or user input needed to continue

## Full Example: New Scene To Simulation Start

Use this exact dependency order for a from-scratch test:

1. `opencli_create_scene` with `{ "name": "test-mcp-01" }`.
2. `opencli_current_scene` to verify the new scene is loaded.
3. `opencli_topo_summary` to establish baseline.
4. `opencli_add_node` for the first required node.
5. `opencli_topo_summary` to verify the first node.
6. `opencli_add_node` or batch tool for remaining nodes.
7. `opencli_topo_summary` to verify all nodes.
8. `opencli_connect_nodes` or `opencli_add_links_batch` only after endpoint nodes are confirmed.
9. `opencli_topo_summary` or `opencli_link_list` to verify links.
10. `opencli_simulation_check`.
11. `opencli_start_simulation` if the check succeeds and the user requested start.
12. `opencli_current_scene` to verify simulation state.

Do not skip verification steps, because later steps depend on the state created by earlier steps.

