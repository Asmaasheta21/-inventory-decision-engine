"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadDatasetV2,
  loadMappingV2,
  saveMovementTypeValueMappingV2,
  loadMovementTypeValueMappingV2,
  type DemoRow,
  type MovementsMapping,
} from "@/lib/demoStore";

type Bucket = "IN" | "OUT" | "OTHER";

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function norm(x: string) {
  return (x ?? "").toString().trim();
}

export default function MovementTypesPage() {
  const router = useRouter();

  const movements = typeof window !== "undefined" ? loadDatasetV2("movements") : null;
  const mapping: MovementsMapping | null = typeof window !== "undefined" ? loadMappingV2() : null;

  const headers = movements?.headers ?? [];
  const rows = movements?.rows ?? [];
  const fileName = movements?.fileName ?? "Movements.csv";

  const [error, setError] = useState("");
  const [info, setInfo] = useState<string>("");

  // if no dataset/mapping -> redirect hints
  const missing = !movements || !mapping;

  const movementTypeCol = mapping?.movementType ?? "";

  const allValues = useMemo(() => {
    if (!movementTypeCol) return [];
    const vals: string[] = [];
    for (const r of rows as DemoRow[]) {
      const v = norm(r[movementTypeCol] ?? "");
      if (v) vals.push(v);
    }
    // show unique sorted values
    const u = uniq(vals);
    u.sort((a, b) => a.localeCompare(b));
    return u;
  }, [rows, movementTypeCol]);

  const saved = typeof window !== "undefined" ? loadMovementTypeValueMappingV2() : null;

  const [inValues, setInValues] = useState<string[]>(saved?.inValues ?? []);
  const [outValues, setOutValues] = useState<string[]>(saved?.outValues ?? []);
  const [otherValues, setOtherValues] = useState<string[]>(saved?.otherValues ?? []);

  const pickedSet = useMemo(() => {
    const s = new Set<string>();
    inValues.forEach((x) => s.add(x));
    outValues.forEach((x) => s.add(x));
    otherValues.forEach((x) => s.add(x));
    return s;
  }, [inValues, outValues, otherValues]);

  const unassigned = useMemo(() => allValues.filter((v) => !pickedSet.has(v)), [allValues, pickedSet]);

  function setBucket(value: string, bucket: Bucket) {
    setError("");
    setInfo("");

    // remove from all first
    const remove = (arr: string[]) => arr.filter((x) => x !== value);

    let nextIn = remove(inValues);
    let nextOut = remove(outValues);
    let nextOther = remove(otherValues);

    if (bucket === "IN") nextIn = uniq([...nextIn, value]);
    if (bucket === "OUT") nextOut = uniq([...nextOut, value]);
    if (bucket === "OTHER") nextOther = uniq([...nextOther, value]);

    setInValues(nextIn);
    setOutValues(nextOut);
    setOtherValues(nextOther);
  }

  function autoGuess() {
    setError("");
    setInfo("");

    // very light heuristic guesses
    const IN_KEYS = ["receipt", "gr", "in", "add", "rcv", "receive", "po", "poreceipt", "stockin"];
    const OUT_KEYS = ["issue", "gi", "out", "sale", "consume", "ship", "delivery", "pick", "stockout"];

    const nextIn: string[] = [];
    const nextOut: string[] = [];
    const nextOther: string[] = [];

    for (const v of allValues) {
      const low = v.toLowerCase();

      const looksIn = IN_KEYS.some((k) => low.includes(k));
      const looksOut = OUT_KEYS.some((k) => low.includes(k));

      if (looksIn && !looksOut) nextIn.push(v);
      else if (looksOut && !looksIn) nextOut.push(v);
      else nextOther.push(v);
    }

    setInValues(uniq(nextIn));
    setOutValues(uniq(nextOut));
    setOtherValues(uniq(nextOther));
    setInfo("Auto-guess applied. Please review before continuing.");
  }

  function clearAll() {
    setError("");
    setInfo("");
    setInValues([]);
    setOutValues([]);
    setOtherValues([]);
  }

  function validateAndContinue() {
    setError("");
    setInfo("");

    if (!movements) {
      setError("No Movements dataset found. Please upload Movements.csv first.");
      return;
    }
    if (!mapping?.movementType) {
      setError("No Movement Type column mapped. Please complete Mapping first.");
      return;
    }

    // Must have at least one IN and one OUT for meaningful calculations
    if (inValues.length === 0 || outValues.length === 0) {
      setError("Please assign at least 1 value to IN and 1 value to OUT.");
      return;
    }

    // Warn if a lot is unassigned (but don't block)
    if (unassigned.length > 0) {
      setInfo(`Note: ${unassigned.length} values are still unassigned. They will be treated as OTHER (ignored) for now.`);
    }

    // Save (unassigned will be auto treated as OTHER on save)
    const finalOther = uniq([...otherValues, ...unassigned]);

    saveMovementTypeValueMappingV2({
      inValues: uniq(inValues),
      outValues: uniq(outValues),
      otherValues: finalOther,
    });

    router.push("/results");
  }

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
      border: "none",
    };

    return {
      wrap: { minHeight: "100vh", color: "#e6e8ee", fontFamily: "Arial, sans-serif" } as React.CSSProperties,
      container: { maxWidth: 1120, margin: "0 auto", padding: "18px 20px 60px" } as React.CSSProperties,

      topbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
      } as React.CSSProperties,

      brand: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
      logo: { width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6ee7ff,#a78bfa)" } as React.CSSProperties,
      title: { fontWeight: 900, letterSpacing: 0.2 } as React.CSSProperties,
      subtitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,

      link: {
        color: "#b7bed1",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
      } as React.CSSProperties,

      hero: { ...card, padding: 18, marginBottom: 14 } as React.CSSProperties,

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

      h1: { margin: "10px 0 8px", fontSize: 26, lineHeight: 1.15 } as React.CSSProperties,
      p: { margin: 0, color: "#b7bed1", lineHeight: 1.7 } as React.CSSProperties,

      grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 } as React.CSSProperties,

      card,
      cardPad: { ...card, padding: 16 } as React.CSSProperties,

      badge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
        color: "#dfe3f1",
      } as React.CSSProperties,

      kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 } as React.CSSProperties,
      kpi: { padding: 12, borderRadius: 14, border: "1px solid #202946", background: "rgba(20,27,48,0.55)" } as React.CSSProperties,
      kpiTitle: { fontSize: 12, color: "#aab1c4" } as React.CSSProperties,
      kpiValue: { fontSize: 18, fontWeight: 950, marginTop: 6 } as React.CSSProperties,

      sectionTitle: { fontWeight: 950, marginBottom: 10 } as React.CSSProperties,

      pillIn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(110,231,255,0.25)",
        background: "rgba(110,231,255,0.08)",
      } as React.CSSProperties,

      pillOut: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(167,139,250,0.30)",
        background: "rgba(167,139,250,0.10)",
      } as React.CSSProperties,

      pillOther: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
      } as React.CSSProperties,

      list: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      } as React.CSSProperties,

      chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid #202946",
        background: "rgba(20,27,48,0.55)",
        color: "#e6e8ee",
        fontSize: 13,
      } as React.CSSProperties,

      chipValue: { fontWeight: 900 } as React.CSSProperties,

      chipBtns: { display: "inline-flex", gap: 6 } as React.CSSProperties,

      miniBtn: {
        padding: "6px 8px",
        borderRadius: 10,
        border: "1px solid #2a3350",
        background: "transparent",
        color: "#e6e8ee",
        cursor: "pointer",
        fontWeight: 850,
        fontSize: 12,
      } as React.CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as React.CSSProperties,

      btnPrimary: { padding: "10px 14px", borderRadius: 12, fontWeight: 900, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6ee7ff,#a78bfa)", color: "#0b0f1a" } as React.CSSProperties,
      btnGhost: { ...btn, background: "transparent", border: "1px solid #2a3350", color: "#e6e8ee" } as React.CSSProperties,

      error: { marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,80,80,0.35)", background: "rgba(255,80,80,0.08)", color: "#ffd4d4" } as React.CSSProperties,
      info: { marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(110,231,255,0.35)", background: "rgba(110,231,255,0.08)", color: "#dfefff" } as React.CSSProperties,
    };
  }, []);

  if (missing) {
    return (
      <div style={styles.wrap}>
        <div className="bg-breathe" style={{ minHeight: "100vh" }}>
          <div style={styles.container}>
            <div style={styles.hero}>
              <span style={styles.pill}>⚠ Missing step</span>
              <h1 style={styles.h1}>We need Upload + Mapping first</h1>
              <p style={styles.p}>Go back and upload Movements.csv then map the Movement Type column.</p>

              <div style={styles.row}>
                <button style={styles.btnGhost} onClick={() => router.push("/upload")}>
                  Go to Upload
                </button>
                <button style={styles.btnPrimary} onClick={() => router.push("/mapping")}>
                  Go to Mapping
                </button>
              </div>
            </div>

            <GlobalStyles />
          </div>
        </div>
      </div>
    );
  }

  const total = allValues.length;

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
                <div style={styles.subtitle}>Demo • Movement Type Values</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/" style={styles.link}>
                Home
              </a>
              <a href="/upload" style={styles.link}>
                Upload
              </a>
              <a href="/mapping" style={styles.link}>
                Mapping
              </a>
            </div>
          </div>

          {/* Hero */}
          <div className="anim-in anim-delay-2" style={styles.hero}>
            <span style={styles.pill}>🧠 Movement Type Value Mapping</span>
            <h1 style={styles.h1}>Classify movement type values as IN / OUT / OTHER</h1>
            <p style={styles.p}>
              We detected unique values from <b style={{ color: "#e6e8ee" }}>{movementTypeCol}</b> in{" "}
              <span style={styles.badge}>{fileName}</span>. Assign each value to the right bucket.
            </p>

            <div style={styles.kpiGrid}>
              <KPI title="Unique values" value={total} styles={styles} />
              <KPI title="IN" value={inValues.length} styles={styles} />
              <KPI title="OUT" value={outValues.length} styles={styles} />
              <KPI title="Unassigned" value={unassigned.length} styles={styles} />
            </div>

            <div style={styles.row}>
              <button style={styles.btnGhost} onClick={autoGuess} type="button">
                Auto-guess
              </button>
              <button style={styles.btnGhost} onClick={clearAll} type="button">
                Clear
              </button>
              <button style={styles.btnPrimary} onClick={validateAndContinue} type="button">
                Save & Continue → Results
              </button>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {info ? <div style={styles.info}>{info}</div> : null}
          </div>

          {/* Buckets */}
          <div style={styles.grid}>
            <BucketCard
              title="IN"
              subtitle="Receipts / Stock added"
              pillStyle={styles.pillIn}
              values={inValues}
              onMove={(v) => setBucket(v, "IN")}
              onMoveTo={(v, b) => setBucket(v, b)}
              styles={styles}
            />
            <BucketCard
              title="OUT"
              subtitle="Issues / Sales / Consumption"
              pillStyle={styles.pillOut}
              values={outValues}
              onMove={(v) => setBucket(v, "OUT")}
              onMoveTo={(v, b) => setBucket(v, b)}
              styles={styles}
            />
            <BucketCard
              title="OTHER"
              subtitle="Transfers / Adjustments / Scrap (ignored)"
              pillStyle={styles.pillOther}
              values={otherValues}
              onMove={(v) => setBucket(v, "OTHER")}
              onMoveTo={(v, b) => setBucket(v, b)}
              styles={styles}
            />
          </div>

          {/* Unassigned */}
          <div style={{ ...styles.cardPad, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={styles.sectionTitle}>Unassigned values</div>
              <div style={{ fontSize: 12, color: "#8f97ad" }}>Click buttons to classify quickly</div>
            </div>

            {unassigned.length === 0 ? (
              <div style={{ color: "#b7bed1" }}>All values assigned ✅</div>
            ) : (
              <div style={styles.list}>
                {unassigned.map((v) => (
                  <div key={v} style={styles.chip}>
                    <span style={styles.chipValue}>{v}</span>
                    <span style={styles.chipBtns}>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "IN")}>
                        IN
                      </button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "OUT")}>
                        OUT
                      </button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "OTHER")}>
                        OTHER
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <GlobalStyles />
        </div>
      </div>
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

function BucketCard({
  title,
  subtitle,
  pillStyle,
  values,
  onMoveTo,
  styles,
}: {
  title: "IN" | "OUT" | "OTHER";
  subtitle: string;
  pillStyle: any;
  values: string[];
  onMove: (v: string) => void;
  onMoveTo: (v: string, b: "IN" | "OUT" | "OTHER") => void;
  styles: any;
}) {
  return (
    <div className="hover-lift anim-in anim-delay-2" style={styles.cardPad}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div>
          <span style={pillStyle}>{title}</span>
          <div style={{ marginTop: 8, color: "#b7bed1", fontSize: 13 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 12, color: "#8f97ad" }}>{values.length} values</div>
      </div>

      <div style={{ marginTop: 12 }}>
        {values.length === 0 ? (
          <div style={{ color: "#8f97ad" }}>No values yet.</div>
        ) : (
          <div style={styles.list}>
            {values.map((v) => (
              <div key={v} style={styles.chip}>
                <span style={styles.chipValue}>{v}</span>
                <span style={styles.chipBtns}>
                  {title !== "IN" ? (
                    <button style={styles.miniBtn} onClick={() => onMoveTo(v, "IN")}>
                      IN
                    </button>
                  ) : null}
                  {title !== "OUT" ? (
                    <button style={styles.miniBtn} onClick={() => onMoveTo(v, "OUT")}>
                      OUT
                    </button>
                  ) : null}
                  {title !== "OTHER" ? (
                    <button style={styles.miniBtn} onClick={() => onMoveTo(v, "OTHER")}>
                      OTHER
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GlobalStyles() {
  return (
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

      @media (prefers-reduced-motion: reduce) {
        .anim-in,
        .bg-breathe,
        .hover-lift {
          animation: none !important;
          transition: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
      }
    `}</style>
  );
}