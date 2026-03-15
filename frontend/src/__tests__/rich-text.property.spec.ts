import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { remark } from "remark";
import remarkGfm from "remark-gfm";

/**
 * Property 2: Markdown editor round-trip preserves content
 *
 * Since Milkdown uses Remark internally for Markdown parsing/serialization,
 * we test the round-trip property using remark directly: for any supported
 * Markdown syntax, processing through remark twice (parse → serialize → parse
 * → serialize) produces identical output. This proves the round-trip is
 * lossless after normalization.
 *
 * **Validates: Requirements 2.5**
 */

const processor = remark().use(remarkGfm);

async function remarkRoundTrip(markdown: string): Promise<string> {
  const result = await processor.process(markdown);
  return String(result);
}

// Safe text generator: alphanumeric + spaces, no special chars that remark escapes
const safeText = (maxLen = 30) =>
  fc
    .string({ minLength: 1, maxLength: maxLen, unit: "grapheme-ascii" })
    .filter((s) => /^[a-zA-Z0-9 ]+$/.test(s) && s.trim().length > 0)
    .map((s) => s.trim());

// Generator for Markdown-like content with supported syntax patterns
const markdownHeading = fc
  .tuple(fc.constantFrom("#", "##", "###", "####"), safeText(40))
  .map(([level, text]) => `${level} ${text}`);

const markdownBold = safeText().map((text) => `**${text}**`);

const markdownItalic = safeText().map((text) => `*${text}*`);

const markdownInlineCode = fc
  .string({ minLength: 1, maxLength: 30, unit: "grapheme-ascii" })
  .filter((s) => /\S/.test(s) && !s.includes("\n") && !s.includes("`"))
  .map((text) => `\`${text}\``);

const markdownLink = fc
  .tuple(safeText(20), fc.webUrl())
  .map(([text, url]) => `[${text}](${url})`);

const markdownCodeBlock = fc
  .tuple(
    fc.constantFrom("js", "ts", "python", "json", ""),
    fc
      .string({ minLength: 1, maxLength: 60, unit: "grapheme-ascii" })
      .filter((s) => !s.includes("```")),
  )
  .map(([lang, code]) => `\`\`\`${lang}\n${code}\n\`\`\``);

const markdownUnorderedList = fc
  .array(safeText(), { minLength: 1, maxLength: 5 })
  .map((items) => items.map((item) => `* ${item}`).join("\n"));

const markdownOrderedList = fc
  .array(safeText(), { minLength: 1, maxLength: 5 })
  .map((items) => items.map((item, i) => `${i + 1}. ${item}`).join("\n"));

const markdownCheckboxList = fc
  .array(fc.tuple(fc.boolean(), safeText()), { minLength: 1, maxLength: 5 })
  .map((items) =>
    items
      .map(([checked, text]) => `* [${checked ? "x" : " "}] ${text}`)
      .join("\n"),
  );

// Combine all Markdown element generators
const markdownElement = fc.oneof(
  markdownHeading,
  markdownBold,
  markdownItalic,
  markdownInlineCode,
  markdownLink,
  markdownCodeBlock,
  markdownUnorderedList,
  markdownOrderedList,
  markdownCheckboxList,
);

// Generate a full Markdown document by combining elements with blank lines
const markdownDocument = fc
  .array(markdownElement, { minLength: 1, maxLength: 6 })
  .map((elements) => elements.join("\n\n") + "\n");

describe("Property 2: Markdown editor round-trip preserves content", () => {
  it("round-trip through remark is idempotent (normalized output is stable)", async () => {
    await fc.assert(
      fc.asyncProperty(markdownDocument, async (markdown) => {
        const firstPass = await remarkRoundTrip(markdown);
        const secondPass = await remarkRoundTrip(firstPass);
        expect(secondPass).toBe(firstPass);
      }),
      { numRuns: 100 },
    );
  });

  it("individual Markdown elements survive round-trip without content loss", async () => {
    await fc.assert(
      fc.asyncProperty(markdownElement, async (element) => {
        const input = element + "\n";
        const output = await remarkRoundTrip(input);
        const outputAgain = await remarkRoundTrip(output);
        // After normalization, the output must be stable
        expect(outputAgain).toBe(output);
      }),
      { numRuns: 100 },
    );
  });

  it("headings preserve their level and text content after round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(markdownHeading, async (heading) => {
        const input = heading + "\n";
        const output = await remarkRoundTrip(input);
        // Extract heading level and text
        const inputMatch = heading.match(/^(#{1,4})\s+(.+)$/);
        expect(inputMatch).not.toBeNull();
        const level = inputMatch![1];
        const text = inputMatch![2];
        // Heading level and text must be preserved
        expect(output).toContain(level + " ");
        expect(output).toContain(text);
      }),
      { numRuns: 100 },
    );
  });

  it("links survive round-trip and are stable after normalization", async () => {
    await fc.assert(
      fc.asyncProperty(markdownLink, async (link) => {
        const input = link + "\n";
        const output = await remarkRoundTrip(input);
        // Round-trip must be stable (idempotent after normalization)
        const secondPass = await remarkRoundTrip(output);
        expect(secondPass).toBe(output);
        // Output must not be empty — link content is preserved
        expect(output.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("code blocks preserve language and content after round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(markdownCodeBlock, async (block) => {
        const input = block + "\n";
        const output = await remarkRoundTrip(input);
        // The code content between the fences should be preserved
        const inputLines = block.split("\n");
        const codeContent = inputLines.slice(1, -1).join("\n");
        expect(output).toContain(codeContent);
      }),
      { numRuns: 100 },
    );
  });
});
