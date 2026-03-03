// inventory-app/lib/demoStore.ts
// Demo storage + CSV utilities (client-only).
// Uses sessionStorage so nothing is persisted on the server.

/* =========================================================
   Common types
========================================================= */

export type DemoRow = Record<string, string>;

/* =========================================================
   V1 (Legacy) - single CSV upload + simple mapping
   KEEP THIS to avoid breaking existing pages.
========================================================= */

export type Mapping = {
  sku: string;
  onHand: string;
  sales30d: string;
  warehouse?: string; // optional
};

export type Thresholds = {
  leadTimeDays: number; // default 7
  safetyDays: number; // default 7
  overstockDays: number; // default 90
};

type DemoPayloadV1 = {
  headers: string[];
  rows: DemoRow[];
  mapping?: Mapping;
  thresholds?: Thresholds;
  meta?: {
    createdAtISO: string;
    fileName?: string;
    rowCount: number;
  };
};

const STORAGE_KEY_V1 = "ide_demo_payload_v1";

/* ---------------------------------
   Safe storage helpers
---------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readPayloadV1(): DemoPayloadV1 | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY_V1);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DemoPayloadV1;
  } catch {
    return null;
  }
}

function writePayloadV1(payload: DemoPayloadV1) {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEY_V1, JSON.stringify(payload));
}

/* ---------------------------------
   Public API (V1)
---------------------------------- */

/** Save uploaded CSV into session (headers + rows). */
export function saveUpload(
  headers: string[],
  rows: DemoRow[],
  opts?: { fileName?: string }
) {
  const payload: DemoPayloadV1 = {
    headers,
    rows,
    meta: {
      createdAtISO: new Date().toISOString(),
      fileName: opts?.fileName,
      rowCount: rows.length,
    },
  };
  writePayloadV1(payload);
}

/** Load upload data (headers + rows). */
export function loadUpload(): {
  headers: string[];
  rows: DemoRow[];
  meta?: DemoPayloadV1["meta"];
} | null {
  const p = readPayloadV1();
  if (!p?.headers?.length || !Array.isArray(p.rows)) return null;
  return { headers: p.headers, rows: p.rows, meta: p.meta };
}

/** Save the user's column mapping. */
export function saveMapping(mapping: Mapping) {
  const p = readPayloadV1();
  if (!p) return;
  writePayloadV1({ ...p, mapping });
}

/** Load the saved mapping. */
export function loadMapping(): Mapping | null {
  const p = readPayloadV1();
  return p?.mapping ?? null;
}

/** Save thresholds for calculations (client-only). */
export function saveThresholds(t: Thresholds) {
  const p = readPayloadV1();

  // If no upload yet, still allow thresholds to exist
  const base: DemoPayloadV1 =
    p ??
    ({
      headers: [],
      rows: [],
      meta: { createdAtISO: new Date().toISOString(), rowCount: 0 },
    } as DemoPayloadV1);

  writePayloadV1({ ...base, thresholds: normalizeThresholds(t) });
}

/** Load thresholds with defaults. */
export function loadThresholds(): Thresholds {
  const p = readPayloadV1();
  return normalizeThresholds(p?.thresholds);
}

/** Clear V1 only (legacy demo reset). */
export function clearDemo() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEY_V1);
}

/* ---------------------------------
   Data normalization (V1)
---------------------------------- */

function normalizeThresholds(t?: Partial<Thresholds> | null): Thresholds {
  const leadTimeDays = clampInt(Number(t?.leadTimeDays ?? 7), 0, 365);
  const safetyDays = clampInt(Number(t?.safetyDays ?? 7), 0, 365);
  const overstockDays = clampInt(Number(t?.overstockDays ?? 90), 1, 3650);

  return { leadTimeDays, safetyDays, overstockDays };
}

function clampInt(n: number, min: number, max: number): number {
  const v = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, v));
}

/* =========================================================
   CSV parsing (shared) - improved for real-world CSVs
========================================================= */

function stripBOM(s: string): string {
  // UTF-8 BOM
  if (s && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" | "|" {
  const line = headerLine ?? "";
  const candidates: Array<"," | ";" | "\t" | "|"> = [",", ";", "\t", "|"];
  let best: "," | ";" | "\t" | "|" = ",";
  let bestCount = -1;

  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, idx) => {
    const base = ((h ?? `col_${idx + 1}`) as string).toString().trim();
    const key = base.toLowerCase();

    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);

    return n === 1 ? base : `${base}_${n}`;
  });
}

