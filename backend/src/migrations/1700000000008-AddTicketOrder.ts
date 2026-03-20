import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketOrder1700000000008 implements MigrationInterface {
  name = "AddTicketOrder1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN "order" integer NOT NULL DEFAULT 0`,
    );

    // Backfill: assign sequential order per space+status, ordered by createdAt
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY "spaceId", "status"
          ORDER BY "createdAt" ASC
        ) - 1 AS rn
        FROM tickets
      )
      UPDATE tickets SET "order" = ranked.rn FROM ranked WHERE tickets.id = ranked.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "order"`);
  }
}
