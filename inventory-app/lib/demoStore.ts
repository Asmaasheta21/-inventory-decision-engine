// inventory-app/lib/demoStore.ts
// Demo storage + CSV utilities (client-only).
// Uses sessionStorage so nothing is persisted on the server.

export type DemoRow = Record<string, string>;

export type Mapping = {
  sku: string;
  onHand: string;
  sales30d: string;
  warehouse?: string; // optional
};

export type Thresholds = {
  leadTimeDays: number;   // default 7
  safetyDays: number;     // default 7
  overstockDays: number;  // default 90
};

type DemoPayload = {
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

const STORAGE_KEY = "ide_demo_payload_v1";

/* ---------------------------------
   Safe storage helpers
---------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readPayload(): DemoPayload | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DemoPayload;
  } catch {
    return null;
  }
}

function writePayload(payload: DemoPayload) {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/* ---------------------------------
   Public API (what pages use)
---------------------------------- */

/** Save uploaded CSV into session (headers + rows). */
export function saveUpload(headers: string[], rows: DemoRow[], opts?: { fileName?: string }) {
  const payload: DemoPayload = {
    headers,
    rows,
    meta: {
      createdAtISO: new Date().toISOString(),
      fileName: opts?.fileName,
      rowCount: rows.length,
    },
  };
  writePayload(payload);
}

/** Load upload data (headers + rows). */
export function loadUpload(): { headers: string[]; rows: DemoRow[]; meta?: DemoPayload["meta"] } | null {
  const p = readPayload();
  if (!p?.headers?.length || !Array.isArray(p.rows)) return null;
  return { headers: p.headers, rows: p.rows, meta: p.meta };
}

/** Save the user's column mapping. */
export function saveMapping(mapping: Mapping) {
  const p = readPayload();
  if (!p) return;
  writePayload({ ...p, mapping });
}

/** Load the saved mapping. */
export function loadMapping(): Mapping | null {
  const p = readPayload();
  return p?.mapping ?? null;
}

/** Save thresholds for calculations (client-only). */
export function saveThresholds(t: Thresholds) {
  const p = readPayload();
  // If no upload yet, still allow thresholds to exist
  const base: DemoPayload =
    p ??
    ({
      headers: [],
      rows: [],
      meta: { createdAtISO: new Date().toISOString(), rowCount: 0 },
    } as DemoPayload);

  writePayload({ ...base, thresholds: normalizeThresholds(t) });
}

/** Load thresholds with defaults. */
export function loadThresholds(): Thresholds {
  const p = readPayload();
  return normalizeThresholds(p?.thresholds);
}

/** Clear everything (demo reset). */
export function clearDemo() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/* ---------------------------------
   Data normalization
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

/* ---------------------------------
   CSV parsing (demo-grade, robust enough)
---------------------------------- */

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