function parseLineWithDelimiter(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      // Escaped quote inside quoted string => ""
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

/**
 * Clean cell content:
 * - trims
 * - removes wrapping quotes ONLY if the whole cell is wrapped
 */
function cleanCell(x: string): string {
  const s = (x ?? "").toString().trim();

  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).trim();
  }

  return s;
}

/**
 * Parse CSV text into headers + rows.
 * Improvements:
 * - Detect delimiter (, ; \t |)
 * - Strip BOM
 * - Unique headers to avoid overwriting
 * - Handles quotes + delimiters inside quotes
 *
 * Note: does NOT support multiline quoted fields (demo-friendly).
 */
export function parseCSV(text: string): { headers: string[]; rows: DemoRow[] } {
  const normalized = stripBOM(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);

  const rawHeaders = parseLineWithDelimiter(lines[0], delimiter);
  const cleanedHeaders = rawHeaders.map(cleanCell);
  const headers = makeUniqueHeaders(cleanedHeaders);

  const rows: DemoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLineWithDelimiter(lines[i], delimiter);
    const row: DemoRow = {};

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] ?? `col_${c + 1}`;
      row[key] = cleanCell(cols[c] ?? "");
    }

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Convert string to number safely.
 * Supports:
 * - "1,234" and "1 234"
 * - "(123)" => -123 (accounting negative)
 * - empty => 0
 */
export function toNumber(x: string): number {
  const raw = (x ?? "").toString().trim();
  if (!raw) return 0;

  // (123) => -123
  const isAccountingNeg = /^\(.*\)$/.test(raw);
  const unwrapped = isAccountingNeg ? raw.slice(1, -1) : raw;

  const cleaned = unwrapped.replace(/[\s,]/g, "").trim();

  const n = Number(cleaned);
  const v = Number.isFinite(n) ? n : 0;
  return isAccountingNeg ? -v : v;
}

/* =========================================================
   V2 (NEW) - Multi-dataset ledger-first (movements/items/uom)
========================================================= */

export type DatasetKey = "movements" | "items" | "uom";

export type Dataset = {
  headers: string[];
  rows: DemoRow[];
  fileName?: string;
};

export type MovementsMapping = {
  itemId: string;
  date: string;
  qty: string;
  movementType: string;
  warehouse?: string;
  uom?: string;
};

/**
 * PRO: Movement type VALUE mapping across ERPs.
 * Backward compatible with old {inValues,outValues,otherValues}.
 */
export type MovementTypeValueMapping = {
  inValues: string[];
  outValues: string[];

  // Pro buckets (optional in old saved data)
  transferValues?: string[];
  adjustValues?: string[];
  scrapLossValues?: string[];

  otherValues: string[];
};

export type DemoStateV2 = {
  datasets: Partial<Record<DatasetKey, Dataset>>;
  meta?: { createdAtISO: string };

  mappingV2?: {
    movements?: MovementsMapping;
    movementTypeValues?: MovementTypeValueMapping;
  };
};

const STORAGE_KEY_V2 = "ide_demo_state_v2";

function readStateV2(): DemoStateV2 | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY_V2);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DemoStateV2;
  } catch {
    return null;
  }
}

function writeStateV2(state: DemoStateV2) {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
}

/** Clear V2 only. */
export function clearDemoV2() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEY_V2);
}

/** Clear EVERYTHING (V1 + V2) to prevent mixed demos. */
export function clearAllDemo() {
  clearDemo();
  clearDemoV2();
}

/** Load all datasets (V2). */
export function loadDatasetsV2(): DemoStateV2["datasets"] {
  const s = readStateV2();
  return s?.datasets ?? {};
}

/** Load one dataset (V2). */
export function loadDatasetV2(key: DatasetKey): Dataset | null {
  const s = readStateV2();
  return s?.datasets?.[key] ?? null;
}

/** Save one dataset (V2). */
export function saveDatasetV2(
  key: DatasetKey,
  headers: string[],
  rows: DemoRow[],
  opts?: { fileName?: string }
) {
  const s: DemoStateV2 =
    readStateV2() ?? {
      datasets: {},
      meta: { createdAtISO: new Date().toISOString() },
    };

  s.datasets = s.datasets ?? {};
  s.datasets[key] = { headers, rows, fileName: opts?.fileName };

  if (!s.meta?.createdAtISO) {
    s.meta = { createdAtISO: new Date().toISOString() };
  }

  writeStateV2(s);
}

