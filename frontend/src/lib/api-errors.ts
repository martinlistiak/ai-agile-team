import { isAxiosError } from "axios";

/** Must match backend `API_ERROR_TOKEN_QUOTA_EXCEEDED`. */
export const API_ERROR_TOKEN_QUOTA_EXCEEDED = "TOKEN_QUOTA_EXCEEDED" as const;

/** Must match backend register conflict `code` when email is already taken. */
export const API_ERROR_EMAIL_ALREADY_REGISTERED =
  "EMAIL_ALREADY_REGISTERED" as const;

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

/** True when signup failed because the email is already registered. */
export function isRegisterEmailInUseError(error: unknown): boolean {
  const { status, message, code } = getApiErrorPayload(error);
  if (code === API_ERROR_EMAIL_ALREADY_REGISTERED) {
    return true;
  }
  if (status !== 409) {
    return false;
  }
  const m = message.toLowerCase();
  return (
    m.includes("email") &&
    (m.includes("already") || m.includes("registered") || m.includes("in use"))
  );
}

export function isTokenQuotaError(error: unknown): boolean {
  const { code, message, status } = getApiErrorPayload(error);
  if (code === API_ERROR_TOKEN_QUOTA_EXCEEDED) {
    return true;
  }
  if (
    status === 403 &&
    typeof message === "string" &&
    message.includes("tokens")
  ) {
    return true;
  }
  return false;
}
