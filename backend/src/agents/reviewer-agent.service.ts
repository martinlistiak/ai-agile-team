import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { generateText, tool } from "ai";
import { z } from "zod";
import { createMimoProvider } from "./mimo-provider";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { TicketsService } from "../tickets/tickets.service";
import { GithubService } from "./github.service";
import { GitlabService } from "./gitlab.service";
import { RulesService } from "../rules/rules.service";
import { SuggestedRulesService } from "../rules/suggested-rules.service";
import { EventsGateway } from "../chat/events.gateway";
import { formatAgentExecutionLog } from "../common/structured-logger";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";
import { computeCostWeightedTokens } from "../common/subscription.constants";
import { ModelRouterService } from "./model-router.service";
import { AgentMemoryService } from "./agent-memory.service";
import { AgentBoosterService } from "./agent-booster.service";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const REVIEWER_SYSTEM_PROMPT = `You are a Code Reviewer AI agent in an agile software development team.
Your role is to review pull requests, identify issues, and provide constructive feedback.

When given a ticket to review, you should:
1. Read the ticket requirements and acceptance criteria
2. Check out the PR branch and review the diff against the base branch
3. Analyze the code changes for:
   - **Correctness**: Does the code do what the ticket requires?
   - **Code quality**: Clean code, naming, structure, DRY principles
   - **Security**: SQL injection, XSS, auth issues, secrets exposure
   - **Performance**: N+1 queries, unnecessary re-renders, memory leaks
   - **Error handling**: Missing try/catch, unhandled edge cases
   - **Testing**: Are there adequate tests for the changes?
4. Write specific, actionable review comments with file paths and line references
5. Provide an overall summary with a verdict: APPROVE, REQUEST_CHANGES, or COMMENT

IMPORTANT RULES:
- Be constructive and specific — explain WHY something is an issue
- Reference exact file paths and line numbers when pointing out issues
- Distinguish between blocking issues (must fix) and suggestions (nice to have)
- Do not make code changes yourself — only review and comment
- If the code looks good, say so — don't invent problems
- Focus on meaningful issues, not style nitpicks (leave those to linters)

REVIEW OUTPUT FORMAT:
Structure your final response as:

## Review Summary
<overall assessment>

## Verdict: <APPROVE|REQUEST_CHANGES|COMMENT>

## File Comments
For each issue found:
- **File:** <path>
- **Line:** <number or range>
- **Severity:** blocking | suggestion | nitpick
- **Comment:** <your feedback>

## Ticket Compliance
- Does the implementation match the acceptance criteria? (yes/no with details)`;

@Injectable()
export class ReviewerAgentService {
  private readonly logger = new Logger(ReviewerAgentService.name);

  constructor(
    private configService: ConfigService,
    private ticketsService: TicketsService,
    private githubService: GithubService,
    private gitlabService: GitlabService,
    private rulesService: RulesService,
    private suggestedRulesService: SuggestedRulesService,
    @Inject(forwardRef(() => EventsGateway))
    private eventsGateway: EventsGateway,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    private executionRegistry: ExecutionRegistry,
    private agentRunQuota: AgentRunQuotaService,
    private modelRouter: ModelRouterService,
    private agentMemory: AgentMemoryService,
    private agentBooster: AgentBoosterService,
  ) {}

