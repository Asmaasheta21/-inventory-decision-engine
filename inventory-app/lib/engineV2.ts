// inventory-app/lib/engineV2.ts
// Core analytics engine for V2 movements (ledger-first).
// Pure functions only (no storage, no UI).
// Supports negative qty, losses (scrap), adjustments, transfers,
// and both Calendar Avg + Active Days Avg for demand.

import type { DemoRow, MovementsMapping, MovementTypeValueMapping } from "@/lib/demoStore";

/* =========================================================
   Types
========================================================= */

export type MovementClass = "IN" | "OUT" | "OTHER";

export type EngineParams = {
  w7: number;
  w30: number;
  w90: number;

  defaultWarehouse: string;

  // fallback tokens if user didn't bucket LOSS properly
  lossTokens: string[];

  useAbsQty: boolean;
  minRowsPerSkuWh: number;

  intermittentThreshold: number;
};

export type EngineKpis = {
  lines: number;
  skuCount: number;
  warehouseCount: number;

  totalOnHand: number;

  out7: number;
  out30: number;
  out90: number;

  loss30: number;
  loss90: number;

  lossRate30: number; // loss30/(out30+loss30)
};

export type DemandProfile = "STABLE" | "INTERMITTENT" | "LUMPY" | "DECLINING" | "NEW";

export type LineOut = {
  sku: string;
  warehouse: string;

  onHand: number;

  out7: number;
  out30: number;
  out90: number;

  in7: number;
  in30: number;
  in90: number;

  loss30: number;
  loss90: number;

  avgDailyOutCalendar30: number;
  avgDailyOutActive30: number;
  activeDemandDays30: number;

  stdDailyOut30: number;
  cv30: number;

  trend30vsPrev30: number;

  lastMoveISO: string | null;
  lastOutISO: string | null;

  profile: DemandProfile;
  notes: string[];

  _meta?: {
    rows: number;
    hasWarehouseCol: boolean;
  };
};

export type EngineResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];

  params: EngineParams;

  kpis: EngineKpis;
  warehouses: string[];
  lines: LineOut[];
};

/* =========================================================
   Defaults
========================================================= */

export function getDefaultEngineParams(): EngineParams {
  return {
    w7: 7,
    w30: 30,
    w90: 90,
    defaultWarehouse: "ALL",
    lossTokens: ["scrap", "waste", "reject", "quality", "loss", "damage", "expired", "expiry"],
    useAbsQty: true,
    minRowsPerSkuWh: 2,
    intermittentThreshold: 0.2,
  };
}

/* =========================================================
   Utils
========================================================= */

function normToken(x: any): string {
  return (x ?? "").toString().trim().toLowerCase();
}

