"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import {
  loadDatasetV2,
  loadMappingV2,
  loadMovementTypeValueMappingV2WithDefault,
  toNumber,
  type DemoRow,
  type MovementsMapping,
  type MovementTypeValueMapping,
} from "@/lib/demoStore";

/* =========================================================
   Types
========================================================= */

type Decision = "ORDER_NOW" | "WATCH" | "REDUCE" | "DEAD" | "HEALTHY";

type Thresholds = {
  leadTimeDays: number; // user-defined
  safetyDays: number; // user-defined
  overstockDays: number; // user-defined
};

type RowOut = {
  sku: string;
  warehouse: string;

  onHand: number;
  out30d: number; // total OUT in last 30d
  avgDailyOut: number;
  daysCover: number;

  reorderPoint: number;
  targetStock: number;
  suggestedOrder: number;

  decision: Decision;
  severity: number; // 0..100

  lastMoveISO: string | null;
  evidence: Array<{ k: string; v: string; tone?: "cyan" | "amber" | "green" | "red" | "violet" | "steel" }>;
};

type StockKey = string; // `${sku}||${wh}`

/* =========================================================
   Threshold storage (localStorage) - isolated for Results
========================================================= */

const TH_KEY = "ide_thresholds_v2";

function clampInt(n: number, min: number, max: number): number {
  const v = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, v));
}

function normalizeThresholds(t?: Partial<Thresholds> | null): Thresholds {
  return {
    leadTimeDays: clampInt(Number(t?.leadTimeDays ?? 7), 0, 365),
    safetyDays: clampInt(Number(t?.safetyDays ?? 7), 0, 365),
    overstockDays: clampInt(Number(t?.overstockDays ?? 90), 1, 3650),
  };
}

function loadThresholdsLocal(): Thresholds {
  if (typeof window === "undefined") return normalizeThresholds();
  try {
    const raw = localStorage.getItem(TH_KEY);
    if (!raw) return normalizeThresholds();
    return normalizeThresholds(JSON.parse(raw));
  } catch {
    return normalizeThresholds();
  }
}

function saveThresholdsLocal(t: Thresholds) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TH_KEY, JSON.stringify(normalizeThresholds(t)));
  } catch {
    // ignore
  }
}

/* =========================================================
   Helpers
========================================================= */

function normToken(x: string): string {
  return (x ?? "").toString().trim().toLowerCase();
}

