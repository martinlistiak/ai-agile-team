import { useState, useEffect, useRef } from "react";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";

/* ── Types ───────────────────────────────────── */

interface Endpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
  auth: boolean;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: string;
  responses?: Record<string, string>;
  tags: string[];
}

interface Section {
  id: string;
  label: string;
  description: string;
  endpoints: Endpoint[];
}

/* ── Parse OpenAPI spec into sections ────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenApiSpec = Record<string, any>;

function parseOpenApiSpec(spec: OpenApiSpec): Section[] {
  const tagDescriptions: Record<string, string> = {};
  if (spec.tags) {
    for (const tag of spec.tags) {
      tagDescriptions[tag.name] = tag.description || "";
    }
  }

  const grouped: Record<string, Endpoint[]> = {};

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(
      methods as Record<string, OpenApiSpec>,
    )) {
      if (method === "parameters") continue;
      const operation = op;
      const tags = operation.tags || ["Other"];
      const tag = tags[0];

      if (!grouped[tag]) grouped[tag] = [];

      // Extract request body summary
      let requestBody: string | undefined;
      if (operation.requestBody?.content) {
        const content = operation.requestBody.content;
        const jsonSchema = content["application/json"]?.schema;
        if (jsonSchema) {
          requestBody = formatSchema(jsonSchema, spec);
        } else if (content["multipart/form-data"]?.schema) {
          const props = content["multipart/form-data"].schema.properties || {};
          requestBody = "multipart/form-data: " + Object.keys(props).join(", ");
        }
      }

      // Extract response summaries
      const responses: Record<string, string> = {};
      for (const [code, resp] of Object.entries(operation.responses || {})) {
        responses[code] = (resp as OpenApiSpec).description || "";
      }

      grouped[tag].push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary || "",
        description: operation.description,
        auth:
          !!operation.security?.length ||
          tags.some((t: string) => {
            const endpoints = grouped[t];
            return endpoints?.some((e) => e.auth);
          }),
        parameters: operation.parameters,
        requestBody,
        responses,
        tags,
      });
    }
  }

  // Determine auth per endpoint: if the spec has global security or the operation has security
  for (const endpoints of Object.values(grouped)) {
    for (const ep of endpoints) {
      // Re-check: look at the raw spec
      const rawOp = (spec.paths[ep.path] as OpenApiSpec)?.[
        ep.method.toLowerCase()
      ];
      ep.auth = !!rawOp?.security?.length;
    }
  }

  return Object.entries(grouped).map(([tag, endpoints]) => ({
    id: tag.toLowerCase().replace(/\s+/g, "-"),
    label: tag,
    description: tagDescriptions[tag] || "",
    endpoints,
  }));
}

function formatSchema(schema: OpenApiSpec, spec: OpenApiSpec): string {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    const resolved = spec.components?.schemas?.[refName];
    if (resolved) return formatSchema(resolved, spec);
    return refName;
  }
  if (schema.properties) {
    const props = schema.properties as Record<string, OpenApiSpec>;
    const parts = Object.entries(props).map(([key, val]) => {
      const required = schema.required?.includes(key);
      const type = val.type || val.enum?.join(" | ") || "any";
      return `"${key}${required ? "" : "?"}": ${val.enum ? val.enum.map((e: string) => `"${e}"`).join(" | ") : `"${type}"`}`;
    });
    return `{ ${parts.join(", ")} }`;
  }
  return JSON.stringify(schema);
}

/* ── Fallback data (used if spec fetch fails) ── */

const FALLBACK_SECTIONS: Section[] = [
  {
    id: "loading",
    label: "Loading",
    description: "Fetching API specification from the server...",
    endpoints: [],
  },
];

/* ── Colors ──────────────────────────────────── */

const METHOD_COLORS: Record<string, { bg: string; fg: string }> = {
  GET: { bg: "oklch(0.94 0.06 155)", fg: "oklch(0.32 0.08 155)" },
  POST: { bg: "oklch(0.92 0.06 250)", fg: "oklch(0.38 0.12 250)" },
  PATCH: { bg: "oklch(0.93 0.06 70)", fg: "oklch(0.40 0.10 70)" },
  PUT: { bg: "oklch(0.93 0.06 70)", fg: "oklch(0.40 0.10 70)" },
  DELETE: { bg: "oklch(0.93 0.05 25)", fg: "oklch(0.42 0.12 25)" },
};

/* ── Components ──────────────────────────────── */

