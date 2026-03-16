import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { Request } from "express";
import { IntegrationsService } from "../integrations/integrations.service";

/**
 * Passport strategy that authenticates via API key (Bearer runa_...).
 * Falls through to let JwtOrApiKeyGuard try JWT if no API key is present.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private integrationsService: IntegrationsService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException();
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token?.startsWith("runa_")) {
      throw new UnauthorizedException();
    }

    const user = await this.integrationsService.validateApiKey(token);
    if (!user) {
      throw new UnauthorizedException("Invalid API key");
    }

    return {
      id: user.id,
      email: user.email,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
    };
  }
}
