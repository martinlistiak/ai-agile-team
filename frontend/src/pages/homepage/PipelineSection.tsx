import { Reveal } from "./primitives";

const stages = ["Backlog", "Development", "Review", "Testing", "Done"];

const agentLabels = [
  { src: "/avatars/pm.svg", label: "PM Agent" },
  { src: "/avatars/developer.svg", label: "Developer Agent" },
  { src: "/avatars/reviewer.svg", label: "Reviewer Agent" },
  { src: "/avatars/tester.svg", label: "Tester Agent" },
];

export function PipelineSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-6 pb-28">
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
              <div className="md:w-2/5">
                <p
                  className="text-[13px] font-medium tracking-wide uppercase mb-3"
                  style={{ color: "var(--accent)" }}
                >
                  Automated pipeline
                </p>
                <h3
                  className="font-display tracking-[-0.01em] mb-4"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}
                >
                  From ticket to shipped,
                  <br />
                  hands-free
                </h3>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Create a ticket, trigger the pipeline, and watch your AI team
                  take it through planning, development, review, and testing.
                  Each stage runs automatically — you step in only when you want
                  to.
                </p>
              </div>
              <div className="md:w-3/5">
                <div className="flex items-center gap-2 flex-wrap">
                  {stages.map((stage, i) => (
                    <div key={stage} className="flex items-center gap-2">
                      <div
                        className="px-3 py-2 rounded-lg text-[12px] font-medium border"
                        style={{
                          borderColor:
                            i >= 1 && i <= 4
                              ? "var(--accent)"
                              : "var(--border)",
                          backgroundColor:
                            i >= 1 && i <= 4
                              ? "var(--accent-soft)"
                              : "transparent",
                          color:
                            i >= 1 && i <= 4
                              ? "var(--accent)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {stage}
                      </div>
                      {i < 5 && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ color: "var(--border)" }}
                        >
                          <path
                            d="M6 4l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-6 flex items-center gap-4 text-[12px] flex-wrap"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {agentLabels.map((a) => (
                    <span key={a.label} className="flex items-center gap-1.5">
                      <img
                        src={a.src}
                        alt=""
                        className="w-5 h-5 rounded-full"
                      />
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
