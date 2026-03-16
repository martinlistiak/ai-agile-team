import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { FaGithub, FaGitlab } from "react-icons/fa";
import {
  FiCopy,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";

interface ApiKeyEntry {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/* ── Git Connections ─────────────────────────── */

function GitConnections() {
  const { user } = useAuth();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const handleDisconnect = async (provider: "github" | "gitlab") => {
    setDisconnecting(provider);
    try {
      await api.post(`/integrations/${provider}/disconnect`);
      window.location.reload();
    } catch {
      /* ignore */
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnect = (provider: "github" | "gitlab") => {
    window.location.href = `/api/auth/${provider}`;
  };

  const providers = [
    {
      key: "github" as const,
      label: "GitHub",
      icon: <FaGithub size={20} />,
      connected: !!user?.hasGithub,
      description:
        "Pull repositories, create branches, and open pull requests.",
    },
    {
      key: "gitlab" as const,
      label: "GitLab",
      icon: <FaGitlab size={20} style={{ color: "#fc6d26" }} />,
      connected: !!user?.hasGitlab,
      description: "Connect your GitLab account for repository access.",
    },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Git connections
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Link your accounts to pull repositories into spaces.
      </p>
      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.key}
            className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
          >
            <div className="text-gray-700 dark:text-gray-300">{p.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {p.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {p.description}
              </p>
            </div>
            {p.connected ? (
              <button
                onClick={() => handleDisconnect(p.key)}
                disabled={disconnecting === p.key}
                className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                {disconnecting === p.key ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={() => handleConnect(p.key)}
                className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── API Keys ────────────────────────────────── */

function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const { data } = await api.get("/integrations/api-keys");
      setKeys(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/integrations/api-keys", {
        name: newKeyName.trim(),
      });
      setRevealedKey(data.key);
      setNewKeyName("");
      fetchKeys();
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await api.delete(`/integrations/api-keys/${id}`);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        API keys
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Use API keys to authenticate requests to the Runa public API.{" "}
        <a
          href="/docs"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          View API docs →
        </a>
      </p>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
            Copy this key now — you won't see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-gray-800 dark:text-gray-200 border border-amber-200 dark:border-amber-800 select-all break-all">
              {revealedKey}
            </code>
            <button
              onClick={() => handleCopy(revealedKey)}
              className="cursor-pointer shrink-0 p-2 rounded-md hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors text-amber-700 dark:text-amber-400"
              title="Copy"
            >
              {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="cursor-pointer text-xs text-amber-600 dark:text-amber-400 mt-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name, e.g. CI/CD"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newKeyName.trim() || creating}
          className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiPlus size={13} />
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-4">
          No API keys yet. Create one above to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {k.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {k.prefix}…
                  {k.lastUsedAt && (
                    <span className="ml-2 font-sans">
                      Last used{" "}
                      {new Date(k.lastUsedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {new Date(k.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() => handleRevoke(k.id)}
                className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Revoke key"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── MCP Section ─────────────────────────────── */

function McpSection() {
  const [showToken, setShowToken] = useState(false);

  const exampleConfig = `{
  "mcpServers": {
    "runa": {
      "url": "${window.location.origin}/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}`;

  const oauthConfig = `{
  "mcpServers": {
    "runa": {
      "url": "${window.location.origin}/api/mcp/sse",
      "auth": {
        "type": "oauth",
        "authorizationUrl": "${window.location.origin}/api/oauth/authorize",
        "tokenUrl": "${window.location.origin}/api/oauth/token",
        "clientId": "<YOUR_CLIENT_ID>",
        "scopes": ["read", "write"]
      }
    }
  }
}`;

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        MCP server
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Connect Runa to AI coding assistants via the Model Context Protocol. Use
        an API key or OAuth to authenticate.
      </p>

      <div className="space-y-4">
        {/* API Key auth */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              API key authentication
            </h3>
            <button
              onClick={() => setShowToken((v) => !v)}
              className="cursor-pointer inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {showToken ? <FiEyeOff size={12} /> : <FiEye size={12} />}
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          {showToken && (
            <pre className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 overflow-x-auto font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
              {exampleConfig}
            </pre>
          )}
          {!showToken && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Add this to your MCP client config. Create an API key above first.
            </p>
          )}
        </div>

        {/* OAuth flow */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            OAuth authentication
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            For MCP clients that support OAuth, use the authorization flow
            below. This provides scoped access without sharing long-lived keys.
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                MCP config (OAuth)
              </span>
            </div>
            <pre className="text-xs p-4 overflow-x-auto font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
              {oauthConfig}
            </pre>
          </div>
        </div>

        {/* Endpoints reference */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Endpoints
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { method: "GET", path: "/api/mcp/sse", desc: "SSE transport" },
              {
                method: "POST",
                path: "/api/mcp/message",
                desc: "Message transport",
              },
              {
                method: "GET",
                path: "/api/oauth/authorize",
                desc: "OAuth authorization",
              },
              {
                method: "POST",
                path: "/api/oauth/token",
                desc: "Token exchange",
              },
            ].map((ep) => (
              <div key={ep.path} className="flex items-center gap-3">
                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 w-10 shrink-0">
                  {ep.method}
                </span>
                <code className="font-mono text-gray-600 dark:text-gray-400 flex-1">
                  {ep.path}
                </code>
                <span className="text-gray-400 dark:text-gray-500">
                  {ep.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Main Page ───────────────────────────────── */

export function IntegrationsPage() {
  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Integrations
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage connections, API access, and MCP configuration.
        </p>
      </div>

      <div className="space-y-12">
        <GitConnections />
        <ApiKeys />
        <McpSection />
      </div>
    </div>
  );
}
