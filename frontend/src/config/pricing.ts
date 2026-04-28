import type { PlanTier } from "@/types";

/** Cost-weighted tokens you get per $1 of credit top-up */
export const TOPUP_TOKENS_PER_DOLLAR = 500_000;

/** Tokens per cent (derived) */
export const TOKENS_PER_CENT = TOPUP_TOKENS_PER_DOLLAR / 100;

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  features: string[];
  popular?: boolean;
  cta: string;
}

export const PLANS: PlanConfig[] = [
  {
    tier: "starter",
    name: "Starter",
    description: "For solo developers and small side projects",
    monthlyPrice: 19,
    annualPrice: 15,
    features: [
      "5M tokens / month",
      "Unlimited agent runs",
      "Basic kanban board",
      "Community support",
      "GitHub integration",
      "Unlimited team members",
    ],
    cta: "Start 7-day free trial",
  },
  {
    tier: "team",
    name: "Team",
    description: "For growing teams shipping real products",
    monthlyPrice: 46,
    annualPrice: 39,
    features: [
      "20M tokens / month",
      "Unlimited agent runs",
      "Full pipeline automation",
      "Custom agents & rules",
      "Code review agent",
      "Priority support",
      "Audit log & history",
      "Unlimited team members",
    ],
    popular: true,
    cta: "Start 7-day free trial",
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "For organizations with advanced needs",
    monthlyPrice: null,
    annualPrice: null,
    features: [
      "Everything in Team",
      "10M tokens / month",
      "SSO & SAML",
      "Custom agent training",
      "Dedicated support",
      "SLA guarantee",
      "On-premise option",
      "Advanced analytics",
      "API access",
      "Unlimited team members",
    ],
    cta: "Talk to Sales",
  },
];

/** Format token top-up display: e.g. "$5 = 2.5M tokens" */
export function formatTopUpTokens(dollars: number): string {
  const tokens = dollars * TOPUP_TOKENS_PER_DOLLAR;
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  return `${(tokens / 1_000).toFixed(0)}K`;
}
