import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { query } from "@anthropic-ai/claude-agent-sdk";
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
import { getModelForAgent } from "./agent-models.config";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";
const TESTER_SYSTEM_PROMPT = `You are a Tester AI agent in an agile software development team.
Your role is to write and execute tests for the project, ensuring code quality and correctness.

When given a ticket or request to test, you should:
1. Read the ticket requirements, acceptance criteria, and any related code changes
2. Explore the codebase to understand the testing patterns already in use (test framework, file structure, utilities)
3. Write appropriate tests:
   - **Unit tests** for individual functions, services, and components
   - **Integration tests** for API endpoints and service interactions
   - **E2E tests** for user flows (if a browser testing framework is set up)
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
  ) {}
  /**
   * Run the tester agent — either on a specific ticket or a freeform testing instruction.
   */
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
    this.eventsGateway.emitAgentStatus(spaceId, agent.id, "active");

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
    const abortController = this.executionRegistry.register(execution.id);

    let browserSessionActive = false;
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

      // Build prompt
      let prompt = userMessage;
      if (ticketId) {
        const ticket = await this.ticketsService.findById(ticketId);
        prompt = `## Ticket to test

**Title:** ${ticket.title}
**ID:** ${ticket.id}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}

**Description:**
${ticket.description}

---

${userMessage ? `**Additional instructions from the user:** ${userMessage}` : "Write and run tests for this ticket based on its acceptance criteria."}`;

        // Move ticket to testing
        await this.ticketsService.moveTicket(ticketId, "testing", "agent");
      }

      // Compile 3-tier rules for this agent
      const compiledRules = await this.rulesService.compileRulesForAgent(
        spaceId,
        agent.id,
      );
      const rulesSection = compiledRules
        ? `\n\n# Active Rules\n${compiledRules}`
        : "";
      const fullPrompt = `${TESTER_SYSTEM_PROMPT}${rulesSection}\n\n---\n\n${prompt}`;

      // Run the Claude Agent SDK with Playwright MCP for E2E testing
      let finalResult = "";
      const actionLog: any[] = [];
      let lastScreenshotTime = 0;
      const SCREENSHOT_MIN_INTERVAL_MS = 500; // ~2fps cap

      for await (const message of query({
        prompt: fullPrompt,
        options: {
          model: getModelForAgent("tester"),
          allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
          cwd: repoPath,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 50,
          executable: "node",
          abortController,
          stderr: (data: string) => {
            this.logger.debug(`Claude SDK stderr: ${data}`);
          },
          mcpServers: {
            playwright: {
              command: "npx",
              args: ["@anthropic-ai/mcp-server-playwright@latest"],
            },
          },
        },
      })) {
        if ("type" in message && message.type === "assistant") {
          const content = (message as any).message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) {
                finalResult = block.text;
              }
              if (block.type === "tool_use") {
                actionLog.push({
                  tool: block.name,
                  input: block.input,
                  timestamp: new Date().toISOString(),
                });
                // Emit execution_action WebSocket event for live streaming
                this.eventsGateway.emitExecutionAction(spaceId, {
                  executionId: execution.id,
                  agentId: agent.id,
                  tool: block.name,
                  inputSummary:
                    typeof block.input === "string"
                      ? block.input.substring(0, 200)
                      : JSON.stringify(block.input).substring(0, 200),
                  timestamp: new Date().toISOString(),
                });

                // Track Playwright browser session start
                if (
                  !browserSessionActive &&
                  typeof block.name === "string" &&
                  block.name.startsWith("browser_")
                ) {
                  browserSessionActive = true;
                }
              }
            }
          }
        }

        // Detect Playwright MCP tool results containing screenshots
        // The SDK emits tool_use_summary messages with result data from MCP tools
        if ("type" in message && message.type === "tool_use_summary") {
          const summary = message as any;
          const resultContent =
            summary.result ?? summary.content ?? summary.output;
          if (resultContent) {
            const contentBlocks = Array.isArray(resultContent)
              ? resultContent
              : [resultContent];
            for (const block of contentBlocks) {
              if (
                block.type === "image" &&
                block.source?.type === "base64" &&
                block.source?.data
              ) {
                const now = Date.now();
                if (now - lastScreenshotTime >= SCREENSHOT_MIN_INTERVAL_MS) {
                  lastScreenshotTime = now;
                  this.eventsGateway.emitBrowserScreenshot(spaceId, {
                    executionId: execution.id,
                    screenshot: block.source.data,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }

        if ("result" in message) {
          finalResult = (message as any).result;
        }
      }

      // Emit browser session end if a session was active
      if (browserSessionActive) {
        this.eventsGateway.emitBrowserSessionEnd(spaceId, {
          executionId: execution.id,
          timestamp: new Date().toISOString(),
        });
      }

      // If all tests pass and ticket was in testing, move to staged
      if (ticketId && finalResult.toLowerCase().includes("all tests pass")) {
        await this.ticketsService.moveTicket(ticketId, "staged", "agent");
      }

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      execution.actionLog = actionLog;
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");

      // Trigger learning loop — analyze execution for rule suggestions
      this.suggestedRulesService
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Learning loop analysis failed for execution ${execution.id}:`,
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

      // Emit browser session end on error if session was active
      if (browserSessionActive) {
        this.eventsGateway.emitBrowserSessionEnd(spaceId, {
          executionId: execution.id,
          timestamp: new Date().toISOString(),
        });
      }

      this.executionRegistry.remove(execution.id);
      execution.status = "failed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "error" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error");
      throw error;
    }
  }
}
