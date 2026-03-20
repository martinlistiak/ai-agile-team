import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "hashedPassword" character varying,
        "githubId" bigint,
        "githubTokenEncrypted" text,
        "gitlabId" bigint,
        "gitlabTokenEncrypted" text,
        "avatarUrl" character varying,
        "stripeCustomerId" text,
        "stripeSubscriptionId" text,
        "planTier" text NOT NULL DEFAULT 'starter',
        "subscriptionStatus" text NOT NULL DEFAULT 'none',
        "currentPeriodEnd" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_githubId" UNIQUE ("githubId"),
        CONSTRAINT "UQ_users_gitlabId" UNIQUE ("gitlabId"),
        CONSTRAINT "UQ_users_stripeCustomerId" UNIQUE ("stripeCustomerId"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // spaces
    await queryRunner.query(`
      CREATE TABLE "spaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "githubRepoUrl" character varying,
        "gitlabRepoUrl" text,
        "githubTokenRef" text,
        "pipelineConfig" jsonb NOT NULL DEFAULT '{"planning":true,"development":true,"review":true,"testing":true,"staged":true}',
        "crossTeamRules" text,
        "order" integer NOT NULL DEFAULT 0,
        "color" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spaces" PRIMARY KEY ("id"),
        CONSTRAINT "FK_spaces_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // agents
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentType" character varying NOT NULL DEFAULT 'pm',
        "name" character varying,
        "description" text,
        "systemPrompt" text,
        "isCustom" boolean NOT NULL DEFAULT false,
        "rules" text,
        "avatarRef" character varying NOT NULL DEFAULT 'pm_default.png',
        "status" character varying NOT NULL DEFAULT 'idle',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agents_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // tickets
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "status" character varying NOT NULL DEFAULT 'backlog',
        "priority" character varying NOT NULL DEFAULT 'medium',
        "assigneeAgentId" uuid,
        "assigneeUserId" uuid,
        "comments" jsonb NOT NULL DEFAULT '[]',
        "statusHistory" jsonb NOT NULL DEFAULT '[]',
        "prUrl" text,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_tickets_assigneeAgentId" FOREIGN KEY ("assigneeAgentId") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_tickets_assigneeUserId" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // executions
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

    // chat_messages
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

    // chat_attachments
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

    // rules
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

    // suggested_rules
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

    // teams
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "ownerId" uuid NOT NULL,
        "seatCount" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      )
    `);

    // team_members
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_members_team_user" UNIQUE ("teamId", "userId"),
        CONSTRAINT "FK_team_members_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // team_invitations
    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "email" character varying NOT NULL,
        "invitedById" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "token" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_team_invitations_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_inviter" FOREIGN KEY ("invitedById") REFERENCES "users"("id")
      )
    `);

    // oauth_clients
    await queryRunner.query(`
      CREATE TABLE "oauth_clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" text NOT NULL,
        "clientSecret" text,
        "clientName" text,
        "redirectUris" text NOT NULL DEFAULT '',
        "grantTypes" text NOT NULL DEFAULT 'authorization_code,refresh_token',
        "responseTypes" text NOT NULL DEFAULT 'code',
        "tokenEndpointAuthMethod" text NOT NULL DEFAULT 'none',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_clients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_clients_clientId" UNIQUE ("clientId")
      )
    `);

    // oauth_codes
    await queryRunner.query(`
      CREATE TABLE "oauth_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" text NOT NULL,
        "clientId" text NOT NULL,
        "userId" text NOT NULL,
        "redirectUri" text NOT NULL,
        "codeChallenge" text,
        "codeChallengeMethod" text,
        "scope" text NOT NULL DEFAULT 'openid',
        "expiresAt" timestamptz NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_codes_code" UNIQUE ("code")
      )
    `);

    // oauth_tokens
    await queryRunner.query(`
      CREATE TABLE "oauth_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accessToken" text NOT NULL,
        "refreshToken" text,
        "clientId" text NOT NULL,
        "userId" text NOT NULL,
        "scope" text NOT NULL DEFAULT 'openid',
        "expiresAt" timestamptz NOT NULL,
        "refreshExpiresAt" timestamptz,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_tokens_accessToken" UNIQUE ("accessToken"),
        CONSTRAINT "UQ_oauth_tokens_refreshToken" UNIQUE ("refreshToken")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_clients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
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
