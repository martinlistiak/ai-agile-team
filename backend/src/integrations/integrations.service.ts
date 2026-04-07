import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import { User } from "../entities/user.entity";
import { ApiKey } from "../entities/api-key.entity";
import { TokenEncryptionService } from "../common/token-encryption.service";

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ApiKey) private apiKeyRepo: Repository<ApiKey>,
    private tokenEncryptionService: TokenEncryptionService,
  ) {}

  /** Disconnect GitHub: clear githubId and encrypted token */
  async disconnectGithub(userId: string) {
    await this.userRepo.update(userId, {
      githubId: null as any,
      githubTokenEncrypted: null as any,
      githubReviewerTokenEncrypted: null as any,
    });
  }

  /** Save a separate GitHub PAT for the reviewer agent */
  async saveReviewerToken(userId: string, token: string) {
    const encrypted = this.tokenEncryptionService.encrypt(token);
    await this.userRepo.update(userId, {
      githubReviewerTokenEncrypted: encrypted,
    });
  }

  /** Clear the reviewer GitHub token */
  async clearReviewerToken(userId: string) {
    await this.userRepo.update(userId, {
      githubReviewerTokenEncrypted: null as any,
    });
  }

  /** Check if a reviewer token is configured */
  async hasReviewerToken(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOneBy({ id: userId });
    return !!user?.githubReviewerTokenEncrypted;
  }

  /** Disconnect GitLab: clear gitlabId and encrypted token */
  async disconnectGitlab(userId: string) {
    await this.userRepo.update(userId, {
      gitlabId: null as any,
      gitlabTokenEncrypted: null as any,
    });
  }

  /** Create a new API key. Returns the raw key (only shown once). */
  async createApiKey(
    userId: string,
    name: string,
  ): Promise<{
    id: string;
    name: string;
    prefix: string;
    key: string;
    createdAt: Date;
  }> {
    const raw = `runa_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = raw.slice(0, 12);
    const hashedKey = crypto.createHash("sha256").update(raw).digest("hex");

    const apiKey = this.apiKeyRepo.create({
      userId,
      name,
      prefix,
      hashedKey,
    });
    const saved = await this.apiKeyRepo.save(apiKey);
    return {
      id: saved.id,
      name: saved.name,
      prefix,
      key: raw,
      createdAt: saved.createdAt,
    };
  }

  /** List all API keys for a user (without the raw key). */
  async listApiKeys(userId: string) {
    return this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      select: ["id", "name", "prefix", "lastUsedAt", "createdAt"],
    });
  }

  /** Revoke (delete) an API key. */
  async revokeApiKey(userId: string, keyId: string) {
    await this.apiKeyRepo.delete({ id: keyId, userId });
  }

  /** Validate an API key from a request. Returns the user or null. */
  async validateApiKey(rawKey: string): Promise<User | null> {
    const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
    const apiKey = await this.apiKeyRepo.findOne({
      where: { hashedKey },
      relations: ["user"],
    });
    if (!apiKey) return null;

    // Update last used timestamp
    await this.apiKeyRepo.update(apiKey.id, { lastUsedAt: new Date() as any });
    return apiKey.user;
  }
}
