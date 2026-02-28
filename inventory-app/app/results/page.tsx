"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

type Row = Record<string, string>;
type Decision = "ORDER_NOW" | "ORDER_SOON" | "OVERSTOCK" | "HEALTHY";

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function format1(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function roundUpToPack(qty: number, pack: number) {
  if (pack <= 0) return Math.ceil(qty);
  return Math.ceil(qty / pack) * pack;
}

export default function ResultsPage() {
  const [leadTime, setLeadTime] = useState(7);
  const [safetyDays, setSafetyDays] = useState(7);
  const [packSize, setPackSize] = useState(10);

  const [tab, setTab] = useState<"summary" | "actions" | "table">("summary");
  const [query, setQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");

  const rows: Row[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("ide_rows");
    return raw ? JSON.parse(raw) : [];
  }, []);

  const computed = useMemo(() => {
    const targetDays = leadTime + safetyDays;

    const mapped = rows.map((r) => {
      const sku = (r["sku"] ?? r["SKU"] ?? r["Sku"] ?? "").toString();

      const onHand = safeNum(r["on_hand"] ?? r["On Hand"] ?? r["onHand"] ?? r["OnHand"] ?? 0);
      const avgDaily = safeNum(
        r["avg_daily_sales"] ?? r["avg_daily"] ?? r["Avg Daily"] ?? r["avgDaily"] ?? 0
      );

      const doc = avgDaily > 0 ? onHand / avgDaily : onHand > 0 ? 9999 : 0;
      const reorderPoint = avgDaily * targetDays;
      const shortage = Math.max(0, Math.ceil(reorderPoint - onHand));

      let suggested = 0;
      if (shortage > 0) {
        suggested = shortage;
        suggested = Math.max(suggested, packSize); // treat pack as minimum too
        suggested = roundUpToPack(suggested, packSize);
      }

      let decision: Decision = "HEALTHY";
      if (avgDaily === 0 && onHand > 0) decision = "OVERSTOCK";
      else if (avgDaily === 0 && onHand === 0) decision = "HEALTHY";
      else if (doc < leadTime) decision = "ORDER_NOW";
      else if (doc < targetDays) decision = "ORDER_SOON";
      else if (doc > targetDays * 2) decision = "OVERSTOCK";
      else decision = "HEALTHY";

      const reason =
        avgDaily === 0
          ? onHand > 0
            ? "No movement detected (AvgDaily=0) while stock exists → review slow mover."
            : "No demand + no stock → no action."
          : decision === "ORDER_NOW"
            ? `Cover ${format1(doc)}d < Lead Time ${leadTime}d → stockout risk.`
            : decision === "ORDER_SOON"
              ? `Cover ${format1(doc)}d < Target (${targetDays}d) → replenish soon.`
              : decision === "OVERSTOCK"
                ? `Cover ${format1(doc)}d > 2×Target → cash tied up.`
                : "On-track within target range → hold.";

      const priority =
        decision === "ORDER_NOW" ? 1000 - doc :
        decision === "ORDER_SOON" ? 700 - doc :
        decision === "OVERSTOCK" ? 300 + doc :
        0;

      return { sku, onHand, avgDaily, doc, targetDays, reorderPoint, shortage, suggested, decision, reason, priority };
    });

    mapped.sort((a, b) => (b.priority - a.priority) || a.sku.localeCompare(b.sku));
    return mapped;
  }, [rows, leadTime, safetyDays, packSize]);

  const summary = useMemo(() => {
    const orderNow = computed.filter(x => x.decision === "ORDER_NOW").length;
    const orderSoon = computed.filter(x => x.decision === "ORDER_SOON").length;
    const overstock = computed.filter(x => x.decision === "OVERSTOCK").length;
    const healthy = computed.filter(x => x.decision === "HEALTHY").length;

    const suggestedUnits = computed.reduce((s, x) => s + x.suggested, 0);
    const skuCount = computed.length;

    // little “headline number” like the mock
    const headline = suggestedUnits;

    return { orderNow, orderSoon, overstock, healthy, skuCount, suggestedUnits, headline };
  }, [computed]);

  const filtered = useMemo(() => {
    return computed.filter((x) => {
      const qOk = !query || x.sku.toLowerCase().includes(query.toLowerCase());
      const dOk = decisionFilter === "ALL" ? true : x.decision === decisionFilter;
      return qOk && dOk;
    });
  }, [computed, query, decisionFilter]);

  const topActions = useMemo(() => {
    return computed
      .filter(x => x.decision === "ORDER_NOW" || x.decision === "ORDER_SOON" || x.decision === "OVERSTOCK")
      .slice(0, 8);
  }, [computed]);

  // empty state
  if (!rows.length) {
    return (
      <div style={styles.page}>
        <TopHeader />
        <div style={styles.shell}>
          <div style={styles.panel}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>No data yet</div>
            <div style={{ color: "#64748b", marginTop: 6 }}>
              روحي Upload/Paste وحطي بيانات علشان يطلع Dashboard.
            </div>
            <div style={{ marginTop: 14 }}>
              <Link href="/upload" style={styles.btnPrimary}>Upload</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <TopHeader />

      <div style={styles.shell}>
        {/* Title row + tabs */}
        <div style={styles.titleRow}>
          <div>
            <div style={styles.h1}>Inventory Decisions</div>
            <div style={styles.sub}>
              Prioritized actions based on coverage, lead time, and safety.
            </div>
          </div>

          <div style={styles.rightRow}>
            <div style={styles.tabs}>
              <Tab active={tab === "summary"} onClick={() => setTab("summary")}>Summary</Tab>
              <Tab active={tab === "actions"} onClick={() => setTab("actions")}>Actions</Tab>
              <Tab active={tab === "table"} onClick={() => setTab("table")}>Table</Tab>
            </div>

            <div style={styles.bell} title="Notifications">🔔</div>
          </div>
        </div>

        {/* Settings cards (Lead / Safety / Pack / Headline) */}
        <div style={styles.grid4}>
          <SettingCard
            title="Lead Time"
            suffix="(days)"
            value={leadTime}
            onChange={setLeadTime}
            icon="📅"
          />
          <SettingCard
            title="Safety Stock"
            suffix="(days)"
            value={safetyDays}
            onChange={setSafetyDays}
            icon="📅"
          />
          <SettingCard
            title="Pack Size"
            suffix=""
            value={packSize}
            onChange={setPackSize}
            icon="📦"
          />
          <MiniKPI title="SKUs" value={summary.skuCount} big={summary.headline} />
        </div>

        {/* KPI row */}
        <div style={styles.grid4}>
          <KpiCard tone="danger" title="Order Now" value={summary.orderNow} note="Risk of stockout" />
          <KpiCard tone="warn" title="Order Soon" value={summary.orderSoon} note="Replenish soon" />
          <KpiCard tone="info" title="Overstock" value={summary.overstock} note="Cash tied up" />
          <KpiCard tone="ok" title="Healthy" value={summary.healthy} note="On-track" />
        </div>

        {/* Filters */}
        <div style={styles.filtersRow}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU…"
            style={styles.input}
          />

          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as any)}
            style={styles.select}
          >
            <option value="ALL">All decisions</option>
            <option value="ORDER_NOW">ORDER NOW</option>
            <option value="ORDER_SOON">ORDER SOON</option>
            <option value="OVERSTOCK">OVERSTOCK</option>
            <option value="HEALTHY">HEALTHY</option>
          </select>
        </div>

        {/* TABS CONTENT */}
        {tab === "summary" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>Top Actions</div>
                <div style={styles.panelSub}>
                  Focus on urgent SKUs first: order, reduce, reallocate.
                </div>
              </div>

              <button style={styles.btnGhost} onClick={() => setTab("actions")}>
                Full List →
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              {topActions.map((x, idx) => (
                <TopActionRow
                  key={idx}
                  item={x}
                  onPrimary={() => alert(`Primary action for ${x.sku}`)}
                  onReview={() => alert(`Review ${x.sku}`)}
                />
              ))}
              {!topActions.length && (
                <div style={{ color: "#64748b", padding: 10 }}>
                  No urgent actions detected.
                </div>
              )}
            </div>

            <div style={styles.tip}>
              Tip: بعدين نضيف “Paste table / Google Sheets” علشان الشركات تسحب بيانات مباشرة.
            </div>
          </div>
        )}

        {tab === "actions" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>Prioritized Actions</div>
                <div style={styles.panelSub}>Sorted by urgency (most important first).</div>
              </div>

              <div style={{ color: "#64748b", fontSize: 13 }}>
                Showing <b>{filtered.length}</b>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              {filtered.slice(0, 50).map((x, idx) => (
                <TopActionRow
                  key={idx}
                  item={x}
                  onPrimary={() => alert(`Primary action for ${x.sku}`)}
                  onReview={() => alert(`Review ${x.sku}`)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "table" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>Table</div>
                <div style={styles.panelSub}>Detailed view for analysts.</div>
              </div>
            </div>

            <div style={{ overflow: "auto", border: "1px solid #eef2f7", borderRadius: 16, marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr>
                    {["SKU", "On Hand", "Avg Daily", "DoC", "Target Days", "Reorder Point", "Suggested", "Decision", "Reason"].map((c) => (
                      <th key={c} style={styles.th}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((x, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={styles.td}><b>{x.sku || "—"}</b></td>
                      <td style={styles.td}>{x.onHand}</td>
                      <td style={styles.td}>{x.avgDaily}</td>
                      <td style={styles.td}>{format1(x.doc)}</td>
                      <td style={styles.td}>{x.targetDays}</td>
                      <td style={styles.td}>{Math.round(x.reorderPoint)}</td>
                      <td style={styles.td}><b>{x.suggested}</b></td>
                      <td style={styles.td}><Pill decision={x.decision} /></td>
                      <td style={{ ...styles.td, color: "#475569" }}>{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
          <div>Inventory Decision Engine</div>
          <Link href="/upload" style={{ color: "#475569", textDecoration: "none" }}>Upload</Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI components ---------------- */

function TopHeader() {
  return (
    <div style={styles.topHeader}>
      <div style={styles.topHeaderInner}>
        <div style={{ fontWeight: 900 }}>Inventory Decision Engine</div>
        <Link href="/upload" style={{ color: "#0f172a", textDecoration: "none" }}>Upload</Link>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function SettingCard({
  title,
  suffix,
  value,
  onChange,
  icon,
}: {
  title: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  icon: string;
}) {
  return (
    <div style={styles.settingCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={styles.settingTitle}>
            {title} <span style={{ color: "#94a3b8", fontWeight: 700 }}>{suffix}</span>
          </div>
          <div style={styles.settingValue}>{value}</div>
        </div>

        <div style={styles.settingIcon}>{icon}</div>
      </div>

      <input
        type="range"
        min={0}
        max={60}
        value={clamp(value, 0, 60)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", marginTop: 8 }}
      />

      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.smallNumber}
      />
    </div>
  );
}

function MiniKPI({ title, value, big }: { title: string; value: number; big: number }) {
  return (
    <div style={styles.settingCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={styles.settingTitle}>{title}</div>
          <div style={styles.settingValue}>{value}</div>
        </div>
        <div style={{ fontSize: 46, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
          {big}
        </div>
      </div>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}>
        Headline = total suggested units
      </div>
    </div>
  );
}

function KpiCard({ title, value, note, tone }: { title: string; value: number; note: string; tone: "danger" | "warn" | "info" | "ok" }) {
  const t = toneStyles[tone];
  return (
    <div style={{ ...styles.kpiCard, ...t.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...styles.kpiDot, ...t.dot }} />
        <div style={styles.kpiTitle}>{title}</div>
      </div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiNote}>{note}</div>
    </div>
  );
}

function Pill({ decision }: { decision: Decision }) {
  const t = pillStyles[decision];
  return (
    <span style={{ ...styles.pill, ...t }}>
      {decision.replace("_", " ")}
    </span>
  );
}

function TopActionRow({
  item,
  onPrimary,
  onReview,
}: {
  item: any;
  onPrimary: () => void;
  onReview: () => void;
}) {
  const primaryLabel =
    item.decision === "OVERSTOCK" ? "Move" : "Order";

  return (
    <div style={styles.actionRow}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 260 }}>
        <Pill decision={item.decision} />
        <div style={{ fontWeight: 900 }}>{item.sku || "—"}</div>
      </div>

      <div style={{ flex: 1, color: "#475569", fontSize: 13 }}>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>
          {item.suggested} units
        </div>
        <div style={{ marginTop: 2 }}>{item.reason}</div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={styles.btnPrimarySm} onClick={onPrimary}>{primaryLabel}</button>
        <button style={styles.btnGhostSm} onClick={onReview}>Review</button>
        <button style={styles.btnDots} title="More">⋯</button>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f9ff",
    fontFamily: "system-ui",
  },
  topHeader: {
    background: "#ffffff",
    borderBottom: "1px solid #eaf0ff",
  },
  topHeaderInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shell: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 18,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    padding: "14px 16px",
    background: "white",
    border: "1px solid #eaf0ff",
    borderRadius: 22,
    boxShadow: "0 6px 26px rgba(15,23,42,0.06)",
  },
  h1: { fontSize: 34, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 },
  sub: { marginTop: 6, color: "#64748b" },

  rightRow: { display: "flex", alignItems: "center", gap: 12 },
  tabs: {
    display: "flex",
    background: "#f1f5ff",
    padding: 6,
    borderRadius: 16,
    border: "1px solid #eaf0ff",
  },
  tab: {
    border: "1px solid transparent",
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    color: "#334155",
  },
  tabActive: {
    background: "white",
    border: "1px solid #eaf0ff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    color: "#0f172a",
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid #eaf0ff",
    background: "white",
    cursor: "default",
  },

  grid4: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  settingCard: {
    background: "white",
    border: "1px solid #eaf0ff",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 6px 26px rgba(15,23,42,0.05)",
    minHeight: 118,
  },
  settingTitle: { fontWeight: 900, color: "#0f172a" },
  settingValue: { fontSize: 40, fontWeight: 900, color: "#0f172a", marginTop: 6, lineHeight: 1 },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#f1f5ff",
    border: "1px solid #eaf0ff",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
  },
  smallNumber: {
    marginTop: 8,
    width: 90,
    padding: "10px 10px",
    borderRadius: 14,
    border: "1px solid #eaf0ff",
    outline: "none",
    fontWeight: 800,
    color: "#0f172a",
  },

  kpiCard: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid #eaf0ff",
    boxShadow: "0 6px 26px rgba(15,23,42,0.05)",
    background: "white",
  },
  kpiDot: { width: 22, height: 22, borderRadius: 999, border: "2px solid rgba(15,23,42,0.06)" },
  kpiTitle: { fontWeight: 900, color: "#0f172a" },
  kpiValue: { fontSize: 34, fontWeight: 900, marginTop: 8, color: "#0f172a" },
  kpiNote: { marginTop: 6, color: "#64748b", fontSize: 13 },

  filtersRow: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    flex: "1 1 280px",
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid #eaf0ff",
    background: "white",
    outline: "none",
    boxShadow: "0 6px 26px rgba(15,23,42,0.03)",
  },
  select: {
    flex: "0 1 260px",
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid #eaf0ff",
    background: "white",
    outline: "none",
    fontWeight: 800,
    color: "#0f172a",
  },

  panel: {
    marginTop: 14,
    background: "white",
    border: "1px solid #eaf0ff",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 8px 34px rgba(15,23,42,0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  panelTitle: { fontSize: 22, fontWeight: 900, color: "#0f172a" },
  panelSub: { marginTop: 4, color: "#64748b" },

  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid #eef2f7",
    marginTop: 10,
  },

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "#0f172a",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    display: "inline-block",
  },
  btnGhost: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "white",
    border: "1px solid #eaf0ff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnPrimarySm: {
    padding: "10px 16px",
    borderRadius: 14,
    background: "#2b5c94",
    color: "white",
    fontWeight: 900,
    border: "none",
    cursor: "pointer",
    minWidth: 92,
  },
  btnGhostSm: {
    padding: "10px 16px",
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
    minWidth: 92,
  },
  btnDots: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    fontSize: 20,
    lineHeight: "44px",
  },

  th: {
    textAlign: "left",
    padding: "12px 12px",
    background: "#f8fafc",
    fontSize: 12,
    color: "#334155",
    borderBottom: "1px solid #eef2f7",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
  },

  tip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #eef2f7",
    color: "#475569",
    fontSize: 13,
  },
};

const toneStyles = {
  danger: { bg: { background: "#fff1f2" }, dot: { background: "#ef4444" } },
  warn: { bg: { background: "#fff7ed" }, dot: { background: "#f59e0b" } },
  info: { bg: { background: "#eff6ff" }, dot: { background: "#3b82f6" } },
  ok: { bg: { background: "#ecfdf5" }, dot: { background: "#10b981" } },
};

const pillStyles: Record<Decision, React.CSSProperties> = {
  ORDER_NOW: { background: "#fee2e2", color: "#7f1d1d" },
  ORDER_SOON: { background: "#ffedd5", color: "#7c2d12" },
  OVERSTOCK: { background: "#dbeafe", color: "#1e3a8a" },
  HEALTHY: { background: "#dcfce7", color: "#14532d" },
};