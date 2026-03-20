import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";

/* ─────────────────────────────────────────────
   React Bits–inspired components (zero deps)
   ───────────────────────────────────────────── */

function GradientText({
  children,
  colors = ["#6366f1", "#a855f7", "#ec4899", "#6366f1"],
  animationSpeed = 6,
  className = "",
}: {
  children: ReactNode;
  colors?: string[];
  animationSpeed?: number;
  className?: string;
}) {
  const gradient = colors.join(", ");
  return (
    <span
      className={className}
      style={{
        backgroundImage: `linear-gradient(90deg, ${gradient})`,
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: `gradient-shift ${animationSpeed}s ease-in-out infinite alternate`,
      }}
    >
      {children}
    </span>
  );
}

function CountUp({
  to,
  from = 0,
  duration = 2,
  className = "",
  suffix = "",
}: {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = (now - start) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setValue(Math.round(from + (to - from) * eased));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, from, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Staggered reveal on scroll
   ───────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Integration logos carousel (infinite marquee)
   ───────────────────────────────────────────── */

const integrationLogos = [
  {
    name: "GitHub",
    svg: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    name: "GitLab",
    svg: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="m23.6 9.593-.033-.086L20.3.98a.851.851 0 0 0-.336-.405.868.868 0 0 0-1.003.067.868.868 0 0 0-.29.44l-2.208 6.763H7.538L5.33 1.082a.857.857 0 0 0-.29-.44.868.868 0 0 0-1.003-.067.854.854 0 0 0-.336.405L.433 9.502l-.032.09a6.07 6.07 0 0 0 2.012 7.01l.01.008.028.02 4.97 3.722 2.458 1.86 1.496 1.13a1.008 1.008 0 0 0 1.22 0l1.496-1.13 2.458-1.86 5-3.745.012-.01a6.073 6.073 0 0 0 2.006-7.004z" />
      </svg>
    ),
  },
  {
    name: "Anthropic",
    svg: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="M17.304 3.541h-3.483l6.15 16.918h3.483l-6.15-16.918zm-10.608 0L.546 20.459H4.15l1.262-3.471h6.478l1.262 3.471h3.604L10.606 3.541H6.696zm.59 10.444 2.063-5.674 2.063 5.674H7.286z" />
      </svg>
    ),
  },
  {
    name: "OpenAI",
    svg: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
  },
];

