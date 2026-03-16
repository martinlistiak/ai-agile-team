import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
  ) {}

  /**
   * Run the reviewer agent on a ticket's PR.
   * Reviews the code diff, posts comments on the GitHub PR, and adds a summary to the ticket.
   */
  async run(
    spaceId: string,
    userMessage: string,
    ticketId?: string,
  ): Promise<string> {
    let agent = await this.agentRepo.findOneBy({
      spaceId,
      agentType: "reviewer",
    });
    if (!agent) {
      // Auto-create the reviewer agent if missing (handles spaces created before agent seeding or partial failures)
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
    this.eventsGateway.emitAgentStatus(spaceId, agent.id, "active");

    // Assign agent to ticket so the frontend can show the electric border
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

        // Move ticket to review status
        await this.ticketsService.moveTicket(ticketId, "review", "agent");
      }

      // Compile rules
      const compiledRules = await this.rulesService.compileRulesForAgent(
        spaceId,
        agent.id,
      );
      const rulesSection = compiledRules
        ? `\n\n# Active Rules\n${compiledRules}`
        : "";
      const fullPrompt = `${REVIEWER_SYSTEM_PROMPT}${rulesSection}\n\n---\n\n${prompt}`;

      // Run the Claude Agent SDK
      let finalResult = "";
      const actionLog: any[] = [];

      for await (const message of query({
        prompt: fullPrompt,
        options: {
          model: getModelForAgent("reviewer"),
          allowedTools: ["Read", "Bash", "Glob", "Grep"],
          cwd: repoPath,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 30,
          executable: "bun",
          abortController,
          stderr: (data: string) => {
            this.logger.debug(`Claude SDK stderr: ${data}`);
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
              }
            }
          }
        }
        if ("result" in message) {
          finalResult = (message as any).result;
        }
      }

      // Post review comments on GitHub PR and summary on ticket
      if (ticketId && ticket) {
        // Post PR review comment on GitHub/GitLab
        try {
          if (!useGitlab && space?.githubRepoUrl && ticket.prUrl) {
            await this.githubService.createPrReviewComment(
              spaceId,
              ticket.prUrl,
              finalResult,
            );
            this.logger.log(`Posted PR review comment for ticket ${ticketId}`);
          }
        } catch (prError) {
          this.logger.error(
            `Failed to post PR review comment for ticket ${ticketId}:`,
            prError,
          );
        }

        // Post summary comment on the ticket
        const summaryComment = `## 🔍 Code Review Complete\n\n${finalResult}`;
        await this.ticketsService.addComment(
          ticketId,
          summaryComment,
          "agent",
          agent.id,
        );

        // If approved, advance to testing; if changes requested, move back to development
        const lowerResult = finalResult.toLowerCase();
        if (
          lowerResult.includes("verdict: approve") ||
          lowerResult.includes("verdict:**approve")
        ) {
          await this.ticketsService.moveTicket(ticketId, "testing", "agent");
        } else if (
          lowerResult.includes("verdict: request_changes") ||
          lowerResult.includes("verdict:**request_changes")
        ) {
          await this.ticketsService.moveTicket(
            ticketId,
            "development",
            "agent",
          );
        }
      }

      // Update execution
      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      execution.actionLog = actionLog;
      await this.executionRepo.save(execution);

      // Trigger learning loop
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
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error");
      throw error;
    }
  }
}
