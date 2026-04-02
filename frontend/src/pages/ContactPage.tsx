import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { homepageStyles } from "./homepage/homepage-styles";

const TEAM_SIZES = [
  "1-5",
  "6-20",
  "21-50",
  "51-200",
  "201-500",
  "500+",
] as const;

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source") ?? "direct";
  const { success: showSuccess, error: showError } = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: typeof form & { source: string }) => {
      const { data: result } = await api.post("/contact", data);
      return result;
    },
    onSuccess: () => {
      setSubmitted(true);
      showSuccess("Message sent — we'll be in touch soon.");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to send message");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...form, source });
  };

  const updateField = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]";

  return (
    <div className="homepage-root">
      <style>{homepageStyles}</style>
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-[1200px] mx-auto text-center">
          <p
            className="text-[13px] font-medium tracking-wide uppercase mb-4"
            style={{ color: "var(--accent)" }}
          >
            Enterprise
          </p>
          <h1
            className="font-display text-[clamp(2.4rem,5vw,3.8rem)] leading-[1.1] mb-5"
            style={{ color: "var(--text-primary)" }}
          >
            Let's build something{" "}
            <em className="font-display" style={{ color: "var(--accent)" }}>
              together
            </em>
          </h1>
          <p
            className="text-[clamp(1rem,1.8vw,1.15rem)] leading-relaxed max-w-2xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Runa Enterprise gives your team unlimited AI agents, custom
            training, SSO, dedicated support, and SLA guarantees. Tell us about
            your needs and we'll craft a plan that fits.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Left: features */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {[
                {
                  title: "SSO & SAML",
                  desc: "Enterprise-grade authentication with your identity provider",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  ),
                },
                {
                  title: "Custom agent training",
                  desc: "Train agents on your codebase, docs, and workflows",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                    />
                  ),
                },
                {
                  title: "On-premise deployment",
                  desc: "Run Runa in your own infrastructure for full control",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                    />
                  ),
                },
                {
                  title: "SLA guarantee",
                  desc: "99.9% uptime with dedicated support and priority response",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                    />
                  ),
                },
                {
                  title: "10M tokens / month",
                  desc: "Massive token allowance for large-scale agent operations",
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      style={{ color: "var(--accent)" }}
                    >
                      {item.icon}
                    </svg>
                  </div>
                  <div>
                    <p
                      className="text-[14px] font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-[13px] mt-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: form */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div
                  className="rounded-2xl p-10 text-center"
                  style={{
                    background: "var(--surface-raised)",
                    boxShadow: "0 0 0 1px var(--border)",
                  }}
                >
                  <div
                    className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    <svg
                      className="w-7 h-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: "var(--accent)" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2
                    className="font-display text-2xl mb-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Thanks for reaching out
                  </h2>
                  <p
                    className="text-[15px] leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    We've received your message and will get back to you within
                    24 hours.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl p-8"
                  style={{
                    background: "var(--surface-raised)",
                    boxShadow: "0 0 0 1px var(--border)",
                  }}
                >
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-[13px] font-medium mb-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          className={inputClass}
                          style={{
                            color: "var(--text-primary)",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}
                          placeholder="Jane Smith"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-[13px] font-medium mb-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Work email
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className={inputClass}
                          style={{
                            color: "var(--text-primary)",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}
                          placeholder="jane@company.com"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="contact-company"
                          className="block text-[13px] font-medium mb-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Company
                        </label>
                        <input
                          id="contact-company"
                          type="text"
                          value={form.company}
                          onChange={(e) =>
                            updateField("company", e.target.value)
                          }
                          className={inputClass}
                          style={{
                            color: "var(--text-primary)",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}
                          placeholder="Acme Inc."
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-team-size"
                          className="block text-[13px] font-medium mb-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Team size
                        </label>
                        <select
                          id="contact-team-size"
                          value={form.teamSize}
                          onChange={(e) =>
                            updateField("teamSize", e.target.value)
                          }
                          className={inputClass}
                          style={{
                            color: form.teamSize
                              ? "var(--text-primary)"
                              : "var(--text-tertiary)",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <option value="">Select...</option>
                          {TEAM_SIZES.map((size) => (
                            <option key={size} value={size}>
                              {size} people
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-[13px] font-medium mb-1.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        How can we help?
                      </label>
                      <textarea
                        id="contact-message"
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => updateField("message", e.target.value)}
                        className={`${inputClass} resize-none`}
                        style={{
                          color: "var(--text-primary)",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                        placeholder="Tell us about your project, team, and what you're looking to achieve..."
                      />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={gdprConsent}
                        onChange={(e) => setGdprConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-(--accent)"
                      />
                      <span
                        className="text-[12px] leading-relaxed"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        I agree to the processing of my personal data in
                        accordance with the{" "}
                        <a
                          href="/privacy"
                          className="underline hover:opacity-80"
                          style={{ color: "var(--accent)" }}
                        >
                          Privacy Policy
                        </a>
                        . You can withdraw your consent at any time.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="w-full text-[14px] font-medium py-3 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      {mutation.isPending ? "Sending…" : "Send message"}
                    </button>

                    <p
                      className="text-[12px] text-center"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      We respond within 24 hours. No spam, ever.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
