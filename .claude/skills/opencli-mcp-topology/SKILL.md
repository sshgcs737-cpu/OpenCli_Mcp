---
name: opencli-mcp-topology
description: Use when an Agent inspects or edits OpenCLI topology through MCP: list nodes or links, add nodes, batch-create nodes, connect nodes, batch-create links, move nodes, set node status, delete nodes or links, clear topology, create sample topology, or hand off to node config tools for frontend node fields.
---

# OpenCLI MCP Topology

Use this skill for node and link work. Always load and verify a scene before changing topology.

## MCP Surfaces

- Use tools for all topology actions.
- Use `opencli://capabilities` to confirm tool categories.
- Use topology resources for read-only context when a tool call is not needed: `opencli://topology/summary` and `opencli://topology/export`.
- Creation option tools are low-risk reads: they register a transient `configRequestId` but do not write backend topology.
- Call only topology tools currently exposed by the MCP client. Do not construct prefixed tool names manually.

## Topology Tools

- `opencli_topo_summary`: first-choice topology read.
- `opencli_node_list`: list exact node names, aliases, IDs, status, and coordinates.
- `opencli_link_list`: list exact link endpoints.
- `opencli_read_node_creation_options`: read frontend node creation options before node writes.
- `opencli_read_subnet_creation_options`: read frontend subnet model/parameter options before EMANE subnet writes.
- `opencli_read_link_creation_options`: read frontend link creation options before link writes.
- `opencli_read_composite_creation_options`: read one option form for composite node/subnet/link creation.
- `opencli_node_config_schema`: use before changing frontend node configuration fields.
- `opencli_update_node_config`: use for common node config updates such as alias, role, server, config services, coordinates, status, and EMANE parameters.
- `opencli_add_node`
- `opencli_add_nodes_batch`
- `opencli_add_nodes_grid`
- `opencli_connect_nodes`
- `opencli_add_links_batch`
- `opencli_move_node`
- `opencli_set_node_status`
- `opencli_delete_node`
- `opencli_delete_nodes_batch`
- `opencli_delete_links_batch`
- `opencli_clear_scene`
- `opencli_sample_scene`

## Baseline Before Writes

1. Call `opencli_current_scene`.
2. Call `opencli_topo_summary`.
3. Use `opencli_node_list` or `opencli_link_list` when exact names, IDs, or endpoints matter.
4. Use `opencli_topo_export` only when summary/list tools do not expose required fields.

## Add Nodes

For one node:

1. Confirm the scene is loaded.
2. Check existing names to avoid collisions.
3. Call `opencli_read_node_creation_options` for normal nodes or `opencli_read_subnet_creation_options` for EMANE subnets; every frontend add-node action needs user-confirmed configuration before writing.
4. Show the choices from `structuredContent.configForm` and wait for structured user choices in `userSelections`.
5. Call `opencli_add_node`.
6. Verify with `structuredContent.data.verification`.
7. Call `opencli_topo_summary` if the created node must be named in the final answer.

Option-read draft example:

```json
{
  "nodeType": "DRONE",
  "names": ["drone1", "drone2"]
}
```

After the user chooses from `structuredContent.configForm`, pass the resulting structured values to `opencli_add_node`, `opencli_add_nodes_batch`, or `opencli_add_nodes_grid` in `userSelections`. Do not call write tools with only default parameters.

Use batch node tools only when all planned nodes share the same `nodeType`. For named same-type batches, use `opencli_add_nodes_batch` after user configuration. For count-based same-type layout around a center, use `opencli_add_nodes_grid` after user configuration.

For composite requests such as two drones plus one subnet plus links, call `opencli_read_composite_creation_options` with a `composite` draft first. Preserve every returned `clientId`; mixed node/subnet composites should write each entity with `opencli_add_node` and the matching `clientId`, not a heterogeneous batch node write.

Write tools only accept a `configRequestId` that came from an explicit option-read tool. Do not use an ID from a short `requiresFormTool` blocker as write confirmation.

## Connect Nodes

1. Confirm both endpoints exist with `opencli_topo_summary` or `opencli_node_list`.
2. Do not duplicate an existing link unless explicitly requested.
3. Links have frontend link parameter configuration. Call `opencli_read_link_creation_options`, show the choices from `structuredContent.configForm`, and wait for `userSelections.configRequestId` plus structured `linkOptions`.
4. Call `opencli_connect_nodes` for one link or `opencli_add_links_batch` for many links.
5. Verify with `opencli_link_list` or `opencli_topo_summary`.

Option-read draft example:

```json
{
  "pairs": [
    { "clientId": "link1", "from": "drone1", "to": "subnet1" },
    { "clientId": "link2", "from": "drone2", "to": "subnet1" }
  ]
}
```

After the user confirms link parameters, write with `opencli_connect_nodes` or `opencli_add_links_batch` and include the matching `configRequestId`, `clientId`, endpoints, and `linkOptions` in `userSelections`. For batch links, include the returned `clientId` on each `pairs[]` item when the option-read or composite form returned link client IDs.

## Move Nodes

1. Confirm target node exists.
2. Require explicit latitude and longitude. Ask if either is missing.
3. Call `opencli_move_node`.
4. Verify with `opencli_topo_summary`.

## Status Changes

`opencli_set_node_status` and `opencli_update_node_config(status=...)` change availability. They are ordinary write tools, not destructive annotations, but still require clear user intent and post-write verification.

1. Confirm target node exists.
2. Confirm desired status is `UP` or `DOWN`.
3. Require explicit user intent.
4. Call the tool.
5. Verify with `opencli_node_list` or `opencli_topo_summary`.

## Frontend Node Config

When the user asks about fields visible in the node info/config dialogs, use `opencli-mcp-node-config`.

Short path:

1. Call `opencli_node_config_schema`, with `target` if one node is involved.
2. Use `opencli_update_node_config` for alias/status/role/server/services/position/EMANE parameters.
3. Use VM/protocol/TDMA tools from the node config skill for specialized dialogs.
4. Verify with `opencli_node_config_schema(target=...)`, `opencli_node_list`, or `opencli_topo_summary`.

## Delete Or Clear

Deletion and clearing are destructive.

1. Identify exact targets from tool output.
2. Explain the effect.
3. Ask for approval unless the latest user request already names exact targets.
4. Call the delete or clear tool.
5. Verify with `opencli_topo_summary`.

Use `opencli_clear_scene` only when the user intends to remove all topology from the loaded scene.

## Topology Errors

- Node target not found: call `opencli_node_list` and ask for exact target.
- Link target not found: call `opencli_link_list` and ask for exact endpoints.
- Ambiguous write result: call `opencli_refresh_topo`, then `opencli_topo_summary`.
- Partial batch failure: report successes, failures, skipped items, and current verified counts.