function parseDateISOish(x: string): number | null {
  const s = (x ?? "").toString().trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function daysBetween(msA: number, msB: number): number {
  const d = Math.floor((msB - msA) / (1000 * 60 * 60 * 24));
  return d;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round(n / 1000) / 1000}M`;
  if (abs >= 10_000) return `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function decisionLabel(d: Decision): string {
  switch (d) {
    case "ORDER_NOW":
      return "Order now";
    case "WATCH":
      return "Watch";
    case "REDUCE":
      return "Reduce";
    case "DEAD":
      return "Dead";
    case "HEALTHY":
      return "Healthy";
  }
}

function decisionTone(d: Decision): { bg: string; border: string; color: string } {
  switch (d) {
    case "ORDER_NOW":
      return { bg: "rgba(255,80,80,0.10)", border: "rgba(255,80,80,0.35)", color: "#ffd4d4" };
    case "WATCH":
      return { bg: "rgba(255,196,0,0.10)", border: "rgba(255,196,0,0.28)", color: "#ffe9b3" };
    case "REDUCE":
      return { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.28)", color: "#e6dcff" };
    case "DEAD":
      return { bg: "rgba(160,174,192,0.10)", border: "rgba(160,174,192,0.25)", color: "#d7dce6" };
    case "HEALTHY":
      return { bg: "rgba(80,255,170,0.08)", border: "rgba(80,255,170,0.22)", color: "#c8ffe9" };
  }
}

function chipTone(t?: string): { bg: string; border: string; color: string } {
  const tone = (t ?? "steel") as any;
  if (tone === "red") return { bg: "rgba(255,80,80,0.10)", border: "rgba(255,80,80,0.30)", color: "#ffd4d4" };
  if (tone === "amber") return { bg: "rgba(255,196,0,0.10)", border: "rgba(255,196,0,0.25)", color: "#ffe9b3" };
  if (tone === "green") return { bg: "rgba(80,255,170,0.08)", border: "rgba(80,255,170,0.20)", color: "#c8ffe9" };
  if (tone === "cyan") return { bg: "rgba(110,231,255,0.10)", border: "rgba(110,231,255,0.25)", color: "#d8f7ff" };
  if (tone === "violet") return { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)", color: "#e6dcff" };
  return { bg: "rgba(160,174,192,0.10)", border: "rgba(160,174,192,0.22)", color: "#d7dce6" };
}

function classifyMovement(
  rawType: string,
  mv: MovementTypeValueMapping
): "IN" | "OUT" | "OTHER" {
  const t = normToken(rawType);
  if (!t) return "OTHER";

  const inSet = new Set((mv?.inValues ?? []).map(normToken));
  const outSet = new Set((mv?.outValues ?? []).map(normToken));

  if (inSet.has(t)) return "IN";
  if (outSet.has(t)) return "OUT";
  return "OTHER";
}

/* =========================================================
   Page
========================================================= */

export default function ResultsPage() {
  const router = useRouter();

  const movements = typeof window !== "undefined" ? loadDatasetV2("movements") : null;
  const mappingV2 = typeof window !== "undefined" ? loadMappingV2() : null;
  const mvTypeValues =
    typeof window !== "undefined" ? loadMovementTypeValueMappingV2WithDefault() : null;

  // thresholds
  const initialT = typeof window !== "undefined" ? loadThresholdsLocal() : normalizeThresholds();
  const [leadTimeDays, setLeadTimeDays] = useState<number>(initialT.leadTimeDays);
  const [safetyDays, setSafetyDays] = useState<number>(initialT.safetyDays);
  const [overstockDays, setOverstockDays] = useState<number>(initialT.overstockDays);

  const [preset, setPreset] = useState<"CUSTOM" | "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("CUSTOM");

  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [search, setSearch] = useState<string>("");

  // persist thresholds
  useEffect(() => {
    const t = normalizeThresholds({ leadTimeDays, safetyDays, overstockDays });
    saveThresholdsLocal(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadTimeDays, safetyDays, overstockDays]);

  useEffect(() => {
    // keep preset label “honest”
    const t = normalizeThresholds({ leadTimeDays, safetyDays, overstockDays });
    const isCons = t.leadTimeDays === 14 && t.safetyDays === 14 && t.overstockDays === 60;
    const isBal = t.leadTimeDays === 7 && t.safetyDays === 7 && t.overstockDays === 90;
    const isAgg = t.leadTimeDays === 3 && t.safetyDays === 3 && t.overstockDays === 120;
    setPreset(isCons ? "CONSERVATIVE" : isBal ? "BALANCED" : isAgg ? "AGGRESSIVE" : "CUSTOM");
  }, [leadTimeDays, safetyDays, overstockDays]);

  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btnBase: CSSProperties = {
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
      transition: "transform 150ms ease, filter 150ms ease",
    };

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as CSSProperties,
      container: { maxWidth: 1150, margin: "0 auto", padding: "18px 20px 60px" } as CSSProperties,

      hero: { ...card, padding: 18, marginBottom: 16 } as CSSProperties,
      card,
      cardPad: { ...card, padding: 18 } as CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      } as CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as CSSProperties,
      title: { fontWeight: 900, letterSpacing: 0.2 } as CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,

      btnPrimary: { ...btnBase, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as CSSProperties,
      btnGhost: { ...btnBase, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as CSSProperties,
      btnSoft: {
        ...btnBase,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#e6e8ee",
      } as CSSProperties,

      pill: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#dfe3f1",
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
      } as CSSProperties,

      h1: { margin: "10px 0 8px", fontSize: 30, lineHeight: 1.15 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,

      grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 } as CSSProperties,

      statusRow: { marginTop: 12, color: "#aab1c4", fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" } as CSSProperties,

      badgeOk: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#c8ffe9",
        border: "1px solid rgba(80,255,170,0.22)",
        background: "rgba(80,255,170,0.08)",
      } as CSSProperties,

      badgeBad: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#ffd4d4",
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.10)",
      } as CSSProperties,

      controlGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 } as CSSProperties,

      field: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      label: { fontSize: 12, color: "#aab1c4", marginBottom: 8 } as CSSProperties,
      input: {
        width: "100%",
        padding: "10px 10px",
        borderRadius: 12,
        border: "1px solid #2a3350",
        background: "#0b0f1a",
        color: "#e6e8ee",
        outline: "none",
      } as CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" } as CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as CSSProperties,
      td: { padding: "12px 10px", fontSize: 13, color: "#c8cee0", verticalAlign: "top" } as CSSProperties,

      chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(160,174,192,0.22)",
        background: "rgba(160,174,192,0.10)",
        color: "#d7dce6",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      } as CSSProperties,

      small: { fontSize: 12, color: "#8f97ad", lineHeight: 1.5 } as CSSProperties,

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 } as CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as CSSProperties,
    };
  }, []);

  const hasMovements = !!movements?.rows?.length;
  const hasMapping =
    !!mappingV2?.itemId && !!mappingV2?.date && !!mappingV2?.qty && !!mappingV2?.movementType;

  const statusText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Upload ${hasMovements ? "✓" : "×"}`);
    parts.push(`Mapping ${hasMapping ? "✓" : "×"}`);
    parts.push(`Type Values ${mvTypeValues ? "✓" : "×"}`);
    return parts.join(" • ");
  }, [hasMovements, hasMapping, mvTypeValues]);

  const { rowsOut, warehouses, kpis } = useMemo(() => {
    const empty = {
      rowsOut: [] as RowOut[],
      warehouses: ["ALL"] as string[],
      kpis: {
        skuCount: 0,
        orderNow: 0,
        watch: 0,
        reduce: 0,
      },
    };

    if (!hasMovements || !hasMapping || !movements || !mappingV2 || !mvTypeValues) return empty;

    const tNow = Date.now();
    const t30 = tNow - 30 * 24 * 60 * 60 * 1000;

    const whCol = mappingV2.warehouse;
    const skuCol = mappingV2.itemId;
    const dtCol = mappingV2.date;
    const qtyCol = mappingV2.qty;
    const mtCol = mappingV2.movementType;

    // collect warehouses
    const whSet = new Set<string>();
    whSet.add("ALL");

    // aggregate movements into per sku||wh
    type Agg = {
      onHand: number;
      out30d: number;
      lastMove: number | null;
      hasAny: boolean;
    };

    const map = new Map<StockKey, Agg>();

    function getKey(sku: string, wh: string) {
      return `${sku}||${wh}`;
    }

    for (const r of movements.rows as DemoRow[]) {
      const sku = (r[skuCol] ?? "").toString().trim();
      if (!sku) continue;

      const wh = (whCol ? (r[whCol] ?? "").toString().trim() : "") || "ALL";
      if (wh && wh !== "ALL") whSet.add(wh);

      const dt = (r[dtCol] ?? "").toString().trim();
      const t = parseDateISOish(dt);

      const qtyRaw = (r[qtyCol] ?? "").toString();
      const qty = toNumber(qtyRaw);

      const mt = (r[mtCol] ?? "").toString().trim();
      const cls = classifyMovement(mt, mvTypeValues);

      const key = getKey(sku, wh);
      const a = map.get(key) ?? { onHand: 0, out30d: 0, lastMove: null, hasAny: false };

      // Stock logic (simple, robust):
      // IN adds, OUT subtracts, OTHER ignored for net stock (safe demo behavior)
      if (cls === "IN") a.onHand += Math.abs(qty);
      if (cls === "OUT") a.onHand -= Math.abs(qty);

      // consumption 30d: sum OUT abs qty by date
      if (cls === "OUT" && t !== null && t >= t30) {
        a.out30d += Math.abs(qty);
      }

      // last move
      if (t !== null) {
        a.lastMove = a.lastMove === null ? t : Math.max(a.lastMove, t);
      }

      a.hasAny = true;
      map.set(key, a);
    }

    const th = normalizeThresholds({ leadTimeDays, safetyDays, overstockDays });
    const reviewHorizon = Math.max(1, th.leadTimeDays + th.safetyDays);
    const overstockDaysN = Math.max(1, th.overstockDays);

    const out: RowOut[] = [];

    for (const [key, a] of map.entries()) {
      if (!a.hasAny) continue;

      const [sku, wh] = key.split("||");
      const onHand = a.onHand;

      const avgDailyOut = a.out30d / 30;
      const daysCover = avgDailyOut > 0 ? onHand / avgDailyOut : onHand > 0 ? 9999 : 0;

      const reorderPoint = avgDailyOut * reviewHorizon;
      const targetStock = avgDailyOut * (reviewHorizon + 7); // small buffer beyond ROP
      const suggestedOrder = Math.max(0, Math.ceil(targetStock - onHand));

      // decision rules (simple but “ops-real”)
      let decision: Decision = "HEALTHY";

      // DEAD: no consumption in 30d + stock sitting
      if (avgDailyOut === 0 && onHand > 0) decision = "DEAD";

      // ORDER_NOW: below reorder point OR negative/zero stock with demand
      if (avgDailyOut > 0 && onHand <= reorderPoint) decision = "ORDER_NOW";

      // WATCH: close to reorder point band
      if (avgDailyOut > 0 && onHand > reorderPoint && onHand <= reorderPoint * 1.35) decision = "WATCH";

      // REDUCE: too much cover vs policy
      if (avgDailyOut > 0 && daysCover >= overstockDaysN) decision = "REDUCE";
      if (avgDailyOut === 0 && onHand > 0 && daysCover >= overstockDaysN) decision = "REDUCE"; // sitting stock

      // HEALTHY fallback:
      if (onHand <= 0 && avgDailyOut === 0) decision = "HEALTHY";

      // severity 0..100
      let severity = 20;
      if (decision === "ORDER_NOW") {
        // deeper below ROP => higher severity
        const gap = reorderPoint - onHand;
        const denom = Math.max(1, reorderPoint);
        severity = clampInt((gap / denom) * 100, 55, 100);
      } else if (decision === "WATCH") {
        severity = 45;
      } else if (decision === "REDUCE") {
        severity = clampInt(((daysCover - overstockDaysN) / Math.max(1, overstockDaysN)) * 100, 40, 85);
      } else if (decision === "DEAD") {
        severity = 35;
      } else {
        severity = 18;
      }

      const lastMoveISO = a.lastMove ? new Date(a.lastMove).toISOString().slice(0, 10) : null;
      const lastMoveAge = a.lastMove ? daysBetween(a.lastMove, Date.now()) : null;

      const evidence: RowOut["evidence"] = [];

      if (decision === "ORDER_NOW") {
        evidence.push({ k: "Gap", v: `${formatNum(Math.max(0, reorderPoint - onHand))} to ROP`, tone: "red" });
        evidence.push({ k: "ROP", v: `${formatNum(reorderPoint)} units`, tone: "amber" });
      }

      evidence.push({ k: "On hand", v: `${formatNum(onHand)}`, tone: onHand <= 0 ? "red" : "cyan" });

      if (avgDailyOut > 0) {
        evidence.push({ k: "Avg/day", v: `${formatNum(avgDailyOut)}`, tone: "steel" });
        evidence.push({
          k: "Cover",
          v: daysCover >= 9999 ? "∞ days" : `${formatNum(daysCover)} d`,
          tone: decision === "REDUCE" ? "violet" : decision === "ORDER_NOW" ? "red" : "green",
        });
      } else {
        evidence.push({ k: "Out(30d)", v: `${formatNum(a.out30d)}`, tone: "steel" });
      }

      if (lastMoveISO) {
        evidence.push({
          k: "Last move",
          v: lastMoveAge === null ? lastMoveISO : `${lastMoveISO} (${lastMoveAge}d ago)`,
          tone: lastMoveAge !== null && lastMoveAge > 60 ? "amber" : "steel",
        });
      }

      if (decision === "REDUCE") {
        evidence.push({ k: "Policy", v: `>${overstockDaysN}d cover`, tone: "violet" });
      }

      if (decision === "DEAD") {
        evidence.push({ k: "Signal", v: "No consumption in 30d", tone: "amber" });
      }

      out.push({
        sku,
        warehouse: wh,
        onHand,
        out30d: a.out30d,
        avgDailyOut,
        daysCover: daysCover >= 9999 ? 9999 : daysCover,
        reorderPoint,
        targetStock,
        suggestedOrder,
        decision,
        severity,
        lastMoveISO,
        evidence,
      });
    }

    // sort: most urgent first
    out.sort((a, b) => {
      const dRank = (x: Decision) =>
        x === "ORDER_NOW" ? 1 : x === "WATCH" ? 2 : x === "REDUCE" ? 3 : x === "DEAD" ? 4 : 5;
      const ra = dRank(a.decision);
      const rb = dRank(b.decision);
      if (ra !== rb) return ra - rb;
      return b.severity - a.severity;
    });

    const whList = Array.from(whSet);
    whList.sort((a, b) => (a === "ALL" ? -1 : b === "ALL" ? 1 : a.localeCompare(b)));

    const k = {
      skuCount: new Set(out.map((r) => `${r.sku}||${r.warehouse}`)).size,
      orderNow: out.filter((r) => r.decision === "ORDER_NOW").length,
      watch: out.filter((r) => r.decision === "WATCH").length,
      reduce: out.filter((r) => r.decision === "REDUCE").length,
    };

    return { rowsOut: out, warehouses: whList, kpis: k };
  }, [hasMovements, hasMapping, movements, mappingV2, mvTypeValues, leadTimeDays, safetyDays, overstockDays]);

  const filtered = useMemo(() => {
    let x = rowsOut.slice();

    if (warehouseFilter !== "ALL") x = x.filter((r) => r.warehouse === warehouseFilter);
    if (decisionFilter !== "ALL") x = x.filter((r) => r.decision === decisionFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      x = x.filter((r) => r.sku.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q));
    }
    return x;
  }, [rowsOut, warehouseFilter, decisionFilter, search]);

  function applyPreset(p: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") {
    if (p === "CONSERVATIVE") {
      setLeadTimeDays(14);
      setSafetyDays(14);
      setOverstockDays(60);
    } else if (p === "BALANCED") {
      setLeadTimeDays(7);
      setSafetyDays(7);
      setOverstockDays(90);
    } else {
      setLeadTimeDays(3);
      setSafetyDays(3);
      setOverstockDays(120);
    }
  }

  const showMissing = !hasMovements || !hasMapping;

  return (
    <div style={styles.wrap}>
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Ops Control</div>
                <div style={styles.subtitle}>Actionable inventory signals (V2)</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-glow" style={styles.btnPrimary} type="button" onClick={() => router.push("/upload")}>
                Go to Upload
              </button>
              <button className="btn-glow" style={styles.btnGhost} type="button" onClick={() => router.push("/mapping")}>
                Go to Mapping
              </button>
              <button className="btn-glow" style={styles.btnSoft} type="button" onClick={() => router.push("/movement-types")}>
                Movement Types
              </button>
            </div>
          </div>

          {/* Hero */}
          <div className="anim-in anim-delay-2" style={styles.hero}>
            <span style={styles.pill}>⚡ Results</span>
            <h1 style={styles.h1}>Ops-ready decisions with evidence</h1>
            <p style={styles.p}>
              This page reads <b style={{ color: "#e6e8ee" }}>V2 Movements</b> + your <b style={{ color: "#e6e8ee" }}>V2 Mapping</b>.
              If anything is missing, it will show you exactly what’s missing.
            </p>

            {showMissing ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...styles.p, marginTop: 6 }}>
                  Missing demo data. Start from Upload (then Mapping) to generate results.
                </div>

                <div style={styles.row}>
                  <span style={styles.badgeBad}>Status: {statusText}</span>
                </div>

                <div style={{ ...styles.small, marginTop: 8 }}>
                  Mapping must include: <b>itemId</b>, <b>date</b>, <b>qty</b>, <b>movementType</b> (warehouse optional).
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={styles.statusRow}>
                  <span style={styles.badgeOk}>Status: {statusText}</span>
                  <span style={styles.small}>
                    Rows: <b style={{ color: "#e6e8ee" }}>{movements?.rows?.length ?? 0}</b> • Warehouses:{" "}
                    <b style={{ color: "#e6e8ee" }}>{warehouses.length - 1}</b>
                  </span>
                </div>

                {/* KPI row */}
                <div style={styles.kpiGrid}>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Lines</div>
                    <div style={styles.kpiValue}>{kpis.skuCount}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Order now</div>
                    <div style={styles.kpiValue}>{kpis.orderNow}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Watch</div>
                    <div style={styles.kpiValue}>{kpis.watch}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Reduce</div>
                    <div style={styles.kpiValue}>{kpis.reduce}</div>
                  </div>
                </div>

                {/* Controls */}
                <div style={styles.grid2}>
                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Policy thresholds</div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      You control these — no random assumptions.
                    </div>

                    <div style={styles.row}>
                      <button
                        className="btn-glow"
                        type="button"
                        style={preset === "CONSERVATIVE" ? styles.btnPrimary : styles.btnGhost}
                        onClick={() => applyPreset("CONSERVATIVE")}
                      >
                        Conservative
                      </button>
                      <button
                        className="btn-glow"
                        type="button"
                        style={preset === "BALANCED" ? styles.btnPrimary : styles.btnGhost}
                        onClick={() => applyPreset("BALANCED")}
                      >
                        Balanced
                      </button>
                      <button
                        className="btn-glow"
                        type="button"
                        style={preset === "AGGRESSIVE" ? styles.btnPrimary : styles.btnGhost}
                        onClick={() => applyPreset("AGGRESSIVE")}
                      >
                        Aggressive
                      </button>
                      <span style={styles.small}>Preset: <b style={{ color: "#e6e8ee" }}>{preset}</b></span>
                    </div>

                    <div style={styles.controlGrid}>
                      <div style={styles.field}>
                        <div style={styles.label}>Lead time days</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={leadTimeDays}
                          min={0}
                          max={365}
                          onChange={(e) => setLeadTimeDays(clampInt(Number(e.target.value), 0, 365))}
                        />
                        <div style={styles.small}>Used in reorder point.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Safety days</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={safetyDays}
                          min={0}
                          max={365}
                          onChange={(e) => setSafetyDays(clampInt(Number(e.target.value), 0, 365))}
                        />
                        <div style={styles.small}>Buffer against variability.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Overstock policy (days)</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={overstockDays}
                          min={1}
                          max={3650}
                          onChange={(e) => setOverstockDays(clampInt(Number(e.target.value), 1, 3650))}
                        />
                        <div style={styles.small}>Above this cover → Reduce.</div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Filters</div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Narrow down to a warehouse / decision / SKU search.
                    </div>

                    <div style={styles.controlGrid}>
                      <div style={styles.field}>
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
                        <div style={styles.small}>If your file has warehouse mapped.</div>
                      </div>

                      <div style={styles.field}>
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
                        <div style={styles.small}>Order Now first by default.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Search</div>
                        <input
                          style={styles.input}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="SKU / Warehouse..."
                        />
                        <div style={styles.small}>Case-insensitive contains.</div>
                      </div>
                    </div>

                    <div style={{ ...styles.small, marginTop: 10 }}>
                      Showing: <b style={{ color: "#e6e8ee" }}>{filtered.length}</b> rows
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Decision</th>
                        <th style={styles.th}>SKU</th>
                        <th style={styles.th}>WH</th>
                        <th style={styles.th}>On hand</th>
                        <th style={styles.th}>Out(30d)</th>
                        <th style={styles.th}>Cover</th>
                        <th style={styles.th}>ROP</th>
                        <th style={styles.th}>Suggested order</th>
                        <th style={styles.th}>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 250).map((r, idx) => {
                        const tone = decisionTone(r.decision);
                        return (
                          <tr key={`${r.sku}-${r.warehouse}-${idx}`} style={styles.tr}>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.chip,
                                  background: tone.bg,
                                  border: `1px solid ${tone.border}`,
                                  color: tone.color,
                                }}
                              >
                                {decisionLabel(r.decision)} • {r.severity}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{r.sku}</div>
                              <div style={styles.small}>{r.lastMoveISO ? `Last move: ${r.lastMoveISO}` : "Last move: —"}</div>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.chip}>{r.warehouse}</span>
                            </td>

                            <td style={styles.td}>{formatNum(r.onHand)}</td>
                            <td style={styles.td}>{formatNum(r.out30d)}</td>

                            <td style={styles.td}>
                              {r.daysCover >= 9999 ? "∞" : `${formatNum(r.daysCover)} d`}
                            </td>

                            <td style={styles.td}>{formatNum(r.reorderPoint)}</td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{formatNum(r.suggestedOrder)}</div>
                              <div style={styles.small}>Target: {formatNum(r.targetStock)}</div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {r.evidence.slice(0, 6).map((c, i) => {
                                  const ct = chipTone(c.tone);
                                  return (
                                    <span
                                      key={i}
                                      style={{
                                        ...styles.chip,
                                        background: ct.bg,
                                        border: `1px solid ${ct.border}`,
                                        color: ct.color,
                                      }}
                                    >
                                      {c.k}: {c.v}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ ...styles.small, marginTop: 10 }}>
                    Note: Showing max 250 rows for speed. Sorting priority: Order Now → Watch → Reduce → Dead → Healthy.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Global styles */}
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

            @keyframes fadeUp {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .btn-glow:hover {
              transform: translateY(-1px);
              filter: drop-shadow(0 10px 20px rgba(110, 231, 255, 0.2));
            }

            @media (prefers-reduced-motion: reduce) {
              .anim-in,
              .bg-breathe,
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