import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBillingUsage,
  useBillingInvoices,
  useCheckout,
  useBillingPortal,
  useCreditsBalance,
  useCreditTopUp,
} from "@/api/hooks/useBilling";
import type { PlanTier } from "@/types";

const PLANS = [
  {
    tier: "starter" as PlanTier,
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
  },
  {
    tier: "team" as PlanTier,
    name: "Team",
    description: "For growing teams shipping real products",
    monthlyPrice: 46,
    annualPrice: 39,
    features: [
      "Unlimited agent runs",
      "Full pipeline automation",
      "Custom agent rules",
      "Priority support",
      "Audit log & history",
      "Unlimited team members",
    ],
    popular: true,
  },
  {
    tier: "enterprise" as PlanTier,
    name: "Enterprise",
    description: "For organizations with advanced needs",
    monthlyPrice: null,
    annualPrice: null,
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
  },
];

function formatInvoiceAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BillingPage({ onboarding = false }: { onboarding?: boolean }) {
  const { user, refreshUser, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [annual, setAnnual] = useState(true);

  const { data: usage } = useBillingUsage();
  const hasStripeCustomer = Boolean(user?.hasStripeCustomer);
  const { data: invoicesData, isLoading: invoicesLoading } =
    useBillingInvoices(hasStripeCustomer);
  const checkoutMutation = useCheckout();
  const portalMutation = useBillingPortal();
  const { data: creditsData } = useCreditsBalance();
  const topUpMutation = useCreditTopUp();
  const [topUpAmount, setTopUpAmount] = useState(5);

  useEffect(() => {
    if (searchParams.get("session_id")) {
      void refreshUser();
    }
    if (searchParams.get("topup") === "success") {
      void refreshUser();
    }
  }, [searchParams, refreshUser]);

  const currentPlan = user?.planTier ?? "starter";
  const isActive =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing";

  const handleTopUp = async () => {
    try {
      const data = await topUpMutation.mutateAsync(topUpAmount);
      window.location.href = data.url;
    } catch (err) {
      console.error("Top-up error:", err);
    }
  };

  const handleSubscribe = async (plan: "starter" | "team" | "enterprise") => {
    try {
      const interval = annual ? "annual" : "monthly";
      const data = await checkoutMutation.mutateAsync({ plan, interval });
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  const handleManageBilling = async () => {
    try {
      const data = await portalMutation.mutateAsync();
      window.location.href = data.url;
    } catch (err) {
      console.error("Portal error:", err);
    }
  };

  const showManageBilling = hasStripeCustomer;
  const loadingPlan = checkoutMutation.isPending
    ? checkoutMutation.variables?.plan
    : null;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        {onboarding ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Choose your plan to get started
              </h1>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Log out
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select a plan below to start your 7-day free trial. A payment
              method is required; you will not be charged until the trial ends.
              Cancel anytime.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Billing & Plan
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Every plan includes a 7-day free trial. A payment method is
              required; you will not be charged until the trial ends. Cancel
              anytime.
            </p>
          </>
        )}
      </div>

      {onboarding && (
        <div
          className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 mb-6 text-sm text-amber-900 dark:text-amber-200"
          role="alert"
        >
          You must choose a plan before you can access the workspace.
        </div>
      )}

      {!onboarding && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Current plan
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
              {currentPlan}
              {user?.subscriptionStatus &&
                user.subscriptionStatus !== "none" && (
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
          {showManageBilling && (
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={portalMutation.isPending}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {portalMutation.isPending ? "Loading…" : "Manage billing"}
            </button>
          )}
        </div>
      )}

      {!onboarding && usage && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Usage this period
            </h2>
            <span className="text-xs text-gray-400">
              {new Date(usage.periodStart).toLocaleDateString()} –{" "}
              {new Date(usage.periodEnd).toLocaleDateString()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total runs
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {usage.totalRuns.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Completed
              </p>
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {usage.completedRuns.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Failed
              </p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                {usage.failedRuns.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Tokens used
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {usage.totalTokens.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Credit Top-Up ── */}
      {!onboarding && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Usage credits
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Top up credits when you run out. Credits never expire.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Balance
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                $
                {(
                  (creditsData?.creditsBalance ?? user?.creditsBalance ?? 0) /
                  100
                ).toFixed(2)}
              </p>
            </div>
          </div>

          {searchParams.get("topup") === "success" && (
            <div
              className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 mb-4 text-sm text-emerald-800 dark:text-emerald-200"
              role="status"
            >
              Credits added successfully.
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label
                htmlFor="topup-amount"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                Amount (USD)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTopUpAmount((v) => Math.max(5, v - 5))}
                  disabled={topUpAmount <= 5}
                  className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default flex items-center justify-center text-lg font-medium"
                  aria-label="Decrease amount by $5"
                >
                  −
                </button>
                <input
                  id="topup-amount"
                  type="number"
                  min={5}
                  step={5}
                  value={topUpAmount}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    if (!isNaN(raw) && raw >= 5) {
                      setTopUpAmount(Math.round(raw / 5) * 5 || 5);
                    }
                  }}
                  onBlur={() => {
                    if (topUpAmount < 5) setTopUpAmount(5);
                    else setTopUpAmount(Math.round(topUpAmount / 5) * 5 || 5);
                  }}
                  className="w-24 text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  type="button"
                  onClick={() => setTopUpAmount((v) => v + 5)}
                  className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center justify-center text-lg font-medium"
                  aria-label="Increase amount by $5"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTopUp}
              disabled={topUpMutation.isPending}
              className="px-5 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
            >
              {topUpMutation.isPending
                ? "Loading…"
                : `Add $${topUpAmount} credits`}
            </button>
          </div>
        </div>
      )}

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

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentPlan && isActive;
          const price = annual ? plan.annualPrice : plan.monthlyPrice;
          const isEnterprise = price === null;

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
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-2">
                {plan.description}
              </p>
              {!isEnterprise && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mb-3">
                  7-day free trial
                </p>
              )}
              <div className="mb-5">
                {isEnterprise ? (
                  <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    Custom
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                      ${price}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">
                      / space / mo{annual ? " (billed annually)" : ""}
                    </span>
                  </>
                )}
              </div>

              {isEnterprise ? (
                <a
                  href="mailto:sales@runa-app.com"
                  className="block w-full text-center text-sm font-medium py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all mb-5"
                >
                  Talk to sales
                </a>
              ) : isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="w-full text-sm font-medium py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 cursor-default mb-5"
                >
                  Current plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={loadingPlan === plan.tier}
                  className={`w-full text-sm font-medium py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 mb-5 ${
                    plan.popular
                      ? "bg-indigo-500 text-white hover:bg-indigo-600"
                      : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {loadingPlan === plan.tier
                    ? "Loading…"
                    : "Start 7-day free trial"}
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

      {!onboarding && (
        <div className="mt-12 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Past invoices
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Download PDF copies of your Stripe invoices. You can also manage
            payment methods from{" "}
            {showManageBilling ? (
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={portalMutation.isPending}
                className="text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                Manage billing
              </button>
            ) : (
              "Manage billing"
            )}{" "}
            in the section above.
          </p>

          {!hasStripeCustomer ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Invoice history appears here after you start a subscription or
              complete checkout with a payment method.
            </p>
          ) : invoicesLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : !invoicesData?.invoices?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No invoices yet.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm text-left min-w-lg">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Invoice</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesData.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-100 dark:border-gray-800/80 last:border-0"
                    >
                      <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {new Date(inv.created).toLocaleDateString()}
                      </td>
                      <td
                        className="py-3 pr-4 text-gray-700 dark:text-gray-300 font-mono text-xs max-w-[10rem] truncate"
                        title={inv.id}
                      >
                        {inv.number ?? inv.id}
                      </td>
                      <td className="py-3 pr-4 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatInvoiceAmount(inv.amountPaid, inv.currency)}
                      </td>
                      <td className="py-3 pr-4 capitalize text-gray-600 dark:text-gray-400">
                        {inv.status?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="py-3 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Download PDF
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
