"use client";

import React, { useMemo } from "react";
import type { CSSProperties } from "react";

export default function Home() {
  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const softCard: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #202946",
      background: "rgba(20,27,48,0.55)",
    };

    const btnBase: CSSProperties = {
      padding: "11px 14px",
      borderRadius: 12,
      fontWeight: 900,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
      border: "none",
      transition: "transform 150ms ease, filter 150ms ease",
      whiteSpace: "nowrap",
    };

    const link: CSSProperties = {
      color: "#b7bed1",
      textDecoration: "none",
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid transparent",
    };

    const pill: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      color: "#dfe3f1",
      border: "1px solid rgba(110,231,255,0.25)",
      background: "rgba(110,231,255,0.08)",
    };

    return {
      wrap: { minHeight: "100vh", fontFamily: "Arial, sans-serif", color: "#e6e8ee" } as CSSProperties,
      container: { maxWidth: 1100, margin: "0 auto", padding: "18px 20px" } as CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      } as CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as CSSProperties,
      title: { fontWeight: 950, letterSpacing: 0.2 } as CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,

      link,
      btnPrimary: { ...btnBase, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as CSSProperties,
      btnGhost: { ...btnBase, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as CSSProperties,
      btnSoft: { ...btnBase, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e6e8ee" } as CSSProperties,

      section: { padding: "34px 20px" } as CSSProperties,
      hero: { padding: "58px 20px 26px" } as CSSProperties,

      heroGrid: {
        maxWidth: 1100,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 26,
        alignItems: "start",
      } as CSSProperties,

      h1: { margin: "14px 0 10px", fontSize: 44, lineHeight: 1.12, letterSpacing: -0.6 } as CSSProperties,
      h2: { margin: "0 0 14px", fontSize: 28 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", fontSize: 16, lineHeight: 1.7 } as CSSProperties,
      small: { fontSize: 12, color: "#8f97ad", lineHeight: 1.6 } as CSSProperties,

      card,
      softCard,

      grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 } as CSSProperties,
      grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as CSSProperties,

      footer: { borderTop: "1px solid #1b2340", padding: "18px 20px", color: "#8f97ad" } as CSSProperties,
      pill,
    };
  }, []);

  return (
    <main className="bg-breathe" style={styles.wrap}>
      {/* Top bar */}
      <div className="anim-in anim-delay-1" style={styles.container}>
        <div style={styles.topbar}>
          <div style={styles.brand}>
            <div style={styles.logo} />
            <div>
              <div style={styles.title}>Inventory Decision Engine</div>
              <div style={styles.subtitle}>Ops-grade actions from messy exports</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <a href="#product" style={styles.link}>Product</a>
            <a href="#pricing" style={styles.link}>Pricing</a>
            <a href="#faq" style={styles.link}>FAQ</a>
            <a className="btn-glow" href="/upload" style={styles.btnPrimary}>Try Demo</a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="anim-in anim-delay-2" style={styles.hero}>
        <div style={styles.heroGrid} className="hero-grid">
          <div>
            <span style={styles.pill}>⚡ Evidence-based inventory decisions</span>

            <h1 style={styles.h1}>
              Stop debating spreadsheets.
              <br />
              Get a ranked action list you can execute today.
            </h1>

            <p style={{ ...styles.p, maxWidth: 600 }}>
              Upload your exports, map columns once, and get decisions with evidence:
              <b style={{ color: "#e6e8ee" }}> stockout risk</b>, <b style={{ color: "#e6e8ee" }}>overstock</b>,
              <b style={{ color: "#e6e8ee" }}> dead stock</b>, plus <b style={{ color: "#e6e8ee" }}>suggested order qty</b>.
              Built around real ops signals: <b style={{ color: "#e6e8ee" }}>trend</b>, <b style={{ color: "#e6e8ee" }}>volatility</b>, <b style={{ color: "#e6e8ee" }}>active-demand days</b>, and <b style={{ color: "#e6e8ee" }}>loss</b>.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="btn-glow" href="/upload" style={styles.btnPrimary}>Upload CSV (Demo)</a>
              <a href="/results" style={styles.btnGhost}>Open Results (if loaded)</a>
              <a href="#pricing" style={styles.btnSoft}>See plans</a>
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 14, flexWrap: "wrap", color: "#aab1c4", fontSize: 13 }}>
              <span>✅ No install</span>
              <span>✅ Works with Excel exports</span>
              <span>✅ Ops + Procurement friendly</span>
              <span>✅ Warehouse optional</span>
            </div>
          </div>

          {/* Mock: Ops Control preview */}
          <div className="hover-lift anim-in anim-delay-3" style={{ ...styles.card, padding: 16, alignSelf: "start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 950 }}>Ops Control — Snapshot</div>
              <div style={{ fontSize: 12, color: "#aab1c4" }}>Demo preview</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <MiniMetric title="Order now" value="18" hint="Below policy ROP" />
              <MiniMetric title="Watch" value="27" hint="Near threshold band" />
              <MiniMetric title="Reduce" value="42" hint="Overstock cover" />
              <MiniMetric title="Loss signal" value="9" hint="Scrap / rejects" />
            </div>

            <div style={{ ...styles.softCard, marginTop: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Top actions (ranked)</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                <li>
                  <b>SKU-102</b> — Order now • Evidence: low cover, rising trend
                </li>
                <li>
                  <b>SKU-088</b> — Reduce • Evidence: 120d cover, low active days
                </li>
                <li>
                  <b>SKU-055</b> — Dead • Evidence: no demand in 30d
                </li>
              </ul>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip k="Profile" v="LUMPY" tone="amber" />
              <Chip k="Trend" v="+0.28" tone="green" />
              <Chip k="CV" v="1.34" tone="amber" />
              <Chip k="Loss" v="3.8%" tone="violet" />
            </div>

            <div style={{ marginTop: 12, ...styles.small }}>
              This is what your stakeholders want: decision + evidence, not charts for the sake of charts.
            </div>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="anim-in anim-delay-1" style={styles.section}>
        <div style={{ ...styles.container, padding: 0 }}>
          <div style={{ ...styles.small, marginBottom: 10 }}>Why teams use it</div>
          <div style={styles.grid3} className="three-col">
            <Feature
              title="Fewer stockouts"
              desc="Policy-based reorder point + volatility buffers + trend. Not a random formula."
              badge="Ops"
            />
            <Feature
              title="Less cash trapped"
              desc="Detect overstock by cover horizon and low velocity. Push reduce/stop-buy actions."
              badge="Finance"
            />
            <Feature
              title="Cleaner decisions"
              desc="Evidence chips: profile, trend, CV, active days, loss. Easier approvals."
              badge="Leadership"
            />
          </div>
        </div>
      </section>

      {/* Product detail */}
      <section id="product" className="anim-in anim-delay-2" style={styles.section}>
        <div style={{ ...styles.container, padding: 0 }}>
          <h2 style={styles.h2}>What’s inside</h2>
          <div style={{ ...styles.grid2, alignItems: "start" }} className="two-col">
            <div style={{ ...styles.card, padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Engine signals (built-in)</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <Bullet title="Demand profile" desc="Stable / Intermittent / Lumpy / Declining / New." />
                <Bullet title="Trend" desc="Last 30 vs previous 30 (normalized -1..+1)." />
                <Bullet title="Volatility" desc="Daily OUT variability (std + CV) to avoid under-ordering." />
                <Bullet title="Loss signal" desc="Scrap / reject / damage tracked separately from demand." />
              </div>
            </div>

            <div style={{ ...styles.card, padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ops-ready decisioning</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <Bullet title="Order now" desc="Below policy ROP or negative on-hand." />
                <Bullet title="Watch" desc="Near threshold band to avoid false positives." />
                <Bullet title="Reduce / Dead" desc="Overstock cover or no demand." />
                <Bullet title="Evidence chips" desc="Every decision comes with “why” in one glance." />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, ...styles.small }}>
            Warehouse column is optional. If it’s missing, the system aggregates under a default warehouse.
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="anim-in anim-delay-3" style={styles.section}>
        <div style={{ ...styles.container, padding: 0 }}>
          <h2 style={styles.h2}>Pricing</h2>
          <p style={{ margin: "0 0 18px", color: "#b7bed1", lineHeight: 1.6 }}>
            Start with Demo to validate your data. Upgrade when you need saving, sharing, exports, and multi-warehouse workflows.
          </p>

          <div style={styles.grid3} className="three-col">
            <PlanCard
              name="Demo"
              price="$0"
              note="Try the workflow"
              highlight={false}
              items={[
                "Upload CSV + preview",
                "Column mapping (required fields)",
                "Movement Type Values mapping",
                "Results table (ranked)",
                "Local-only storage (session)",
              ]}
              cta="Try Demo"
              href="/upload"
            />

            <PlanCard
              name="Pro"
              price="$29"
              note="per month"
              highlight={true}
              items={[
                "Save runs + history",
                "Export actions to CSV/PDF",
                "Advanced policy presets",
                "Custom loss tokens UI",
                "Alerts & scheduled review (coming)",
              ]}
              cta="Coming soon"
              href="#"
            />

            <PlanCard
              name="Team"
              price="$79"
              note="per month"
              highlight={false}
              items={[
                "Multi-warehouse workflows",
                "Transfer suggestions (before buying)",
                "Roles & sharing",
                "Audit trail for decisions",
                "Priority support",
              ]}
              cta="Coming soon"
              href="#"
            />
          </div>

          <div style={{ marginTop: 14, ...styles.small }}>
            Want enterprise? Add connectors + SSO + custom policy library (later).
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="anim-in anim-delay-1" style={{ ...styles.section, paddingBottom: 70 }}>
        <div style={{ ...styles.container, padding: 0 }}>
          <h2 style={styles.h2}>FAQ</h2>

          <div style={styles.grid2} className="two-col">
            <Faq
              q="Do I need a database or ERP integration?"
              a="No. The demo starts from CSV exports. Integrations can come later."
            />
            <Faq
              q="Is warehouse required?"
              a="No. Warehouse is optional. If you don’t map it, results are aggregated under a default warehouse."
            />
            <Faq
              q="Is my data stored?"
              a="Demo is session-only on your browser. Pro adds saved runs and exports."
            />
            <Faq
              q="What makes it “ops-grade”?"
              a="It’s not just averages. It uses profiles, trend, volatility, active-demand days, and loss signals — and shows evidence for every decision."
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <a className="btn-glow" href="/upload" style={styles.btnPrimary}>
              Try Demo now
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>© {new Date().getFullYear()} Inventory Decision Engine</span>
          <span style={{ fontSize: 12 }}>Next.js • Vercel • Client-only demo storage</span>
        </div>
      </footer>

      {/* Global styles */}
      <style jsx global>{`
        .bg-breathe {
          background: radial-gradient(1200px 600px at 10% 10%, rgba(110, 231, 255, 0.08), transparent 55%),
            radial-gradient(900px 500px at 90% 20%, rgba(167, 139, 250, 0.1), transparent 60%),
            linear-gradient(180deg, #0f1630, #0b0f1a);
          background-size: 140% 140%;
          animation: breathe 14s ease-in-out infinite;
          min-height: 100vh;
        }

        @keyframes breathe {
          0%,
          100% {
            background-position: 0% 0%, 100% 0%, 50% 50%;
          }
          50% {
            background-position: 10% 8%, 92% 12%, 50% 50%;
          }
        }

        .anim-in {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 700ms ease-out forwards;
        }

        .anim-delay-1 {
          animation-delay: 90ms;
        }
        .anim-delay-2 {
          animation-delay: 180ms;
        }
        .anim-delay-3 {
          animation-delay: 260ms;
        }

        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hover-lift {
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.35);
        }

        .btn-glow:hover {
          transform: translateY(-1px);
          filter: drop-shadow(0 10px 20px rgba(110, 231, 255, 0.2));
        }

        /* Responsive */
        @media (max-width: 980px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .three-col {
            grid-template-columns: 1fr !important;
          }
          .two-col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-in,
          .bg-breathe,
          .hover-lift,
          .btn-glow {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================
   Small components
========================= */

function MiniMetric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="hover-lift" style={{ padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
      <div style={{ fontSize: 12, color: "#aab1c4" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8f97ad", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function Feature({ title, desc, badge }: { title: string; desc: string; badge: string }) {
  return (
    <div className="hover-lift" style={{ borderRadius: 18, border: "1px solid #1b2340", background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <span style={{ padding: "5px 9px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#dfe3f1" }}>
          {badge}
        </span>
      </div>
      <div style={{ marginTop: 8, color: "#b7bed1", lineHeight: 1.6, fontSize: 14 }}>{desc}</div>
    </div>
  );
}

function Bullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 6, color: "#b7bed1", lineHeight: 1.6, fontSize: 14 }}>{desc}</div>
    </div>
  );
}

type Tone = "steel" | "green" | "amber" | "violet";
function Chip({ k, v, tone }: { k: string; v: string; tone: Tone }) {
  const map: Record<Tone, { bg: string; border: string; color: string }> = {
    steel: { bg: "rgba(160,174,192,0.10)", border: "rgba(160,174,192,0.22)", color: "#d7dce6" },
    green: { bg: "rgba(80,255,170,0.08)", border: "rgba(80,255,170,0.20)", color: "#c8ffe9" },
    amber: { bg: "rgba(255,196,0,0.10)", border: "rgba(255,196,0,0.25)", color: "#ffe9b3" },
    violet: { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)", color: "#e6dcff" },
  };
  const t = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {k}: {v}
    </span>
  );
}

function PlanCard({
  name,
  price,
  note,
  items,
  cta,
  href,
  highlight,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  cta: string;
  href: string;
  highlight: boolean;
}) {
  const disabled = href === "#";
  return (
    <div
      className="hover-lift"
      style={{
        borderRadius: 18,
        border: highlight ? "1px solid rgba(167,139,250,0.55)" : "1px solid #1b2340",
        background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
        padding: 18,
        boxShadow: highlight ? "0 0 0 2px rgba(110,231,255,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>{name}</div>
        {highlight && (
          <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: "rgba(110,231,255,0.08)", border: "1px solid rgba(110,231,255,0.25)", color: "#dfe3f1" }}>
            Recommended
          </span>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 34, fontWeight: 950 }}>{price}</div>
        <div style={{ color: "#aab1c4" }}>{note}</div>
      </div>

      <ul style={{ marginTop: 12, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>

      <a
        className="btn-glow"
        href={href}
        style={{
          display: "inline-block",
          marginTop: 14,
          width: "100%",
          textAlign: "center",
          padding: "11px 14px",
          borderRadius: 12,
          fontWeight: 950,
          textDecoration: "none",
          background: highlight ? "linear-gradient(135deg,#6ee7ff,#a78bfa)" : "transparent",
          color: highlight ? "#0b0f1a" : "#e6e8ee",
          border: highlight ? "none" : "1px solid #2a3350",
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {cta}
      </a>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="hover-lift" style={{ borderRadius: 18, border: "1px solid #1b2340", background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))", padding: 16 }}>
      <div style={{ fontWeight: 950 }}>{q}</div>
      <div style={{ marginTop: 8, color: "#b7bed1", lineHeight: 1.6, fontSize: 14 }}>{a}</div>
    </div>
  );
}