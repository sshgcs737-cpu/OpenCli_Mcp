import { randomUUID } from 'node:crypto';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.ts';
import { OpenCliBackendClient } from './backendClient.ts';
import { OpenCliMcpExecutor } from './opencliMcpExecutor.ts';
import { registerOpenCliTools } from './tools.ts';
import { registerOpenCliResources } from './resources.ts';
import { registerOpenCliPrompts } from './prompts.ts';
import { mcpError, mcpLog, mcpWarn } from './logger.ts';

interface SessionRecord {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const MCP_ALLOWED_HEADERS = [
  'Accept',
  'Authorization',
  'Content-Type',
  'Mcp-Session-Id',
  'MCP-Protocol-Version',
  'mcp-session-id',
  'mcp-protocol-version',
  'x-opencli-mcp-key',
  'X-Agent-User-Authorization',
  'X-Agent-Project-Id',
  'X-Agent-Run-Id',
  'X-Agent-Trace-Id',
  'X-Agent-Session-Id',
];

const MCP_EXPOSED_HEADERS = ['Mcp-Session-Id', 'mcp-session-id'];

const backend = new OpenCliBackendClient();
const executor = new OpenCliMcpExecutor(backend);
const sessions = new Map<string, SessionRecord>();
let singleClientSessionId: string | null = null;

function createServer(): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version,
  });

  registerOpenCliTools(server, executor);
  registerOpenCliResources(server, executor);
  registerOpenCliPrompts(server);
  return server;
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function requestId(body: unknown): string | number | null {
  if (!body || typeof body !== 'object') return null;
  const { id } = body as { id?: string | number | null };
  return id ?? null;
}

function normalizeOrigin(value: string): string {
  if (value === '*') return value;

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = config.allowedOrigins;
  return allowedOrigins.includes('*') || allowedOrigins.includes(normalizeOrigin(origin));
}

function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean | string) => void
): void {
  if (!origin) {
    callback(null, false);
    return;
  }

  callback(null, isAllowedOrigin(origin) ? origin : false);
}

function truncate(value: string, maxLength = 180): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function jsonRpcSummary(body: unknown): string {
  if (!body || typeof body !== 'object') return 'body=empty';

  const request = body as {
    id?: string | number;
    method?: string;
    params?: {
      name?: string;
      uri?: string;
      arguments?: unknown;
    };
  };
  const parts = [
    request.method ? `rpc=${request.method}` : '',
    request.id !== undefined ? `id=${request.id}` : '',
    request.params?.name ? `name=${request.params.name}` : '',
    request.params?.uri ? `uri=${request.params.uri}` : '',
  ].filter(Boolean);

  if (request.params?.arguments && typeof request.params.arguments === 'object') {
    parts.push(`args=${truncate(JSON.stringify(request.params.arguments))}`);
  }

  return parts.join(' ') || 'body=unknown';
}

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const sessionId = getSessionId(req) || 'none';

  mcpLog(`[OpenCLI MCP] -> ${req.method} ${req.path} session=${sessionId} ${jsonRpcSummary(req.body)}`);
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    mcpLog(`[OpenCLI MCP] <- ${req.method} ${req.path} status=${res.statusCode} ${duration}ms`);
  });
  next();
}

function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

function originGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = headerValue(req.headers.origin as string | string[] | undefined);
  if (!origin || isAllowedOrigin(origin)) {
    next();
    return;
  }

  res.status(403).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Forbidden MCP origin.',
    },
    id: requestId(req.body),
  });
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.mcpKey) {
    next();
    return;
  }

  const authorization = headerValue(req.headers.authorization);
  const customKey = headerValue(req.headers['x-opencli-mcp-key'] as string | string[] | undefined);
  const expected = `Bearer ${config.mcpKey}`;

  if (authorization === expected || customKey === config.mcpKey) {
    next();
    return;
  }

  res.setHeader('WWW-Authenticate', 'Bearer realm="opencli-mcp"');
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Unauthorized MCP request.',
    },
    id: requestId(req.body),
  });
}

function errorResponse(res: Response, message = 'Internal server error'): void {
  if (!res.headersSent) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message,
      },
      id: null,
    });
  }
}

function getSessionId(req: Request): string {
  return headerValue(req.headers['mcp-session-id'] as string | string[] | undefined);
}

function setRequestHeader(req: Request, name: string, value: string): void {
  const lowerName = name.toLowerCase();
  req.headers[lowerName] = value;

  let updated = false;
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (req.rawHeaders[index]?.toLowerCase() === lowerName) {
      req.rawHeaders[index + 1] = value;
      updated = true;
    }
  }

  if (!updated) {
    req.rawHeaders.push(name, value);
  }
}

function setSessionId(req: Request, sessionId: string): void {
  setRequestHeader(req, 'mcp-session-id', sessionId);
}

