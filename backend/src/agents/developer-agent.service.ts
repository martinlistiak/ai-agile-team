import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { generateText, tool } from "ai";
import { z } from "zod";
import { createMimoProvider } from "./mimo-provider";
import { ConfigService } from "@nestjs/config";
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
import { appendCompactOutputStyle } from "./compact-output-prompt";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, relative } from "path";

const DEVELOPER_SYSTEM_PROMPT = `You are a Senior Developer AI agent in an agile software development team.
Your role is to implement code changes for assigned tickets.

When given a ticket to work on, you should:
1. Read the ticket requirements and acceptance criteria carefully
2. Explore the codebase to understand the existing architecture, patterns, and conventions
3. Implement the required changes following the project's coding style
4. Create a new git branch named "runa/<ticket-id>" from the default branch
5. Write clean, well-documented code with appropriate comments
6. Commit your changes with a clear, conventional commit message
7. Push the branch to origin
8. Report back with a summary of what you implemented, files changed, and the branch name

When asked to create a PR for a ticket in code review:
1. Check the tickets in the "review" status column (provided in context below)
2. Identify the ticket and its associated branch (runa/<ticket-id>)
3. Checkout the branch
4. Create a pull request to the main branch on GitHub/GitLab

IMPORTANT RULES:
- Always create a feature branch before making changes — NEVER commit to main/master
- Follow existing code patterns and conventions in the project
- Write meaningful commit messages
- Do not delete or overwrite existing tests
- If you encounter issues, report them clearly rather than guessing
- Keep changes focused on the ticket scope — avoid unrelated refactoring`;

