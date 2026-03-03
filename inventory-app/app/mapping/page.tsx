"use client";

import { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  loadDatasetV2,
  saveMappingV2,
  loadMappingV2,
  type MovementsMapping,
  validateMovementsDataset,
} from "@/lib/demoStore";

type BoxKind = "none" | "error" | "warning";

export default function MappingPage() {
  const router = useRouter();

  const movements = typeof window !== "undefined" ? loadDatasetV2("movements") : null;

  const headers = movements?.headers ?? [];
  const sampleRows = movements?.rows?.slice(0, 6) ?? [];
  const fileName = movements?.fileName ?? "Movements.csv";
  const rowsTotal = movements?.rows?.length ?? 0;

  const lower = (s: string) => s.toLowerCase().trim();

  const guess = (candidates: string[]) =>
    headers.find((h) => candidates.includes(lower(h))) ?? "";

  // load saved mapping (if any) first
  const saved = typeof window !== "undefined" ? loadMappingV2() : null;

  const [itemId, setItemId] = useState<string>(
    saved?.itemId ||
      guess(["item_id", "sku", "material", "material_id", "item", "itemcode", "item_code"]) ||
      headers[0] ||
      ""
  );

  const [date, setDate] = useState<string>(
    saved?.date ||
      guess(["date", "posting_date", "movement_date", "doc_date", "document_date"]) ||
      headers[1] ||
      ""
  );

  const [qty, setQty] = useState<string>(
    saved?.qty ||
      guess(["qty", "quantity", "movement_qty", "issue_qty", "receipt_qty", "amount"]) ||
      headers[2] ||
      ""
  );

  const [movementType, setMovementType] = useState<string>(
    saved?.movementType ||
      guess(["movement_type", "mov_type", "type", "mvt", "transaction_type", "movement"]) ||
      headers[3] ||
      ""
  );

  const [warehouse, setWarehouse] = useState<string>(
    saved?.warehouse ||
      guess(["warehouse", "wh", "location", "plant", "storage_location", "sloc", "store"]) ||
      ""
  );

  const [uom, setUom] = useState<string>(
    saved?.uom || guess(["uom", "unit", "unit_of_measure", "base_uom", "meins"]) || ""
  );

  // Separate boxes: errors vs warnings
  const [boxKind, setBoxKind] = useState<BoxKind>("none");
  const [boxTitle, setBoxTitle] = useState<string>("");
  const [boxLines, setBoxLines] = useState<string[]>([]);
  const [canContinue, setCanContinue] = useState<boolean>(true);

  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btn: CSSProperties = {
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
      border: "none",
    };

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as CSSProperties,
      container: { maxWidth: 1080, margin: "0 auto", padding: "18px 20px 60px" } as CSSProperties,
      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      } as CSSProperties,
      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as CSSProperties,
      title: { fontWeight: 900, letterSpacing: 0.2 } as CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      link: { color: "#b7bed1", textDecoration: "none", padding: "8px 10px", borderRadius: 10, border: "1px solid transparent" } as CSSProperties,

      hero: { display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 } as CSSProperties,

      card,
      cardPad: { ...card, padding: 18 } as CSSProperties,

      pill: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#dfe3f1",
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
      } as CSSProperties,

      h1: { margin: "10px 0 8px", fontSize: 30, lineHeight: 1.15 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 } as CSSProperties,

      field: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      label: { fontSize: 12, color: "#aab1c4", marginBottom: 8 } as CSSProperties,
      select: {
        width: "100%",
        padding: "10px 10px",
        borderRadius: 12,
        border: "1px solid #2a3350",
        background: "#0b0f1a",
        color: "#e6e8ee",
      } as CSSProperties,
      hint: { marginTop: 8, fontSize: 12, color: "#8f97ad", lineHeight: 1.5 } as CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as CSSProperties,

      btnPrimary: { ...btn, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as CSSProperties,
      btnGhost: { ...btn, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as CSSProperties,
      btnDisabled: {
        ...btn,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(230,232,238,0.55)",
        cursor: "not-allowed",
      } as CSSProperties,

      // Notice boxes (premium)
      boxBase: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        lineHeight: 1.55,
      } as CSSProperties,

      boxError: {
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as CSSProperties,

      boxWarn: {
        border: "1px solid rgba(255,196,0,0.28)",
        background: "rgba(255,196,0,0.08)",
        color: "#ffe9b3",
      } as CSSProperties,

      boxTitle: { fontWeight: 950, marginBottom: 6 } as CSSProperties,
      boxList: { margin: 0, paddingLeft: 18 } as CSSProperties,

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 } as CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0" } as CSSProperties,
      note: { marginTop: 12, fontSize: 12, color: "#8f97ad" } as CSSProperties,

      badge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
        color: "#dfe3f1",
      } as CSSProperties,
    };
  }, []);

  if (!movements) {
    return (
      <div style={styles.wrap}>
        <div className="bg-breathe" style={{ minHeight: "100vh" }}>
          <div style={styles.container}>
            <div style={styles.cardPad}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Mapping</h1>
              <p style={{ marginTop: 10, color: "#b7bed1", lineHeight: 1.7 }}>
                No Movements dataset found. Go to Upload first.
              </p>
              <a className="btn-glow" href="/upload" style={styles.btnPrimary as any}>
                Go to Upload
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function setErrorBox(title: string, lines: string[]) {
    setBoxKind("error");
    setBoxTitle(title);
    setBoxLines(lines);
    setCanContinue(false);
  }

  function setWarningBox(title: string, lines: string[]) {
    setBoxKind("warning");
    setBoxTitle(title);
    setBoxLines(lines);
    setCanContinue(true);
  }

  function clearBox() {
    setBoxKind("none");
    setBoxTitle("");
    setBoxLines([]);
    setCanContinue(true);
  }

  function basicMappingValidate(): string[] {
    const errs: string[] = [];

    if (!itemId || !date || !qty || !movementType) {
      errs.push("Please map Item ID, Date, Quantity, and Movement Type.");
      return errs;
    }

    const required = [itemId, date, qty, movementType];
    if (new Set(required).size !== required.length) {
      errs.push("Item ID / Date / Qty / Movement Type must be different columns.");
    }

    // quick delimiter sanity hint (if parsing produced 1 column)
    if (headers.length === 1) {
      errs.push(
        "Only 1 column detected. Your CSV may use ';' or TAB delimiter. Re-export as CSV (comma) or upload a properly delimited file."
      );
    }

    return errs;
  }

  function buildMapping(): MovementsMapping {
    return {
      itemId,
      date,
      qty,
      movementType,
      warehouse: warehouse || undefined,
      uom: uom || undefined,
    };
  }

  // ✅ FIXED: return validation result synchronously (no reliance on canContinue state)
  function runFullValidation(showWarnings: boolean): { ok: boolean; warned: boolean } {
    // 1) basic mapping validation
    const basicErrs = basicMappingValidate();
    if (basicErrs.length) {
      setErrorBox("Fix mapping", basicErrs);
      return { ok: false, warned: false };
    }

    // 2) dataset validation using mapping
    const mapping = buildMapping();
    const v = validateMovementsDataset(headers, movements?.rows ?? [], mapping);

    if (!v.ok) {
      setErrorBox("Dataset validation failed", [...v.errors]);
      return { ok: false, warned: false };
    }

    // if ok but warnings exist
    if (showWarnings && v.warnings.length) {
      setWarningBox("Looks good, but please review", v.warnings);
      return { ok: true, warned: true };
    }

    clearBox();
    return { ok: true, warned: false };
  }

  // Live validation: run when user changes mapping selections
  useEffect(() => {
    // don't spam warnings; validate quietly unless it's blocking
    runFullValidation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, date, qty, movementType, warehouse, uom]);

  function continueNext() {
    const r = runFullValidation(true);

    // ✅ if blocking errors, stop immediately
    if (!r.ok) return;

    const mapping = buildMapping();
    saveMappingV2(mapping);

    router.push("/movement-types");
  }

  const mappedRequiredCount = [itemId, date, qty, movementType].filter(Boolean).length;

  return (
    <div style={styles.wrap}>
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory Decision Engine</div>
                <div style={styles.subtitle}>Demo • Movements Mapping</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>
              <a href="/upload" style={styles.link}>
                Upload
              </a>
            </div>
          </div>

          <div style={styles.hero}>
            {/* Left: Mapping */}
            <div className="anim-in anim-delay-2" style={styles.cardPad}>
              <span style={styles.pill}>🧩 Movements Mapping</span>
              <h1 style={styles.h1}>Tell us what each movement column means</h1>
              <p style={styles.p}>
                This file is the inventory ledger. We only need a few columns to calculate stock and consumption.
              </p>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={styles.badge}>{fileName}</span>
                <span style={{ fontSize: 12, color: "#8f97ad" }}>
                  {headers.length} columns • {rowsTotal} rows
                </span>
              </div>

              <div style={styles.grid}>
                <Field
                  label="Item ID / SKU"
                  value={itemId}
                  setValue={setItemId}
                  headers={headers}
                  styles={styles}
                  hint="Unique identifier of the product/material."
                />

                <Field
                  label="Movement Date"
                  value={date}
                  setValue={setDate}
                  headers={headers}
                  styles={styles}
                  hint="Date of the movement (posting/document date)."
                />

                <Field
                  label="Quantity"
                  value={qty}
                  setValue={setQty}
                  headers={headers}
                  styles={styles}
                  hint="Movement quantity (can be positive or negative depending on the ERP)."
                />

                <Field
                  label="Movement Type"
                  value={movementType}
                  setValue={setMovementType}
                  headers={headers}
                  styles={styles}
                  hint="What happened? receipt/issue/transfer/adjust/scrap..."
                />

                <Field
                  label="Warehouse (optional)"
                  value={warehouse}
                  setValue={setWarehouse}
                  headers={["", ...headers]}
                  styles={styles}
                  hint="If you have multiple warehouses/locations, map it here."
                  allowNone
                />

                <Field
                  label="UOM (optional)"
                  value={uom}
                  setValue={setUom}
                  headers={["", ...headers]}
                  styles={styles}
                  hint="Unit of measure (piece/case/liter...). Needed only if it exists."
                  allowNone
                />
              </div>

              <div style={styles.row}>
                <button className="btn-glow" style={styles.btnGhost} type="button" onClick={() => router.push("/upload")}>
                  Back
                </button>

                <button
                  className="btn-glow"
                  style={canContinue ? styles.btnPrimary : styles.btnDisabled}
                  type="button"
                  onClick={continueNext}
                  disabled={!canContinue}
                  title={!canContinue ? "Fix errors to continue" : "Continue"}
                >
                  Continue
                </button>
              </div>

              {/* Errors / warnings box */}
              {boxKind !== "none" ? (
                <div
                  style={{
                    ...(styles.boxBase as any),
                    ...(boxKind === "error" ? styles.boxError : styles.boxWarn),
                  }}
                >
                  <div style={styles.boxTitle}>
                    {boxKind === "error" ? "⛔ " : "⚠️ "}
                    {boxTitle}
                  </div>
                  <ul style={styles.boxList}>
                    {boxLines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div style={styles.note}>
                Next step (later): we’ll ask you to map movement type values (e.g., “GI” → ISSUE).
              </div>
            </div>

            {/* Right: Preview */}
            <div className="hover-lift anim-in anim-delay-3" style={styles.cardPad}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Preview</div>
                <div style={{ fontSize: 12, color: "#aab1c4" }}>First 6 rows</div>
              </div>

              <div style={styles.kpiGrid}>
                <KPI title="Mapped (required)" value={`${mappedRequiredCount}/4`} styles={styles} />
                <KPI
                  title="Optional"
                  value={`${warehouse ? "Warehouse ✓" : "No warehouse"} • ${uom ? "UOM ✓" : "No UOM"}`}
                  styles={styles}
                />
                <KPI title="Next" value="Results" styles={styles} />
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {headers.slice(0, 6).map((h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((r, idx) => (
                      <tr key={idx} style={styles.tr}>
                        {headers.slice(0, 6).map((h) => (
                          <td key={h} style={styles.td}>
                            {r[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={styles.note}>Preview shows first 6 columns only for speed.</div>
              </div>
            </div>
          </div>

          <style jsx global>{`
            .bg-breathe {
              background: radial-gradient(1200px 600px at 10% 10%, rgba(110, 231, 255, 0.08), transparent 55%),
                radial-gradient(900px 500px at 90% 20%, rgba(167, 139, 250, 0.1), transparent 60%),
                linear-gradient(180deg, #0f1630, #0b0f1a);
              background-size: 140% 140%;
              animation: breathe 14s ease-in-out infinite;
            }

            @keyframes breathe {
              0%,
              100% {
                background-position: 0% 0%, 100% 0%, 50% 50%;
              }
              50% {
                background-position: 10% 8%, 92% 12%, 50% 50%;
              }
            }

            .anim-in {
              opacity: 0;
              transform: translateY(10px);
              animation: fadeUp 650ms ease-out forwards;
            }

            .anim-delay-1 {
              animation-delay: 80ms;
            }
            .anim-delay-2 {
              animation-delay: 160ms;
            }
            .anim-delay-3 {
              animation-delay: 240ms;
            }

            @keyframes fadeUp {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .hover-lift {
              transition: transform 200ms ease, box-shadow 200ms ease;
            }
            .hover-lift:hover {
              transform: translateY(-4px);
              box-shadow: 0 15px 40px rgba(0, 0, 0, 0.35);
            }

            .btn-glow {
              transition: transform 150ms ease, filter 150ms ease;
            }
            .btn-glow:hover {
              transform: translateY(-1px);
              filter: drop-shadow(0 10px 20px rgba(110, 231, 255, 0.2));
            }

            @media (prefers-reduced-motion: reduce) {
              .anim-in,
              .bg-breathe,
              .hover-lift,
              .btn-glow {
                animation: none !important;
                transition: none !important;
                transform: none !important;
                opacity: 1 !important;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  headers,
  styles,
  hint,
  allowNone,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  headers: string[];
  styles: any;
  hint: string;
  allowNone?: boolean;
}) {
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      <select style={styles.select} value={value} onChange={(e) => setValue(e.target.value)}>
        {headers.map((h) => (
          <option key={h || "__none"} value={h}>
            {h || (allowNone ? "— none —" : "—")}
          </option>
        ))}
      </select>
      <div style={styles.hint}>{hint}</div>
    </div>
  );
}

function KPI({ title, value, styles }: { title: string; value: any; styles: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}