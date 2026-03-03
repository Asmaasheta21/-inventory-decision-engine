"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";   // 👈 ضيفي ده هنا
import { useRouter } from "next/navigation";

import {
  clearAllDemo,
  clearDatasetV2,
  getSampleItemsCSV,
  getSampleMovementsCSV,
  getSampleUomCSV,
  loadDatasetV2,
  parseCSV,
  saveDatasetV2,
  type DatasetKey,
  type DemoRow,
} from "@/lib/demoStore";

type Preview = {
  headers: string[];
  rows: DemoRow[];
  fileName?: string;
};

function makePreviewFromText(csvText: string, fileName?: string): Preview {
  const { headers, rows } = parseCSV(csvText);

  if (!headers.length) throw new Error("CSV looks empty.");
  if (rows.length < 1) throw new Error("CSV has headers but no data rows.");

  return {
    headers,
    rows: rows.slice(0, 10),
    fileName,
  };
}

/** Light sanity warnings (does NOT block upload) */
function basicUploadSanityCheck(headers: string[], rows: DemoRow[]) {
  const warnings: string[] = [];

  if (!headers.length) warnings.push("No headers detected.");
  if (!rows.length) warnings.push("No rows detected.");

  // Common CSV export issue: delimiter is ';' or tab so everything becomes 1 column
  if (headers.length === 1) {
    warnings.push("Only 1 column detected. Your CSV might be using ';' or TAB instead of comma.");
  }

  return warnings;
}

