import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { OAuthAuthorizeGuard } from "./oauth-authorize.guard";
import { OAuthService } from "./oauth.service";

@ApiTags("OAuth")
@Controller()
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  // ── Discovery ───────────────────────────────────────────────────────

  @Get("oauth-authorization-server")
  @ApiOperation({ summary: "OAuth 2.1 Authorization Server Metadata" })
  @ApiResponse({ status: 200 })
  getMetadata() {
    return this.oauthService.getServerMetadata();
  }

  // ── Dynamic Client Registration (RFC 7591) ─────────────────────────

  @Post("oauth/register")
  @ApiOperation({ summary: "Register a new OAuth client dynamically" })
  @ApiResponse({ status: 201, description: "Client registered" })
  async registerClient(
    @Body()
    body: {
      client_name?: string;
      redirect_uris: string[];
      grant_types?: string[];
      response_types?: string[];
      token_endpoint_auth_method?: string;
    },
  ) {
    return this.oauthService.registerClient(body);
  }

  // ── Authorization Endpoint ──────────────────────────────────────────

  @Get("oauth/authorize")
  @UseGuards(OAuthAuthorizeGuard)
  @ApiOperation({ summary: "OAuth authorization endpoint (requires login)" })
  async authorize(
    @Req() req: Request,
    @Res() res: Response,
    @Query("client_id") clientId: string,
    @Query("redirect_uri") redirectUri: string,
    @Query("response_type") responseType: string,
    @Query("code_challenge") codeChallenge: string,
    @Query("code_challenge_method") codeChallengeMethod: string,
    @Query("state") state: string,
    @Query("scope") scope: string,
    @Query("authorization") authorizationQuery?: string,
  ) {
    // Support JWT passed as query param from the login page redirect
    if (authorizationQuery && !req.headers.authorization) {
      (req.headers as any).authorization = `Bearer ${authorizationQuery}`;
    }

    // Validate the request
    await this.oauthService.validateAuthorizeRequest({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    });

    const userId = (req.user as any).id;

    // Auto-approve: issue code immediately (no consent screen for first-party MCP)
    const code = await this.oauthService.createAuthorizationCode(
      clientId,
      userId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod || "S256",
      scope || "openid",
    );

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);

    res.redirect(url.toString());
  }

  // ── Authorize form (for browser-based flow) ─────────────────────────

  @Get("oauth/authorize/login")
  @ApiExcludeEndpoint()
  async authorizeLoginPage(
    @Query("client_id") clientId: string,
    @Query("redirect_uri") redirectUri: string,
    @Query("response_type") responseType: string,
    @Query("code_challenge") codeChallenge: string,
    @Query("code_challenge_method") codeChallengeMethod: string,
    @Query("state") state: string,
    @Query("scope") scope: string,
    @Res() res: Response,
  ) {
    // Serve a minimal login page that posts credentials and then redirects
    const params = new URLSearchParams({
      client_id: clientId || "",
      redirect_uri: redirectUri || "",
      response_type: responseType || "code",
      code_challenge: codeChallenge || "",
      code_challenge_method: codeChallengeMethod || "S256",
      state: state || "",
      scope: scope || "openid",
    });

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Runa – Authorize</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 2rem; width: 100%; max-width: 400px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    p { font-size: 0.875rem; color: #a3a3a3; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #333; border-radius: 6px; background: #0a0a0a; color: #e5e5e5; font-size: 0.875rem; margin-bottom: 1rem; }
    button { width: 100%; padding: 0.625rem; border: none; border-radius: 6px; background: #2563eb; color: white; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #ef4444; font-size: 0.8rem; margin-bottom: 1rem; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to Runa</h1>
    <p>An application is requesting access to your account.</p>
    <div class="error" id="error"></div>
    <form id="form">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Authorize</button>
    </form>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('error');
      errEl.style.display = 'none';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
          }),
        });
        if (!res.ok) { errEl.textContent = 'Invalid credentials'; errEl.style.display = 'block'; return; }
        const { accessToken } = await res.json();
        // Now hit the authorize endpoint with the JWT
        window.location.href = '/api/oauth/authorize?${params.toString()}&' + 'authorization=' + encodeURIComponent(accessToken);
      } catch (err) {
        errEl.textContent = 'Network error'; errEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`);
  }

  // ── Token Endpoint ──────────────────────────────────────────────────

  @Post("oauth/token")
  @HttpCode(200)
  @ApiOperation({ summary: "Exchange authorization code or refresh token" })
  @ApiResponse({ status: 200, description: "Token response" })
  async token(
    @Body()
    body: {
      grant_type: string;
      code?: string;
      redirect_uri?: string;
      client_id: string;
      code_verifier?: string;
      refresh_token?: string;
    },
  ) {
    return this.oauthService.exchangeCode(body);
  }

  // ── Token Validation (internal, used by MCP server) ─────────────────

  @Post("oauth/introspect")
  @HttpCode(200)
  @ApiOperation({ summary: "Validate an access token" })
  async introspect(@Body() body: { token: string }) {
    const result = await this.oauthService.validateAccessToken(body.token);
    if (!result) return { active: false };
    return { active: true, ...result };
  }
}