function parseDateMs(x: any): number | null {
  const s = (x ?? "").toString().trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function msToISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function safeNumber(x: any): number {
  const cleaned = (x ?? "").toString().replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function uniqSorted(arr: string[], pinFirst?: string): string[] {
  const s = new Set(arr.filter(Boolean));
  const out = Array.from(s);
  out.sort((a, b) => a.localeCompare(b));
  if (pinFirst && out.includes(pinFirst)) {
    return [pinFirst, ...out.filter((x) => x !== pinFirst)];
  }
  return out;
}

function toSetCI(list: any): Set<string> {
  const s = new Set<string>();
  if (!Array.isArray(list)) return s;
  for (const v of list) {
    const t = normToken(v);
    if (t) s.add(t);
  }
  return s;
}

/* =========================================================
   Movement classification (FAST + BUCKET-AWARE)
========================================================= */

type Classifier = {
  inSet: Set<string>;
  outSet: Set<string>;
  transferSet: Set<string>;
  lossSet: Set<string>;   // scrapLossValues from mapping UI
  adjustSet: Set<string>; // adjustValues from mapping UI
  otherSet: Set<string>;
};

function buildClassifier(mv: MovementTypeValueMapping): Classifier {
  return {
    inSet: toSetCI((mv as any)?.inValues ?? []),
    outSet: toSetCI((mv as any)?.outValues ?? []),
    transferSet: toSetCI((mv as any)?.transferValues ?? []),
    lossSet: toSetCI((mv as any)?.scrapLossValues ?? []),
    adjustSet: toSetCI((mv as any)?.adjustValues ?? []),
    otherSet: toSetCI((mv as any)?.otherValues ?? []),
  };
}

function classifyWithBuckets(rawType: any, c: Classifier) {
  const t = normToken(rawType);
  if (!t) return { cls: "OTHER" as MovementClass, isLoss: false, isAdjust: false, isTransfer: false };

  if (c.inSet.has(t)) return { cls: "IN" as MovementClass, isLoss: false, isAdjust: false, isTransfer: false };
  if (c.outSet.has(t)) return { cls: "OUT" as MovementClass, isLoss: false, isAdjust: false, isTransfer: false };

  // Everything else is OTHER, but we tag special buckets
  const isTransfer = c.transferSet.has(t);
  const isLoss = c.lossSet.has(t);
  const isAdjust = c.adjustSet.has(t);

  return { cls: "OTHER" as MovementClass, isLoss, isAdjust, isTransfer };
}

function isLossFallbackByToken(rawType: any, params: EngineParams): boolean {
  const t = normToken(rawType);
  if (!t) return false;
  const loss = toSetCI(params.lossTokens ?? []);
  for (const k of loss) {
    if (k && t.includes(k)) return true;
  }
  return false;
}

/* =========================================================
   Daily series helpers (calendar)
========================================================= */

type DailySeries = Map<string /* YYYY-MM-DD */, number>;

function addDaily(series: DailySeries, dayISO: string, v: number) {
  series.set(dayISO, (series.get(dayISO) ?? 0) + v);
}

function buildCalendarDays(endMs: number, days: number): string[] {
  const out: string[] = [];
  const endDay = new Date(endMs);
  endDay.setUTCHours(0, 0, 0, 0);
  const end0 = endDay.getTime();

  for (let i = days - 1; i >= 0; i--) {
    const t = end0 - i * 24 * 60 * 60 * 1000;
    out.push(msToISODate(t));
  }
  return out;
}

function meanStdFromCalendar(series: DailySeries, calendar: string[]): { mean: number; std: number } {
  if (!calendar.length) return { mean: 0, std: 0 };
  const vals = calendar.map((d) => series.get(d) ?? 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

  const variance =
    vals.reduce((acc, x) => {
      const dx = x - mean;
      return acc + dx * dx;
    }, 0) / vals.length;

  return { mean, std: Math.sqrt(variance) };
}

function activeDaysCount(series: DailySeries, calendar: string[]): number {
  let c = 0;
  for (const d of calendar) if ((series.get(d) ?? 0) > 0) c++;
  return c;
}

/* =========================================================
   Trend + Profile
========================================================= */

function trend30vsPrev30(outSeries90: DailySeries, endMs: number, w30: number): number {
  const calLast = buildCalendarDays(endMs, w30);
  const calPrev = buildCalendarDays(endMs - w30 * 24 * 60 * 60 * 1000, w30);

  const sumLast = calLast.reduce((a, d) => a + (outSeries90.get(d) ?? 0), 0);
  const sumPrev = calPrev.reduce((a, d) => a + (outSeries90.get(d) ?? 0), 0);

  const avgLast = sumLast / w30;
  const avgPrev = sumPrev / w30;

  if (avgLast === 0 && avgPrev === 0) return 0;

  const denom = Math.max(avgLast, avgPrev, 1e-9);
  return clamp((avgLast - avgPrev) / denom, -1, 1);
}

function classifyProfile(args: {
  out30: number;
  activeDays30: number;
  w30: number;
  cv30: number;
  trend: number;
  intermittentThreshold: number;
  hasHistoryBefore30: boolean;
}): DemandProfile {
  const { out30, activeDays30, w30, cv30, trend, intermittentThreshold, hasHistoryBefore30 } = args;

  if (!hasHistoryBefore30 && out30 > 0) return "NEW";
  if (out30 === 0) return hasHistoryBefore30 ? "DECLINING" : "NEW";

  const activeRatio = activeDays30 / Math.max(1, w30);

  if (activeRatio <= intermittentThreshold) {
    return cv30 >= 1.2 ? "LUMPY" : "INTERMITTENT";
  }

  if (trend <= -0.35) return "DECLINING";
  if (cv30 <= 0.6) return "STABLE";
  return "STABLE";
}

/* =========================================================
   Core Engine
========================================================= */

export function runEngineV2(input: {
  movements: { headers: string[]; rows: DemoRow[] };
  mapping: MovementsMapping;
  mvTypes: MovementTypeValueMapping;
  params?: Partial<EngineParams>;
}): EngineResult {
  const params: EngineParams = { ...getDefaultEngineParams(), ...(input.params ?? {}) };

  const errors: string[] = [];
  const warnings: string[] = [];

  const { movements, mapping, mvTypes } = input;
  const headers = movements?.headers ?? [];
  const rows = movements?.rows ?? [];

  const required = [mapping.itemId, mapping.date, mapping.qty, mapping.movementType].filter(Boolean);
  if (required.length !== 4) errors.push("Missing required mapping fields (itemId/date/qty/movementType).");

  for (const col of required) {
    if (col && !headers.includes(col)) errors.push(`Mapped column not found in headers: "${col}"`);
  }

  if (!rows.length) errors.push("Movements dataset has no data rows.");

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      params,
      kpis: {
        lines: 0,
        skuCount: 0,
        warehouseCount: 0,
        totalOnHand: 0,
        out7: 0,
        out30: 0,
        out90: 0,
        loss30: 0,
        loss90: 0,
        lossRate30: 0,
      },
      warehouses: [],
      lines: [],
    };
  }

  // Build classifier once (FAST)
  const classifier = buildClassifier(mvTypes);

  // Determine time anchor (max date in dataset)
  let maxT: number | null = null;
  for (const r of rows) {
    const t = parseDateMs(r[mapping.date]);
    if (t === null) continue;
    maxT = maxT === null ? t : Math.max(maxT, t);
  }
  if (maxT === null) {
    warnings.push("Could not parse any dates. Using now as anchor; windows may be inaccurate.");
    maxT = Date.now();
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const t7 = maxT - params.w7 * dayMs;
  const t30 = maxT - params.w30 * dayMs;
  const t90 = maxT - params.w90 * dayMs;

  const hasWarehouseCol = !!mapping.warehouse;

  type Agg = {
    sku: string;
    wh: string;

    onHand: number;

    in7: number; in30: number; in90: number;
    out7: number; out30: number; out90: number;

    loss30: number; loss90: number;

    lastMove: number | null;
    lastOut: number | null;

    outSeries30: DailySeries;
    outSeries90: DailySeries;

    hasBefore30: boolean;
    rows: number;
  };

  const map = new Map<string, Agg>();
  const whSet = new Set<string>();

  const key = (sku: string, wh: string) => `${sku}||${wh}`;

  for (const r of rows) {
    const sku = (r[mapping.itemId] ?? "").toString().trim();
    if (!sku) continue;

    const whRaw = hasWarehouseCol ? (r[mapping.warehouse as string] ?? "").toString().trim() : "";
    const wh = whRaw || params.defaultWarehouse;
    if (wh) whSet.add(wh);

    const t = parseDateMs(r[mapping.date]);
    const qtyN = safeNumber(r[mapping.qty]);
    const qty = params.useAbsQty ? Math.abs(qtyN) : qtyN;

    const mtRaw = (r[mapping.movementType] ?? "").toString().trim();
    const tag = classifyWithBuckets(mtRaw, classifier);

    // LOSS fallback by token if user didn't bucket loss values
    const isLoss = tag.isLoss || (!tag.isAdjust && !tag.isTransfer && isLossFallbackByToken(mtRaw, params));
    const isAdjust = tag.isAdjust;
    const isTransfer = tag.isTransfer;

    const k = key(sku, wh);
    const a: Agg =
      map.get(k) ??
      ({
        sku, wh,
        onHand: 0,
        in7: 0, in30: 0, in90: 0,
        out7: 0, out30: 0, out90: 0,
        loss30: 0, loss90: 0,
        lastMove: null,
        lastOut: null,
        outSeries30: new Map(),
        outSeries90: new Map(),
        hasBefore30: false,
        rows: 0,
      } as Agg);

    // Stock impact rules:
    // IN adds, OUT subtracts.
    // LOSS subtracts (but not demand).
    // ADJUST: treat as stock impact based on sign of qtyN (if user didn't abs, keep sign)
    // TRANSFER: stock-neutral in demo (ignore)
    if (tag.cls === "IN") a.onHand += qty;
    else if (tag.cls === "OUT") a.onHand -= qty;
    else if (isLoss) a.onHand -= qty;
    else if (isAdjust) {
      // If file has signed qty, respect sign; if we useAbsQty, assume adjust decreases unless qtyN shows sign
      const signed = params.useAbsQty ? (qtyN < 0 ? -qty : qty) : qty;
      a.onHand += signed;
    } else if (isTransfer) {
      // ignore in demo (stock-neutral)
    }

    // Windows + series
    if (t !== null) {
      if (t >= t7) {
        if (tag.cls === "IN") a.in7 += qty;
        if (tag.cls === "OUT") a.out7 += qty;
      }
      if (t >= t30) {
        if (tag.cls === "IN") a.in30 += qty;
        if (tag.cls === "OUT") a.out30 += qty;
        if (isLoss) a.loss30 += qty;
      } else {
        if (tag.cls === "OUT") a.hasBefore30 = true;
      }
      if (t >= t90) {
        if (tag.cls === "IN") a.in90 += qty;
        if (tag.cls === "OUT") a.out90 += qty;
        if (isLoss) a.loss90 += qty;
      }

      const day = msToISODate(t);
      if (tag.cls === "OUT") {
        if (t >= t30) addDaily(a.outSeries30, day, qty);
        if (t >= t90) addDaily(a.outSeries90, day, qty);
      }

      a.lastMove = a.lastMove === null ? t : Math.max(a.lastMove, t);
      if (tag.cls === "OUT") a.lastOut = a.lastOut === null ? t : Math.max(a.lastOut, t);
    }

    a.rows += 1;
    map.set(k, a);
  }

  const cal30 = buildCalendarDays(maxT, params.w30);

  const lines: LineOut[] = [];

  for (const a of map.values()) {
    if (a.rows < params.minRowsPerSkuWh) continue;

    const { mean, std } = meanStdFromCalendar(a.outSeries30, cal30);
    const activeDays30 = activeDaysCount(a.outSeries30, cal30);

    const avgCalendar30 = a.out30 / Math.max(1, params.w30);
    const avgActive30 = a.out30 / Math.max(1, activeDays30);
    const cv = mean > 0 ? std / mean : 0;

    const tr = trend30vsPrev30(a.outSeries90, maxT, params.w30);

    const profile = classifyProfile({
      out30: a.out30,
      activeDays30,
      w30: params.w30,
      cv30: cv,
      trend: tr,
      intermittentThreshold: params.intermittentThreshold,
      hasHistoryBefore30: a.hasBefore30,
    });

    const notes: string[] = [];
    if (a.onHand < 0) notes.push("Negative on-hand (check movements / opening stock).");
    if (profile === "INTERMITTENT") notes.push("Intermittent demand.");
    if (profile === "LUMPY") notes.push("Lumpy demand (high variability).");
    if (profile === "DECLINING") notes.push("Demand declining vs previous period.");
    if (a.loss30 > 0) notes.push("Loss detected (scrap/reject).");

    lines.push({
      sku: a.sku,
      warehouse: a.wh,

      onHand: a.onHand,

      out7: a.out7,
      out30: a.out30,
      out90: a.out90,

      in7: a.in7,
      in30: a.in30,
      in90: a.in90,

      loss30: a.loss30,
      loss90: a.loss90,

      avgDailyOutCalendar30: avgCalendar30,
      avgDailyOutActive30: activeDays30 > 0 ? avgActive30 : 0,
      activeDemandDays30: activeDays30,

      stdDailyOut30: std,
      cv30: cv,

      trend30vsPrev30: tr,

      lastMoveISO: a.lastMove ? msToISODate(a.lastMove) : null,
      lastOutISO: a.lastOut ? msToISODate(a.lastOut) : null,

      profile,
      notes,

      _meta: { rows: a.rows, hasWarehouseCol },
    });
  }

  const totalOnHand = lines.reduce((s, x) => s + x.onHand, 0);
  const out7 = lines.reduce((s, x) => s + x.out7, 0);
  const out30 = lines.reduce((s, x) => s + x.out30, 0);
  const out90 = lines.reduce((s, x) => s + x.out90, 0);
  const loss30 = lines.reduce((s, x) => s + x.loss30, 0);
  const loss90 = lines.reduce((s, x) => s + x.loss90, 0);
  const denom = out30 + loss30;
  const lossRate30 = denom > 0 ? loss30 / denom : 0;

  const warehouses = uniqSorted(Array.from(whSet), params.defaultWarehouse);

  if (!hasWarehouseCol) warnings.push("Warehouse not mapped. Results aggregated under default warehouse.");

  const inCount = ((mvTypes as any)?.inValues ?? []).length;
  const outCount = ((mvTypes as any)?.outValues ?? []).length;
  if (inCount === 0 || outCount === 0) warnings.push("IN/OUT mapping is empty. Signals may be wrong.");

  return {
    ok: true,
    errors,
    warnings,
    params,
    kpis: {
      lines: lines.length,
      skuCount: new Set(lines.map((x) => `${x.sku}||${x.warehouse}`)).size,
      warehouseCount: warehouses.length,
      totalOnHand,
      out7,
      out30,
      out90,
      loss30,
      loss90,
      lossRate30,
    },
    warehouses,
    lines,
  };
}