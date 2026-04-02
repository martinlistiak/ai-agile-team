import { Controller, Post, Body, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody } from "@nestjs/swagger";
import { SlackService } from "./slack.service";

class ContactFormDto {
  name: string;
  email: string;
  company?: string;
  teamSize?: string;
  message: string;
  source?: string;
}

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  constructor(private slackService: SlackService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Submit contact form (public, no auth required)" })
  @ApiBody({ type: ContactFormDto })
  async submitContactForm(@Body() body: ContactFormDto) {
    await this.slackService.notifyContactForm({
      name: body.name,
      email: body.email,
      company: body.company,
      teamSize: body.teamSize,
      message: body.message,
      source: body.source,
    });
    return { success: true };
  }
}
