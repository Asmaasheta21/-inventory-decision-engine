// inventory-app/lib/engineV2.ts
// Core analytics engine for V2 movements (ledger-first).
// Pure functions only (no storage, no UI).
// Supports negative qty, manufacturing losses (scrap) as separate metric,
// and both Calendar Avg + Active Days Avg for demand.

import type { DemoRow, MovementsMapping, MovementTypeValueMapping } from "@/lib/demoStore";

/* =========================================================
   Types
========================================================= */

export type MovementClass = "IN" | "OUT" | "OTHER";

export type EngineParams = {
  // windows (days)
  w7: number;
  w30: number;
  w90: number;

  // How to treat warehouse when missing
  defaultWarehouse: string;

  // Which movement values are "loss" (scrap/quality/adjust negative etc.)
  // NOTE: we classify movement types using MovementTypeValueMapping first.
  // Loss tags are applied by raw movementType token matching inside OTHER.
  lossTokens: string[]; // e.g. ["scrap", "scr", "quality_reject", "waste"]

  // If qty is negative in raw file:
  // We'll use ABS(qty) and apply sign based on MovementClass,
  // because many ERPs store OUT as negative already.
  useAbsQty: boolean;

  // Minimum rows to consider SKU valid
  minRowsPerSkuWh: number;

  // For intermittent/lumpy classification
  intermittentThreshold: number; // e.g. 0.2 (20% active days in window)
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

  // Stock snapshot (net over all time in file)
  onHand: number;

  // Window totals
  out7: number;
  out30: number;
  out90: number;

  in7: number;
  in30: number;
  in90: number;

  // Loss (scrap etc.) — counts as stock decrease but NOT demand
  loss30: number;
  loss90: number;

  // Demand rates
  avgDailyOutCalendar30: number; // out30 / 30
  avgDailyOutActive30: number; // out30 / activeDemandDays30
  activeDemandDays30: number; // count of unique days with OUT > 0

  // Volatility
  stdDailyOut30: number; // stddev across daily OUT series (calendar)
  cv30: number; // std/mean (calendar mean)

  // Trend (compare last 30 vs prev 30 within 90 horizon)
  trend30vsPrev30: number; // -1..+1

  // Last activity
  lastMoveISO: string | null;
  lastOutISO: string | null;

  // Profile
  profile: DemandProfile;

  // Health notes (for UI evidence)
  notes: string[];

  // Debug counters (optional)
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
  warehouses: string[]; // includes "ALL" only if you want; we keep real ones + default
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
    lossTokens: ["scrap", "waste", "reject", "quality", "loss", "damage"],
    useAbsQty: true,
    minRowsPerSkuWh: 2,
    intermittentThreshold: 0.2,
  };
}

/* =========================================================
   Utils
========================================================= */

function normToken(x: string): string {
  return (x ?? "").toString().trim().toLowerCase();
}