@Injectable()
export class DeveloperAgentService {
  private readonly logger = new Logger(DeveloperAgentService.name);

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
    private eventEmitter: EventEmitter2,
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
      agentType: "developer",
    });
    if (!agent) {
      this.logger.warn(
        `Developer agent missing for space ${spaceId}, auto-creating`,
      );
      agent = this.agentRepo.create({
        spaceId,
        agentType: "developer",
        avatarRef: "dev_default.png",
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
        agentType: "developer",
        ticketId,
      }),
    );

    try {
      // Get repo path
      const space = await this.spaceRepo.findOneBy({ id: spaceId });
      const useGitlab = !space?.githubRepoUrl && !!space?.gitlabRepoUrl;
      const repoPath = useGitlab
        ? await this.gitlabService.getRepoPath(spaceId)
        : await this.githubService.getRepoPath(spaceId);

      // Check for booster fast path
      const fastPath = this.agentBooster.classify("developer", userMessage);
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
      let ticketPriority: string | undefined;
      if (ticketId) {
        const ticket = await this.ticketsService.findById(ticketId);
        ticketPriority = ticket.priority;

        let requestedChangesBlock = "";
        if (ticket.requestedChanges && ticket.requestedChangesFeedback) {
          const fb = ticket.requestedChangesFeedback;
          const preview = fb.slice(0, 160);
          const userHasSameFeedback =
            userMessage.length > 0 &&
            preview.length > 20 &&
            userMessage.includes(preview);
          if (!userHasSameFeedback) {
            requestedChangesBlock = `\n\n## Changes requested${
              ticket.requestedChangesSource === "testing"
                ? " (from testing)"
                : ticket.requestedChangesSource === "review"
                  ? " (from code review)"
                  : ""
            }\n\n${fb}\n\nAddress this feedback in your implementation; then push updates to the existing branch \`runa/${ticket.id}\` (or create it if missing).\n`;
          }
        }

        prompt = `## Ticket to implement

**Title:** ${ticket.title}
**ID:** ${ticket.id}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}

**Description:**
${ticket.description}
${requestedChangesBlock}
---

${userMessage ? `**Additional instructions from the user:** ${userMessage}` : "Implement this ticket according to its description and acceptance criteria."}`;

        await this.ticketsService.moveTicket(ticketId, "development", "agent", {
          id: agent.id,
          name: "Developer",
          type: "agent",
        });
      }

      // Compile rules, memories, and ticket context
      const [compiledRules, compiledMemories, spaceTickets] = await Promise.all(
        [
          this.rulesService.compileRulesForAgent(spaceId, agent.id),
          this.agentMemory.compileMemoriesForAgent(spaceId, agent.id),
          this.ticketsService.findBySpace(spaceId),
        ],
      );

      let ticketContext = "";
      if (spaceTickets.length > 0) {
        const ticketsByStatus: Record<string, typeof spaceTickets> = {};
        for (const t of spaceTickets) {
          if (!ticketsByStatus[t.status]) ticketsByStatus[t.status] = [];
          ticketsByStatus[t.status].push(t);
        }
        ticketContext = "\n\n# Current Tickets in Space\n";
        for (const [status, tickets] of Object.entries(ticketsByStatus)) {
          ticketContext += `\n## ${status.charAt(0).toUpperCase() + status.slice(1)} (${tickets.length})\n`;
          for (const t of tickets) {
            ticketContext += `- **${t.title}** (ID: ${t.id}, Priority: ${t.priority})`;
            if (t.prUrl) ticketContext += ` [PR: ${t.prUrl}]`;
            ticketContext += `\n  Branch: runa/${t.id}\n`;
          }
        }
      }

      let systemSuffix = "";
      if (compiledRules) {
        systemSuffix += `\n\n# Active Rules\n${compiledRules}`;
      }
      if (compiledMemories) {
        systemSuffix += `\n\n# Learned Patterns\nApply these lessons from past executions:\n${compiledMemories}`;
      }
      systemSuffix += ticketContext;
      const fullSystem = appendCompactOutputStyle(
        `${DEVELOPER_SYSTEM_PROMPT}${systemSuffix}`,
        this.configService,
      );

      const { model: modelName } = this.modelRouter.routeModel(
        "developer",
        userMessage,
        { ticketId, ticketPriority },
      );

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      // Build developer tools
      const devTools = this.buildTools(repoPath, spaceId, execution, agent);

      const result = await generateText({
        model: provider.chatModel(modelName),
        system: fullSystem,
        messages: [{ role: "user", content: prompt }],
        tools: devTools,
        maxSteps: 50,
      });

      const finalResult = result.text || "";

      // Build action log from steps
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

      // Create PR after implementation
      let prFailed = false;
      if (ticketId) {
        await this.ticketsService.moveTicket(ticketId, "review", "agent", {
          id: agent.id,
          name: "Developer",
          type: "agent",
        });

        try {
          const ticket = await this.ticketsService.findById(ticketId);
          const branchName = `runa/${ticketId}`;
          const prResult = useGitlab
            ? await this.gitlabService.createMergeRequest(
                spaceId,
                branchName,
                ticketId,
                finalResult,
              )
            : await this.githubService.createPullRequest(
                spaceId,
                branchName,
                ticketId,
                finalResult,
              );
          await this.ticketsService.update(ticketId, {
            prUrl: prResult.url,
          } as any);
          this.logger.log(`PR created for ticket ${ticketId}: ${prResult.url}`);

          this.eventEmitter.emit("pr.created", {
            spaceId,
            ticketId,
            ticketTitle: ticket.title,
            prUrl: prResult.url,
            prNumber: (prResult as any).number ?? 0,
          });
        } catch (prError) {
          prFailed = true;
          this.logger.error(
            `Failed to create PR for ticket ${ticketId}:`,
            prError,
          );
          await this.ticketsService.addComment(
            ticketId,
            `⚠️ Failed to create pull request: ${prError instanceof Error ? prError.message : String(prError)}`,
            "agent",
            agent.id,
            "Developer",
            "developer",
          );
        }

        if (!prFailed) {
          await this.ticketsService.update(ticketId, {
            requestedChanges: false,
            requestedChangesFeedback: null,
            requestedChangesSource: null,
          });
        }
      }

      this.executionRegistry.remove(execution.id);
      execution.status = prFailed ? "completed_with_warnings" : "completed";
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
          agentType: "developer",
          ticketId,
          duration: Date.now() - startTime,
        }),
      );

      return (
        finalResult ||
        "Development work completed. Check the repository for changes."
      );
    } catch (error) {
      this.logger.error("Developer Agent error:", error);
      this.logger.log(error);
      this.logger.error(
        formatAgentExecutionLog({
          event: "fail",
          executionId: execution.id,
          agentType: "developer",
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

  private buildTools(
    repoPath: string,
    spaceId: string,
    execution: Execution,
    agent: Agent,
  ) {
    return {
      read_file: tool({
        description: "Read the contents of a file in the repository",
        parameters: z.object({
          file_path: z.string().describe("Relative file path inside the repo"),
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
      write_file: tool({
        description:
          "Write content to a file in the repository (creates or overwrites)",
        parameters: z.object({
          file_path: z.string().describe("Relative file path"),
          content: z.string().describe("File content to write"),
        }),
        execute: async (input) => {
          try {
            const target = join(repoPath, input.file_path);
            if (!target.startsWith(repoPath))
              return { error: "Path outside repository" };
            writeFileSync(target, input.content, "utf-8");

            // Emit file_change event for live code viewer
            const additions: number[] = [];
            const lines = input.content.split("\n");
            for (let i = 0; i < lines.length; i++) additions.push(i + 1);
            this.eventsGateway.emitFileChange(spaceId, {
              executionId: execution.id,
              filePath: input.file_path,
              content: input.content,
              diff: { additions, deletions: [] },
            });

            return { success: true, path: input.file_path };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      edit_file: tool({
        description:
          "Replace a specific string in a file with new content (for surgical edits)",
        parameters: z.object({
          file_path: z.string().describe("Relative file path"),
          old_string: z.string().describe("Exact string to find and replace"),
          new_string: z.string().describe("Replacement string"),
        }),
        execute: async (input) => {
          try {
            const target = join(repoPath, input.file_path);
            if (!target.startsWith(repoPath))
              return { error: "Path outside repository" };
            const content = readFileSync(target, "utf-8");
            if (!content.includes(input.old_string)) {
              return { error: "old_string not found in file" };
            }
            const newContent = content.replace(
              input.old_string,
              input.new_string,
            );
            writeFileSync(target, newContent, "utf-8");

            const additions: number[] = [];
            const deletions: number[] = [];
            const oldLines = input.old_string.split("\n");
            const newLines = input.new_string.split("\n");
            for (let i = 0; i < oldLines.length; i++) deletions.push(i + 1);
            for (let i = 0; i < newLines.length; i++) additions.push(i + 1);
            this.eventsGateway.emitFileChange(spaceId, {
              executionId: execution.id,
              filePath: input.file_path,
              content: input.new_string,
              diff: { additions, deletions },
            });

            return { success: true, path: input.file_path };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      bash: tool({
        description:
          "Execute a shell command in the repository directory. Use for git operations, running tests, installing deps, etc.",
        parameters: z.object({
          command: z.string().describe("Shell command to execute"),
        }),
        execute: async (input) => {
          try {
            const output = execSync(input.command, {
              cwd: repoPath,
              timeout: 120_000,
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
        description: "List files matching a glob pattern in the repository",
        parameters: z.object({
          pattern: z.string().describe("Glob pattern (e.g. 'src/**/*.ts')"),
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
        description: "Search for a pattern in files in the repository",
        parameters: z.object({
          pattern: z.string().describe("Search pattern (regex)"),
          path: z
            .string()
            .optional()
            .describe("Optional path to search in (default: .)"),
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
            // grep returns exit code 1 when no matches found
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
        case "dev:format": {
          const output = execSync(
            "npx prettier --write . 2>&1 || npx eslint --fix . 2>&1",
            opts,
          );
          return `Code formatted successfully.\n\n\`\`\`\n${output.toString().slice(0, 2000)}\n\`\`\``;
        }
        case "dev:lint": {
          const output = execSync("npx eslint . 2>&1 || true", opts);
          return `Lint results:\n\n\`\`\`\n${output.toString().slice(0, 3000)}\n\`\`\``;
        }
        case "dev:install_deps": {
          const output = execSync(
            "npm install 2>&1 || yarn install 2>&1",
            opts,
          );
          return `Dependencies installed.\n\n\`\`\`\n${output.toString().slice(0, 2000)}\n\`\`\``;
        }
        default:
          return null;
      }
    } catch (err: any) {
      this.logger.warn(`Developer booster fast path ${fastPath} failed:`, err);
      return null;
    }
  }
}
