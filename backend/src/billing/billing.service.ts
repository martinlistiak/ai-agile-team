import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { User, PlanTier, SubscriptionStatus } from "../entities/user.entity";

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>("STRIPE_SECRET_KEY", ""),
    );
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });

    user.stripeCustomerId = customer.id;
    await this.userRepo.save(user);
    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    plan: "team" | "enterprise",
    interval: "monthly" | "annual",
  ): Promise<{ url: string }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    const customerId = await this.getOrCreateCustomer(user);
    const priceId = this.getPriceId(plan, interval);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.getAppUrl()}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.getAppUrl()}/billing`,
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
      allow_promotion_codes: true,
    });

    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.stripeCustomerId)
      throw new BadRequestException("No billing account found");

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.getAppUrl()}/billing`,
    });

    return { url: session.url };
  }

  async getSubscriptionInfo(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    return {
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  // ── Stripe Webhook Handlers ──

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.mode !== "subscription") return;

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
    if (!customerId) return;

    const user = await this.userRepo.findOneBy({
      stripeCustomerId: customerId,
    });
    if (!user) {
      this.logger.warn(
        `Checkout completed for unknown customer: ${customerId}`,
      );
      return;
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (subscriptionId) {
      user.stripeSubscriptionId = subscriptionId;
      await this.userRepo.save(user);
    }

    this.logger.log(`Checkout completed for user ${user.id}`);
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const user = await this.findUserByCustomerId(subscription.customer);
    if (!user) return;

    user.stripeSubscriptionId = subscription.id;
    user.subscriptionStatus = this.mapStatus(subscription.status);
    user.planTier = this.extractPlanTier(subscription);

    // Get period end from the first subscription item
    const firstItem = subscription.items?.data?.[0];
    if (firstItem?.current_period_end) {
      user.currentPeriodEnd = new Date(firstItem.current_period_end * 1000);
    }

    await this.userRepo.save(user);
    this.logger.log(
      `Subscription updated for user ${user.id}: ${user.planTier} (${user.subscriptionStatus})`,
    );
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const user = await this.findUserByCustomerId(subscription.customer);
    if (!user) return;

    user.planTier = "starter";
    user.subscriptionStatus = "canceled";
    user.stripeSubscriptionId = null as any;
    user.currentPeriodEnd = null as any;

    await this.userRepo.save(user);
    this.logger.log(`Subscription canceled for user ${user.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;

    const user = await this.userRepo.findOneBy({
      stripeCustomerId: customerId,
    });
    if (!user) return;

    user.subscriptionStatus = "past_due";
    await this.userRepo.save(user);
    this.logger.warn(`Payment failed for user ${user.id}`);
  }

  // ── Helpers ──

  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
  ): Stripe.Event {
    const secret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET", "");
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  private async findUserByCustomerId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer,
  ): Promise<User | null> {
    const customerId = typeof customer === "string" ? customer : customer.id;
    const user = await this.userRepo.findOneBy({
      stripeCustomerId: customerId,
    });
    if (!user) {
      this.logger.warn(`No user found for Stripe customer: ${customerId}`);
    }
    return user;
  }

  private getPriceId(
    plan: "team" | "enterprise",
    interval: "monthly" | "annual",
  ): string {
    const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
    const priceId = this.configService.get<string>(key);
    if (!priceId)
      throw new BadRequestException(
        `Price not configured for ${plan}/${interval}`,
      );
    return priceId;
  }

  private getAppUrl(): string {
    return this.configService.get<string>("APP_URL", "http://localhost:3000");
  }

  private mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      active: "active",
      trialing: "trialing",
      past_due: "past_due",
      canceled: "canceled",
      incomplete: "incomplete",
      incomplete_expired: "canceled",
      unpaid: "past_due",
      paused: "canceled",
    };
    return map[status] || "none";
  }

  private extractPlanTier(subscription: Stripe.Subscription): PlanTier {
    const metadata = subscription.metadata;
    if (metadata?.plan === "enterprise") return "enterprise";
    if (metadata?.plan === "team") return "team";

    // Fallback: check price IDs
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const teamMonthly = this.configService.get("STRIPE_PRICE_TEAM_MONTHLY");
    const teamAnnual = this.configService.get("STRIPE_PRICE_TEAM_ANNUAL");
    const entMonthly = this.configService.get(
      "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    );
    const entAnnual = this.configService.get("STRIPE_PRICE_ENTERPRISE_ANNUAL");

    if (priceId === entMonthly || priceId === entAnnual) return "enterprise";
    if (priceId === teamMonthly || priceId === teamAnnual) return "team";

    return "team"; // default paid tier
  }
}
