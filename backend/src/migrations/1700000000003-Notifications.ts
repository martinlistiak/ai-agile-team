import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" text NOT NULL,
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "relatedEntityId" text,
        "relatedEntityType" text,
        "spaceId" text,
        "read" boolean NOT NULL DEFAULT false,
        "emailSent" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_userId_read" ON "notifications" ("userId", "read")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_userId_createdAt" ON "notifications" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "inAppAgentCompleted" boolean NOT NULL DEFAULT true,
        "inAppAgentFailed" boolean NOT NULL DEFAULT true,
        "inAppPipelineStageChanged" boolean NOT NULL DEFAULT true,
        "inAppPrCreated" boolean NOT NULL DEFAULT true,
        "inAppTicketAssigned" boolean NOT NULL DEFAULT true,
        "inAppTicketCommented" boolean NOT NULL DEFAULT true,
        "inAppTeamInvitation" boolean NOT NULL DEFAULT true,
        "inAppTeamMemberJoined" boolean NOT NULL DEFAULT true,
        "emailAgentCompleted" boolean NOT NULL DEFAULT true,
        "emailAgentFailed" boolean NOT NULL DEFAULT true,
        "emailPipelineStageChanged" boolean NOT NULL DEFAULT true,
        "emailPrCreated" boolean NOT NULL DEFAULT true,
        "emailTicketAssigned" boolean NOT NULL DEFAULT false,
        "emailTicketCommented" boolean NOT NULL DEFAULT false,
        "emailTeamInvitation" boolean NOT NULL DEFAULT true,
        "emailTeamMemberJoined" boolean NOT NULL DEFAULT false,
        "emailDigestFrequency" text NOT NULL DEFAULT 'instant',
        "muteAll" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId_read"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
