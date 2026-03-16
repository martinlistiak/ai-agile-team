import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { JsonLoggerService } from "./common/structured-logger";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  if (!process.env.ENCRYPTION_KEY) {
    logger.error(
      "ENCRYPTION_KEY environment variable is not set. Refusing to start.",
    );
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === "production";

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    ...(isProduction ? { logger: new JsonLoggerService() } : {}),
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: "http://localhost:3000", credentials: true });

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Runa API")
    .setDescription("AI-powered agile project management API")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        description: "JWT token or API key (runa_...)",
      },
      "bearer",
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
  });

  // Enable graceful shutdown so the port is released before the process exits
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT || "3001", 10);
  await app.listen(port);
  console.log(`Runa backend running on http://localhost:${port}`);
}
bootstrap();
