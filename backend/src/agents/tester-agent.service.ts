import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { generateText, tool } from "ai";
import { z } from "zod";
import { createMimoProvider } from "./mimo-provider";
import { Agent } from "../entities/agent.entity";
import { Ticket } from "../entities/ticket.entity";
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
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TESTER_SYSTEM_PROMPT = `You are a Tester AI agent in an agile software development team.
Your role is to write and execute tests for the project, ensuring code quality and correctness.

When given a ticket or request to test, you should:
1. Read the ticket requirements, acceptance criteria, and any related code changes
2. Explore the codebase to understand the testing patterns already in use (test framework, file structure, utilities)
3. Write appropriate tests:
   - **Unit tests** for individual functions, services, and components
   - **Integration tests** for API endpoints and service interactions
   - **E2E tests** for user flows when applicable
4. Run the tests and verify they pass
5. If tests fail, analyze the failure and report whether it's a test issue or a code bug
6. Report back with a detailed summary: tests written, pass/fail results, coverage notes, and any bugs found

IMPORTANT RULES:
- Follow the existing testing patterns and framework choices in the project
- If no test framework is configured, suggest one appropriate for the tech stack and set it up
- Write tests that are meaningful — avoid trivially passing tests
- Test edge cases and error scenarios, not just the happy path
- Do not modify production code unless you discover a clear bug (report it instead)
- Organize test files to mirror the source directory structure
- Use descriptive test names that explain the expected behavior

TEST REPORTING FORMAT:
After running tests, provide:
- Number of tests written
- Number of tests passing / failing
- List of any bugs or issues discovered
- Recommendations for the developer`;

@Injectable()
export class TesterAgentService {
  private readonly logger = new Logger(TesterAgentService.name);

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
      agentType: "tester",
    });
    if (!agent) {
      this.logger.warn(
        `Tester agent missing for space ${spaceId}, auto-creating`,
      );
      agent = this.agentRepo.create({
        spaceId,
        agentType: "tester",
        avatarRef: "tester_default.png",
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
        agentType: "tester",
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
      const fastPath = this.agentBooster.classify("tester", userMessage);
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

      // Build prompt
      let prompt = userMessage;
      let ticketPriority: string | undefined;
      if (ticketId) {
        const ticket = await this.ticketsService.findById(ticketId);
        ticketPriority = ticket.priority;
        prompt = `## Ticket to test

**Title:** ${ticket.title}
**ID:** ${ticket.id}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}

**Description:**
${ticket.description}

---

${userMessage ? `**Additional instructions from the user:** ${userMessage}` : "Write and run tests for this ticket based on its acceptance criteria."}`;

        await this.ticketsService.moveTicket(ticketId, "testing", "agent", {
          id: agent.id,
          name: "Tester",
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
      const fullSystem = `${TESTER_SYSTEM_PROMPT}${systemSuffix}`;

      const { model: modelName } = this.modelRouter.routeModel(
        "tester",
        userMessage,
        { ticketId, ticketPriority },
      );

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      const testerTools = this.buildTools(repoPath, spaceId, execution, agent);

      const result = await generateText({
        model: provider.chatModel(modelName),
        system: fullSystem,
        messages: [{ role: "user", content: prompt }],
        tools: testerTools,
        maxSteps: 50,
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

      // If all tests pass and ticket was in testing, move to staged
      if (ticketId && finalResult.toLowerCase().includes("all tests pass")) {
        await this.ticketsService.moveTicket(ticketId, "staged", "agent", {
          id: agent.id,
          name: "Tester",
          type: "agent",
        });
      }

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      execution.actionLog = actionLog;
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle", ticketId);

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
      this.suggestedRulesService
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Rule suggestion analysis failed for execution ${execution.id}:`,
            err,
          ),
        );
      this.agentMemory
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Memory extraction failed for execution ${execution.id}:`,
            err,
          ),
        );

      this.logger.log(
        formatAgentExecutionLog({
          event: "complete",
          executionId: execution.id,
          agentType: "tester",
          ticketId,
          duration: Date.now() - startTime,
        }),
      );

      return (
        finalResult || "Testing completed. See the execution log for details."
      );
    } catch (error) {
      this.logger.error("Tester Agent error:", error);
      this.logger.error(
        formatAgentExecutionLog({
          event: "fail",
          executionId: execution.id,
          agentType: "tester",
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
        description: "Write content to a file (creates or overwrites)",
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
            return { success: true, path: input.file_path };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      edit_file: tool({
        description: "Replace a specific string in a file with new content",
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
            if (!content.includes(input.old_string))
              return { error: "old_string not found in file" };
            writeFileSync(
              target,
              content.replace(input.old_string, input.new_string),
              "utf-8",
            );
            return { success: true, path: input.file_path };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      bash: tool({
        description: "Execute a shell command in the repository directory",
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
        timeout: 120_000,
        encoding: "utf-8" as const,
      };
      switch (fastPath) {
        case "tester:run_tests": {
          const output = execSync(
            "npm test 2>&1 || npx jest 2>&1 || npx vitest run 2>&1 || true",
            opts,
          );
          const text = output.toString().trim();
          return `## Test Results\n\n\`\`\`\n${text.slice(0, 5000)}\n\`\`\``;
        }
        default:
          return null;
      }
    } catch (err: any) {
      this.logger.warn(`Tester booster fast path ${fastPath} failed:`, err);
      return null;
    }
  }
}
