"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

type Row = Record<string, string>;

export default function UploadPage() {
  const [mode, setMode] = useState<"paste" | "upload" | "connect">("paste");

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const [pasted, setPasted] = useState("");

  const hint = useMemo(
    () => "Recommended columns: sku | on_hand | avg_daily_sales (optional: unit_cost)",
    []
  );

  function hydrate(data: Row[], header: string[]) {
    setColumns(header);
    setRows(data);
    localStorage.setItem("ide_rows", JSON.stringify(data));
  }

  function parseDelimited(text: string, delimiter: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error("Add at least header + 1 row.");

    const header = lines[0].split(delimiter).map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const cells = line.split(delimiter).map((c) => c.trim());
      const obj: Row = {};
      header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
      return obj;
    });

    hydrate(data, header);
  }

  function parsePaste(text: string) {
    const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
    const delimiter = firstLine.includes("\t") ? "\t" : ",";
    parseDelimited(text, delimiter);
  }

  function parseCSV(text: string) {
    parseDelimited(text, ",");
  }

  function onUsePasted() {
    setError("");
    try {
      parsePaste(pasted);
    } catch (e: any) {
      setError(e?.message || "Failed to parse pasted data");
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }

    setFileName(f.name);

    try {
      const text = await f.text();
      parseCSV(text);
    } catch (err: any) {
      setError(err?.message || "Failed to parse CSV");
    }
  }

  const hasData = rows.length > 0;

  return (
    <main style={S.page}>
      {/* Top thin bar */}
      <div style={S.topBar}>
        <div style={S.brand}>Inventory Decision Engine</div>
        <Link href="/" style={S.topLink}>← Home</Link>
      </div>

      <div style={S.container}>
        <div style={S.titleRow}>
          <div>
            <h1 style={S.h1}>Data Input</h1>
            <p style={S.subtitle}>
              For companies: fastest option is <b>Paste from Excel</b>. CSV is optional.
            </p>
          </div>
        </div>

        <div style={S.card}>
          {/* Tabs */}
          <div style={S.tabsWrap}>
            <Tab active={mode === "paste"} onClick={() => setMode("paste")}>Paste Table</Tab>
            <Tab active={mode === "upload"} onClick={() => setMode("upload")}>Upload CSV</Tab>
            <Tab active={mode === "connect"} onClick={() => setMode("connect")}>Connect (soon)</Tab>
          </div>

          <div style={S.hint}>{hint}</div>

          {/* Paste */}
          {mode === "paste" && (
            <div style={{ marginTop: 14 }}>
              <div style={S.rowBetween}>
                <div style={S.helpText}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>How:</div>
                  <div style={{ marginTop: 4 }}>
                    افتحي Excel → حددي الجدول كله → Copy → Paste هنا.
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                    Works with Excel copy (tab-separated) or comma-separated.
                  </div>
                </div>

                <button style={S.primaryBtn} onClick={onUsePasted}>
                  Use Pasted Data
                </button>
              </div>

              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={`sku\ton_hand\tavg_daily_sales\nABC-01\t120\t6\nABC-02\t10\t3`}
                style={S.textarea}
              />
            </div>
          )}

          {/* Upload */}
          {mode === "upload" && (
            <div style={{ marginTop: 14 }}>
              <div style={S.rowBetween}>
                <div style={S.helpText}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>Upload CSV</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                    We'll parse it and store it for the Results page.
                  </div>
                </div>

                <label style={S.uploadBtn}>
                  Select CSV File
                  <input type="file" accept=".csv" onChange={onFileChange} style={{ display: "none" }} />
                </label>
              </div>

              {fileName && (
                <div style={{ marginTop: 10, color: "#334155" }}>
                  Uploaded: <b>{fileName}</b>
                </div>
              )}
            </div>
          )}

          {/* Connect soon */}
          {mode === "connect" && (
            <div style={S.soonBox}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>
                Connect data sources (coming next)
              </div>
              <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>
                • Google Sheets link<br />
                • API / ERP connector<br />
                • SQL connection
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                v1 covers most companies with Paste + Upload.
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div style={S.errorBox}>{error}</div>}

          {/* Preview */}
          {hasData && (
            <div style={{ marginTop: 18 }}>
              <div style={S.previewHeader}>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                  Preview <span style={{ color: "#64748b", fontWeight: 700 }}>({rows.length} rows)</span>
                </div>

                <Link href="/results" style={S.goBtn}>
                  Go to Results →
                </Link>
              </div>

              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c} style={S.th}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 15).map((r, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #eef2f7" }}>
                        {columns.map((c) => (
                          <td key={c} style={S.td}>{r[c]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                Showing first 15 rows only.
              </div>
            </div>
          )}
        </div>

        <div style={S.footer}>
          <div>Tip: Paste from Excel = best UX for companies.</div>
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI ---------------- */

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.tab,
        ...(active ? S.tabActive : {}),
      }}
    >
      {children}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f9ff",
    fontFamily: "system-ui",
  },
  topBar: {
    height: 56,
    background: "white",
    borderBottom: "1px solid #eaf0ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
  },
  brand: { fontWeight: 900, color: "#0f172a" },
  topLink: { color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "26px 18px",
  },
  titleRow: {
    textAlign: "center",
    marginBottom: 14,
  },
  h1: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subtitle: {
    margin: "10px auto 0",
    maxWidth: 720,
    color: "#475569",
    lineHeight: 1.5,
  },

  card: {
    background: "white",
    border: "1px solid #eaf0ff",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 34px rgba(15, 23, 42, 0.06)",
  },

  tabsWrap: {
    display: "flex",
    gap: 8,
    padding: 6,
    borderRadius: 16,
    background: "#f1f5ff",
    width: "fit-content",
    margin: "0 auto",
    border: "1px solid #eaf0ff",
  },
  tab: {
    border: "1px solid transparent",
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    color: "#334155",
  },
  tabActive: {
    background: "white",
    border: "1px solid #eaf0ff",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
    color: "#0f172a",
  },

  hint: {
    marginTop: 14,
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
  },

  helpText: {
    color: "#475569",
    lineHeight: 1.5,
    maxWidth: 560,
  },

  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.18)",
  },

  uploadBtn: {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.18)",
  },

  textarea: {
    marginTop: 12,
    width: "100%",
    minHeight: 220,
    padding: 14,
    borderRadius: 18,
    border: "1px solid #eaf0ff",
    background: "#fbfdff",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.55,
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.02)",
  },

  soonBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    border: "1px dashed #c7d2fe",
    background: "#f8faff",
  },

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 900,
  },

  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },

  goBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    background: "#0f172a",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
  },

  tableWrap: {
    overflow: "auto",
    border: "1px solid #eef2f7",
    borderRadius: 18,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "12px 12px",
    background: "#f8fafc",
    fontSize: 12,
    color: "#334155",
    borderBottom: "1px solid #eef2f7",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },

  footer: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
  },
};