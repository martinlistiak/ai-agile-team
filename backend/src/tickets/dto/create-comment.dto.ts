import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCommentDto {
  @ApiProperty({ example: "Looks good, but needs tests" })
  @IsString()
  @IsNotEmpty()
  content: string;
}
