import { Link } from "react-router-dom";

export function PublicNav() {
  return (
    <nav
      className="nav-blur fixed top-0 left-0 right-0 z-50 border-b"
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/home"
            className="font-display text-2xl tracking-tight no-underline"
            style={{ color: "var(--text-primary)" }}
          >
            Runa
          </Link>
          <div
            className="hidden md:flex items-center gap-6 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Link
              to="/home#features"
              className="hover:opacity-70 transition-opacity"
            >
              Features
            </Link>
            <Link
              to="/home#pricing"
              className="hover:opacity-70 transition-opacity"
            >
              Pricing
            </Link>
            <Link
              to="/home#how-it-works"
              className="hover:opacity-70 transition-opacity"
            >
              How it works
            </Link>
            <Link to="/docs" className="hover:opacity-70 transition-opacity">
              Docs
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-70 no-underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-[13px] font-medium px-4 py-2 rounded-lg text-white no-underline transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