function LogoCarousel() {
  return (
    <div className="logo-carousel-track" aria-label="Integration partners">
      <div className="logo-carousel-inner">
        {[...integrationLogos, ...integrationLogos, ...integrationLogos].map(
          (logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex items-center gap-2.5 px-6 shrink-0"
              style={{ color: "var(--text-tertiary)" }}
            >
              {logo.svg}
              <span className="text-[13px] font-medium whitespace-nowrap">
                {logo.name}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Mini app mockups (using real app patterns)
   ───────────────────────────────────────────── */

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
        {
          title: "API rate limiting",
          priority: "critical",
          color: "#ef4444",
        },
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
                    style={{
                      backgroundColor: `${t.color}18`,
                      color: t.color,
                    }}
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
    {
      type: "PM",
      name: "Product Manager",
      status: "idle",
      color: "#3b82f6",
      statusColor: "#a8a29e",
    },
    {
      type: "DE",
      name: "Developer",
      status: "active",
      color: "#8b5cf6",
      statusColor: "#22c55e",
    },
    {
      type: "CR",
      name: "Code Reviewer",
      status: "idle",
      color: "#f59e0b",
      statusColor: "#a8a29e",
    },
    {
      type: "QA",
      name: "Tester",
      status: "active",
      color: "#22c55e",
      statusColor: "#22c55e",
    },
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

/* ─────────────────────────────────────────────
   Pricing toggle
   ───────────────────────────────────────────── */

function PricingToggle({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="inline-flex items-center gap-3 text-sm">
      <span
        className={`transition-colors ${!annual ? "text-stone-900 font-medium" : "text-stone-400"}`}
      >
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={annual}
        onClick={() => onChange(!annual)}
        className="relative w-11 h-6 rounded-full cursor-pointer"
        style={{
          backgroundColor: annual ? "#6366f1" : "#d6d3d1",
          transition: "background-color 0.2s ease",
        }}
        aria-label="Toggle annual billing"
      >
        <span
          className="absolute top-[2px] left-0 w-5 h-5 rounded-full bg-white shadow-sm"
          style={{
            transform: annual ? "translateX(22px)" : "translateX(2px)",
            transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </button>
      <span
        className={`transition-colors ${annual ? "text-stone-900 font-medium" : "text-stone-400"}`}
      >
        Annual
        <span className="ml-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
          Save 20%
        </span>
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main HomePage
   ───────────────────────────────────────────── */

export function HomePage() {
  const [annual, setAnnual] = useState(true);
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      description: "For solo developers and small side projects",
      price: annual ? 0 : 0,
      priceLabel: "Free",
      features: [
        "1 space",
        "3 AI agent runs / day",
        "Basic kanban board",
        "Community support",
        "GitHub integration",
      ],
      cta: "Get started free",
      style: "default" as const,
    },
    {
      name: "Team",
      description: "For growing teams shipping real products",
      price: annual ? 39 : 46,
      features: [
        "Unlimited spaces",
        "Unlimited agent runs",
        "Full pipeline automation",
        "Custom agents & rules",
        "Code review agent",
        "Priority support",
        "Audit log & history",
        "Team collaboration",
      ],
      cta: "Start 14-day trial",
      style: "featured" as const,
    },
    {
      name: "Enterprise",
      description: "For organizations with advanced needs",
      price: annual ? 89 : 109,
      features: [
        "Everything in Team",
        "SSO & SAML",
        "Custom agent training",
        "Dedicated support",
        "SLA guarantee",
        "On-premise option",
        "Advanced analytics",
        "API access",
      ],
      cta: "Talk to sales",
      style: "default" as const,
    },
  ];

  return (
    <div className="homepage-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');

        .homepage-root {
          --hue-brand: 239;
          --surface: oklch(0.985 0.004 var(--hue-brand));
          --surface-raised: oklch(1 0 0);
          --text-primary: oklch(0.18 0.02 var(--hue-brand));
          --text-secondary: oklch(0.45 0.01 var(--hue-brand));
          --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
          --accent: oklch(0.55 0.22 var(--hue-brand));
          --accent-soft: oklch(0.55 0.22 var(--hue-brand) / 0.08);
          --accent-medium: oklch(0.55 0.22 var(--hue-brand) / 0.15);
          --border: oklch(0.88 0.008 var(--hue-brand));
          --border-light: oklch(0.93 0.005 var(--hue-brand));

          font-family: 'DM Sans', system-ui, sans-serif;
          color: var(--text-primary);
          background: var(--surface);
          min-height: 100vh;
          overflow-x: hidden;
        }

        .homepage-root * {
          box-sizing: border-box;
        }

        .font-display {
          font-family: 'Instrument Serif', Georgia, serif;
        }

        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        @keyframes float-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        .mockup-shadow {
          box-shadow:
            0 1px 2px rgba(0,0,0,0.04),
            0 4px 12px rgba(0,0,0,0.03),
            0 16px 40px rgba(0,0,0,0.04);
        }

        .plan-featured {
          background: var(--surface-raised);
          box-shadow:
            0 0 0 1px var(--accent),
            0 4px 24px oklch(0.55 0.22 239 / 0.12),
            0 12px 48px oklch(0.55 0.22 239 / 0.06);
        }

        .plan-default {
          background: var(--surface-raised);
          box-shadow: 0 0 0 1px var(--border);
        }

        .plan-default:hover,
        .plan-featured:hover {
          transform: translateY(-2px);
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .nav-blur {
          backdrop-filter: blur(12px) saturate(1.4);
          -webkit-backdrop-filter: blur(12px) saturate(1.4);
          background: oklch(0.985 0.004 239 / 0.85);
        }

        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }

        .logo-carousel-track {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        .logo-carousel-inner {
          display: flex;
          width: max-content;
          animation: marquee-scroll 20s linear infinite;
        }

        .logo-carousel-track:hover .logo-carousel-inner {
          animation-play-state: paused;
        }
      `}</style>

      {/* ── Navigation ── */}
      <PublicNav />

      {/* ── Hero ── */}
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
              <div className="flex items-center gap-3">
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  Start building free
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
                  No credit card required
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── App mockup ── */}
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
                {/* Sidebar */}
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

                {/* Agent rail */}
                <MiniAgentPanel />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Header bar */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <div>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Runa Project
                      </span>
                    </div>
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

                  {/* Kanban */}
                  <MiniKanbanBoard />

                  {/* Audit log */}
                  <MiniAuditLog />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-8 py-8">
              {[
                { value: 12000, suffix: "+", label: "Tickets automated" },
                { value: 340, suffix: "+", label: "Teams shipping" },
                { value: 98, suffix: "%", label: "Pipeline success rate" },
                { value: 4.2, suffix: "×", label: "Faster delivery" },
              ].map((stat, i) => (
                <div key={i} className="text-center flex-1 min-w-[140px]">
                  <div
                    className="font-display text-4xl tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <CountUp
                      to={stat.value}
                      duration={2.2}
                      suffix={stat.suffix}
                    />
                  </div>
                  <p
                    className="text-[13px] mt-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Integration logos ── */}
      <section className="px-6 pb-20">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p
              className="text-center text-[12px] font-medium tracking-wide uppercase mb-6"
              style={{ color: "var(--text-tertiary)" }}
            >
              Integrates with your stack
            </p>
            <LogoCarousel />
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 pb-28">
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
            {[
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
            ].map((feature, i) => (
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

      {/* ── Pipeline visual ── */}
      <section id="how-it-works" className="px-6 pb-28">
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
                    Create a ticket, trigger the pipeline, and watch your AI
                    team take it through planning, development, review, and
                    testing. Each stage runs automatically — you step in only
                    when you want to.
                  </p>
                </div>
                <div className="md:w-3/5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      "Backlog",
                      "Planning",
                      "Development",
                      "Review",
                      "Testing",
                      "Done",
                    ].map((stage, i) => (
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
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      PM Agent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      Developer Agent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Reviewer Agent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Tester Agent
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Custom Agents ── */}
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
                    predefined instructions, system prompts, and specialized
                    roles tailored to your workflow. Security auditor, docs
                    writer, API designer -- you name it.
                  </p>
                  <div
                    className="flex flex-col gap-3 text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {[
                      "Define custom system prompts and instructions",
                      "Chat with your custom agents like any built-in agent",
                      "Combine with space and agent rules for full control",
                    ].map((item) => (
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
                    {[
                      {
                        name: "Security Auditor",
                        prompt:
                          "Review code for security vulnerabilities, OWASP top 10...",
                        color: "#ef4444",
                      },
                      {
                        name: "Docs Writer",
                        prompt:
                          "Generate comprehensive API documentation and README files...",
                        color: "#3b82f6",
                      },
                      {
                        name: "Performance Reviewer",
                        prompt:
                          "Analyze code for performance bottlenecks, N+1 queries...",
                        color: "#22c55e",
                      },
                    ].map((example) => (
                      <div
                        key={example.name}
                        className="flex items-start gap-3 rounded-lg bg-white p-3 border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: example.color }}
                        >
                          {example.name.split(" ").map((w) => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-stone-800">
                            {example.name}
                          </p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {example.prompt}
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

      {/* ── Pricing ── */}
      <section id="pricing" className="px-6 pb-28">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p
                className="text-[13px] font-medium tracking-wide uppercase mb-3"
                style={{ color: "var(--accent)" }}
              >
                Pricing
              </p>
              <h2
                className="font-display tracking-[-0.02em] mb-6"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                Simple, transparent pricing
              </h2>
              <PricingToggle annual={annual} onChange={setAnnual} />
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div
                  className={`rounded-xl p-7 transition-transform ${
                    plan.style === "featured" ? "plan-featured" : "plan-default"
                  }`}
                >
                  {plan.style === "featured" && (
                    <span
                      className="inline-block text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full mb-4 text-white"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p
                    className="text-[13px] mb-5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {plan.description}
                  </p>
                  <div className="mb-6">
                    {plan.priceLabel ? (
                      <span className="font-display text-4xl tracking-tight">
                        {plan.priceLabel}
                      </span>
                    ) : (
                      <>
                        <span className="font-display text-4xl tracking-tight">
                          ${plan.price}
                        </span>
                        <span
                          className="text-[13px] ml-1"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          / seat / month
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      navigate(plan.name === "Starter" ? "/login" : "/billing")
                    }
                    className="w-full text-[13px] font-medium py-2.5 rounded-lg transition-all cursor-pointer mb-6"
                    style={
                      plan.style === "featured"
                        ? {
                            backgroundColor: "var(--accent)",
                            color: "white",
                          }
                        : {
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                            backgroundColor: "transparent",
                          }
                    }
                  >
                    {plan.cta}
                  </button>
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-[13px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
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
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
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
                Set up your first space in under two minutes. No credit card, no
                commitment — just a better way to build software.
              </p>
              <a
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium px-8 py-3.5 rounded-lg text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Get started for free
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
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <PublicFooter />
    </div>
  );
}
