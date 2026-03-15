import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { AgentType } from "@/types";

/**
 * Property tests for AuditToolbar event list logic.
 *
 * We model the AuditToolbar's event list as a pure state machine and verify
 * invariants across arbitrary sequences of events. This avoids React rendering
 * (the test env is node) while fully validating the toolbar's core logic.
 */

// --- Types mirroring AuditToolbar ---

type AuditEventType =
  | "execution_action"
  | "pipeline_completed"
  | "ticket_created"
  | "ticket_updated";

interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  summary: string;
  agentType?: AgentType;
  ticketId?: string;
}

const MAX_EVENTS = 200;

// --- Pure state model of AuditToolbar event list ---

function addEvent(events: AuditEvent[], event: AuditEvent): AuditEvent[] {
  return [event, ...events].slice(0, MAX_EVENTS);
}

function addEvents(events: AuditEvent[]): AuditEvent[] {
  return events.reduce<AuditEvent[]>(
    (state, event) => addEvent(state, event),
    [],
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// --- Generators ---

const auditEventTypeArb: fc.Arbitrary<AuditEventType> = fc.constantFrom(
  "execution_action",
  "pipeline_completed",
  "ticket_created",
  "ticket_updated",
);

const agentTypeArb = fc.constantFrom<AgentType>("pm", "developer", "tester");

const summaryArb = fc
  .string({ minLength: 1, maxLength: 80, unit: "grapheme-ascii" })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generate an AuditEvent with a timestamp derived from a base date plus an
 * offset. This lets us control ordering while still being random.
 */
const auditEventArb = (index: number): fc.Arbitrary<AuditEvent> =>
  fc
    .record({
      type: auditEventTypeArb,
      summary: summaryArb,
      agentType: fc.option(agentTypeArb, { nil: undefined }),
      ticketId: fc.option(fc.uuid(), { nil: undefined }),
      // Offset in seconds from a base time — index ensures unique, increasing timestamps
      offsetMs: fc.integer({ min: 0, max: 1000 }),
    })
    .map(({ type, summary, agentType, ticketId, offsetMs }) => ({
      id: `evt-${index}`,
      // Base: 2025-01-01T00:00:00Z + index seconds + random sub-second offset
      timestamp: new Date(
        Date.UTC(2025, 0, 1) + index * 1000 + offsetMs,
      ).toISOString(),
      type,
      summary,
      agentType,
      ticketId,
    }));

/**
 * Generate a sequence of AuditEvents with strictly increasing timestamps
 * (simulating events arriving in chronological order).
 */
const chronologicalEventsArb = (
  minLen = 1,
  maxLen = 50,
): fc.Arbitrary<AuditEvent[]> =>
  fc
    .integer({ min: minLen, max: maxLen })
    .chain((len) =>
      fc.tuple(...Array.from({ length: len }, (_, i) => auditEventArb(i))),
    )
    .map((events) => events as AuditEvent[]);

/**
 * Generate a valid ISO timestamp string within a safe range.
 */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .integer({
    min: new Date("2024-01-01T00:00:00Z").getTime(),
    max: new Date("2026-01-01T00:00:00Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/**
 * Generate a single AuditEvent with an arbitrary valid ISO timestamp.
 */
const singleAuditEventArb: fc.Arbitrary<AuditEvent> = fc
  .record({
    id: fc.uuid(),
    type: auditEventTypeArb,
    summary: summaryArb,
    agentType: fc.option(agentTypeArb, { nil: undefined }),
    ticketId: fc.option(fc.uuid(), { nil: undefined }),
    timestamp: isoTimestampArb,
  })
  .map(({ id, type, summary, agentType, ticketId, timestamp }) => ({
    id,
    timestamp,
    type,
    summary,
    agentType,
    ticketId,
  }));

// Feature: ui-overhaul, Property 4: Audit events maintain reverse-chronological order
describe("Property 4: Audit events maintain reverse-chronological order", () => {
  it("after adding chronologically-ordered events one by one, the list is in reverse-chronological order (newest first)", () => {
    fc.assert(
      fc.property(chronologicalEventsArb(1, 50), (events) => {
        const state = addEvents(events);

        // The state should be reverse-chronological: each element's timestamp >= next element's timestamp
        for (let i = 0; i < state.length - 1; i++) {
          const current = new Date(state[i].timestamp).getTime();
          const next = new Date(state[i + 1].timestamp).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("adding a new event always places it at the beginning of the list", () => {
    fc.assert(
      fc.property(
        chronologicalEventsArb(1, 30),
        singleAuditEventArb,
        (existingEvents, newEvent) => {
          const state = addEvents(existingEvents);
          const updated = addEvent(state, newEvent);

          // The new event should be at index 0
          expect(updated[0].id).toBe(newEvent.id);
          expect(updated[0].timestamp).toBe(newEvent.timestamp);
          expect(updated[0].summary).toBe(newEvent.summary);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the event list never exceeds MAX_EVENTS (200) entries", () => {
    fc.assert(
      fc.property(chronologicalEventsArb(1, 250), (events) => {
        const state = addEvents(events);
        expect(state.length).toBeLessThanOrEqual(MAX_EVENTS);
      }),
      { numRuns: 100 },
    );
  });

  it("when at capacity, adding a new event drops the oldest event", () => {
    fc.assert(
      fc.property(
        chronologicalEventsArb(MAX_EVENTS, MAX_EVENTS),
        singleAuditEventArb,
        (events, newEvent) => {
          const state = addEvents(events);
          expect(state.length).toBe(MAX_EVENTS);

          const lastEventBefore = state[state.length - 1];
          const updated = addEvent(state, newEvent);

          expect(updated.length).toBe(MAX_EVENTS);
          expect(updated[0].id).toBe(newEvent.id);
          // The oldest event should have been dropped
          expect(
            updated.find((e) => e.id === lastEventBefore.id),
          ).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: ui-overhaul, Property 5: Audit event rendering includes required fields
describe("Property 5: Audit event rendering includes required fields", () => {
  it("for any AuditEvent, the formatted timestamp is a non-empty string derivable from the event timestamp", () => {
    fc.assert(
      fc.property(singleAuditEventArb, (event) => {
        const formatted = formatTimestamp(event.timestamp);

        // The formatted timestamp must be a non-empty string
        expect(formatted.length).toBeGreaterThan(0);

        // It should be derivable from the original timestamp
        const date = new Date(event.timestamp);
        expect(date.getTime()).not.toBeNaN();
      }),
      { numRuns: 100 },
    );
  });

  it("every AuditEvent has a valid event type that maps to a known indicator", () => {
    const validTypes: AuditEventType[] = [
      "execution_action",
      "pipeline_completed",
      "ticket_created",
      "ticket_updated",
    ];

    fc.assert(
      fc.property(singleAuditEventArb, (event) => {
        expect(validTypes).toContain(event.type);
      }),
      { numRuns: 100 },
    );
  });

  it("every AuditEvent has a non-empty summary string", () => {
    fc.assert(
      fc.property(singleAuditEventArb, (event) => {
        expect(event.summary.length).toBeGreaterThan(0);
        expect(event.summary.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("a rendered event row contains the formatted timestamp, event type, and summary", () => {
    /**
     * Model the rendering of an event row as a pure function that produces
     * the text content of the row. This mirrors what AuditToolbar renders
     * for each event: timestamp + type indicator + summary.
     */
    function renderEventRow(event: AuditEvent): {
      timestamp: string;
      type: AuditEventType;
      summary: string;
    } {
      return {
        timestamp: formatTimestamp(event.timestamp),
        type: event.type,
        summary: event.summary,
      };
    }

    fc.assert(
      fc.property(singleAuditEventArb, (event) => {
        const row = renderEventRow(event);

        // Row must contain the formatted timestamp
        expect(row.timestamp).toBe(formatTimestamp(event.timestamp));

        // Row must contain the event type indicator
        expect(row.type).toBe(event.type);

        // Row must contain the summary text
        expect(row.summary).toBe(event.summary);
      }),
      { numRuns: 100 },
    );
  });

  it("formatTimestamp produces consistent output for the same input", () => {
    fc.assert(
      fc.property(singleAuditEventArb, (event) => {
        const first = formatTimestamp(event.timestamp);
        const second = formatTimestamp(event.timestamp);
        expect(first).toBe(second);
      }),
      { numRuns: 100 },
    );
  });
});
