import * as fc from "fast-check";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

/**
 * A minimal controller for testing throttle behavior.
 */
@Controller("test-throttle")
class TestThrottleController {
  @Get()
  handle() {
    return { ok: true };
  }
}

/**
 * Property 15: Rate limiting enforces request threshold
 *
 * For any API endpoint with a configured rate limit of N requests per time
 * window, the (N+1)th request within the window should receive HTTP 429
 * with a Retry-After header.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */
describe("Property 15: Rate limiting enforces request threshold", () => {
  it("should allow requests within the limit and reject those exceeding it", async () => {
    const limit = 5;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: limit + 1, max: limit + 10 }),
        async (totalRequests) => {
          const moduleRef = await Test.createTestingModule({
            imports: [
              ThrottlerModule.forRoot({
                throttlers: [{ ttl: 60000, limit }],
              }),
            ],
            controllers: [TestThrottleController],
            providers: [
              {
                provide: APP_GUARD,
                useClass: ThrottlerGuard,
              },
            ],
          }).compile();

          const testApp = moduleRef.createNestApplication();
          await testApp.init();

          const server = testApp.getHttpServer();

          let lastStatus = 0;
          let gotRetryAfter = false;

          for (let i = 0; i < totalRequests; i++) {
            const res = await request(server).get("/test-throttle");
            lastStatus = res.status;
            if (res.status === 429) {
              gotRetryAfter = res.headers["retry-after"] !== undefined;
              break;
            }
          }

          expect(lastStatus).toBe(429);
          expect(gotRetryAfter).toBe(true);

          await testApp.close();
        },
      ),
      { numRuns: 10 },
    );
  });

  it("requests within the limit should all succeed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (requestCount) => {
        const limit = 5;
        const moduleRef = await Test.createTestingModule({
          imports: [
            ThrottlerModule.forRoot({
              throttlers: [{ ttl: 60000, limit }],
            }),
          ],
          controllers: [TestThrottleController],
          providers: [
            {
              provide: APP_GUARD,
              useClass: ThrottlerGuard,
            },
          ],
        }).compile();

        const testApp = moduleRef.createNestApplication();
        await testApp.init();

        const server = testApp.getHttpServer();

        for (let i = 0; i < requestCount; i++) {
          const res = await request(server).get("/test-throttle");
          expect(res.status).toBe(200);
        }

        await testApp.close();
      }),
      { numRuns: 10 },
    );
  });
});
