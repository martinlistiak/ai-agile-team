import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId;

    let status: number;
    let message: string | string[];
    let error: string;
    let code: string | undefined;
    let responseExtras: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message ?? exception.message;
        error = obj.error ?? HttpStatus[status] ?? "Error";
        if (typeof obj.code === "string") {
          code = obj.code;
        }
        const reserved = new Set(["message", "error", "statusCode", "code"]);
        responseExtras = Object.fromEntries(
          Object.entries(obj).filter(([k]) => !reserved.has(k)),
        );
      } else {
        message = typeof res === "string" ? res : exception.message;
        error = HttpStatus[status] ?? "Error";
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      error = "Internal Server Error";

      this.logger.error(
        `[${requestId}] Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(code ? { code } : {}),
      ...responseExtras,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
