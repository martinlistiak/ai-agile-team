import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class MoveTicketDto {
  @ApiProperty({
    enum: ["backlog", "development", "review", "testing", "staged", "done"],
    example: "development",
  })
  @IsEnum(["backlog", "development", "review", "testing", "staged", "done"])
  status: string;
}
