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

interface SessionRecord {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const backend = new OpenCliBackendClient();
const executor = new OpenCliMcpExecutor(backend);
const sessions = new Map<string, SessionRecord>();
let singleClientSessionId: string | null = null;

function createServer(): McpServer {
  const server = new McpServer({
    name: 'opencli-mcp',
    version: '1.0.0',
  });

  registerOpenCliTools(server, executor);
  registerOpenCliResources(server, executor);
  registerOpenCliPrompts(server);
  return server;
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
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

  console.log(`[OpenCLI MCP] -> ${req.method} ${req.path} session=${sessionId} ${jsonRpcSummary(req.body)}`);
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[OpenCLI MCP] <- ${req.method} ${req.path} status=${res.statusCode} ${duration}ms`);
  });
  next();
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

  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Unauthorized MCP request.',
    },
    id: null,
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
  if (accept.includes('text/event-stream') && !accept.includes('application/json')) {
    setRequestHeader(req, 'Accept', `${accept}, application/json`);
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
        console.log(`[OpenCLI MCP] Session initialized: ${newSessionId}`);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        sessions.delete(id);
        if (singleClientSessionId === id) {
          singleClientSessionId = null;
        }
        console.log(`[OpenCLI MCP] Session closed: ${id}`);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[OpenCLI MCP] POST /mcp failed:', error);
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

const app = createMcpExpressApp({ host: config.host });
app.use(cors());
app.use(requestLogger);
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'opencli-mcp',
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
    console.error('[OpenCLI MCP] GET /mcp failed:', error);
    errorResponse(res);
  });
});
app.delete('/mcp', authMiddleware, (req, res) => {
  void handleDelete(req, res).catch((error) => {
    console.error('[OpenCLI MCP] DELETE /mcp failed:', error);
    errorResponse(res);
  });
});

app.listen(config.port, config.host, (error?: Error) => {
  if (error) {
    console.error('[OpenCLI MCP] Failed to start:', error);
    process.exit(1);
  }

  console.log(`[OpenCLI MCP] Listening on http://${config.host}:${config.port}/mcp`);
  if (config.mcpKey) {
    console.log('[OpenCLI MCP] MCP key auth is enabled.');
  } else {
    console.warn('[OpenCLI MCP] MCP key auth is disabled. Set OPENCLI_MCP_KEY to protect the server.');
  }
  if (config.singleClient) {
    console.log('[OpenCLI MCP] Single-client compatibility mode is enabled.');
  }
});
