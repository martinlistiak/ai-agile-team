import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Req,
  Res,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import "multer";
import { JwtOrApiKeyGuard } from "./jwt-or-apikey.guard";
import { AuthService } from "./auth.service";
import { Response, Request } from "express";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { TeamsService } from "../teams/teams.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private teamsService: TeamsService,
  ) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: "Create a new account" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string" },
        password: { type: "string" },
        name: { type: "string" },
        turnstileToken: {
          type: "string",
          description: "Cloudflare Turnstile token",
        },
      },
      required: ["email", "password", "name"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Account created, returns JWT and user",
  })
  @ApiResponse({
    status: 409,
    description:
      "Email already registered (body includes code EMAIL_ALREADY_REGISTERED)",
  })
  async register(
    @Req() req: Request,
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      turnstileToken?: string;
      acceptTerms?: boolean;
      acceptPrivacy?: boolean;
    },
  ) {
    if (!body.acceptTerms || !body.acceptPrivacy) {
      throw new BadRequestException(
        "You must accept the Terms of Service and Privacy Policy to register.",
      );
    }
    return this.authService.register(
      body.email,
      body.password,
      body.name,
      body.turnstileToken,
      req.ip,
    );
  }

  @Post("login")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
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

  @Post("forgot-password")
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: "Request a password reset email" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string" },
        turnstileToken: {
          type: "string",
          description: "Cloudflare Turnstile token",
        },
      },
      required: ["email"],
    },
  })
  @ApiResponse({
    status: 201,
    description:
      "Generic success message (same whether or not the email exists)",
  })
  async forgotPassword(
    @Req() req: Request,
    @Body()
    body: {
      email: string;
      turnstileToken?: string;
    },
  ) {
    return this.authService.requestPasswordReset(
      body.email,
      body.turnstileToken,
      req.ip,
    );
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: "Set a new password using a reset token from email",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        token: { type: "string" },
        password: { type: "string" },
      },
      required: ["token", "password"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Returns JWT and user (signed in after reset)",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired token" })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPasswordWithToken(body.token, body.password);
  }

  @Post("verify-email")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: "Confirm email address using token from verification email",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Email verified; returns JWT and user",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired token" })
  async verifyEmail(@Body() body: { token: string }) {
    return this.authService.verifyEmailWithToken(body.token);
  }

  @Post("resend-verification")
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Resend email verification (email/password accounts only)",
  })
  @ApiResponse({ status: 201, description: "Generic success message" })
  async resendVerification(@Req() req: Request) {
    return this.authService.resendVerificationEmail((req.user as any).id);
  }

  @Get("github")
  @ApiOperation({ summary: "Redirect to GitHub OAuth flow" })
  @ApiResponse({ status: 302, description: "Redirects to GitHub" })
  async githubRedirect(@Res() res: Response) {
    const url = await this.authService.getGithubAuthUrl();
    res.redirect(url);
  }

  @Post("github/callback")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
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
    const jwtPayload = req.user as any;
    const user = await this.authService.findById(jwtPayload.id);
    if (!user) return null;
    const hasTeamMembership = await this.teamsService.hasTeamMembership(
      user.id,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      createdAt: user.createdAt,
      hasGithub: !!user.githubId,
      hasGitlab: !!user.gitlabId,
      hasTeamMembership,
      hasStripeCustomer: !!user.stripeCustomerId,
      creditsBalance: user.creditsBalance,
      emailVerified: !!user.emailVerifiedAt,
      hasPassword: !!user.hashedPassword,
      isSuperAdmin: user.isSuperAdmin,
      isImpersonating: !!jwtPayload.impersonatorId,
      isReadOnly: !!jwtPayload.readOnly,
    };
  }

  @Post("profile/avatar")
  @Throttle({ default: { limit: 20, ttl: 600000 } })
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload profile avatar (JPEG, PNG, WebP, or GIF, max 2MB)",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
      required: ["file"],
    },
  })
  @ApiResponse({ status: 200, description: "Updated user" })
  async uploadProfileAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("No file provided");
    }
    return this.authService.uploadProfileAvatar((req.user as any).id, file);
  }

  @Patch("profile")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary:
      "Update profile (name, email for password accounts; clear avatar with null avatarUrl)",
  })
  @ApiResponse({ status: 200, description: "Updated user" })
  async updateProfile(@Req() req: Request, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile((req.user as any).id, body);
  }

  @Post("change-password")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Change password (email/password accounts only)" })
  @ApiResponse({ status: 201, description: "Password updated" })
  async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword((req.user as any).id, body);
  }

  @Post("delete-account")
  @Throttle({ default: { limit: 5, ttl: 86400000 } })
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Permanently delete the account and related personal data",
  })
  @ApiResponse({ status: 201, description: "Account deleted" })
  async deleteAccount(@Req() req: Request, @Body() body: DeleteAccountDto) {
    return this.authService.deleteAccount((req.user as any).id, body);
  }

  @Post("impersonate/:userId")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Impersonate a user (superadmin only, read-only access)",
  })
  @ApiParam({ name: "userId", format: "uuid" })
  @ApiResponse({ status: 201, description: "Returns impersonation token" })
  @ApiResponse({ status: 403, description: "Not a superadmin" })
  async impersonate(@Req() req: Request, @Param("userId") userId: string) {
    const actor = await this.authService.findById((req.user as any).id);
    if (!actor?.isSuperAdmin) {
      throw new ForbiddenException("Superadmin access required");
    }
    return this.authService.createImpersonationToken(actor.id, userId);
  }

  @Get("admin/users")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List all users (superadmin only)" })
  @ApiResponse({ status: 200, description: "Array of users" })
  @ApiResponse({ status: 403, description: "Not a superadmin" })
  async listUsers(@Req() req: Request) {
    const actor = await this.authService.findById((req.user as any).id);
    if (!actor?.isSuperAdmin) {
      throw new ForbiddenException("Superadmin access required");
    }
    return this.authService.listAllUsers();
  }

  @Post("stop-impersonation")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Stop impersonating and return to original session",
  })
  @ApiResponse({ status: 201, description: "Returns original user token" })
  async stopImpersonation(@Req() req: Request) {
    const jwtPayload = req.user as any;
    if (!jwtPayload.impersonatorId) {
      throw new BadRequestException("Not currently impersonating");
    }
    return this.authService.stopImpersonation(jwtPayload.impersonatorId);
  }
}
