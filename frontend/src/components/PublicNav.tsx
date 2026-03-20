import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import { RunaLogo } from "./RunaLogo";

/** Tokens for portaled menu (body is outside `.homepage-root` / page roots). */
const PUBLIC_MENU_SURFACE = "oklch(0.985 0.004 239)";
const publicMenuCssVars = {
  "--text-primary": "oklch(0.18 0.02 239)",
  "--text-secondary": "oklch(0.45 0.01 239)",
  "--border-light": "oklch(0.93 0.005 239)",
  "--border": "oklch(0.88 0.008 239)",
  "--accent": "oklch(0.55 0.22 239)",
} as React.CSSProperties;

export function PublicNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const id = window.requestAnimationFrame(() => firstLinkRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onHomeSectionClick =
    (sectionId: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      setMenuOpen(false);
      if (location.pathname !== "/home") return;
      e.preventDefault();
      navigate(`/home#${sectionId}`);
    };

  const navLinks = [
    { to: "/home#features", label: "Features", section: "features" },
    { to: "/home#pricing", label: "Pricing", section: "pricing" },
    {
      to: "/home#how-it-works",
      label: "How it works",
      section: "how-it-works",
    },
    { to: "/docs", label: "Docs", section: "" },
    { to: "/status", label: "Status", section: "" },
  ];

  const mobileMenu =
    menuOpen &&
    createPortal(
      <div
        className="md:hidden fixed left-0 right-0 bottom-0 z-90 flex flex-col overflow-y-auto overscroll-contain border-t public-nav-mobile-panel-in shadow-[0_12px_40px_-12px_oklch(0.25_0.04_239/0.2)]"
        style={{
          top: "3.5rem",
          backgroundColor: PUBLIC_MENU_SURFACE,
          borderColor: "oklch(0.93 0.005 239)",
          ...publicMenuCssVars,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div className="flex flex-col px-6 py-6 gap-0">
          {navLinks.map((link, i) => (
            <Link
              key={link.label}
              ref={i === 0 ? firstLinkRef : undefined}
              to={link.to}
              onClick={
                link.section ? onHomeSectionClick(link.section) : undefined
              }
              className="block py-3.5 text-[15px] font-medium no-underline transition-opacity hover:opacity-70 public-nav-mobile-link-in"
              style={{
                color: "var(--text-primary)",
                borderBottom: "1px solid var(--border-light)",
                animationDelay: `${60 + i * 45}ms`,
              }}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="flex flex-col gap-3 mt-6 public-nav-mobile-link-in"
            style={{ animationDelay: `${60 + navLinks.length * 45 + 40}ms` }}
          >
            <Link
              to="/login"
              className="text-center text-[15px] font-medium px-4 py-3 rounded-lg no-underline transition-colors hover:opacity-70"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              Sign in
            </Link>
            <Link
              to="/login?register=1"
              className="text-center text-[15px] font-medium px-4 py-3 rounded-lg text-white no-underline transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Get started
            </Link>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <nav
      className="nav-blur fixed top-0 left-0 right-0 z-100 border-b"
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/home" className="no-underline">
            <RunaLogo height={32} />
          </Link>
          {/* Desktop nav links */}
          <div
            className="hidden md:flex items-center gap-6 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={
                  link.section ? onHomeSectionClick(link.section) : undefined
                }
                className="hover:opacity-70 transition-opacity"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden md:inline-flex text-[13px] font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-70 no-underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign in
          </Link>
          <Link
            to="/login?register=1"
            className="hidden md:inline-flex text-[13px] font-medium px-4 py-2 rounded-lg text-white no-underline transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Get started
          </Link>
          {/* Mobile hamburger */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden relative z-101 flex items-center justify-center w-10 h-10 rounded-lg transition-opacity hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-primary)" }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </div>

      {mobileMenu}
    </nav>
  );
}
