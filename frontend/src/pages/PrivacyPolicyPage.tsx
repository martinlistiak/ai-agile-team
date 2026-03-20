import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";

export function PrivacyPolicyPage() {
  return (
    <div className="privacy-page-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&display=swap');

        .privacy-page-root {
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

        .privacy-page-root * { box-sizing: border-box; }
        .font-display { font-family: 'Instrument Serif', Georgia, serif; }

        .nav-blur {
          backdrop-filter: blur(12px) saturate(1.4);
          -webkit-backdrop-filter: blur(12px) saturate(1.4);
          background: oklch(0.985 0.004 239 / 0.85);
        }
      `}</style>

      {/* Navigation */}
      <PublicNav />

      {/* Content */}
      <main className="pt-28 pb-20 px-6">
        <div className="max-w-[720px] mx-auto">
          <p
            className="text-[13px] font-medium tracking-wide uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            Legal
          </p>
          <h1
            className="font-display tracking-[-0.02em] mb-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Privacy Policy
          </h1>
          <p
            className="text-[13px] mb-10"
            style={{ color: "var(--text-tertiary)" }}
          >
            Last updated: March 14, 2026
          </p>

          <div className="space-y-8" style={{ color: "var(--text-secondary)" }}>
            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                1. Information We Collect
              </h2>
              <p className="text-[14px] leading-relaxed mb-3">
                When you use Runa, we collect information you provide directly,
                such as your name, email address, and GitHub account details
                when you sign in. We also collect usage data including how you
                interact with our AI agents, tickets, and pipeline features.
              </p>
              <p className="text-[14px] leading-relaxed">
                We automatically collect technical information such as your
                browser type, operating system, IP address, and device
                identifiers to help us improve the service and ensure security.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                2. How We Use Your Information
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
                <li>
                  Provide, maintain, and improve the Runa platform and AI agent
                  services
                </li>
                <li>
                  Process your tickets and run automated pipeline workflows
                </li>
                <li>Authenticate your identity and manage your account</li>
                <li>
                  Communicate with you about service updates, security alerts,
                  and support
                </li>
                <li>
                  Analyze usage patterns to improve our AI agents and features
                </li>
                <li>
                  Detect, prevent, and address technical issues and security
                  threats
                </li>
              </ul>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                3. Code and Repository Data
              </h2>
              <p className="text-[14px] leading-relaxed">
                When you connect your GitHub account and repositories, our AI
                agents access your code solely to perform the tasks you request
                — such as writing code, creating pull requests, and running
                tests. We do not use your proprietary code to train our AI
                models. Repository data is processed in real-time and is not
                stored beyond what is necessary to complete the requested
                operations.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                4. Data Sharing
              </h2>
              <p className="text-[14px] leading-relaxed">
                We do not sell your personal information. We may share data with
                third-party service providers who assist in operating our
                platform (such as hosting and AI model providers), but only as
                necessary to deliver the service. We may also disclose
                information if required by law or to protect the rights and
                safety of our users.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                5. Data Security
              </h2>
              <p className="text-[14px] leading-relaxed">
                We implement industry-standard security measures including
                encryption in transit and at rest, access controls, and regular
                security audits. Authentication tokens for connected services
                like GitHub are encrypted before storage. While no system is
                completely secure, we are committed to protecting your data.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                6. Data Retention
              </h2>
              <p className="text-[14px] leading-relaxed">
                We retain your account data for as long as your account is
                active. Ticket history, audit logs, and pipeline execution
                records are retained to provide you with a complete project
                history. You may request deletion of your account and associated
                data at any time by contacting our support team.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                7. Your Rights
              </h2>
              <p className="text-[14px] leading-relaxed">
                Depending on your jurisdiction, you may have the right to
                access, correct, delete, or export your personal data. You may
                also have the right to object to or restrict certain processing
                activities. To exercise any of these rights, please contact us
                at{" "}
                <span style={{ color: "var(--accent)" }}>
                  privacy@runa-app.com
                </span>
                .
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                8. Cookies
              </h2>
              <p className="text-[14px] leading-relaxed">
                We use essential cookies to maintain your session and
                authentication state. We may also use analytics cookies to
                understand how the platform is used. You can control cookie
                preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                9. Changes to This Policy
              </h2>
              <p className="text-[14px] leading-relaxed">
                We may update this privacy policy from time to time. We will
                notify you of any material changes by posting the updated policy
                on this page and updating the "Last updated" date. Your
                continued use of Runa after changes constitutes acceptance of
                the updated policy.
              </p>
            </section>

            <section>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                10. Contact Us
              </h2>
              <p className="text-[14px] leading-relaxed">
                If you have questions about this privacy policy or our data
                practices, please contact us at{" "}
                <span style={{ color: "var(--accent)" }}>
                  privacy@runa-app.com
                </span>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
