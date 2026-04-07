import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { generateText, tool } from "ai";
import { z } from "zod";
import { createMimoProvider } from "./mimo-provider";
import { Agent } from "../entities/agent.entity";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { ModelRouterService } from "./model-router.service";
import { Space } from "../entities/space.entity";
import { TicketsService } from "../tickets/tickets.service";
import { RulesService } from "../rules/rules.service";
import { SuggestedRulesService } from "../rules/suggested-rules.service";
import { GithubService } from "./github.service";
import { GitlabService } from "./gitlab.service";
import { EventsGateway } from "../chat/events.gateway";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";
import { computeCostWeightedTokens } from "../common/subscription.constants";
import { AgentMemoryService } from "./agent-memory.service";
import { AgentBoosterService } from "./agent-booster.service";

const SYSTEM_PROMPT = `You are a Product Manager AI agent in an agile software development team. Your role is to:

1. Take user requirements and break them into well-structured, actionable tickets
2. Each ticket should have a clear title, detailed description with acceptance criteria in markdown format
3. Assign appropriate priority levels based on business impact and urgency
4. Create multiple tickets when a feature requires several work items
5. Browse the connected codebase to understand existing implementation, suggest next steps, and identify gaps in requirements

You can also delete tickets when the user asks to remove, discard, or clean up tasks that are no longer needed.

IMPORTANT: When the user refers to an existing ticket by name, status, or description (e.g. "the Test ticket in backlog"), you MUST use the list_tickets tool to look up the ticket ID yourself. NEVER ask the user for a ticket ID — always resolve it on your own by listing tickets and matching by title or status.

When creating tickets:
- Use clear, concise titles that describe the work item
- Include "## Acceptance Criteria" section with checkboxes in the description
- Include "## Technical Notes" when relevant
- Set priority: critical (blocking), high (important), medium (standard), low (nice-to-have)
- When screenshots or image attachments are provided, use them as supporting product context for the tickets you create

You have read-only access to the project's source code via list_files and read_file tools.
Use them to ground your tickets in the actual codebase — reference existing files, modules, or patterns when writing technical notes or acceptance criteria.

CRITICAL: If list_files or read_file return an error (e.g. no repository connected), silently ignore it and continue with your task. NEVER mention repository access issues, connection problems, or permissions to the user. NEVER suggest the user configure repository access. Simply create tickets based on the information you have.

Always use the create_ticket tool to create tickets. After creating all tickets, provide a brief summary of what you created.`;

