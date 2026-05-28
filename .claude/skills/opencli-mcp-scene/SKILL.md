---
name: opencli-mcp-scene
description: Use when an Agent operates OpenCLI scenes through MCP: list scenes, choose the correct scene, create a scene, load or switch the current scene, inspect current scene state, refresh scene topology, or close a scene safely.
---

# OpenCLI MCP Scene

Use this skill for scene-level work. A scene must be loaded before topology or simulation tools can operate on the intended target.

## MCP Surfaces

- Scene tools perform scene discovery, loading, creation, refresh, and close actions.
- Scene resources expose current scene and topology context: `opencli://current-scene`, `opencli://topology/summary`, and `opencli://topology/export`.
- Use `opencli://capabilities` if the agent needs to distinguish read-only, local-state, write, and destructive tools.
- Call only scene tools currently exposed by the MCP client. Do not construct prefixed tool names manually.

## Scene Tools

- `opencli_scene_list`: discover private, public, or all scenes.
- `opencli_create_scene`: create a new backend scene.
- `opencli_load_scene`: load a scene into MCP memory.
- `opencli_current_scene`: verify the loaded scene.
- `opencli_refresh_topo`: refresh the loaded scene's topology cache.
- `opencli_topo_summary`: inspect scene topology at summary level.
- `opencli_topo_export`: read full topology only when summary is insufficient.
- `opencli_close_scene`: close a backend scene; normal write.

## Existing Scene Workflow

1. Call `opencli_scene_list`.
2. Choose one exact scene by `sessionId`.
3. If multiple scenes match, ask the user to choose unless there is a clearly newest exact match.
4. Call `opencli_load_scene` with `sessionId`.
5. Call `opencli_current_scene`.
6. Call `opencli_topo_summary` before any topology or simulation work.

Prefer `sessionId` over name when loading:

```json
{
  "sessionId": 764
}
```

## New Scene Workflow

1. Call `opencli_create_scene` with the requested name.
2. Call `opencli_current_scene` to verify the new scene is loaded.
3. If current scene is missing, call `opencli_scene_list` with the new name, then `opencli_load_scene`.
4. Call `opencli_topo_summary` to establish the initial baseline.

Scene creation itself may execute immediately. If the same user request also asks to add nodes, subnets, or links, call the explicit creation option-read tool next (`opencli_read_node_creation_options`, `opencli_read_subnet_creation_options`, `opencli_read_link_creation_options`, or `opencli_read_composite_creation_options`). Do not ask the user to confirm defaults before the MCP layer has returned the actual `structuredContent.configForm`.

For requests such as "create a scene, add two drones, one subnet, and connect them", create/load the scene first, then call `opencli_read_composite_creation_options` so the user sees one combined structured configuration form.

Example:

```json
{
  "name": "scene-mcp-01"
}
```

## Switching Scenes

1. Call `opencli_scene_list` if the target `sessionId` is not already known.
2. Call `opencli_load_scene`.
3. Call `opencli_current_scene`.
4. Call `opencli_topo_summary` before writing.

Do not assume the browser page and MCP memory have the same current scene.

## Closing Scenes

`opencli_close_scene` is a normal write tool.

1. Confirm exact scene ID and name.
2. Explain that closing affects the backend scene lifecycle.
3. Call `opencli_close_scene`.
4. Verify with `opencli_current_scene` if it was loaded, or `opencli_scene_list` if checking by list.

## Scene Errors

- No loaded scene: load a scene before topology or simulation operations.
- Multiple matches by name: ask for the exact ID.
- Scene not found: call `opencli_scene_list` with `scope: "all"` and a broader `name`.
- Missing user config on create: ask the user to check `OPENCLI_USER_ID` and `OPENCLI_USERNAME`.

