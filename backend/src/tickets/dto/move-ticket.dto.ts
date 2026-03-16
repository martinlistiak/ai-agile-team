import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class MoveTicketDto {
  @ApiProperty({
    enum: [
      "backlog",
      "planning",
      "development",
      "review",
      "testing",
      "staged",
      "done",
    ],
    example: "development",
  })
  @IsEnum([
    "backlog",
    "planning",
    "development",
    "review",
    "testing",
    "staged",
    "done",
  ])
  status: string;
}
