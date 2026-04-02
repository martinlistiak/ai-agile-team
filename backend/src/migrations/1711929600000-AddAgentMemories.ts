import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentMemories1711929600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_memories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "executionId" uuid,
        "pattern" text NOT NULL,
        "lesson" text NOT NULL,
        "outcome" varchar NOT NULL DEFAULT 'success',
        "confidence" float NOT NULL DEFAULT 0.5,
        "accessCount" integer NOT NULL DEFAULT 1,
        "reinforceCount" integer NOT NULL DEFAULT 1,
        "lastAccessed" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastReinforced" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_agent_memories_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agent_memories_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_memories_space_agent" ON "agent_memories" ("spaceId", "agentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_memories"`);
  }
}
