import { isAxiosError } from "axios";

/** Must match backend `API_ERROR_AGENT_RUN_QUOTA_EXCEEDED`. */
export const API_ERROR_AGENT_RUN_QUOTA_EXCEEDED =
  "AGENT_RUN_QUOTA_EXCEEDED" as const;

export function getApiErrorPayload(error: unknown): {
  status?: number;
  message: string;
  code?: string;
} {
  if (isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const status = error.response?.status;
    let message = "Something went wrong";
    if (typeof data?.message === "string") {
      message = data.message;
    } else if (Array.isArray(data?.message)) {
      message = data.message.join(", ");
    }
    const code = typeof data?.code === "string" ? data.code : undefined;
    return { status, message, code };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Something went wrong" };
}

export function isAgentRunQuotaError(error: unknown): boolean {
  const { code, message, status } = getApiErrorPayload(error);
  if (code === API_ERROR_AGENT_RUN_QUOTA_EXCEEDED) {
    return true;
  }
  if (
    status === 403 &&
    typeof message === "string" &&
    message.includes("AI agent runs")
  ) {
    return true;
  }
  return false;
}
