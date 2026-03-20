import { MigrationInterface, QueryRunner } from "typeorm";

export class EnterpriseFeatures1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // SSO/SAML configuration
    await queryRunner.query(`
      CREATE TABLE "sso_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "provider" text NOT NULL DEFAULT 'saml',
        "entityId" text NOT NULL,
        "ssoUrl" text NOT NULL,
        "certificate" text NOT NULL,
        "metadataUrl" text,
        "defaultRole" text,
        "enforceSSO" boolean NOT NULL DEFAULT false,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    // Agent training data
    await queryRunner.query(`
      CREATE TABLE "agent_trainings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'pending',
        "documents" jsonb NOT NULL DEFAULT '[]',
        "compiledContext" text,
        "documentCount" int NOT NULL DEFAULT 0,
        "errorMessage" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    // SLA configuration
    await queryRunner.query(`
      CREATE TABLE "sla_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "uptimeTarget" decimal(5,2) NOT NULL DEFAULT 99.9,
        "responseTimeMsTarget" int NOT NULL DEFAULT 500,
        "resolutionTimeHoursTarget" int NOT NULL DEFAULT 4,
        "currentUptime" decimal(5,2) NOT NULL DEFAULT 100,
        "avgResponseTimeMs" int NOT NULL DEFAULT 0,
        "totalIncidents" int NOT NULL DEFAULT 0,
        "resolvedIncidents" int NOT NULL DEFAULT 0,
        "lastCheckedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    // Analytics events
    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "userId" uuid,
        "spaceId" uuid,
        "eventType" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_analytics_team_created" ON "analytics_events" ("teamId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_analytics_type_created" ON "analytics_events" ("eventType", "createdAt")
    `);

    // Add SSO-related columns to users
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "ssoProvider" text,
      ADD COLUMN "ssoExternalId" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ssoExternalId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ssoProvider"`);
    await queryRunner.query(`DROP TABLE "analytics_events"`);
    await queryRunner.query(`DROP TABLE "sla_configs"`);
    await queryRunner.query(`DROP TABLE "agent_trainings"`);
    await queryRunner.query(`DROP TABLE "sso_configs"`);
  }
}
