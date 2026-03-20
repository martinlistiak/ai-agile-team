import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { JsonLoggerService } from "./common/structured-logger";
import { getCorsOrigins } from "./common/cors-origins";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

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

  if (isProduction) {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: getCorsOrigins(), credentials: true });

  // Serve OAuth discovery metadata at the well-known root path (outside /api prefix)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(
    "/.well-known/oauth-authorization-server",
    (_req: any, res: any) => {
      const apiUrl = (process.env.APP_URL || "http://localhost:3001") + "/api";
      res.json({
        issuer: apiUrl,
        authorization_endpoint: `${apiUrl}/oauth/authorize/login`,
        token_endpoint: `${apiUrl}/oauth/token`,
        registration_endpoint: `${apiUrl}/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["openid", "profile", "offline_access"],
      });
    },
  );

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
