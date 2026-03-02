"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
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

  targetCover: number; // lead + safety
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

  // UX preset buttons (optional). User still controls the numbers.
  const [preset, setPreset] = useState<"CUSTOM" | "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("CUSTOM");

  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<"SEVERITY" | "SUGGESTED" | "COVER_ASC" | "COVER_DESC">("SEVERITY");

  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background:
        "linear-gradient(180deg, rgba(18,24,43,0.88), rgba(12,16,28,0.88))",
      boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    };

    const btnBase: CSSProperties = {
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

    const input: CSSProperties = {
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
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Inter, Arial, sans-serif" } as CSSProperties,
      container: { maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px" } as CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        position: "sticky",
        top: 0,
        zIndex: 30,
        paddingTop: 10,
        paddingBottom: 10,
        backdropFilter: "blur(10px)",
        background: "rgba(11,15,26,0.42)",
        borderBottom: "1px solid rgba(27,35,64,0.65)",
        borderRadius: 16,
      } as CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,
      logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
        boxShadow: "0 12px 30px rgba(110,231,255,0.18)",
      } as CSSProperties,
      title: { fontWeight: 950, letterSpacing: 0.2 } as CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      } as CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 } as CSSProperties,
      card,
      cardPad: { ...card, padding: 18 } as CSSProperties,

      h1: { margin: 0, fontSize: 26, fontWeight: 950 } as CSSProperties,
      p: { margin: "8px 0 0", color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,

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
        } as CSSProperties;
      },

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 } as CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      kpiT: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiV: { fontSize: 22, fontWeight: 950, marginTop: 6 } as CSSProperties,
      kpiS: { fontSize: 12, color: "#8f97ad", marginTop: 4, lineHeight: 1.4 } as CSSProperties,

      controls: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 } as CSSProperties,
      box: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      label: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      input,
      select: { ...input, marginTop: 8 } as CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" } as CSSProperties,
      btnPrimary: { ...btnBase, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as CSSProperties,
      btnGhost: { ...btnBase, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as CSSProperties,

      tableWrap: {
        marginTop: 12,
        overflowX: "auto",
        borderRadius: 16,
        border: "1px solid rgba(27,35,64,0.75)",
        background: "rgba(10,14,25,0.35)",
        padding: 10,
      } as CSSProperties,

      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: 1080 } as CSSProperties,

      thead: { position: "sticky", top: 78, zIndex: 10 } as CSSProperties,

      th: {
        textAlign: "left",
        fontSize: 12,
        color: "#aab1c4",
        fontWeight: 900,
        padding: "10px 10px",
        background: "rgba(11,15,26,0.88)",
        borderTop: "1px solid rgba(32,41,70,0.8)",
        borderBottom: "1px solid rgba(32,41,70,0.8)",
      } as CSSProperties,

      tr: {
        background: "rgba(20,27,48,0.55)",
        cursor: "pointer",
        transition: "transform 140ms ease, box-shadow 140ms ease, background 140ms ease",
      } as CSSProperties,

      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0", verticalAlign: "top" } as CSSProperties,

      sevBar: {
        height: 8,
        borderRadius: 999,
        border: "1px solid #202946",
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      } as CSSProperties,

      sevFill: (sev: number) =>
        ({
          width: `${sev}%`,
          height: "100%",
          background:
            sev >= 85
              ? "rgba(255,80,80,0.75)"
              : sev >= 65
              ? "rgba(255,170,70,0.75)"
              : sev >= 45
              ? "rgba(167,139,250,0.75)"
              : "rgba(110,231,255,0.75)",
        } as CSSProperties),

      muted: { fontSize: 12, color: "#8f97ad", lineHeight: 1.4 } as CSSProperties,

      locked: {
        marginTop: 14,
        padding: 16,
        borderRadius: 16,
        border: "1px solid rgba(167,139,250,0.28)",
        background: "rgba(167,139,250,0.08)",
        position: "relative",
        overflow: "hidden",
      } as CSSProperties,

      lockTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 } as CSSProperties,
      lockTitle: { fontWeight: 950 } as CSSProperties,

      blur: { filter: "blur(6px)", opacity: 0.78 } as CSSProperties,

      lockBtn: { ...btnBase, background: "linear-gradient(135deg,#a78bfa,#6ee7ff)", color: "#0b0f1a" } as CSSProperties,

      legendRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" } as CSSProperties,
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
  const targetCover = leadTimeDays + safetyDays;

  function applyPreset(p: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") {
    setPreset(p);

    // Presets simply set numbers (user can still change them -> CUSTOM)
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
      "target_cover",
      "reorder_point",
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
          r.targetCover.toString(),
          round2(r.reorderPoint).toString(),
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

  function rowKey(r: RowOut) {
    return `${r.sku}__${r.warehouse}`;
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
                <div style={styles.subtitle}>Ops-grade actions • Policy-driven (Lead/Safety/Overstock)</div>
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
                    Actions are calculated using your policy: Lead Time + Safety Days → Target Cover ({targetCover}d).
                  </p>
                </div>

                <span style={styles.badge(kpi.alertScore >= 70 ? "red" : kpi.alertScore >= 45 ? "amber" : "cyan")}>
                  Alert Score: {kpi.alertScore}/100
                </span>
              </div>

              <div style={styles.kpiGrid}>
                <KPI title="Order Now" value={kpi.orderNow} sub="Stockout before lead time" styles={styles} />
                <KPI title="Watch" value={kpi.watch} sub={`Below target cover (${targetCover}d)`} styles={styles} />
                <KPI title="Reduce" value={kpi.reduce} sub={`Overstock above ${overstockDays}d cover`} styles={styles} />
                <KPI title="Dead" value={kpi.dead} sub="No sales + stock exists" styles={styles} />
              </div>

              {/* Legend */}
              <div style={styles.legendRow}>
                <span style={styles.muted}>Legend:</span>
                <span style={decisionBadge(styles, "ORDER_NOW")}>ORDER_NOW</span>
                <span style={decisionBadge(styles, "WATCH")}>WATCH</span>
                <span style={decisionBadge(styles, "REDUCE")}>REDUCE</span>
                <span style={decisionBadge(styles, "DEAD")}>DEAD</span>
                <span style={decisionBadge(styles, "HEALTHY")}>HEALTHY</span>
                <span style={styles.muted}>• Click a row to expand actionable tips</span>
              </div>

              {/* Presets */}
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={styles.badge("violet")}>Policy Presets</span>

                <button
                  className="btn-glow"
                  type="button"
                  style={{
                    ...styles.btnGhost,
                    border:
                      preset === "CONSERVATIVE" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
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
                    border:
                      preset === "BALANCED" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
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
                    border:
                      preset === "AGGRESSIVE" ? "1px solid rgba(110,231,255,0.55)" : (styles.btnGhost as any).border,
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
                    min={0}
                    value={leadTimeDays}
                    onChange={(e) => {
                      onManualChange();
                      setLeadTimeDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>How long replenishment takes to arrive.</div>
                </div>

                <div style={styles.box}>
                  <div style={styles.label}>Safety days</div>
                  <input
                    style={styles.input}
                    type="number"
                    min={0}
                    value={safetyDays}
                    onChange={(e) => {
                      onManualChange();
                      setSafetyDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>Buffer for variability and uncertainty.</div>
                </div>

                <div style={styles.box}>
                  <div style={styles.label}>Overstock threshold (days cover)</div>
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    value={overstockDays}
                    onChange={(e) => {
                      onManualChange();
                      setOverstockDays(Number(e.target.value));
                    }}
                  />
                  <div style={styles.muted}>Above this → reduce / freeze buying.</div>
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
                    placeholder="e.g. SKU00058"
                  />
                </div>

                <div style={{ minWidth: 220 }}>
                  <div style={styles.label}>Warehouse</div>
                  <select
                    style={styles.select}
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                  >
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
                  Save Policy
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
                  <thead style={styles.thead}>
                    <tr>
                      <th style={styles.th}>SKU</th>
                      <th style={styles.th}>WH</th>
                      <th style={styles.th}>Decision</th>
                      <th style={styles.th}>Severity</th>
                      <th style={styles.th}>Suggested</th>
                      <th style={styles.th}>On Hand</th>
                      <th style={styles.th}>Sales 30d</th>
                      <th style={styles.th}>Cover (days)</th>
                      <th style={styles.th}>Reason + Next step</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sorted.slice(0, 250).map((r) => {
                      const key = rowKey(r);
                      const expanded = expandedRowKey === key;

                      return (
                        <>
                          <tr
                            key={key}
                            style={styles.tr}
                            className="row-hoverable"
                            onClick={() => setExpandedRowKey(expanded ? null : key)}
                            title="Click to expand"
                          >
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

                          {expanded && (
                            <tr key={`${key}__expanded`} style={{ background: "rgba(20,27,48,0.35)" }}>
                              <td style={{ ...styles.td }} colSpan={9}>
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontWeight: 950 }}>Action Checklist</div>
                                  <ul style={{ margin: 0, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 13 }}>
                                    {(r.tips ?? []).slice(0, 4).map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                    {(r.tips ?? []).length === 0 && <li>—</li>}
                                  </ul>

                                  <div style={styles.muted}>
                                    Target cover: {r.targetCover}d • Reorder point: {round2(r.reorderPoint)} • Avg/day: {round2(r.avgDaily)}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ marginTop: 10, ...styles.muted }}>
                  Demo note: table is limited to 250 rows for performance.
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
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Immediate Next Steps</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                  {kpi.recommendations.map((x: string) => <li key={x}>{x}</li>)}
                </ul>
              </div>

              {/* Pro placeholders */}
              <div style={styles.locked}>
                <div style={styles.lockTop}>
                  <div>
                    <div style={styles.lockTitle}>Pro: Inter-warehouse transfers</div>
                    <div style={styles.muted}>Suggest transfers to prevent stockouts and reduce holding risk.</div>
                  </div>
                  <button className="btn-glow" style={styles.lockBtn} type="button">
                    Upgrade to Pro
                  </button>
                </div>
                <div style={{ marginTop: 12, ...styles.blur }}>
                  <div style={{ fontWeight: 900 }}>Transfer suggestions</div>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#c8cee0", lineHeight: 1.7, fontSize: 14 }}>
                    <li>Move 80 units from WH-A → WH-B (prevent lead-time stockout)</li>
                    <li>Consolidate slow movers to reduce holding cost</li>
                  </ul>
                </div>
              </div>

              <div style={styles.locked}>
                <div style={styles.lockTop}>
                  <div>
                    <div style={styles.lockTitle}>Pro: Pack size / MOQ rules</div>
                    <div style={styles.muted}>Round suggested orders to case packs and supplier MOQs.</div>
                  </div>
                  <button className="btn-glow" style={styles.lockBtn} type="button">
                    Unlock Rules
                  </button>
                </div>
                <div style={{ marginTop: 12, ...styles.blur }}>
                  <div style={{ fontWeight: 900 }}>Order rounding</div>
                  <div style={styles.muted}>Suggested order respects MOQ, case pack, and service level.</div>
                </div>
              </div>

              <div style={{ marginTop: 12, ...styles.muted }}>
                Note: All actions are policy-driven using your Lead/Safety/Overstock inputs.
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
            tr.row-hoverable:hover {
              background: rgba(20,27,48,0.72) !important;
              box-shadow: 0 10px 26px rgba(0,0,0,0.28);
              transform: translateY(-1px);
            }
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
  const targetCover = Math.max(0, t.leadTimeDays + t.safetyDays);

  for (const row of rows) {
    const sku = (row[m.sku] ?? "").toString().trim();
    if (!sku) continue;

    const wh = m.warehouse ? ((row[m.warehouse] ?? "").toString().trim() || "—") : "—";

    const onHand = toNumber(row[m.onHand] ?? "0");
    const sales30d = toNumber(row[m.sales30d] ?? "0");

    const avgDaily = sales30d / 30;
    const daysCover = avgDaily > 0 ? onHand / avgDaily : onHand > 0 ? 9999 : 0;

    const reorderPoint = avgDaily * targetCover;
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
      targetCover,
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

/**
 * Premium policy-driven classifier:
 * - ORDER_NOW if stockout before lead time
 * - WATCH if below target cover (lead + safety)
 * - REDUCE if overstock
 * - DEAD if no sales + stock exists
 *
 * Severity is tied to:
 * - urgency (stockout timing vs lead time)
 * - velocity (fast movers)
 * - units missing to reach reorder point
 */
function classify(x: {
  onHand: number;
  sales30d: number;
  avgDaily: number;
  daysCover: number;
  reorderPoint: number;
  suggestedOrder: number;
  t: Thresholds;
}): { decision: Decision; severity: number; reason: string; tips: string[] } {
  const { onHand, sales30d, avgDaily, daysCover, reorderPoint, suggestedOrder, t } = x;

  const lead = Math.max(0, t.leadTimeDays);
  const safety = Math.max(0, t.safetyDays);
  const targetCover = lead + safety;
  const overstockDays = Math.max(1, t.overstockDays);

  const unitsMissing = Math.max(0, reorderPoint - onHand);
  const daysToStockout = avgDaily > 0 ? daysCover : onHand > 0 ? 9999 : 0;

  const fmt = (n: number) => round2(n).toString();

  // A) No sales cases
  if (sales30d <= 0) {
    if (onHand > 0) {
      const deadLike = onHand >= 50 || daysCover >= overstockDays;
      const sev = clamp(Math.round(40 + Math.min(60, onHand / 8)), 0, 100);

      return {
        decision: deadLike ? "DEAD" : "REDUCE",
        severity: sev,
        reason: `No sales in the last 30 days while stock exists (On Hand ${onHand}). This indicates dead/slow-moving inventory risk.`,
        tips: deadLike
          ? [
              "Freeze replenishment immediately.",
              "Run a clearance plan (bundle / markdown / liquidation).",
              "Validate data quality: is the SKU discontinued or mis-mapped?",
              "If this is strategic inventory, manually override policy (exception handling).",
            ]
          : [
              "Pause replenishment for now.",
              "Try a small promo to validate demand.",
              "Monitor weekly — if sales stay at 0, treat as DEAD stock.",
            ],
      };
    }

    return {
      decision: "HEALTHY",
      severity: 5,
      reason: "No sales and no stock — no immediate action required.",
      tips: ["Keep monitoring. If sales return, the engine will flag replenishment."],
    };
  }

  // B) Stockout already
  if (avgDaily > 0 && onHand <= 0) {
    return {
      decision: "ORDER_NOW",
      severity: 98,
      reason: `Demand exists (Avg/day ${fmt(avgDaily)}) but On Hand is 0 — stockout is happening now (lost sales).`,
      tips: [
        "Expedite replenishment today (rush PO or emergency transfer).",
        "Check inbound POs and ETA accuracy.",
        "If lead time is unstable, increase Safety Days rather than over-ordering everything.",
      ],
    };
  }

  // C) ORDER_NOW if stockout before lead time
  if (daysToStockout < lead) {
    const urgency = clamp((lead - daysToStockout) / Math.max(1, lead), 0, 1); // 0..1
    const velocity = clamp(avgDaily / 40, 0, 1); // demo normalization
    const shortage = clamp(unitsMissing / Math.max(1, reorderPoint), 0, 1);

    const sev = clamp(Math.round(50 + urgency * 35 + velocity * 10 + shortage * 15), 0, 100);

    return {
      decision: "ORDER_NOW",
      severity: sev,
      reason:
        `Critical: cover is ${fmt(daysCover)}d, below lead time (${lead}d). ` +
        `Target cover is ${targetCover}d → reorder point ${fmt(reorderPoint)}. Missing ~${Math.round(unitsMissing)} units.`,
      tips: [
        `Place PO now for ~${suggestedOrder} units (to reach target cover).`,
        "If supplier reliability is weak, increase Safety Days to protect service level.",
        "Validate demand drivers (promo spike, seasonality, one-off orders).",
      ],
    };
  }

  // D) WATCH if below target cover (lead + safety)
  if (daysToStockout < targetCover) {
    const gapDays = targetCover - daysToStockout;
    const sev = clamp(Math.round(25 + (gapDays / Math.max(1, targetCover)) * 60), 0, 100);

    return {
      decision: "WATCH",
      severity: sev,
      reason: `Watch: cover is ${fmt(daysCover)}d, below target cover (${targetCover}d = lead ${lead} + safety ${safety}).`,
      tips: [
        "Prepare a draft PO and monitor demand for 3–7 days.",
        "A small supplier delay can turn this into ORDER_NOW — validate lead time.",
        `If demand is trending up, consider increasing Safety Days (current: ${safety}).`,
      ],
    };
  }

  // E) REDUCE if overstock
  if (daysCover > overstockDays) {
    const excess = daysCover - overstockDays;
    const sev = clamp(Math.round(45 + excess * 0.35), 0, 100);

    return {
      decision: "REDUCE",
      severity: sev,
      reason: `Overstock: cover is ${fmt(daysCover)}d, above overstock threshold (${overstockDays}d).`,
      tips: [
        "Freeze replenishment for this SKU.",
        "Use targeted promo/bundles to reduce holding risk.",
        "If you have multiple warehouses, consider rebalancing stock to the higher-demand location.",
      ],
    };
  }

  // F) Healthy
  return {
    decision: "HEALTHY",
    severity: 10,
    reason: "Within policy thresholds — no immediate action required.",
    tips: [
      "Keep current policy.",
      "Revisit Lead/Safety Days monthly or when supplier performance changes.",
    ],
  };
}

function computeKPIs(all: RowOut[]) {
  const orderNow = all.filter((r) => r.decision === "ORDER_NOW").length;
  const watch = all.filter((r) => r.decision === "WATCH").length;
  const reduce = all.filter((r) => r.decision === "REDUCE").length;
  const dead = all.filter((r) => r.decision === "DEAD").length;

  // Alert score based on severity distribution (more premium than raw counts)
  const avgSev =
    all.length > 0 ? Math.round(all.reduce((s, r) => s + r.severity, 0) / all.length) : 0;

  const alertScore = clamp(
    Math.round(avgSev * 0.85 + (orderNow > 0 ? 10 : 0) + (dead > 0 ? 5 : 0)),
    0,
    100
  );

  const rec: string[] = [];
  if (orderNow > 0) rec.push("Execute ORDER_NOW first (prevent immediate stockouts).");
  if (watch > 0) rec.push("Convert WATCH items into POs based on demand trend and supplier reliability.");
  if (dead > 0) rec.push("Dead stock: freeze replenishment and run a clearance plan.");
  if (reduce > 0) rec.push("Overstock: pause buying and reduce holding cost through promos or transfers.");
  if (rec.length === 0) rec.push("System is stable today. Monitor policy weekly.");

  return { orderNow, watch, reduce, dead, alertScore, recommendations: rec };
}

function renderOpsNarrative(kpi: any, t: Thresholds) {
  const targetCover = t.leadTimeDays + t.safetyDays;

  const parts: string[] = [];
  parts.push(
    `Your policy is driving decisions: Target Cover = Lead (${t.leadTimeDays}d) + Safety (${t.safetyDays}d) = ${targetCover}d.`
  );

  if (kpi.alertScore >= 70) parts.push("Risk level is HIGH → prevent stockouts first, then clean up dead/overstock.");
  else if (kpi.alertScore >= 45) parts.push("Risk level is MODERATE → a small lead-time slip can escalate WATCH items.");
  else parts.push("Risk level is LOW → most SKUs are stable under the current policy.");

  parts.push(
    "Premium tip: adjust Safety Days based on supplier reliability (not only demand). Keep the policy simple, consistent, and explainable."
  );

  return parts.join(" ");
}

/* -------------------- UI helpers -------------------- */

function decisionBadge(styles: any, d: Decision): CSSProperties {
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