import { Reveal } from "./primitives";

const checkItems = [
  "Define custom system prompts and instructions",
  "Chat with your custom agents like any built-in agent",
  "Combine with space and agent rules for full control",
];

const examples = [
  {
    name: "Security Auditor",
    prompt: "Review code for security vulnerabilities, OWASP top 10...",
    color: "#ef4444",
  },
  {
    name: "Docs Writer",
    prompt: "Generate comprehensive API documentation and README files...",
    color: "#3b82f6",
  },
  {
    name: "Performance Reviewer",
    prompt: "Analyze code for performance bottlenecks, N+1 queries...",
    color: "#22c55e",
  },
];

export function CustomAgentsSection() {
  return (
    <section className="px-6 pb-28">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div
            className="rounded-xl border p-8 md:p-12"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-raised)",
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-16">
              <div className="md:w-1/2">
                <p
                  className="text-[13px] font-medium tracking-wide uppercase mb-3"
                  style={{ color: "var(--accent)" }}
                >
                  Custom agents
                </p>
                <h3
                  className="font-display tracking-[-0.01em] mb-4"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}
                >
                  Build agents with
                  <br />
                  your own rules
                </h3>
                <p
                  className="text-[14px] leading-relaxed mb-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Go beyond the built-in four. Create custom agents with
                  predefined instructions, system prompts, and specialized roles
                  tailored to your workflow. Security auditor, docs writer, API
                  designer -- you name it.
                </p>
                <div
                  className="flex flex-col gap-3 text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {checkItems.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="shrink-0 mt-0.5"
                        style={{ color: "var(--accent)" }}
                      >
                        <path
                          d="M4 8l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:w-1/2">
                <div
                  className="rounded-lg border p-5 space-y-3"
                  style={{
                    borderColor: "var(--border-light)",
                    background: "oklch(0.97 0.004 239)",
                  }}
                >
                  {examples.map((ex) => (
                    <div
                      key={ex.name}
                      className="flex items-start gap-3 rounded-lg bg-white p-3 border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: ex.color }}
                      >
                        {ex.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-stone-800">
                          {ex.name}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {ex.prompt}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-2.5 text-[11px] font-medium"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>+</span> Create your own agent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
