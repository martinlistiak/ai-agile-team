import { Global, Module } from "@nestjs/common";
import { TokenEncryptionService } from "./token-encryption.service";
import { FileStorageService } from "./file-storage.service";
import { FilesController } from "./files.controller";

@Global()
@Module({
  controllers: [FilesController],
  providers: [TokenEncryptionService, FileStorageService],
  exports: [TokenEncryptionService, FileStorageService],
})
export class CommonModule {}
