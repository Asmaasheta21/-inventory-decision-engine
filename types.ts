export type DecisionCategory =
  | "ORDER_NOW"
  | "ORDER_SOON"
  | "MONITOR"
  | "HEALTHY"
  | "REDUCE"
  | "MANUAL_REVIEW";

export type ValidationSeverity = "ERROR" | "WARNING";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  rowIndex?: number; // 1-based (excluding header)
  column?: string;
};

export type InputRow = {
  SKU: string;
  SKU_Name?: string;
  Category?: string;
  Location: string;

  OnHand_Qty: number;
  OnOrder_Qty: number;
  Backorder_Qty: number;
  LeadTime_Days: number;

  MinOrder_Qty?: number;
  OrderMultiple_Qty?: number;

  AvgDailySales?: number;
  Sales_30D_Qty?: number;

  UnitCost: number;
  UnitPrice?: number;

  SafetyStock_Days?: number;
  LastSaleDate?: string;
  IsSeasonal?: boolean;
  SeasonalityFactor?: number;
  DaysOutOfStock_30D?: number;
};

export type CleanRow = {
  SKU: string;
  Location: string;

  OnHand_Qty: number;
  OnOrder_Qty: number;
  Backorder_Qty: number;
  LeadTime_Days: number;

  MinOrder_Qty: number;
  OrderMultiple_Qty: number;

  UnitCost: number;
  UnitPrice?: number;

  SKU_Name?: string;
  Category?: string;

  AvgDailySales?: number;
  Sales_30D_Qty?: number;

  SafetyStock_Days?: number;
  LastSaleDate?: string;
  IsSeasonal?: boolean;
  SeasonalityFactor?: number;
  DaysOutOfStock_30D?: number;

  // derived for v1
  ADD: number; // Avg/Adjusted Daily Demand
};

export type ValidateResult = {
  validRows: CleanRow[];
  issues: ValidationIssue[];
};