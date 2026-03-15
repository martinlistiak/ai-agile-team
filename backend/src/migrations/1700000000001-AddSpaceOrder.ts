import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpaceOrder1700000000001 implements MigrationInterface {
  name = "AddSpaceOrder1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD COLUMN "order" integer NOT NULL DEFAULT 0`,
    );

    // Backfill existing rows so each user's spaces get sequential order
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC) - 1 AS rn
        FROM spaces
      )
      UPDATE spaces SET "order" = ranked.rn FROM ranked WHERE spaces.id = ranked.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "order"`);
  }
}
