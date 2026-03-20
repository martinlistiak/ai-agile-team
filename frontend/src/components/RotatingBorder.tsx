import React, { CSSProperties, ReactNode } from "react";

interface RotatingBorderProps {
  active?: boolean;
  color?: string;
  children: ReactNode;
  borderRadius?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wraps children with a rotating conic-gradient border.
 * When `active` is false, renders children without the effect.
 */
const RotatingBorder: React.FC<RotatingBorderProps> = ({
  active = false,
  color = "#8b5cf6",
  children,
  borderRadius = 8,
  duration = 3,
  className,
  style,
}) => {
  if (!active) {
    return <>{children}</>;
  }

  // Derive 3 gradient stops from the base color at different opacities
  const stops = {
    dim: `${color}66`, // 40% opacity
    mid: `${color}cc`, // 80% opacity
    bright: color, // full
  };

  return (
    <div
      className={`relative isolate ${className ?? ""}`}
      style={{ borderRadius, ...style } as CSSProperties}
    >
      {/* gradient border pseudo-layers */}
      <div
        className="absolute -inset-[2px] -z-1 rounded-[inherit] pointer-events-none"
        style={{
          background: `conic-gradient(from var(--gradient-angle), ${stops.dim}, ${stops.mid}, ${stops.bright}, ${stops.mid}, ${stops.dim})`,
          animation: `gradient-rotation ${duration}s linear infinite`,
          borderRadius: borderRadius + 2,
        }}
      />
      <div
        className="absolute -inset-[2px] -z-2 rounded-[inherit] pointer-events-none"
        style={{
          background: `conic-gradient(from var(--gradient-angle), ${stops.dim}, ${stops.mid}, ${stops.bright}, ${stops.mid}, ${stops.dim})`,
          animation: `gradient-rotation ${duration}s linear infinite`,
          filter: "blur(8px)",
          borderRadius: borderRadius + 2,
        }}
      />
      <div className="relative rounded-[inherit]">{children}</div>
    </div>
  );
};

export default RotatingBorder;
