import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Reveal } from "./primitives";

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

const plans = [
  {
    name: "Starter",
    description: "For solo developers and small side projects",
    monthlyPrice: 19,
    annualPrice: 15,
    features: [
      "10 AI agent runs / day",
      "Basic kanban board",
      "Community support",
      "GitHub integration",
      "Unlimited team members",
    ],
    cta: "Start 7-day free trial",
    style: "default" as const,
  },
  {
    name: "Team",
    description: "For growing teams shipping real products",
    monthlyPrice: 46,
    annualPrice: 39,
    features: [
      "50 AI agent runs / day",
      "Full pipeline automation",
      "Custom agents & rules",
      "Code review agent",
      "Priority support",
      "Audit log & history",
      "Unlimited team members",
    ],
    cta: "Start 7-day free trial",
    style: "featured" as const,
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced needs",
    monthlyPrice: 109,
    annualPrice: 89,
    features: [
      "Everything in Team",
      "SSO & SAML",
      "Custom agent training",
      "Dedicated support",
      "SLA guarantee",
      "On-premise option",
      "Advanced analytics",
      "API access",
      "Unlimited team members",
    ],
    cta: "Start 7-day free trial",
    style: "default" as const,
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(true);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const goToSubscribeFlow = () => {
    if (isAuthenticated) {
      navigate("/billing");
      return;
    }
    navigate("/login?register=1&next=/billing");
  };

  return (
    <section id="pricing" className="scroll-mt-20 px-6 pb-28">
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
            <p
              className="text-[13px] mt-5 max-w-lg mx-auto"
              style={{ color: "var(--text-tertiary)" }}
            >
              All plans are paid with a 7-day free trial. Card required; cancel
              before the trial ends and you will not be charged.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            return (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div
                  className={`rounded-xl p-7 transition-transform ${plan.style === "featured" ? "plan-featured" : "plan-default"}`}
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
                    <span className="font-display text-4xl tracking-tight">
                      ${price}
                    </span>
                    <span
                      className="text-[13px] ml-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      / space / month
                      {annual ? " (billed annually)" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={goToSubscribeFlow}
                    className="w-full text-[13px] font-medium py-2.5 rounded-lg transition-all cursor-pointer mb-6"
                    style={
                      plan.style === "featured"
                        ? { backgroundColor: "var(--accent)", color: "white" }
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
