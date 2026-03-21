import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";

/**
 * A wandering dot that drifts around the canvas, leaving a fading trail.
 * The user can nudge it by moving their cursor nearby — a small moment
 * of delight on an otherwise dead-end page.
 */
function WanderingDot({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const dot = useRef({
    x: width / 2,
    y: height / 2,
    vx: 0.4,
    vy: 0.3,
  });
  const trail = useRef<{ x: number; y: number; age: number }[]>([]);

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const ACCENT = "oklch(0.55 0.22 239)";
    const ACCENT_FAINT = "oklch(0.55 0.22 239 / 0.06)";

    const tick = () => {
      const d = dot.current;
      const m = mouse.current;

      // Gentle autonomous drift
      d.vx += (Math.random() - 0.5) * 0.06;
      d.vy += (Math.random() - 0.5) * 0.06;

      // Repel from mouse
      const dx = d.x - m.x;
      const dy = d.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 0) {
        const force = (120 - dist) / 120;
        d.vx += (dx / dist) * force * 0.8;
        d.vy += (dy / dist) * force * 0.8;
      }

      // Damping
      d.vx *= 0.97;
      d.vy *= 0.97;

      // Speed cap
      const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
      if (speed > 3) {
        d.vx = (d.vx / speed) * 3;
        d.vy = (d.vy / speed) * 3;
      }

      d.x += d.vx;
      d.y += d.vy;

      // Bounce off edges
      if (d.x < 8 || d.x > width - 8) d.vx *= -1;
      if (d.y < 8 || d.y > height - 8) d.vy *= -1;
      d.x = Math.max(8, Math.min(width - 8, d.x));
      d.y = Math.max(8, Math.min(height - 8, d.y));

      // Trail
      trail.current.push({ x: d.x, y: d.y, age: 0 });
      trail.current = trail.current.filter((p) => {
        p.age++;
        return p.age < 60;
      });

      // Draw
      ctx.clearRect(0, 0, width, height);

      // Trail segments
      for (const p of trail.current) {
        const alpha = 1 - p.age / 60;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.55 0.22 239 / ${(alpha * 0.18).toFixed(3)})`;
        ctx.fill();
      }

      // Main dot
      ctx.beginPath();
      ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();

      // Soft glow
      ctx.beginPath();
      ctx.arc(d.x, d.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT_FAINT;
      ctx.fill();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseMove={onMove}
      className="absolute inset-0"
      style={{ opacity: 0.7 }}
      aria-hidden="true"
    />
  );
}

export function NotFoundPage() {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="notfound-root">
      <style>{notFoundStyles}</style>
      <PublicNav />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-8 relative">
        {/* Canvas container */}
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ top: "3.5rem" }}
        >
          {dims.w > 0 && <WanderingDot width={dims.w} height={dims.h} />}
        </div>

        {/* Content */}
        <div
          className="relative z-10 max-w-[520px] w-full"
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? "translateY(0)" : "translateY(32px)",
            transition:
              "opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* The big 404 */}
          <p
            className="font-display leading-none tracking-[-0.04em] mb-2"
            style={{
              fontSize: "clamp(6rem, 18vw, 10rem)",
              color: "var(--accent)",
              opacity: 0.12,
            }}
          >
            404
          </p>

          <h1
            className="font-display tracking-[-0.02em] mb-3"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}
          >
            This page wandered off
          </h1>

          <p
            className="text-[15px] leading-relaxed mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Nothing lives at{" "}
            <code
              className="text-[13px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              {pathname}
            </code>
          </p>
          <p
            className="text-[13px] leading-relaxed mb-8"
            style={{ color: "var(--text-tertiary)" }}
          >
            It might have been moved, or the URL could have a typo. Try heading
            home or checking the navigation above.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-lg text-white no-underline transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Back to home
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M13 7H1m0 0l5-5M1 7l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              to="/status"
              className="inline-flex items-center text-[13px] font-medium px-4 py-3 rounded-lg no-underline transition-all hover:opacity-70"
              style={{ color: "var(--text-secondary)" }}
            >
              Check status
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

const notFoundStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');

  .notfound-root {
    --hue-brand: 239;
    --surface: oklch(0.985 0.004 var(--hue-brand));
    --surface-raised: oklch(1 0 0);
    --text-primary: oklch(0.18 0.02 var(--hue-brand));
    --text-secondary: oklch(0.45 0.01 var(--hue-brand));
    --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
    --accent: oklch(0.55 0.22 var(--hue-brand));
    --accent-soft: oklch(0.55 0.22 var(--hue-brand) / 0.08);
    --border: oklch(0.88 0.008 var(--hue-brand));
    --border-light: oklch(0.93 0.005 var(--hue-brand));

    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--text-primary);
    background: var(--surface);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .notfound-root * {
    box-sizing: border-box;
  }

  .notfound-root .font-display {
    font-family: 'Instrument Serif', Georgia, serif;
  }

  .nav-blur {
    backdrop-filter: blur(12px) saturate(1.4);
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    background: oklch(0.985 0.004 239 / 0.85);
  }
`;
