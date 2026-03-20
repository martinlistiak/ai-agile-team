import {
  Injectable,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private configService: ConfigService) {}

  /**
   * When TURNSTILE_SECRET_KEY is unset, verification is skipped (local dev).
   * When set, a valid token is required for protected actions (e.g. register).
   */
  async assertValidToken(
    token: string | undefined,
    remoteIp?: string,
  ): Promise<void> {
    const secret = this.configService.get<string>("TURNSTILE_SECRET_KEY", "");
    if (!secret) return;

    if (!token?.trim()) {
      throw new BadRequestException("Human verification is required.");
    }

    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );

    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      this.logger.warn(
        `Turnstile failed: ${JSON.stringify(data["error-codes"] ?? [])}`,
      );
      throw new BadRequestException("Human verification failed. Please try again.");
    }
  }
}
