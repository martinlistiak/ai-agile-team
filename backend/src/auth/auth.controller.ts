import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { Response, Request } from "express";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  async register(
    @Body() body: { email: string; password: string; name: string },
  ) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post("login")
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get("github")
  async githubRedirect(@Res() res: Response) {
    const url = await this.authService.getGithubAuthUrl();
    res.redirect(url);
  }

  @Post("github/callback")
  async githubCallback(@Body() body: { code: string }) {
    return this.authService.githubCallback(body.code);
  }

  @Get("github/repos")
  @UseGuards(AuthGuard("jwt"))
  async githubRepos(@Req() req: Request) {
    return this.authService.listGithubRepositories((req.user as any).id);
  }

  @Get("gitlab")
  async gitlabRedirect(@Res() res: Response) {
    const url = await this.authService.getGitlabAuthUrl();
    res.redirect(url);
  }

  @Post("gitlab/callback")
  async gitlabCallback(@Body() body: { code: string }) {
    return this.authService.gitlabCallback(body.code);
  }

  @Get("gitlab/repos")
  @UseGuards(AuthGuard("jwt"))
  async gitlabRepos(@Req() req: Request) {
    return this.authService.listGitlabRepositories((req.user as any).id);
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
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
