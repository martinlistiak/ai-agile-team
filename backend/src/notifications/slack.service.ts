import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl: string | undefined;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>("SLACK_WEBHOOK_URL");
  }

  /** Post a message to the configured Slack webhook. Non-blocking — failures are logged, never thrown. */
  async send(text: string): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Slack webhook returned ${res.status}: ${await res.text()}`,
        );
      }
    } catch (err) {
      this.logger.warn("Slack webhook request failed", (err as Error).message);
    }
  }

  async notifySignup(email: string, name: string): Promise<void> {
    await this.send(`🎉 New signup: *${name}* (${email})`);
  }

  async notifyCreditTopUp(email: string, amountCents: number): Promise<void> {
    const dollars = (amountCents / 100).toFixed(2);
    await this.send(`💰 Credit top-up: *${email}* added $${dollars}`);
  }

  async notifyCreditsExhausted(email: string): Promise<void> {
    await this.send(`⚠️ Credits exhausted: *${email}* has $0.00 remaining`);
  }

  async sendFeedback(opts: {
    userName: string;
    userEmail: string;
    message: string;
    screenshotUrl?: string;
  }): Promise<void> {
    const lines = [
      `💬 *Feedback* from *${opts.userName}* (${opts.userEmail})`,
      opts.message,
    ];
    if (opts.screenshotUrl) {
      lines.push(`📎 Screenshot: ${opts.screenshotUrl}`);
    }
    await this.send(lines.join("\n"));
  }

  // --- runa-updates channel notifications ---

  async notifyAgentCompleted(
    agentName: string,
    ticketTitle?: string,
  ): Promise<void> {
    const detail = ticketTitle ? ` on "${ticketTitle}"` : "";
    await this.send(`✅ *${agentName}* agent completed${detail}`);
  }

  async notifyAgentFailed(agentName: string, error?: string): Promise<void> {
    const detail = error ? `: ${error.slice(0, 200)}` : "";
    await this.send(`❌ *${agentName}* agent failed${detail}`);
  }

  async notifyPipelineStageChanged(
    ticketTitle: string,
    fromStage: string,
    toStage: string,
  ): Promise<void> {
    await this.send(
      `🔄 "${ticketTitle}" moved from *${fromStage}* → *${toStage}*`,
    );
  }

  async notifyPrCreated(
    ticketTitle: string,
    prNumber: number,
    prUrl: string,
  ): Promise<void> {
    await this.send(
      `🔀 PR #${prNumber} created for "${ticketTitle}"\n${prUrl}`,
    );
  }

  async notifyTicketAssigned(
    ticketTitle: string,
    assignerName: string,
  ): Promise<void> {
    await this.send(`📌 ${assignerName} assigned "${ticketTitle}"`);
  }

  async notifyTicketCommented(
    ticketTitle: string,
    commenterName: string,
  ): Promise<void> {
    await this.send(`💬 ${commenterName} commented on "${ticketTitle}"`);
  }

  async notifyTeamInvitation(
    inviterName: string,
    teamName: string,
    inviteeEmail: string,
  ): Promise<void> {
    await this.send(
      `📨 ${inviterName} invited ${inviteeEmail} to *${teamName}*`,
    );
  }

  async notifyTeamMemberJoined(memberName: string): Promise<void> {
    await this.send(`👋 ${memberName} joined the team`);
  }
}
