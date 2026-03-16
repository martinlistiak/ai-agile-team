import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateTeamDto {
  @ApiProperty({ example: "Engineering" })
  @IsString()
  @MinLength(1)
  name: string;
}
