import { Reveal, GradientText } from "./primitives";

export function HeroSection() {
  return (
    <section className="pt-32 pb-8 px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[680px]">
          <Reveal>
            <p
              className="text-[13px] font-medium tracking-wide uppercase mb-4"
              style={{ color: "var(--accent)" }}
            >
              AI-powered project management
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1
              className="font-display leading-[1.05] tracking-[-0.02em] mb-6"
              style={{ fontSize: "clamp(2.8rem, 6vw, 4.2rem)" }}
            >
              Your agile team,{" "}
              <GradientText
                className="font-display"
                colors={["#6366f1", "#a855f7", "#ec4899", "#6366f1"]}
                animationSpeed={8}
              >
                automated
              </GradientText>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p
              className="text-lg leading-relaxed max-w-[520px] mb-8"
              style={{ color: "var(--text-secondary)" }}
            >
              Runa gives you a PM, Developer, Code Reviewer, and Tester — four
              AI agents that plan, code, review, and ship your tickets through
              an automated pipeline. Plus, create custom agents with your own
              instructions.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="flex items-center gap-3 ">
              <a
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-lg text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Start 7-day trial
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 7h12m0 0L8 2m5 5L8 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <span
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Card required; cancel anytime during trial
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
