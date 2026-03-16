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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { Request } from "express";
import { BillingService } from "./billing.service";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private billingService: BillingService) {}

  @Post("checkout")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a Stripe checkout session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        plan: { type: "string", enum: ["team", "enterprise"] },
        interval: { type: "string", enum: ["monthly", "annual"] },
      },
      required: ["plan", "interval"],
    },
  })
  @ApiResponse({ status: 201, description: "Checkout session URL" })
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
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a Stripe billing portal session" })
  @ApiResponse({ status: 201, description: "Portal session URL" })
  async createPortal(@Req() req: Request) {
    return this.billingService.createPortalSession((req.user as any).id);
  }

  @Get("subscription")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get current subscription info" })
  @ApiResponse({ status: 200, description: "Subscription details" })
  async getSubscription(@Req() req: Request) {
    return this.billingService.getSubscriptionInfo((req.user as any).id);
  }

  @Post("webhook")
  @HttpCode(200)
  @ApiExcludeEndpoint()
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
