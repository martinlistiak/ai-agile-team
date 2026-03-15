import { Link, useLocation } from "react-router-dom";

export function PublicFooter() {
  const { pathname } = useLocation();

  const links = [
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
    { to: "#", label: "Docs", external: true },
  ];

  return (
    <footer className="px-6 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <div
          className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div className="flex items-center gap-6">
            <Link
              to="/home"
              className="font-display text-xl no-underline"
              style={{ color: "var(--text-primary)" }}
            >
              Runa
            </Link>
            <span
              className="text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              © 2026 Runa. All rights reserved.
            </span>
          </div>
          <div
            className="flex items-center gap-5 text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {links.map((link) =>
              pathname === link.to ? (
                <span
                  key={link.label}
                  style={{ color: "var(--text-primary)", fontWeight: 500 }}
                >
                  {link.label}
                </span>
              ) : link.external ? (
                <a
                  key={link.label}
                  href={link.to}
                  className="hover:opacity-70 transition-opacity no-underline"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.to}
                  className="hover:opacity-70 transition-opacity no-underline"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
