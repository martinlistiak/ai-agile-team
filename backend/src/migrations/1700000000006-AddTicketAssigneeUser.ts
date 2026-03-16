import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketAssigneeUser1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN "assigneeUserId" uuid,
      ADD CONSTRAINT "FK_tickets_assigneeUserId"
        FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tickets"
      DROP CONSTRAINT IF EXISTS "FK_tickets_assigneeUserId",
      DROP COLUMN IF EXISTS "assigneeUserId"
    `);
  }
}
