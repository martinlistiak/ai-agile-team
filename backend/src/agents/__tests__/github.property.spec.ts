import * as fc from "fast-check";
import { GithubService } from "../github.service";

/**
 * Feature: spec-gap-implementation
 * Property 11: PR title and body contain required ticket information
 *
 * For any ticket with a non-empty title, ID, and description, the generated PR
 * title should match the format `[{ticketId}] {ticketTitle}`, and the generated
 * PR body should contain the ticket description and a URL linking back to the ticket.
 *
 * **Validates: Requirements 11.2, 11.3**
 */

describe("Feature: spec-gap-implementation, Property 11: PR title and body contain required ticket information", () => {
  const appBaseUrl = "https://runa-app.com";

  it("PR title matches format [{ticketId}] {ticketTitle}", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ maxLength: 500 }),
        }),
        (ticket) => {
          const title = GithubService.formatPrTitle(ticket.id, ticket.title);

          // Title must start with [ticketId]
          expect(title).toBe(`[${ticket.id}] ${ticket.title}`);
          expect(title.startsWith(`[${ticket.id}]`)).toBe(true);
          expect(title).toContain(ticket.title);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PR body contains ticket description and link back to ticket", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        fc.string({ minLength: 0, maxLength: 300 }), // agentSummary
        (ticket, agentSummary) => {
          const body = GithubService.formatPrBody(
            { id: ticket.id, description: ticket.description },
            agentSummary,
            appBaseUrl,
          );

          // Body must contain the ticket description
          expect(body).toContain(ticket.description);

          // Body must contain a URL linking back to the ticket
          const expectedUrl = `${appBaseUrl}/tickets/${ticket.id}`;
          expect(body).toContain(expectedUrl);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PR body contains agent summary when provided", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          description: fc.string({ maxLength: 200 }),
        }),
        fc.string({ minLength: 1, maxLength: 300 }),
        (ticket, agentSummary) => {
          const body = GithubService.formatPrBody(
            { id: ticket.id, description: ticket.description },
            agentSummary,
            appBaseUrl,
          );

          expect(body).toContain(agentSummary);
        },
      ),
      { numRuns: 100 },
    );
  });
});
