import { Outlet } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";

export function AuthLayout() {
  return (
    <div className="auth-layout-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');

        .auth-layout-root {
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

        .auth-layout-root * {
          box-sizing: border-box;
        }

        .auth-layout-root .font-display {
          font-family: 'Instrument Serif', Georgia, serif;
        }

        .nav-blur {
          backdrop-filter: blur(12px) saturate(1.4);
          -webkit-backdrop-filter: blur(12px) saturate(1.4);
          background: oklch(0.985 0.004 239 / 0.85);
        }
      `}</style>

      <PublicNav />

      <main className="flex-1 flex items-center justify-center px-6 pt-14">
        <div className="w-full max-w-[380px] py-16">
          <Outlet />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
