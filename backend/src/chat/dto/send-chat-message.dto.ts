import { IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendChatMessageDto {
  @ApiProperty({ example: "Break this ticket into subtasks" })
  @IsString()
  message: string;

  @ApiProperty({
    description:
      'Agent type: "pm", "developer", "tester", "reviewer", or "custom:<agentId>" for custom agents',
    example: "pm",
  })
  @IsString()
  agentType: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsString()
  @IsOptional()
  ticketId?: string;
}
