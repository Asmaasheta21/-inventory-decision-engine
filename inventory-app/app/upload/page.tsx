"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearDemo, saveUpload } from "@/lib/demoStore";
import { parseTabular } from "@/lib/parseTabular";

type Preview = {
  headers: string[];
  rows: Record<string, string>[];
  fileName?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background: "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btn: React.CSSProperties = {
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
      } as React.CSSProperties,

      container: {
        maxWidth: 1080,
        margin: "0 auto",
        padding: "18px 20px 60px",
      } as React.CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      } as React.CSSProperties,

      brand: {
        display: "flex",
        alignItems: "center",
        gap: 10,
      } as React.CSSProperties,

      logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
      } as React.CSSProperties,

      title: { fontWeight: 900, letterSpacing: 0.2 } as React.CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      } as React.CSSProperties,

      btnPrimary: {
        ...btn,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
        color: "#0b0f1a",
        border: "none",
      } as React.CSSProperties,

      btnGhost: {
        ...btn,
        background: "transparent",
        color: "#e6e8ee",
        border: "1px solid #2a3350",
      } as React.CSSProperties,

      hero: {
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        gap: 16,
      } as React.CSSProperties,

      card,
      cardPad: { ...card, padding: 18 } as React.CSSProperties,

      pill: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: "#dfe3f1",
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
      } as React.CSSProperties,

      h1: { margin: "10px 0 8px", fontSize: 30, lineHeight: 1.15 } as React.CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as React.CSSProperties,

      drop: {
        marginTop: 14,
        borderRadius: 16,
        border: dragOver ? "1px solid rgba(110,231,255,0.55)" : "1px dashed #2a3350",
        background: dragOver ? "rgba(110,231,255,0.08)" : "rgba(20,27,48,0.35)",
        padding: 16,
        transition: "200ms ease",
      } as React.CSSProperties,

      dropTitle: { fontWeight: 900, marginBottom: 8 } as React.CSSProperties,
      hint: { fontSize: 13, color: "#8f97ad", lineHeight: 1.6 } as React.CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as React.CSSProperties,

      error: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as React.CSSProperties,

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 } as React.CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      kpiValue: { fontSize: 20, fontWeight: 950, marginTop: 6 } as React.CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as React.CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as React.CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as React.CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0" } as React.CSSProperties,

      footerNote: { marginTop: 12, fontSize: 12, color: "#8f97ad" } as React.CSSProperties,
    };
  }, [dragOver]);

  function isSupported(file: File) {
    const name = file.name.toLowerCase();
    const ok =
      name.endsWith(".csv") ||
      name.endsWith(".xlsx") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return ok;
  }

  async function handleFile(file: File | null) {
    setError("");
    if (!file) return;

    if (!isSupported(file)) {
      setError("Unsupported file type. Please upload a .csv or .xlsx file.");
      return;
    }

    setBusy(true);
    try {
      const { headers, rows } = await parseTabular(file);

      if (!headers?.length) throw new Error("File looks empty (no headers detected).");
      if (!rows?.length) throw new Error("File has headers but no data rows.");

      // Preview first 10 rows only
      setPreview({
        headers,
        rows: rows.slice(0, 10),
        fileName: file.name,
      });

      // Save full rows to demo store + go to mapping
      clearDemo();
      saveUpload(headers, rows, { fileName: file.name });

      // Small delay for “premium feel”
      setTimeout(() => {
        router.push("/mapping");
      }, 250);
    } catch (e: any) {
      setError(e?.message ?? "Failed to read file.");
    } finally {
      setBusy(false);
      setDragOver(false);
    }
  }

  function downloadSampleCSV() {
    const sample = [
      ["sku", "on_hand", "sales_30d", "warehouse"].join(","),
      ["SKU-102", "120", "300", "WH-A"].join(","),
      ["SKU-088", "900", "60", "WH-A"].join(","),
      ["SKU-055", "40", "180", "WH-B"].join(","),
      ["SKU-019", "0", "90", "WH-B"].join(","),
    ].join("\n");

    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const headerCount = preview?.headers.length ?? 0;
  const rowCount = preview?.rows.length ?? 0;

  return (
    <div style={styles.wrap}>
      {/* Premium background */}
      <div className="bg-breathe" style={{ minHeight: "100vh" }}>
        <div style={styles.container}>
          {/* Topbar */}
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory Decision Engine</div>
                <div style={styles.subtitle}>Demo • Upload (CSV/XLSX) → Map Columns → Results</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>
              <button className="btn-glow" style={styles.btnGhost} onClick={downloadSampleCSV} type="button">
                Download sample CSV
              </button>
            </div>
          </div>

          <div style={styles.hero}>
            {/* Left: Instructions + Dropzone */}
            <div className="anim-in anim-delay-2" style={styles.cardPad}>
              <span style={styles.pill}>⚡ Demo Upload</span>
              <h1 style={styles.h1}>Upload your inventory file</h1>
              <p style={styles.p}>
                Supported: <b style={{ color: "#e6e8ee" }}>.csv</b> and{" "}
                <b style={{ color: "#e6e8ee" }}>.xlsx</b>.
                <br />
                Minimum required fields: <b style={{ color: "#e6e8ee" }}>SKU</b>,{" "}
                <b style={{ color: "#e6e8ee" }}>On Hand</b>,{" "}
                <b style={{ color: "#e6e8ee" }}>Sales (30d)</b>. Warehouse is optional.
              </p>

              <div
                style={styles.drop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0] ?? null;
                  void handleFile(file);
                }}
              >
                <div style={styles.dropTitle}>{busy ? "Reading file..." : "Drag & drop your CSV/XLSX here"}</div>
                <div style={styles.hint}>Or click “Choose file”. We’ll take you to column mapping next.</div>

                <div style={styles.row}>
                  <button
                    className="btn-glow"
                    style={styles.btnPrimary}
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                  >
                    Choose file
                  </button>

                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: "none" }}
                    onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {error ? <div style={styles.error}>{error}</div> : null}

              <div style={styles.footerNote}>Privacy: Demo stores data in your browser session only (no server save).</div>
            </div>

            {/* Right: Preview */}
            <div className="hover-lift anim-in anim-delay-3" style={styles.cardPad}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Preview</div>
                <div style={{ fontSize: 12, color: "#aab1c4" }}>{preview?.fileName ? preview.fileName : "No file yet"}</div>
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
                  <div style={styles.kpiTitle}>Next step</div>
                  <div style={styles.kpiValue}>Mapping</div>
                </div>
              </div>

              {!preview ? (
                <div style={{ marginTop: 14, color: "#b7bed1", lineHeight: 1.7 }}>
                  Upload a CSV/XLSX to see a preview of the first rows before mapping.
                </div>
              ) : (
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

                  <div style={styles.footerNote}>Showing first 10 rows and first 6 columns (for speed).</div>
                </div>
              )}
            </div>
          </div>

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