  async run(
    spaceId: string,
    userMessage: string,
    ticketId?: string,
  ): Promise<string> {
    await this.agentRunQuota.assertCanStartRunForSpace(spaceId);

    let agent = await this.agentRepo.findOneBy({
      spaceId,
      agentType: "reviewer",
    });
    if (!agent) {
      this.logger.warn(
        `Reviewer agent missing for space ${spaceId}, auto-creating`,
      );
      agent = this.agentRepo.create({
        spaceId,
        agentType: "reviewer",
        avatarRef: "reviewer_default.png",
        status: "idle",
      });
      await this.agentRepo.save(agent);
    }

    await this.agentRepo.update(agent.id, { status: "active" });
    this.eventsGateway.emitAgentStatus(spaceId, agent.id, "active", ticketId);

    if (ticketId) {
      await this.ticketsService.update(ticketId, {
        assigneeAgentId: agent.id,
      } as any);
    }

    const execution = this.executionRepo.create({
      agentId: agent.id,
      ticketId: ticketId ?? undefined,
      status: "running",
      actionLog: [],
    });
    await this.executionRepo.save(execution);
    this.executionRegistry.register(execution.id);

    const startTime = Date.now();
    this.logger.log(
      formatAgentExecutionLog({
        event: "start",
        executionId: execution.id,
        agentType: "reviewer",
        ticketId,
      }),
    );

    try {
      const space = await this.spaceRepo.findOneBy({ id: spaceId });
      const useGitlab = !space?.githubRepoUrl && !!space?.gitlabRepoUrl;
      const repoPath = useGitlab
        ? await this.gitlabService.getRepoPath(spaceId)
        : await this.githubService.getRepoPath(spaceId);

      // Check for booster fast path
      const fastPath = this.agentBooster.classify("reviewer", userMessage);
      if (fastPath && !ticketId) {
        const boosterResult = this.executeFastPath(fastPath, repoPath);
        if (boosterResult) {
          this.executionRegistry.remove(execution.id);
          execution.status = "completed";
          execution.endTime = new Date();
          execution.tokensUsed = 0;
          execution.modelUsed = "booster";
          execution.actionLog = [
            {
              tool: "booster",
              input: { fastPath, message: userMessage },
              result: boosterResult,
              timestamp: new Date().toISOString(),
            },
          ];
          await this.executionRepo.save(execution);
          await this.agentRepo.update(agent.id, { status: "idle" });
          this.eventsGateway.emitAgentStatus(
            spaceId,
            agent.id,
            "idle",
            ticketId,
          );
          return boosterResult;
        }
      }

      // Build the prompt
      let prompt = userMessage;
      let ticket:
        | {
            id: string;
            title: string;
            description: string;
            priority: string;
            status: string;
            prUrl: string | null;
          }
        | undefined;

      if (ticketId) {
        ticket = await this.ticketsService.findById(ticketId);
        const prInfo = ticket.prUrl
          ? `\n**PR URL:** ${ticket.prUrl}`
          : "\n**PR URL:** No PR found — review the branch runa/${ticketId} against main.";

        prompt = `## Ticket to review

**Title:** ${ticket.title}
**ID:** ${ticket.id}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}${prInfo}

**Description:**
${ticket.description}

---

Review the code changes on branch "runa/${ticketId}" compared to the main branch.
Use \`git diff main...runa/${ticketId}\` to see the changes.

${userMessage ? `**Additional instructions from the user:** ${userMessage}` : "Review this PR according to the ticket requirements and code quality standards."}`;

        await this.ticketsService.moveTicket(ticketId, "review", "agent", {
          id: agent.id,
          name: "Reviewer",
          type: "agent",
        });
      }

      // Compile rules and memories
      const [compiledRules, compiledMemories] = await Promise.all([
        this.rulesService.compileRulesForAgent(spaceId, agent.id),
        this.agentMemory.compileMemoriesForAgent(spaceId, agent.id),
      ]);
      let systemSuffix = "";
      if (compiledRules) {
        systemSuffix += `\n\n# Active Rules\n${compiledRules}`;
      }
      if (compiledMemories) {
        systemSuffix += `\n\n# Learned Patterns\nApply these lessons from past executions:\n${compiledMemories}`;
      }
      const fullSystem = `${REVIEWER_SYSTEM_PROMPT}${systemSuffix}`;

      const { model: modelName } = this.modelRouter.routeModel(
        "reviewer",
        userMessage,
        { ticketId, ticketPriority: ticket?.priority },
      );

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      const reviewerTools = this.buildTools(repoPath);

      const result = await generateText({
        model: provider.chatModel(modelName),
        system: fullSystem,
        messages: [{ role: "user", content: prompt }],
        tools: reviewerTools,
        maxSteps: 30,
      });

      const finalResult = result.text || "";

      // Build action log
      const actionLog: any[] = [];
      for (const step of result.steps ?? []) {
        for (const tc of step.toolCalls ?? []) {
          actionLog.push({
            tool: tc.toolName,
            input: tc.args,
            timestamp: new Date().toISOString(),
          });
          this.eventsGateway.emitExecutionAction(spaceId, {
            executionId: execution.id,
            agentId: agent.id,
            tool: tc.toolName,
            inputSummary: JSON.stringify(tc.args).substring(0, 200),
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Store token usage
      execution.inputTokens = result.usage?.promptTokens ?? 0;
      execution.outputTokens = result.usage?.completionTokens ?? 0;
      execution.cacheReadTokens = 0;
      execution.cacheCreationTokens = 0;
      execution.tokensUsed =
        (result.usage?.promptTokens ?? 0) +
        (result.usage?.completionTokens ?? 0);
      execution.modelUsed = modelName;

      execution.costWeightedTokens = computeCostWeightedTokens({
        inputTokens: execution.inputTokens,
        outputTokens: execution.outputTokens,
        cacheReadTokens: execution.cacheReadTokens,
        cacheCreationTokens: execution.cacheCreationTokens,
        modelUsed: execution.modelUsed,
      });

      // Post review comments on GitHub/GitLab PR and summary on ticket
      if (ticketId && ticket) {
        try {
          if (!useGitlab && space?.githubRepoUrl && ticket.prUrl) {
            await this.githubService.createPrReviewComment(
              spaceId,
              ticket.prUrl,
              finalResult,
            );
            this.logger.log(`Posted PR review comment for ticket ${ticketId}`);
          } else if (useGitlab && space?.gitlabRepoUrl && ticket.prUrl) {
            await this.gitlabService.createMrReviewComment(
              spaceId,
              ticket.prUrl,
              finalResult,
            );
            this.logger.log(`Posted MR review comment for ticket ${ticketId}`);
          }
        } catch (prError) {
          this.logger.error(
            `Failed to post PR/MR review comment for ticket ${ticketId}:`,
            prError,
          );
        }

        // Extract verdict line and move it to the top of the comment
        const verdictMatch = finalResult.match(/^#+\s*Verdict[:\s]*(.+)$/im);
        let formattedResult = finalResult;
        if (verdictMatch) {
          // Remove the verdict section from its original position
          formattedResult = finalResult
            .replace(/^#+\s*Verdict[:\s]*(.+)$/im, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          const verdictValue = verdictMatch[1].trim();
          formattedResult = `**Verdict: ${verdictValue}**\n\n---\n\n${formattedResult}`;
        }

        const summaryComment = `## 🔍 Code Review Complete\n\n${formattedResult}`;
        await this.ticketsService.addComment(
          ticketId,
          summaryComment,
          "agent",
          agent.id,
          "Reviewer",
          "reviewer",
        );

        const lowerResult = finalResult.toLowerCase();
        const isApproved =
          lowerResult.includes("verdict: approve") ||
          lowerResult.includes("verdict:**approve");
        const isRequestChanges =
          lowerResult.includes("verdict: request_changes") ||
          lowerResult.includes("verdict:**request_changes");

        if (isApproved) {
          await this.ticketsService.moveTicket(ticketId, "testing", "agent", {
            id: agent.id,
            name: "Reviewer",
            type: "agent",
          });
        } else if (isRequestChanges) {
          // Don't auto-move back to development — emit event so user can decide
          this.eventsGateway.emitReviewVerdict(spaceId, {
            ticketId,
            verdict: "request_changes",
            summary:
              verdictMatch?.[1]?.trim() ?? "Changes requested by reviewer",
          });

          // Generate rule suggestions from the review shortcomings
          this.generateRuleSuggestionsFromReview(
            spaceId,
            agent.id,
            execution.id,
            finalResult,
          ).catch((err) =>
            this.logger.warn(
              `Failed to generate rule suggestions from review: ${err}`,
            ),
          );
        }
      }

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      execution.actionLog = actionLog;
      await this.executionRepo.save(execution);

      if (execution.costWeightedTokens > 0) {
        this.agentRunQuota
          .deductCreditsForExecution(spaceId, execution.costWeightedTokens)
          .catch((err) =>
            this.logger.warn(
              `Credit deduction failed for execution ${execution.id}:`,
              err,
            ),
          );
      }

      // Trigger learning loops
      this.agentMemory
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Memory extraction failed for execution ${execution.id}:`,
            err,
          ),
        );
      this.suggestedRulesService
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Rule suggestion analysis failed for execution ${execution.id}:`,
            err,
          ),
        )
        .finally(() => {
          this.agentRepo.update(agent.id, { status: "idle" });
          this.eventsGateway.emitAgentStatus(
            spaceId,
            agent.id,
            "idle",
            ticketId,
          );
        });

      this.logger.log(
        formatAgentExecutionLog({
          event: "complete",
          executionId: execution.id,
          agentType: "reviewer",
          ticketId,
          duration: Date.now() - startTime,
        }),
      );

      return (
        finalResult ||
        "Code review completed. See the ticket comments for details."
      );
    } catch (error) {
      this.logger.error("Reviewer Agent error:", error);
      this.logger.error(
        formatAgentExecutionLog({
          event: "fail",
          executionId: execution.id,
          agentType: "reviewer",
          ticketId,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      this.executionRegistry.remove(execution.id);
      execution.status = "failed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "error" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error", ticketId);
      throw error;
    }
  }

  /**
   * Generate rule suggestions directly from review shortcomings.
   * Called when the reviewer requests changes — extracts blocking issues
   * and suggests rules to prevent them in the future.
   */
  private async generateRuleSuggestionsFromReview(
    spaceId: string,
    agentId: string,
    executionId: string,
    reviewText: string,
  ): Promise<void> {
    // Extract blocking issues from the review
    const blockingPattern =
      /\*\*Severity:\*\*\s*blocking[\s\S]*?\*\*Comment:\*\*\s*(.+?)(?=\n-\s*\*\*File|\n##|$)/gi;
    const blockingIssues: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = blockingPattern.exec(reviewText)) !== null) {
      blockingIssues.push(match[1].trim());
    }

    if (blockingIssues.length === 0) return;

    // Create rule suggestions from blocking issues
    for (const issue of blockingIssues.slice(0, 3)) {
      await this.suggestedRulesService.createFromReview(
        spaceId,
        agentId,
        executionId,
        `Avoid: ${issue}`,
        `Code reviewer flagged this as a blocking issue during review.`,
      );
    }
  }

  private buildTools(repoPath: string) {
    return {
      read_file: tool({
        description: "Read the contents of a file in the repository",
        parameters: z.object({
          file_path: z.string().describe("Relative file path"),
        }),
        execute: async (input) => {
          try {
            const target = join(repoPath, input.file_path);
            if (!target.startsWith(repoPath))
              return { error: "Path outside repository" };
            const content = readFileSync(target, "utf-8");
            return {
              content:
                content.length > 50_000
                  ? content.slice(0, 50_000) + "\n... (truncated)"
                  : content,
            };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      bash: tool({
        description:
          "Execute a shell command in the repository (for git diff, grep, etc.)",
        parameters: z.object({
          command: z.string().describe("Shell command to execute"),
        }),
        execute: async (input) => {
          try {
            const output = execSync(input.command, {
              cwd: repoPath,
              timeout: 60_000,
              encoding: "utf-8",
              maxBuffer: 1024 * 1024 * 5,
            });
            return {
              output:
                output.length > 10_000
                  ? output.slice(0, 10_000) + "\n... (truncated)"
                  : output,
            };
          } catch (err: any) {
            return {
              error: err.message,
              stdout: err.stdout?.slice(0, 5000),
              stderr: err.stderr?.slice(0, 5000),
            };
          }
        },
      }),
      glob: tool({
        description: "List files matching a glob pattern",
        parameters: z.object({
          pattern: z.string().describe("Glob pattern"),
        }),
        execute: async (input) => {
          try {
            const output = execSync(
              `find . -path './.git' -prune -o -path '${input.pattern}' -print 2>/dev/null | head -200`,
              { cwd: repoPath, encoding: "utf-8", timeout: 10_000 },
            );
            return { files: output.trim().split("\n").filter(Boolean) };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      grep: tool({
        description: "Search for a pattern in files",
        parameters: z.object({
          pattern: z.string().describe("Search pattern (regex)"),
          path: z.string().optional().describe("Optional path to search in"),
        }),
        execute: async (input) => {
          try {
            const searchPath = input.path || ".";
            const output = execSync(
              `grep -rn --include='*' '${input.pattern.replace(/'/g, "\\'")}' ${searchPath} 2>/dev/null | head -100`,
              { cwd: repoPath, encoding: "utf-8", timeout: 10_000 },
            );
            return { matches: output.trim() };
          } catch (err: any) {
            if (err.status === 1) return { matches: "" };
            return { error: err.message };
          }
        },
      }),
    };
  }

  private executeFastPath(fastPath: string, repoPath: string): string | null {
    try {
      const opts = {
        cwd: repoPath,
        timeout: 60_000,
        encoding: "utf-8" as const,
      };
      switch (fastPath) {
        case "reviewer:typecheck": {
          const output = execSync("npx tsc --noEmit 2>&1 || true", opts);
          const text = output.toString().trim();
          return text
            ? `## Type Check Results\n\n\`\`\`\n${text.slice(0, 3000)}\n\`\`\``
            : "## Type Check Results\n\nNo type errors found.";
        }
        case "reviewer:lint": {
          const output = execSync("npx eslint . 2>&1 || true", opts);
          const text = output.toString().trim();
          return text
            ? `## Lint Results\n\n\`\`\`\n${text.slice(0, 3000)}\n\`\`\``
            : "## Lint Results\n\nNo lint issues found.";
        }
        default:
          return null;
      }
    } catch (err: any) {
      this.logger.warn(`Reviewer booster fast path ${fastPath} failed:`, err);
      return null;
    }
  }
}
