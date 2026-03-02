import { parseCSV } from "@/lib/demoStore";
import { parseXlsxWithExcelJS, ParsedTabular } from "@/lib/parseXlsxExceljs";

export async function parseTabular(file: File): Promise<ParsedTabular> {
  const name = file.name.toLowerCase();

  // CSV
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    return {
      headers,
      rows: rows.map((r: any) => {
        const out: Record<string, string> = {};
        for (const h of headers) out[h] = String(r[h] ?? "").trim();
        return out;
      }),
    };
  }

  // XLSX فقط
  if (name.endsWith(".xlsx")) {
    return await parseXlsxWithExcelJS(file);
  }

  throw new Error("Unsupported file type. Upload .csv or .xlsx");
}