function MethodBadge({ method }: { method: string }) {
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET;
  return (
    <span
      className="inline-block text-[11px] font-semibold tracking-wide w-[52px] text-center py-0.5 rounded"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {method}
    </span>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    ep.requestBody ||
    ep.description ||
    (ep.responses && Object.keys(ep.responses).length > 1);

  return (
    <div
      className="group"
      style={{ borderBottom: "1px solid var(--border-light)" }}
    >
      <button
        onClick={() => hasDetails && setOpen((v) => !v)}
        className="w-full text-left flex items-start gap-3 py-3 px-0"
        style={{
          cursor: hasDetails ? "pointer" : "default",
          background: "none",
          border: "none",
          font: "inherit",
          color: "inherit",
        }}
      >
        <MethodBadge method={ep.method} />
        <code
          className="text-[13px] pt-px flex-1"
          style={{
            color: "var(--text-primary)",
            fontFamily: "'DM Sans', system-ui",
          }}
        >
          {ep.path}
        </code>
        <span
          className="text-[13px] shrink-0 text-right max-w-[280px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {ep.summary}
        </span>
        {ep.auth && (
          <span
            className="text-[10px] font-medium tracking-wide uppercase shrink-0 px-1.5 py-0.5 rounded"
            style={{
              background: "oklch(0.93 0.03 var(--hue-brand))",
              color: "var(--accent)",
            }}
          >
            Auth
          </span>
        )}
        {hasDetails && (
          <span
            className="text-[11px] shrink-0 transition-transform"
            style={{
              color: "var(--text-tertiary)",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ›
          </span>
        )}
      </button>
      {open && hasDetails && (
        <div
          className="pb-4 pl-[64px] space-y-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {ep.description && (
            <p className="text-[12px] leading-relaxed">{ep.description}</p>
          )}
          {ep.requestBody && (
            <div>
              <span
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Body
              </span>
              <pre
                className="text-[12px] mt-1 px-3 py-2 rounded-md overflow-x-auto leading-relaxed"
                style={{
                  background: "oklch(0.97 0.003 var(--hue-brand))",
                  border: "1px solid var(--border-light)",
                  fontFamily: "'DM Sans', system-ui",
                }}
              >
                {ep.requestBody}
              </pre>
            </div>
          )}
          {ep.responses && Object.keys(ep.responses).length > 0 && (
            <div>
              <span
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Responses
              </span>
              <div className="mt-1 space-y-1">
                {Object.entries(ep.responses).map(([code, desc]) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span
                      className="font-medium w-8"
                      style={{
                        color: code.startsWith("2")
                          ? "oklch(0.45 0.12 155)"
                          : code.startsWith("4")
                            ? "oklch(0.50 0.12 25)"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {code}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2
        className="text-[18px] font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {section.label}
      </h2>
      {section.description && (
        <p
          className="text-[13px] leading-relaxed mb-5"
          style={{ color: "var(--text-secondary)" }}
        >
          {section.description}
        </p>
      )}
      <div>
        {section.endpoints.map((ep, i) => (
          <EndpointRow key={i} ep={ep} />
        ))}
      </div>
    </section>
  );
}

function SideNav({
  sections,
  activeId,
  onNavigate,
}: {
  sections: Section[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {sections.map((s) => {
        const isActive = activeId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className="block w-full text-left text-[13px] py-1.5 px-3 rounded-md transition-colors"
            style={{
              background: isActive
                ? "oklch(0.93 0.03 var(--hue-brand))"
                : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 400,
              border: "none",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {s.label}
            <span
              className="ml-1.5 text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {s.endpoints.length}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Main Page ───────────────────────────────── */

export function ApiDocsPage() {
  const [sections, setSections] = useState<Section[]>(FALLBACK_SECTIONS);
  const [activeSection, setActiveSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  /* Fetch OpenAPI spec on mount */
  useEffect(() => {
    fetch("/api/docs-json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((spec) => {
        const parsed = parseOpenApiSpec(spec);
        setSections(parsed);
        if (parsed.length > 0) setActiveSection(parsed[0].id);
      })
      .catch((err) => {
        setError(`Could not load API spec: ${err.message}`);
      });
  }, []);

  /* Track scroll position to highlight active nav item */
  useEffect(() => {
    if (sections.length <= 1) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    const sectionEls = document.querySelectorAll("section[id]");
    sectionEls.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [sections]);

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const totalEndpoints = sections.reduce(
    (sum, s) => sum + s.endpoints.length,
    0,
  );

  return (
    <div className="api-docs-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&display=swap');

        .api-docs-root {
          --hue-brand: 239;
          --surface: oklch(0.985 0.004 var(--hue-brand));
          --surface-raised: oklch(1 0 0);
          --text-primary: oklch(0.18 0.02 var(--hue-brand));
          --text-secondary: oklch(0.45 0.01 var(--hue-brand));
          --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
          --accent: oklch(0.55 0.22 var(--hue-brand));
          --border: oklch(0.88 0.008 var(--hue-brand));
          --border-light: oklch(0.93 0.005 var(--hue-brand));

          font-family: 'DM Sans', system-ui, sans-serif;
          color: var(--text-primary);
          background: var(--surface);
          min-height: 100vh;
        }

        .api-docs-root * { box-sizing: border-box; }
        .font-display { font-family: 'Instrument Serif', Georgia, serif; }

        .nav-blur {
          backdrop-filter: blur(12px) saturate(1.4);
          -webkit-backdrop-filter: blur(12px) saturate(1.4);
          background: oklch(0.985 0.004 239 / 0.85);
        }

        .api-docs-root pre::-webkit-scrollbar { height: 4px; }
        .api-docs-root pre::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>

      <PublicNav />

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          {/* Header */}
          <div className="mb-14">
            <p
              className="text-[13px] font-medium tracking-wide uppercase mb-3"
              style={{ color: "var(--accent)" }}
            >
              Reference
            </p>
            <h1
              className="font-display tracking-[-0.02em] mb-3"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
            >
              API Documentation
            </h1>
            <p
              className="text-[15px] leading-relaxed max-w-[600px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {totalEndpoints > 0
                ? `${totalEndpoints} endpoints across ${sections.length} resources. `
                : ""}
              All endpoints are prefixed with{" "}
              <code
                className="text-[13px] px-1.5 py-0.5 rounded"
                style={{
                  background: "oklch(0.95 0.005 var(--hue-brand))",
                  fontFamily: "'DM Sans', system-ui",
                }}
              >
                /api
              </code>{" "}
              and return JSON.
            </p>

            {/* Auth info */}
            <div
              className="mt-6 px-5 py-4 rounded-lg"
              style={{
                background: "oklch(0.97 0.008 var(--hue-brand))",
                border: "1px solid var(--border-light)",
              }}
            >
              <p
                className="text-[13px] font-medium mb-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                Authentication
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Pass your API key or JWT token in the Authorization header:{" "}
                <code
                  className="text-[12px] px-1.5 py-0.5 rounded"
                  style={{
                    background: "oklch(0.94 0.005 var(--hue-brand))",
                    fontFamily: "'DM Sans', system-ui",
                  }}
                >
                  Authorization: Bearer {"<token>"}
                </code>
                . Create API keys from the{" "}
                <a href="/integrations" style={{ color: "var(--accent)" }}>
                  Integrations
                </a>{" "}
                page. API keys use the{" "}
                <code
                  className="text-[12px] px-1.5 py-0.5 rounded"
                  style={{
                    background: "oklch(0.94 0.005 var(--hue-brand))",
                    fontFamily: "'DM Sans', system-ui",
                  }}
                >
                  runa_
                </code>{" "}
                prefix and work on all authenticated endpoints — no login
                required.
              </p>
            </div>

            {/* Swagger UI link */}
            <p
              className="mt-4 text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Interactive explorer available at{" "}
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                /api/docs
              </a>{" "}
              · Spec JSON at{" "}
              <a
                href="/api/docs-json"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                /api/docs-json
              </a>
            </p>
          </div>

          {error && (
            <div
              className="mb-8 px-5 py-4 rounded-lg text-[13px]"
              style={{
                background: "oklch(0.95 0.03 25)",
                border: "1px solid oklch(0.88 0.05 25)",
                color: "oklch(0.42 0.12 25)",
              }}
            >
              {error}. You can still access the interactive docs at{" "}
              <a href="/api/docs" style={{ color: "var(--accent)" }}>
                /api/docs
              </a>
              .
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex gap-12 items-start" ref={mainRef}>
            {/* Sticky sidebar */}
            {sections.length > 1 && (
              <aside className="hidden lg:block w-[180px] shrink-0 sticky top-20">
                <SideNav
                  sections={sections}
                  activeId={activeSection}
                  onNavigate={handleNavigate}
                />
              </aside>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-14">
              {sections.map((s) => (
                <SectionBlock key={s.id} section={s} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
