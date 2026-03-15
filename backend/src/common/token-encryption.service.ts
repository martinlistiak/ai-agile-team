import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const hexKey = this.configService.get<string>("ENCRYPTION_KEY");
    if (!hexKey) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }
    this.key = Buffer.from(hexKey, "hex");
    if (this.key.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be a 32-byte (64 hex character) string",
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: base64(iv + ciphertext + authTag)
    const combined = Buffer.concat([iv, encrypted, authTag]);
    return combined.toString("base64");
  }

  decrypt(encrypted: string): string {
    const combined = Buffer.from(encrypted, "base64");

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(
      IV_LENGTH,
      combined.length - AUTH_TAG_LENGTH,
    );

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }
}
