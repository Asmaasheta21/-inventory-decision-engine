"use client";
export default function Home() {
  return (
    <main className="bg-breathe" style={{ fontFamily: "Arial, sans-serif", color: "#e6e8ee" }}>
      {/* Top bar */}
      <div
        className="anim-in anim-delay-1"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
            }}
          />
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Inventory Decision Engine</div>
            <div style={{ fontSize: 12, color: "#aab1c4" }}>Turn a messy CSV into clear actions</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <a href="#pricing" style={linkStyle}>
            Pricing
          </a>
          <a href="#faq" style={linkStyle}>
            FAQ
          </a>
          <a
            className="btn-glow"
            href="/upload"
            style={{ ...btnStyle, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" }}
          >
            Try Demo
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="anim-in anim-delay-2" style={{ padding: "58px 20px 30px" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 26,
          }}
        >
          <div>
            <div style={pillStyle}>⚡ Inventory Decisions in Minutes</div>
            <h1 style={{ margin: "14px 0 10px", fontSize: 44, lineHeight: 1.12, letterSpacing: -0.6 }}>
              Stop guessing.
              <br />
              Know what to reorder, hold, or liquidate.
            </h1>
            <p style={{ margin: 0, maxWidth: 540, color: "#b7bed1", fontSize: 16, lineHeight: 1.7 }}>
              Upload your inventory &amp; sales CSV and get a clean priority list:
              <b style={{ color: "#e6e8ee" }}> stockout risk</b>, <b style={{ color: "#e6e8ee" }}> overstock</b>,{" "}
              <b style={{ color: "#e6e8ee" }}> dead inventory</b>, and suggested actions.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a
                className="btn-glow"
                href="/upload"
                style={{ ...btnStyle, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" }}
              >
                Upload CSV (Demo)
              </a>
              <a
                href="#how"
                style={{ ...btnStyle, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" }}
              >
                See how it works
              </a>
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 14, flexWrap: "wrap", color: "#aab1c4", fontSize: 13 }}>
              <span>✅ No install</span>
              <span>✅ Works on Excel exports</span>
              <span>✅ Built for ops + procurement</span>
            </div>
          </div>

          {/* Mock dashboard */}
          <div className="hover-lift anim-in anim-delay-3" style={{ ...cardStyle, padding: 16, alignSelf: "start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Today’s Risk Snapshot</div>
              <div style={{ fontSize: 12, color: "#aab1c4" }}>Demo</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Metric title="Stockout Risk" value="18 SKUs" hint="Next 14 days" />
              <Metric title="Overstock" value="42 SKUs" hint="> 90 days cover" />
              <Metric title="Cash Tied" value="$12.4k" hint="Slow movers" />
              <Metric title="Quick Wins" value="7 actions" hint="Reduce waste" />
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                border: "1px solid #202946",
                background: "rgba(20,27,48,0.55)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top Actions</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                <li>
                  Reorder <b>SKU-102</b> (lead time 7d)
                </li>
                <li>
                  Discount <b>SKU-088</b> (overstock 120d)
                </li>
                <li>
                  Freeze buying <b>SKU-055</b> (low velocity)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="anim-in anim-delay-1" style={{ padding: "18px 20px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", color: "#8f97ad", fontSize: 13 }}>
          Built for teams that deal with Excel exports, warehouses, and real constraints.
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="anim-in anim-delay-2" style={{ padding: "44px 20px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 28 }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <Step n="1" title="Upload" desc="Export from Excel and upload CSV." />
            <Step n="2" title="Analyze" desc="Compute cover, velocity, risks, and actions." />
            <Step n="3" title="Decide" desc="Get a priority list you can share immediately." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="anim-in anim-delay-3" style={{ padding: "44px 20px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 28 }}>Pricing</h2>
          <p style={{ margin: "0 0 18px", color: "#b7bed1", lineHeight: 1.6 }}>
            Start free. Upgrade when you want multi-warehouse + saved reports.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <PriceCard
              name="Free Demo"
              price="$0"
              note="For testing the idea"
              items={["Upload CSV", "Basic risk flags", "Top actions list"]}
              cta="Try Demo"
              href="/upload"
              highlight={false}
            />
            <PriceCard
              name="Pro"
              price="$19"
              note="per month"
              items={["Saved runs", "Export actions to CSV", "Filters + thresholds"]}
              cta="Coming soon"
              href="#"
              highlight={true}
            />
            <PriceCard
              name="Team"
              price="$49"
              note="per month"
              items={["Multi-warehouse", "Roles & sharing", "Priority support"]}
              cta="Coming soon"
              href="#"
              highlight={false}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="anim-in anim-delay-1" style={{ padding: "44px 20px 70px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 28 }}>FAQ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Faq q="Do I need to connect a database?" a="No. Start with CSV exports. We can add database connectors later." />
            <Faq q="Is my data stored?" a="In the demo version, we can keep it in-memory only. Saved runs come in Pro." />
            <Faq
              q="What CSV format is required?"
              a="We’ll support a simple template: SKU, on_hand, avg_daily_sales, lead_time_days (we’ll ship a sample file)."
            />
            <Faq q="Can I share results with my team?" a="Yes. Pro/Team will include export and shareable links." />
          </div>

          <div style={{ marginTop: 18 }}>
            <a
              className="btn-glow"
              href="/upload"
              style={{ ...btnStyle, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" }}
            >
              Upload CSV (Demo)
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1b2340", padding: "18px 20px", color: "#8f97ad" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>© {new Date().getFullYear()} Inventory Decision Engine</span>
          <span style={{ fontSize: 12 }}>Built on Next.js + Vercel</span>
        </div>
      </footer>

      {/* Global styles for subtle animations */}
      <style jsx global>{`
        .bg-breathe {
          background: radial-gradient(1200px 600px at 10% 10%, rgba(110, 231, 255, 0.08), transparent 55%),
            radial-gradient(900px 500px at 90% 20%, rgba(167, 139, 250, 0.1), transparent 60%),
            linear-gradient(180deg, #0f1630, #0b0f1a);
          background-size: 140% 140%;
          animation: breathe 14s ease-in-out infinite;
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

        .btn-glow {
          transition: transform 150ms ease, filter 150ms ease;
        }
        .btn-glow:hover {
          transform: translateY(-1px);
          filter: drop-shadow(0 10px 20px rgba(110, 231, 255, 0.2));
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

/* ---------- Small components (no extra libraries) ---------- */

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="hover-lift" style={{ padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
      <div style={{ fontSize: 12, color: "#aab1c4" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8f97ad", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="hover-lift" style={{ ...cardStyle, padding: 16 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          background: "rgba(110,231,255,0.12)",
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
        }}
      >
        {n}
      </div>
      <div style={{ marginTop: 10, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 6, color: "#b7bed1", lineHeight: 1.6, fontSize: 14 }}>{desc}</div>
    </div>
  );
}

function PriceCard({
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
  return (
    <div
      className="hover-lift"
      style={{
        ...cardStyle,
        padding: 18,
        border: highlight ? "1px solid rgba(167,139,250,0.55)" : cardStyle.border,
        boxShadow: highlight ? "0 0 0 2px rgba(110,231,255,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900 }}>{name}</div>
        {highlight && <span style={pillStyle}>Most popular</span>}
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
          ...btnStyle,
          display: "inline-block",
          marginTop: 14,
          width: "100%",
          textAlign: "center",
          background: highlight ? "linear-gradient(135deg,#6ee7ff,#a78bfa)" : "transparent",
          color: highlight ? "#0b0f1a" : "#e6e8ee",
          border: highlight ? "none" : "1px solid #2a3350",
          pointerEvents: href === "#" ? "none" : "auto",
          opacity: href === "#" ? 0.6 : 1,
        }}
      >
        {cta}
      </a>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="hover-lift" style={{ ...cardStyle, padding: 16 }}>
      <div style={{ fontWeight: 900 }}>{q}</div>
      <div style={{ marginTop: 8, color: "#b7bed1", lineHeight: 1.6, fontSize: 14 }}>{a}</div>
    </div>
  );
}

/* ---------- Styles ---------- */

const cardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid #1b2340",
  background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  textDecoration: "none",
};

const linkStyle: React.CSSProperties = {
  color: "#b7bed1",
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid transparent",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  color: "#dfe3f1",
  border: "1px solid rgba(110,231,255,0.25)",
  background: "rgba(110,231,255,0.08)",
};