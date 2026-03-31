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
        plan: {
          type: "string",
          enum: ["starter", "team", "enterprise"],
        },
        interval: { type: "string", enum: ["monthly", "annual"] },
      },
      required: ["plan", "interval"],
    },
  })
  @ApiResponse({ status: 201, description: "Checkout session URL" })
  async createCheckout(
    @Req() req: Request,
    @Body()
    body: {
      plan: "starter" | "team" | "enterprise";
      interval: "monthly" | "annual";
    },
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

  @Post("verify-session")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Verify a completed checkout session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
  })
  @ApiResponse({ status: 200, description: "Session verification result" })
  async verifySession(
    @Req() req: Request,
    @Body() body: { sessionId: string },
  ) {
    return this.billingService.verifyCheckoutSession(
      (req.user as any).id,
      body.sessionId,
    );
  }

  @Post("add-space")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Create a billing portal session to add a space to subscription",
  })
  @ApiResponse({
    status: 201,
    description: "Portal session URL for subscription update",
  })
  async createAddSpaceSession(@Req() req: Request) {
    return this.billingService.createAddSpaceCheckoutSession(
      (req.user as any).id,
    );
  }

  @Get("subscription")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get current subscription info" })
  @ApiResponse({ status: 200, description: "Subscription details" })
  async getSubscription(@Req() req: Request) {
    return this.billingService.getSubscriptionInfo((req.user as any).id);
  }

  @Get("usage")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get usage stats for the current billing period" })
  @ApiResponse({ status: 200, description: "Usage statistics" })
  async getUsage(@Req() req: Request) {
    return this.billingService.getUsageStats((req.user as any).id);
  }

  @Get("invoices")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List past invoices for the billing customer" })
  @ApiResponse({
    status: 200,
    description: "Invoice list with PDF URLs when available",
  })
  async listInvoices(@Req() req: Request) {
    return this.billingService.listInvoices((req.user as any).id);
  }

  @Post("top-up")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Create a Stripe checkout session for credit top-up",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Dollar amount in $5 increments (min $5)",
          example: 10,
        },
      },
      required: ["amount"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Checkout session URL for one-time payment",
  })
  async createTopUp(@Req() req: Request, @Body() body: { amount: number }) {
    return this.billingService.createTopUpSession(
      (req.user as any).id,
      body.amount,
    );
  }

  @Post("verify-topup")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Verify a completed top-up checkout session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
  })
  @ApiResponse({ status: 200, description: "Top-up verification result" })
  async verifyTopUp(@Req() req: Request, @Body() body: { sessionId: string }) {
    return this.billingService.verifyTopUpSession(
      (req.user as any).id,
      body.sessionId,
    );
  }

  @Get("credits")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get current credits balance" })
  @ApiResponse({ status: 200, description: "Credits balance in cents" })
  async getCredits(@Req() req: Request) {
    return this.billingService.getCreditsBalance((req.user as any).id);
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
