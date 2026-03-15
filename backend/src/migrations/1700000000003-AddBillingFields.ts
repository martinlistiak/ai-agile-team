import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillingFields1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripeCustomerId" text UNIQUE,
      ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text,
      ADD COLUMN IF NOT EXISTS "planTier" text NOT NULL DEFAULT 'starter',
      ADD COLUMN IF NOT EXISTS "subscriptionStatus" text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "currentPeriodEnd" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "currentPeriodEnd",
      DROP COLUMN IF EXISTS "subscriptionStatus",
      DROP COLUMN IF EXISTS "planTier",
      DROP COLUMN IF EXISTS "stripeSubscriptionId",
      DROP COLUMN IF EXISTS "stripeCustomerId"
    `);
  }
}
