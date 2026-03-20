import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useEnterpriseTeams,
  useAnalyticsDashboard,
  useSsoConfig,
  useSaveSso,
  useToggleSso,
  useDeleteSso,
  useTrainingAgents,
  useTrainings,
  useCreateTraining,
  useApplyTraining,
  useDeleteTraining,
  useSlaStatus,
  useConfigureSla,
  type SsoConfig,
  type SlaStatus,
} from "@/api/hooks/useEnterprise";

type Tab = "sso" | "training" | "sla" | "analytics";

export function EnterprisePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("analytics");
  const { data: teams = [], isLoading: loading } = useEnterpriseTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const isEnterprise = user?.planTier === "enterprise";

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  if (!isEnterprise) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Enterprise
        </h1>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Enterprise features require an Enterprise plan.
          </p>
          <a
            href="/billing"
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            Upgrade to Enterprise
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "analytics", label: "Analytics" },
    { key: "sso", label: "SSO / SAML" },
    { key: "training", label: "Agent Training" },
    { key: "sla", label: "SLA" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Enterprise
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Advanced features for your organization
        </p>
      </div>

      {teams.length > 1 && (
        <div className="mb-4">
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-gray-100"
            aria-label="Select team"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selectedTeamId && (
        <>
          {tab === "analytics" && <AnalyticsTab teamId={selectedTeamId} />}
          {tab === "sso" && <SsoTab teamId={selectedTeamId} />}
          {tab === "training" && <TrainingTab />}
          {tab === "sla" && <SlaTab teamId={selectedTeamId} />}
        </>
      )}
    </div>
  );
}

// ── Analytics Tab ──