function normalizePostAcceptHeader(req: Request): void {
  const accept = headerValue(req.headers.accept);
  const required = ['application/json', 'text/event-stream'];

  if (!accept || accept === '*/*') {
    setRequestHeader(req, 'Accept', required.join(', '));
    return;
  }

  const missing = required.filter((item) => !accept.includes(item));
  if (missing.length > 0) {
    setRequestHeader(req, 'Accept', `${accept}, ${missing.join(', ')}`);
  }
}

function findSingleClientSession(): { sessionId: string; session: SessionRecord } | null {
  if (!config.singleClient || !singleClientSessionId) return null;

  const session = sessions.get(singleClientSessionId);
  if (!session) {
    singleClientSessionId = null;
    return null;
  }

  return { sessionId: singleClientSessionId, session };
}

function cleanupSession(sessionId: string | undefined): void {
  if (!sessionId || !sessions.has(sessionId)) return;

  sessions.delete(sessionId);
  if (singleClientSessionId === sessionId) {
    singleClientSessionId = null;
  }
  mcpLog(`[OpenCLI MCP] Session closed: ${sessionId}`);
}

async function handlePost(req: Request, res: Response): Promise<void> {
  normalizePostAcceptHeader(req);
  const sessionId = getSessionId(req);

  try {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid MCP session ID.',
          },
          id: null,
        });
        return;
      }

      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    const singleClientSession = findSingleClientSession();
    if (singleClientSession && !isInitializeRequest(req.body)) {
      setSessionId(req, singleClientSession.sessionId);
      await singleClientSession.session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: initialize request required for new MCP sessions.',
        },
        id: null,
      });
      return;
    }

    const server = createServer();
    let transport: StreamableHTTPServerTransport;

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { server, transport });
        if (config.singleClient) {
          singleClientSessionId = newSessionId;
        }
        mcpLog(`[OpenCLI MCP] Session initialized: ${newSessionId}`);
      },
    });

    server.server.onclose = () => cleanupSession(transport.sessionId);

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    mcpError('[OpenCLI MCP] POST /mcp failed:', error);
    errorResponse(res);
  }
}

async function handleGet(req: Request, res: Response): Promise<void> {
  let sessionId = getSessionId(req);
  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!sessionId) {
    const singleClientSession = findSingleClientSession();
    if (singleClientSession) {
      sessionId = singleClientSession.sessionId;
      session = singleClientSession.session;
      setSessionId(req, sessionId);
    }
  }

  if (!session) {
    res.status(400).send('Invalid or missing MCP session ID');
    return;
  }

  await session.transport.handleRequest(req, res);
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  let sessionId = getSessionId(req);
  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!sessionId) {
    const singleClientSession = findSingleClientSession();
    if (singleClientSession) {
      sessionId = singleClientSession.sessionId;
      session = singleClientSession.session;
      setSessionId(req, sessionId);
    }
  }

  if (!session) {
    res.status(400).send('Invalid or missing MCP session ID');
    return;
  }

  await session.transport.handleRequest(req, res);
}

const app = createMcpExpressApp({ host: config.host, allowedHosts: config.allowedHosts });
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: MCP_ALLOWED_HEADERS,
  exposedHeaders: MCP_EXPOSED_HEADERS,
  maxAge: 86400,
}));
app.use(securityHeaders);
app.use(originGuard);
app.use(requestLogger);
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: config.name,
    version: config.version,
    sessions: sessions.size,
    singleClient: config.singleClient,
    singleClientSession: Boolean(singleClientSessionId),
  });
});
app.post('/mcp', authMiddleware, (req, res) => {
  void handlePost(req, res);
});
app.get('/mcp', authMiddleware, (req, res) => {
  void handleGet(req, res).catch((error) => {
    mcpError('[OpenCLI MCP] GET /mcp failed:', error);
    errorResponse(res);
  });
});
app.delete('/mcp', authMiddleware, (req, res) => {
  void handleDelete(req, res).catch((error) => {
    mcpError('[OpenCLI MCP] DELETE /mcp failed:', error);
    errorResponse(res);
  });
});

app.listen(config.port, config.host, (error?: Error) => {
  if (error) {
    mcpError('[OpenCLI MCP] Failed to start:', error);
    process.exit(1);
  }

  mcpLog(`[OpenCLI MCP] Listening on http://${config.host}:${config.port}/mcp`);
  mcpLog(`[OpenCLI MCP] Allowed hosts: ${config.allowedHosts.join(', ')}`);
  mcpLog(`[OpenCLI MCP] Allowed origins: ${config.allowedOrigins.join(', ')}`);
  if (config.mcpKey) {
    mcpLog('[OpenCLI MCP] MCP key auth is enabled.');
  } else {
    mcpWarn('[OpenCLI MCP] MCP key auth is disabled. Set OPENCLI_MCP_KEY to protect the server.');
  }
  if (config.singleClient) {
    mcpLog('[OpenCLI MCP] Single-client compatibility mode is enabled.');
  }
});
