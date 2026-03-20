# Runa MCP Server

MCP server for the Runa API. Supports two transport modes:

- **stdio** — API key auth, for local tools (Kiro, Cursor, Claude Desktop via command)
- **HTTP** — OAuth 2.1 (PKCE), for remote/browser-based clients (Claude Desktop via URL, web apps)

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## stdio mode (default)

Uses a `RUNA_API_KEY` for auth. Good for local dev.

```bash
RUNA_API_KEY=runa_... node dist/index.js
```

Already configured in `.kiro/settings/mcp.json` and `.cursor/mcp.json`.

## HTTP mode with OAuth

Runs as an HTTP server on port 3002. MCP clients discover the OAuth server via `/.well-known/oauth-protected-resource`, register dynamically, and go through a PKCE authorization code flow with the Runa backend.

```bash
RUNA_API_URL=http://localhost:3001 npm run start:http
```

The flow:

1. Client connects to `http://localhost:3002/mcp`
2. Server responds 401 with `WWW-Authenticate` pointing to protected resource metadata
3. Client fetches `/.well-known/oauth-protected-resource` → discovers auth server
4. Client fetches `/.well-known/oauth-authorization-server` from Runa backend → gets endpoints
5. Client registers dynamically via `/api/oauth/register`
6. Client redirects user to `/api/oauth/authorize/login` for login + consent
7. User logs in, gets redirected back with an authorization code
8. Client exchanges code + PKCE verifier for access/refresh tokens at `/api/oauth/token`
9. Client uses the access token as Bearer on all MCP requests

## Environment Variables

| Variable       | Description            | Default                 |
| -------------- | ---------------------- | ----------------------- |
| `RUNA_API_URL` | Backend API base URL   | `http://localhost:3001` |
| `RUNA_API_KEY` | API key for stdio mode | —                       |
| `MCP_PORT`     | HTTP server port       | `3002`                  |

## 38 Tools

Auth, Spaces, Tickets, Agents, Pipeline, Chat, Rules, Teams, Health — see tool list in source.
