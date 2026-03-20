import { MigrationInterface, QueryRunner } from "typeorm";

export class EmailVerification1700000000002 implements MigrationInterface {
  name = "EmailVerification1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "emailVerifiedAt" = "createdAt"
      WHERE "emailVerifiedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_verification_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_email_verification_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_tokens_userId" ON "email_verification_tokens" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt"`,
    );
  }
}
