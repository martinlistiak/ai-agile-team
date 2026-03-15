import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import type { PlanTier } from "@/types";

const PLANS = [
  {
    tier: "starter" as PlanTier,
    name: "Starter",
    description: "For solo developers and small side projects",
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: "Free",
    features: [
      "1 space",
      "3 AI agent runs / day",
      "Basic kanban board",
      "Community support",
      "GitHub integration",
    ],
  },
  {
    tier: "team" as PlanTier,
    name: "Team",
    description: "For growing teams shipping real products",
    monthlyPrice: 46,
    annualPrice: 39,
    features: [
      "Unlimited spaces",
      "Unlimited agent runs",
      "Full pipeline automation",
      "Custom agent rules",
      "Priority support",
      "Audit log & history",
      "Team collaboration",
    ],
    popular: true,
  },
  {
    tier: "enterprise" as PlanTier,
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
    ],
  },
];

export function BillingPage() {
  const { user } = useAuth();
  const [annual, setAnnual] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);

  const currentPlan = user?.planTier ?? "starter";
  const isActive =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing" ||
    currentPlan === "starter";

  const handleSubscribe = async (plan: "team" | "enterprise") => {
    setLoading(plan);
    try {
      const { data } = await api.post("/billing/checkout", {
        plan,
        interval: annual ? "annual" : "monthly",
      });
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    try {
      const { data } = await api.post("/billing/portal");
      window.location.href = data.url;
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Billing & Plan
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current plan status */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current plan
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {currentPlan}
            {user?.subscriptionStatus && user.subscriptionStatus !== "none" && (
              <span
                className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {user.subscriptionStatus}
              </span>
            )}
          </p>
          {user?.currentPeriodEnd && isActive && (
            <p className="text-xs text-gray-400 mt-0.5">
              Renews {new Date(user.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
        {currentPlan !== "starter" && (
          <button
            onClick={handleManageBilling}
            disabled={loading === "portal"}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading === "portal" ? "Loading…" : "Manage billing"}
          </button>
        )}
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span
          className={`text-sm ${!annual ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-400"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className="relative w-11 h-6 rounded-full cursor-pointer transition-colors"
          style={{ backgroundColor: annual ? "#6366f1" : "#d1d5db" }}
          aria-label="Toggle annual billing"
        >
          <span
            className="absolute top-[2px] left-0 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
            style={{
              transform: annual ? "translateX(22px)" : "translateX(2px)",
            }}
          />
        </button>
        <span
          className={`text-sm ${annual ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-400"}`}
        >
          Annual
          <span className="ml-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
            Save 20%
          </span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentPlan;
          const price = annual ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.tier}
              className={`rounded-xl p-6 border transition-all ${
                plan.popular
                  ? "border-indigo-500 shadow-[0_0_0_1px_#6366f1,0_4px_24px_rgba(99,102,241,0.12)]"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              {plan.popular && (
                <span className="inline-block text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full mb-3 text-white bg-indigo-500">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {plan.name}
              </h3>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">
                {plan.description}
              </p>
              <div className="mb-5">
                {plan.priceLabel ? (
                  <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {plan.priceLabel}
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                      ${price}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">
                      / seat / mo
                    </span>
                  </>
                )}
              </div>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full text-sm font-medium py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 cursor-default mb-5"
                >
                  Current plan
                </button>
              ) : plan.tier === "starter" ? (
                currentPlan !== "starter" ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={loading === "portal"}
                    className="w-full text-sm font-medium py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer mb-5"
                  >
                    Downgrade
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full text-sm font-medium py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 cursor-default mb-5"
                  >
                    Current plan
                  </button>
                )
              ) : (
                <button
                  onClick={() =>
                    handleSubscribe(plan.tier as "team" | "enterprise")
                  }
                  disabled={loading === plan.tier}
                  className={`w-full text-sm font-medium py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 mb-5 ${
                    plan.popular
                      ? "bg-indigo-500 text-white hover:bg-indigo-600"
                      : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {loading === plan.tier ? "Loading…" : "Upgrade"}
                </button>
              )}

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-400"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="shrink-0 mt-0.5 text-indigo-500"
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
          );
        })}
      </div>
    </div>
  );
}
