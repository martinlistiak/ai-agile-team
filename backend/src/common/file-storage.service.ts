import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

function mimeForAvatarExtension(ext: string): string | undefined {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return undefined;
  }
}

export interface FileUploadMetadata {
  spaceId: string;
  entityType: string;
  entityId: string;
  extension: string;
}

@Injectable()
export class FileStorageService {
  private readonly storagePath: string;

  constructor(private configService: ConfigService) {
    this.storagePath = this.configService.get<string>(
      "LOCAL_STORAGE_PATH",
      "/data/runa/uploads",
    );
    fs.mkdirSync(this.storagePath, { recursive: true });
  }

  /**
   * Generate a storage key following the pattern:
   * {spaceId}/{entityType}/{entityId}/{uuid}.{extension}
   */
  static generateKey(metadata: FileUploadMetadata): string {
    const fileUuid = crypto.randomUUID();
    return `${metadata.spaceId}/${metadata.entityType}/${metadata.entityId}/${fileUuid}.${metadata.extension}`;
  }

  /** Storage key for a user-uploaded profile image, or null if URL is external / not ours. */
  static parseStorageKeyFromAvatarUrl(avatarUrl: string | null): string | null {
    if (!avatarUrl) return null;
    const m = avatarUrl.match(/\/api\/files\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  private resolveFilePath(key: string): string {
    return path.join(this.storagePath, key);
  }

  async uploadUserAvatar(
    userId: string,
    file: Buffer,
    extension: string,
  ): Promise<{ key: string }> {
    const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
    const fileUuid = crypto.randomUUID();
    const key = `user-avatars/${userId}/${fileUuid}.${ext}`;

    const filePath = this.resolveFilePath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file);

    return { key };
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async upload(
    file: Buffer,
    metadata: FileUploadMetadata,
  ): Promise<{ key: string; url: string }> {
    const key = FileStorageService.generateKey(metadata);

    const filePath = this.resolveFilePath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file);

    const url = `/api/files/${key}`;
    return { key, url };
  }

  getFilePath(key: string): string | null {
    const filePath = this.resolveFilePath(key);
    return fs.existsSync(filePath) ? filePath : null;
  }

  getMimeType(key: string): string {
    const ext = path.extname(key).replace(".", "").toLowerCase();
    return mimeForAvatarExtension(ext) || "application/octet-stream";
  }
}
