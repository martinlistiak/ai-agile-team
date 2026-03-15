import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  HttpCode,
  UseGuards,
  RawBodyRequest,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private billingService: BillingService) {}

  @Post("checkout")
  @UseGuards(AuthGuard("jwt"))
  async createCheckout(
    @Req() req: Request,
    @Body()
    body: { plan: "team" | "enterprise"; interval: "monthly" | "annual" },
  ) {
    return this.billingService.createCheckoutSession(
      (req.user as any).id,
      body.plan,
      body.interval,
    );
  }

  @Post("portal")
  @UseGuards(AuthGuard("jwt"))
  async createPortal(@Req() req: Request) {
    return this.billingService.createPortalSession((req.user as any).id);
  }

  @Get("subscription")
  @UseGuards(AuthGuard("jwt"))
  async getSubscription(@Req() req: Request) {
    return this.billingService.getSubscriptionInfo((req.user as any).id);
  }

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException("Missing raw body");
    }

    let event;
    try {
      event = this.billingService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException("Invalid webhook signature");
    }

    await this.billingService.handleWebhookEvent(event);
    return { received: true };
  }
}
