import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSpaceDto {
  @ApiProperty({ example: "My Project" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: "https://github.com/user/repo" })
  @IsString()
  @IsOptional()
  githubRepoUrl?: string;

  @ApiPropertyOptional({ example: "https://gitlab.com/user/repo" })
  @IsString()
  @IsOptional()
  gitlabRepoUrl?: string;
}
