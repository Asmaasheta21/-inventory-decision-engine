"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { clearDemo, saveUpload } from "@/lib/demoStore";
import { parseTabular } from "@/lib/parseTabular";

type Preview = {
  headers: string[];
  rows: Record<string, string>[];
  fileName?: string;
};

type SlotKey = "movements" | "items" | "conversions";

const ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isSupported(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx");
}

export default function UploadPage() {
  const router = useRouter();

  const inputMovRef = useRef<HTMLInputElement | null>(null);
  const inputItemsRef = useRef<HTMLInputElement | null>(null);
  const inputConvRef = useRef<HTMLInputElement | null>(null);

  const [dragOver, setDragOver] = useState<SlotKey | null>(null);
  const [busyKey, setBusyKey] = useState<SlotKey | null>(null);
  const [error, setError] = useState<string>("");

  const [movements, setMovements] = useState<Preview | null>(null);
  const [items, setItems] = useState<Preview | null>(null);
  const [conversions, setConversions] = useState<Preview | null>(null);

  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background:
        "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
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
        maxWidth: 1080,
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

      hero: {
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        gap: 16,
      } as CSSProperties,

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

      h1: { margin: "10px 0 8px", fontSize: 28, lineHeight: 1.15 } as CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as CSSProperties,

      grid: { display: "grid", gap: 12, marginTop: 14 } as CSSProperties,

      slotTitle: { fontWeight: 950, fontSize: 14 } as CSSProperties,
      slotMeta: { fontSize: 12, color: "#aab1c4", marginTop: 4 } as CSSProperties,

      drop: (active: boolean) =>
        ({
          marginTop: 10,
          borderRadius: 16,
          border: active
            ? "1px solid rgba(110,231,255,0.55)"
            : "1px dashed #2a3350",
          background: active
            ? "rgba(110,231,255,0.08)"
            : "rgba(20,27,48,0.35)",
          padding: 14,
          transition: "200ms ease",
        }) as CSSProperties,

      hint: { fontSize: 13, color: "#8f97ad", lineHeight: 1.6 } as CSSProperties,
      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 } as CSSProperties,

      error: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as CSSProperties,

      ok: {
        marginTop: 10,
        padding: 10,
        borderRadius: 12,
        border: "1px solid rgba(60,200,120,0.25)",
        background: "rgba(60,200,120,0.08)",
        color: "#d7ffe6",
        fontSize: 12,
      } as CSSProperties,

      tableWrap: { marginTop: 14, overflowX: "auto" } as CSSProperties,
      table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" } as CSSProperties,
      th: { textAlign: "left", fontSize: 12, color: "#aab1c4", fontWeight: 800, padding: "0 10px" } as CSSProperties,
      tr: { background: "rgba(20,27,48,0.55)" } as CSSProperties,
      td: { padding: "10px 10px", fontSize: 13, color: "#c8cee0" } as CSSProperties,

      footerNote: { marginTop: 12, fontSize: 12, color: "#8f97ad" } as CSSProperties,
    };
  }, []);

  function getSlotPreview(key: SlotKey) {
    if (key === "movements") return movements;
    if (key === "items") return items;
    return conversions;
  }

  function setSlotPreview(key: SlotKey, value: Preview | null) {
    if (key === "movements") setMovements(value);
    else if (key === "items") setItems(value);
    else setConversions(value);
  }

  function getSlotInputRef(key: SlotKey) {
    if (key === "movements") return inputMovRef;
    if (key === "items") return inputItemsRef;
    return inputConvRef;
  }

  async function handleFile(key: SlotKey, file: File | null) {
    setError("");
    if (!file) return;

    if (!isSupported(file)) {
      setError("Unsupported file type. Please upload .csv or .xlsx");
      return;
    }

    setBusyKey(key);
    try {
      const { headers, rows } = await parseTabular(file);

      if (!headers?.length) throw new Error("File looks empty (no headers detected).");
      if (!rows?.length) throw new Error("File has headers but no data rows.");

      setSlotPreview(key, {
        headers,
        rows: rows.slice(0, 10),
        fileName: file.name,
      });

      sessionStorage.setItem(
        `ide_upload_${key}`,
        JSON.stringify({ headers, rows, fileName: file.name })
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to read file.");
      setSlotPreview(key, null);
      sessionStorage.removeItem(`ide_upload_${key}`);
    } finally {
      setBusyKey(null);
      setDragOver(null);
    }
  }

  function resetAll() {
    setError("");
    setMovements(null);
    setItems(null);
    setConversions(null);
    sessionStorage.removeItem("ide_upload_movements");
    sessionStorage.removeItem("ide_upload_items");
    sessionStorage.removeItem("ide_upload_conversions");
    clearDemo();
  }

  function continueToMapping() {
    setError("");
    const raw = sessionStorage.getItem("ide_upload_movements");
    if (!raw) {
      setError("Movements file is required (upload Movements first).");
      return;
    }

    const parsed = JSON.parse(raw) as {
      headers: string[];
      rows: Record<string, string>[];
      fileName?: string;
    };

    clearDemo();
    // ✅ شلنا dataset عشان ما يطلعش error مع demoStore
    saveUpload(parsed.headers, parsed.rows, { fileName: parsed.fileName ?? "movements" });

    setTimeout(() => router.push("/mapping"), 200);
  }

  function Slot({
    keyName,
    title,
    required,
    desc,
  }: {
    keyName: SlotKey;
    title: string;
    required?: boolean;
    desc: string;
  }) {
    const pv = getSlotPreview(keyName);
    const active = dragOver === keyName;
    const busy = busyKey === keyName;

    return (
      <div style={styles.cardPad}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div>
            <div style={styles.slotTitle}>
              {title} {required ? <span style={{ color: "#ffd4d4" }}>*</span> : null}
            </div>
            <div style={styles.slotMeta}>{desc}</div>
          </div>
        </div>

        <div
          style={styles.drop(active)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(keyName);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0] ?? null;
            void handleFile(keyName, f);
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            {busy ? "Reading file..." : "Drag & drop CSV/XLSX here"}
          </div>
          <div style={styles.hint}>Or click “Choose file”.</div>

          <div style={styles.row}>
            <button
              className="btn-glow"
              style={styles.btnPrimary}
              type="button"
              onClick={() => getSlotInputRef(keyName).current?.click()}
              disabled={!!busyKey}
            >
              Choose file
            </button>

            {pv ? (
              <button
                className="btn-glow"
                style={styles.btnGhost}
                type="button"
                onClick={() => {
                  setSlotPreview(keyName, null);
                  sessionStorage.removeItem(`ide_upload_${keyName}`);
                }}
                disabled={!!busyKey}
              >
                Remove
              </button>
            ) : null}

            <input
              ref={getSlotInputRef(keyName)}
              type="file"
              accept={ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => void handleFile(keyName, e.target.files?.[0] ?? null)}
            />
          </div>

          {pv ? (
            <div style={styles.ok}>
              Loaded: <b>{pv.fileName}</b> • Columns: <b>{pv.headers.length}</b> • Preview rows:{" "}
              <b>{pv.rows.length}</b>
            </div>
          ) : null}
        </div>

        {pv ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {pv.headers.slice(0, 6).map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pv.rows.map((r, idx) => (
                  <tr key={idx} style={styles.tr}>
                    {pv.headers.slice(0, 6).map((h) => (
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
          <div className="anim-in anim-delay-1" style={styles.topbar}>
            <div style={styles.brand}>
              <div style={styles.logo} />
              <div>
                <div style={styles.title}>Inventory Decision Engine</div>
                <div style={styles.subtitle}>Upload Movements (required) → Mapping → Results</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>Home</a>
              <button className="btn-glow" style={styles.btnGhost} type="button" onClick={resetAll}>
                Reset
              </button>
              <button
                className="btn-glow"
                style={styles.btnPrimary}
                type="button"
                onClick={continueToMapping}
                disabled={!movements || !!busyKey}
                title={!movements ? "Upload Movements first" : "Continue"}
              >
                Continue → Mapping
              </button>
            </div>
          </div>

          <div style={styles.hero}>
            <div className="anim-in anim-delay-2" style={styles.cardPad}>
              <span style={styles.pill}>⚡ Multi Upload</span>
              <h1 style={styles.h1}>Upload your datasets</h1>
              <p style={styles.p}>
                Supported formats: <b style={{ color: "#e6e8ee" }}>.csv</b> and{" "}
                <b style={{ color: "#e6e8ee" }}>.xlsx</b>
                <br />
                Movements is required. Items & Conversions are optional.
              </p>

              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <Slot
                  keyName="movements"
                  title="Movements"
                  required
                  desc="Each row = a stock movement (receipt/issue/transfer/adjust/scrap)."
                />
                <Slot
                  keyName="items"
                  title="Items (optional)"
                  desc="Item master (name/category/default_uom/shelf_life_days)."
                />
                <Slot
                  keyName="conversions"
                  title="UOM Conversions (optional)"
                  desc="Unit conversions per item (CASE→PCS, L→ML, …)."
                />
              </div>

              {error ? <div style={styles.error}>{error}</div> : null}

              <div style={styles.footerNote}>
                Optional datasets are stored in your browser session (sessionStorage).
              </div>
            </div>

            <div className="hover-lift anim-in anim-delay-3" style={styles.cardPad}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Status</div>
              <div style={{ marginTop: 12, color: "#b7bed1", lineHeight: 1.7 }}>
                <div>
                  Movements:{" "}
                  <b style={{ color: movements ? "#d7ffe6" : "#ffd4d4" }}>
                    {movements ? "Loaded" : "Required"}
                  </b>
                </div>
                <div>
                  Items:{" "}
                  <b style={{ color: items ? "#d7ffe6" : "#aab1c4" }}>
                    {items ? "Loaded" : "Optional"}
                  </b>
                </div>
                <div>
                  Conversions:{" "}
                  <b style={{ color: conversions ? "#d7ffe6" : "#aab1c4" }}>
                    {conversions ? "Loaded" : "Optional"}
                  </b>
                </div>
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
              0%,100% { background-position: 0% 0%, 100% 0%, 50% 50%; }
              50% { background-position: 10% 8%, 92% 12%, 50% 50%; }
            }
            .anim-in {
              opacity: 0;
              transform: translateY(10px);
              animation: fadeUp 650ms ease-out forwards;
            }
            .anim-delay-1 { animation-delay: 80ms; }
            .anim-delay-2 { animation-delay: 160ms; }
            .anim-delay-3 { animation-delay: 240ms; }
            @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
            .hover-lift { transition: transform 200ms ease, box-shadow 200ms ease; }
            .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 40px rgba(0,0,0,0.35); }
            .btn-glow { transition: transform 150ms ease, filter 150ms ease; }
            .btn-glow:hover { transform: translateY(-1px); filter: drop-shadow(0 10px 20px rgba(110,231,255,0.2)); }
            @media (prefers-reduced-motion: reduce) {
              .anim-in, .bg-breathe, .hover-lift, .btn-glow {
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