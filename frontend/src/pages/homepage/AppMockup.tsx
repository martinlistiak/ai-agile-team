import { Reveal } from "./primitives";

function MiniKanbanBoard() {
  const columns = [
    {
      name: "Backlog",
      dot: "#a8a29e",
      tickets: [
        { title: "Set up CI pipeline", priority: "medium", color: "#eab308" },
        { title: "Design system tokens", priority: "low", color: "#a8a29e" },
      ],
    },
    {
      name: "Development",
      dot: "#8b5cf6",
      tickets: [
        {
          title: "Auth flow with OAuth",
          priority: "high",
          color: "#f97316",
          agent: "DE",
          agentColor: "#8b5cf6",
          active: true,
        },
        { title: "API rate limiting", priority: "critical", color: "#ef4444" },
      ],
    },
    {
      name: "Testing",
      dot: "#22c55e",
      tickets: [
        {
          title: "E2E checkout tests",
          priority: "high",
          color: "#f97316",
          agent: "QA",
          agentColor: "#22c55e",
          active: true,
        },
      ],
    },
    {
      name: "Done",
      dot: "#22c55e",
      tickets: [
        { title: "User registration", priority: "medium", color: "#eab308" },
      ],
    },
  ];

  return (
    <div className="flex gap-3 p-4 overflow-hidden" style={{ minWidth: 560 }}>
      {columns.map((col) => (
        <div key={col.name} className="flex-1 min-w-[120px]">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: col.dot }}
            />
            <span className="text-[10px] font-semibold tracking-wide uppercase text-stone-500">
              {col.name}
            </span>
            <span className="text-[10px] text-stone-400 ml-auto">
              {col.tickets.length}
            </span>
          </div>
          <div className="space-y-2">
            {col.tickets.map((t) => (
              <div
                key={t.title}
                className="rounded-md p-2.5 bg-white border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                style={
                  t.active
                    ? {
                        boxShadow: `0 0 0 1.5px ${t.agentColor}40, 0 1px 2px rgba(0,0,0,0.04)`,
                      }
                    : undefined
                }
              >
                <p className="text-[11px] font-medium text-stone-800 leading-snug">
                  {t.title}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${t.color}18`, color: t.color }}
                  >
                    {t.priority}
                  </span>
                  {t.agent && (
                    <span
                      className="text-[9px] font-bold text-white w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: t.agentColor }}
                    >
                      {t.agent}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniAgentPanel() {
  const agents = [
    { type: "PM", color: "#3b82f6", statusColor: "#a8a29e" },
    { type: "DE", color: "#8b5cf6", statusColor: "#22c55e" },
    { type: "CR", color: "#f59e0b", statusColor: "#a8a29e" },
    { type: "QA", color: "#22c55e", statusColor: "#22c55e" },
  ];

  return (
    <div className="flex flex-col items-center gap-3 py-4 px-2 bg-stone-50 border-r border-stone-200 rounded-l-lg">
      {agents.map((a) => (
        <div key={a.type} className="relative">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: a.color }}
          >
            {a.type}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-stone-50"
            style={{ backgroundColor: a.statusColor }}
          />
        </div>
      ))}
    </div>
  );
}

function MiniAuditLog() {
  const events = [
    { time: "14:32:08", icon: "⚡", text: "Developer executed write_file" },
    {
      time: "14:31:55",
      icon: "✓",
      text: "Pipeline completed development → testing",
    },
    { time: "14:31:12", icon: "+", text: "Ticket created" },
  ];

  return (
    <div className="border-t border-stone-200 bg-stone-50 px-3 py-2 rounded-b-lg">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-stone-500 mb-1.5">
        <span>◉</span>
        <span>Audit Log</span>
        <span className="text-stone-400">(3)</span>
      </div>
      <div className="space-y-0.5">
        {events.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[10px] text-stone-600 px-1 py-0.5"
          >
            <span className="text-stone-400 tabular-nums">{e.time}</span>
            <span>{e.icon}</span>
            <span className="truncate">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppMockup() {
  return (
    <section className="px-6 pb-24">
      <div className="max-w-[1200px] mx-auto">
        <Reveal delay={0.3}>
          <div
            className="mockup-shadow rounded-xl overflow-hidden border"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-raised)",
            }}
          >
            <div className="flex">
              <div
                className="w-14 shrink-0 flex flex-col items-center gap-3 py-4 border-r"
                style={{
                  borderColor: "var(--border-light)",
                  background: "oklch(0.97 0.004 239)",
                }}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                  M
                </div>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: "#8b5cf6" }}
                >
                  R
                </div>
                <div
                  className="w-8 h-8 rounded-xl border-2 border-dashed flex items-center justify-center text-[10px]"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  +
                </div>
              </div>
              <MiniAgentPanel />
              <div className="flex-1 min-w-0">
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Runa Project
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium px-2 py-1 rounded-md"
                      style={{
                        backgroundColor: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      + New Ticket
                    </span>
                    <span
                      className="text-[10px] font-medium px-2 py-1 rounded-md border"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      ⚡ Pipeline
                    </span>
                  </div>
                </div>
                <MiniKanbanBoard />
                <MiniAuditLog />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
