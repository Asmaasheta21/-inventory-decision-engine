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
export function saveUpload(headers: string[], rows: DemoRow[], opts?: { fileName?: string }) {
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
export function loadUpload(): { headers: string[]; rows: DemoRow[]; meta?: DemoPayloadV1["meta"] } | null {
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
   CSV parsing (shared)
========================================================= */

/**
 * Parse CSV text into headers + rows.
 * - Handles quotes
 * - Handles commas inside quotes
 * - Trims values
 */
export function parseCSV(text: string): { headers: string[]; rows: DemoRow[] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
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

      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur.trim());
    return out;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(cleanCell);

  const rows: DemoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: DemoRow = {};

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] ?? `col_${c + 1}`;
      row[key] = cleanCell(cols[c] ?? "");
    }

    rows.push(row);
  }

  return { headers, rows };
}

function cleanCell(x: string): string {
  const s = (x ?? "").toString().trim();
  // Remove wrapping quotes if any
  return s.replace(/^"|"$/g, "").trim();
}

/** Convert string to number safely. Supports "1,234" and empty. */
export function toNumber(x: string): number {
  const cleaned = (x ?? "").toString().replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
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

export type DemoStateV2 = {
  datasets: Partial<Record<DatasetKey, Dataset>>;
  meta?: { createdAtISO: string };
  // Mapping for V2 flows
  mappingV2?: {
    movements?: MovementsMapping;
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