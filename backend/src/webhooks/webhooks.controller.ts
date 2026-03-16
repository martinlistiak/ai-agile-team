import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Request } from "express";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { SpacesService } from "../spaces/spaces.service";
import { TicketsService } from "../tickets/tickets.service";
import { EventsGateway } from "../chat/events.gateway";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly spacesService: SpacesService,
    private readonly ticketsService: TicketsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Post("github")
  @HttpCode(200)
  @ApiOperation({ summary: "GitHub webhook receiver (validates HMAC-SHA256)" })
  @ApiHeader({ name: "x-hub-signature-256", required: true })
  @ApiHeader({ name: "x-github-event", required: true })
  @ApiResponse({ status: 200, description: "Webhook processed or ignored" })
  @ApiResponse({ status: 401, description: "Invalid signature" })
  async handleGithubWebhook(
    @Req() req: Request,
    @Headers("x-hub-signature-256") signature: string,
    @Headers("x-github-event") event: string,
  ) {
    const secret = this.configService.get<string>("GITHUB_WEBHOOK_SECRET", "");
    const rawBody = getRawBody(req);

    if (!this.verifySignature(rawBody, signature, secret)) {
      this.logger.warn("Rejected webhook: invalid HMAC-SHA256 signature");
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const repoUrl = payload?.repository?.html_url;

    if (!repoUrl) {
      this.logger.debug("Webhook payload missing repository URL, ignoring");
      return { status: "ignored" };
    }

    // Find matching space by githubRepoUrl
    const space = await this.findSpaceByRepoUrl(repoUrl);
    if (!space) {
      this.logger.debug(`No space found for repo ${repoUrl}, ignoring`);
      return { status: "ignored" };
    }

    if (event === "pull_request") {
      return this.handlePullRequest(payload, space);
    }

    if (event === "push") {
      return this.handlePush(payload, space);
    }

    this.logger.debug(`Unhandled webhook event: ${event}`);
    return { status: "ignored" };
  }

  private async handlePullRequest(payload: any, space: any) {
    if (payload.action !== "closed" || !payload.pull_request?.merged) {
      return { status: "ignored" };
    }

    // Extract ticket ID from PR title: [ticketId] title
    const prTitle = payload.pull_request?.title || "";
    const match = prTitle.match(/^\[([^\]]+)\]/);
    if (!match) {
      this.logger.debug("PR title does not contain ticket ID, ignoring");
      return { status: "ignored" };
    }

    const ticketId = match[1];
    try {
      await this.ticketsService.moveTicket(ticketId, "staged", "pipeline");
      this.logger.log(`Moved ticket ${ticketId} to staged after PR merge`);
      return { status: "processed", ticketId };
    } catch (error) {
      this.logger.warn(`Failed to move ticket ${ticketId}: ${error.message}`);
      return { status: "error", message: error.message };
    }
  }

  private async handlePush(payload: any, space: any) {
    const commitSha = payload.head_commit?.id || payload.after || "";
    const commitMessage = payload.head_commit?.message || "";
    const author =
      payload.head_commit?.author?.name || payload.pusher?.name || "";

    this.eventsGateway.emitGithubPush(space.id, {
      spaceId: space.id,
      commitSha,
      commitMessage,
      author,
    });

    this.logger.log(`Emitted github_push for space ${space.id}`);
    return { status: "processed" };
  }

  private async findSpaceByRepoUrl(repoUrl: string): Promise<any | null> {
    try {
      const allSpaces = await this.spacesService.findAll();
      return (
        allSpaces.find(
          (s) =>
            normalizeRepoUrl(s.githubRepoUrl) === normalizeRepoUrl(repoUrl),
        ) || null
      );
    } catch {
      return null;
    }
  }

  private verifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    return WebhooksController.verifyHmacSignature(payload, signature, secret);
  }

  /**
   * Static helper for HMAC-SHA256 verification — also used by property tests.
   */
  static verifyHmacSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) return false;
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(payload).digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  /**
   * Static helper to compute HMAC-SHA256 signature — used by property tests.
   */
  static computeSignature(payload: string, secret: string): string {
    return (
      "sha256=" +
      crypto.createHmac("sha256", secret).update(payload).digest("hex")
    );
  }
}

/**
 * Normalize a GitHub repo URL for comparison (strip trailing slashes, .git suffix, lowercase).
 */
export function normalizeRepoUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}

/**
 * Extract raw body string from the request.
 * Supports express rawBody property or falls back to JSON.stringify.
 */
function getRawBody(req: Request): string {
  if ((req as any).rawBody) {
    return (req as any).rawBody.toString("utf8");
  }
  return typeof req.body === "string" ? req.body : JSON.stringify(req.body);
}
