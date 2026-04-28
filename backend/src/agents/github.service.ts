import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";
import { Ticket } from "../entities/ticket.entity";
import { TokenEncryptionService } from "../common/token-encryption.service";

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly workspacesRoot: string;
  /** Tracks last fetch time per spaceId to avoid hammering `git fetch`. */
  private readonly lastFetchTime = new Map<string, number>();
  /** Minimum interval between fetches for the same space (ms). */
  private static readonly FETCH_COOLDOWN_MS = 60_000;

  /**
   * Node's global `fetch` uses Undici with a 10s default TCP connect timeout, which fails on slow
   * networks. Use a shared Agent with a longer connect timeout for api.github.com calls.
   */
  private static readonly githubHttpAgent = new Agent({
    connect: { timeout: 60_000 },
  });

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

  /** GitHub REST API with relaxed connect timeout (see `githubHttpAgent`). */
  private githubRestFetch(
    url: string,
    init?: UndiciRequestInit,
  ): ReturnType<typeof undiciFetch> {
    return undiciFetch(url, {
      ...init,
      dispatcher: GithubService.githubHttpAgent,
    });
  }

  private isTransientGithubNetworkError(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    if (e.message === "fetch failed") return true;
    const cause = (e as Error & { cause?: unknown }).cause;
    if (!cause || typeof cause !== "object") return false;
    const code = "code" in cause ? String((cause as { code: unknown }).code) : "";
    return (
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "UND_ERR_HEADERS_TIMEOUT" ||
      code === "UND_ERR_BODY_TIMEOUT" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "EHOSTUNREACH" ||
      code === "ENETUNREACH"
    );
  }

  private async fetchGithubWithTransientRetry(
    op: () => ReturnType<typeof undiciFetch>,
    context: string,
  ): Promise<Awaited<ReturnType<typeof undiciFetch>>> {
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await op();
      } catch (e) {
        lastError = e;
        if (!this.isTransientGithubNetworkError(e) || attempt === maxAttempts) {
          throw e;
        }
        const delayMs = 500 * attempt;
        this.logger.warn(
          `${context}: transient network error (${e}), retry ${attempt}/${maxAttempts} after ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw lastError;
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
      // Skip if we fetched recently to avoid excessive GitHub API calls
      const now = Date.now();
      const lastFetch = this.lastFetchTime.get(spaceId) ?? 0;
      if (now - lastFetch < GithubService.FETCH_COOLDOWN_MS) {
        return repoDir;
      }
      try {
        execSync("git fetch origin", {
          cwd: repoDir,
          timeout: 60000,
          stdio: "pipe",
        });
        this.lastFetchTime.set(spaceId, now);
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
        // Exclude .github/workflows/ files — pushing workflow changes requires
        // the `workflow` OAuth scope which users typically don't grant.
        execSync("git reset HEAD -- .github/workflows/", {
          cwd: repoDir,
          timeout: 10000,
          stdio: "pipe",
        });
        execSync("git checkout -- .github/workflows/ 2>/dev/null || true", {
          cwd: repoDir,
          timeout: 10000,
          stdio: "pipe",
          shell: "/bin/sh",
        });

        // Re-check if there are still changes to commit after excluding workflows
        const statusAfter = execSync("git status --porcelain", {
          cwd: repoDir,
          timeout: 10000,
          encoding: "utf-8",
        });

        if (statusAfter.trim()) {
          this.logger.log(
            `Committing uncommitted changes for branch ${branchName}`,
          );
          execSync("git add -A", {
            cwd: repoDir,
            timeout: 10000,
            stdio: "pipe",
          });
          execSync(
            `git commit -m "feat: implement changes for ${branchName}"`,
            {
              cwd: repoDir,
              timeout: 30000,
              stdio: "pipe",
            },
          );
        } else {
          this.logger.log(
            `Only workflow files were changed for branch ${branchName}, nothing to commit`,
          );
        }
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
      const errMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to push branch ${branchName}: ${errMsg}`);

      if (errMsg.includes("workflow")) {
        throw new Error(
          `Push rejected: GitHub requires the "workflow" OAuth scope to modify .github/workflows/ files. ` +
            `Please reconnect your GitHub account with the workflow scope, or avoid modifying workflow files.`,
        );
      }

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
   * Get the reviewer-specific GitHub token for a space.
   * Falls back to the regular token if no reviewer token is configured.
   */
  async getReviewerToken(spaceId: string): Promise<string | null> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
    });
    if (!space) return null;

    const user = await this.userRepo.findOneBy({ id: space.userId });
    if (!user) return null;

    if (user.githubReviewerTokenEncrypted) {
      return this.tokenEncryptionService.decrypt(
        user.githubReviewerTokenEncrypted,
      );
    }

    // Fall back to the regular token
    if (user.githubTokenEncrypted) {
      return this.tokenEncryptionService.decrypt(user.githubTokenEncrypted);
    }

    return null;
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

    // Verify the branch has commits ahead of the default branch
    const defaultBranch = await this.getDefaultBranch(owner, repo, token);

    const compareRes = await this.githubRestFetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${defaultBranch}...${branchName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (compareRes.ok) {
      const compareData = (await compareRes.json()) as { ahead_by?: number };
      if (compareData.ahead_by === 0) {
        throw new Error(
          `Branch "${branchName}" has no commits ahead of "${defaultBranch}". The agent may not have made any code changes.`,
        );
      }
    }

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
    // (already fetched above for the compare check)

    const response = await this.githubRestFetch(
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

    const data = (await response.json()) as { html_url: string; number: number };
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
      const response = await this.githubRestFetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branchName}&state=open`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (response.ok) {
        const prs = (await response.json()) as Array<{
          html_url: string;
          number: number;
        }>;
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
      const response = await this.githubRestFetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { default_branch?: string };
        return data.default_branch || "main";
      }
    } catch (e) {
      this.logger.warn(`Failed to get default branch, using 'main': ${e}`);
    }
    return "main";
  }

  /**
   * GitHub allows only one pending review per user per PR. Remove ours before submitting a new review.
   * Lists all pages — pending reviews are easy to miss on busy PRs when only the first page is fetched.
   */
  private async deletePendingReviewByTokenUser(
    owner: string,
    repo: string,
    prNumber: string,
    token: string,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    try {
      const meRes = await this.githubRestFetch("https://api.github.com/user", { headers });
      if (!meRes.ok) return;
      const me = (await meRes.json()) as { id: number };
      const perPage = 100;
      for (let page = 1; ; page++) {
        const listRes = await this.githubRestFetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=${perPage}&page=${page}`,
          { headers },
        );
        if (!listRes.ok) return;
        const reviews = (await listRes.json()) as Array<{
          id: number;
          state: string;
          user?: { id: number };
        }>;
        if (!Array.isArray(reviews) || reviews.length === 0) break;
        for (const r of reviews) {
          if (r.user?.id !== me.id) continue;
          if (String(r.state).toUpperCase() !== "PENDING") continue;
          const delRes = await this.githubRestFetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${r.id}`,
            { method: "DELETE", headers },
          );
          if (delRes.ok) {
            this.logger.log(
              `Removed pending GitHub PR review ${r.id} before submitting a new review`,
            );
          } else {
            const errText = await delRes.text();
            this.logger.warn(
              `Could not remove pending review ${r.id}: ${delRes.status} ${errText}`,
            );
          }
        }
        if (reviews.length < perPage) break;
      }
    } catch (e) {
      this.logger.warn(`deletePendingReviewByTokenUser: ${e}`);
    }
  }

  private isGithubPendingReviewConflict(errorBody: string): boolean {
    return (
      errorBody.includes("one pending review") ||
      errorBody.includes("pending review per pull request")
    );
  }

  /**
   * POST /pulls/{id}/reviews with cleanup: delete our pending review(s), submit, and on GitHub's
   * "only one pending review" error clear again and retry once (covers races and failed first attempts).
   */
  private async submitPullRequestReview(
    owner: string,
    repo: string,
    prNumber: string,
    token: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      await this.deletePendingReviewByTokenUser(owner, repo, prNumber, token);
      const res = await this.fetchGithubWithTransientRetry(
        () =>
          this.githubRestFetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          }),
        "submitPullRequestReview",
      );
      const body = await res.text();
      if (res.ok) return { ok: true, status: res.status, body };
      if (
        res.status === 422 &&
        attempt === 0 &&
        this.isGithubPendingReviewConflict(body)
      ) {
        this.logger.warn(
          "GitHub reported an existing pending review; cleared and retrying submit once",
        );
        continue;
      }
      return { ok: false, status: res.status, body };
    }
    return { ok: false, status: 422, body: "exhausted pending-review retries" };
  }

  private async getGithubUserId(token: string): Promise<number | null> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    try {
      const res = await this.githubRestFetch("https://api.github.com/user", {
        headers,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id?: number };
      return typeof data.id === "number" ? data.id : null;
    } catch {
      return null;
    }
  }

  private async getPullRequestAuthorUserId(
    owner: string,
    repo: string,
    prNumber: string,
    token: string,
  ): Promise<number | null> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    try {
      const res = await this.githubRestFetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { user?: { id?: number } };
      return typeof data.user?.id === "number" ? data.user.id : null;
    } catch {
      return null;
    }
  }

  /**
   * Post a review comment on a GitHub pull request.
   */
  /**
   * Post a PR review with optional inline file comments.
   * Parses the review body for file/line references and posts them as inline comments.
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

    const token = await this.getReviewerToken(spaceId);
    if (!token) {
      throw new Error("No GitHub token available for this space");
    }

    const { owner, repo } = this.getOwnerRepo(space.githubRepoUrl);
    const prNumber = this.extractPrNumber(prUrl);
    if (!prNumber) {
      throw new Error(`Could not extract PR number from URL: ${prUrl}`);
    }

    // Parse inline comments from the review body
    const inlineComments = this.parseInlineComments(reviewBody);

    // Determine review event based on verdict
    const lowerBody = reviewBody.toLowerCase();
    let event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT";
    if (
      lowerBody.includes("verdict: approve") ||
      lowerBody.includes("verdict:**approve")
    ) {
      event = "APPROVE";
    } else if (
      lowerBody.includes("verdict: request_changes") ||
      lowerBody.includes("verdict:**request_changes")
    ) {
      event = "REQUEST_CHANGES";
    }

    if (event !== "COMMENT") {
      const [reviewerId, authorId] = await Promise.all([
        this.getGithubUserId(token),
        this.getPullRequestAuthorUserId(owner, repo, prNumber, token),
      ]);
      if (
        reviewerId != null &&
        authorId != null &&
        reviewerId === authorId
      ) {
        this.logger.log(
          "PR author matches the GitHub token user; using COMMENT (GitHub disallows APPROVE/REQUEST_CHANGES on your own PR)",
        );
        event = "COMMENT";
      }
    }

    let r = await this.submitPullRequestReview(owner, repo, prNumber, token, {
      body: reviewBody,
      event,
      comments: inlineComments,
    });

    if (r.ok) return;

    if (r.status === 422) {
      const errorBody = r.body;
      // 422 can happen for two reasons:
      // 1. Inline comments reference files/lines not in the diff
      // 2. APPROVE/REQUEST_CHANGES on your own PR (same token authored it)
      // Strategy: retry without inline comments first, then fall back to COMMENT event
      if (inlineComments.length > 0) {
        this.logger.warn(
          `Inline comments failed, retrying without them: ${errorBody}`,
        );
        r = await this.submitPullRequestReview(owner, repo, prNumber, token, {
          body: reviewBody,
          event,
        });
        if (r.ok) return;

        if (r.status === 422 && event !== "COMMENT") {
          this.logger.warn(
            `Review event "${event}" rejected, falling back to COMMENT: ${r.body}`,
          );
          r = await this.submitPullRequestReview(owner, repo, prNumber, token, {
            body: reviewBody,
            event: "COMMENT",
          });
          if (r.ok) return;
          throw new Error(
            `GitHub PR review fallback failed (${r.status}): ${r.body}`,
          );
        }
        throw new Error(
          `GitHub PR review retry failed (${r.status}): ${r.body}`,
        );
      }

      // No inline comments — the event itself is likely the problem
      if (event !== "COMMENT") {
        this.logger.warn(
          `Review event "${event}" rejected (422), falling back to COMMENT: ${errorBody}`,
        );
        r = await this.submitPullRequestReview(owner, repo, prNumber, token, {
          body: reviewBody,
          event: "COMMENT",
        });
        if (r.ok) return;
        throw new Error(
          `GitHub PR review fallback failed (${r.status}): ${r.body}`,
        );
      }
    }

    throw new Error(`GitHub PR review failed (${r.status}): ${r.body}`);
  }

  /**
   * Parse file comments from the reviewer's structured output.
   * Looks for patterns like:
   *   - **File:** path/to/file.ts
   *   - **Line:** 42
   *   - **Comment:** The feedback text
   */
  private parseInlineComments(
    reviewBody: string,
  ): Array<{ path: string; line: number; body: string }> {
    const comments: Array<{ path: string; line: number; body: string }> = [];
    const pattern =
      /-\s*\*\*File:\*\*\s*(.+?)\n-\s*\*\*Line:\*\*\s*(\d+)[\s\S]*?-\s*\*\*(?:Severity:\*\*\s*.+?\n-\s*\*\*)?Comment:\*\*\s*(.+?)(?=\n\n|\n-\s*\*\*File:|\n##|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(reviewBody)) !== null) {
      const path = match[1].trim().replace(/^`|`$/g, "");
      const line = parseInt(match[2].trim(), 10);
      const body = match[3].trim();
      if (path && line > 0 && body) {
        comments.push({ path, line, body });
      }
    }
    return comments;
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

  /**
   * Merge a GitHub pull request.
   */
  async mergePullRequest(spaceId: string, prUrl: string): Promise<void> {
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

    const response = await this.githubRestFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ merge_method: "squash" }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `GitHub PR merge failed (${response.status}): ${errorBody}`,
      );
    }
  }
}
