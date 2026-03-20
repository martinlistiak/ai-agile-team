export const homepageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');

  .homepage-root {
    --hue-brand: 239;
    --surface: oklch(0.985 0.004 var(--hue-brand));
    --surface-raised: oklch(1 0 0);
    --text-primary: oklch(0.18 0.02 var(--hue-brand));
    --text-secondary: oklch(0.45 0.01 var(--hue-brand));
    --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
    --accent: oklch(0.55 0.22 var(--hue-brand));
    --accent-soft: oklch(0.55 0.22 var(--hue-brand) / 0.08);
    --accent-medium: oklch(0.55 0.22 var(--hue-brand) / 0.15);
    --border: oklch(0.88 0.008 var(--hue-brand));
    --border-light: oklch(0.93 0.005 var(--hue-brand));

    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--text-primary);
    background: var(--surface);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .homepage-root * {
    box-sizing: border-box;
  }

  .font-display {
    font-family: 'Instrument Serif', Georgia, serif;
  }

  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }

  @keyframes float-gentle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.4; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .mockup-shadow {
    box-shadow:
      0 1px 2px rgba(0,0,0,0.04),
      0 4px 12px rgba(0,0,0,0.03),
      0 16px 40px rgba(0,0,0,0.04);
  }

  .plan-featured {
    background: var(--surface-raised);
    box-shadow:
      0 0 0 1px var(--accent),
      0 4px 24px oklch(0.55 0.22 239 / 0.12),
      0 12px 48px oklch(0.55 0.22 239 / 0.06);
  }

  .plan-default {
    background: var(--surface-raised);
    box-shadow: 0 0 0 1px var(--border);
  }

  .plan-default:hover,
  .plan-featured:hover {
    transform: translateY(-2px);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  }

  .nav-blur {
    backdrop-filter: blur(12px) saturate(1.4);
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    background: oklch(0.985 0.004 239 / 0.85);
  }

  @keyframes marquee-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-33.333%); }
  }

  .logo-carousel-track {
    overflow: hidden;
    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  }

  .logo-carousel-inner {
    display: flex;
    width: max-content;
    animation: marquee-scroll 20s linear infinite;
  }

  .logo-carousel-track:hover .logo-carousel-inner {
    animation-play-state: paused;
  }
`;
