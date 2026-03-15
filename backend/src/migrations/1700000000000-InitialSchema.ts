import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension for uuid_generate_v4()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "hashedPassword" character varying,
        "githubId" bigint,
        "githubTokenEncrypted" text,
        "avatarUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_githubId" UNIQUE ("githubId"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // 2. spaces
    await queryRunner.query(`
      CREATE TABLE "spaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "githubRepoUrl" character varying,
        "githubTokenRef" text,
        "pipelineConfig" jsonb NOT NULL DEFAULT '{"planning":true,"development":true,"review":true,"testing":true,"staged":true}',
        "crossTeamRules" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spaces" PRIMARY KEY ("id"),
        CONSTRAINT "FK_spaces_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // 3. agents
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentType" character varying NOT NULL DEFAULT 'pm',
        "rules" text,
        "avatarRef" character varying NOT NULL DEFAULT 'pm_default.png',
        "status" character varying NOT NULL DEFAULT 'idle',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agents_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // 4. tickets
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "status" character varying NOT NULL DEFAULT 'backlog',
        "priority" character varying NOT NULL DEFAULT 'medium',
        "assigneeAgentId" uuid,
        "comments" jsonb NOT NULL DEFAULT '[]',
        "statusHistory" jsonb NOT NULL DEFAULT '[]',
        "prUrl" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_tickets_assigneeAgentId" FOREIGN KEY ("assigneeAgentId") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // 5. executions
    await queryRunner.query(`
      CREATE TABLE "executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "agentId" uuid NOT NULL,
        "ticketId" uuid,
        "startTime" TIMESTAMP NOT NULL DEFAULT now(),
        "endTime" TIMESTAMP,
        "status" character varying NOT NULL DEFAULT 'running',
        "actionLog" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_executions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_executions_agentId" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_executions_ticketId" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // 6. chat_messages
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL DEFAULT '',
        "agentType" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 7. chat_attachments
    await queryRunner.query(`
      CREATE TABLE "chat_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "fileName" text NOT NULL,
        "mimeType" text NOT NULL,
        "byteSize" integer NOT NULL,
        "data" bytea NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_attachments_messageId" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 8. rules
    await queryRunner.query(`
      CREATE TABLE "rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentId" uuid,
        "scope" character varying NOT NULL DEFAULT 'space',
        "content" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rules_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_rules_agentId" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // 9. suggested_rules
    await queryRunner.query(`
      CREATE TABLE "suggested_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentId" uuid,
        "executionId" uuid,
        "content" text NOT NULL,
        "reasoning" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "suggestedScope" character varying NOT NULL DEFAULT 'agent',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suggested_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suggested_rules_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_suggested_rules_agentId" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_suggested_rules_executionId" FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "suggested_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "executions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "spaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
