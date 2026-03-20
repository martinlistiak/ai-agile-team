import { Reveal } from "./primitives";

export function StatsStrip() {
  return (
    <section className="px-6 pb-24">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-3 py-8">
            <span
              className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset ring-[var(--border-primary)]"
              style={{
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              🚀 Currently in Beta
            </span>
            <span
              className="text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Early access — join teams already exploring AI-powered delivery
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
