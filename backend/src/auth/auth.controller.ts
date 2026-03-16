import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "./jwt-or-apikey.guard";
import { AuthService } from "./auth.service";
import { Response, Request } from "express";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Create a new account" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string" },
        password: { type: "string" },
        name: { type: "string" },
      },
      required: ["email", "password", "name"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Account created, returns JWT and user",
  })
  @ApiResponse({ status: 409, description: "Email already registered" })
  async register(
    @Body() body: { email: string; password: string; name: string },
  ) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post("login")
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { email: { type: "string" }, password: { type: "string" } },
      required: ["email", "password"],
    },
  })
  @ApiResponse({ status: 201, description: "Returns JWT and user" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get("github")
  @ApiOperation({ summary: "Redirect to GitHub OAuth flow" })
  @ApiResponse({ status: 302, description: "Redirects to GitHub" })
  async githubRedirect(@Res() res: Response) {
    const url = await this.authService.getGithubAuthUrl();
    res.redirect(url);
  }

  @Post("github/callback")
  @ApiOperation({ summary: "Exchange GitHub OAuth code for token" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    },
  })
  @ApiResponse({ status: 201, description: "Returns JWT and user" })
  async githubCallback(@Body() body: { code: string }) {
    return this.authService.githubCallback(body.code);
  }

  @Get("github/repos")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List repositories from connected GitHub account" })
  @ApiResponse({ status: 200, description: "Array of repositories" })
  async githubRepos(@Req() req: Request) {
    return this.authService.listGithubRepositories((req.user as any).id);
  }

  @Get("gitlab")
  @ApiOperation({ summary: "Redirect to GitLab OAuth flow" })
  @ApiResponse({ status: 302, description: "Redirects to GitLab" })
  async gitlabRedirect(@Res() res: Response) {
    const url = await this.authService.getGitlabAuthUrl();
    res.redirect(url);
  }

  @Post("gitlab/callback")
  @ApiOperation({ summary: "Exchange GitLab OAuth code for token" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    },
  })
  @ApiResponse({ status: 201, description: "Returns JWT and user" })
  async gitlabCallback(@Body() body: { code: string }) {
    return this.authService.gitlabCallback(body.code);
  }

  @Get("gitlab/repos")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List repositories from connected GitLab account" })
  @ApiResponse({ status: 200, description: "Array of repositories" })
  async gitlabRepos(@Req() req: Request) {
    return this.authService.listGitlabRepositories((req.user as any).id);
  }

  @Get("me")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get the current authenticated user" })
  @ApiResponse({ status: 200, description: "Current user profile" })
  async me(@Req() req: Request) {
    const user = await this.authService.findById((req.user as any).id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      createdAt: user.createdAt,
      hasGithub: !!user.githubId,
      hasGitlab: !!user.gitlabId,
    };
  }
}
