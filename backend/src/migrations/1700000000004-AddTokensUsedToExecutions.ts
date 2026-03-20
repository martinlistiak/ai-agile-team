import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokensUsedToExecutions1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "tokensUsed" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "tokensUsed"`,
    );
  }
}
