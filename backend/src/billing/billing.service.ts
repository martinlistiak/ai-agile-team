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
import { Space } from "../entities/space.entity";
import { Execution } from "../entities/execution.entity";
import { CountlyService } from "../common/countly.service";

const TRIAL_PERIOD_DAYS = 7;

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    private configService: ConfigService,
    private countly: CountlyService,
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
    plan: "starter" | "team" | "enterprise",
    interval: "monthly" | "annual",
  ): Promise<{ url: string }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    const customerId = await this.getOrCreateCustomer(user);
    const priceId = this.getPriceId(plan, interval);

    // Set initial quantity to the user's current space count
    const spaceCount = await this.spaceRepo.count({
      where: { userId },
    });
    const quantity = Math.max(spaceCount, 1);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity }],
      success_url: `${this.getAppUrl()}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.getAppUrl()}/billing`,
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "credit_topup") {
          await this.handleTopUpCompleted(session);
        } else {
          await this.handleCheckoutCompleted(session);
        }
        break;
      }
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

    let plan = "unknown";
    if (subscriptionId) {
      try {
        const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
        plan = sub.metadata?.plan ?? "unknown";
      } catch {
        this.logger.warn(
          `Could not retrieve subscription ${subscriptionId} for analytics`,
        );
      }
    }
    this.countly.record(user.id, "subscription_checkout_completed", { plan });

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
    plan: "starter" | "team" | "enterprise",
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
    return this.configService.get<string>("APP_URL", "https://runa-app.com");
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

  async updateSubscriptionQuantity(
    userId: string,
    spaceCount: number,
  ): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.stripeSubscriptionId) {
      this.logger.warn(
        `No Stripe subscription found for user ${userId}, skipping quantity update`,
      );
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );
    const itemId = subscription.items?.data?.[0]?.id;
    if (!itemId) {
      this.logger.warn(
        `No subscription item found for subscription ${user.stripeSubscriptionId}`,
      );
      return;
    }

    await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: itemId, quantity: spaceCount }],
      proration_behavior: "always_invoice",
    });

    this.logger.log(
      `Updated subscription ${user.stripeSubscriptionId} to ${spaceCount} spaces`,
    );
  }

  private extractPlanTier(subscription: Stripe.Subscription): PlanTier {
    const metadata = subscription.metadata;
    if (metadata?.plan === "enterprise") return "enterprise";
    if (metadata?.plan === "team") return "team";
    if (metadata?.plan === "starter") return "starter";

    // Fallback: check price IDs
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const starterMonthly = this.configService.get(
      "STRIPE_PRICE_STARTER_MONTHLY",
    );
    const starterAnnual = this.configService.get("STRIPE_PRICE_STARTER_ANNUAL");
    const teamMonthly = this.configService.get("STRIPE_PRICE_TEAM_MONTHLY");
    const teamAnnual = this.configService.get("STRIPE_PRICE_TEAM_ANNUAL");
    const entMonthly = this.configService.get(
      "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    );
    const entAnnual = this.configService.get("STRIPE_PRICE_ENTERPRISE_ANNUAL");

    if (priceId === entMonthly || priceId === entAnnual) return "enterprise";
    if (priceId === teamMonthly || priceId === teamAnnual) return "team";
    if (priceId === starterMonthly || priceId === starterAnnual)
      return "starter";

    return "starter";
  }

  // ── Credit Top-Up ──

  async createTopUpSession(
    userId: string,
    amountDollars: number,
  ): Promise<{ url: string }> {
    if (
      !Number.isInteger(amountDollars) ||
      amountDollars < 5 ||
      amountDollars % 5 !== 0
    ) {
      throw new BadRequestException(
        "Amount must be a multiple of $5 (minimum $5)",
      );
    }

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    const customerId = await this.getOrCreateCustomer(user);
    const amountCents = amountDollars * 100;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Usage credits top-up — $${amountDollars}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        type: "credit_topup",
        amountCents: String(amountCents),
      },
      success_url: `${this.getAppUrl()}/billing?topup=success`,
      cancel_url: `${this.getAppUrl()}/billing`,
    });

    return { url: session.url! };
  }

  private async handleTopUpCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.metadata?.type !== "credit_topup") return;

    const userId = session.metadata.userId;
    const amountCents = parseInt(session.metadata.amountCents, 10);
    if (!userId || isNaN(amountCents)) {
      this.logger.warn("Top-up session missing metadata");
      return;
    }

    await this.userRepo.increment(
      { id: userId },
      "creditsBalance",
      amountCents,
    );
    this.logger.log(`Credited ${amountCents} cents to user ${userId}`);
    this.countly.record(userId, "credits_topup_completed", {
      amountCents: String(amountCents),
    });
  }

  async getCreditsBalance(userId: string): Promise<{ creditsBalance: number }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    return { creditsBalance: user.creditsBalance };
  }

  /**
   * Removes the Stripe customer and cancels subscriptions. Non-fatal on Stripe errors
   * so local account data can still be deleted (e.g. GDPR).
   */
  async deleteStripeCustomerIfPresent(
    stripeCustomerId: string | null | undefined,
  ): Promise<void> {
    if (!stripeCustomerId) return;
    try {
      await this.stripe.customers.del(stripeCustomerId);
      this.logger.log(`Deleted Stripe customer ${stripeCustomerId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to delete Stripe customer ${stripeCustomerId}; continuing with local account removal`,
        err,
      );
    }
  }

  async getUsageStats(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (user.currentPeriodEnd) {
      periodEnd = new Date(user.currentPeriodEnd);
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 30);
    } else {
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      periodEnd = now;
    }

    const stats = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "agent")
      .innerJoin("agent.space", "space")
      .where("space.userId = :userId", { userId })
      .andWhere("e.startTime >= :periodStart", { periodStart })
      .andWhere("e.startTime <= :periodEnd", { periodEnd })
      .select([
        'COUNT(*)::int AS "totalRuns"',
        "COUNT(*) FILTER (WHERE e.status = 'completed')::int AS \"completedRuns\"",
        "COUNT(*) FILTER (WHERE e.status = 'failed')::int AS \"failedRuns\"",
        'COALESCE(SUM(e."tokensUsed"), 0)::int AS "totalTokens"',
      ])
      .getRawOne();

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalRuns: stats?.totalRuns ?? 0,
      completedRuns: stats?.completedRuns ?? 0,
      failedRuns: stats?.failedRuns ?? 0,
      totalTokens: stats?.totalTokens ?? 0,
    };
  }

  async listInvoices(userId: string): Promise<{
    invoices: Array<{
      id: string;
      number: string | null;
      status: string | null;
      amountPaid: number;
      currency: string;
      created: string;
      pdfUrl: string | null;
    }>;
  }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (!user.stripeCustomerId) return { invoices: [] };

    const { data } = await this.stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 24,
    });

    return {
      invoices: data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: new Date(inv.created * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf ?? null,
      })),
    };
  }
}
