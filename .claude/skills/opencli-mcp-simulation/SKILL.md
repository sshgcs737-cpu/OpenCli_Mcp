---
name: opencli-mcp-simulation
description: Use when an Agent controls OpenCLI simulation through MCP: run simulation readiness checks, start a loaded scene simulation, pause simulation, stop simulation, verify lifecycle state, or recover from simulation start blockers.
---

# OpenCLI MCP Simulation

Use this skill for simulation lifecycle actions. Never start, pause, or stop simulation without verifying the loaded scene first.

## MCP Surfaces

- Simulation lifecycle actions are tools.
- Use resources such as `opencli://current-scene` and `opencli://topology/summary` for read-only context when appropriate.
- Use `opencli://capabilities` if the agent needs to distinguish read tools, normal writes, and delete/clear high-risk tools.
- Call only simulation tools currently exposed by the MCP client. Do not construct prefixed tool names manually.

## Simulation Tools

- `opencli_current_scene`: verify scene ID, name, state, and counts.
- `opencli_topo_summary`: inspect current topology before lifecycle actions.
- `opencli_simulation_check`: required before start.
- `opencli_start_simulation`: start the loaded scene simulation.
- `opencli_pause_simulation`: pause the loaded scene simulation; normal write.
- `opencli_stop_simulation`: stop the loaded scene simulation; normal write.
- `opencli_refresh_topo`: refresh when state is ambiguous.

## Start Workflow

1. Call `opencli_current_scene`.
2. Call `opencli_topo_summary`.
3. Call `opencli_simulation_check`.
4. If the check reports blockers, stop and report them.
5. Call `opencli_start_simulation` only when the user requested start and the check passed.
6. Call `opencli_current_scene`.
7. Call `opencli_topo_summary` if node/link status matters.

Example:

```json
{
  "duration": 3600
}
```

Durations up to `86400` are interpreted as seconds by the executor. Larger values are treated as milliseconds.

## Pause Workflow

`opencli_pause_simulation` is a normal write tool.

1. Call `opencli_current_scene`.
2. Confirm the user intends to pause the loaded scene.
3. Call `opencli_pause_simulation`.
4. Verify with `opencli_current_scene`.

## Stop Workflow

`opencli_stop_simulation` is a normal write tool.

1. Call `opencli_current_scene`.
2. Confirm the user intends to stop the loaded scene.
3. Call `opencli_stop_simulation`.
4. Verify with `opencli_current_scene`.

## Readiness Blockers

When `opencli_simulation_check` fails:

- Report the exact blocker text.
- Do not start simulation.
- Use topology tools only if fixing the blocker requires adding, connecting, moving, or deleting topology.
- Re-run `opencli_simulation_check` after fixes.

## Ambiguous Lifecycle State

If lifecycle state is unclear:

1. Call `opencli_refresh_topo`.
2. Call `opencli_current_scene`.
3. Report the state from tool output, not assumptions.

## Reporting

For start, report scene ID, state, duration, node/link counts, and any warnings.

For pause or stop, report the requested lifecycle action and verified final scene state.

