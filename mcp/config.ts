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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readOrdinary(): 1 | 2 {
  return readEnv('OPENCLI_ORDINARY') === '2' ? 2 : 1;
}

export interface OpenCliMcpConfig {
  host: string;
  port: number;
  mcpKey: string;
  apiBase: string;
  authApiBase: string;
  routerApiBase: string;
  backendToken: string;
  userId: string;
  username: string;
  ordinary: 1 | 2;
  disturb: number;
  singleClient: boolean;
}

export const config: OpenCliMcpConfig = {
  host: readEnv('OPENCLI_MCP_HOST', '127.0.0.1'),
  port: readInt('OPENCLI_MCP_PORT', 8787),
  mcpKey: readEnv('OPENCLI_MCP_KEY', 'local-dev-key'),
  apiBase: trimTrailingSlash(readEnv('OPENCLI_API_BASE', 'http://10.16.65.106:7777')),
  authApiBase: trimTrailingSlash(readEnv('OPENCLI_AUTH_API_BASE', 'http://10.16.65.106:7776')),
  routerApiBase: trimTrailingSlash(readEnv('OPENCLI_ROUTER_API_BASE', 'http://10.16.65.106:7780')),
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
