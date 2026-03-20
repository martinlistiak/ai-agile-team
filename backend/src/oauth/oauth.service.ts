import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { OAuthClient } from "../entities/oauth-client.entity";
import { OAuthCode } from "../entities/oauth-code.entity";
import { OAuthToken } from "../entities/oauth-token.entity";

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(OAuthClient)
    private clientRepo: Repository<OAuthClient>,
    @InjectRepository(OAuthCode)
    private codeRepo: Repository<OAuthCode>,
    @InjectRepository(OAuthToken)
    private tokenRepo: Repository<OAuthToken>,
    private config: ConfigService,
  ) {}

  // ── Dynamic Client Registration (RFC 7591) ──────────────────────────

  async registerClient(body: {
    client_name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  }): Promise<Record<string, unknown>> {
    const clientId = `runa_mcp_${crypto.randomBytes(16).toString("hex")}`;

    const client = this.clientRepo.create({
      clientId,
      clientName: body.client_name ?? "MCP Client",
      redirectUris: body.redirect_uris,
      grantTypes: body.grant_types ?? ["authorization_code", "refresh_token"],
      responseTypes: (body.response_types ?? ["code"]).join(","),
      tokenEndpointAuthMethod: body.token_endpoint_auth_method ?? "none",
    });
    await this.clientRepo.save(client);

    return {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: client.responseTypes.split(","),
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    };
  }

  // ── Authorization ───────────────────────────────────────────────────

  async validateAuthorizeRequest(params: {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }) {
    const client = await this.clientRepo.findOneBy({
      clientId: params.client_id,
    });
    if (!client) throw new BadRequestException("Unknown client_id");

    if (!client.redirectUris.includes(params.redirect_uri)) {
      throw new BadRequestException("Invalid redirect_uri");
    }
    if (params.response_type !== "code") {
      throw new BadRequestException("Only response_type=code is supported");
    }
    // PKCE is required per OAuth 2.1
    if (!params.code_challenge) {
      throw new BadRequestException("code_challenge is required (PKCE)");
    }
    return client;
  }

  async createAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    codeChallenge: string,
    codeChallengeMethod: string,
    scope: string,
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.codeRepo.save(
      this.codeRepo.create({
        code,
        clientId,
        userId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod: codeChallengeMethod || "S256",
        scope: scope || "openid",
        expiresAt,
      }),
    );
    return code;
  }

  // ── Token Exchange ──────────────────────────────────────────────────

  async exchangeCode(body: {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    client_id: string;
    code_verifier?: string;
    refresh_token?: string;
  }): Promise<Record<string, unknown>> {
    if (body.grant_type === "authorization_code") {
      return this.handleAuthCodeGrant(body);
    }
    if (body.grant_type === "refresh_token") {
      return this.handleRefreshGrant(body);
    }
    throw new BadRequestException("Unsupported grant_type");
  }

  private async handleAuthCodeGrant(body: {
    code?: string;
    redirect_uri?: string;
    client_id: string;
    code_verifier?: string;
  }) {
    if (!body.code || !body.redirect_uri || !body.code_verifier) {
      throw new BadRequestException(
        "code, redirect_uri, and code_verifier are required",
      );
    }

    const authCode = await this.codeRepo.findOneBy({
      code: body.code,
      used: false,
    });
    if (!authCode || authCode.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired authorization code");
    }
    if (authCode.clientId !== body.client_id) {
      throw new BadRequestException("client_id mismatch");
    }
    if (authCode.redirectUri !== body.redirect_uri) {
      throw new BadRequestException("redirect_uri mismatch");
    }

    // Verify PKCE
    this.verifyPkce(
      body.code_verifier,
      authCode.codeChallenge,
      authCode.codeChallengeMethod,
    );

    // Mark code as used
    authCode.used = true;
    await this.codeRepo.save(authCode);

    return this.issueTokens(authCode.clientId, authCode.userId, authCode.scope);
  }

  private async handleRefreshGrant(body: {
    client_id: string;
    refresh_token?: string;
  }) {
    if (!body.refresh_token) {
      throw new BadRequestException("refresh_token is required");
    }

    const existing = await this.tokenRepo.findOneBy({
      refreshToken: body.refresh_token,
      revoked: false,
    });
    if (
      !existing ||
      (existing.refreshExpiresAt && existing.refreshExpiresAt < new Date())
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (existing.clientId !== body.client_id) {
      throw new BadRequestException("client_id mismatch");
    }

    // Revoke old token
    existing.revoked = true;
    await this.tokenRepo.save(existing);

    return this.issueTokens(existing.clientId, existing.userId, existing.scope);
  }

  private async issueTokens(
    clientId: string,
    userId: string,
    scope: string,
  ): Promise<Record<string, unknown>> {
    const accessToken = crypto.randomBytes(32).toString("base64url");
    const refreshToken = crypto.randomBytes(32).toString("base64url");
    const expiresIn = 3600; // 1 hour
    const refreshExpiresIn = 7 * 24 * 3600; // 7 days

    await this.tokenRepo.save(
      this.tokenRepo.create({
        accessToken: this.hashToken(accessToken),
        refreshToken: this.hashToken(refreshToken),
        clientId,
        userId,
        scope,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        refreshExpiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      }),
    );

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope,
    };
  }

  // ── Token Validation (for MCP server) ───────────────────────────────

  async validateAccessToken(
    token: string,
  ): Promise<{ userId: string; clientId: string; scope: string } | null> {
    const hashed = this.hashToken(token);
    const record = await this.tokenRepo.findOneBy({
      accessToken: hashed,
      revoked: false,
    });
    if (!record || record.expiresAt < new Date()) return null;
    return {
      userId: record.userId,
      clientId: record.clientId,
      scope: record.scope,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private verifyPkce(
    verifier: string,
    challenge: string,
    method: string,
  ): void {
    if (method === "S256") {
      const computed = crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url");
      if (computed !== challenge) {
        throw new BadRequestException("PKCE verification failed");
      }
    } else if (method === "plain") {
      if (verifier !== challenge) {
        throw new BadRequestException("PKCE verification failed");
      }
    } else {
      throw new BadRequestException(
        "Unsupported code_challenge_method: " + method,
      );
    }
  }

  getServerMetadata() {
    const issuer = this.config.get("APP_URL", "http://localhost:3001") + "/api";
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "profile", "offline_access"],
    };
  }
}
