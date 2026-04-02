import { Injectable, Logger } from "@nestjs/common";
import { AgentType } from "./agent-models.config";

/**
 * Result of a booster check — either the task was handled without LLM,
 * or it should proceed to the normal agent flow.
 */
export interface BoosterResult {
  /** Whether the booster handled the task */
  handled: boolean;
  /** The response text if handled */
  response?: string;
  /** Category of the fast path used */
  fastPath?: string;
}

/**
 * Agent Booster: identifies tasks that can be handled without an LLM call
 * and executes them directly. Inspired by Ruflo's Agent Booster (WASM),
 * implemented in TypeScript since Runa is server-side.
 *
 * This service only classifies — actual execution of fast-path operations
 * is done by the calling agent service using its existing dependencies.
 */
@Injectable()
export class AgentBoosterService {
  private readonly logger = new Logger(AgentBoosterService.name);

  /**
   * Check if a user message can be handled without an LLM call.
   * Returns the fast-path category if applicable, or null if the task
   * requires normal LLM processing.
   */
  classify(agentType: AgentType, userMessage: string): string | null {
    const msg = userMessage.toLowerCase().trim();

    switch (agentType) {
      case "pm":
        return this.classifyPm(msg);
      case "developer":
        return this.classifyDeveloper(msg);
      case "reviewer":
        return this.classifyReviewer(msg);
      case "tester":
        return this.classifyTester(msg);
      default:
        return null;
    }
  }

  private classifyPm(msg: string): string | null {
    // List tickets
    if (
      /^(list|show|get)\s+(all\s+)?(my\s+)?(tickets?|tasks?|items?)(\s+in\s+\w+)?[.?!]?$/.test(
        msg,
      )
    ) {
      return "pm:list_tickets";
    }

    // Move ticket to status
    if (
      /^(move|set|change)\s+(ticket\s+)?[\w-]+\s+(to|status)\s+(backlog|development|review|testing|staged|done)[.?!]?$/i.test(
        msg,
      )
    ) {
      return "pm:move_ticket";
    }

    // Delete ticket
    if (/^(delete|remove)\s+(ticket\s+)?[\w-]{36}[.?!]?$/i.test(msg)) {
      return "pm:delete_ticket";
    }

    return null;
  }

  private classifyDeveloper(msg: string): string | null {
    // Format code
    if (
      /^(format|prettier|lint)\s+(the\s+)?(code|files?|project|codebase)[.?!]?$/i.test(
        msg,
      )
    ) {
      return "dev:format";
    }

    // Run linter
    if (/^(run\s+)?(eslint|lint|linter)[.?!]?$/i.test(msg)) {
      return "dev:lint";
    }

    // Install dependencies
    if (/^(install|add)\s+(deps|dependencies|packages?)[.?!]?$/i.test(msg)) {
      return "dev:install_deps";
    }

    return null;
  }

  private classifyReviewer(msg: string): string | null {
    // Run type check
    if (/^(run\s+)?(type\s*check|tsc|typescript\s+check)[.?!]?$/i.test(msg)) {
      return "reviewer:typecheck";
    }

    // Run linter
    if (/^(run\s+)?(eslint|lint|linter)[.?!]?$/i.test(msg)) {
      return "reviewer:lint";
    }

    return null;
  }

  private classifyTester(msg: string): string | null {
    // Run existing tests
    if (
      /^(run|execute)\s+(the\s+)?(tests?|test\s+suite|specs?)[.?!]?$/i.test(msg)
    ) {
      return "tester:run_tests";
    }

    return null;
  }
}
