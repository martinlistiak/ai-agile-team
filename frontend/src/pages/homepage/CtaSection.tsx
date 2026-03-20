import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Reveal } from "./primitives";

export function CtaSection() {
  const { isAuthenticated } = useAuth();
  const trialHref = isAuthenticated
    ? "/billing"
    : "/login?register=1&next=/billing";

  return (
    <section className="px-6 pb-24">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div
            className="rounded-xl p-12 md:p-16 text-center border"
            style={{
              borderColor: "var(--border)",
              background:
                "linear-gradient(135deg, oklch(0.97 0.01 239), oklch(0.98 0.005 300))",
            }}
          >
            <h2
              className="font-display tracking-[-0.02em] mb-4"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}
            >
              Ship faster with your AI team
            </h2>
            <p
              className="text-[15px] max-w-[440px] mx-auto mb-8 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Set up your first space in under two minutes. Every plan includes
              a 7-day free trial — cancel anytime before it ends and you will
              not be charged.
            </p>
            <Link
              to={trialHref}
              className="inline-flex items-center gap-2 text-sm font-medium px-8 py-3.5 rounded-lg text-white transition-all hover:opacity-90 no-underline"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Start your free trial
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 7h12m0 0L8 2m5 5L8 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
