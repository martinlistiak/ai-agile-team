import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Not, Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { User } from "../entities/user.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { EmailVerificationToken } from "../entities/email-verification-token.entity";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TokenEncryptionService } from "../common/token-encryption.service";
import { CountlyService } from "../common/countly.service";
import { FileStorageService } from "../common/file-storage.service";
import { TurnstileService } from "../common/turnstile.service";
import { MailService } from "../teams/mail.service";
import { BillingService } from "../billing/billing.service";
import { Team } from "../entities/team.entity";
import { TeamInvitation } from "../entities/team-invitation.entity";
import { TeamMember } from "../entities/team-member.entity";
import { Space } from "../entities/space.entity";
import { Agent } from "../entities/agent.entity";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { AnalyticsEvent } from "../entities/analytics-event.entity";
import { OAuthCode } from "../entities/oauth-code.entity";
import { OAuthToken } from "../entities/oauth-token.entity";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { DeleteAccountDto } from "./dto/delete-account.dto";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationTokenRepo: Repository<EmailVerificationToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenEncryptionService: TokenEncryptionService,
    private countly: CountlyService,
    private turnstile: TurnstileService,
    private mailService: MailService,
    private dataSource: DataSource,
    private billingService: BillingService,
    private fileStorageService: FileStorageService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async tryDeleteAvatarStorageKey(key: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.fileStorageService.deleteObject(key);
    } catch (err) {
      this.logger.warn(`Failed to delete avatar object ${key}`, err);
    }
  }

  async register(
    email: string,
    password: string,
    name: string,
    turnstileToken?: string,
    remoteIp?: string,
  ) {
    await this.turnstile.assertValidToken(turnstileToken, remoteIp);

    const existing = await this.userRepo.findOneBy({ email });
    if (existing) throw new ConflictException("Email already registered");

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const user = this.userRepo.create({
      email,
      name,
      hashedPassword,
      emailVerifiedAt: null,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    });
    await this.userRepo.save(user);

    this.countly.record(user.id, "user_registered", { method: "email" });

    this.eventEmitter.emit("user.signup", {
      email: user.email,
      name: user.name,
    });

    try {
      await this.issueEmailVerification(user);
    } catch (err) {
      this.logger.warn(
        `Failed to send verification email to ${user.email}`,
        err,
      );
    }

    const token = this.createToken(user);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOneBy({ email });
    if (!user || !user.hashedPassword)
      throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.createToken(user);
    this.countly.beginSession(user.id);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  /**
   * Always returns the same shape so callers cannot infer whether the email exists.
   * Only sends mail when the user has a password (email/password accounts).
   */
  async requestPasswordReset(
    email: string,
    turnstileToken?: string,
    remoteIp?: string,
  ): Promise<{ message: string }> {
    await this.turnstile.assertValidToken(turnstileToken, remoteIp);

    const normalized = email?.trim() ?? "";
    const genericMessage =
      "If an account exists with a password for that email, we sent reset instructions.";

    if (!normalized) {
      return { message: genericMessage };
    }

    const user = await this.userRepo.findOneBy({ email: normalized });
    if (!user?.hashedPassword) {
      return { message: genericMessage };
    }

    await this.passwordResetTokenRepo.delete({ userId: user.id });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.passwordResetTokenRepo.save(
      this.passwordResetTokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    const appUrl = this.configService
      .get("APP_URL", "https://runa-app.com")
      .replace(/\/$/, "");
    const resetUrl = `${appUrl}/login/reset-password?token=${encodeURIComponent(rawToken)}`;

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    this.countly.record(user.id, "password_reset_requested", {});

    return { message: genericMessage };
  }

  async resetPasswordWithToken(token: string, password: string) {
    const trimmedToken = token?.trim() ?? "";
    if (!trimmedToken) {
      throw new BadRequestException("Reset token is required.");
    }
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters.");
    }

    const tokenHash = hashPasswordResetToken(trimmedToken);
    const row = await this.passwordResetTokenRepo.findOne({
      where: { tokenHash },
      relations: ["user"],
    });

    if (!row || row.expiresAt.getTime() <= Date.now() || !row.user) {
      throw new UnauthorizedException(
        "This reset link is invalid or has expired. Request a new one from the login page.",
      );
    }

    row.user.hashedPassword = await bcrypt.hash(password, 10);
    row.user.emailVerifiedAt = row.user.emailVerifiedAt ?? new Date();
    await this.userRepo.save(row.user);
    await this.passwordResetTokenRepo.delete({ userId: row.user.id });
    await this.emailVerificationTokenRepo.delete({ userId: row.user.id });

    this.countly.record(row.user.id, "password_reset_completed", {});

    const accessToken = this.createToken(row.user);
    this.countly.beginSession(row.user.id);
    return { accessToken, user: this.sanitizeUser(row.user) };
  }

  async githubCallback(code: string) {
    const redirectUri = this.configService.get(
      "GITHUB_REDIRECT_URI",
      "https://runa-app.com/login/callback",
    );
    const githubHeaders = (authorization: string) => ({
      Authorization: authorization,
      Accept: "application/vnd.github+json",
      "User-Agent": "runa-app",
      "X-GitHub-Api-Version": "2022-11-28",
    });

    // Exchange code for token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: this.configService.get("GITHUB_CLIENT_ID"),
          client_secret: this.configService.get("GITHUB_CLIENT_SECRET"),
          code,
          redirect_uri: redirectUri,
        }),
      },
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedException("GitHub auth failed");
    }

    const authHeaders = [
      `${tokenData.token_type === "token" ? "token" : "Bearer"} ${tokenData.access_token}`,
      `token ${tokenData.access_token}`,
      `Bearer ${tokenData.access_token}`,
    ];

    // Get GitHub user profile
    let profileRes: Response | null = null;
    let profile: any = null;
    let successfulAuthorization = authHeaders[0];
    for (const authorization of authHeaders) {
      profileRes = await fetch("https://api.github.com/user", {
        headers: githubHeaders(authorization),
      });
      profile = await profileRes.json();
      if (profileRes.ok && profile?.id) {
        successfulAuthorization = authorization;
        break;
      }
    }

    if (!profileRes || !profileRes.ok || !profile?.id) {
      const message =
        typeof profile?.message === "string"
          ? profile.message
          : "Failed to load GitHub profile";
      throw new UnauthorizedException(message);
    }

    // Get email if not public
    let email = profile.email;
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: githubHeaders(successfulAuthorization),
      });
      const emails = await emailRes.json();
      if (emailRes.ok && Array.isArray(emails)) {
        email =
          emails.find((e: any) => e.primary && e.verified)?.email ||
          emails.find((e: any) => e.primary)?.email ||
          emails.find((e: any) => e.verified)?.email ||
          emails[0]?.email;
      }
    }

    if (!email) {
      throw new UnauthorizedException(
        "GitHub account does not expose an email address",
      );
    }

    // Upsert user
    let user = await this.userRepo.findOneBy({ githubId: profile.id });
    if (!user) {
      user = await this.userRepo.findOneBy({ email });
    }

    if (user) {
      user.githubId = profile.id;
      user.avatarUrl = profile.avatar_url;
      user.githubTokenEncrypted = this.tokenEncryptionService.encrypt(
        tokenData.access_token,
      );
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
      }
      await this.userRepo.save(user);
    } else {
      user = this.userRepo.create({
        email,
        name: profile.name || profile.login,
        githubId: profile.id,
        avatarUrl: profile.avatar_url,
        githubTokenEncrypted: this.tokenEncryptionService.encrypt(
          tokenData.access_token,
        ),
        emailVerifiedAt: new Date(),
      });
      await this.userRepo.save(user);
      this.countly.record(user.id, "user_registered", { method: "github" });
      this.eventEmitter.emit("user.signup", {
        email: user.email,
        name: user.name,
      });
    }

    const token = this.createToken(user);
    this.countly.beginSession(user.id);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async getGithubAuthUrl() {
    const clientId = this.configService.get("GITHUB_CLIENT_ID");
    const redirectUri = this.configService.get(
      "GITHUB_REDIRECT_URI",
      "https://runa-app.com/login/callback",
    );
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user:email`;
  }

  async getGitlabAuthUrl() {
    const clientId = this.configService.get("GITLAB_CLIENT_ID");
    const redirectUri = this.configService.get(
      "GITLAB_REDIRECT_URI",
      "https://runa-app.com/login/gitlab/callback",
    );
    const baseUrl = this.configService.get(
      "GITLAB_BASE_URL",
      "https://gitlab.com",
    );
    return `${baseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=api+read_user+read_repository`;
  }

  async gitlabCallback(code: string) {
    const baseUrl = this.configService.get(
      "GITLAB_BASE_URL",
      "https://gitlab.com",
    );
    const redirectUri = this.configService.get(
      "GITLAB_REDIRECT_URI",
      "https://runa-app.com/login/gitlab/callback",
    );

    // Exchange code for token
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.configService.get("GITLAB_CLIENT_ID"),
        client_secret: this.configService.get("GITLAB_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedException("GitLab auth failed");
    }

    // Get GitLab user profile
    const profileRes = await fetch(`${baseUrl}/api/v4/user`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile?.id) {
      throw new UnauthorizedException("Failed to load GitLab profile");
    }

    const email = profile.email;
    if (!email) {
      throw new UnauthorizedException(
        "GitLab account does not expose an email address",
      );
    }

    // Upsert user — match by gitlabId first, then email
    let user = await this.userRepo.findOneBy({ gitlabId: profile.id });
    if (!user) {
      user = await this.userRepo.findOneBy({ email });
    }

    if (user) {
      user.gitlabId = profile.id;
      user.avatarUrl = user.avatarUrl || profile.avatar_url;
      user.gitlabTokenEncrypted = this.tokenEncryptionService.encrypt(
        tokenData.access_token,
      );
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
      }
      await this.userRepo.save(user);
    } else {
      user = this.userRepo.create({
        email,
        name: profile.name || profile.username,
        gitlabId: profile.id,
        avatarUrl: profile.avatar_url,
        gitlabTokenEncrypted: this.tokenEncryptionService.encrypt(
          tokenData.access_token,
        ),
        emailVerifiedAt: new Date(),
      });
      await this.userRepo.save(user);
      this.countly.record(user.id, "user_registered", { method: "gitlab" });
      this.eventEmitter.emit("user.signup", {
        email: user.email,
        name: user.name,
      });
    }

    const token = this.createToken(user);
    this.countly.beginSession(user.id);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async listGitlabRepositories(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.gitlabTokenEncrypted) {
      throw new UnprocessableEntityException("GitLab account is not connected");
    }

    const decryptedToken = this.tokenEncryptionService.decrypt(
      user.gitlabTokenEncrypted,
    );
    const baseUrl = this.configService.get(
      "GITLAB_BASE_URL",
      "https://gitlab.com",
    );

    const reposRes = await fetch(
      `${baseUrl}/api/v4/projects?membership=true&order_by=last_activity_at&per_page=100`,
      {
        headers: { Authorization: `Bearer ${decryptedToken}` },
      },
    );
    const repos = await reposRes.json();
    if (!reposRes.ok || !Array.isArray(repos)) {
      const message =
        typeof repos?.message === "string"
          ? repos.message
          : "Failed to load GitLab repositories";
      throw new BadGatewayException(message);
    }

    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.path_with_namespace,
      htmlUrl: repo.web_url,
      private: repo.visibility === "private",
      description: repo.description,
      owner: repo.namespace?.path ?? null,
    }));
  }

  async listGithubRepositories(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.githubTokenEncrypted) {
      throw new UnprocessableEntityException("GitHub account is not connected");
    }

    const decryptedToken = this.tokenEncryptionService.decrypt(
      user.githubTokenEncrypted,
    );

    const authHeaders = [`token ${decryptedToken}`, `Bearer ${decryptedToken}`];

    let reposRes: Response | null = null;
    let repos: any = null;

    for (const authorization of authHeaders) {
      reposRes = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=100",
        {
          headers: {
            Authorization: authorization,
            Accept: "application/vnd.github+json",
            "User-Agent": "runa-app",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      repos = await reposRes.json();
      if (reposRes.ok && Array.isArray(repos)) {
        break;
      }
    }

    if (!reposRes || !reposRes.ok || !Array.isArray(repos)) {
      const message =
        typeof repos?.message === "string"
          ? repos.message
          : "Failed to load GitHub repositories";
      throw new BadGatewayException(message);
    }

    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      private: repo.private,
      description: repo.description,
      owner: repo.owner?.login ?? null,
    }));
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOneBy({ id });
  }

  async verifyEmailWithToken(token: string) {
    const trimmedToken = token?.trim() ?? "";
    if (!trimmedToken) {
      throw new BadRequestException("Verification token is required.");
    }

    const tokenHash = hashEmailVerificationToken(trimmedToken);
    const row = await this.emailVerificationTokenRepo.findOne({
      where: { tokenHash },
      relations: ["user"],
    });

    if (!row || row.expiresAt.getTime() <= Date.now() || !row.user) {
      throw new UnauthorizedException(
        "This verification link is invalid or has expired. Sign in and request a new one from your account.",
      );
    }

    if (!row.user.hashedPassword) {
      await this.emailVerificationTokenRepo.delete({ userId: row.user.id });
      throw new BadRequestException("This account does not use email sign-in.");
    }

    row.user.emailVerifiedAt = new Date();
    await this.userRepo.save(row.user);
    await this.emailVerificationTokenRepo.delete({ userId: row.user.id });

    this.countly.record(row.user.id, "email_verified", {});

    const accessToken = this.createToken(row.user);
    this.countly.beginSession(row.user.id);
    return { accessToken, user: this.sanitizeUser(row.user) };
  }

  async resendVerificationEmail(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.hashedPassword) {
      throw new BadRequestException(
        "Only email/password accounts use email verification.",
      );
    }
    if (user.emailVerifiedAt) {
      return { message: "Your email is already verified." };
    }

    await this.issueEmailVerification(user);
    this.countly.record(user.id, "email_verification_resent", {});

    return {
      message: "We sent a new verification link to your email.",
    };
  }

  private async issueEmailVerification(user: User): Promise<void> {
    await this.emailVerificationTokenRepo.delete({ userId: user.id });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashEmailVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.emailVerificationTokenRepo.save(
      this.emailVerificationTokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    const appUrl = this.configService
      .get("APP_URL", "https://runa-app.com")
      .replace(/\/$/, "");
    const verifyUrl = `${appUrl}/login/verify-email?token=${encodeURIComponent(rawToken)}`;

    await this.mailService.sendEmailVerificationEmail({
      to: user.email,
      verifyUrl,
    });

    this.countly.record(user.id, "email_verification_sent", {});
  }

  private createToken(user: User): string {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      createdAt: user.createdAt,
      emailVerified: !!user.emailVerifiedAt,
      hasPassword: !!user.hashedPassword,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();

    let avatarKeyToDelete: string | null = null;

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }

    if (dto.avatarUrl !== undefined) {
      const v = dto.avatarUrl;
      if (v === null || v === "") {
        avatarKeyToDelete = FileStorageService.parseStorageKeyFromAvatarUrl(
          user.avatarUrl,
        );
        user.avatarUrl = null;
      } else {
        user.avatarUrl = String(v).trim();
      }
    }

    if (dto.email !== undefined) {
      if (!user.hashedPassword) {
        throw new BadRequestException(
          "Email is tied to your sign-in provider. It cannot be changed here.",
        );
      }
      const next = dto.email.trim().toLowerCase();
      if (next !== user.email.toLowerCase()) {
        const taken = await this.userRepo.findOneBy({ email: next });
        if (taken) throw new ConflictException("That email is already in use.");
        user.email = next;
        user.emailVerifiedAt = null;
        await this.userRepo.save(user);
        await this.tryDeleteAvatarStorageKey(avatarKeyToDelete);
        await this.emailVerificationTokenRepo.delete({ userId: user.id });
        try {
          await this.issueEmailVerification(user);
        } catch (err) {
          this.logger.warn(
            `Failed to send verification after email change for ${user.email}`,
            err,
          );
        }
        this.countly.record(user.id, "profile_email_changed", {});
        const fresh = await this.userRepo.findOneBy({ id: userId });
        return { user: this.sanitizeUser(fresh!) };
      }
    }

    await this.userRepo.save(user);
    await this.tryDeleteAvatarStorageKey(avatarKeyToDelete);
    this.countly.record(user.id, "profile_updated", {});
    return { user: this.sanitizeUser(user) };
  }

  async uploadProfileAvatar(userId: string, file: Express.Multer.File) {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        "Avatar must be a JPEG, PNG, WebP, or GIF image.",
      );
    }
    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extByMime[file.mimetype] ?? "bin";

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();

    const oldKey = FileStorageService.parseStorageKeyFromAvatarUrl(
      user.avatarUrl,
    );
    const { key } = await this.fileStorageService.uploadUserAvatar(
      userId,
      file.buffer,
      ext,
    );
    const appUrl = this.configService
      .get("APP_URL", "http://localhost:3001")
      .replace(/\/$/, "");
    user.avatarUrl = `${appUrl}/api/files/${key}`;
    await this.userRepo.save(user);
    await this.tryDeleteAvatarStorageKey(oldKey);
    this.countly.record(user.id, "profile_avatar_updated", {});
    return { user: this.sanitizeUser(user) };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.hashedPassword) {
      throw new BadRequestException(
        "This account does not use a password. Sign in with your provider instead.",
      );
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.hashedPassword);
    if (!ok) throw new UnauthorizedException("Current password is incorrect.");
    user.hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
    this.countly.record(user.id, "password_changed", {});
    return { message: "Password updated." };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();

    if (user.hashedPassword) {
      if (!dto.password?.trim()) {
        throw new BadRequestException(
          "Password is required to delete this account.",
        );
      }
      const ok = await bcrypt.compare(dto.password, user.hashedPassword);
      if (!ok) throw new UnauthorizedException("Password is incorrect.");
    } else {
      const expected = user.email.trim().toLowerCase();
      const got = dto.confirmationEmail?.trim().toLowerCase() ?? "";
      if (!got || got !== expected) {
        throw new BadRequestException(
          "Type your account email exactly to confirm account deletion.",
        );
      }
    }

    const stripeCustomerId = user.stripeCustomerId;
    await this.billingService.deleteStripeCustomerIfPresent(stripeCustomerId);

    await this.dataSource.transaction(async (manager) => {
      const ownedTeams = await manager.find(Team, {
        where: { ownerId: userId },
        select: ["id"],
      });
      for (const t of ownedTeams) {
        const others = await manager.count(TeamMember, {
          where: { teamId: t.id, userId: Not(userId) },
        });
        if (others > 0) {
          throw new BadRequestException(
            "You own a team with other members. Remove members, transfer the team, or delete the team before deleting your account.",
          );
        }
      }

      await manager.delete(TeamInvitation, { invitedById: userId });
      await this.deleteSpacesForUser(manager, userId);
      if (ownedTeams.length > 0) {
        await manager.delete(Team, { ownerId: userId });
      }
      await manager.delete(AnalyticsEvent, { userId });
      await manager.delete(OAuthCode, { userId });
      await manager.delete(OAuthToken, { userId });
      await manager.delete(User, { id: userId });
    });

    this.countly.endSession(userId);
    this.countly.record(userId, "account_deleted", {});
    return { deleted: true };
  }

  private async deleteSpacesForUser(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    const spaces = await manager.find(Space, {
      where: { userId },
      select: ["id"],
    });
    for (const { id: spaceId } of spaces) {
      const agents = await manager.find(Agent, {
        where: { spaceId },
        select: ["id"],
      });
      const agentIds = agents.map((a) => a.id);
      if (agentIds.length > 0) {
        await manager.delete(Execution, { agentId: In(agentIds) });
      }
      const tickets = await manager.find(Ticket, {
        where: { spaceId },
        select: ["id"],
      });
      const ticketIds = tickets.map((t) => t.id);
      if (ticketIds.length > 0) {
        await manager.delete(Execution, { ticketId: In(ticketIds) });
      }
      await manager.delete(Ticket, { spaceId });
      await manager.delete(Agent, { spaceId });
      await manager.delete(Space, { id: spaceId });
    }
  }
}
