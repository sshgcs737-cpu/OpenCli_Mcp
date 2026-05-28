---
name: opencli-mcp-node-config
description: Use when an Agent reads or changes frontend node configuration through OpenCLI MCP: discover node config fields, update alias/status/role/server/services/position/EMANE parameters, list or edit VM templates and VM resources, read or save router protocol settings, or generate TDMA slot schedules.
---

# OpenCLI MCP Node Config

Use this skill when the task is about fields a frontend user can type, select, toggle, or map in node configuration panels. A scene must be loaded before reading or writing node-specific configuration.

## MCP Surfaces

- Existing-node configuration uses tools such as `opencli_node_config_schema`, `opencli_update_node_config`, VM, protocol, and TDMA tools.
- Creation-time configuration uses option-read tools and must happen before topology write tools.
- `opencli://node-config/schema` exposes the node configuration catalog as a resource.
- `opencli://capabilities` exposes tool grouping for read-only, local-state, creation options, writes, and destructive actions.
- Call only node/config tools currently exposed by the MCP client. Do not construct prefixed tool names manually.

## Node Config Tools

- `opencli_node_config_schema`: first-choice field discovery tool. Use it before answering what can be configured or before choosing a config write tool.
- `opencli_update_node_config`: update common node fields such as alias, status, role, server, config services, coordinates, `phyType`, and EMANE parameter overrides.
- `opencli_vm_templates`: list VM template options used by the frontend VM template selector.
- `opencli_update_vm_config`: update VM template, CPU, maximum memory, and current memory.
- `opencli_get_node_protocol_config`: read protocol field context, available interfaces, and current router protocol configuration.
- `opencli_set_node_protocol_config`: save router protocol, static route, and convergence settings.
- `opencli_generate_tdma_schedule`: generate the TDMA schedule file from the subnet slot dialog fields.

## Field Discovery First

1. Call `opencli_current_scene`.
2. Call `opencli_node_config_schema`.
3. If the request targets one node, pass `target` so the tool returns current values, interfaces, connected nodes, VM metadata, protocol container, and TDMA context.
4. Use the returned `mcpTools` and field catalog to choose the smallest write tool.

## Creation Config Forms

Use explicit option-read tools before creating topology entities: `opencli_read_node_creation_options`, `opencli_read_subnet_creation_options`, `opencli_read_link_creation_options`, or `opencli_read_composite_creation_options`. Every frontend add-node action must pass through user configuration first, including basic application nodes and basic switch/security/SDN/OVS/P4/SR/PKI-style nodes. Basic nodes still require user-confirmed name, position, altitude, and role. The returned options must be treated like the frontend dialog: show the controls/options/constraints, not a prefilled answer for the user to approve.

Creation option reads register a pending `configRequestId` in MCP local state but do not write the backend. Existing-node config schema reads do not authorize creation writes.

When a write tool returns `requiresFormTool=true`, call the named option-read tool. Show the choices from `structuredContent.configForm` and wait for the user. The follow-up write must include `userSelections.configRequestId` plus structured choices, and that ID must come from the explicit option-read tool. Do not use `useDefaultConfig`, `configConfirmed`, or a repeated natural-language request as confirmation.

When an option-read tool returns `optionReadResult=true`, do not synthesize a user reply template. The user needs to see the available frontend options first.

For node protocol checkboxes, preserve frontend-style booleans when convenient: `enableZebra`, `enableOSPF`, `enableOLSR`, `enableBGP`, and `enableRIP` are accepted and mapped by MCP to backend `config_services`.

For a composite request, pass a `composite` draft to `opencli_read_composite_creation_options` so one options form covers all planned nodes, subnets, and links. Preserve each returned `clientId` in `userSelections`. Batch node writes are only for same-type node groups; mixed node/subnet composites should be written entity by entity. Batch link writes should keep the returned `pairs[].clientId` so each link consumes the correct confirmed configuration.

For subnet creation, use the two-stage flow:

1. Stage `subnet-model`: show all link-layer models, all physical-layer models, and the link-layer to physical-layer mapping.
2. Stage `subnet-parameters`: after the user chooses `emaneModel/phyType`, call `opencli_read_subnet_creation_options` again with `partialSelections`; then show only the applicable External/MAC/PHY/Platform fields.

## Common Node Config

Use `opencli_update_node_config` for:

- `alias`: non-empty, max 64 characters, unique among node aliases/names.
- `status`: `UP` or `DOWN`; this mirrors the frontend fault switch.
- `role`: `1` white/public, `2` red, `3` blue.
- `server`: backend server name.
- `configServices`: services such as `zebra`, `OSPFv2`, `olsrd`.
- `lat`, `lon`, `alt`: node coordinates.
- `phyType` and `emaneConfig`: EMANE subnet parameters.

`status=DOWN` marks a node unavailable, so verify intent and result, but it is categorized as a normal write rather than a destructive tool annotation.

## VM Config

1. Confirm the target node is a VM with `opencli_node_config_schema` or `opencli_node_list`.
2. Call `opencli_vm_templates` if the user asks to choose from template options.
3. Call `opencli_update_vm_config`.
4. Keep `cpu` between 1 and 16.
5. Keep `memoryMb` and `currentMemoryMb` between 512 and 32768, with current memory not greater than maximum memory.
6. Verify with `opencli_topo_summary` or `opencli_node_config_schema(target=...)`.

## Protocol Config

1. Call `opencli_get_node_protocol_config` for the target.
2. Use returned `interfaces` exactly; do not invent interface names.
3. Dynamic protocol fields are for `DOCKER` nodes with `image=nest:v3`.
4. Interface-based protocols need at least one interface when enabled.
5. Static routes use rows of `destination`, `nexthop`, and `interface`.
6. Save with `opencli_set_node_protocol_config`.

Supported dynamic protocol blocks:

- `ospf2`: `enabled`, `interfaces`, `areaId`
- `ospf3`: `enabled`, `interfaces`, `areaId`
- `rip`: `enabled`, `interfaces`
- `bgp`: `enabled`, `localAs`, `neighbors`
- `isis`: `enabled`, `interfaces`, `process`, `netAddr`
- `pim`: `enabled`, `interfaces`
- `snapshot`: `enabled`, `interfaces`
- `backpressure`: `enabled`, `interfaces`

## TDMA Slot Schedule

Use `opencli_generate_tdma_schedule` for EMANE subnet slot configuration.

1. Confirm the target node is an `EMANE` subnet.
2. Use `opencli_node_config_schema(target=...)` to see connected node IDs/names.
3. `slotCount` must be at least the connected node count and at most 100.
4. `slotWidth` must be between 1 and 100000 microseconds.
5. `nodeSlotMap` keys may be connected node IDs, names, or aliases; values are zero-based slot indexes.
6. Omitted slots are filled with node id `65535`, matching the frontend behavior.

## Verification

After every write:

1. Read `structuredContent.data.verification` if present.
2. For topology-visible fields, call `opencli_topo_summary` or `opencli_node_list`.
3. For protocol/VM/TDMA details, call the matching read tool or schema tool again.

