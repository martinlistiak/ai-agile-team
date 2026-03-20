/** Ink color matches public/favicon.svg (black “R” on cream gradient). */
const BRAND_INK = "#000000";

export function RunaLogo({
  height = 36,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-display inline-block tracking-tight leading-none ${className}`.trim()}
      style={{
        fontSize: height,
        color: BRAND_INK,
      }}
    >
      Runa
    </span>
  );
}
