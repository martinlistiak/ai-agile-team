/**
 * On-premise deployment configuration.
 *
 * When DEPLOYMENT_MODE=on-premise, the app runs in a self-hosted mode with:
 * - Local database (no external cloud dependencies)
 * - Local file storage (filesystem instead of S3)
 * - Disabled external telemetry
 * - Optional air-gapped mode (no outbound network)
 * - Custom license key validation
 */

export interface OnPremiseConfig {
  enabled: boolean;
  licenseKey: string | null;
  airgapped: boolean;
  localStoragePath: string;
  maxUsers: number;
  maxSpaces: number;
  features: {
    sso: boolean;
    analytics: boolean;
    agentTraining: boolean;
    sla: boolean;
    customBranding: boolean;
  };
}

export function getOnPremiseConfig(): OnPremiseConfig {
  const isOnPremise = process.env.DEPLOYMENT_MODE === "on-premise";

  return {
    enabled: isOnPremise,
    licenseKey: process.env.LICENSE_KEY || null,
    airgapped: process.env.AIRGAPPED === "true",
    localStoragePath: process.env.LOCAL_STORAGE_PATH || "/data/runa",
    maxUsers: parseInt(process.env.MAX_USERS || "0", 10) || 0, // 0 = unlimited
    maxSpaces: parseInt(process.env.MAX_SPACES || "0", 10) || 0,
    features: {
      sso: isOnPremise,
      analytics: isOnPremise,
      agentTraining: isOnPremise && process.env.AIRGAPPED !== "true",
      sla: isOnPremise,
      customBranding: isOnPremise,
    },
  };
}

export function validateLicenseKey(key: string): {
  valid: boolean;
  tier: string;
  expiresAt: Date | null;
} {
  if (!key || key.length < 32) {
    return { valid: false, tier: "none", expiresAt: null };
  }

  // License format: runa_ent_<base64-payload>
  if (!key.startsWith("runa_ent_")) {
    return { valid: false, tier: "none", expiresAt: null };
  }

  try {
    const payload = Buffer.from(key.slice(9), "base64").toString("utf-8");
    const data = JSON.parse(payload);

    const expiresAt = data.exp ? new Date(data.exp * 1000) : null;
    const isExpired = expiresAt && expiresAt < new Date();

    return {
      valid: !isExpired,
      tier: data.tier || "enterprise",
      expiresAt,
    };
  } catch {
    return { valid: false, tier: "none", expiresAt: null };
  }
}
