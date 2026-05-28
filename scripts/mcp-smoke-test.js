import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

dotenv.config({ path: '.env.mcp' });
dotenv.config();

function readEnv(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function connectHost(host) {
  if (!host || host === '0.0.0.0' || host === '::') return '127.0.0.1';
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function serverUrl() {
  const explicit = readEnv('OPENCLI_MCP_URL');
  if (explicit) return new URL(explicit);

  const host = connectHost(readEnv('OPENCLI_MCP_HOST', '127.0.0.1'));
  const port = readEnv('OPENCLI_MCP_PORT', '8787');
  return new URL(`http://${host}:${port}/mcp`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkHealth(url) {
  const healthUrl = new URL('/health', url);
  const response = await fetch(healthUrl);
  assert(response.ok, `GET ${healthUrl} failed with status ${response.status}`);
  const body = await response.json();
  assert(body?.ok === true, 'health response did not report ok=true');
  return body;
}

async function main() {
  const url = serverUrl();
  const mcpKey = readEnv('OPENCLI_MCP_KEY', 'local-dev-key');
  const headers = mcpKey
    ? {
        Authorization: `Bearer ${mcpKey}`,
        'x-opencli-mcp-key': mcpKey,
      }
    : undefined;

  console.log(`[mcp-smoke] target=${url.href}`);
  const health = await checkHealth(url);
  console.log(`[mcp-smoke] health ok name=${health.name} sessions=${health.sessions}`);

  const client = new Client({
    name: 'opencli-mcp-smoke-test',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: headers ? { headers } : undefined,
  });

  try {
    await client.connect(transport);
    console.log(`[mcp-smoke] connected session=${transport.sessionId || 'none'}`);

    await client.ping();
    console.log('[mcp-smoke] ping ok');

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    assert(toolNames.includes('opencli_current_scene'), 'tools/list missing opencli_current_scene');
    assert(toolNames.includes('opencli_topo_summary'), 'tools/list missing opencli_topo_summary');
    console.log(`[mcp-smoke] tools/list ok count=${tools.tools.length}`);
    console.log(`[mcp-smoke] tools=${toolNames.join(', ')}`);

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri);
    assert(resourceUris.includes('opencli://runtime'), 'resources/list missing opencli://runtime');
    console.log(`[mcp-smoke] resources/list ok count=${resources.resources.length}`);

    const templates = await client.listResourceTemplates();
    console.log(`[mcp-smoke] resources/templates/list ok count=${templates.resourceTemplates.length}`);

    const prompts = await client.listPrompts();
    const promptNames = prompts.prompts.map((prompt) => prompt.name);
    assert(promptNames.includes('opencli_operator'), 'prompts/list missing opencli_operator');
    console.log(`[mcp-smoke] prompts/list ok count=${prompts.prompts.length}`);

    const currentScene = await client.callTool({
      name: 'opencli_current_scene',
      arguments: {},
    });
    assert(typeof currentScene.structuredContent?.ok === 'boolean', 'tools/call did not return structuredContent.ok');
    assert(currentScene.structuredContent?.tool === 'opencli_current_scene', 'tools/call structuredContent.tool mismatch');
    console.log(`[mcp-smoke] tools/call ok isError=${Boolean(currentScene.isError)}`);

    console.log('[mcp-smoke] all checks passed');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`[mcp-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
