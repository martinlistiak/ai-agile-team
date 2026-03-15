import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(private configService: ConfigService) {
    this.fromAddress = this.configService.get("MAIL_FROM", "noreply@runa.dev");
    this.appUrl = this.configService.get("APP_URL", "http://localhost:3000");

    const host = this.configService.get("SMTP_HOST", "");
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>("SMTP_PORT", 587),
        secure: this.configService.get("SMTP_SECURE", "false") === "true",
        auth: {
          user: this.configService.get("SMTP_USER", ""),
          pass: this.configService.get("SMTP_PASS", ""),
        },
      });
    } else {
      // Dev fallback: log emails to console
      this.transporter = null as any;
      this.logger.warn(
        "No SMTP_HOST configured — emails will be logged to console",
      );
    }
  }

  async sendInvitation(params: {
    to: string;
    teamName: string;
    inviterName: string;
    token: string;
  }): Promise<void> {
    const acceptUrl = `${this.appUrl}/invitations/${params.token}`;

    const subject = `${params.inviterName} invited you to join ${params.teamName} on Runa`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">You've been invited</h2>
        <p style="color: #555; line-height: 1.6;">
          <strong>${params.inviterName}</strong> has invited you to join
          <strong>${params.teamName}</strong> on Runa.
        </p>
        <a href="${acceptUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Accept invitation
        </a>
        <p style="color: #999; font-size: 13px;">
          This invitation expires in 7 days. If you didn't expect this, you can ignore it.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${params.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Accept URL: ${acceptUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject,
        html,
      });
      this.logger.log(`Invitation email sent to ${params.to}`);
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${params.to}`, err);
      throw err;
    }
  }
}