function downloadTextFile(fileName: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage() {
  const router = useRouter();

  const inputRefs = {
    movements: useRef<HTMLInputElement | null>(null),
    items: useRef<HTMLInputElement | null>(null),
    uom: useRef<HTMLInputElement | null>(null),
  };

  const [dragOverKey, setDragOverKey] = useState<DatasetKey | null>(null);
  const [busyKey, setBusyKey] = useState<DatasetKey | null>(null);
  const [error, setError] = useState("");

  // hydrate previews from V2 storage if exists
  const [previewMovements, setPreviewMovements] = useState<Preview | null>(() => {
    const d = loadDatasetV2("movements");
    return d ? { headers: d.headers, rows: d.rows.slice(0, 10), fileName: d.fileName } : null;
  });
  const [previewItems, setPreviewItems] = useState<Preview | null>(() => {
    const d = loadDatasetV2("items");
    return d ? { headers: d.headers, rows: d.rows.slice(0, 10), fileName: d.fileName } : null;
  });
  const [previewUom, setPreviewUom] = useState<Preview | null>(() => {
    const d = loadDatasetV2("uom");
    return d ? { headers: d.headers, rows: d.rows.slice(0, 10), fileName: d.fileName } : null;
  });

  const hasMovements = !!loadDatasetV2("movements");

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
    };

    return {
      wrap: {
        minHeight: "100vh",
        color: "#e6e8ee",
        fontFamily: "Arial, sans-serif",
      } as CSSProperties,

      container: {
        maxWidth: 1100,
        margin: "0 auto",
        padding: "18px 20px 60px",
      } as CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      } as CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as CSSProperties,

      logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
      } as CSSProperties,

      title: { fontWeight: 900, letterSpacing: 0.2 } as CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      } as CSSProperties,

      btnPrimary: {
        ...btn,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
        color: "#0b0f1a",
        border: "none",
      } as CSSProperties,

      btnGhost: {
        ...btn,
        background: "transparent",
        color: "#e6e8ee",
        border: "1px solid #2a3350",
      } as CSSProperties,

      btnDanger: {
        ...btn,
        background: "transparent",
        color: "#ffd4d4",
        border: "1px solid rgba(255,80,80,0.35)",
      } as CSSProperties,

      hero: { ...card, padding: 18, marginBottom: 16 } as CSSProperties,

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

      h1: { margin: "10px 0 8px", fontSize: 26, lineHeight: 1.15 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } as CSSProperties,

      card,
      cardPad: { ...card, padding: 18 } as CSSProperties,

      drop: (key: DatasetKey) =>
        ({
          marginTop: 12,
          borderRadius: 16,
          border: dragOverKey === key ? "1px solid rgba(110,231,255,0.55)" : "1px dashed #2a3350",
          background: dragOverKey === key ? "rgba(110,231,255,0.08)" : "rgba(20,27,48,0.35)",
          padding: 14,
          transition: "200ms ease",
        }) as CSSProperties,

      dropTitle: { fontWeight: 900, marginBottom: 6 } as CSSProperties,
      hint: { fontSize: 13, color: "#8f97ad", lineHeight: 1.6 } as CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 } as CSSProperties,

      kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        marginTop: 12,
      } as CSSProperties,
      kpi: {
        padding: 12,
        borderRadius: 14,
        border: "1px solid #202946",
        background: "rgba(20,27,48,0.55)",
      } as CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as CSSProperties,
      kpiValue: { fontSize: 18, fontWeight: 950, marginTop: 6 } as CSSProperties,

      tableWrap: { marginTop: 12, overflowX: "auto" } as CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0" } as CSSProperties,

      error: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as CSSProperties,

      footerNote: { marginTop: 10, fontSize: 12, color: "#8f97ad" } as CSSProperties,
    };
  }, [dragOverKey]);

  async function handleFile(key: DatasetKey, file: File | null) {
    setError("");
    if (!file) return;

    setBusyKey(key);
    try {
      const text = await file.text();

      // validate + preview
      const preview = makePreviewFromText(text, file.name);

      // save FULL rows in V2
      const parsed = parseCSV(text);

      // 🔎 light sanity warnings (non-blocking)
      const warns = basicUploadSanityCheck(parsed.headers, parsed.rows);
      if (warns.length) {
        setError(warns.join(" "));
      }

      saveDatasetV2(key, parsed.headers, parsed.rows, { fileName: file.name });

      if (key === "movements") setPreviewMovements(preview);
      if (key === "items") setPreviewItems(preview);
      if (key === "uom") setPreviewUom(preview);
    } catch (e: any) {
      setError(e?.message ?? "Failed to read CSV.");
    } finally {
      setBusyKey(null);
      setDragOverKey(null);
    }
  }

  function removeDataset(key: DatasetKey) {
    clearDatasetV2(key);
    if (key === "movements") setPreviewMovements(null);
    if (key === "items") setPreviewItems(null);
    if (key === "uom") setPreviewUom(null);
  }

  function useSamples() {
    setError("");
    clearAllDemo(); // clear V1 + V2 to avoid mixed state

    const m = getSampleMovementsCSV();
    const i = getSampleItemsCSV();
    const u = getSampleUomCSV();

    // preview
    setPreviewMovements(makePreviewFromText(m, "sample_movements.csv"));
    setPreviewItems(makePreviewFromText(i, "sample_items.csv"));
    setPreviewUom(makePreviewFromText(u, "sample_uom.csv"));

    // save full datasets
    const pm = parseCSV(m);
    const pi = parseCSV(i);
    const pu = parseCSV(u);

    saveDatasetV2("movements", pm.headers, pm.rows, { fileName: "sample_movements.csv" });
    saveDatasetV2("items", pi.headers, pi.rows, { fileName: "sample_items.csv" });
    saveDatasetV2("uom", pu.headers, pu.rows, { fileName: "sample_uom.csv" });
  }

  function downloadSamples() {
    downloadTextFile("sample_movements.csv", getSampleMovementsCSV());
    downloadTextFile("sample_items.csv", getSampleItemsCSV());
    downloadTextFile("sample_uom.csv", getSampleUomCSV());
  }

  function goNext() {
    setError("");
    const m = loadDatasetV2("movements");
    if (!m) {
      setError("Movements.csv is required. Please upload the inventory movements ledger first.");
      return;
    }
    router.push("/mapping");
  }

  function DatasetCard({
    keyName,
    title,
    required,
    preview,
    hint,
  }: {
    keyName: DatasetKey;
    title: string;
    required?: boolean;
    preview: Preview | null;
    hint: string;
  }) {
    const headerCount = preview?.headers.length ?? 0;
    const rowCount = preview?.rows.length ?? 0;

    return (
      <div className="hover-lift anim-in anim-delay-2" style={styles.cardPad}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>
            {title}{" "}
            {required ? <span style={{ color: "#a78bfa" }}>(Required)</span> : <span style={{ color: "#8f97ad" }}>(Optional)</span>}
          </div>
          <div style={{ fontSize: 12, color: "#aab1c4" }}>{preview?.fileName ?? "No file"}</div>
        </div>

        <div style={styles.footerNote}>{hint}</div>

        <div
          style={styles.drop(keyName)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverKey(keyName);
          }}
          onDragLeave={() => setDragOverKey(null)}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0] ?? null;
            void handleFile(keyName, file);
          }}
        >
          <div style={styles.dropTitle}>{busyKey === keyName ? "Reading file..." : "Drag & drop CSV here"}</div>
          <div style={styles.hint}>Or click “Choose file”.</div>

          <div style={styles.row}>
            <button
              className="btn-glow"
              style={styles.btnPrimary}
              type="button"
              onClick={() => inputRefs[keyName].current?.click()}
              disabled={busyKey !== null}
            >
              Choose file
            </button>

            {preview ? (
              <button className="btn-glow" style={styles.btnGhost} type="button" onClick={() => removeDataset(keyName)} disabled={busyKey !== null}>
                Remove
              </button>
            ) : null}

            <input
              ref={inputRefs[keyName]}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => void handleFile(keyName, e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <div style={styles.kpi}>
            <div style={styles.kpiTitle}>Detected columns</div>
            <div style={styles.kpiValue}>{headerCount || "—"}</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiTitle}>Preview rows</div>
            <div style={styles.kpiValue}>{rowCount || "—"}</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiTitle}>Status</div>
            <div style={styles.kpiValue}>{preview ? "Loaded" : "—"}</div>
          </div>
        </div>

        {preview ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {preview.headers.slice(0, 6).map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, idx) => (
                  <tr key={idx} style={styles.tr}>
                    {preview.headers.slice(0, 6).map((h) => (
                      <td key={h} style={styles.td}>
                        {r[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.footerNote}>Showing first 10 rows and first 6 columns.</div>
          </div>
        ) : null}
      </div>
    );
  }

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
                <div style={styles.subtitle}>Ledger Upload → Map → Results</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>

              <button className="btn-glow" style={styles.btnGhost} type="button" onClick={downloadSamples} disabled={busyKey !== null}>
                Download CSV templates
              </button>

              <button className="btn-glow" style={styles.btnGhost} type="button" onClick={useSamples} disabled={busyKey !== null}>
                Use sample datasets
              </button>

              <button className="btn-glow" style={styles.btnPrimary} type="button" onClick={goNext} disabled={!hasMovements || busyKey !== null}>
                Continue → Mapping
              </button>
            </div>
          </div>

          {/* Hero info */}
          <div className="anim-in anim-delay-2" style={styles.hero}>
            <span style={styles.pill}>⚡ Demo Upload (Ledger-first)</span>
            <h1 style={styles.h1}>Upload inventory movements (required) + optional master data</h1>
            <p style={styles.p}>
              <b style={{ color: "#e6e8ee" }}>Movements.csv</b> is required (each row = one movement).
              <br />
              <b style={{ color: "#e6e8ee" }}>Items.csv</b> and <b style={{ color: "#e6e8ee" }}>UOM_Conversions.csv</b> are optional.
            </p>

            {!hasMovements ? (
              <div style={styles.footerNote}>
                Tip: start with templates → click <b>Download CSV templates</b>.
              </div>
            ) : (
              <div style={styles.footerNote}>Movements loaded ✅ You can continue to Mapping.</div>
            )}
          </div>

          {/* Grid */}
          <div style={styles.grid}>
            <DatasetCard
              keyName="movements"
              title="Movements.csv"
              required
              preview={previewMovements}
              hint="Must include: item_id, date, qty, movement_type. uom/warehouse optional."
            />

            <DatasetCard
              keyName="items"
              title="Items.csv"
              preview={previewItems}
              hint="Optional product master data: item_name, category, default_uom, shelf_life_days..."
            />

            <DatasetCard
              keyName="uom"
              title="UOM_Conversions.csv"
              preview={previewUom}
              hint="Optional conversions: item_id, from_uom, to_uom, factor (e.g., 1 case = 24 piece)."
            />
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}

          {/* Global styles */}
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