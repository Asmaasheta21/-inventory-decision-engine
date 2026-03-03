"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadDatasetV2,
  loadMappingV2,
  loadMovementTypeValueMappingV2WithDefault,
  toNumber,
  type DemoRow,
  type MovementsMapping,
  type MovementTypeValueMapping,
} from "@/lib/demoStore";

type Decision = "ORDER_NOW" | "WATCH" | "REDUCE" | "DEAD" | "HEALTHY";

type Thresholds = {
  leadTimeDays: number;
  safetyDays: number;
  overstockDays: number;
};

type RowOut = {
  sku: string;
  warehouse: string;

  onHand: number;
  net30d: number;
  out30d: number;

  avgDailyOut: number;
  daysCover: number;

  reorderPoint: number;
  targetStock: number;
  suggestedOrder: number;

  decision: Decision;
  severity: number;

  notes: string[];
};

function clamp(n: number, min: number, max: number) {
  const v = Number.isFinite(n) ? n : min;
  return Math.min(max, Math.max(min, v));
}

function safeLower(x: any) {
  return (x ?? "").toString().trim().toLowerCase();
}

/** classify movement type value into IN / OUT / OTHER based on mapping */
function classifyMovementType(
  rawType: string,
  map: MovementTypeValueMapping
): "IN" | "OUT" | "OTHER" {
  const t = safeLower(rawType);

  const inSet = new Set((map?.inValues ?? []).map(safeLower));
  const outSet = new Set((map?.outValues ?? []).map(safeLower));
  const otherSet = new Set((map?.otherValues ?? []).map(safeLower));

  if (inSet.has(t)) return "IN";
  if (outSet.has(t)) return "OUT";
  if (otherSet.has(t)) return "OTHER";

  // fallback heuristic (helps demos where they didn't configure movement-types yet)
  if (t.includes("receipt") || t === "gr" || t === "in" || t === "101") return "IN";
  if (t.includes("issue") || t.includes("sale") || t === "gi" || t === "out" || t === "201")
    return "OUT";

  return "OTHER";
}

function parseDateMs(x: string) {
  const t = Date.parse((x ?? "").toString().trim());
  return Number.isFinite(t) ? t : NaN;
}

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
}

function badgeTone(decision: Decision) {
  switch (decision) {
    case "ORDER_NOW":
      return { bg: "rgba(255,80,80,0.14)", bd: "rgba(255,80,80,0.35)", fg: "#ffd4d4" };
    case "WATCH":
      return { bg: "rgba(255,196,0,0.12)", bd: "rgba(255,196,0,0.28)", fg: "#ffe9b3" };
    case "REDUCE":
      return { bg: "rgba(167,139,250,0.12)", bd: "rgba(167,139,250,0.30)", fg: "#e9ddff" };
    case "DEAD":
      return { bg: "rgba(120,130,160,0.12)", bd: "rgba(120,130,160,0.25)", fg: "#d3d8e6" };
    default:
      return { bg: "rgba(110,231,255,0.10)", bd: "rgba(110,231,255,0.22)", fg: "#d9fbff" };
  }
}

