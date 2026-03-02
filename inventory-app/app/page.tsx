"use client";

import type { CSSProperties } from "react";

type MetricProps = {
  title: string;
  value: string;
  hint: string;
};

type PriceCardProps = {
  name: string;
  price: string;
  items: string[];
  cta: string;
  href: string;
  highlight?: boolean;
};

export default function Home() {
  return (
    <main className="bg-breathe" style={mainContainerStyle}>
      {/* Top bar */}
      <nav
        className="anim-in anim-delay-1"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 15,
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
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Inventory Decision Engine
            </div>
            <div style={{ fontSize: 12, color: "#aab1c4" }}>
              Turn a messy CSV into clear actions
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="#pricing" style={linkStyle}>
            Pricing
          </a>
          <a href="#faq" style={linkStyle}>
            FAQ
          </a>
          <a
            className="btn-glow"
            href="/upload"
            style={{
              ...btnStyle,
              background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
              color: "#0b0f1a",
            }}
          >
            Try Demo
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="anim-in anim-delay-2" style={{ padding: "58px 20px 30px" }}>
        <div
          className="grid-responsive"
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "grid",
            gap: 30,
          }}
        >
          <div>
            <div style={pillStyle}>⚡ Inventory Decisions in Minutes</div>
            <h1 style={{ margin: "14px 0 10px", fontSize: 40, lineHeight: 1.12, letterSpacing: -0.6 }}>
              Stop guessing.
              <br />
              Know what to reorder.
            </h1>
            <p style={{ margin: "0 0 20px", maxWidth: 540, color: "#b7bed1", fontSize: 16, lineHeight: 1.7 }}>
              Upload your inventory &amp; sales CSV and get a clean priority list.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a
                className="btn-glow"
                href="/upload"
                style={{
                  ...btnStyle,
                  background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
                  color: "#0b0f1a",
                }}
              >
                Upload CSV (Demo)
              </a>
            </div>
          </div>

          {/* Mock dashboard */}
          <div className="hover-lift" style={{ ...cardStyle, padding: 16 }}>
            <Metric title="Stockout Risk" value="18 SKUs" hint="Next 14 days" />
            <div style={{ marginTop: 10 }}>
              <Metric title="Overstock" value="42 SKUs" hint="> 90 days cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "60px 20px" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
          }}
        >
          <PriceCard
            name="Free"
            price="$0"
            items={["CSV upload", "Basic flags"]}
            cta="Try Demo"
            href="/upload"
          />
          <PriceCard
            name="Pro"
            price="$19"
            items={["Saved runs", "History"]}
            cta="Soon"
            href="#"
            highlight
          />
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #1b2340",
          padding: "30px 20px",
          color: "#8f97ad",
          textAlign: "center",
        }}
      >
        <span>© {new Date().getFullYear()} Inventory Engine</span>
      </footer>

      {/* CSS */}
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background: #0b0f1a;
        }
        .bg-breathe {
          min-height: 100vh;
          background: linear-gradient(180deg, #0f1630, #0b0f1a);
        }
        .anim-in {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeUp 700ms ease-out forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hover-lift {
          transition: all 250ms ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
        }
        .btn-glow:hover {
          filter: brightness(1.1);
        }
        @media (max-width: 850px) {
          .grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

/* Components */
function Metric({ title, value, hint }: MetricProps) {
  return (
    <div style={{ padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
      <div style={{ fontSize: 11, color: "#aab1c4" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6e778d" }}>{hint}</div>
    </div>
  );
}

function PriceCard({ name, price, items, cta, href, highlight = false }: PriceCardProps) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 25,
        border: highlight ? "2px solid #a78bfa" : "1px solid #1b2340",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
      <div style={{ fontSize: 30, fontWeight: 900, margin: "10px 0" }}>{price}</div>

      <ul style={{ margin: "0 0 14px", paddingLeft: 18, color: "#b7bed1", lineHeight: 1.7 }}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>

      <a
        href={href}
        style={{
          ...btnStyle,
          display: "block",
          textAlign: "center",
          background: highlight ? "#a78bfa" : "#1b2340",
          color: highlight ? "#000" : "#fff",
          pointerEvents: href === "#" ? "none" : "auto",
          opacity: href === "#" ? 0.6 : 1,
        }}
      >
        {cta}
      </a>
    </div>
  );
}

/* Styles */
const mainContainerStyle: CSSProperties = { fontFamily: "sans-serif", color: "#e6e8ee" };
const cardStyle: CSSProperties = { borderRadius: 20, border: "1px solid #1b2340", background: "rgba(18,24,43,0.8)" };
const btnStyle: CSSProperties = { padding: "10px 20px", borderRadius: 12, fontWeight: 800, textDecoration: "none" };
const linkStyle: CSSProperties = { color: "#b7bed1", textDecoration: "none", fontSize: 14 };
const pillStyle: CSSProperties = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: 99,
  fontSize: 12,
  background: "rgba(110,231,255,0.1)",
  border: "1px solid rgba(110,231,255,0.2)",
};