/** Remove one dataset (V2). */
export function clearDatasetV2(key: DatasetKey) {
  const s = readStateV2();
  if (!s?.datasets) return;
  delete s.datasets[key];
  writeStateV2(s);
}

/* -------------------------------
   V2 Mapping (Movements)
-------------------------------- */

export function saveMappingV2(mapping: MovementsMapping) {
  const s: DemoStateV2 =
    readStateV2() ?? {
      datasets: {},
      meta: { createdAtISO: new Date().toISOString() },
    };

  s.mappingV2 = s.mappingV2 ?? {};
  s.mappingV2.movements = mapping;

  writeStateV2(s);
}

export function loadMappingV2(): MovementsMapping | null {
  const s = readStateV2();
  return s?.mappingV2?.movements ?? null;
}

/* -------------------------------
   V2 Mapping (Movement Type Values) — PRO
-------------------------------- */

function normToken(x: string): string {
  return (x ?? "").toString().trim().toLowerCase();
}

function uniqueTokens(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of arr ?? []) {
    const t = (a ?? "").toString().trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function normalizeMovementTypeValueMapping(
  m?: Partial<MovementTypeValueMapping> | null
): MovementTypeValueMapping {
  const inValues = uniqueTokens(m?.inValues ?? []);
  const outValues = uniqueTokens(m?.outValues ?? []);

  const transferValues = uniqueTokens((m as any)?.transferValues ?? []);
  const adjustValues = uniqueTokens((m as any)?.adjustValues ?? []);
  const scrapLossValues = uniqueTokens((m as any)?.scrapLossValues ?? []);

  const otherValues = uniqueTokens(m?.otherValues ?? []);

  return {
    inValues,
    outValues,
    transferValues,
    adjustValues,
    scrapLossValues,
    otherValues,
  };
}

export function getDefaultMovementTypeValueMapping(): MovementTypeValueMapping {
  return {
    inValues: [
      "IN",
      "RECEIPT",
      "RECEIVE",
      "RCV",
      "GR",
      "GOODS_RECEIPT",
      "PO_RECEIPT",
      "PURCHASE_RECEIPT",
      "VENDOR_RECEIPT",
      "PUTAWAY",
      "STOCK_IN",
      "STOCKIN",
      "ADD",
      "INBOUND",
      "PRODUCTION_RECEIPT",
      "FG_RECEIPT",
      "COMPLETION",
      "OUTPUT",
      "RETURN_TO_STOCK",
      "SALES_RETURN",
      "CUSTOMER_RETURN",
      "RTS",
      "101",
      "105",
      "531",
    ],
    outValues: [
      "OUT",
      "ISSUE",
      "GI",
      "GOODS_ISSUE",
      "DELIVERY",
      "SHIP",
      "SHIPMENT",
      "DISPATCH",
      "PICK",
      "PICKING",
      "SALE",
      "SALES",
      "CONSUME",
      "CONSUMPTION",
      "STOCK_OUT",
      "STOCKOUT",
      "REMOVE",
      "DEDUCT",
      "OUTBOUND",
      "PRODUCTION_ISSUE",
      "MATERIAL_ISSUE",
      "BACKFLUSH",
      "201",
      "261",
      "601",
    ],
    transferValues: [
      "TRANSFER",
      "STOCK_TRANSFER",
      "MOVE",
      "MOVEMENT",
      "RELOCATION",
      "RELOCATE",
      "WH_TRANSFER",
      "WAREHOUSE_TRANSFER",
      "LOCATION_TRANSFER",
      "INTER_WAREHOUSE",
      "INTER_SITE",
      "BIN_TO_BIN",
      "XFER",
      "301",
      "311",
      "641",
    ],
    adjustValues: [
      "ADJUST",
      "ADJUSTMENT",
      "INVENTORY_ADJUSTMENT",
      "CYCLE_COUNT",
      "COUNT",
      "RECOUNT",
      "STOCKTAKE",
      "PHYSICAL_INVENTORY",
      "VARIANCE",
      "CORRECTION",
      "REVALUATION",
      "701",
      "702",
    ],
    scrapLossValues: [
      "SCRAP",
      "LOSS",
      "DAMAGE",
      "DAMAGED",
      "WASTE",
      "SHRINK",
      "SHRINKAGE",
      "EXPIRED",
      "OBSOLETE",
      "REJECT",
      "REJECTED",
      "QUALITY_REJECT",
      "DISPOSAL",
      "551",
      "553",
    ],
    otherValues: [
      "OTHER",
      "REVERSAL",
      "REVERSE",
      "CANCEL",
      "VOID",
      "RETURN_TO_VENDOR",
      "RTV",
      "VENDOR_RETURN",
      "CORRECTION_REVERSAL",
    ],
  };
}

export function saveMovementTypeValueMappingV2(mapping: MovementTypeValueMapping) {
  const s: DemoStateV2 =
    readStateV2() ?? {
      datasets: {},
      meta: { createdAtISO: new Date().toISOString() },
    };

  s.mappingV2 = s.mappingV2 ?? {};
  s.mappingV2.movementTypeValues = normalizeMovementTypeValueMapping(mapping);

  writeStateV2(s);
}

export function loadMovementTypeValueMappingV2(): MovementTypeValueMapping | null {
  const s = readStateV2();
  const raw = s?.mappingV2?.movementTypeValues as any;
  if (!raw) return null;

  // Backward compatible normalize
  return normalizeMovementTypeValueMapping(raw);
}

export function loadMovementTypeValueMappingV2WithDefault(): MovementTypeValueMapping {
  return loadMovementTypeValueMappingV2() ?? getDefaultMovementTypeValueMapping();
}

export type MovementTypeValuesValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateMovementTypeValueMapping(
  mapping: MovementTypeValueMapping
): MovementTypeValuesValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const m = normalizeMovementTypeValueMapping(mapping);

  if (m.inValues.length === 0) {
    errors.push("IN values list is empty (map at least one receipt/inbound value).");
  }
  if (m.outValues.length === 0) {
    errors.push("OUT values list is empty (map at least one issue/outbound value).");
  }

  const sets = {
    IN: new Set(m.inValues.map(normToken)),
    OUT: new Set(m.outValues.map(normToken)),
    TRANSFER: new Set((m.transferValues ?? []).map(normToken)),
    ADJUST: new Set((m.adjustValues ?? []).map(normToken)),
    SCRAP_LOSS: new Set((m.scrapLossValues ?? []).map(normToken)),
    OTHER: new Set(m.otherValues.map(normToken)),
  };

  const buckets = Object.keys(sets) as Array<keyof typeof sets>;
  const overlaps: string[] = [];

  for (let i = 0; i < buckets.length; i++) {
    for (let j = i + 1; j < buckets.length; j++) {
      const A = buckets[i];
      const B = buckets[j];
      for (const t of sets[A]) {
        if (sets[B].has(t)) overlaps.push(`${t} (${A} & ${B})`);
      }
    }
  }

  if (overlaps.length > 0) {
    errors.push(
      `Same value appears in multiple buckets: ${overlaps.slice(0, 10).join(", ")}${
        overlaps.length > 10 ? "..." : ""
      }`
    );
  }

  const totalTagged =
    m.inValues.length +
    m.outValues.length +
    (m.transferValues?.length ?? 0) +
    (m.adjustValues?.length ?? 0) +
    (m.scrapLossValues?.length ?? 0) +
    m.otherValues.length;

  if (totalTagged < 3) {
    warnings.push("Very few movement types mapped. Results may be weak until you map more values.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

/* =========================================================
   Movements validation (V2) - for real data
========================================================= */

export type MovementsValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    checkedRows: number;
    rowsWithMissingRequired: number;
    rowsWithBadQty: number;
    rowsWithBadDate: number;
  };
};

function looksLikeNumber(x: string): boolean {
  const cleaned = (x ?? "").toString().trim();
  if (cleaned === "") return false;

  // accept (123) too
  const isAccountingNeg = /^\(.*\)$/.test(cleaned);
  const unwrapped = isAccountingNeg ? cleaned.slice(1, -1) : cleaned;

  const n = Number(unwrapped.replace(/[\s,]/g, "").trim());
  return Number.isFinite(n);
}

function looksLikeDate(x: string): boolean {
  const s = (x ?? "").toString().trim();
  if (!s) return false;

  const t = Date.parse(s);
  return Number.isFinite(t);
}

export function validateMovementsDataset(
  headers: string[],
  rows: DemoRow[],
  mapping: MovementsMapping
): MovementsValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredCols = [mapping.itemId, mapping.date, mapping.qty, mapping.movementType].filter(
    Boolean
  );
  if (requiredCols.length !== 4) {
    errors.push("Missing required mapping fields (Item ID, Date, Qty, Movement Type).");
  }

  for (const col of requiredCols) {
    if (!headers.includes(col)) errors.push(`Mapped column not found in CSV headers: "${col}".`);
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      stats: {
        totalRows: rows.length,
        checkedRows: 0,
        rowsWithMissingRequired: 0,
        rowsWithBadQty: 0,
        rowsWithBadDate: 0,
      },
    };
  }

  const sampleSize = Math.min(rows.length, 200);
  let missingReq = 0;
  let badQty = 0;
  let badDate = 0;

  for (let i = 0; i < sampleSize; i++) {
    const r = rows[i];

    const item = (r[mapping.itemId] ?? "").trim();
    const dt = (r[mapping.date] ?? "").trim();
    const qty = (r[mapping.qty] ?? "").trim();
    const mt = (r[mapping.movementType] ?? "").trim();

    if (!item || !dt || !qty || !mt) {
      missingReq++;
      continue;
    }

    if (!looksLikeNumber(qty)) badQty++;
    if (!looksLikeDate(dt)) badDate++;
  }

  if (rows.length === 0) errors.push("Movements.csv has headers but no data rows.");

  if (missingReq === sampleSize && sampleSize > 0) {
    errors.push(
      "Movements sample rows are missing required values (item/date/qty/type). Check mapping or CSV data."
    );
  }

  if (badQty > 0) warnings.push(`Quantity looks non-numeric in ${badQty}/${sampleSize} checked rows.`);
  if (badDate > 0) warnings.push(`Date looks unparseable in ${badDate}/${sampleSize} checked rows.`);

  let neg = 0;
  for (let i = 0; i < sampleSize; i++) {
    const qRaw = (rows[i]?.[mapping.qty] ?? "").toString().trim();
    const n = toNumber(qRaw);
    if (Number.isFinite(n) && n < 0) neg++;
  }
  if (neg > 0) {
    warnings.push(
      `Detected negative quantities in ${neg}/${sampleSize} checked rows (common in some systems).`
    );
  }

  const ok = errors.length === 0;

  return {
    ok,
    errors,
    warnings,
    stats: {
      totalRows: rows.length,
      checkedRows: sampleSize,
      rowsWithMissingRequired: missingReq,
      rowsWithBadQty: badQty,
      rowsWithBadDate: badDate,
    },
  };
}

