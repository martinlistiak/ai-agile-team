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
   * Clones if not already cloned. Does NOT reset to origin/HEAD to preserve local branches.
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
      // Fetch latest from remote but don't reset (preserve local branches)
      try {
        execSync("git fetch origin", {
          cwd: repoDir,
          timeout: 60000,
          stdio: "pipe",
        });
        this.logger.log(`Fetched latest for space ${spaceId}`);
      } catch (e) {
        this.logger.warn(`Failed to fetch latest: ${e}`);
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
        'git config user.email "agent@runa-app.com" && git config user.name "Runa Agent"',
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
   * Checkout or create a branch. If the branch exists locally or remotely, checks it out.
   * Otherwise creates a new branch from the default branch.
   */
  async checkoutBranch(spaceId: string, branchName: string): Promise<string> {
    const repoDir = await this.getRepoPath(spaceId);

    try {
      // Check if branch exists locally
      const localBranches = execSync("git branch --list", {
        cwd: repoDir,
        timeout: 10000,
        encoding: "utf-8",
      });

      if (localBranches.includes(branchName)) {
        execSync(`git checkout "${branchName}"`, {
          cwd: repoDir,
          timeout: 10000,
          stdio: "pipe",
        });
        this.logger.log(`Checked out existing local branch ${branchName}`);
        return repoDir;
      }

      // Check if branch exists on remote
      const remoteBranches = execSync("git branch -r --list", {
        cwd: repoDir,
        timeout: 10000,
        encoding: "utf-8",
      });

      if (remoteBranches.includes(`origin/${branchName}`)) {
        execSync(`git checkout -b "${branchName}" "origin/${branchName}"`, {
          cwd: repoDir,
          timeout: 10000,
          stdio: "pipe",
        });
        this.logger.log(`Checked out remote branch ${branchName}`);
        return repoDir;
      }

      // Branch doesn't exist, create it from default branch
      execSync(`git checkout -b "${branchName}"`, {
        cwd: repoDir,
        timeout: 10000,
        stdio: "pipe",
      });
      this.logger.log(`Created new branch ${branchName}`);
      return repoDir;
    } catch (e) {
      this.logger.error(`Failed to checkout branch ${branchName}: ${e}`);
      throw new Error(`Failed to checkout branch: ${e}`);
    }
  }

  /**
   * Push a branch to the remote repository.
   * Ensures the branch is checked out and commits any uncommitted changes first.
   */
  async pushBranch(spaceId: string, branchName: string): Promise<void> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
      relations: { user: true },
    });
    if (!space || !space.githubRepoUrl) {
      throw new Error("Space has no connected GitHub repository");
    }

    const user = await this.userRepo.findOneBy({ id: space.userId });
    const repoDir = join(this.workspacesRoot, spaceId);

    if (!existsSync(join(repoDir, ".git"))) {
      throw new Error("Repository not cloned");
    }

    // Build authenticated remote URL for push
    const decryptedToken = user?.githubTokenEncrypted
      ? this.tokenEncryptionService.decrypt(user.githubTokenEncrypted)
      : undefined;

    if (!decryptedToken) {
      throw new Error("No GitHub token available for push");
    }

    const pushUrl = this.buildAuthenticatedUrl(
      space.githubRepoUrl,
      decryptedToken,
    );

    try {
      // Ensure we're on the correct branch
      const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: repoDir,
        timeout: 10000,
        encoding: "utf-8",
      }).trim();

      if (currentBranch !== branchName) {
        // Try to checkout the branch
        await this.checkoutBranch(spaceId, branchName);
      }

      // Check if there are uncommitted changes and commit them
      const status = execSync("git status --porcelain", {
        cwd: repoDir,
        timeout: 10000,
        encoding: "utf-8",
      });

      if (status.trim()) {
        this.logger.log(
          `Committing uncommitted changes for branch ${branchName}`,
        );
        execSync("git add -A", {
          cwd: repoDir,
          timeout: 10000,
          stdio: "pipe",
        });
        execSync(`git commit -m "feat: implement changes for ${branchName}"`, {
          cwd: repoDir,
          timeout: 30000,
          stdio: "pipe",
        });
      }

      // Check if there are any commits to push
      const commits = execSync("git log --oneline -1", {
        cwd: repoDir,
        timeout: 10000,
        encoding: "utf-8",
      }).trim();

      if (!commits) {
        throw new Error("No commits to push - branch has no changes");
      }

      // Set the remote URL with auth and push
      execSync(`git remote set-url origin "${pushUrl}"`, {
        cwd: repoDir,
        timeout: 10000,
        stdio: "pipe",
      });
      execSync(`git push -u origin "${branchName}" --force`, {
        cwd: repoDir,
        timeout: 120000,
        stdio: "pipe",
      });
      this.logger.log(`Pushed branch ${branchName} for space ${spaceId}`);
    } catch (e) {
      this.logger.error(`Failed to push branch ${branchName}: ${e}`);
      throw new Error(`Failed to push branch to GitHub: ${e}`);
    }
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
   * Pushes the branch first if it hasn't been pushed yet.
   * If a PR already exists for the branch, returns the existing PR.
   */
  async createPullRequest(
    spaceId: string,
    branchName: string,
    ticketId: string,
    agentSummary?: string,
  ): Promise<{ url: string; number: number }> {
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

    // Check if a PR already exists for this branch
    const existingPr = await this.findExistingPr(
      owner,
      repo,
      branchName,
      token,
    );
    if (existingPr) {
      this.logger.log(
        `PR already exists for branch ${branchName}: ${existingPr.url}`,
      );
      return existingPr;
    }

    // Push the branch to remote before creating PR
    await this.pushBranch(spaceId, branchName);

    const appBaseUrl = this.configService.get(
      "APP_BASE_URL",
      "https://runa-app.com",
    );

    const title = GithubService.formatPrTitle(ticket.id, ticket.title);
    const body = GithubService.formatPrBody(
      { id: ticket.id, description: ticket.description },
      agentSummary || "",
      appBaseUrl,
    );

    // Get the default branch name
    const defaultBranch = await this.getDefaultBranch(owner, repo, token);

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
          base: defaultBranch,
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
    return { url: data.html_url, number: data.number };
  }

  /**
   * Find an existing open PR for a branch.
   */
  private async findExistingPr(
    owner: string,
    repo: string,
    branchName: string,
    token: string,
  ): Promise<{ url: string; number: number } | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branchName}&state=open`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (response.ok) {
        const prs = await response.json();
        if (prs.length > 0) {
          return { url: prs[0].html_url, number: prs[0].number };
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to check for existing PR: ${e}`);
    }
    return null;
  }

  /**
   * Get the default branch name for a repository.
   */
  private async getDefaultBranch(
    owner: string,
    repo: string,
    token: string,
  ): Promise<string> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        return data.default_branch || "main";
      }
    } catch (e) {
      this.logger.warn(`Failed to get default branch, using 'main': ${e}`);
    }
    return "main";
  }

  /**
   * Post a review comment on a GitHub pull request.
   */
  async createPrReviewComment(
    spaceId: string,
    prUrl: string,
    reviewBody: string,
  ): Promise<void> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space || !space.githubRepoUrl) {
      throw new Error("Space has no connected GitHub repository");
    }

    const token = await this.getToken(spaceId);
    if (!token) {
      throw new Error("No GitHub token available for this space");
    }

    const { owner, repo } = this.getOwnerRepo(space.githubRepoUrl);
    const prNumber = this.extractPrNumber(prUrl);
    if (!prNumber) {
      throw new Error(`Could not extract PR number from URL: ${prUrl}`);
    }

    // Post as a PR review (not just a comment) so it shows in the review tab
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: reviewBody,
          event: "COMMENT",
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitHub PR review failed (${response.status}): ${errorBody}`,
      );
    }
  }

  /**
   * Extract the PR number from a GitHub PR URL.
   */
  private extractPrNumber(prUrl: string): string | null {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? match[1] : null;
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
