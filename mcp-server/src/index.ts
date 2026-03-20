#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import express from "express";
import cors from "cors";

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------
const BASE_URL = (process.env.RUNA_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);
const API_KEY = process.env.RUNA_API_KEY ?? "";
const MODE = process.argv.includes("--http") ? "http" : "stdio";
const MCP_PORT = parseInt(process.env.MCP_PORT ?? "3002", 10);

// ---------------------------------------------------------------------------
// HTTP helper — uses either static API key or per-request OAuth token
// ---------------------------------------------------------------------------
type Method = "GET" | "POST" | "PATCH" | "DELETE";

// In HTTP mode, the bearer token from the MCP client is forwarded to the Runa API
let currentBearerToken: string = API_KEY;

async function api(method: Method, path: string, body?: unknown) {
  const url = `${BASE_URL}/api${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${currentBearerToken}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Server factory — each HTTP session gets its own instance
// ---------------------------------------------------------------------------
function createServer(): McpServer {
  const server = new McpServer({
    name: "runa",
    version: "1.0.0",
  });

  // ========================== AUTH / USER ====================================

  server.tool(
    "get_current_user",
    "Get the authenticated user profile",
    {},
    async () => {
      const data = await api("GET", "/auth/me");
      return ok(data);
    },
  );

  // ========================== SPACES ========================================

  server.tool(
    "list_spaces",
    "List all spaces for the current user",
    {},
    async () => {
      return ok(await api("GET", "/spaces"));
    },
  );

  server.tool(
    "get_space",
    "Get a single space by ID",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("GET", `/spaces/${spaceId}`)),
  );

  server.tool(
    "create_space",
    "Create a new project space",
    {
      name: z.string().describe("Space name"),
      description: z.string().optional().describe("Space description"),
      githubRepoUrl: z.string().optional().describe("GitHub repo URL to link"),
      gitlabRepoUrl: z.string().optional().describe("GitLab repo URL to link"),
    },
    async (args) => ok(await api("POST", "/spaces", args)),
  );

  server.tool(
    "update_space",
    "Update space settings (name, description, repo URLs)",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      githubRepoUrl: z.string().optional().describe("GitHub repo URL"),
      gitlabRepoUrl: z.string().optional().describe("GitLab repo URL"),
    },
    async ({ spaceId, ...body }) =>
      ok(await api("PATCH", `/spaces/${spaceId}`, body)),
  );

  server.tool(
    "delete_space",
    "Delete a space and all its data",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("DELETE", `/spaces/${spaceId}`)),
  );

  // ========================== TICKETS =======================================

  server.tool(
    "list_tickets",
    "List all tickets in a space",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("GET", `/spaces/${spaceId}/tickets`)),
  );

  server.tool(
    "get_ticket",
    "Get a single ticket with comments",
    { ticketId: z.string().uuid().describe("Ticket ID") },
    async ({ ticketId }) => ok(await api("GET", `/tickets/${ticketId}`)),
  );

  server.tool(
    "create_ticket",
    "Create a new ticket in a space",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      title: z.string().describe("Ticket title"),
      description: z
        .string()
        .optional()
        .describe("Ticket description (markdown)"),
      priority: z
        .enum(["low", "medium", "high", "critical"])
        .optional()
        .describe("Priority level"),
      assigneeAgentId: z
        .string()
        .uuid()
        .optional()
        .describe("Agent ID to assign"),
      assigneeUserId: z
        .string()
        .uuid()
        .optional()
        .describe("User ID to assign"),
    },
    async ({ spaceId, ...body }) =>
      ok(await api("POST", `/spaces/${spaceId}/tickets`, body)),
  );

  server.tool(
    "update_ticket",
    "Update ticket fields (title, description, priority, assignee)",
    {
      ticketId: z.string().uuid().describe("Ticket ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      assigneeAgentId: z.string().uuid().optional().describe("Agent to assign"),
      assigneeUserId: z.string().uuid().optional().describe("User to assign"),
      startWorking: z
        .boolean()
        .optional()
        .describe("If true and agent assigned, immediately start agent work"),
    },
    async ({ ticketId, ...body }) =>
      ok(await api("PATCH", `/tickets/${ticketId}`, body)),
  );

  server.tool(
    "move_ticket",
    "Move a ticket to a different status column (e.g. backlog, in_progress, review, done)",
    {
      ticketId: z.string().uuid().describe("Ticket ID"),
      status: z.string().describe("Target status column"),
    },
    async ({ ticketId, status }) =>
      ok(await api("PATCH", `/tickets/${ticketId}/move`, { status })),
  );

  server.tool(
    "delete_ticket",
    "Delete a ticket",
    { ticketId: z.string().uuid().describe("Ticket ID") },
    async ({ ticketId }) => {
      await api("DELETE", `/tickets/${ticketId}`);
      return ok({ deleted: true });
    },
  );

  server.tool(
    "add_comment",
    "Add a comment to a ticket",
    {
      ticketId: z.string().uuid().describe("Ticket ID"),
      content: z.string().describe("Comment text (markdown)"),
    },
    async ({ ticketId, content }) =>
      ok(await api("POST", `/tickets/${ticketId}/comments`, { content })),
  );

  server.tool(
    "trigger_agent",
    "Trigger the assigned agent to work on a ticket",
    { ticketId: z.string().uuid().describe("Ticket ID") },
    async ({ ticketId }) =>
      ok(await api("POST", `/tickets/${ticketId}/trigger-agent`, {})),
  );

  // ========================== AGENTS ========================================

  server.tool(
    "list_agents",
    "List all agents in a space (PM, developer, tester, reviewer, custom)",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("GET", `/spaces/${spaceId}/agents`)),
  );

  server.tool(
    "get_agent",
    "Get agent details",
    { agentId: z.string().uuid().describe("Agent ID") },
    async ({ agentId }) => ok(await api("GET", `/agents/${agentId}`)),
  );

  server.tool(
    "get_agent_executions",
    "List execution history for an agent (paginated)",
    {
      agentId: z.string().uuid().describe("Agent ID"),
      page: z.number().optional().describe("Page number (default 1)"),
      limit: z
        .number()
        .optional()
        .describe("Items per page (default 20, max 100)"),
    },
    async ({ agentId, page, limit }) => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      const qs = params.toString();
      return ok(
        await api("GET", `/agents/${agentId}/executions${qs ? `?${qs}` : ""}`),
      );
    },
  );

  server.tool(
    "update_agent_rules",
    "Update the rules/instructions for an agent",
    {
      agentId: z.string().uuid().describe("Agent ID"),
      rules: z.string().describe("New rules text"),
    },
    async ({ agentId, rules }) =>
      ok(await api("PATCH", `/agents/${agentId}/rules`, { rules })),
  );

  server.tool(
    "update_agent_system_prompt",
    "Update the system prompt for an agent",
    {
      agentId: z.string().uuid().describe("Agent ID"),
      systemPrompt: z.string().describe("New system prompt"),
    },
    async ({ agentId, systemPrompt }) =>
      ok(
        await api("PATCH", `/agents/${agentId}/system-prompt`, {
          systemPrompt,
        }),
      ),
  );

  server.tool(
    "stop_agent",
    "Stop a running agent execution",
    { agentId: z.string().uuid().describe("Agent ID") },
    async ({ agentId }) => ok(await api("POST", `/agents/${agentId}/stop`)),
  );

  server.tool(
    "run_developer_agent",
    "Run the developer agent on a ticket",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      ticketId: z.string().uuid().describe("Ticket ID"),
      instructions: z.string().optional().describe("Additional instructions"),
    },
    async ({ spaceId, ticketId, instructions }) =>
      ok(
        await api("POST", `/spaces/${spaceId}/agents/developer/run`, {
          ticketId,
          instructions,
        }),
      ),
  );

  server.tool(
    "run_tester_agent",
    "Run the tester agent on a ticket",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      ticketId: z.string().uuid().describe("Ticket ID"),
      instructions: z.string().optional().describe("Additional instructions"),
    },
    async ({ spaceId, ticketId, instructions }) =>
      ok(
        await api("POST", `/spaces/${spaceId}/agents/tester/run`, {
          ticketId,
          instructions,
        }),
      ),
  );

  server.tool(
    "create_custom_agent",
    "Create a custom agent in a space",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      name: z.string().describe("Agent name"),
      description: z.string().optional().describe("Agent description"),
      systemPrompt: z.string().optional().describe("System prompt"),
    },
    async ({ spaceId, ...body }) =>
      ok(await api("POST", `/spaces/${spaceId}/agents/custom`, body)),
  );

  server.tool(
    "update_custom_agent",
    "Update a custom agent",
    {
      agentId: z.string().uuid().describe("Agent ID"),
      name: z.string().optional(),
      description: z.string().optional(),
      systemPrompt: z.string().optional(),
    },
    async ({ agentId, ...body }) =>
      ok(await api("PATCH", `/agents/${agentId}/custom`, body)),
  );

  server.tool(
    "delete_custom_agent",
    "Delete a custom agent",
    { agentId: z.string().uuid().describe("Agent ID") },
    async ({ agentId }) => ok(await api("DELETE", `/agents/${agentId}/custom`)),
  );

  // ========================== PIPELINE ======================================

  server.tool(
    "get_pipeline_config",
    "Get pipeline configuration for a space (which stages are enabled)",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("GET", `/spaces/${spaceId}/pipeline`)),
  );

  server.tool(
    "update_pipeline_config",
    "Enable/disable pipeline stages",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      stages: z
        .record(z.string(), z.boolean())
        .describe("Map of stage name → enabled boolean"),
    },
    async ({ spaceId, stages }) =>
      ok(await api("PATCH", `/spaces/${spaceId}/pipeline`, stages)),
  );

  server.tool(
    "advance_ticket",
    "Advance a ticket to the next pipeline stage",
    { ticketId: z.string().uuid().describe("Ticket ID") },
    async ({ ticketId }) =>
      ok(await api("POST", `/tickets/${ticketId}/advance`)),
  );

  server.tool(
    "run_pipeline",
    "Run the full pipeline on a ticket from the start",
    { ticketId: z.string().uuid().describe("Ticket ID") },
    async ({ ticketId }) =>
      ok(await api("POST", `/tickets/${ticketId}/run-pipeline`)),
  );

  // ========================== CHAT ==========================================

  server.tool(
    "list_chat_messages",
    "List chat messages in a space, optionally filtered by agent type",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      agentType: z
        .string()
        .optional()
        .describe("Filter by agent type (pm, developer, tester, reviewer)"),
    },
    async ({ spaceId, agentType }) => {
      const qs = agentType ? `?agentType=${agentType}` : "";
      return ok(await api("GET", `/chat/${spaceId}/messages${qs}`));
    },
  );

  server.tool(
    "send_chat_message",
    "Send a message to an agent in a space and get a response",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      message: z.string().describe("Message text"),
      agentType: z
        .enum(["pm", "developer", "tester", "reviewer"])
        .optional()
        .describe("Target agent (default: pm)"),
      ticketId: z
        .string()
        .uuid()
        .optional()
        .describe("Reference a ticket for context"),
    },
    async ({ spaceId, message, agentType, ticketId }) =>
      ok(
        await api("POST", `/chat/${spaceId}/send`, {
          message,
          agentType,
          ticketId,
        }),
      ),
  );

  // ========================== RULES =========================================

  server.tool(
    "list_rules",
    "List all rules in a space",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) => ok(await api("GET", `/spaces/${spaceId}/rules`)),
  );

  server.tool(
    "create_rule",
    "Create a new rule for agents in a space",
    {
      spaceId: z.string().uuid().describe("Space ID"),
      content: z.string().describe("Rule content"),
      scope: z
        .string()
        .optional()
        .describe("Rule scope (e.g. 'global', agent-specific)"),
      agentId: z
        .string()
        .uuid()
        .optional()
        .describe("Specific agent this rule applies to"),
    },
    async ({ spaceId, ...body }) =>
      ok(await api("POST", `/spaces/${spaceId}/rules`, body)),
  );

  server.tool(
    "update_rule",
    "Update a rule",
    {
      ruleId: z.string().uuid().describe("Rule ID"),
      content: z.string().optional().describe("New content"),
      scope: z.string().optional().describe("New scope"),
    },
    async ({ ruleId, ...body }) =>
      ok(await api("PATCH", `/rules/${ruleId}`, body)),
  );

  server.tool(
    "delete_rule",
    "Delete a rule",
    { ruleId: z.string().uuid().describe("Rule ID") },
    async ({ ruleId }) => ok(await api("DELETE", `/rules/${ruleId}`)),
  );

  server.tool(
    "list_suggested_rules",
    "List pending rule suggestions for a space",
    { spaceId: z.string().uuid().describe("Space ID") },
    async ({ spaceId }) =>
      ok(await api("GET", `/spaces/${spaceId}/suggested-rules`)),
  );

  server.tool(
    "accept_suggested_rule",
    "Accept a suggested rule",
    { suggestionId: z.string().uuid().describe("Suggestion ID") },
    async ({ suggestionId }) =>
      ok(await api("POST", `/suggested-rules/${suggestionId}/accept`)),
  );

  server.tool(
    "reject_suggested_rule",
    "Reject a suggested rule",
    { suggestionId: z.string().uuid().describe("Suggestion ID") },
    async ({ suggestionId }) =>
      ok(await api("POST", `/suggested-rules/${suggestionId}/reject`)),
  );

  // ========================== TEAMS =========================================

  server.tool("list_teams", "List teams for the current user", {}, async () =>
    ok(await api("GET", "/teams")),
  );

  server.tool(
    "get_team",
    "Get team details with members",
    { teamId: z.string().uuid().describe("Team ID") },
    async ({ teamId }) => ok(await api("GET", `/teams/${teamId}`)),
  );

  server.tool(
    "create_team",
    "Create a new team",
    { name: z.string().describe("Team name") },
    async ({ name }) => ok(await api("POST", "/teams", { name })),
  );

  server.tool(
    "invite_team_member",
    "Invite a member to a team by email",
    {
      teamId: z.string().uuid().describe("Team ID"),
      email: z.string().describe("Email address to invite"),
      role: z
        .enum(["admin", "member"])
        .optional()
        .describe("Role (default: member)"),
    },
    async ({ teamId, email, role }) =>
      ok(await api("POST", `/teams/${teamId}/invitations`, { email, role })),
  );

  server.tool(
    "remove_team_member",
    "Remove a member from a team",
    {
      teamId: z.string().uuid().describe("Team ID"),
      memberId: z.string().uuid().describe("Member ID"),
    },
    async ({ teamId, memberId }) =>
      ok(await api("DELETE", `/teams/${teamId}/members/${memberId}`)),
  );

  server.tool(
    "update_member_role",
    "Update a team member's role",
    {
      teamId: z.string().uuid().describe("Team ID"),
      memberId: z.string().uuid().describe("Member ID"),
      role: z.enum(["admin", "member"]).describe("New role"),
    },
    async ({ teamId, memberId, role }) =>
      ok(
        await api("PATCH", `/teams/${teamId}/members/${memberId}/role`, {
          role,
        }),
      ),
  );

  server.tool(
    "get_team_members",
    "Get member count for a team",
    { teamId: z.string().uuid().describe("Team ID") },
    async ({ teamId }) => ok(await api("GET", `/teams/${teamId}/seats`)),
  );

  // ========================== HEALTH ========================================

  server.tool(
    "health_check",
    "Check if the Runa API is healthy",
    {},
    async () => {
      try {
        const data = await api("GET", "/health");
        return ok(data);
      } catch (e: any) {
        return err(`API unreachable: ${e.message}`);
      }
    },
  );

  return server;
}

// For stdio mode, create a single server instance
const server = createServer();

// ---------------------------------------------------------------------------
// Bearer auth middleware for HTTP mode
// ---------------------------------------------------------------------------
function requireBearerAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    const metadataUrl = `http://localhost:${MCP_PORT}/.well-known/oauth-protected-resource`;
    res
      .status(401)
      .set("WWW-Authenticate", `Bearer resource_metadata="${metadataUrl}"`)
      .json({
        error: "invalid_token",
        error_description: "Missing bearer token",
      });
    return;
  }
  // Forward the OAuth access token to the Runa API for validation
  // The Runa API introspect endpoint validates it and we use the resulting JWT
  const token = authHeader.slice(7);

  // Validate token via introspection
  fetch(`${BASE_URL}/api/oauth/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
    .then((r) => r.json())
    .then((result) => {
      if (!result.active) {
        const metadataUrl = `http://localhost:${MCP_PORT}/.well-known/oauth-protected-resource`;
        res
          .status(401)
          .set(
            "WWW-Authenticate",
            `Bearer error="invalid_token", resource_metadata="${metadataUrl}"`,
          )
          .json({
            error: "invalid_token",
            error_description: "Token expired or revoked",
          });
        return;
      }
      // Use the OAuth token directly — the Runa API also accepts it via introspection
      // But for simplicity, we'll use the API key if set, or pass the token through
      currentBearerToken = token;
      next();
    })
    .catch(() => {
      res.status(500).json({
        error: "server_error",
        error_description: "Token validation failed",
      });
    });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  if (MODE === "stdio") {
    if (!API_KEY) {
      console.error(
        "Warning: RUNA_API_KEY is not set. Authenticated endpoints will fail.",
      );
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // ── HTTP mode with OAuth ──────────────────────────────────────────
  const app = express();
  app.use(
    cors({
      exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
      origin: "*",
    }),
  );
  app.use(express.json());

  // OAuth Protected Resource Metadata (RFC 9728)
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: `http://localhost:${MCP_PORT}/mcp`,
      authorization_servers: [`${BASE_URL}`],
      scopes_supported: ["openid", "profile", "offline_access"],
    });
  });

  // Session management
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) delete transports[sid];
        };

        const newServer = createServer();
        await newServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  const mcpGetHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  const mcpDeleteHandler = async (
    req: express.Request,
    res: express.Response,
  ) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  // Mount routes with bearer auth
  app.post("/mcp", requireBearerAuth, mcpHandler);
  app.get("/mcp", requireBearerAuth, mcpGetHandler);
  app.delete("/mcp", requireBearerAuth, mcpDeleteHandler);

  app.listen(MCP_PORT, () => {
    console.log(`Runa MCP server (HTTP + OAuth) listening on port ${MCP_PORT}`);
    console.log(`  MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
    console.log(
      `  Protected Resource Metadata: http://localhost:${MCP_PORT}/.well-known/oauth-protected-resource`,
    );
    console.log(
      `  Auth server: ${BASE_URL}/.well-known/oauth-authorization-server`,
    );
  });

  process.on("SIGINT", async () => {
    for (const sid of Object.keys(transports)) {
      await transports[sid].close();
      delete transports[sid];
    }
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
