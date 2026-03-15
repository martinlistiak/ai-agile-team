import {
  BadGatewayException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { User } from "../entities/user.entity";
import { TokenEncryptionService } from "../common/token-encryption.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenEncryptionService: TokenEncryptionService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.userRepo.findOneBy({ email });
    if (existing) throw new ConflictException("Email already registered");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ email, name, hashedPassword });
    await this.userRepo.save(user);

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
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async githubCallback(code: string) {
    const redirectUri = this.configService.get(
      "GITHUB_REDIRECT_URI",
      "http://localhost:3000/login/callback",
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
      });
      await this.userRepo.save(user);
    }

    const token = this.createToken(user);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async getGithubAuthUrl() {
    const clientId = this.configService.get("GITHUB_CLIENT_ID");
    const redirectUri = this.configService.get(
      "GITHUB_REDIRECT_URI",
      "http://localhost:3000/login/callback",
    );
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user:email`;
  }

  async getGitlabAuthUrl() {
    const clientId = this.configService.get("GITLAB_CLIENT_ID");
    const redirectUri = this.configService.get(
      "GITLAB_REDIRECT_URI",
      "http://localhost:3000/login/gitlab/callback",
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
      "http://localhost:3000/login/gitlab/callback",
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
      });
      await this.userRepo.save(user);
    }

    const token = this.createToken(user);
    return { accessToken: token, user: this.sanitizeUser(user) };
  }

  async listGitlabRepositories(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.gitlabTokenEncrypted) {
      throw new UnauthorizedException("GitLab account is not connected");
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
      throw new UnauthorizedException("GitHub account is not connected");
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
    };
  }
}
