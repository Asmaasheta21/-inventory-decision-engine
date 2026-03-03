"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

import {
  loadDatasetV2,
  loadMappingV2,
  loadMovementTypeValueMappingV2WithDefault,
  type MovementsMapping,
} from "@/lib/demoStore";

import { runEngineV2, getDefaultEngineParams, type LineOut } from "@/lib/engineV2";

/* =========================================================
   Types (UI)
========================================================= */

type Decision = "ORDER_NOW" | "WATCH" | "REDUCE" | "DEAD" | "HEALTHY";

type Thresholds = {
  leadTimeDays: number;
  safetyDays: number;
  overstockDays: number;
};

type EvidenceTone = "cyan" | "amber" | "green" | "red" | "violet" | "steel";
type EvidenceChip = { k: string; v: string; tone?: EvidenceTone };

type Advice = {
  headline: string;
  bullets: string[];
  nextReviewDays: number;
  confidence: "High" | "Medium" | "Low";
  proLockedBullets?: string[]; // shown as “Pro”
};

type RowOut = {
  sku: string;
  warehouse: string;

  onHand: number;

  out30d: number;
  out90d: number;

  avgDailyOut: number;
  daysCover: number;

  reorderPoint: number;
  targetStock: number;
  suggestedOrder: number;

  decision: Decision;
  severity: number; // 0..100

  lastMoveISO: string | null;

  evidence: EvidenceChip[];

  // signals
  profile: string;
  trend: number;
  cv30: number;
  activeDays30: number;
  loss30: number;
  lossRate30: number;

  advice: Advice;
};

