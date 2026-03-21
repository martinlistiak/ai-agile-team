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

  /**
   * Fire-and-forget custom event (device_id = your user id for cross-device matching with the web SDK).
   */
  record(
    deviceId: string,
    key: string,
    segmentation?: Record<string, string>,
  ): void {
    if (!this.isEnabled() || !deviceId) return;

    const appKey = this.configService.get<string>("COUNTLY_APP_KEY", "")!;
    const base = this.configService
      .get<string>("COUNTLY_SERVER_URL", "")!
      .replace(/\/$/, "");

    const events = JSON.stringify([
      {
        key,
        count: 1,
        segmentation: segmentation ?? {},
      },
    ]);

    const body = new URLSearchParams({
      app_key: appKey,
      device_id: deviceId,
      begin_session: "1",
      metrics: JSON.stringify({ _os: "server" }),
      events,
    });

    void fetch(`${base}/i`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.warn(`Countly returned ${res.status} for event ${key}`);
        }
      })
      .catch((err: Error) => {
        this.logger.warn(`Countly request failed: ${err.message}`);
      });
  }
}
