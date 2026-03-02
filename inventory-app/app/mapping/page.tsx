"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadUpload, saveMapping, Mapping } from "@/lib/demoStore";

export default function MappingPage() {
  const router = useRouter();
  const data = typeof window !== "undefined" ? loadUpload() : null;

  const headers = data?.headers ?? [];
  const sampleRows = data?.rows?.slice(0, 6) ?? [];
  const meta = data?.meta;

  // smart-ish defaults (try to auto-pick common column names)
  const guess = (candidates: string[]) =>
    headers.find((h) => candidates.includes(h.toLowerCase().trim())) ?? "";

  const [sku, setSku] = useState<string>(guess(["sku", "item", "item_code", "material", "material_id"]) || headers[0] || "");
  const [onHand, setOnHand] = useState<string>(guess(["on_hand", "stock", "qty", "quantity", "balance"]) || headers[1] || "");
  const [sales30d, setSales30d] = useState<string>(guess(["sales_30d", "sales", "sold_30d", "qty_sold_30d"]) || headers[2] || "");
  const [warehouse, setWarehouse] = useState<string>(guess(["warehouse", "wh", "location", "storage_location", "plant"]) || "");

  const [error, setError] = useState<string>("");

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btn: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
      border: "none",
    };

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as React.CSSProperties,
      container: { maxWidth: 1080, margin: "0 auto", padding: "18px 20px 60px" } as React.CSSProperties,
      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      } as React.CSSProperties,
      brand: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as React.CSSProperties,
      title: { fontWeight: 900, letterSpacing: 0.2 } as React.CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      link: { color: "#b7bed1", textDecoration: "none", padding: "8px 10px", borderRadius: 10, border: "1px solid transparent" } as React.CSSProperties,

      hero: { display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 } as React.CSSProperties,

      card,
      cardPad: { ...card, padding: 18 } as React.CSSProperties,

      pill: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#dfe3f1",
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
      } as React.CSSProperties,

      h1: { margin: "10px 0 8px", fontSize: 30, lineHeight: 1.15 } as React.CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as React.CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 } as React.CSSProperties,

      field: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      label: { fontSize: 12, color: "#aab1c4", marginBottom: 8 } as React.CSSProperties,
      select: { width: "100%", padding: "10px 10px", borderRadius: 12, border: "1px solid #2a3350", background: "#0b0f1a", color: "#e6e8ee" } as React.CSSProperties,
      hint: { marginTop: 8, fontSize: 12, color: "#8f97ad", lineHeight: 1.5 } as React.CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as React.CSSProperties,

      btnPrimary: { ...btn, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as React.CSSProperties,
      btnGhost: { ...btn, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as React.CSSProperties,

      error: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as React.CSSProperties,

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 } as React.CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as React.CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as React.CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as React.CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as React.CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0" } as React.CSSProperties,
      note: { marginTop: 12, fontSize: 12, color: "#8f97ad" } as React.CSSProperties,

      badge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
        color: "#dfe3f1",
      } as React.CSSProperties,
    };
  }, []);

  if (!data) {
    return (
      <div style={styles.wrap}>
        <div className="bg-breathe" style={{ minHeight: "100vh" }}>
          <div style={styles.container}>
            <div style={styles.cardPad}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Mapping</h1>
              <p style={{ marginTop: 10, color: "#b7bed1", lineHeight: 1.7 }}>
                No uploaded CSV found. Go to Upload first.
              </p>
              <a className="btn-glow" href="/upload" style={styles.btnPrimary as any}>
                Go to Upload
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function validate() {
    setError("");

    if (!sku || !onHand || !sales30d) {
      setError("Please map SKU, On Hand, and Sales (30d).");
      return false;
    }

    const required = [sku, onHand, sales30d];
    if (new Set(required).size !== required.length) {
      setError("SKU / On Hand / Sales must be different columns.");
      return false;
    }

    return true;
  }

  function continueToResults() {
    if (!validate()) return;

    const mapping: Mapping = { sku, onHand, sales30d, warehouse: warehouse || undefined };
    saveMapping(mapping);
    router.push("/results");
  }

  const fileLabel = meta?.fileName ? meta.fileName : "Uploaded CSV";
  const rowsTotal = meta?.rowCount ?? data.rows.length;

  return (
    <div style={styles.wrap}>
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory Decision Engine</div>
                <div style={styles.subtitle}>Demo • Column Mapping</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>
              <a href="/upload" style={styles.link}>
                Upload
              </a>
            </div>
          </div>

          <div style={styles.hero}>
            {/* Left: Mapping */}
            <div className="anim-in anim-delay-2" style={styles.cardPad}>
              <span style={styles.pill}>🧩 Column Mapping</span>
              <h1 style={styles.h1}>Tell us what each column means</h1>
              <p style={styles.p}>
                Companies don’t have the same file format. This step makes the demo work with almost any CSV.
              </p>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={styles.badge}>{fileLabel}</span>
                <span style={{ fontSize: 12, color: "#8f97ad" }}>
                  {headers.length} columns • {rowsTotal} rows
                </span>
              </div>

              <div style={styles.grid}>
                <Field
                  label="SKU / Item code"
                  value={sku}
                  setValue={setSku}
                  headers={headers}
                  styles={styles}
                  hint="The unique identifier of the product/material."
                />
                <Field
                  label="On Hand (current stock)"
                  value={onHand}
                  setValue={setOnHand}
                  headers={headers}
                  styles={styles}
                  hint="Current available quantity in stock."
                />
                <Field
                  label="Sales (last 30 days)"
                  value={sales30d}
                  setValue={setSales30d}
                  headers={headers}
                  styles={styles}
                  hint="Total sold quantity in the last 30 days."
                />
                <Field
                  label="Warehouse (optional)"
                  value={warehouse}
                  setValue={setWarehouse}
                  headers={["", ...headers]}
                  styles={styles}
                  hint="If you have multiple warehouses/locations, map it here."
                  allowNone
                />
              </div>

              <div style={styles.row}>
                <button className="btn-glow" style={styles.btnGhost} type="button" onClick={() => router.push("/upload")}>
                  Back
                </button>
                <button className="btn-glow" style={styles.btnPrimary} type="button" onClick={continueToResults}>
                  Continue to Results
                </button>
              </div>

              {error ? <div style={styles.error}>{error}</div> : null}

              <div style={styles.note}>
                Tip: If you don’t have warehouse column, choose “— none —”.
              </div>
            </div>

            {/* Right: Preview */}
            <div className="hover-lift anim-in anim-delay-3" style={styles.cardPad}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Preview</div>
                <div style={{ fontSize: 12, color: "#aab1c4" }}>First 6 rows</div>
              </div>

              <div style={styles.kpiGrid}>
                <KPI title="Mapped fields" value={`${[sku, onHand, sales30d].filter(Boolean).length}/3`} styles={styles} />
                <KPI title="Optional" value={warehouse ? "Warehouse ✓" : "No warehouse"} styles={styles} />
                <KPI title="Next" value="Results" styles={styles} />
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {headers.slice(0, 6).map((h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((r, idx) => (
                      <tr key={idx} style={styles.tr}>
                        {headers.slice(0, 6).map((h) => (
                          <td key={h} style={styles.td}>
                            {r[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={styles.note}>Preview shows first 6 columns only for speed.</div>
              </div>
            </div>
          </div>

          {/* Global styles (same vibe as landing/upload) */}
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
              animation: fadeUp 650ms ease-out forwards;
            }

            .anim-delay-1 {
              animation-delay: 80ms;
            }
            .anim-delay-2 {
              animation-delay: 160ms;
            }
            .anim-delay-3 {
              animation-delay: 240ms;
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
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  headers,
  styles,
  hint,
  allowNone,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  headers: string[];
  styles: any;
  hint: string;
  allowNone?: boolean;
}) {
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      <select style={styles.select} value={value} onChange={(e) => setValue(e.target.value)}>
        {headers.map((h) => (
          <option key={h || "__none"} value={h}>
            {h || (allowNone ? "— none —" : "—")}
          </option>
        ))}
      </select>
      <div style={styles.hint}>{hint}</div>
    </div>
  );
}

function KPI({ title, value, styles }: { title: string; value: any; styles: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}