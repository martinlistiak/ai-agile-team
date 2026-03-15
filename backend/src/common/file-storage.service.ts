import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";

export interface FileUploadMetadata {
  spaceId: string;
  entityType: string;
  entityId: string;
  extension: string;
}

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>("S3_BUCKET", "runa-uploads");
    this.s3 = new S3Client({
      endpoint: this.configService.get<string>(
        "S3_ENDPOINT",
        "http://localhost:9000",
      ),
      region: this.configService.get<string>("AWS_REGION", "us-east-1"),
      credentials: {
        accessKeyId: this.configService.get<string>(
          "AWS_ACCESS_KEY_ID",
          "minioadmin",
        ),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          "minioadmin",
        ),
      },
      forcePathStyle: true,
    });
  }

  /**
   * Generate a storage key following the pattern:
   * {spaceId}/{entityType}/{entityId}/{uuid}.{extension}
   */
  static generateKey(metadata: FileUploadMetadata): string {
    const fileUuid = crypto.randomUUID();
    return `${metadata.spaceId}/${metadata.entityType}/${metadata.entityId}/${fileUuid}.${metadata.extension}`;
  }

  async upload(
    file: Buffer,
    metadata: FileUploadMetadata,
  ): Promise<{ key: string; url: string }> {
    const key = FileStorageService.generateKey(metadata);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
      }),
    );

    const url = await this.getSignedUrl(key);
    return { key, url };
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}
