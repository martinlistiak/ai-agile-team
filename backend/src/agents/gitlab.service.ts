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
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);
  private readonly workspacesRoot: string;
  private readonly baseUrl: string;

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
    this.baseUrl = this.configService.get(
      "GITLAB_BASE_URL",
      "https://gitlab.com",
    );
    if (!existsSync(this.workspacesRoot)) {
      mkdirSync(this.workspacesRoot, { recursive: true });
    }
  }

  /**
   * Returns the local path to a cloned repo for a space using its GitLab repo.
   * Clones if not already cloned, pulls latest if already present.
   */
  async getRepoPath(spaceId: string): Promise<string> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
      relations: { user: true },
    });
    if (!space || !space.gitlabRepoUrl) {
      throw new Error("Space has no connected GitLab repository");
    }

    const user = await this.userRepo.findOneBy({ id: space.userId });
    const repoDir = join(this.workspacesRoot, spaceId);

    if (existsSync(join(repoDir, ".git"))) {
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

    const decryptedToken = user?.gitlabTokenEncrypted
      ? this.tokenEncryptionService.decrypt(user.gitlabTokenEncrypted)
      : undefined;
    const cloneUrl = this.buildAuthenticatedUrl(
      space.gitlabRepoUrl,
      decryptedToken,
    );
    mkdirSync(repoDir, { recursive: true });

    try {
      execSync(`git clone "${cloneUrl}" .`, {
        cwd: repoDir,
        timeout: 120000,
        stdio: "pipe",
      });
      execSync(
        'git config user.email "agent@runa-app.com" && git config user.name "Runa Agent"',
        { cwd: repoDir, stdio: "pipe" },
      );
      this.logger.log(`Cloned GitLab repo for space ${spaceId} to ${repoDir}`);
    } catch (e) {
      this.logger.error(`Failed to clone GitLab repo: ${e}`);
      throw new Error("Failed to clone GitLab repository");
    }

    return repoDir;
  }

  async createBranch(spaceId: string, branchName: string): Promise<string> {
    const repoDir = await this.getRepoPath(spaceId);
    execSync(`git checkout -b "${branchName}"`, {
      cwd: repoDir,
      timeout: 10000,
      stdio: "pipe",
    });
    return repoDir;
  }

  async getToken(spaceId: string): Promise<string | null> {
    const space = await this.spaceRepo.findOne({ where: { id: spaceId } });
    if (!space) return null;

    const user = await this.userRepo.findOneBy({ id: space.userId });
    if (!user?.gitlabTokenEncrypted) return null;

    return this.tokenEncryptionService.decrypt(user.gitlabTokenEncrypted);
  }

  /**
   * Extract project path from a GitLab repo URL.
   * e.g. https://gitlab.com/group/subgroup/project → group/subgroup/project
   */
  getProjectPath(gitlabRepoUrl: string): string {
    const url = new URL(gitlabRepoUrl);
    return url.pathname.replace(/^\//, "").replace(/\.git$/, "");
  }

  static formatMrTitle(ticketId: string, ticketTitle: string): string {
    return `[${ticketId}] ${ticketTitle}`;
  }

  static formatMrBody(
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
   * Create a merge request on GitLab for a given branch.
   */
  async createMergeRequest(
    spaceId: string,
    branchName: string,
    ticketId: string,
    agentSummary?: string,
  ): Promise<{ url: string }> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space || !space.gitlabRepoUrl) {
      throw new Error("Space has no connected GitLab repository");
    }

    const token = await this.getToken(spaceId);
    if (!token) {
      throw new Error("No GitLab token available for this space");
    }

    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const projectPath = this.getProjectPath(space.gitlabRepoUrl);
    const encodedPath = encodeURIComponent(projectPath);
    const appBaseUrl = this.configService.get(
      "APP_BASE_URL",
      "https://runa-app.com",
    );

    const title = GitlabService.formatMrTitle(ticket.id, ticket.title);
    const description = GitlabService.formatMrBody(
      { id: ticket.id, description: ticket.description },
      agentSummary || "",
      appBaseUrl,
    );

    const response = await fetch(
      `${this.baseUrl}/api/v4/projects/${encodedPath}/merge_requests`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          source_branch: branchName,
          target_branch: "main",
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitLab MR creation failed (${response.status}): ${errorBody}`,
      );
    }

    const data = await response.json();
    return { url: data.web_url };
  }

  private buildAuthenticatedUrl(repoUrl: string, token?: string): string {
    if (!token) return repoUrl;
    try {
      const url = new URL(repoUrl);
      url.username = "oauth2";
      url.password = token;
      return url.toString();
    } catch {
      return repoUrl.replace("https://", `https://oauth2:${token}@`);
    }
  }
}
