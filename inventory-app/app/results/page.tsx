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

type Decision =
  | "TRANSFER_FIRST"
  | "ORDER_NOW"
  | "WATCH"
  | "REDUCE"
  | "DEAD"
  | "HEALTHY";

type Thresholds = {
  leadTimeDays: number; // user-defined
  safetyDays: number; // user-defined
  overstockDays: number; // user-defined (default 90)
};

type EvidenceTone = "cyan" | "amber" | "green" | "red" | "violet" | "steel";

type EvidenceChip = { k: string; v: string; tone?: EvidenceTone };

type TransferLeg = { fromWH: string; toWH: string; qty: number };

type RowOut = {
  sku: string;
  warehouse: string;

  onHand: number;

  out30d: number;
  out90d: number;

  avgDailyOut: number; // the chosen avg used for policy (calendar or active)
  daysCover: number;

  reorderPoint: number;
  targetStock: number;
  suggestedOrder: number;

  // Transfer suggestions
  transferIn: TransferLeg[]; // legs into this WH (as receiver)
  transferOut: TransferLeg[]; // legs out of this WH (as donor)
  transferInQty: number;
  transferOutQty: number;
  purchaseAfterTransfers: number; // max(0, suggestedOrder - transferInQty)
  coverageByTransfer: number; // transferInQty / suggestedOrder (0..1)

  decision: Decision;
  severity: number; // 0..100

  lastMoveISO: string | null;

  evidence: EvidenceChip[];

  // extra “pro-ish” signals (still shown in evidence)
  profile: string;
  trend: number;
  cv30: number;
  activeDays30: number;
  loss30: number;
  lossRate30: number;
};

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
   Formatting + UI helpers
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

