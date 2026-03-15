import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGitlab1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // User: GitLab identity + token (parallel to GitHub fields)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "gitlabId" bigint UNIQUE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "gitlabTokenEncrypted" text`,
    );

    // Space: optional GitLab repo URL (a space can have either or both)
    await queryRunner.query(
      `ALTER TABLE "spaces" ADD COLUMN "gitlabRepoUrl" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces" DROP COLUMN "gitlabRepoUrl"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "gitlabTokenEncrypted"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gitlabId"`);
  }
}
