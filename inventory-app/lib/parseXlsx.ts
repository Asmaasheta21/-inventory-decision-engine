import * as XLSX from "xlsx";

export type ParsedTabular = {
  headers: string[];
  rows: Record<string, string>[];
};

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function parseXlsx(file: File): Promise<ParsedTabular> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return { headers: [], rows: [] };

  const ws = wb.Sheets[sheetName];
  if (!ws) return { headers: [], rows: [] };

  // 2D array: first row headers
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: true,
    defval: "", // keep empty cells
  });

  if (!aoa.length) return { headers: [], rows: [] };

  const headers = (aoa[0] ?? []).map(asString).map((h) => h.trim()).filter(Boolean);
  if (!headers.length) return { headers: [], rows: [] };

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const line = aoa[i] ?? [];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = asString(line[c]);
    }

    // skip fully empty rows
    const anyValue = headers.some((h) => (obj[h] ?? "").trim() !== "");
    if (anyValue) rows.push(obj);
  }

  return { headers, rows };
}