import { Reveal } from "./primitives";

const features = [
  {
    agent: "PM",
    agentColor: "#3b82f6",
    title: "Product Manager",
    desc: "Breaks down your ideas into well-scoped tickets with acceptance criteria. Reviews completed work and moves tickets through the pipeline.",
    detail: "Planning → Review",
  },
  {
    agent: "DE",
    agentColor: "#8b5cf6",
    title: "Developer",
    desc: "Writes code, creates pull requests, and pushes to GitHub. Follows your custom rules and coding standards automatically.",
    detail: "Development → Code",
  },
  {
    agent: "CR",
    agentColor: "#f59e0b",
    title: "Code Reviewer",
    desc: "Reviews pull requests for correctness, security, and code quality. Posts actionable feedback and approves or requests changes.",
    detail: "Review → Feedback",
  },
  {
    agent: "QA",
    agentColor: "#22c55e",
    title: "Tester",
    desc: "Runs tests, validates behavior, and catches regressions. Reports issues back to the developer agent for fixes.",
    detail: "Testing → Quality",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 px-6 pb-28">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <p
            className="text-[13px] font-medium tracking-wide uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            How it works
          </p>
          <h2
            className="font-display tracking-[-0.02em] mb-16"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Four agents. One pipeline.
            <br />
            <span style={{ color: "var(--text-tertiary)" }}>
              Zero busywork.
            </span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div
                className="p-6 rounded-xl border transition-all"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-raised)",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ backgroundColor: feature.agentColor }}
                  >
                    {feature.agent}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{feature.title}</p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {feature.detail}
                    </p>
                  </div>
                </div>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {feature.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
