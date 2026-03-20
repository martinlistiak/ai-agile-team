import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomAgents1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN "name" character varying,
      ADD COLUMN "description" text,
      ADD COLUMN "systemPrompt" text,
      ADD COLUMN "isCustom" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      DROP COLUMN IF EXISTS "name",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "systemPrompt",
      DROP COLUMN IF EXISTS "isCustom"
    `);
  }
}
