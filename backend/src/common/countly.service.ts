import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CountlyService {
  private readonly logger = new Logger(CountlyService.name);

  constructor(private readonly configService: ConfigService) {}

  private isEnabled(): boolean {
    const key = this.configService.get<string>("COUNTLY_APP_KEY", "");
    const url = this.configService.get<string>("COUNTLY_SERVER_URL", "");
    return Boolean(key?.trim() && url?.trim());
  }

  private getConfig() {
    return {
      appKey: this.configService.get<string>("COUNTLY_APP_KEY", "")!,
      base: this.configService
        .get<string>("COUNTLY_SERVER_URL", "")!
        .replace(/\/$/, ""),
    };
  }

  private post(params: URLSearchParams): void {
    const { base } = this.getConfig();
    void fetch(`${base}/i`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.warn(`Countly returned ${res.status}`);
        }
      })
      .catch((err: Error) => {
        this.logger.warn(`Countly request failed: ${err.message}`);
      });
  }

  /**
   * Start a Countly session for the given user.
   * Call on login / OAuth callback so the Audience panel registers sessions.
   */
  beginSession(deviceId: string, metrics?: Record<string, string>): void {
    if (!this.isEnabled() || !deviceId) return;
    const { appKey } = this.getConfig();

    this.post(
      new URLSearchParams({
        app_key: appKey,
        device_id: deviceId,
        begin_session: "1",
        metrics: JSON.stringify({ _os: "web", ...metrics }),
      }),
    );
  }

  /**
   * End a Countly session for the given user.
   * Call on logout / account deletion.
   */
  endSession(deviceId: string, sessionDurationSec = 0): void {
    if (!this.isEnabled() || !deviceId) return;
    const { appKey } = this.getConfig();

    this.post(
      new URLSearchParams({
        app_key: appKey,
        device_id: deviceId,
        end_session: "1",
        session_duration: String(sessionDurationSec),
      }),
    );
  }

  /**
   * Fire-and-forget custom event.
   * device_id = user id for cross-device matching with the web SDK.
   */
  record(
    deviceId: string,
    key: string,
    segmentation?: Record<string, string>,
  ): void {
    if (!this.isEnabled() || !deviceId) return;
    const { appKey } = this.getConfig();

    const events = JSON.stringify([
      {
        key,
        count: 1,
        segmentation: segmentation ?? {},
      },
    ]);

    this.post(
      new URLSearchParams({
        app_key: appKey,
        device_id: deviceId,
        events,
      }),
    );
  }
}