function inferMediaType(data: Buffer, fallback: string): string {
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (data.length >= 6) {
    const header = data.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return fallback;
}

@Injectable()
export class PmAgentService {
  private readonly logger = new Logger(PmAgentService.name);

  constructor(
    private configService: ConfigService,
    private ticketsService: TicketsService,
    private rulesService: RulesService,
    private suggestedRulesService: SuggestedRulesService,
    private githubService: GithubService,
    private gitlabService: GitlabService,
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
    attachments: Array<{
      fileName: string;
      mimeType: string;
      data: Buffer;
    }> = [],
  ): Promise<string> {
    await this.agentRunQuota.assertCanStartRunForSpace(spaceId);

    let agent = await this.agentRepo.findOneBy({ spaceId, agentType: "pm" });
    if (!agent) {
      this.logger.warn(`PM agent missing for space ${spaceId}, auto-creating`);
      agent = this.agentRepo.create({
        spaceId,
        agentType: "pm",
        avatarRef: "pm_default.png",
        status: "idle",
      });
      await this.agentRepo.save(agent);
    }

    await this.agentRepo.update(agent.id, { status: "active" });
    this.eventsGateway.emitAgentStatus(spaceId, agent.id, "active");

    const execution = this.executionRepo.create({
      agentId: agent.id,
      status: "running",
      actionLog: [],
    });
    await this.executionRepo.save(execution);
    this.executionRegistry.register(execution.id);

    try {
      // Check for booster fast path (no LLM needed)
      const fastPath = this.agentBooster.classify("pm", userMessage);
      if (fastPath && attachments.length === 0) {
        const boosterResult = await this.executeFastPath(
          fastPath,
          userMessage,
          spaceId,
        );
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
          this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");
          return boosterResult;
        }
      }

      // Build user content parts
      const userParts: any[] = [];
      if (userMessage.trim()) {
        userParts.push({ type: "text" as const, text: userMessage.trim() });
      }
      for (const attachment of attachments) {
        if (!attachment.mimeType.startsWith("image/")) continue;
        userParts.push({
          type: "image" as const,
          image: attachment.data,
          mimeType: inferMediaType(attachment.data, attachment.mimeType),
        });
      }
      if (userParts.length === 0) {
        userParts.push({
          type: "text" as const,
          text: "Analyze the provided input and create the appropriate tickets.",
        });
      }

      // Compile rules and memories
      const [compiledRules, compiledMemories] = await Promise.all([
        this.rulesService.compileRulesForAgent(spaceId, agent.id),
        this.agentMemory.compileMemoriesForAgent(spaceId, agent.id),
      ]);
      let systemPrompt = SYSTEM_PROMPT;
      if (compiledRules) {
        systemPrompt += `\n\n# Active Rules\n${compiledRules}`;
      }
      if (compiledMemories) {
        systemPrompt += `\n\n# Learned Patterns\nApply these lessons from past executions:\n${compiledMemories}`;
      }

      const { model: modelName } = this.modelRouter.routeModel(
        "pm",
        userMessage,
        { envModel: this.configService.get("MIMO_MODEL") },
      );

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      // Define tools for the PM agent
      const pmTools = this.buildTools(spaceId);

      const result = await generateText({
        model: provider.chatModel(modelName),
        system: systemPrompt,
        messages: [{ role: "user", content: userParts }],
        tools: pmTools,
        maxSteps: 15,
      });

      const finalText = result.text || "";

      // Build action log from tool calls
      for (const step of result.steps ?? []) {
        for (const tc of step.toolCalls ?? []) {
          execution.actionLog.push({
            tool: tc.toolName,
            input: tc.args,
            timestamp: new Date().toISOString(),
          });
        }
        for (const tr of step.toolResults ?? []) {
          const existing = execution.actionLog.find(
            (a: any) => a.tool === tr.toolName && !a.result,
          );
          if (existing) existing.result = tr.result;
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

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");

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

      return finalText || "Tickets have been created successfully.";
    } catch (error) {
      this.logger.error("PM Agent error:", error);
      this.executionRegistry.remove(execution.id);
      execution.status = "failed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "error" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error");
      throw error;
    }
  }

  private buildTools(spaceId: string) {
    return {
      create_ticket: tool({
        description:
          "Create a new ticket on the kanban board with title, description (markdown with acceptance criteria), and priority",
        parameters: z.object({
          title: z.string().describe("Short, descriptive ticket title"),
          description: z
            .string()
            .describe(
              "Detailed markdown description including acceptance criteria",
            ),
          priority: z
            .enum(["low", "medium", "high", "critical"])
            .describe("Ticket priority"),
          status: z.enum(["backlog"]).optional().describe("Initial status"),
        }),
        execute: async (input) => {
          const ticket = await this.ticketsService.create({
            spaceId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            status: input.status || "backlog",
          });
          return { success: true, ticketId: ticket.id, title: ticket.title };
        },
      }),
      update_ticket: tool({
        description: "Update an existing ticket",
        parameters: z.object({
          ticket_id: z.string().describe("The ticket ID to update"),
          title: z.string().optional(),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        }),
        execute: async (input) => {
          const { ticket_id, ...updates } = input;
          const ticket = await this.ticketsService.update(ticket_id, updates);
          return { success: true, ticketId: ticket.id };
        },
      }),
      delete_ticket: tool({
        description:
          "Delete an existing ticket from the kanban board. Use this when the user asks to remove, delete, or discard a ticket/task.",
        parameters: z.object({
          ticket_id: z.string().describe("The ID of the ticket to delete"),
        }),
        execute: async (input) => {
          await this.ticketsService.delete(input.ticket_id);
          return { success: true, ticketId: input.ticket_id };
        },
      }),
      list_tickets: tool({
        description:
          "List all tickets in the current space. Returns ticket id, title, status, and priority for each ticket.",
        parameters: z.object({
          status: z
            .enum(["backlog", "in_progress", "review", "done"])
            .optional()
            .describe("Optional: filter tickets by status column"),
        }),
        execute: async (input) => {
          const tickets = await this.ticketsService.findBySpace(spaceId);
          const filtered = input.status
            ? tickets.filter((t) => t.status === input.status)
            : tickets;
          return {
            tickets: filtered.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
            })),
          };
        },
      }),
      list_files: tool({
        description:
          "List files and directories at a given path in the connected repository.",
        parameters: z.object({
          path: z
            .string()
            .describe('Relative path inside the repo (use "" or "." for root)'),
        }),
        execute: async (input) => {
          try {
            const repoPath = await this.getRepoPathForSpace(spaceId);
            const target = join(repoPath, input.path || ".");
            if (!target.startsWith(repoPath)) {
              return { error: "Path is outside the repository" };
            }
            const entries = readdirSync(target, { withFileTypes: true })
              .filter((e) => e.name !== ".git")
              .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
            return { files: entries };
          } catch (err: any) {
            return { error: err.message ?? String(err) };
          }
        },
      }),
      read_file: tool({
        description:
          "Read the contents of a file in the connected repository (truncated to 10 000 chars for large files).",
        parameters: z.object({
          path: z.string().describe("Relative file path inside the repo"),
        }),
        execute: async (input) => {
          try {
            const repoPath = await this.getRepoPathForSpace(spaceId);
            const target = join(repoPath, input.path);
            if (!target.startsWith(repoPath)) {
              return { error: "Path is outside the repository" };
            }
            const MAX_CHARS = 10_000;
            const content = readFileSync(target, "utf-8");
            const truncated = content.length > MAX_CHARS;
            return {
              content: truncated ? content.slice(0, MAX_CHARS) : content,
              truncated,
            };
          } catch (err: any) {
            return { error: err.message ?? String(err) };
          }
        },
      }),
    };
  }

  private async getRepoPathForSpace(spaceId: string): Promise<string> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space?.githubRepoUrl && space?.gitlabRepoUrl) {
      return this.gitlabService.getRepoPath(spaceId);
    }
    return this.githubService.getRepoPath(spaceId);
  }

  private async executeFastPath(
    fastPath: string,
    userMessage: string,
    spaceId: string,
  ): Promise<string | null> {
    try {
      switch (fastPath) {
        case "pm:list_tickets": {
          const tickets = await this.ticketsService.findBySpace(spaceId);
          if (tickets.length === 0) {
            return "No tickets found in this space.";
          }
          const lines = tickets.map(
            (t) =>
              `- **${t.title}** (${t.status}, ${t.priority}) — \`${t.id}\``,
          );
          return `Found ${tickets.length} ticket(s):\n\n${lines.join("\n")}`;
        }
        case "pm:move_ticket": {
          const match = userMessage.match(
            /(?:move|set|change)\s+(?:ticket\s+)?([\w-]+)\s+(?:to|status)\s+(\w+)/i,
          );
          if (!match) return null;
          const [, ticketId, status] = match;
          await this.ticketsService.moveTicket(ticketId, status, "agent", {
            id: "pm",
            name: "PM",
            type: "agent",
          });
          return `Moved ticket \`${ticketId}\` to **${status}**.`;
        }
        case "pm:delete_ticket": {
          const match = userMessage.match(
            /(?:delete|remove)\s+(?:ticket\s+)?([\w-]{36})/i,
          );
          if (!match) return null;
          await this.ticketsService.delete(match[1]);
          return `Deleted ticket \`${match[1]}\`.`;
        }
        default:
          return null;
      }
    } catch (err: any) {
      this.logger.warn(`Booster fast path ${fastPath} failed:`, err);
      return null;
    }
  }
}
