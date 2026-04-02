import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenTrackingColumns1711843200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "inputTokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "outputTokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "cacheReadTokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "cacheCreationTokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "modelUsed" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "inputTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "outputTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "cacheReadTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "cacheCreationTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "modelUsed"`,
    );
  }
}