/* -------------------------------
   V2 Sample CSV generators
-------------------------------- */

/** Required sample ledger: each row = movement. */
export function getSampleMovementsCSV() {
  return [
    ["item_id", "date", "qty", "uom", "movement_type", "warehouse"].join(","),
    ["SKU-102", "2026-02-01", "120", "piece", "RECEIPT", "WH-A"].join(","),
    ["SKU-102", "2026-02-15", "40", "piece", "ISSUE", "WH-A"].join(","),
    ["SKU-088", "2026-02-01", "900", "piece", "RECEIPT", "WH-A"].join(","),
    ["SKU-088", "2026-02-20", "60", "piece", "ISSUE", "WH-A"].join(","),
    ["SKU-055", "2026-02-05", "40", "piece", "RECEIPT", "WH-B"].join(","),
    ["SKU-055", "2026-02-25", "18", "piece", "ISSUE", "WH-B"].join(","),
    ["SKU-019", "2026-02-10", "10", "piece", "RECEIPT", "WH-B"].join(","),
    ["SKU-019", "2026-02-18", "10", "piece", "SCRAP", "WH-B"].join(","),
  ].join("\n");
}

/** Optional master data. */
export function getSampleItemsCSV() {
  return [
    ["item_id", "item_name", "category", "default_uom", "shelf_life_days"].join(","),
    ["SKU-102", "Sample Item 102", "Snacks", "piece", "0"].join(","),
    ["SKU-088", "Sample Item 088", "Snacks", "piece", "0"].join(","),
    ["SKU-055", "Sample Item 055", "Beverage", "piece", "0"].join(","),
    ["SKU-019", "Sample Item 019", "Beverage", "piece", "0"].join(","),
  ].join("\n");
}

/** Optional unit conversions. */
export function getSampleUomCSV() {
  return [
    ["item_id", "from_uom", "to_uom", "factor"].join(","),
    ["SKU-055", "case", "piece", "24"].join(","),
  ].join("\n");
}