import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";
import { Ticket } from "../entities/ticket.entity";
import { TokenEncryptionService } from "../common/token-encryption.service";

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly workspacesRoot: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    private tokenEncryptionService: TokenEncryptionService,
  ) {
    this.workspacesRoot = this.configService.get(
      "WORKSPACES_ROOT",
      "/tmp/runa-workspaces",
    );
    if (!existsSync(this.workspacesRoot)) {
      mkdirSync(this.workspacesRoot, { recursive: true });
    }
  }

  /**
   * Returns the local path to a cloned repo for a space.
   * Clones if not already cloned, pulls latest if already present.
   */
  async getRepoPath(spaceId: string): Promise<string> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
      relations: { user: true },
    });
    if (!space || !space.githubRepoUrl) {
      throw new Error("Space has no connected GitHub repository");
    }

    const user = await this.userRepo.findOneBy({ id: space.userId });
    const repoDir = join(this.workspacesRoot, spaceId);

    if (existsSync(join(repoDir, ".git"))) {
      // Pull latest changes on main/default branch
      try {
        execSync("git fetch origin && git reset --hard origin/HEAD", {
          cwd: repoDir,
          timeout: 60000,
          stdio: "pipe",
        });
        this.logger.log(`Pulled latest for space ${spaceId}`);
      } catch (e) {
        this.logger.warn(`Failed to pull latest: ${e}`);
      }
      return repoDir;
    }

    // Clone the repo
    const decryptedToken = user?.githubTokenEncrypted
      ? this.tokenEncryptionService.decrypt(user.githubTokenEncrypted)
      : undefined;
    const cloneUrl = this.buildAuthenticatedUrl(
      space.githubRepoUrl,
      decryptedToken,
    );
    mkdirSync(repoDir, { recursive: true });

    try {
      execSync(`git clone "${cloneUrl}" .`, {
        cwd: repoDir,
        timeout: 120000,
        stdio: "pipe",
      });
      // Configure git user for commits
      execSync(
        'git config user.email "agent@runa.io" && git config user.name "Runa Agent"',
        {
          cwd: repoDir,
          stdio: "pipe",
        },
      );
      this.logger.log(`Cloned repo for space ${spaceId} to ${repoDir}`);
    } catch (e) {
      this.logger.error(`Failed to clone repo: ${e}`);
      throw new Error("Failed to clone GitHub repository");
    }

    return repoDir;
  }

  /**
   * Create a new branch from the default branch.
   */
  async createBranch(spaceId: string, branchName: string): Promise<string> {
    const repoDir = await this.getRepoPath(spaceId);
    execSync(`git checkout -b "${branchName}"`, {
      cwd: repoDir,
      timeout: 10000,
      stdio: "pipe",
    });
    return repoDir;
  }

  /**
   * Returns the GitHub token for a space's owner (for API calls / push).
   */
  async getToken(spaceId: string): Promise<string | null> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
    });
    if (!space) return null;

    const user = await this.userRepo.findOneBy({ id: space.userId });
    if (!user?.githubTokenEncrypted) return null;

    return this.tokenEncryptionService.decrypt(user.githubTokenEncrypted);
  }

  /**
   * Extract owner and repo name from a GitHub repo URL.
   */
  getOwnerRepo(githubRepoUrl: string): { owner: string; repo: string } {
    // Handle URLs like https://github.com/owner/repo or https://github.com/owner/repo.git
    const url = new URL(githubRepoUrl);
    const parts = url.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/");
    if (parts.length < 2) {
      throw new Error(`Invalid GitHub repo URL: ${githubRepoUrl}`);
    }
    return { owner: parts[0], repo: parts[1] };
  }

  /**
   * Format a PR title from ticket ID and title.
   */
  static formatPrTitle(ticketId: string, ticketTitle: string): string {
    return `[${ticketId}] ${ticketTitle}`;
  }

  /**
   * Format a PR body from ticket information.
   */
  static formatPrBody(
    ticket: { id: string; description: string },
    agentSummary: string,
    appBaseUrl: string,
  ): string {
    const ticketUrl = `${appBaseUrl}/tickets/${ticket.id}`;
    return [
      `## Ticket Description`,
      ``,
      ticket.description || "_No description provided._",
      ``,
      `## Agent Summary`,
      ``,
      agentSummary || "_No summary available._",
      ``,
      `---`,
      ``,
      `[View ticket in Runa](${ticketUrl})`,
    ].join("\n");
  }

  /**
   * Create a pull request on GitHub for a given branch.
   */
  async createPullRequest(
    spaceId: string,
    branchName: string,
    ticketId: string,
    agentSummary?: string,
  ): Promise<{ url: string }> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space || !space.githubRepoUrl) {
      throw new Error("Space has no connected GitHub repository");
    }

    const token = await this.getToken(spaceId);
    if (!token) {
      throw new Error("No GitHub token available for this space");
    }

    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const { owner, repo } = this.getOwnerRepo(space.githubRepoUrl);
    const appBaseUrl = this.configService.get(
      "APP_BASE_URL",
      "http://localhost:3000",
    );

    const title = GithubService.formatPrTitle(ticket.id, ticket.title);
    const body = GithubService.formatPrBody(
      { id: ticket.id, description: ticket.description },
      agentSummary || "",
      appBaseUrl,
    );

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          head: branchName,
          base: "main",
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitHub PR creation failed (${response.status}): ${errorBody}`,
      );
    }

    const data = await response.json();
    return { url: data.html_url };
  }

  private buildAuthenticatedUrl(repoUrl: string, token?: string): string {
    if (!token) return repoUrl;
    try {
      const url = new URL(repoUrl);
      url.username = "x-access-token";
      url.password = token;
      return url.toString();
    } catch {
      // If URL parsing fails, try to inject token into the URL
      return repoUrl.replace("https://", `https://x-access-token:${token}@`);
    }
  }
}
