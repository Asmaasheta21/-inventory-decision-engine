import { parseCSV } from "@/lib/demoStore";
import { parseXlsx, type ParsedTabular } from "@/lib/parseXlsx";

export async function parseTabular(file: File): Promise<ParsedTabular> {
  const name = file.name.toLowerCase().trim();

  // XLSX
  if (name.endsWith(".xlsx")) {
    return await parseXlsx(file);
  }

  // CSV
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    // تأمين النوع: نخلي القيم string
    const safeRows: Record<string, string>[] = rows.map((r: any) => {
      const obj: Record<string, string> = {};
      for (const h of headers) obj[h] = (r?.[h] ?? "").toString();
      return obj;
    });

    return { headers, rows: safeRows };
  }

  // Unsupported
  throw new Error("Unsupported file type. Please upload .csv or .xlsx");
}