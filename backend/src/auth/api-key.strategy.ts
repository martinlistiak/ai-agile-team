import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { Request } from "express";
import { IntegrationsService } from "../integrations/integrations.service";

/**
 * Passport strategy that authenticates via API key (Bearer runa_...).
 * Used after JWT in JwtOrApiKeyGuard. Must return null (not throw) when the
 * request is not an API key attempt so passport calls fail() and the strategy
 * chain can finish; throwing maps to error() and aborts the chain early.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private integrationsService: IntegrationsService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token?.startsWith("runa_")) {
      return null;
    }

    const user = await this.integrationsService.validateApiKey(token);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
    };
  }
}
