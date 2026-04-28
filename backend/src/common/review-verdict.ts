/**
 * Models often deviate from strict `REQUEST_CHANGES` (underscore) and emit
 * "request changes", markdown bold, etc.
 */
export function normalizeVerdictText(result: string): string {
  return result
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse the first `Verdict: ...` value (heading or inline). */
function parseVerdictValue(result: string): string | null {
  const m = result.match(/verdict\s*:\s*([^\n]+)/im);
  if (!m) return null;
  return m[1].toLowerCase().replace(/\*\*/g, "").replace(/^[\s:*]+/, "").trim();
}

/** True when the review output asks for code changes (blocking). */
export function isReviewerRequestChangesVerdict(result: string): boolean {
  const v = parseVerdictValue(result);
  if (!v) {
    const n = normalizeVerdictText(result);
    return (
      n.includes("verdict:") &&
      (n.includes("request_changes") || n.includes("request changes")) &&
      !n.includes("verdict: approve") &&
      !n.includes("verdict:approve") &&
      !n.includes("verdict: comment") &&
      !n.includes("verdict:comment")
    );
  }
  if (v.startsWith("approve")) return false;
  if (v.startsWith("comment")) return false;
  return (
    v.includes("request_changes") ||
    v.includes("request changes") ||
    (v.includes("request") && v.includes("change"))
  );
}

export function isReviewerApproveVerdict(result: string): boolean {
  const v = parseVerdictValue(result);
  if (v) return v.startsWith("approve");
  const n = normalizeVerdictText(result);
  return n.includes("verdict: approve") || n.includes("verdict:approve");
}

export function isTesterRequestFixesVerdict(result: string): boolean {
  const v = parseVerdictValue(result);
  if (v) {
    return (
      v.includes("request_fixes") ||
      v.includes("request fixes") ||
      (v.includes("request") && v.includes("fix"))
    );
  }
  const n = normalizeVerdictText(result);
  return (
    n.includes("verdict: request_fixes") ||
    n.includes("verdict: request fixes")
  );
}
