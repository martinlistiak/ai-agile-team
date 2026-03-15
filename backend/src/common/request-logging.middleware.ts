import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { formatRequestLog } from "./structured-logger";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on("finish", () => {
      const responseTime = Date.now() - start;
      const isProduction = process.env.NODE_ENV === "production";

      if (isProduction) {
        this.logger.log(
          formatRequestLog({
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            responseTime,
          }),
        );
      } else {
        this.logger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`,
        );
      }
    });

    next();
  }
}
