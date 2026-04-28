import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketRequestedChanges1712200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requestedChanges" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requestedChangesFeedback" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requestedChangesSource" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "requestedChangesSource"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "requestedChangesFeedback"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "requestedChanges"`,
    );
  }
}
