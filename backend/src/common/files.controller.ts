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
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import "multer";
import { FileStorageService } from "./file-storage.service";

@ApiTags("Files")
@Controller("files")
export class FilesController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        spaceId: { type: "string", format: "uuid" },
        entityType: { type: "string" },
        entityId: { type: "string" },
      },
      required: ["file", "spaceId", "entityType", "entityId"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded, returns key and URL",
  })
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
  @ApiOperation({ summary: "Get a file by storage path" })
  @ApiResponse({ status: 200, description: "File content" })
  @ApiResponse({ status: 404, description: "File not found" })
  async getFile(@Param("path") path: string[], @Res() res: Response) {
    const key = path.join("/");
    const filePath = this.fileStorageService.getFilePath(key);

    if (!filePath) {
      throw new NotFoundException("File not found");
    }

    const mimeType = this.fileStorageService.getMimeType(key);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath);
  }
}
