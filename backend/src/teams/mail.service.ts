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
    this.fromAddress = this.configService.get(
      "MAIL_FROM",
      "noreply@runa-app.com",
    );
    this.appUrl = this.configService.get("APP_URL", "https://runa-app.com");

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

  async sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
  }): Promise<void> {
    const subject = "Reset your Runa password";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Password reset</h2>
        <p style="color: #555; line-height: 1.6;">
          We received a request to reset the password for your Runa account. Click the button below to choose a new password.
        </p>
        <a href="${params.resetUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Reset password
        </a>
        <p style="color: #999; font-size: 13px;">
          This link expires in one hour. If you did not request a reset, you can ignore this email.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${params.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Reset URL: ${params.resetUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject,
        html,
      });
      this.logger.log(`Password reset email sent to ${params.to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${params.to}`,
        err,
      );
      throw err;
    }
  }

  async sendEmailVerificationEmail(params: {
    to: string;
    verifyUrl: string;
  }): Promise<void> {
    const subject = "Verify your Runa email address";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Confirm your email</h2>
        <p style="color: #555; line-height: 1.6;">
          Thanks for signing up. Click the button below to verify this email address for your Runa account.
        </p>
        <a href="${params.verifyUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Verify email
        </a>
        <p style="color: #999; font-size: 13px;">
          This link expires in 48 hours. If you did not create an account, you can ignore this email.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${params.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Verify URL: ${params.verifyUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject,
        html,
      });
      this.logger.log(`Verification email sent to ${params.to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${params.to}`,
        err,
      );
      throw err;
    }
  }

  async sendNotificationEmail(params: {
    to: string;
    userName: string;
    type: string;
    title: string;
    message: string;
    relatedEntityId?: string;
  }): Promise<void> {
    const subject = `${params.title} — Runa`;
    const actionUrl = this.getNotificationActionUrl(
      params.type,
      params.relatedEntityId,
    );
    const actionLabel = this.getNotificationActionLabel(params.type);

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">${params.title}</h2>
        <p style="color: #555; line-height: 1.6;">Hi ${params.userName},</p>
        <p style="color: #555; line-height: 1.6;">${params.message}</p>
        ${
          actionUrl
            ? `
        <a href="${actionUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          ${actionLabel}
        </a>`
            : ""
        }
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 13px;">
          You can manage your notification preferences in your
          <a href="${this.appUrl}/settings/notifications" style="color: #6366f1;">account settings</a>.
        </p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${params.to}`);
      this.logger.log(`[DEV EMAIL] Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send notification email to ${params.to}`,
        err,
      );
      throw err;
    }
  }

  private getNotificationActionUrl(
    type: string,
    relatedEntityId?: string,
  ): string | null {
    if (!relatedEntityId) return null;
    switch (type) {
      case "agent_completed":
      case "agent_failed":
        return `${this.appUrl}/executions/${relatedEntityId}`;
      case "pipeline_stage_changed":
      case "ticket_assigned":
      case "ticket_commented":
      case "pr_created":
        return `${this.appUrl}/tickets/${relatedEntityId}`;
      default:
        return this.appUrl;
    }
  }

  private getNotificationActionLabel(type: string): string {
    switch (type) {
      case "agent_completed":
      case "agent_failed":
        return "View execution";
      case "pipeline_stage_changed":
        return "View ticket";
      case "pr_created":
        return "View pull request";
      case "ticket_assigned":
      case "ticket_commented":
        return "View ticket";
      case "team_invitation":
        return "View invitation";
      default:
        return "Open Runa";
    }
  }
}
