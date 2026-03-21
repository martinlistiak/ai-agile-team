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
    const html = this.wrapInLayout(`
        <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; font-size: 20px;">You've been invited</h2>
        <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">
          <strong>${params.inviterName}</strong> has invited you to join
          <strong>${params.teamName}</strong> on Runa.
        </p>
        <a href="${acceptUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Accept invitation
        </a>
        <p style="color: #999; font-size: 13px; margin: 0;">
          This invitation expires in 7 days. If you didn't expect this, you can ignore it.
        </p>
    `);

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
    const html = this.wrapInLayout(`
        <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; font-size: 20px;">Password reset</h2>
        <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">
          We received a request to reset the password for your Runa account. Click the button below to choose a new password.
        </p>
        <a href="${params.resetUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Reset password
        </a>
        <p style="color: #999; font-size: 13px; margin: 0;">
          This link expires in one hour. If you did not request a reset, you can ignore this email.
        </p>
    `);

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
    const html = this.wrapInLayout(`
        <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; font-size: 20px;">Confirm your email</h2>
        <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">
          Thanks for signing up. Click the button below to verify this email address for your Runa account.
        </p>
        <a href="${params.verifyUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Verify email
        </a>
        <p style="color: #999; font-size: 13px; margin: 0;">
          This link expires in 48 hours. If you did not create an account, you can ignore this email.
        </p>
    `);

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

    const html = this.wrapInLayout(`
        <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; font-size: 20px;">${params.title}</h2>
        <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${params.userName},</p>
        <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">${params.message}</p>
        ${
          actionUrl
            ? `
        <a href="${actionUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          ${actionLabel}
        </a>`
            : ""
        }
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
        <p style="color: #999; font-size: 13px; margin: 0;">
          You can manage your notification preferences in your
          <a href="${this.appUrl}/settings/notifications" style="color: #6366f1;">account settings</a>.
        </p>
    `);

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

  /** Wraps email body content in a branded header + footer matching the homepage design. */
  private wrapInLayout(bodyHtml: string): string {
    return `
      <div style="background-color: #f8f8fa; margin: 0; padding: 0; width: 100%;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8fa;">
          <tr><td align="center" style="padding: 40px 16px;">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%;">
              <!-- Header -->
              <tr><td style="padding: 0 0 32px 0;">
                <a href="${this.appUrl}" style="text-decoration: none; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; color: #000000; letter-spacing: -0.02em;">Runa</a>
              </td></tr>
              <!-- Body card -->
              <tr><td style="background: #ffffff; border-radius: 12px; padding: 36px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                ${bodyHtml}
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding: 32px 0 0 0; border-top: none;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding-top: 24px; border-top: 1px solid #e8e8ec;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px; color: #000000; letter-spacing: -0.02em;">
                          <a href="${this.appUrl}" style="text-decoration: none; color: #000000;">Runa</a>
                        </td>
                        <td align="right" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;">
                          <a href="${this.appUrl}/privacy" style="color: #888; text-decoration: none; margin-left: 16px;">Privacy</a>
                          <a href="${this.appUrl}/terms" style="color: #888; text-decoration: none; margin-left: 16px;">Terms</a>
                          <a href="${this.appUrl}/status" style="color: #888; text-decoration: none; margin-left: 16px;">Status</a>
                          <a href="${this.appUrl}/docs" style="color: #888; text-decoration: none; margin-left: 16px;">Docs</a>
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                  <tr><td style="padding-top: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #999;">
                    &copy; ${new Date().getFullYear()} Runa. All rights reserved.
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </div>
    `;
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
