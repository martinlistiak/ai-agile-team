import * as fc from "fast-check";
import * as crypto from "crypto";
import { TokenEncryptionService } from "../token-encryption.service";
import { ConfigService } from "@nestjs/config";

/**
 * Property 10: Token encryption round-trip and ciphertext differs from plaintext
 *
 * For any non-empty string token, encrypting it with TokenEncryptionService.encrypt()
 * and then decrypting with TokenEncryptionService.decrypt() should return the original token.
 * Additionally, the encrypted output must not equal the plaintext input.
 *
 * Validates: Requirements 10.1, 10.3
 */
describe("Feature: spec-gap-implementation, Property 10: Token encryption round-trip and ciphertext differs from plaintext", () => {
  let service: TokenEncryptionService;

  beforeAll(() => {
    // Generate a valid 32-byte hex key for testing
    const testKey = crypto.randomBytes(32).toString("hex");
    const configService = {
      get: (key: string) => {
        if (key === "ENCRYPTION_KEY") return testKey;
        return undefined;
      },
    } as unknown as ConfigService;
    service = new TokenEncryptionService(configService);
  });

  it("encrypt then decrypt returns the original plaintext for any non-empty string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (plaintext) => {
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 10.1
   */
  it("encrypted output differs from plaintext input for any non-empty string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (plaintext) => {
        const encrypted = service.encrypt(plaintext);
        expect(encrypted).not.toBe(plaintext);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 10.1
   */
  it("encrypting the same plaintext twice produces different ciphertexts (random IV)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (plaintext) => {
        const encrypted1 = service.encrypt(plaintext);
        const encrypted2 = service.encrypt(plaintext);
        expect(encrypted1).not.toBe(encrypted2);
      }),
      { numRuns: 100 },
    );
  });
});
