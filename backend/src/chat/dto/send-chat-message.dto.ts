import { IsString, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendChatMessageDto {
  @ApiProperty({ example: "Break this ticket into subtasks" })
  @IsString()
  message: string;

  @ApiProperty({
    enum: ["pm", "developer", "tester", "reviewer"],
    example: "pm",
  })
  @IsEnum(["pm", "developer", "tester", "reviewer"])
  agentType: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsString()
  @IsOptional()
  ticketId?: string;
}
