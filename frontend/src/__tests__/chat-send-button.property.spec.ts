import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Property tests for the chat send button disabled state.
 *
 * We model the send button disabled logic from ChatModal.tsx as a pure
 * function and verify the disabled invariant across arbitrary states.
 */

// Feature: ui-overhaul, Property 13: Send button disabled while message is pending

// --- Pure model of send button disabled logic ---

interface SendButtonState {
  isPending: boolean;
  inputText: string;
  selectedImageCount: number;
}

/**
 * Models the disabled attribute logic from ChatModal.tsx:
 *   disabled={sendMessage.isPending || (!input.trim() && selectedImages.length === 0)}
 */
function isSendButtonDisabled(state: SendButtonState): boolean {
  return (
    state.isPending ||
    (!state.inputText.trim() && state.selectedImageCount === 0)
  );
}

// --- Generators ---

const sendButtonStateArb: fc.Arbitrary<SendButtonState> = fc.record({
  isPending: fc.boolean(),
  inputText: fc.string({ minLength: 0, maxLength: 200 }),
  selectedImageCount: fc.nat({ max: 10 }),
});

const pendingStateArb: fc.Arbitrary<SendButtonState> = fc.record({
  isPending: fc.constant(true),
  inputText: fc.string({ minLength: 0, maxLength: 200 }),
  selectedImageCount: fc.nat({ max: 10 }),
});

const nonPendingNonEmptyInputArb: fc.Arbitrary<SendButtonState> = fc.record({
  isPending: fc.constant(false),
  inputText: fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0),
  selectedImageCount: fc.nat({ max: 10 }),
});

const nonPendingWithImagesArb: fc.Arbitrary<SendButtonState> = fc.record({
  isPending: fc.constant(false),
  inputText: fc.constant(""),
  selectedImageCount: fc.integer({ min: 1, max: 10 }),
});

// --- Tests ---

// **Validates: Requirements 9.5**
describe("Property 13: Send button disabled while message is pending", () => {
  it("send button is always disabled when isPending is true, regardless of input", () => {
    fc.assert(
      fc.property(pendingStateArb, (state) => {
        expect(isSendButtonDisabled(state)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("send button is not disabled when isPending is false and input has non-whitespace text", () => {
    fc.assert(
      fc.property(nonPendingNonEmptyInputArb, (state) => {
        expect(isSendButtonDisabled(state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("send button is not disabled when isPending is false and images are selected", () => {
    fc.assert(
      fc.property(nonPendingWithImagesArb, (state) => {
        expect(isSendButtonDisabled(state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("for any state, disabled is true iff isPending or (empty trimmed input and no images)", () => {
    fc.assert(
      fc.property(sendButtonStateArb, (state) => {
        const disabled = isSendButtonDisabled(state);
        const hasContent =
          state.inputText.trim().length > 0 || state.selectedImageCount > 0;
        if (state.isPending) {
          expect(disabled).toBe(true);
        } else if (hasContent) {
          expect(disabled).toBe(false);
        } else {
          expect(disabled).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