function decisionLabel(d: Decision): string {
  switch (d) {
    case "TRANSFER_FIRST":
      return "Transfer first";
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
    case "TRANSFER_FIRST":
      return { bg: "rgba(110,231,255,0.10)", border: "rgba(110,231,255,0.28)", color: "#d8f7ff" };
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

function cap(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

/* =========================================================
   Decision logic (strong + manufacturing-aware)
========================================================= */

function computeDecisionFromLine(
  line: LineOut,
  th: Thresholds
): Omit<
  RowOut,
  | "sku"
  | "warehouse"
  | "lastMoveISO"
  | "transferIn"
  | "transferOut"
  | "transferInQty"
  | "transferOutQty"
  | "purchaseAfterTransfers"
  | "coverageByTransfer"
> {
  const profile = line.profile;

  const avgCalendar = line.avgDailyOutCalendar30;
  const avgActive = line.avgDailyOutActive30;

  const chosenAvg =
    profile === "INTERMITTENT" || profile === "LUMPY"
      ? Math.max(avgCalendar, avgActive)
      : avgCalendar;

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

  evidence.push({ k: "Out(30d)", v: `${formatNum(line.out30)}`, tone: "steel" });
  evidence.push({ k: "Out(90d)", v: `${formatNum(line.out90)}`, tone: "steel" });

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
    k: "Volatility",
    v: `CV ${formatNum(cv)}`,
    tone: cv >= 1.2 ? "amber" : cv >= 0.7 ? "steel" : "green",
  });

  evidence.push({
    k: "Active days",
    v: `${line.activeDemandDays30}/30`,
    tone: line.activeDemandDays30 <= 6 ? "amber" : "steel",
  });

  if (loss30 > 0) {
    evidence.push({ k: "Loss(30d)", v: `${formatNum(loss30)} (${percent(lossRate30)})`, tone: "amber" });
  }

  if (decision === "ORDER_NOW" && suggestedOrder > 0) {
    evidence.push({ k: "Order", v: `${formatNum(suggestedOrder)} units`, tone: "red" });
  }

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
   Transfer Engine (UI-layer)
   - Works per SKU across warehouses
   - Safe: disabled when warehouse mapping missing (only "ALL")
========================================================= */

function computeTransferPlan(rows: RowOut[], th: Thresholds): RowOut[] {
  const bySku = new Map<string, RowOut[]>();
  for (const r of rows) {
    if (!bySku.has(r.sku)) bySku.set(r.sku, []);
    bySku.get(r.sku)!.push(r);
  }

  const reviewHorizon = Math.max(1, th.leadTimeDays + th.safetyDays);

  // helper: how much donor must keep (not a toy: considers CV + trend + lumpy/intermittent)
  const donorKeepQty = (d: RowOut) => {
    const base = d.avgDailyOut * reviewHorizon;

    const cvBump = 1 + cap(d.cv30, 0, 1.5) * 0.18; // up to +27%
    const trendBump = d.trend > 0 ? 1 + cap(d.trend, 0, 0.7) * 0.15 : 1; // rising demand => keep more
    const profileBump = d.profile === "LUMPY" ? 1.12 : d.profile === "INTERMITTENT" ? 1.07 : 1.0;

    // also: if losses are high, keep a touch extra
    const lossBump = d.lossRate30 >= 0.08 ? 1.06 : 1.0;

    return base * cvBump * trendBump * profileBump * lossBump;
  };

  const next: RowOut[] = rows.map((r) => ({
    ...r,
    transferIn: [],
    transferOut: [],
    transferInQty: 0,
    transferOutQty: 0,
    purchaseAfterTransfers: r.suggestedOrder,
    coverageByTransfer: 0,
  }));

  const idx = new Map<string, RowOut>();
  for (const r of next) idx.set(`${r.sku}||${r.warehouse}`, r);

  for (const [sku, group] of bySku.entries()) {
    // if only ALL, no transfers possible
    const distinctWH = new Set(group.map((g) => g.warehouse));
    if (distinctWH.size <= 1) continue;

    // receivers: urgent-ish & need > 0
    const receivers = group
      .filter((r) => (r.decision === "ORDER_NOW" || r.decision === "WATCH") && r.suggestedOrder > 0)
      .sort((a, b) => b.severity - a.severity);

    if (!receivers.length) continue;

    // donors: REDUCE with meaningful available
    const donors = group
      .filter((r) => r.decision === "REDUCE" && r.onHand > 0)
      .map((d) => {
        const keep = donorKeepQty(d);
        const available = Math.max(0, d.onHand - keep);
        return { d, keep, available };
      })
      .filter((x) => x.available >= 1)
      .sort((a, b) => b.available - a.available);

    if (!donors.length) continue;

    for (const rec of receivers) {
      let need = rec.suggestedOrder;
      if (need <= 0) continue;

      for (const don of donors) {
        if (need <= 0) break;
        if (don.available <= 0) continue;
        if (don.d.warehouse === rec.warehouse) continue;

        const take = Math.min(need, Math.floor(don.available));
        if (take <= 0) continue;

        don.available -= take;
        need -= take;

        const toRow = idx.get(`${sku}||${rec.warehouse}`);
        const fromRow = idx.get(`${sku}||${don.d.warehouse}`);
        if (!toRow || !fromRow) continue;

        const leg: TransferLeg = { fromWH: don.d.warehouse, toWH: rec.warehouse, qty: take };
        toRow.transferIn.push(leg);
        fromRow.transferOut.push(leg);

        toRow.transferInQty += take;
        fromRow.transferOutQty += take;
      }

      const toRow = idx.get(`${sku}||${rec.warehouse}`);
      if (!toRow) continue;

      toRow.purchaseAfterTransfers = Math.max(0, toRow.suggestedOrder - toRow.transferInQty);
      toRow.coverageByTransfer =
        toRow.suggestedOrder > 0 ? cap(toRow.transferInQty / toRow.suggestedOrder, 0, 1) : 0;
    }
  }

  // enrich evidence + decision override (TRANSFER_FIRST)
  for (const r of next) {
    if (r.transferInQty > 0) {
      const legsText = r.transferIn
        .slice(0, 2)
        .map((x) => `${formatNum(x.qty)} from ${x.fromWH}`)
        .join(" • ");

      const tone: EvidenceTone =
        r.coverageByTransfer >= 0.6 ? "cyan" : r.coverageByTransfer >= 0.25 ? "amber" : "steel";

      r.evidence = [
        { k: "Transfer", v: `${formatNum(r.transferInQty)} (${percent(r.coverageByTransfer)})`, tone },
        { k: "From", v: legsText || "—", tone: "steel" },
        { k: "Buy after", v: `${formatNum(r.purchaseAfterTransfers)}`, tone: r.purchaseAfterTransfers > 0 ? "amber" : "green" },
        ...r.evidence,
      ];

      // Decision override: if transfer covers most of need, force "TRANSFER_FIRST"
      if ((r.decision === "ORDER_NOW" || r.decision === "WATCH") && r.coverageByTransfer >= 0.6) {
        r.decision = "TRANSFER_FIRST";
        // severity nudged but still urgent-ish
        r.severity = clampInt(Math.max(r.severity, 70), 50, 95);
      }
    }

    if (r.transferOutQty > 0) {
      const legsText = r.transferOut
        .slice(0, 2)
        .map((x) => `${formatNum(x.qty)} to ${x.toWH}`)
        .join(" • ");

      r.evidence = [
        { k: "Can transfer", v: `${formatNum(r.transferOutQty)}`, tone: "violet" },
        { k: "To", v: legsText || "—", tone: "steel" },
        ...r.evidence,
      ];
    }
  }

  return next;
}

/* =========================================================
   Page
========================================================= */

export default function ResultsPage() {
  const router = useRouter();

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
      container: { maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px" } as CSSProperties,

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

      badgeWarn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#ffe9b3",
        border: "1px solid rgba(255,196,0,0.25)",
        background: "rgba(255,196,0,0.08)",
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

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 12 } as CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as CSSProperties,
    };
  }, []);

  const hasMovements = !!movements?.rows?.length;
  const hasMapping = !!mappingV2?.itemId && !!mappingV2?.date && !!mappingV2?.qty && !!mappingV2?.movementType;
  const showMissing = !hasMovements || !hasMapping || !mvTypeValues;

  const statusText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Upload ${hasMovements ? "✓" : "×"}`);
    parts.push(`Mapping ${hasMapping ? "✓" : "×"}`);
    parts.push(`Type Values ${mvTypeValues ? "✓" : "×"}`);
    return parts.join(" • ");
  }, [hasMovements, hasMapping, mvTypeValues]);

  const th = useMemo(
    () => normalizeThresholds({ leadTimeDays, safetyDays, overstockDays }),
    [leadTimeDays, safetyDays, overstockDays]
  );

  const { rowsOut, warehouses, kpis, warnings, transfersEnabled } = useMemo(() => {
    const empty = {
      rowsOut: [] as RowOut[],
      warehouses: ["ALL"] as string[],
      warnings: [] as string[],
      transfersEnabled: false,
      kpis: { skuCount: 0, transferFirst: 0, orderNow: 0, watch: 0, reduce: 0, buyAfter: 0 },
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

    // base rows
    const base: RowOut[] = engine.lines.map((ln: LineOut) => {
      const core = computeDecisionFromLine(ln, th);
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

        transferIn: [],
        transferOut: [],
        transferInQty: 0,
        transferOutQty: 0,
        purchaseAfterTransfers: core.suggestedOrder,
        coverageByTransfer: 0,

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
      };
    });

    // Transfers enabled only when we have >1 real warehouse across dataset
    const whList = ["ALL", ...engine.warehouses.filter((w) => w !== "ALL")];
    const enabled = whList.length > 2; // ALL + at least 2 real WHs

    const planned = enabled ? computeTransferPlan(base, th) : base;

    // sort: most urgent first
    planned.sort((a, b) => {
      const dRank = (x: Decision) =>
        x === "TRANSFER_FIRST"
          ? 1
          : x === "ORDER_NOW"
            ? 2
            : x === "WATCH"
              ? 3
              : x === "REDUCE"
                ? 4
                : x === "DEAD"
                  ? 5
                  : 6;

      const ra = dRank(a.decision);
      const rb = dRank(b.decision);
      if (ra !== rb) return ra - rb;
      return b.severity - a.severity;
    });

    const skuCount = new Set(planned.map((r) => `${r.sku}||${r.warehouse}`)).size;

    const k = {
      skuCount,
      transferFirst: planned.filter((r) => r.decision === "TRANSFER_FIRST").length,
      orderNow: planned.filter((r) => r.decision === "ORDER_NOW").length,
      watch: planned.filter((r) => r.decision === "WATCH").length,
      reduce: planned.filter((r) => r.decision === "REDUCE").length,
      buyAfter: planned.reduce((s, r) => s + (r.purchaseAfterTransfers ?? 0), 0),
    };

    const extraWarnings = [...engine.warnings];
    if (!enabled) {
      extraWarnings.push("Transfers disabled (warehouse not mapped or only one warehouse found).");
    }

    return {
      rowsOut: planned,
      warehouses: whList,
      warnings: extraWarnings,
      transfersEnabled: enabled,
      kpis: k,
    };
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
              Reads <b style={{ color: "#e6e8ee" }}>Movements</b> + your <b style={{ color: "#e6e8ee" }}>Mapping</b> +{" "}
              <b style={{ color: "#e6e8ee" }}>Movement Type Values</b>. Adds profile, trend, volatility, losses — and{" "}
              <b style={{ color: "#e6e8ee" }}>Transfer-first</b> suggestions when warehouses exist.
            </p>

            {showMissing ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...styles.p, marginTop: 6 }}>Missing demo data. Start from Upload → Mapping → Movement Types.</div>

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
                  {warnings?.length ? (
                    <span style={{ ...styles.small, color: "#ffe9b3" }}>⚠ {warnings.slice(0, 2).join(" • ")}</span>
                  ) : (
                    <span style={styles.small}>Engine OK • Smart signals enabled</span>
                  )}
                  {!transfersEnabled ? (
                    <span style={styles.badgeWarn}>Transfers: disabled</span>
                  ) : (
                    <span style={styles.badgeOk}>Transfers: enabled</span>
                  )}
                </div>

                {/* KPI row */}
                <div style={styles.kpiGrid}>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Lines</div>
                    <div style={styles.kpiValue}>{kpis.skuCount}</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiTitle}>Transfer first</div>
                    <div style={styles.kpiValue}>{kpis.transferFirst}</div>
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
                    <div style={styles.kpiTitle}>Buy after transfers</div>
                    <div style={styles.kpiValue}>{formatNum(kpis.buyAfter)}</div>
                  </div>
                </div>

                {/* Controls */}
                <div style={styles.grid2}>
                  <div style={styles.cardPad}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Policy thresholds</div>
                    <div style={{ ...styles.small, marginTop: 6 }}>You control these — no random assumptions.</div>

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
                    <div style={{ ...styles.small, marginTop: 6 }}>Narrow down to a warehouse / decision / SKU search.</div>

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
                        <div style={styles.small}>Transfers need warehouses.</div>
                      </div>

                      <div style={styles.field}>
                        <div style={styles.label}>Decision</div>
                        <select style={styles.input} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as any)}>
                          <option value="ALL">ALL</option>
                          <option value="TRANSFER_FIRST">TRANSFER_FIRST</option>
                          <option value="ORDER_NOW">ORDER_NOW</option>
                          <option value="WATCH">WATCH</option>
                          <option value="REDUCE">REDUCE</option>
                          <option value="DEAD">DEAD</option>
                          <option value="HEALTHY">HEALTHY</option>
                        </select>
                        <div style={styles.small}>Urgent signals first.</div>
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
                        <th style={styles.th}>Suggested</th>
                        <th style={styles.th}>Buy after</th>
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

                            <td style={styles.td}>{r.daysCover >= 9999 ? "∞" : `${formatNum(r.daysCover)} d`}</td>

                            <td style={styles.td}>{formatNum(r.reorderPoint)}</td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{formatNum(r.suggestedOrder)}</div>
                              <div style={styles.small}>Target: {formatNum(r.targetStock)}</div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ fontWeight: 950, color: "#e6e8ee" }}>{formatNum(r.purchaseAfterTransfers)}</div>
                              <div style={styles.small}>
                                {r.transferInQty > 0 ? `Covered: ${percent(r.coverageByTransfer)}` : "Covered: 0%"}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {r.evidence.slice(0, 8).map((c, i) => {
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
                    Note: Showing max 250 rows for speed. Sorting: Transfer First → Order Now → Watch → Reduce → Dead → Healthy.
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