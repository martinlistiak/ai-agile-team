import { IsEnum } from "class-validator";

export class MoveTicketDto {
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
