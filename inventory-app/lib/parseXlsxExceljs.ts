import ExcelJS from "exceljs";

export type ParsedTabular = {
  headers: string[];
  rows: Record<string, string>[];
  sheetName?: string;
};

function s(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as any).text ?? "").trim(); // rich text
  return String(v).trim();
}

export async function parseXlsxWithExcelJS(file: File): Promise<ParsedTabular> {
  const buf = await file.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Excel has no worksheets.");

  const sheetName = ws.name;

  // أول صف = headers
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const h = s(cell.value);
    headers.push(h || `col_${colNumber}`);
  });

  if (!headers.length) throw new Error("Excel looks empty (no headers).");

  const rows: Record<string, string>[] = [];

  // من الصف 2 لحد آخر صف
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let hasAny = false;

    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1];
      const val = s(row.getCell(c).value);
      if (val !== "") hasAny = true;
      obj[key] = val;
    }

    if (hasAny) rows.push(obj);
  }

  if (rows.length < 1) throw new Error("Excel has headers but no data rows.");

  return { headers, rows, sheetName };
}