function parseDateMs(x: string): number | null {
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

/* =========================================================
   Movement classification
========================================================= */

export function classifyMovement(rawType: string, mv: MovementTypeValueMapping): MovementClass {
  const t = normToken(rawType);
  if (!t) return "OTHER";

  const inSet = new Set((mv?.inValues ?? []).map(normToken));
  const outSet = new Set((mv?.outValues ?? []).map(normToken));

  if (inSet.has(t)) return "IN";
  if (outSet.has(t)) return "OUT";
  return "OTHER";
}

function isLossOther(rawType: string, params: EngineParams): boolean {
  const t = normToken(rawType);
  if (!t) return false;
  const lossSet = new Set((params.lossTokens ?? []).map(normToken));
  // match contains to be forgiving: "quality_scrap", "scrap-issue", etc.
  for (const k of lossSet) {
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
  // inclusive end day
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

  const std = Math.sqrt(variance);
  return { mean, std };
}

function activeDaysCount(series: DailySeries, calendar: string[]): number {
  let c = 0;
  for (const d of calendar) {
    if ((series.get(d) ?? 0) > 0) c++;
  }
  return c;
}

/* =========================================================
   Trend + Profile
========================================================= */

function trend30vsPrev30(outSeries: DailySeries, endMs: number, w30: number): number {
  // Compare last 30 days vs previous 30 days average.
  const calLast = buildCalendarDays(endMs, w30);
  const calPrev = buildCalendarDays(endMs - w30 * 24 * 60 * 60 * 1000, w30);

  const sumLast = calLast.reduce((a, d) => a + (outSeries.get(d) ?? 0), 0);
  const sumPrev = calPrev.reduce((a, d) => a + (outSeries.get(d) ?? 0), 0);

  const avgLast = sumLast / w30;
  const avgPrev = sumPrev / w30;

  if (avgLast === 0 && avgPrev === 0) return 0;

  // normalized delta -> [-1..+1]
  const denom = Math.max(avgLast, avgPrev, 1e-9);
  const raw = (avgLast - avgPrev) / denom;
  return clamp(raw, -1, 1);
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

  // intermittent: few active days
  if (activeRatio <= intermittentThreshold) {
    // lumpy: intermittent + high variability
    if (cv30 >= 1.2) return "LUMPY";
    return "INTERMITTENT";
  }

  // stable vs declining
  if (trend <= -0.35) return "DECLINING";
  if (cv30 <= 0.6) return "STABLE";

  // default
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

  // Basic validation
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

  // Determine time anchor: max date in dataset (not "now")
  let maxT: number | null = null;
  for (const r of rows) {
    const t = parseDateMs((r[mapping.date] ?? "").toString());
    if (t === null) continue;
    maxT = maxT === null ? t : Math.max(maxT, t);
  }
  if (maxT === null) {
    warnings.push("Could not parse any dates. Windows (7/30/90) will behave as zeroed.");
    maxT = Date.now();
  }

  const w7ms = params.w7 * 24 * 60 * 60 * 1000;
  const w30ms = params.w30 * 24 * 60 * 60 * 1000;
  const w90ms = params.w90 * 24 * 60 * 60 * 1000;

  const t7 = maxT - w7ms;
  const t30 = maxT - w30ms;
  const t90 = maxT - w90ms;

  const hasWarehouseCol = !!mapping.warehouse;

  // Aggregation per sku||wh
  type Agg = {
    sku: string;
    wh: string;

    onHand: number;

    in7: number;
    in30: number;
    in90: number;

    out7: number;
    out30: number;
    out90: number;

    loss30: number;
    loss90: number;

    lastMove: number | null;
    lastOut: number | null;

    // daily series (calendar)
    outSeries30: DailySeries; // day -> out qty
    outSeries90: DailySeries; // day -> out qty

    // history marker
    hasBefore30: boolean;

    rows: number;
  };

  const map = new Map<string, Agg>();
  const whSet = new Set<string>();

  function key(sku: string, wh: string) {
    return `${sku}||${wh}`;
  }

  for (const r of rows) {
    const sku = (r[mapping.itemId] ?? "").toString().trim();
    if (!sku) continue;

    const whRaw = hasWarehouseCol ? (r[mapping.warehouse as string] ?? "").toString().trim() : "";
    const wh = whRaw || params.defaultWarehouse;
    if (wh) whSet.add(wh);

    const t = parseDateMs((r[mapping.date] ?? "").toString());
    const qtyRaw = (r[mapping.qty] ?? "").toString();
    const qtyN = safeNumber(qtyRaw);
    const qty = params.useAbsQty ? Math.abs(qtyN) : qtyN;

    const mt = (r[mapping.movementType] ?? "").toString().trim();
    const cls = classifyMovement(mt, mvTypes);

    const k = key(sku, wh);
    const a: Agg =
      map.get(k) ??
      ({
        sku,
        wh,
        onHand: 0,
        in7: 0,
        in30: 0,
        in90: 0,
        out7: 0,
        out30: 0,
        out90: 0,
        loss30: 0,
        loss90: 0,
        lastMove: null,
        lastOut: null,
        outSeries30: new Map(),
        outSeries90: new Map(),
        hasBefore30: false,
        rows: 0,
      } as Agg);

    // Net stock logic:
    // IN adds, OUT subtracts, OTHER ignored (except losses: treat as stock decrease but not demand)
    if (cls === "IN") a.onHand += qty;
    if (cls === "OUT") a.onHand -= qty;

    // Loss inside OTHER bucket by token matching (scrap, reject...)
    const loss = cls === "OTHER" && isLossOther(mt, params);
    if (loss) {
      a.onHand -= qty; // stock decrease
    }

    // Update windows by date
    if (t !== null) {
      if (t >= t7) {
        if (cls === "IN") a.in7 += qty;
        if (cls === "OUT") a.out7 += qty;
      }
      if (t >= t30) {
        if (cls === "IN") a.in30 += qty;
        if (cls === "OUT") a.out30 += qty;
        if (loss) a.loss30 += qty;
      } else {
        // history marker (for "NEW" profile)
        if (cls === "OUT") a.hasBefore30 = true;
      }
      if (t >= t90) {
        if (cls === "IN") a.in90 += qty;
        if (cls === "OUT") a.out90 += qty;
        if (loss) a.loss90 += qty;
      }

      // daily series (calendar)
      const day = msToISODate(t);

      if (cls === "OUT") {
        // build both 30 & 90 series for stats/trend
        if (t >= t30) addDaily(a.outSeries30, day, qty);
        if (t >= t90) addDaily(a.outSeries90, day, qty);
      }

      // last moves
      a.lastMove = a.lastMove === null ? t : Math.max(a.lastMove, t);
      if (cls === "OUT") a.lastOut = a.lastOut === null ? t : Math.max(a.lastOut, t);
    }

    a.rows += 1;
    map.set(k, a);
  }

  // Build output lines
  const lines: LineOut[] = [];

  const cal30 = buildCalendarDays(maxT, params.w30);
  const cal90 = buildCalendarDays(maxT, params.w90);

  for (const a of map.values()) {
    if (a.rows < params.minRowsPerSkuWh) continue;

    const { mean, std } = meanStdFromCalendar(a.outSeries30, cal30);
    const activeDays30 = activeDaysCount(a.outSeries30, cal30);

    const avgCalendar30 = a.out30 / Math.max(1, params.w30);
    const avgActive30 = a.out30 / Math.max(1, activeDays30); // if 0 => handled by max

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

    if (a.onHand < 0) notes.push("Negative on-hand (check movements / starting stock).");
    if (profile === "INTERMITTENT") notes.push("Intermittent demand (few active days).");
    if (profile === "LUMPY") notes.push("Lumpy demand (high variability).");
    if (profile === "DECLINING") notes.push("Demand declining vs previous period.");
    if (a.loss30 > 0) notes.push("Loss detected (scrap/reject).");

    const lastMoveISO = a.lastMove ? msToISODate(a.lastMove) : null;
    const lastOutISO = a.lastOut ? msToISODate(a.lastOut) : null;

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

      lastMoveISO,
      lastOutISO,

      profile,
      notes,

      _meta: { rows: a.rows, hasWarehouseCol },
    });
  }

  // KPIs
  const skuCount = new Set(lines.map((x) => `${x.sku}||${x.warehouse}`)).size;
  const totalOnHand = lines.reduce((s, x) => s + x.onHand, 0);
  const out7 = lines.reduce((s, x) => s + x.out7, 0);
  const out30 = lines.reduce((s, x) => s + x.out30, 0);
  const out90 = lines.reduce((s, x) => s + x.out90, 0);
  const loss30 = lines.reduce((s, x) => s + x.loss30, 0);
  const loss90 = lines.reduce((s, x) => s + x.loss90, 0);

  const denom = out30 + loss30;
  const lossRate30 = denom > 0 ? loss30 / denom : 0;

  const warehouses = uniqSorted(Array.from(whSet), params.defaultWarehouse);

  if (!hasWarehouseCol) {
    warnings.push("Warehouse column not mapped. Results are aggregated under default warehouse.");
  }

  // If movement type mapping seems weak
  const inCount = (mvTypes?.inValues ?? []).length;
  const outCount = (mvTypes?.outValues ?? []).length;
  if (inCount === 0 || outCount === 0) {
    warnings.push("Movement type value mapping has empty IN or OUT list. Demand/stock signals may be wrong.");
  }

  return {
    ok: true,
    errors,
    warnings,
    params,
    kpis: {
      lines: lines.length,
      skuCount,
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