/* =========================================================
   Threshold storage (localStorage)
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
   Formatting
========================================================= */

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 100) / 100}M`;
  if (abs >= 10_000) return `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function percent(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n * 1000) / 10}%`;
}

/* =========================================================
   Decision label + tones (more professional)
========================================================= */

function decisionLabel(d: Decision): string {
  switch (d) {
    case "ORDER_NOW":
      return "Order";
    case "WATCH":
      return "Monitor";
    case "REDUCE":
      return "Reduce";
    case "DEAD":
      return "Dead stock";
    case "HEALTHY":
      return "Healthy";
  }
}

function decisionShort(d: Decision): string {
  // compact label for chips / KPIs
  switch (d) {
    case "ORDER_NOW":
      return "Order";
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

function chipTone(t?: EvidenceTone): { bg: string; border: string; color: string } {
  const tone = (t ?? "steel") as EvidenceTone;
  if (tone === "red") return { bg: "rgba(255,80,80,0.10)", border: "rgba(255,80,80,0.30)", color: "#ffd4d4" };
  if (tone === "amber") return { bg: "rgba(255,196,0,0.10)", border: "rgba(255,196,0,0.25)", color: "#ffe9b3" };
  if (tone === "green") return { bg: "rgba(80,255,170,0.08)", border: "rgba(80,255,170,0.20)", color: "#c8ffe9" };
  if (tone === "cyan") return { bg: "rgba(110,231,255,0.10)", border: "rgba(110,231,255,0.25)", color: "#d8f7ff" };
  if (tone === "violet") return { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)", color: "#e6dcff" };
  return { bg: "rgba(160,174,192,0.10)", border: "rgba(160,174,192,0.22)", color: "#d7dce6" };
}

/* =========================================================
   Advice generation (improved wording)
========================================================= */

function buildAdvice(
  line: LineOut,
  th: Thresholds,
  decision: Decision,
  suggestedOrder: number,
  daysCover: number
): Advice {
  // confidence: based on activity + volatility
  const activity = line.activeDemandDays30;
  const cv = line.cv30;
  const conf: Advice["confidence"] =
    activity >= 10 && cv < 1.0 ? "High" : activity >= 5 ? "Medium" : "Low";

  const hasLoss = line.loss30 > 0;
  const lossRate30 = line.out30 + line.loss30 > 0 ? line.loss30 / (line.out30 + line.loss30) : 0;

  const commonPro = [
    "Transfer recommendation before buying (multi-location balancing).",
    "Supplier lead-time learning + reorder calendar.",
    "Alerts: notify when a SKU enters Order/Reduce bands.",
  ];

  if (decision === "ORDER_NOW") {
    const bullets: string[] = [];
    if (suggestedOrder > 0) {
      bullets.push(`Release a PO for ~${formatNum(suggestedOrder)} units to reach the target position.`);
    } else {
      bullets.push("Signal is urgent but suggested qty is 0 — verify mapping and policy inputs.");
    }

    bullets.push(`Confirm policy inputs: lead time (${th.leadTimeDays}d) and safety buffer (${th.safetyDays}d).`);
    bullets.push("Validate on-hand (cycle count / reconciliation) before committing.");
    if (line.trend30vsPrev30 > 0.2) bullets.push("Demand is accelerating → prioritize earlier placement.");
    if (cv >= 1.2) bullets.push("High variability → consider split deliveries to reduce risk.");
    if (hasLoss) bullets.push(`Loss detected: ${formatNum(line.loss30)} (${percent(lossRate30)}) → investigate root cause.`);

    return {
      headline: "Immediate replenishment required (stockout risk).",
      bullets,
      nextReviewDays: Math.max(1, Math.round(th.leadTimeDays / 2) || 1),
      confidence: conf,
      proLockedBullets: commonPro,
    };
  }

  if (decision === "WATCH") {
    const bullets: string[] = [];
    bullets.push("Hold purchase. Monitor consumption and receipts over the next cycle.");
    bullets.push("If a known demand spike is expected, upgrade to Order immediately.");
    bullets.push("Review supplier reliability—late deliveries increase stockout exposure.");
    if (cv >= 1.2) bullets.push("High variability → shorten the review cycle.");
    if (line.trend30vsPrev30 > 0.2) bullets.push("Demand trending up → prepare PO draft / pre-approval.");
    if (hasLoss) bullets.push(`Loss signal present (${percent(lossRate30)}) → address loss drivers before over-ordering.`);

    return {
      headline: "Monitor closely (approaching reorder band).",
      bullets,
      nextReviewDays: 3,
      confidence: conf,
      proLockedBullets: commonPro,
    };
  }

  if (decision === "REDUCE") {
    const bullets: string[] = [];
    bullets.push("Pause or slow purchasing until cover returns within policy.");
    bullets.push("Identify reduction path: alternative channel, internal consumption, or controlled markdown.");
    bullets.push("Check for duplicated stock across locations (consolidation opportunity).");
    if (daysCover > th.overstockDays * 1.5) bullets.push("Cover is materially above policy → escalate liquidation planning.");
    if (line.out30 > 0) bullets.push("Demand exists → reduce gradually to protect service level.");
    if (hasLoss) bullets.push(`Loss present (${percent(lossRate30)}) → overstock + loss compounds cost; prioritize containment.`);

    return {
      headline: "Reduce position (excess cover / cash trapped).",
      bullets,
      nextReviewDays: 7,
      confidence: conf,
      proLockedBullets: [
        "Markdown simulator: estimate margin impact vs cash release.",
        "Transfer optimizer: move stock to highest-demand locations.",
        ...commonPro,
      ],
    };
  }

  if (decision === "DEAD") {
    const bullets: string[] = [];
    bullets.push("Freeze purchasing immediately.");
    bullets.push("Confirm the absence of demand (mapping gaps / substitutions can hide consumption).");
    bullets.push("Select disposition path: supplier return, internal usage, liquidation, or write-off.");
    bullets.push("If SKU is newly introduced, set a review window before classifying as dead.");
    if (hasLoss) bullets.push("Loss signal present → ensure losses are not being misread as demand.");

    return {
      headline: "Dead stock risk (no active demand).",
      bullets,
      nextReviewDays: 14,
      confidence: conf,
      proLockedBullets: [
        "Dead-stock playbook: salvage value + write-off recommendation.",
        "Root-cause detection (mapping gaps / substitution patterns).",
        ...commonPro,
      ],
    };
  }

  // HEALTHY
  {
    const bullets: string[] = [];
    bullets.push("No action required. Maintain current policy thresholds.");
    bullets.push("If seasonality or known demand shift is expected, adjust policy temporarily.");
    if (line.trend30vsPrev30 < -0.25) bullets.push("Demand declining → monitor for emerging overstock risk.");
    if (cv >= 1.2) bullets.push("High variability → keep tighter monitoring even if healthy today.");
    if (hasLoss) bullets.push(`Loss detected (${percent(lossRate30)}) → fix process to avoid distorting future decisions.`);

    return {
      headline: "Healthy position (within policy).",
      bullets,
      nextReviewDays: 14,
      confidence: conf,
      proLockedBullets: commonPro,
    };
  }
}

/* =========================================================
   Decision logic (same math, better evidence wording)
========================================================= */

function computeDecisionFromLine(
  line: LineOut,
  th: Thresholds
): Omit<RowOut, "sku" | "warehouse" | "lastMoveISO" | "advice"> {
  const profile = line.profile;

  const avgCalendar = line.avgDailyOutCalendar30;
  const avgActive = line.avgDailyOutActive30;

  const chosenAvg =
    profile === "INTERMITTENT" || profile === "LUMPY" ? Math.max(avgCalendar, avgActive) : avgCalendar;

  const cv = line.cv30;
  const volFactor =
    profile === "LUMPY"
      ? 1.35
      : profile === "INTERMITTENT"
        ? 1.2
        : profile === "DECLINING"
          ? 0.95
          : 1.0;

  const variabilityBump = 1 + Math.min(0.75, Math.max(0, cv)) * 0.35;

  const trend = line.trend30vsPrev30;
  const trendFactor =
    trend > 0 ? 1 + Math.min(0.4, trend) * 0.25 : 1 + Math.max(-0.3, trend) * 0.15;

  const reviewHorizon = Math.max(1, th.leadTimeDays + th.safetyDays);

  const reorderPoint = chosenAvg * reviewHorizon * volFactor * variabilityBump * trendFactor;
  const targetStock = reorderPoint * 1.15;

  const onHand = line.onHand;
  const suggestedOrder = Math.max(0, Math.ceil(targetStock - onHand));

  const daysCover = chosenAvg > 0 ? onHand / chosenAvg : onHand > 0 ? 9999 : 0;
  const overstockDays = Math.max(1, th.overstockDays);

  const loss30 = line.loss30;
  const lossRate30 = line.out30 + loss30 > 0 ? loss30 / (line.out30 + loss30) : 0;

  let decision: Decision = "HEALTHY";

  const hasDemand = line.out30 > 0 || chosenAvg > 0;

  if (onHand < 0) decision = "ORDER_NOW";
  if (hasDemand && onHand <= reorderPoint) decision = "ORDER_NOW";
  if (hasDemand && onHand > reorderPoint && onHand <= reorderPoint * 1.25) decision = "WATCH";

  if (!hasDemand && onHand > 0) decision = "DEAD";

  if (chosenAvg > 0 && daysCover >= overstockDays) decision = "REDUCE";
  if (!hasDemand && onHand > 0 && daysCover >= overstockDays) decision = "REDUCE";

  let severity = 18;

  if (decision === "ORDER_NOW") {
    const gap = reorderPoint - onHand;
    const denom = Math.max(1, reorderPoint);
    severity = clampInt((gap / denom) * 100, 60, 100);
    if (onHand < 0) severity = 100;
  } else if (decision === "WATCH") {
    severity = 45;
  } else if (decision === "REDUCE") {
    severity = clampInt(((daysCover - overstockDays) / Math.max(1, overstockDays)) * 100, 40, 85);
  } else if (decision === "DEAD") {
    severity = 35;
  } else {
    severity = 18;
  }

  const evidence: EvidenceChip[] = [];

  evidence.push({
    k: "Profile",
    v: profile,
    tone: profile === "LUMPY" ? "amber" : profile === "DECLINING" ? "steel" : "green",
  });

  evidence.push({ k: "On hand", v: `${formatNum(onHand)}`, tone: onHand <= 0 ? "red" : "cyan" });
  evidence.push({ k: "Out (30d)", v: `${formatNum(line.out30)}`, tone: "steel" });
  evidence.push({ k: "Out (90d)", v: `${formatNum(line.out90)}`, tone: "steel" });

  evidence.push({
    k: "Avg/day",
    v: `${formatNum(chosenAvg)}`,
    tone: profile === "INTERMITTENT" || profile === "LUMPY" ? "amber" : "steel",
  });

  evidence.push({
    k: "Cover",
    v: daysCover >= 9999 ? "∞" : `${formatNum(daysCover)} d`,
    tone: decision === "REDUCE" ? "violet" : decision === "ORDER_NOW" ? "red" : "green",
  });

  evidence.push({
    k: "ROP",
    v: `${formatNum(reorderPoint)}`,
    tone: decision === "ORDER_NOW" ? "red" : "amber",
  });

  evidence.push({
    k: "Trend",
    v: trend >= 0 ? `+${formatNum(trend)}` : `${formatNum(trend)}`,
    tone: trend > 0.25 ? "amber" : trend < -0.25 ? "steel" : "green",
  });

  evidence.push({
    k: "Variability",
    v: `CV ${formatNum(cv)}`,
    tone: cv >= 1.2 ? "amber" : cv >= 0.7 ? "steel" : "green",
  });

  evidence.push({
    k: "Active days",
    v: `${line.activeDemandDays30}/30`,
    tone: line.activeDemandDays30 <= 6 ? "amber" : "steel",
  });

  if (loss30 > 0) evidence.push({ k: "Loss (30d)", v: `${formatNum(loss30)} (${percent(lossRate30)})`, tone: "amber" });
  if (decision === "ORDER_NOW" && suggestedOrder > 0) evidence.push({ k: "Suggested", v: `${formatNum(suggestedOrder)} units`, tone: "red" });

  return {
    onHand,
    out30d: line.out30,
    out90d: line.out90,

    avgDailyOut: chosenAvg,
    daysCover,

    reorderPoint,
    targetStock,
    suggestedOrder,

    decision,
    severity,

    evidence,

    profile,
    trend,
    cv30: cv,
    activeDays30: line.activeDemandDays30,
    loss30,
    lossRate30,
  };
}

/* =========================================================
   Page
========================================================= */

export default function ResultsPage() {
  const router = useRouter();

  // Demo paywall flag (later you replace with real subscription check)
  const isPro = false;

  const movements = typeof window !== "undefined" ? loadDatasetV2("movements") : null;
  const mappingV2: MovementsMapping | null = typeof window !== "undefined" ? loadMappingV2() : null;
  const mvTypeValues = typeof window !== "undefined" ? loadMovementTypeValueMappingV2WithDefault() : null;

  const initialT = typeof window !== "undefined" ? loadThresholdsLocal() : normalizeThresholds();
  const [leadTimeDays, setLeadTimeDays] = useState<number>(initialT.leadTimeDays);
  const [safetyDays, setSafetyDays] = useState<number>(initialT.safetyDays);
  const [overstockDays, setOverstockDays] = useState<number>(initialT.overstockDays);

  const [preset, setPreset] = useState<"CUSTOM" | "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("CUSTOM");

  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "ALL">("ALL");
  const [search, setSearch] = useState<string>("");

  // UI states
  const [openKey, setOpenKey] = useState<string | null>(null); // drawer
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = normalizeThresholds({ leadTimeDays, safetyDays, overstockDays });
    saveThresholdsLocal(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadTimeDays, safetyDays, overstockDays]);

  useEffect(() => {
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

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as CSSProperties,
      container: { maxWidth: 1250, margin: "0 auto", padding: "18px 20px 60px" } as CSSProperties,

      hero: { ...card, padding: 18, marginBottom: 16 } as CSSProperties,
      card,
      cardPad: { ...card, padding: 18 } as CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
      } as CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as CSSProperties,
      title: { fontWeight: 950, letterSpacing: 0.2 } as CSSProperties,
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
      } as CSSProperties,

      h1: { margin: "10px 0 8px", fontSize: 30, lineHeight: 1.15 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,
      small: { fontSize: 12, color: "#8f97ad", lineHeight: 1.55 } as CSSProperties,

      grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 } as CSSProperties,

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

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 } as CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 1100 } as CSSProperties,
      thead: { position: "sticky", top: 0, zIndex: 2 } as CSSProperties,
      th: {
        textAlign: "left",
        fontSize: 12,
        color: "#aab1c4",
        fontWeight: 900,
        padding: "10px 10px",
        background: "rgba(10,14,24,0.75)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #1b2340",
      } as CSSProperties,

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

      adviceBox: {
        border: "1px solid #202946",
        background: "rgba(20,27,48,0.45)",
        borderRadius: 14,
        padding: 10,
      } as CSSProperties,

      adviceTitle: { fontWeight: 950, color: "#e6e8ee", fontSize: 13 } as CSSProperties,
      adviceText: { marginTop: 6, color: "#b7bed1", fontSize: 12, lineHeight: 1.5 } as CSSProperties,

      overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 14,
      } as CSSProperties,

      drawer: {
        width: "min(980px, 100%)",
        borderRadius: 20,
        border: "1px solid #1b2340",
        background: "linear-gradient(180deg, rgba(18,24,43,0.96), rgba(12,16,28,0.96))",
        boxShadow: "0 25px 80px rgba(0,0,0,0.55)",
        overflow: "hidden",
      } as CSSProperties,

      drawerHead: {
        padding: 16,
        borderBottom: "1px solid #1b2340",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      } as CSSProperties,

      drawerBody: { padding: 16 } as CSSProperties,

      split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as CSSProperties,

      proLock: {
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        border: "1px dashed rgba(167,139,250,0.55)",
        background: "rgba(167,139,250,0.08)",
        color: "#e6dcff",
      } as CSSProperties,
    };
  }, []);

  const hasMovements = !!movements?.rows?.length;
  const hasMapping = !!mappingV2?.itemId && !!mappingV2?.date && !!mappingV2?.qty && !!mappingV2?.movementType;
  const showMissing = !hasMovements || !hasMapping || !mvTypeValues;

  const statusText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Data ${hasMovements ? "✓" : "×"}`);
    parts.push(`Mapping ${hasMapping ? "✓" : "×"}`);
    parts.push(`Type values ${mvTypeValues ? "✓" : "×"}`);
    return parts.join(" • ");
  }, [hasMovements, hasMapping, mvTypeValues]);

  const th = useMemo(
    () => normalizeThresholds({ leadTimeDays, safetyDays, overstockDays }),
    [leadTimeDays, safetyDays, overstockDays]
  );

  const { rowsOut, warehouses, kpis, warnings, topPlaybook } = useMemo(() => {
    const empty = {
      rowsOut: [] as RowOut[],
      warehouses: ["ALL"] as string[],
      warnings: [] as string[],
      kpis: { skuCount: 0, orderNow: 0, watch: 0, reduce: 0 },
      topPlaybook: [] as string[],
    };

    if (!movements || !mappingV2 || !mvTypeValues) return empty;

    const engine = runEngineV2({
      movements: { headers: movements.headers, rows: movements.rows },
      mapping: mappingV2,
      mvTypes: mvTypeValues,
      params: {
        ...getDefaultEngineParams(),
        w90: 90,
        lossTokens: ["scrap", "waste", "reject", "quality", "damage", "loss"],
      },
    });

    if (!engine.ok) {
      return {
        ...empty,
        warnings: engine.errors.length ? engine.errors : engine.warnings,
      };
    }

    const out: RowOut[] = engine.lines.map((ln: LineOut) => {
      const core = computeDecisionFromLine(ln, th);
      const advice = buildAdvice(ln, th, core.decision, core.suggestedOrder, core.daysCover);

      return {
        sku: ln.sku,
        warehouse: ln.warehouse,
        onHand: core.onHand,
        out30d: core.out30d,
        out90d: core.out90d,
        avgDailyOut: core.avgDailyOut,
        daysCover: core.daysCover,
        reorderPoint: core.reorderPoint,
        targetStock: core.targetStock,
        suggestedOrder: core.suggestedOrder,
        decision: core.decision,
        severity: core.severity,
        lastMoveISO: ln.lastMoveISO,
        evidence: core.evidence,
        profile: core.profile,
        trend: core.trend,
        cv30: core.cv30,
        activeDays30: core.activeDays30,
        loss30: core.loss30,
        lossRate30: core.lossRate30,
        advice,
      };
    });

    out.sort((a, b) => {
      const dRank = (x: Decision) =>
        x === "ORDER_NOW" ? 1 : x === "WATCH" ? 2 : x === "REDUCE" ? 3 : x === "DEAD" ? 4 : 5;
      const ra = dRank(a.decision);
      const rb = dRank(b.decision);
      if (ra !== rb) return ra - rb;
      return b.severity - a.severity;
    });

    const whList = ["ALL", ...engine.warehouses.filter((w) => w !== "ALL")];

    const k = {
      skuCount: new Set(out.map((r) => `${r.sku}||${r.warehouse}`)).size,
      orderNow: out.filter((r) => r.decision === "ORDER_NOW").length,
      watch: out.filter((r) => r.decision === "WATCH").length,
      reduce: out.filter((r) => r.decision === "REDUCE").length,
    };

    const playbook: string[] = [];
    if (k.orderNow) playbook.push(`Authorize replenishment for critical lines (Order): ${k.orderNow}.`);
    if (k.reduce) playbook.push(`Freeze purchasing for excess lines (Reduce): ${k.reduce}. Initiate reduction plan.`);
    if (k.watch) playbook.push(`Set short review cadence for monitor lines: ${k.watch} (e.g., every 3 days).`);

    return { rowsOut: out, warehouses: whList, warnings: engine.warnings, kpis: k, topPlaybook: playbook };
  }, [movements, mappingV2, mvTypeValues, th]);

  const filtered = useMemo(() => {
    let x = rowsOut.slice();

    if (warehouseFilter !== "ALL") x = x.filter((r) => r.warehouse === warehouseFilter);
    if (decisionFilter !== "ALL") x = x.filter((r) => r.decision === decisionFilter);

    const q = search.trim().toLowerCase();
    if (q) x = x.filter((r) => r.sku.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q));

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

  const opened = useMemo(() => {
    if (!openKey) return null;
    return rowsOut.find((r) => `${r.sku}||${r.warehouse}` === openKey) ?? null;
  }, [openKey, rowsOut]);

  return (
    <div style={styles.wrap}>
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory State • Ops Control</div>
                <div style={styles.subtitle}>Policy-driven actions with evidence (V2)</div>
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
            <h1 style={styles.h1}>Inventory state intelligence — ranked actions with accountable rationale</h1>
            <p style={styles.p}>
              This view classifies each line into an operational state (risk / excess / no-demand / healthy), then produces a{" "}
              <b style={{ color: "#e6e8ee" }}>priority execution list</b>. Each action includes recommended next steps,
              review cadence, and signal evidence.
            </p>

            {showMissing ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...styles.p, marginTop: 6 }}>
                  Workflow not ready. Complete: Upload → Mapping → Movement Types to generate decisions.
                </div>
                <div style={styles.row}>
                  <span style={styles.badgeBad}>Workflow readiness: {statusText}</span>
                </div>
                <div style={{ ...styles.small, marginTop: 8 }}>
                  Required mapping fields: <b>itemId</b>, <b>date</b>, <b>qty</b>, <b>movementType</b> (warehouse optional).
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={styles.statusRow}>
                  <span style={styles.badgeOk}>Workflow readiness: {statusText}</span>
                  {warnings?.length ? (
                    <span style={{ ...styles.small, color: "#ffe9b3" }}>⚠ {warnings.slice(0, 2).join(" • ")}</span>
                  ) : (
                    <span style={styles.small}>Engine OK • Evidence + advice enabled</span>
                  )}
                </div>

                {/* KPI row */}
                <div style={styles.kpiGrid}>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Lines</div>
                    <div style={styles.kpiValue}>{kpis.skuCount}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Order</div>
                    <div style={styles.kpiValue}>{kpis.orderNow}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Monitor</div>
                    <div style={styles.kpiValue}>{kpis.watch}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Reduce</div>
                    <div style={styles.kpiValue}>{kpis.reduce}</div>
                  </div>
                </div>

                {/* Summary blocks */}
                <div style={styles.grid3}>
                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Execution playbook (today)</div>
                    <div style={{ ...styles.small, marginTop: 8 }}>
                      {topPlaybook.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: "#c8cee0" }}>
                          {topPlaybook.slice(0, 3).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      ) : (
                        "No urgent actions detected. Maintain routine review cadence."
                      )}
                    </div>
                  </div>

                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Policy controls</div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      You control thresholds explicitly. The engine applies them consistently (no hidden assumptions).
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
                      <span style={styles.small}>
                        Preset: <b style={{ color: "#e6e8ee" }}>{preset}</b>
                      </span>
                    </div>

                    <div style={styles.controlGrid}>
                      <div style={styles.field}>
                        <div style={styles.label}>Lead time (days)</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={leadTimeDays}
                          min={0}
                          max={365}
                          onChange={(e) => setLeadTimeDays(clampInt(Number(e.target.value), 0, 365))}
                        />
                        <div style={styles.small}>Used to define reorder exposure window.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Safety buffer (days)</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={safetyDays}
                          min={0}
                          max={365}
                          onChange={(e) => setSafetyDays(clampInt(Number(e.target.value), 0, 365))}
                        />
                        <div style={styles.small}>Buffers demand variability.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Overstock policy (days of cover)</div>
                        <input
                          style={styles.input}
                          type="number"
                          value={overstockDays}
                          min={1}
                          max={3650}
                          onChange={(e) => setOverstockDays(clampInt(Number(e.target.value), 1, 3650))}
                        />
                        <div style={styles.small}>Above this cover ⇒ Reduce action.</div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Filters</div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Focus by warehouse, action type, or SKU to execute faster.
                    </div>

                    <div style={styles.controlGrid}>
                      <div style={styles.field}>
                        <div style={styles.label}>Warehouse</div>
                        <select style={styles.input} value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                          {warehouses.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                        <div style={styles.small}>Warehouse mapping is optional.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Action</div>
                        <select style={styles.input} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as any)}>
                          <option value="ALL">ALL</option>
                          <option value="ORDER_NOW">ORDER</option>
                          <option value="WATCH">MONITOR</option>
                          <option value="REDUCE">REDUCE</option>
                          <option value="DEAD">DEAD</option>
                          <option value="HEALTHY">HEALTHY</option>
                        </select>
                        <div style={styles.small}>Priority: Order → Monitor → Reduce → Dead → Healthy.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Search</div>
                        <input
                          style={styles.input}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search SKU / Warehouse…"
                        />
                        <div style={styles.small}>Case-insensitive contains.</div>
                      </div>
                    </div>

                    <div style={{ ...styles.small, marginTop: 10 }}>
                      Rows shown: <b style={{ color: "#e6e8ee" }}>{filtered.length}</b>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead style={styles.thead as any}>
                      <tr>
                        <th style={styles.th}>Action</th>
                        <th style={styles.th}>SKU</th>
                        <th style={styles.th}>WH</th>
                        <th style={styles.th}>On hand</th>
                        <th style={styles.th}>Out (30d)</th>
                        <th style={styles.th}>Cover</th>
                        <th style={styles.th}>ROP</th>
                        <th style={styles.th}>Suggested</th>
                        <th style={styles.th}>Next steps</th>
                        <th style={styles.th}>Evidence</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.slice(0, 250).map((r, idx) => {
                        const key = `${r.sku}||${r.warehouse}`;
                        const tone = decisionTone(r.decision);

                        const showAll = !!expandedEvidence[key];
                        const chips = showAll ? r.evidence : r.evidence.slice(0, 4);

                        return (
                          <tr key={`${key}-${idx}`} style={styles.tr}>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.chip,
                                  background: tone.bg,
                                  border: `1px solid ${tone.border}`,
                                  color: tone.color,
                                }}
                              >
                                {decisionShort(r.decision)} • {r.severity}
                              </span>

                              <div style={{ marginTop: 10 }}>
                                <button
                                  className="btn-glow"
                                  type="button"
                                  style={{ ...styles.btnSoft, padding: "8px 10px", borderRadius: 10, fontWeight: 900 }}
                                  onClick={() => setOpenKey(key)}
                                >
                                  View details
                                </button>
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{r.sku}</div>
                              <div style={styles.small}>{r.lastMoveISO ? `Last activity: ${r.lastMoveISO}` : "Last activity: —"}</div>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.chip}>{r.warehouse}</span>
                            </td>

                            <td style={styles.td}>{formatNum(r.onHand)}</td>
                            <td style={styles.td}>{formatNum(r.out30d)}</td>
                            <td style={styles.td}>{r.daysCover >= 9999 ? "∞" : `${formatNum(r.daysCover)} d`}</td>
                            <td style={styles.td}>{formatNum(r.reorderPoint)}</td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{formatNum(r.suggestedOrder)}</div>
                              <div style={styles.small}>Target: {formatNum(r.targetStock)}</div>
                            </td>

                            {/* Advice column */}
                            <td style={styles.td}>
                              <div style={styles.adviceBox}>
                                <div style={styles.adviceTitle}>{r.advice.headline}</div>
                                <div style={styles.adviceText}>
                                  • {r.advice.bullets[0] ?? "—"}
                                  <br />
                                  <span style={{ color: "#8f97ad" }}>
                                    Review: {r.advice.nextReviewDays}d • Confidence: {r.advice.confidence}
                                  </span>
                                </div>

                                {!isPro && r.advice.proLockedBullets?.length ? (
                                  <div style={{ marginTop: 8, ...styles.small, color: "#e6dcff" }}>
                                    🔒 Pro adds: transfers, alerts, what-if guidance
                                  </div>
                                ) : null}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {chips.map((c, i) => {
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

                                {r.evidence.length > 4 ? (
                                  <button
                                    className="btn-glow"
                                    type="button"
                                    style={{ ...styles.btnGhost, padding: "7px 10px", borderRadius: 999, fontWeight: 900 }}
                                    onClick={() => setExpandedEvidence((s) => ({ ...s, [key]: !s[key] }))}
                                  >
                                    {showAll ? "Less" : `More (${r.evidence.length - 4})`}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ ...styles.small, marginTop: 10 }}>
                    Performance note: results are capped to 250 rows for demo speed. Sorting is governed by action priority and severity.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drawer / Modal */}
          {opened ? (
            <div style={styles.overlay} onClick={() => setOpenKey(null)}>
              <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
                <div style={styles.drawerHead}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18, color: "#e6e8ee" }}>
                      {opened.sku} • <span style={{ color: "#aab1c4" }}>{opened.warehouse}</span>
                    </div>
                    <div style={{ marginTop: 6, color: "#b7bed1", lineHeight: 1.6 }}>
                      <b style={{ color: "#e6e8ee" }}>{decisionLabel(opened.decision)}</b> • severity {opened.severity} •{" "}
                      {opened.lastMoveISO ? `Last activity ${opened.lastMoveISO}` : "Last activity —"}
                    </div>
                  </div>

                  <button className="btn-glow" type="button" style={styles.btnGhost} onClick={() => setOpenKey(null)}>
                    Close
                  </button>
                </div>

                <div style={styles.drawerBody}>
                  <div style={styles.split} className="drawer-split">
                    <div style={{ ...styles.cardPad }}>
                      <div style={{ fontWeight: 950 }}>Key metrics</div>
                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <KV k="On hand" v={formatNum(opened.onHand)} />
                        <KV k="Out (30d)" v={formatNum(opened.out30d)} />
                        <KV k="Avg/day OUT" v={formatNum(opened.avgDailyOut)} />
                        <KV k="Cover" v={opened.daysCover >= 9999 ? "∞" : `${formatNum(opened.daysCover)} d`} />
                        <KV k="ROP" v={formatNum(opened.reorderPoint)} />
                        <KV k="Target stock" v={formatNum(opened.targetStock)} />
                        <KV k="Suggested order" v={formatNum(opened.suggestedOrder)} />
                        <KV k="Review cadence" v={`${opened.advice.nextReviewDays} days`} />
                      </div>

                      <div style={{ marginTop: 12, ...styles.small }}>
                        Confidence reflects signal reliability (activity + variability). Use it to calibrate urgency and review cadence.
                      </div>
                    </div>

                    <div style={{ ...styles.cardPad }}>
                      <div style={{ fontWeight: 950 }}>Recommended next steps</div>
                      <div style={{ marginTop: 10, color: "#b7bed1", lineHeight: 1.7 }}>
                        <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{opened.advice.headline}</div>
                        <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                          {opened.advice.bullets.slice(0, 6).map((b, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                              {b}
                            </li>
                          ))}
                        </ul>

                        {!isPro && opened.advice.proLockedBullets?.length ? (
                          <div style={styles.proLock}>
                            <div style={{ fontWeight: 950 }}>🔒 Pro guidance (locked)</div>
                            <div style={{ marginTop: 8, ...styles.small, color: "#e6dcff" }}>
                              {opened.advice.proLockedBullets.slice(0, 3).map((x, i) => (
                                <div key={i}>• {x}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 950 }}>Evidence</div>
                          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {opened.evidence.map((c, i) => {
                              const ct = chipTone(c.tone);
                              return (
                                <span
                                  key={i}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    border: `1px solid ${ct.border}`,
                                    background: ct.bg,
                                    color: ct.color,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.k}: {c.v}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, ...styles.small }}>
                    Note: If warehouse is not mapped, all lines are evaluated under a default warehouse (supported).
                  </div>
                </div>
              </div>
            </div>
          ) : null}

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

            @media (max-width: 1050px) {
              .drawer-split {
                grid-template-columns: 1fr !important;
              }
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

/* =========================
   Small UI helpers
========================= */

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" }}>
      <div style={{ fontSize: 12, color: "#aab1c4" }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 950, marginTop: 6, color: "#e6e8ee" }}>{v}</div>
    </div>
  );
}