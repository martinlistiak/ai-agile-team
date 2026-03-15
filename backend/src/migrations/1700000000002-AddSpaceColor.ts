import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpaceColor1700000000002 implements MigrationInterface {
  name = "AddSpaceColor1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces" ADD COLUMN "color" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "color"`);
  }
}
