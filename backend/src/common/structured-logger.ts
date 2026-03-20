import { LoggerService, LogLevel } from "@nestjs/common";

/**
 * Formats a log entry as a JSON object for structured logging.
 * Used in production (NODE_ENV=production) for machine-parseable logs.
 */
export function formatLogEntry(entry: {
  level: string;
  message: string;
  context?: string;
  [key: string]: any;
}): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: entry.level,
    message: entry.message,
    context: entry.context ?? undefined,
    ...Object.fromEntries(
      Object.entries(entry).filter(
        ([k]) => !["level", "message", "context"].includes(k),
      ),
    ),
  });
}

/**
 * Formats an agent execution log entry with required fields.
 */
export function formatAgentExecutionLog(event: {
  event: "start" | "complete" | "fail";
  executionId: string;
  agentType: string;
  ticketId?: string;
  duration?: number;
  error?: string;
}): string {
  return formatLogEntry({
    level: event.event === "fail" ? "error" : "info",
    message: `Agent execution ${event.event}`,
    executionId: event.executionId,
    agentType: event.agentType,
    ticketId: event.ticketId,
    duration: event.duration,
    error: event.error,
  });
}

/**
 * Formats a request log entry with required fields.
 */
export function formatRequestLog(entry: {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestId?: string;
}): string {
  return formatLogEntry({
    level: "info",
    message: "HTTP Request",
    method: entry.method,
    path: entry.path,
    statusCode: entry.statusCode,
    responseTime: entry.responseTime,
    requestId: entry.requestId,
  });
}

/**
 * JSON Logger Service for NestJS — outputs structured JSON logs in production.
 */
export class JsonLoggerService implements LoggerService {
  log(message: any, context?: string) {
    console.log(formatLogEntry({ level: "info", message, context }));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(formatLogEntry({ level: "error", message, context, trace }));
  }

  warn(message: any, context?: string) {
    console.warn(formatLogEntry({ level: "warn", message, context }));
  }

  debug(message: any, context?: string) {
    console.debug(formatLogEntry({ level: "debug", message, context }));
  }

  verbose(message: any, context?: string) {
    console.log(formatLogEntry({ level: "verbose", message, context }));
  }

  setLogLevels?(levels: LogLevel[]) {
    // No-op for now
  }
}
