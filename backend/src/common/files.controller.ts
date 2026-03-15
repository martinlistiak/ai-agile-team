import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import "multer";
import { FileStorageService } from "./file-storage.service";

@Controller("files")
export class FilesController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("spaceId") spaceId: string,
    @Body("entityType") entityType: string,
    @Body("entityId") entityId: string,
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    if (!spaceId || !entityType || !entityId) {
      throw new BadRequestException(
        "spaceId, entityType, and entityId are required",
      );
    }

    const extension =
      file.originalname.split(".").pop()?.toLowerCase() || "bin";

    const result = await this.fileStorageService.upload(file.buffer, {
      spaceId,
      entityType,
      entityId,
      extension,
    });

    return { key: result.key, url: result.url };
  }

  @Get("*path")
  async getFile(@Param("path") path: string[], @Res() res: Response) {
    const key = path.join("/");
    const url = await this.fileStorageService.getSignedUrl(key);
    res.redirect(url);
  }
}
