import * as fc from "fast-check";
import {
  FileStorageService,
  FileUploadMetadata,
} from "../file-storage.service";

/**
 * Property 16: File storage key follows naming pattern
 *
 * For any combination of spaceId, entityType, entityId, and file extension,
 * the generated storage key should match the pattern
 * {spaceId}/{entityType}/{entityId}/{uuid}.{extension}
 * where uuid is a valid UUID v4.
 *
 * Validates: Requirements 15.2
 */
describe("Feature: spec-gap-implementation, Property 16: File storage key follows naming pattern", () => {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  const entityTypeArb = fc.constantFrom(
    "ticket",
    "comment",
    "agent",
    "space",
    "execution",
  );

  const extensionArb = fc.constantFrom(
    "png",
    "jpg",
    "jpeg",
    "gif",
    "pdf",
    "txt",
    "md",
    "json",
  );

  it("generated key matches {spaceId}/{entityType}/{entityId}/{uuid}.{extension} pattern", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        entityTypeArb,
        fc.uuid(),
        extensionArb,
        (spaceId, entityType, entityId, extension) => {
          const metadata: FileUploadMetadata = {
            spaceId,
            entityType,
            entityId,
            extension,
          };

          const key = FileStorageService.generateKey(metadata);
          const parts = key.split("/");

          // Key should have exactly 4 segments
          expect(parts).toHaveLength(4);

          // First three segments match metadata
          expect(parts[0]).toBe(spaceId);
          expect(parts[1]).toBe(entityType);
          expect(parts[2]).toBe(entityId);

          // Last segment is {uuid}.{extension}
          const filePart = parts[3];
          const dotIndex = filePart.lastIndexOf(".");
          expect(dotIndex).toBeGreaterThan(0);

          const fileUuid = filePart.substring(0, dotIndex);
          const fileExt = filePart.substring(dotIndex + 1);

          expect(fileUuid).toMatch(UUID_V4_REGEX);
          expect(fileExt).toBe(extension);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 15.2
   */
  it("each call generates a unique key (different UUID) for the same metadata", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        entityTypeArb,
        fc.uuid(),
        extensionArb,
        (spaceId, entityType, entityId, extension) => {
          const metadata: FileUploadMetadata = {
            spaceId,
            entityType,
            entityId,
            extension,
          };

          const key1 = FileStorageService.generateKey(metadata);
          const key2 = FileStorageService.generateKey(metadata);

          expect(key1).not.toBe(key2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