export default function ResultsPage() {
  const router = useRouter();

  // V2 data
  const movements = typeof window !== "undefined" ? loadDatasetV2("movements") : null;
  const mapping = typeof window !== "undefined" ? loadMappingV2() : null;
  const mvTypeValues =
    typeof window !== "undefined" ? loadMovementTypeValueMappingV2WithDefault() : null;

  // user-controlled thresholds (for now, local state with defaults)
  const [t, setT] = useState<Thresholds>({
    leadTimeDays: 7,
    safetyDays: 7,
    overstockDays: 90,
  });

  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const hasMovements = !!movements?.headers?.length && !!movements?.rows?.length;
  const hasMapping =
    !!mapping?.itemId && !!mapping?.date && !!mapping?.qty && !!mapping?.movementType;

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background:
        "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
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
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" },
      container: { maxWidth: 1200, margin: "0 auto", padding: "18px 20px 60px" },

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      },

      brand: { display: "flex", alignItems: "center", gap: 10 },
      logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
      },
      title: { fontWeight: 900, letterSpacing: 0.2 },
      subtitle: { fontSize: 12, color: "#aab1c4" },

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      },

      btnPrimary: {
        ...btn,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
        color: "#0b0f1a",
      } as React.CSSProperties,

      btnGhost: {
        ...btn,
        background: "transparent",
        border: "1px solid #2a3350",
        color: "#e6e8ee",
      } as React.CSSProperties,

      hero: { ...card, padding: 18, marginBottom: 16 } as React.CSSProperties,

      h1: { margin: "6px 0 8px", fontSize: 26, lineHeight: 1.15 } as React.CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as React.CSSProperties,

      statusRow: {
        marginTop: 12,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      } as React.CSSProperties,

      statusPill: (ok: boolean) =>
        ({
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 900,
          border: `1px solid ${ok ? "rgba(110,231,255,0.25)" : "rgba(255,80,80,0.30)"}`,
          background: ok ? "rgba(110,231,255,0.08)" : "rgba(255,80,80,0.08)",
          color: ok ? "#d9fbff" : "#ffd4d4",
        }) as React.CSSProperties,

      controls: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, marginTop: 14 } as React.CSSProperties,
      control: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      label: { fontSize: 12, color: "#aab1c4", marginBottom: 8, fontWeight: 800 } as React.CSSProperties,
      input: {
        width: "100%",
        padding: "10px 10px",
        borderRadius: 12,
        border: "1px solid #2a3350",
        background: "#0b0f1a",
        color: "#e6e8ee",
      } as React.CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 } as React.CSSProperties,

      tableWrap: { marginTop: 12, overflowX: "auto" } as React.CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as React.CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as React.CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0", verticalAlign: "top" } as React.CSSProperties,

      badge: (decision: Decision) => {
        const c = badgeTone(decision);
        return {
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 900,
          border: `1px solid ${c.bd}`,
          background: c.bg,
          color: c.fg,
          whiteSpace: "nowrap",
        } as React.CSSProperties;
      },

      small: { fontSize: 12, color: "#8f97ad", lineHeight: 1.5 } as React.CSSProperties,
    };
  }, []);

  // ---------- compute results ----------
  const { rowsOut, warehouses } = useMemo(() => {
    const out: RowOut[] = [];
    const whSet = new Set<string>();

    if (!movements || !mapping || !mvTypeValues) {
      return { rowsOut: out, warehouses: ["ALL"] as string[] };
    }
    if (!movements.rows?.length || !movements.headers?.length) {
      return { rowsOut: out, warehouses: ["ALL"] as string[] };
    }
    if (!mapping.itemId || !mapping.date || !mapping.qty || !mapping.movementType) {
      return { rowsOut: out, warehouses: ["ALL"] as string[] };
    }

    const now = Date.now();
    const window30 = 30 * 24 * 60 * 60 * 1000;
    const from30 = now - window30;

    type Agg = {
      sku: string;
      warehouse: string;

      onHand: number; // computed from net movements (all time)
      net30d: number;
      out30d: number; // absolute OUT in last 30 days
      lastOutMs: number; // last OUT movement timestamp
      lastAnyMs: number;
      typesSeen: Set<string>;
      rowsCount: number;
    };

    const byKey = new Map<string, Agg>();

    const whCol = mapping.warehouse;
    const uomCol = mapping.uom;

    const getWH = (r: DemoRow) => {
      const v = whCol ? (r[whCol] ?? "").toString().trim() : "";
      return v || "ALL";
    };

    for (const r of movements.rows) {
      const sku = (r[mapping.itemId] ?? "").toString().trim();
      if (!sku) continue;

      const wh = getWH(r);
      whSet.add(wh);

      const key = `${sku}__${wh}`;
      const agg =
        byKey.get(key) ??
        ({
          sku,
          warehouse: wh,
          onHand: 0,
          net30d: 0,
          out30d: 0,
          lastOutMs: NaN,
          lastAnyMs: NaN,
          typesSeen: new Set<string>(),
          rowsCount: 0,
        } as Agg);

      const dtRaw = (r[mapping.date] ?? "").toString().trim();
      const ms = parseDateMs(dtRaw);

      const qtyRaw = (r[mapping.qty] ?? "").toString();
      const qty = toNumber(qtyRaw);

      const mtRaw = (r[mapping.movementType] ?? "").toString().trim();
      agg.typesSeen.add(mtRaw || "(empty)");

      const kind = classifyMovementType(mtRaw, mvTypeValues);

      // net stock: IN adds, OUT subtracts
      if (kind === "IN") agg.onHand += qty;
      else if (kind === "OUT") agg.onHand -= Math.abs(qty);
      else {
        // OTHER -> treat as net 0 (you can change later)
      }

      // 30d window stats
      if (Number.isFinite(ms) && ms >= from30 && ms <= now) {
        // net30 includes IN (+) and OUT (-abs)
        if (kind === "IN") agg.net30d += qty;
        else if (kind === "OUT") agg.net30d -= Math.abs(qty);

        if (kind === "OUT") agg.out30d += Math.abs(qty);
      }

      if (Number.isFinite(ms)) {
        agg.lastAnyMs = Number.isFinite(agg.lastAnyMs) ? Math.max(agg.lastAnyMs, ms) : ms;
        if (kind === "OUT") {
          agg.lastOutMs = Number.isFinite(agg.lastOutMs) ? Math.max(agg.lastOutMs, ms) : ms;
        }
      }

      agg.rowsCount++;
      byKey.set(key, agg);
    }

    // convert to decisions
    for (const agg of byKey.values()) {
      const avgDailyOut = agg.out30d / 30;
      const daysCover =
        avgDailyOut > 0 ? agg.onHand / avgDailyOut : agg.onHand > 0 ? Infinity : 0;

      const reorderPoint = avgDailyOut * (t.leadTimeDays + t.safetyDays);
      const targetStock = avgDailyOut * (t.leadTimeDays + t.safetyDays + 14); // small extra buffer
      const suggestedOrder = Math.max(0, Math.ceil(targetStock - agg.onHand));

      const notes: string[] = [];

      // activity notes
      if (!Number.isFinite(agg.lastOutMs)) notes.push("No OUT movements detected yet (consumption unknown).");
      else {
        const daysSinceOut = Math.floor((Date.now() - agg.lastOutMs) / (24 * 60 * 60 * 1000));
        if (daysSinceOut >= 45) notes.push(`Last OUT was ${daysSinceOut} days ago → possible slow mover.`);
      }

      if (avgDailyOut === 0 && agg.onHand > 0) notes.push("Stock exists but 30d consumption is zero.");
      if (agg.onHand < 0) notes.push("Computed on-hand is negative → check movement sign / type mapping.");

      // decision logic (simple but action-ready)
      let decision: Decision = "HEALTHY";
      let severity = 0;

      if (avgDailyOut === 0) {
        if (agg.onHand <= 0) {
          decision = "WATCH";
          severity = 40;
          notes.push("No recent demand + no stock → monitor.");
        } else {
          decision = "DEAD";
          severity = 65;
          notes.push("No recent demand but stock on hand → investigate and consider redeploy.");
        }
      } else {
        if (agg.onHand <= 0) {
          decision = "ORDER_NOW";
          severity = 95;
          notes.push("Stockout risk (on-hand ≤ 0).");
        } else if (agg.onHand < reorderPoint) {
          decision = "ORDER_NOW";
          severity = 85;
          notes.push("Below reorder point.");
        } else if (daysCover < (t.leadTimeDays + t.safetyDays)) {
          decision = "WATCH";
          severity = 65;
          notes.push("Cover is below lead+safety window.");
        } else if (daysCover > t.overstockDays) {
          decision = "REDUCE";
          severity = 70;
          notes.push("Cover exceeds overstock threshold.");
        } else {
          decision = "HEALTHY";
          severity = 25;
          notes.push("Within policy thresholds.");
        }
      }

      out.push({
        sku: agg.sku,
        warehouse: agg.warehouse,
        onHand: agg.onHand,
        net30d: agg.net30d,
        out30d: agg.out30d,
        avgDailyOut,
        daysCover,
        reorderPoint,
        targetStock,
        suggestedOrder,
        decision,
        severity,
        notes,
      });
    }

    out.sort((a, b) => b.severity - a.severity);

    const whs = ["ALL", ...Array.from(whSet).sort((a, b) => a.localeCompare(b))];
    return { rowsOut: out, warehouses: whs };
  }, [movements, mapping, mvTypeValues, t.leadTimeDays, t.safetyDays, t.overstockDays]);

  // ---------- filters ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsOut.filter((r) => {
      if (warehouseFilter !== "ALL" && r.warehouse !== warehouseFilter) return false;
      if (decisionFilter !== "ALL" && r.decision !== decisionFilter) return false;
      if (q && !r.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rowsOut, warehouseFilter, decisionFilter, search]);

  // ---------- empty state ----------
  if (!hasMovements || !hasMapping) {
    return (
      <div style={styles.wrap}>
        <div className="bg-breathe" style={{ minHeight: "100vh" }}>
          <div style={styles.container}>
            <div style={styles.hero}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 22 }}>Ops Control</div>
                  <div style={{ marginTop: 6, color: "#b7bed1" }}>
                    Missing demo data. Start from Upload (then Mapping) to generate results.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={styles.btnPrimary} onClick={() => router.push("/upload")}>
                  Go to Upload
                </button>
                <button style={styles.btnGhost} onClick={() => router.push("/mapping")}>
                  Go to Mapping
                </button>
              </div>

              <div style={styles.statusRow}>
                <span style={styles.statusPill(!!hasMovements)}>Status: Upload {hasMovements ? "✓" : "✗"}</span>
                <span style={styles.statusPill(!!hasMapping)}>Mapping {hasMapping ? "✓" : "✗"}</span>
              </div>

              <div style={{ marginTop: 10, ...styles.small }}>
                This Results page is V2-aware and expects:
                <br />• Upload: <b>saveDatasetV2("movements")</b>
                <br />• Mapping: <b>saveMappingV2()</b> (Item ID, Date, Qty, Movement Type)
              </div>
            </div>

            <style jsx global>{`
              .bg-breathe {
                background: radial-gradient(1200px 600px at 10% 10%, rgba(110, 231, 255, 0.08), transparent 55%),
                  radial-gradient(900px 500px at 90% 20%, rgba(167, 139, 250, 0.1), transparent 60%),
                  linear-gradient(180deg, #0f1630, #0b0f1a);
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory Decision Engine</div>
                <div style={styles.subtitle}>Ops Control • Results</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>
              <a href="/upload" style={styles.link}>
                Upload
              </a>
              <a href="/mapping" style={styles.link}>
                Mapping
              </a>
              <a href="/movement-types" style={styles.link}>
                Movement Types
              </a>
            </div>
          </div>

          {/* Hero */}
          <div style={styles.hero}>
            <h1 style={styles.h1}>Ops Control</h1>
            <p style={styles.p}>
              Action-ready decisions based on your movements ledger (last 30 days consumption + policy thresholds).
            </p>

            <div style={styles.statusRow}>
              <span style={styles.statusPill(true)}>Upload ✓</span>
              <span style={styles.statusPill(true)}>Mapping ✓</span>
              <span style={styles.statusPill(true)}>Movement Types ✓ (default if not configured)</span>
            </div>

            {/* Controls */}
            <div style={styles.controls}>
              <div style={styles.control}>
                <div style={styles.label}>Search SKU</div>
                <input
                  style={styles.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type SKU..."
                />
                <div style={styles.small}>Filters the table instantly.</div>
              </div>

              <div style={styles.control}>
                <div style={styles.label}>Warehouse</div>
                <select
                  style={styles.input}
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <div style={styles.small}>
                  If warehouse wasn’t mapped, everything shows as <b>ALL</b>.
                </div>
              </div>

              <div style={styles.control}>
                <div style={styles.label}>Decision</div>
                <select
                  style={styles.input}
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value as any)}
                >
                  <option value="ALL">ALL</option>
                  <option value="ORDER_NOW">ORDER_NOW</option>
                  <option value="WATCH">WATCH</option>
                  <option value="REDUCE">REDUCE</option>
                  <option value="DEAD">DEAD</option>
                  <option value="HEALTHY">HEALTHY</option>
                </select>
                <div style={styles.small}>Sorted by severity (highest first).</div>
              </div>
            </div>

            {/* Thresholds */}
            <div style={{ ...styles.controls, marginTop: 10 }}>
              <div style={styles.control}>
                <div style={styles.label}>Lead Time (days)</div>
                <input
                  style={styles.input}
                  type="number"
                  value={t.leadTimeDays}
                  onChange={(e) => setT((p) => ({ ...p, leadTimeDays: clamp(Number(e.target.value), 0, 365) }))}
                />
              </div>
              <div style={styles.control}>
                <div style={styles.label}>Safety (days)</div>
                <input
                  style={styles.input}
                  type="number"
                  value={t.safetyDays}
                  onChange={(e) => setT((p) => ({ ...p, safetyDays: clamp(Number(e.target.value), 0, 365) }))}
                />
              </div>
              <div style={styles.control}>
                <div style={styles.label}>Overstock (days)</div>
                <input
                  style={styles.input}
                  type="number"
                  value={t.overstockDays}
                  onChange={(e) => setT((p) => ({ ...p, overstockDays: clamp(Number(e.target.value), 1, 3650) }))}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={styles.grid}>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>SKU</th>
                    <th style={styles.th}>Warehouse</th>
                    <th style={styles.th}>Decision</th>
                    <th style={styles.th}>On Hand</th>
                    <th style={styles.th}>30d OUT</th>
                    <th style={styles.th}>Avg/day OUT</th>
                    <th style={styles.th}>Days Cover</th>
                    <th style={styles.th}>Reorder Point</th>
                    <th style={styles.th}>Suggested Order</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.sku}__${r.warehouse}`} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 900 }}>{r.sku}</div>
                        <div style={styles.small}>Severity: {Math.round(r.severity)}</div>
                      </td>
                      <td style={styles.td}>{r.warehouse}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(r.decision)}>{r.decision}</span>
                      </td>
                      <td style={styles.td}>{fmt(r.onHand)}</td>
                      <td style={styles.td}>{fmt(r.out30d)}</td>
                      <td style={styles.td}>{fmt(r.avgDailyOut)}</td>
                      <td style={styles.td}>
                        {r.daysCover === Infinity ? "∞" : fmt(r.daysCover)}
                      </td>
                      <td style={styles.td}>{fmt(r.reorderPoint)}</td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 900 }}>{fmt(r.suggestedOrder)}</div>
                        <div style={styles.small}>Target: {fmt(r.targetStock)}</div>
                      </td>
                      <td style={styles.td}>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {r.notes.slice(0, 3).map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10, ...styles.small }}>
                Showing <b>{filtered.length}</b> rows (from {rowsOut.length}).
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
              0%,
              100% {
                background-position: 0% 0%, 100% 0%, 50% 50%;
              }
              50% {
                background-position: 10% 8%, 92% 12%, 50% 50%;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}