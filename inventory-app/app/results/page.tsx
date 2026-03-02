"use client";

import { useMemo, useState } from "react";
import {
  loadMapping,
  loadThresholds,
  loadUpload,
  saveThresholds,
  toNumber,
} from "@/lib/demoStore";

type Decision = "ORDER_NOW" | "WATCH" | "REDUCE" | "DEAD" | "HEALTHY";

type RowOut = {
  sku: string;
  warehouse: string;

  onHand: number;
  sales30d: number;

  avgDaily: number;
  daysCover: number;

  reorderPoint: number;
  suggestedOrder: number;

  decision: Decision;
  severity: number; // 0..100
  reason: string;
  tips: string[];
};

type Thresholds = {
  leadTimeDays: number;
  safetyDays: number;
  overstockDays: number;
};

export default function ResultsPage() {
  const upload = typeof window !== "undefined" ? loadUpload() : null;
  const mapping = typeof window !== "undefined" ? loadMapping() : null;

  const initialT =
    typeof window !== "undefined"
      ? loadThresholds()
      : { leadTimeDays: 7, safetyDays: 7, overstockDays: 90 };

  const [leadTimeDays, setLeadTimeDays] = useState<number>(initialT.leadTimeDays);
  const [safetyDays, setSafetyDays] = useState<number>(initialT.safetyDays);
  const [overstockDays, setOverstockDays] = useState<number>(initialT.overstockDays);

  // ✅ NEW: policy preset
  const [preset, setPreset] = useState<
    "CUSTOM" | "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE"
  >("CUSTOM");

  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<
    "SEVERITY" | "SUGGESTED" | "COVER_ASC" | "COVER_DESC"
  >("SEVERITY");

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background:
        "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btnBase: React.CSSProperties = {
      padding: "10px 14px",
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
      whiteSpace: "nowrap",
    };

    const input: React.CSSProperties = {
      width: "100%",
      marginTop: 8,
      padding: "10px 10px",
      borderRadius: 12,
      border: "1px solid #2a3350",
      background: "#0b0f1a",
      color: "#e6e8ee",
      outline: "none",
    };

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as React.CSSProperties,
      container: { maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px" } as React.CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      } as React.CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
      logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
      } as React.CSSProperties,
      title: { fontWeight: 950, letterSpacing: 0.2 } as React.CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      } as React.CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 } as React.CSSProperties,
      card,
      cardPad: { ...card, padding: 18 } as React.CSSProperties,

      h1: { margin: 0, fontSize: 26, fontWeight: 950 } as React.CSSProperties,
      p: { margin: "8px 0 0", color: "#b7bed1", lineHeight: 1.7 } as React.CSSProperties,

      badge: (tone: "cyan" | "amber" | "green" | "red" | "violet") => {
        const map = {
          cyan: { b: "rgba(110,231,255,0.25)", bg: "rgba(110,231,255,0.08)", c: "#dfe3f1" },
          amber: { b: "rgba(255,170,70,0.28)", bg: "rgba(255,170,70,0.10)", c: "#ffd9a8" },
          green: { b: "rgba(120,255,170,0.25)", bg: "rgba(120,255,170,0.08)", c: "#c7ffe0" },
          red: { b: "rgba(255,80,80,0.25)", bg: "rgba(255,80,80,0.08)", c: "#ffd4d4" },
          violet: { b: "rgba(167,139,250,0.28)", bg: "rgba(167,139,250,0.10)", c: "#e6dcff" },
        }[tone];

        return {
          display: "inline-block",
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 950,
          border: `1px solid ${map.b}`,
          background: map.bg,
          color: map.c,
        } as React.CSSProperties;
      },

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 } as React.CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      kpiT: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      kpiV: { fontSize: 22, fontWeight: 950, marginTop: 6 } as React.CSSProperties,
      kpiS: { fontSize: 12, color: "#8f97ad", marginTop: 4, lineHeight: 1.4 } as React.CSSProperties,

      controls: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 } as React.CSSProperties,
      box: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      label: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      input,
      select: { ...input, marginTop: 8 } as React.CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" } as React.CSSProperties,
      btnPrimary: { ...btnBase, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as React.CSSProperties,
      btnGhost: { ...btnBase, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as React.CSSProperties,

      tableWrap: { marginTop: 12, overflowX: "auto" } as React.CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as React.CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 900, padding: "0 10px" } as React.CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0", verticalAlign: "top" } as React.CSSProperties,

      sevBar: {
        height: 8,
        borderRadius: 999,
        border: "1px solid #202946",
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      } as React.CSSProperties,

      sevFill: (sev: number) =>
        ({
          width: `${sev}%`,
          height: "100%",
          background:
            sev >= 80
              ? "rgba(255,80,80,0.70)"
              : sev >= 60
              ? "rgba(255,170,70,0.70)"
              : sev >= 40
              ? "rgba(167,139,250,0.70)"
              : "rgba(110,231,255,0.70)",
        } as React.CSSProperties),

      muted: { fontSize: 12, color: "#8f97ad", lineHeight: 1.4 } as React.CSSProperties,

      locked: {
        marginTop: 14,
        padding: 16,
        borderRadius: 16,
        border: "1px solid rgba(167,139,250,0.28)",
        background: "rgba(167,139,250,0.08)",
        position: "relative",
        overflow: "hidden",
      } as React.CSSProperties,

      lockTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 } as React.CSSProperties,
      lockTitle: { fontWeight: 950 } as React.CSSProperties,

      blur: { filter: "blur(6px)", opacity: 0.75 } as React.CSSProperties,

      lockBtn: { ...btnBase, background: "linear-gradient(135deg,#a78bfa,#6ee7ff)", color: "#0b0f1a" } as React.CSSProperties,
    };
  }, []);

  if (!upload || !mapping) {
    return (
      <div style={styles.wrap}>
        <div className="bg-breathe" style={{ minHeight: "100vh" }}>
          <div style={styles.container}>
            <div style={styles.cardPad}>
              <h1 style={styles.h1}>Ops Control</h1>
              <p style={styles.p}>Missing demo data. Start from Upload.</p>
              <a className="btn-glow" href="/upload" style={styles.btnPrimary as any}>
                Go to Upload
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const thresholds: Thresholds = { leadTimeDays, safetyDays, overstockDays };
  const allRows = buildResults(upload.rows, mapping, thresholds);

  const warehouses = Array.from(new Set(allRows.map((r) => r.warehouse))).sort();
  const filtered = applyFilters(allRows, warehouseFilter, decisionFilter, search);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "SEVERITY") return b.severity - a.severity;
    if (sort === "SUGGESTED") return b.suggestedOrder - a.suggestedOrder;
    if (sort === "COVER_ASC") return a.daysCover - b.daysCover;
    return b.daysCover - a.daysCover;
  });

  const kpi = computeKPIs(allRows);

  // ✅ NEW: presets handlers
  function applyPreset(p: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") {
    setPreset(p);

    if (p === "CONSERVATIVE") {
      setLeadTimeDays(14);
      setSafetyDays(14);
      setOverstockDays(75);
      return;
    }
    if (p === "BALANCED") {
      setLeadTimeDays(10);
      setSafetyDays(10);
      setOverstockDays(90);
      return;
    }
    // AGGRESSIVE
    setLeadTimeDays(7);
    setSafetyDays(5);
    setOverstockDays(120);
  }

  function onManualChange() {
    if (preset !== "CUSTOM") setPreset("CUSTOM");
  }

  function saveT() {
    saveThresholds({ leadTimeDays, safetyDays, overstockDays });
  }

  function exportCSV() {
    const header = [
      "sku",
      "warehouse",
      "decision",
      "severity",
      "suggested_order",
      "on_hand",
      "sales_30d",
      "avg_daily",
      "days_cover",
      "reason",
    ];
    const lines = [header.join(",")];

    for (const r of sorted) {
      lines.push(
        [
          csvSafe(r.sku),
          csvSafe(r.warehouse),
          r.decision,
          r.severity.toString(),
          r.suggestedOrder.toString(),
          r.onHand.toString(),
          r.sales30d.toString(),
          round2(r.avgDaily).toString(),
          round2(r.daysCover).toString(),
          csvSafe(r.reason),
        ].join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_actions_demo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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
                <div style={styles.subtitle}>Senior Ops Control • Demo</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>Home</a>
              <a href="/upload" style={styles.link}>Upload</a>
              <a href="/mapping" style={styles.link}>Mapping</a>
            </div>
          </div>

          <div style={styles.grid}>
            {/* LEFT */}
            <div className="anim-in anim-delay-2" style={styles.cardPad}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <h1 style={styles.h1}>Ops Control Panel</h1>
                  <p style={styles.p}>
                    Prioritized actions using lead time, safety days, cover, slow movers, and zero-sales detection.
                  </p>
                </div>
                <span style={styles.badge(kpi.alertScore >= 70 ? "red" : kpi.alertScore >= 45 ? "amber" : "cyan")}>
                  Alert Score: {kpi.alertScore}/100
                </span>
              </div>

              <div style={styles.kpiGrid}>
                <KPI title="Immediate Order" value={kpi.orderNow} sub="Likely stockout before lead time" styles={styles} />
                <KPI title="Watchlist" value={kpi.watch} sub="Close to reorder point" styles={styles} />
                <KPI title="Reduce / Promo" value={kpi.reduce} sub="Overstock / slow movers" styles={styles} />
                <KPI title="Dead Stock" value={kpi.dead} sub="No sales + stock present" styles={styles} />
              </div>

              {/* ✅ NEW: Presets UI */}
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={styles.badge("violet")}>Policy Presets</span>

                <button
                  className="btn-glow"
                  type="button"
                  style={{
                    ...styles.btnGhost,
                    border: preset === "CONSERVATIVE" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
                  }}
                  onClick={() => applyPreset("CONSERVATIVE")}
                >
                  Conservative
                </button>

                <button
                  className="btn-glow"
                  type="button"
                  style={{
                    ...styles.btnGhost,
                    border: preset === "BALANCED" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
                  }}
                  onClick={() => applyPreset("BALANCED")}
                >
                  Balanced
                </button>

                <button
                  className="btn-glow"
                  type="button"
                  style={{
                    ...styles.btnGhost,
                    border: preset === "AGGRESSIVE" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
                  }}
                  onClick={() => applyPreset("AGGRESSIVE")}
                >
                  Aggressive
                </button>

                <span style={{ fontSize: 12, color: "#8f97ad" }}>
                  Current: <b style={{ color: "#e6e8ee" }}>{preset}</b>
                </span>
              </div>

              {/* Threshold controls */}
              <div style={styles.controls}>
                <div style={styles.box}>
                  <div style={styles.label}>Lead time (days)</div>
                  <input
                    style={styles.input}
                    type="number"
                    value={leadTimeDays}
                    onChange={(e) => {
                      onManualChange();
                      setLeadTimeDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>Used to predict stockout risk window.</div>
                </div>

                <div style={styles.box}>
                  <div style={styles.label}>Safety days</div>
                  <input
                    style={styles.input}
                    type="number"
                    value={safetyDays}
                    onChange={(e) => {
                      onManualChange();
                      setSafetyDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>Buffers demand uncertainty (simple).</div>
                </div>

                <div style={styles.box}>
                  <div style={styles.label}>Overstock threshold (days cover)</div>
                  <input
                    style={styles.input}
                    type="number"
                    value={overstockDays}
                    onChange={(e) => {
                      onManualChange();
                      setOverstockDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>If cover is huge → reduce / freeze buying.</div>
                </div>
              </div>

              {/* Filters */}
              <div style={styles.row}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={styles.label}>Search SKU</div>
                  <input
                    style={styles.input}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="e.g. SKU-102"
                  />
                </div>

                <div style={{ minWidth: 220 }}>
                  <div style={styles.label}>Warehouse</div>
                  <select style={styles.select} value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                    <option value="ALL">All</option>
                    {warehouses.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 220 }}>
                  <div style={styles.label}>Decision</div>
                  <select
                    style={styles.select}
                    value={decisionFilter}
                    onChange={(e) => setDecisionFilter(e.target.value as any)}
                  >
                    <option value="ALL">All</option>
                    <option value="ORDER_NOW">ORDER_NOW</option>
                    <option value="WATCH">WATCH</option>
                    <option value="REDUCE">REDUCE</option>
                    <option value="DEAD">DEAD</option>
                    <option value="HEALTHY">HEALTHY</option>
                  </select>
                </div>

                <div style={{ minWidth: 220 }}>
                  <div style={styles.label}>Sort</div>
                  <select style={styles.select} value={sort} onChange={(e) => setSort(e.target.value as any)}>
                    <option value="SEVERITY">Severity (high→low)</option>
                    <option value="SUGGESTED">Suggested order (high→low)</option>
                    <option value="COVER_ASC">Days cover (low→high)</option>
                    <option value="COVER_DESC">Days cover (high→low)</option>
                  </select>
                </div>
              </div>

              <div style={styles.row}>
                <button className="btn-glow" style={styles.btnGhost} onClick={saveT} type="button">
                  Save thresholds
                </button>
                <button className="btn-glow" style={styles.btnPrimary} onClick={exportCSV} type="button">
                  Export Action Queue (CSV)
                </button>
                <span style={styles.muted}>
                  Showing {Math.min(sorted.length, 250)} of {filtered.length} (filtered)
                </span>
              </div>

              {/* Action Queue */}
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>SKU</th>
                      <th style={styles.th}>WH</th>
                      <th style={styles.th}>Decision</th>
                      <th style={styles.th}>Severity</th>
                      <th style={styles.th}>Suggested</th>
                      <th style={styles.th}>On Hand</th>
                      <th style={styles.th}>Sales 30d</th>
                      <th style={styles.th}>Days Cover</th>
                      <th style={styles.th}>Reason + Tip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, 250).map((r, idx) => (
                      <tr key={idx} style={styles.tr}>
                        <td style={styles.td}><b>{r.sku}</b></td>
                        <td style={styles.td}>{r.warehouse}</td>
                        <td style={styles.td}>
                          <span style={decisionBadge(styles, r.decision)}>{r.decision}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 44, fontWeight: 950 }}>{r.severity}</div>
                            <div style={{ flex: 1, minWidth: 120, ...styles.sevBar }}>
                              <div style={styles.sevFill(r.severity)} />
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>{r.suggestedOrder}</td>
                        <td style={styles.td}>{r.onHand}</td>
                        <td style={styles.td}>{r.sales30d}</td>
                        <td style={styles.td}>{round2(r.daysCover)}</td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{r.reason}</div>
                          <div style={styles.muted}>{r.tips[0] ?? "—"}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 10, ...styles.muted }}>
                  Demo note: table limited to first 250 rows for performance.
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="hover-lift anim-in anim-delay-3" style={styles.cardPad}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Ops Insights</div>
                <span style={styles.badge("violet")}>Advisor</span>
              </div>

              <div style={{ marginTop: 12, lineHeight: 1.7, color: "#b7bed1" }}>
                {renderOpsNarrative(kpi, thresholds)}
              </div>

              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Quick Recommendations</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                  {kpi.recommendations.map((x: string) => <li key={x}>{x}</li>)}
                </ul>
              </div>

              {/* Pro locked blocks */}
              <div style={styles.locked}>
                <div style={styles.lockTop}>
                  <div>
                    <div style={styles.lockTitle}>Pro: Multi-warehouse balancing</div>
                    <div style={styles.muted}>Suggest transfers between warehouses + shortage prevention.</div>
                  </div>
                  <button className="btn-glow" style={styles.lockBtn} type="button">
                    Upgrade to Pro
                  </button>
                </div>
                <div style={{ marginTop: 12, ...styles.blur }}>
                  <div style={{ fontWeight: 900 }}>Transfer Suggestions</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                    <li>Move 120 units of SKU-088 from WH-A → WH-B (prevent stockout)</li>
                    <li>Consolidate slow movers to reduce holding cost</li>
                  </ul>
                </div>
              </div>

              <div style={styles.locked}>
                <div style={styles.lockTop}>
                  <div>
                    <div style={styles.lockTitle}>Pro: Policy-based ordering</div>
                    <div style={styles.muted}>MOQ, case pack, service level, supplier lead-time variability.</div>
                  </div>
                  <button className="btn-glow" style={styles.lockBtn} type="button">
                    Unlock Policies
                  </button>
                </div>
                <div style={{ marginTop: 12, ...styles.blur }}>
                  <div style={{ fontWeight: 900 }}>Recommended Policy</div>
                  <div style={styles.muted}>
                    (s,S) with service level 95%, dynamic safety stock, EOQ override for fast movers.
                  </div>
                </div>
              </div>

              <div style={styles.locked}>
                <div style={styles.lockTop}>
                  <div>
                    <div style={styles.lockTitle}>Pro: Root-cause diagnostics</div>
                    <div style={styles.muted}>Detect demand shifts, promo spikes, bad master data patterns.</div>
                  </div>
                  <button className="btn-glow" style={styles.lockBtn} type="button">
                    Enable Diagnostics
                  </button>
                </div>
                <div style={{ marginTop: 12, ...styles.blur }}>
                  <div style={{ fontWeight: 900 }}>Anomalies</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                    <li>SKU-055: sales spike likely promo → keep higher safety days for 2 weeks</li>
                    <li>SKU-019: zero stock but sales present → likely stockout (lost sales)</li>
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: 12, ...styles.muted }}>
                Pro blocks are UI placeholders for now. Later we connect them to real calculations + payment.
              </div>
            </div>
          </div>

          <style jsx global>{`
            .bg-breathe {
              background: radial-gradient(1200px 600px at 10% 10%, rgba(110, 231, 255, 0.08), transparent 55%),
                radial-gradient(900px 500px at 90% 20%, rgba(167, 139, 250, 0.1), transparent 60%),
                linear-gradient(180deg, #0f1630, #0b0f1a);
              background-size: 140% 140%;
              animation: breathe 14s ease-in-out infinite;
            }
            @keyframes breathe {
              0%, 100% { background-position: 0% 0%, 100% 0%, 50% 50%; }
              50% { background-position: 10% 8%, 92% 12%, 50% 50%; }
            }
            .anim-in { opacity: 0; transform: translateY(10px); animation: fadeUp 650ms ease-out forwards; }
            .anim-delay-1 { animation-delay: 80ms; }
            .anim-delay-2 { animation-delay: 160ms; }
            .anim-delay-3 { animation-delay: 240ms; }
            @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
            .hover-lift { transition: transform 200ms ease, box-shadow 200ms ease; }
            .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 40px rgba(0,0,0,0.35); }
            .btn-glow { transition: transform 150ms ease, filter 150ms ease; }
            .btn-glow:hover { transform: translateY(-1px); filter: drop-shadow(0 10px 20px rgba(110,231,255,0.2)); }
            @media (prefers-reduced-motion: reduce) {
              .anim-in, .bg-breathe, .hover-lift, .btn-glow {
                animation: none !important; transition: none !important; transform: none !important; opacity: 1 !important;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Logic -------------------- */

function buildResults(rows: Record<string, string>[], m: any, t: Thresholds): RowOut[] {
  const out: RowOut[] = [];

  for (const row of rows) {
    const sku = (row[m.sku] ?? "").toString().trim();
    if (!sku) continue;

    const wh = m.warehouse ? ((row[m.warehouse] ?? "").toString().trim() || "—") : "—";

    const onHand = toNumber(row[m.onHand] ?? "0");
    const sales30d = toNumber(row[m.sales30d] ?? "0");

    const avgDaily = sales30d / 30;
    const daysCover = avgDaily > 0 ? onHand / avgDaily : onHand > 0 ? 9999 : 0;

    const reorderPoint = avgDaily * (t.leadTimeDays + t.safetyDays);
    const suggestedOrder = Math.max(0, Math.round(reorderPoint - onHand));

    const { decision, severity, reason, tips } = classify({
      onHand,
      sales30d,
      avgDaily,
      daysCover,
      reorderPoint,
      suggestedOrder,
      t,
    });

    out.push({
      sku,
      warehouse: wh,
      onHand,
      sales30d,
      avgDaily,
      daysCover,
      reorderPoint,
      suggestedOrder,
      decision,
      severity,
      reason,
      tips,
    });
  }

  out.sort((a, b) => b.severity - a.severity);
  return out;
}

function classify(x: {
  onHand: number;
  sales30d: number;
  avgDaily: number;
  daysCover: number;
  reorderPoint: number;
  suggestedOrder: number;
  t: Thresholds;
}): { decision: Decision; severity: number; reason: string; tips: string[] } {
  const { onHand, sales30d, avgDaily, daysCover, reorderPoint, t } = x;

  if (sales30d <= 0 && onHand > 0) {
    const sev = clamp(70 + Math.min(30, onHand / 10), 0, 100);
    return {
      decision: "DEAD",
      severity: Math.round(sev),
      reason: "No sales in last 30d while stock exists → dead/obsolete risk.",
      tips: ["Freeze buying. Consider promo/bundle/return to supplier or liquidation."],
    };
  }

  if (avgDaily > 0 && onHand <= 0) {
    return {
      decision: "ORDER_NOW",
      severity: 95,
      reason: "Sales exist but On Hand is 0 → stockout already happening (lost sales).",
      tips: ["Expedite replenishment. Check inbound POs and lead time accuracy."],
    };
  }

  if (avgDaily > 0 && (daysCover < t.leadTimeDays || onHand < reorderPoint * 0.85)) {
    const gap = Math.max(0, reorderPoint - onHand);
    const sev = clamp(70 + (t.leadTimeDays - Math.min(t.leadTimeDays, daysCover)) * 10 + gap * 0.02, 0, 100);
    return {
      decision: "ORDER_NOW",
      severity: Math.round(sev),
      reason: `Low cover (${round2(daysCover)}d) vs lead time (${t.leadTimeDays}d) → likely stockout before replenishment.`,
      tips: ["Order to cover lead time + safety. If supplier is unreliable, increase safety days."],
    };
  }

  if (avgDaily > 0 && onHand < reorderPoint * 1.1) {
    const sev = clamp(40 + (reorderPoint - onHand) * 0.03, 0, 100);
    return {
      decision: "WATCH",
      severity: Math.round(sev),
      reason: "Close to reorder point → monitor closely (risk rising).",
      tips: ["Review upcoming demand/promo. Prepare PO draft to move fast if needed."],
    };
  }

  if (avgDaily > 0 && daysCover > t.overstockDays) {
    const excess = daysCover - t.overstockDays;
    const sev = clamp(55 + excess * 0.4, 0, 100);
    return {
      decision: "REDUCE",
      severity: Math.round(sev),
      reason: `High cover (${round2(daysCover)}d) exceeds overstock threshold (${t.overstockDays}d).`,
      tips: ["Stop replenishment. Consider promo, re-balance, or reduce reorder frequency."],
    };
  }

  return {
    decision: "HEALTHY",
    severity: 10,
    reason: "Within thresholds.",
    tips: ["Maintain current policy. Validate lead time & safety days periodically."],
  };
}

function computeKPIs(all: RowOut[]) {
  const orderNow = all.filter((r) => r.decision === "ORDER_NOW").length;
  const watch = all.filter((r) => r.decision === "WATCH").length;
  const reduce = all.filter((r) => r.decision === "REDUCE").length;
  const dead = all.filter((r) => r.decision === "DEAD").length;

  const scoreRaw = orderNow * 10 + watch * 5 + reduce * 3 + dead * 8;
  const alertScore = clamp(Math.round((scoreRaw / Math.max(1, all.length)) * 10), 0, 100);

  const rec: string[] = [];
  if (orderNow > 0) rec.push("Prioritize ORDER_NOW SKUs first (prevent immediate stockouts).");
  if (dead > 0) rec.push("Dead stock: stop replenishment + design disposal plan (promo/liquidation).");
  if (reduce > 0) rec.push("Overstock: freeze buying and reduce holding risk via promotions or transfers.");
  if (watch > 0) rec.push("Watchlist: confirm supplier lead time and upcoming demand signals.");
  if (rec.length === 0) rec.push("System looks stable today. Keep monitoring thresholds weekly.");

  return { orderNow, watch, reduce, dead, alertScore, recommendations: rec };
}

function renderOpsNarrative(kpi: any, t: Thresholds) {
  const parts: string[] = [];
  parts.push(`Lead time ${t.leadTimeDays}d + safety ${t.safetyDays}d define your reorder point window.`);
  if (kpi.alertScore >= 70) parts.push("Risk is HIGH → attack stockouts first, then clean overstock.");
  else if (kpi.alertScore >= 45) parts.push("Risk is MODERATE → watchlist can flip fast if lead time slips.");
  else parts.push("Risk is LOW → most SKUs are stable.");
  parts.push("Ops tip: if suppliers are unstable, increase safety days instead of over-ordering everywhere.");
  return parts.join(" ");
}

/* -------------------- UI helpers -------------------- */

function decisionBadge(styles: any, d: Decision): React.CSSProperties {
  if (d === "ORDER_NOW") return styles.badge("red");
  if (d === "WATCH") return styles.badge("violet");
  if (d === "REDUCE") return styles.badge("amber");
  if (d === "DEAD") return styles.badge("red");
  return styles.badge("green");
}

function applyFilters(all: RowOut[], wh: string, decision: Decision | "ALL", search: string) {
  const s = search.trim().toLowerCase();
  return all.filter((r) => {
    if (wh !== "ALL" && r.warehouse !== wh) return false;
    if (decision !== "ALL" && r.decision !== decision) return false;
    if (s && !r.sku.toLowerCase().includes(s)) return false;
    return true;
  });
}

/* -------------------- tiny utils -------------------- */

function KPI({ title, value, sub, styles }: { title: string; value: any; sub: string; styles: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiT}>{title}</div>
      <div style={styles.kpiV}>{value}</div>
      <div style={styles.kpiS}>{sub}</div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function csvSafe(x: string) {
  const s = (x ?? "").toString();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}