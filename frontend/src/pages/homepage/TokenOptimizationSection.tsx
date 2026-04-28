import { Reveal } from "./primitives";

export function TokenOptimizationSection() {
  return (
    <section
      id="token-efficiency"
      className="scroll-mt-20 px-6 pb-28"
      aria-labelledby="token-efficiency-heading"
    >
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div
            className="rounded-xl border p-8 md:p-12 md:flex md:items-stretch md:gap-12 lg:gap-16"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-raised)",
            }}
          >
            <div className="md:flex-1 mb-8 md:mb-0">
              <p
                className="text-[13px] font-medium tracking-wide uppercase mb-3"
                style={{ color: "var(--accent)" }}
              >
                Token efficiency
              </p>
              <h2
                id="token-efficiency-heading"
                className="font-display tracking-[-0.02em] mb-4"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)" }}
              >
                Fewer output tokens,
                <br />
                <span style={{ color: "var(--text-tertiary)" }}>
                  same technical depth
                </span>
              </h2>
              <p
                className="text-[14px] leading-relaxed mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                Built-in prompts steer PM, developer, reviewer, and tester
                agents toward tight answers: minimal filler, bullets and
                fragments where they help, and no dropped paths, errors, or
                verdicts. That cuts what you pay for on long runs—without
                dumbing down the work.
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                The same brevity idea made famous as &quot;caveman&quot;
                prompting: many fewer words, signal unchanged. Runa ships it as
                the default so your stack spends less on model output.
              </p>
            </div>
            <aside
              className="md:w-[min(100%,400px)] w-full shrink-0 flex flex-col justify-center rounded-lg"
              style={{
                background: "var(--bg-secondary)",
              }}
            >
              <img
                src="/theoffice-kevinmalone.gif"
                alt=""
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                className="w-full max-w-[400px] h-auto mx-auto md:mx-0 rounded-md mb-4"
              />
              {/* <p
                className="font-display text-[15px] leading-snug italic mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Why use many token when few token do trick.
              </p>
              <p className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Terse by default. Optional verbose mode for your deployment.
              </p> */}
            </aside>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
