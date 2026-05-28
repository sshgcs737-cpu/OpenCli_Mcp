import dotenv from 'dotenv';

dotenv.config({ path: '.env.mcp' });
dotenv.config();

function readEnv(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function readInt(name: string, fallback: number): number {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBoolean(name: string, fallback = false): boolean {
  const value = readEnv(name);
  if (!value) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function readList(name: string): string[] {
  return readEnv(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readOrdinary(): 1 | 2 {
  return readEnv('OPENCLI_ORDINARY') === '2' ? 2 : 1;
}

function normalizeAllowedHost(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return value.replace(/:\d+$/, '');
  }
}

function normalizeOrigin(value: string): string {
  if (value === '*') return value;

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function defaultAllowedHosts(host: string): string[] {
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  if (host && !['0.0.0.0', '::'].includes(host)) {
    hosts.push(host);
  }

  return unique(hosts.map(normalizeAllowedHost));
}

function defaultAllowedOrigins(host: string, port: number): string[] {
  const origins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`,
  ];

  if (host && !['0.0.0.0', '::'].includes(host)) {
    const hostForUrl = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    origins.push(`http://${hostForUrl}:${port}`);
  }

  return unique(origins.map(normalizeOrigin));
}

function defaultWebSocketUrl(apiBase: string): string {
  try {
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostForUrl = url.hostname.includes(':') ? `[${url.hostname}]` : url.hostname;
    return `${protocol}//${hostForUrl}:10202/connect`;
  } catch {
    return '';
  }
}

const host = readEnv('OPENCLI_MCP_HOST', '127.0.0.1');
const port = readInt('OPENCLI_MCP_PORT', 8787);
const configuredAllowedHosts = readList('OPENCLI_MCP_ALLOWED_HOSTS').map(normalizeAllowedHost);
const configuredAllowedOrigins = readList('OPENCLI_MCP_ALLOWED_ORIGINS').map(normalizeOrigin);
const apiBase = trimTrailingSlash(readEnv('OPENCLI_API_BASE', 'http://10.16.37.102:7777'));
const authApiBase = trimTrailingSlash(readEnv('OPENCLI_AUTH_API_BASE', 'http://10.16.37.102:7776'));
const routerApiBase = trimTrailingSlash(readEnv('OPENCLI_ROUTER_API_BASE', 'http://10.16.37.102:7780'));

export interface OpenCliMcpConfig {
  name: string;
  version: string;
  host: string;
  port: number;
  mcpKey: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  apiBase: string;
  authApiBase: string;
  routerApiBase: string;
  websocketUrl: string;
  frontendSyncDelayMs: number;
  backendToken: string;
  userId: string;
  username: string;
  ordinary: 1 | 2;
  disturb: number;
  singleClient: boolean;
}

export const config: OpenCliMcpConfig = {
  name: readEnv('OPENCLI_MCP_NAME', 'opencli-mcp'),
  version: readEnv('OPENCLI_MCP_VERSION', '1.0.0'),
  host,
  port,
  mcpKey: readEnv('OPENCLI_MCP_KEY', 'local-dev-key'),
  allowedHosts: configuredAllowedHosts.length > 0 ? configuredAllowedHosts : defaultAllowedHosts(host),
  allowedOrigins: configuredAllowedOrigins.length > 0 ? configuredAllowedOrigins : defaultAllowedOrigins(host, port),
  apiBase,
  authApiBase,
  routerApiBase,
  websocketUrl: trimTrailingSlash(readEnv('OPENCLI_WS_URL', defaultWebSocketUrl(apiBase))),
  frontendSyncDelayMs: readInt('OPENCLI_FRONTEND_SYNC_DELAY_MS', 2500),
  backendToken: readEnv('OPENCLI_BACKEND_TOKEN'),
  userId: readEnv('OPENCLI_USER_ID'),
  username: readEnv('OPENCLI_USERNAME', 'mcp-user'),
  ordinary: readOrdinary(),
  disturb: Number(readEnv('OPENCLI_DISTURB', '0')) || 0,
  singleClient: readBoolean('OPENCLI_MCP_SINGLE_CLIENT'),
};

export function requireBackendToken(): string {
  if (!config.backendToken) {
    throw new Error('缺少 OPENCLI_BACKEND_TOKEN。请复制 .env.mcp.example 为 .env.mcp，并填入后端 Bearer token。');
  }

  return config.backendToken;
}

export function requireUserId(): string {
  if (!config.userId) {
    throw new Error('缺少 OPENCLI_USER_ID。写操作需要明确 userId。');
  }

  return config.userId;
}