function AnalyticsTab({ teamId }: { teamId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading: loading } = useAnalyticsDashboard(teamId, days);

  if (loading)
    return (
      <div className="text-gray-400 py-8 text-center">Loading analytics…</div>
    );
  if (!data)
    return (
      <div className="text-gray-400 py-8 text-center">No data available</div>
    );

  const { overview } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Dashboard
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
          aria-label="Time range"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Executions" value={overview.totalExecutions} />
        <StatCard
          label="Success Rate"
          value={`${overview.successRate.toFixed(1)}%`}
        />
        <StatCard
          label="Avg Response"
          value={`${overview.avgExecutionTimeMs}ms`}
        />
        <StatCard label="Active Agents" value={overview.activeAgents} />
        <StatCard label="Total Tickets" value={overview.totalTickets} />
        <StatCard label="Tickets Done" value={overview.ticketsCompleted} />
      </div>

      {data.agentPerformance.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Agent Performance
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-2 font-medium">Agent</th>
                <th className="px-5 py-2 font-medium">Executions</th>
                <th className="px-5 py-2 font-medium">Success Rate</th>
                <th className="px-5 py-2 font-medium">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {data.agentPerformance.map((a) => (
                <tr
                  key={a.agentType}
                  className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <td className="px-5 py-2.5 text-gray-900 dark:text-gray-100 capitalize">
                    {a.agentType}
                  </td>
                  <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400">
                    {a.executions}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        a.successRate >= 90
                          ? "text-green-600"
                          : a.successRate >= 70
                            ? "text-yellow-600"
                            : "text-red-600"
                      }
                    >
                      {a.successRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400">
                    {a.avgTimeMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.topSpaces.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Top Spaces
            </p>
          </div>
          <ul>
            {data.topSpaces.map((s) => (
              <li
                key={s.spaceId}
                className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
              >
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {s.spaceName}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {s.executions} runs
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}

// ── SSO Tab ──

function SsoTab({ teamId }: { teamId: string }) {
  const { data: config, isLoading: loading } = useSsoConfig(teamId);
  const saveMutation = useSaveSso();
  const toggleMutation = useToggleSso();
  const deleteMutation = useDeleteSso();
  const [form, setForm] = useState({
    provider: "saml" as "saml" | "oidc",
    entityId: "",
    ssoUrl: "",
    certificate: "",
    metadataUrl: "",
    defaultRole: "member",
    enforceSSO: false,
  });

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider,
        entityId: config.entityId,
        ssoUrl: config.ssoUrl,
        certificate: config.certificate,
        metadataUrl: config.metadataUrl || "",
        defaultRole: config.defaultRole || "member",
        enforceSSO: config.enforceSSO,
      });
    }
  }, [config]);

  if (loading)
    return (
      <div className="text-gray-400 py-8 text-center">Loading SSO config…</div>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          {config ? "SSO Configuration" : "Set Up SSO"}
        </h2>

        {config && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div
              className={`w-2 h-2 rounded-full ${config.enabled ? "bg-green-500" : "bg-gray-400"}`}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              SSO is {config.enabled ? "enabled" : "disabled"}
            </span>
            <button
              onClick={() =>
                toggleMutation.mutate({ teamId, enabled: !config.enabled })
              }
              className="ml-auto text-xs text-indigo-500 hover:text-indigo-600"
            >
              {config.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        )}

        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider
            </label>
            <select
              value={form.provider}
              onChange={(e) =>
                setForm({
                  ...form,
                  provider: e.target.value as "saml" | "oidc",
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
              aria-label="SSO Provider"
            >
              <option value="saml">SAML 2.0</option>
              <option value="oidc">OpenID Connect</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Entity ID / Issuer
            </label>
            <input
              type="text"
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              placeholder="https://your-idp.com/entity-id"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SSO URL
            </label>
            <input
              type="url"
              value={form.ssoUrl}
              onChange={(e) => setForm({ ...form, ssoUrl: e.target.value })}
              placeholder="https://your-idp.com/sso/saml"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Certificate
            </label>
            <textarea
              value={form.certificate}
              onChange={(e) =>
                setForm({ ...form, certificate: e.target.value })
              }
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metadata URL (optional)
            </label>
            <input
              type="url"
              value={form.metadataUrl}
              onChange={(e) =>
                setForm({ ...form, metadataUrl: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enforceSSO"
              checked={form.enforceSSO}
              onChange={(e) =>
                setForm({ ...form, enforceSSO: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <label
              htmlFor="enforceSSO"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Enforce SSO (disable password login for team members)
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => saveMutation.mutate({ teamId, form })}
            disabled={
              saveMutation.isPending ||
              !form.entityId ||
              !form.ssoUrl ||
              !form.certificate
            }
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending
              ? "Saving…"
              : config
                ? "Update"
                : "Configure SSO"}
          </button>
          {config && (
            <button
              onClick={() => deleteMutation.mutate(teamId)}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              Remove SSO
            </button>
          )}
        </div>
      </div>

      {config && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            SSO Login URL
          </h3>
          <code className="block text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-gray-700 dark:text-gray-300 break-all">
            {window.location.origin}/api/enterprise/sso/{teamId}/login
          </code>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">
            SP Metadata
          </h3>
          <code className="block text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-gray-700 dark:text-gray-300 break-all">
            {window.location.origin}/api/enterprise/sso/{teamId}/metadata
          </code>
        </div>
      )}
    </div>
  );
}

// ── Training Tab ──

function TrainingTab() {
  const { data: agents = [], isLoading: loading } = useTrainingAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { data: trainings = [] } = useTrainings(selectedAgentId);
  const createMutation = useCreateTraining();
  const applyMutation = useApplyTraining();
  const deleteMutation = useDeleteTraining();
  const [name, setName] = useState("");
  const [docs, setDocs] = useState("");

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  const handleCreate = async () => {
    if (!selectedAgentId || !name.trim() || !docs.trim()) return;
    await createMutation.mutateAsync({
      agentId: selectedAgentId,
      name,
      documents: [
        { fileName: "training.txt", content: docs, mimeType: "text/plain" },
      ],
    });
    setName("");
    setDocs("");
  };

  if (loading)
    return (
      <div className="text-gray-400 py-8 text-center">Loading agents…</div>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Custom Agent Training
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload domain knowledge to train your agents with custom context.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Agent
          </label>
          <select
            value={selectedAgentId ?? ""}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            aria-label="Select agent"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.agentType}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Training Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company coding standards"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Training Content
            </label>
            <textarea
              value={docs}
              onChange={(e) => setDocs(e.target.value)}
              placeholder="Paste your documentation, coding standards, domain knowledge, or any reference material here…"
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || !name.trim() || !docs.trim()}
          className="mt-4 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? "Processing…" : "Start Training"}
        </button>
      </div>

      {trainings.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Training History
            </p>
          </div>
          <ul>
            {trainings.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t.documentCount} doc(s) ·{" "}
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      t.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : t.status === "processing"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : t.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {t.status}
                  </span>
                  {t.status === "completed" && selectedAgentId && (
                    <button
                      onClick={() =>
                        applyMutation.mutate({
                          trainingId: t.id,
                          agentId: selectedAgentId,
                        })
                      }
                      className="text-xs text-indigo-500 hover:text-indigo-600"
                    >
                      Apply
                    </button>
                  )}
                  {selectedAgentId && (
                    <button
                      onClick={() =>
                        deleteMutation.mutate({
                          trainingId: t.id,
                          agentId: selectedAgentId,
                        })
                      }
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── SLA Tab ──

function SlaTab({ teamId }: { teamId: string }) {
  const { data: sla, isLoading: loading } = useSlaStatus(teamId);
  const configureMutation = useConfigureSla();
  const [form, setForm] = useState({
    uptimeTarget: 99.9,
    responseTimeMsTarget: 500,
    resolutionTimeHoursTarget: 4,
  });

  useEffect(() => {
    if (sla) {
      setForm({
        uptimeTarget: sla.config.uptimeTarget,
        responseTimeMsTarget: sla.config.responseTimeMsTarget,
        resolutionTimeHoursTarget: sla.config.resolutionTimeHoursTarget,
      });
    }
  }, [sla]);

  if (loading)
    return <div className="text-gray-400 py-8 text-center">Loading SLA…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          SLA Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Uptime Target (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="90"
              max="100"
              value={form.uptimeTarget}
              onChange={(e) =>
                setForm({ ...form, uptimeTarget: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Response Time Target (ms)
            </label>
            <input
              type="number"
              min="100"
              value={form.responseTimeMsTarget}
              onChange={(e) =>
                setForm({
                  ...form,
                  responseTimeMsTarget: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resolution Time (hours)
            </label>
            <input
              type="number"
              min="1"
              value={form.resolutionTimeHoursTarget}
              onChange={(e) =>
                setForm({
                  ...form,
                  resolutionTimeHoursTarget: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm"
            />
          </div>
        </div>

        <button
          onClick={() => configureMutation.mutate({ teamId, form })}
          disabled={configureMutation.isPending}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {configureMutation.isPending
            ? "Saving…"
            : sla
              ? "Update Targets"
              : "Set SLA Targets"}
        </button>
      </div>

      {sla && (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${sla.compliance.overallCompliant ? "bg-green-500" : "bg-red-500"}`}
              />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {sla.compliance.overallCompliant
                  ? "All SLA targets met"
                  : "SLA targets not met"}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ComplianceCard
                label="Uptime"
                target={`${sla.config.uptimeTarget}%`}
                current={`${Number(sla.config.currentUptime).toFixed(2)}%`}
                compliant={sla.compliance.uptimeCompliant}
              />
              <ComplianceCard
                label="Response Time"
                target={`${sla.config.responseTimeMsTarget}ms`}
                current={`${sla.config.avgResponseTimeMs}ms`}
                compliant={sla.compliance.responseTimeCompliant}
              />
              <ComplianceCard
                label="Incident Resolution"
                target="95%"
                current={
                  sla.config.totalIncidents > 0
                    ? `${((sla.config.resolvedIncidents / sla.config.totalIncidents) * 100).toFixed(1)}%`
                    : "N/A"
                }
                compliant={sla.compliance.resolutionTimeCompliant}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total Incidents (30d)
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {sla.config.totalIncidents}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Resolved
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {sla.config.resolvedIncidents}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ComplianceCard({
  label,
  target,
  current,
  compliant,
}: {
  label: string;
  target: string;
  current: string;
  compliant: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 border ${compliant ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"}`}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className={`text-lg font-semibold ${compliant ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
        >
          {current}
        </span>
        <span className="text-xs text-gray-500">/ {target}</span>
      </div>
    </div>
  );
}
