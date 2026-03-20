import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { query } from "@anthropic-ai/claude-agent-sdk";
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
import { getModelForAgent } from "./agent-models.config";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";

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
  ) {}
  /**
   * Run the developer agent on a ticket via a chat message.
   * Can be invoked with either:
   *   - A direct user instruction (freeform text)
   *   - A ticket ID to implement
   */
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
      // Get repo path (clones if needed) — prefer GitHub, fall back to GitLab
      const space = await this.spaceRepo.findOneBy({ id: spaceId });
      const useGitlab = !space?.githubRepoUrl && !!space?.gitlabRepoUrl;
      const repoPath = useGitlab
        ? await this.gitlabService.getRepoPath(spaceId)
        : await this.githubService.getRepoPath(spaceId);

      // Build the prompt
      let prompt = userMessage;
      if (ticketId) {
        const ticket = await this.ticketsService.findById(ticketId);
        prompt = `## Ticket to implement

**Title:** ${ticket.title}
**ID:** ${ticket.id}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}

**Description:**
${ticket.description}

---

${userMessage ? `**Additional instructions from the user:** ${userMessage}` : "Implement this ticket according to its description and acceptance criteria."}`;

        // Move ticket to development
        await this.ticketsService.moveTicket(ticketId, "development", "agent");
      }

      // Compile 3-tier rules for this agent
      const compiledRules = await this.rulesService.compileRulesForAgent(
        spaceId,
        agent.id,
      );
      const rulesSection = compiledRules
        ? `\n\n# Active Rules\n${compiledRules}`
        : "";
      const fullPrompt = `${DEVELOPER_SYSTEM_PROMPT}${rulesSection}\n\n---\n\n${prompt}`;

      // Run the Claude Agent SDK
      let finalResult = "";
      const actionLog: any[] = [];

      for await (const message of query({
        prompt: fullPrompt,
        options: {
          model: getModelForAgent("developer"),
          allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
          cwd: repoPath,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 50,
          executable: "bun",
          abortController,
          stderr: (data: string) => {
            this.logger.debug(`Claude SDK stderr: ${data}`);
          },
        },
      })) {
        // Collect messages from the agent
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

                // Emit file_change event for Write/Edit tool uses (live code viewer)
                if (block.name === "Write" || block.name === "Edit") {
                  const input = block.input as Record<string, any>;
                  const filePath =
                    (input.file_path as string) ||
                    (input.filePath as string) ||
                    "";
                  const content =
                    (input.content as string) ||
                    (input.new_string as string) ||
                    "";

                  // Compute simple diff line numbers from content
                  const additions: number[] = [];
                  const deletions: number[] = [];
                  if (block.name === "Write") {
                    // For Write, all lines are additions
                    const lines = content.split("\n");
                    for (let i = 0; i < lines.length; i++) {
                      additions.push(i + 1);
                    }
                  } else if (block.name === "Edit") {
                    // For Edit, old_string lines are deletions, new_string lines are additions
                    const oldString = (input.old_string as string) || "";
                    const newString = (input.new_string as string) || "";
                    const oldLines = oldString.split("\n");
                    const newLines = newString.split("\n");
                    for (let i = 0; i < oldLines.length; i++) {
                      deletions.push(i + 1);
                    }
                    for (let i = 0; i < newLines.length; i++) {
                      additions.push(i + 1);
                    }
                  }

                  this.eventsGateway.emitFileChange(spaceId, {
                    executionId: execution.id,
                    filePath,
                    content,
                    diff: { additions, deletions },
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

      // Update ticket status to review after implementation
      let prFailed = false;
      if (ticketId) {
        await this.ticketsService.moveTicket(ticketId, "review", "agent");

        // Create a pull request for the branch
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
          // Store PR URL on the ticket
          await this.ticketsService.update(ticketId, {
            prUrl: prResult.url,
          } as any);
          this.logger.log(`PR created for ticket ${ticketId}: ${prResult.url}`);

          // Emit PR created notification event
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
          // Add a comment to the ticket with the failure reason
          await this.ticketsService.addComment(
            ticketId,
            `⚠️ Failed to create pull request: ${prError instanceof Error ? prError.message : String(prError)}`,
            "agent",
            agent.id,
          );
        }
      }

      // Update execution
      this.executionRegistry.remove(execution.id);
      execution.status = prFailed ? "completed_with_warnings" : "completed";
      execution.endTime = new Date();
      execution.actionLog = actionLog;
      await this.executionRepo.save(execution);

      // Trigger learning loop — analyze execution for rule suggestions, then set agent idle
      this.suggestedRulesService
        .analyzeExecution(execution.id)
        .catch((err) =>
          this.logger.warn(
            `Learning loop analysis failed for execution ${execution.id}:`,
            err,
          ),
        )
        .finally(() => {
          this.agentRepo.update(agent.id, { status: "idle" });
          this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");
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
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error");
      throw error;
    }
  }
}
