import { CleanRow, ValidateResult, ValidationIssue } from "./types";

function issue(
  severity: "ERROR" | "WARNING",
  code: string,
  message: string,
  rowIndex?: number,
  column?: string
): ValidationIssue {
  return { severity, code, message, rowIndex, column };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

export function validateAndClean(
  rawRows: Record<string, unknown>[],
  headers: string[]
): ValidateResult {
  const issues: ValidationIssue[] = [];
  const validRows: CleanRow[] = [];

  const requiredColumns = [
    "SKU",
    "Location",
    "OnHand_Qty",
    "OnOrder_Qty",
    "LeadTime_Days",
    "UnitCost",
  ];

  // 1️⃣ Check required columns
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      issues.push(
        issue("ERROR", "MISSING_COLUMN", `Missing required column: ${col}`)
      );
    }
  }

  if (!headers.includes("AvgDailySales") && !headers.includes("Sales_30D_Qty")) {
    issues.push(
      issue(
        "ERROR",
        "MISSING_DEMAND",
        "Provide AvgDailySales or Sales_30D_Qty"
      )
    );
  }

  if (issues.length > 0) {
    return { validRows: [], issues };
  }

  // 2️⃣ Row validation
  rawRows.forEach((row, index) => {
    const rowIndex = index + 1;

    const SKU = String(row["SKU"] ?? "").trim();
    const Location = String(row["Location"] ?? "").trim();

    const OnHand_Qty = toNumber(row["OnHand_Qty"]);
    const OnOrder_Qty = toNumber(row["OnOrder_Qty"]);
    const LeadTime_Days = toNumber(row["LeadTime_Days"]);
    const UnitCost = toNumber(row["UnitCost"]);

    let ADD: number | null = null;

    const AvgDailySales = toNumber(row["AvgDailySales"]);
    const Sales_30D_Qty = toNumber(row["Sales_30D_Qty"]);

    if (AvgDailySales !== null) ADD = AvgDailySales;
    else if (Sales_30D_Qty !== null) ADD = Sales_30D_Qty / 30;

    if (!SKU) {
      issues.push(issue("ERROR", "EMPTY_SKU", "SKU is required", rowIndex));
      return;
    }

    if (!Location) {
      issues.push(issue("ERROR", "EMPTY_LOCATION", "Location is required", rowIndex));
      return;
    }

    if (
      OnHand_Qty === null ||
      OnOrder_Qty === null ||
      LeadTime_Days === null ||
      UnitCost === null ||
      ADD === null
    ) {
      issues.push(issue("ERROR", "INVALID_DATA", "Invalid numeric data", rowIndex));
      return;
    }

    if (ADD === 0) {
      issues.push(issue("WARNING", "ZERO_DEMAND", "Demand is zero", rowIndex));
    }

    validRows.push({
      SKU,
      Location,
      OnHand_Qty,
      OnOrder_Qty,
      Backorder_Qty: 0,
      LeadTime_Days,
      MinOrder_Qty: 0,
      OrderMultiple_Qty: 0,
      UnitCost,
      ADD,
    });
  });

  return { validRows, issues };
}
