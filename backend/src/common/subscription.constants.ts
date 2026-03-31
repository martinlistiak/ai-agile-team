export const SKIP_SUBSCRIPTION_KEY = "skipSubscriptionCheck";

/** Max agent executions per calendar day (UTC) for Starter plan. */
export const STARTER_DAILY_AGENT_RUNS = 10;

/** Max agent executions per calendar day (UTC) for Team plan. */
export const TEAM_DAILY_AGENT_RUNS = 50;

/** API `code` on 403 responses when Starter daily agent run limit is reached. */
export const API_ERROR_AGENT_RUN_QUOTA_EXCEEDED = "AGENT_RUN_QUOTA_EXCEEDED";
