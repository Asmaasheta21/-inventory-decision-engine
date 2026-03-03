"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  loadDatasetV2,
  loadMappingV2,
  saveMovementTypeValueMappingV2,
  loadMovementTypeValueMappingV2,
  type DemoRow,
  type MovementsMapping,
  type MovementTypeValueMapping,
} from "@/lib/demoStore";

type Bucket = "IN" | "OUT" | "TRANSFER" | "LOSS" | "ADJUST" | "OTHER";

/** keep original tokens but dedupe case-insensitive */
function uniqCI(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr ?? []) {
    const t = norm(x);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function norm(x: any) {
  return (x ?? "").toString().trim();
}

/** Extract first 3-digit code if exists, e.g. "GI-261" -> "261" */
function pickCodeOrToken(raw: string) {
  const s = norm(raw);
  const m = s.match(/\b(\d{3})\b/);
  return { raw: s, code: m ? m[1] : "", low: s.toLowerCase() };
}

function bucketSubtitle(b: Bucket) {
  switch (b) {
    case "IN":
      return "Receipts / Stock added";
    case "OUT":
      return "Issues / Sales / Consumption";
    case "TRANSFER":
      return "Transfers / Relocation (stock-neutral in demo)";
    case "LOSS":
      return "Scrap / Damage / Shrink / Write-off";
    case "ADJUST":
      return "Inventory count / Variance (+/-)";
    case "OTHER":
      return "Ignore (unknown / non-impact)";
  }
}

export default function MovementTypesPage() {
  const router = useRouter();

  const movements =
    typeof window !== "undefined" ? loadDatasetV2("movements") : null;
  const mapping: MovementsMapping | null =
    typeof window !== "undefined" ? loadMappingV2() : null;

  const rows = movements?.rows ?? [];
  const fileName = movements?.fileName ?? "Movements.csv";

  const [error, setError] = useState("");
  const [info, setInfo] = useState<string>("");

  const missing = !movements || !mapping;
  const movementTypeCol = mapping?.movementType ?? "";

  const allValues = useMemo(() => {
    if (!movementTypeCol) return [];
    const vals: string[] = [];
    for (const r of rows as DemoRow[]) {
      const v = norm((r as any)[movementTypeCol] ?? "");
      if (v) vals.push(v);
    }
    const u = uniqCI(vals);
    u.sort((a, b) => a.localeCompare(b));
    return u;
  }, [rows, movementTypeCol]);

  const saved =
    typeof window !== "undefined"
      ? (loadMovementTypeValueMappingV2() as MovementTypeValueMapping | null)
      : null;

  /**
   * Sanitize saved lists against current file values
   * - remove values not in allValues
   * - dedupe CI
   * - ensure no overlaps (priority: IN > OUT > TRANSFER > LOSS > ADJUST > OTHER)
   *
   * IMPORTANT: demoStore uses scrapLossValues (not lossValues)
   */
  const initialBuckets = useMemo(() => {
    const setAll = new Set(allValues.map((x) => x.toLowerCase()));
    const clean = (arr: any) =>
      uniqCI(Array.isArray(arr) ? arr : []).filter((x) =>
        setAll.has(x.toLowerCase())
      );

    const inC = clean((saved as any)?.inValues ?? []);
    const outC = clean((saved as any)?.outValues ?? []);
    const transferC = clean((saved as any)?.transferValues ?? []);
    const lossC = clean((saved as any)?.scrapLossValues ?? []); // ✅ FIX
    const adjustC = clean((saved as any)?.adjustValues ?? []);
    const otherC = clean((saved as any)?.otherValues ?? []);

    const used = new Set<string>();
    const take = (arr: string[]) => {
      const out: string[] = [];
      for (const v of arr) {
        const k = v.toLowerCase();
        if (used.has(k)) continue;
        used.add(k);
        out.push(v);
      }
      return out;
    };

    return {
      inC: take(inC),
      outC: take(outC),
      transferC: take(transferC),
      lossC: take(lossC),
      adjustC: take(adjustC),
      otherC: take(otherC),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allValues.join("|")]);

  const [inValues, setInValues] = useState<string[]>(initialBuckets.inC);
  const [outValues, setOutValues] = useState<string[]>(initialBuckets.outC);
  const [transferValues, setTransferValues] = useState<string[]>(
    initialBuckets.transferC
  );
  const [scrapLossValues, setScrapLossValues] = useState<string[]>(
    initialBuckets.lossC
  ); // ✅ FIX (state name matches demoStore)
  const [adjustValues, setAdjustValues] = useState<string[]>(
    initialBuckets.adjustC
  );
  const [otherValues, setOtherValues] = useState<string[]>(initialBuckets.otherC);

  // if file changes, re-apply sanitized saved values once
  useEffect(() => {
    setInValues(initialBuckets.inC);
    setOutValues(initialBuckets.outC);
    setTransferValues(initialBuckets.transferC);
    setScrapLossValues(initialBuckets.lossC);
    setAdjustValues(initialBuckets.adjustC);
    setOtherValues(initialBuckets.otherC);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialBuckets.inC.join("|"),
    initialBuckets.outC.join("|"),
    initialBuckets.transferC.join("|"),
    initialBuckets.lossC.join("|"),
    initialBuckets.adjustC.join("|"),
    initialBuckets.otherC.join("|"),
  ]);

  const pickedSet = useMemo(() => {
    const s = new Set<string>();
    const add = (arr: string[]) => arr.forEach((x) => s.add(x.toLowerCase()));
    add(inValues);
    add(outValues);
    add(transferValues);
    add(scrapLossValues);
    add(adjustValues);
    add(otherValues);
    return s;
  }, [inValues, outValues, transferValues, scrapLossValues, adjustValues, otherValues]);

  const unassigned = useMemo(
    () => allValues.filter((v) => !pickedSet.has(v.toLowerCase())),
    [allValues, pickedSet]
  );

  function removeCI(arr: string[], v: string) {
    const k = v.toLowerCase();
    return arr.filter((x) => x.toLowerCase() !== k);
  }

  function setBucket(value: string, bucket: Bucket) {
    setError("");
    setInfo("");

    const v = norm(value);
    if (!v) return;

    // remove from all buckets first
    let nextIn = removeCI(inValues, v);
    let nextOut = removeCI(outValues, v);
    let nextTransfer = removeCI(transferValues, v);
    let nextLoss = removeCI(scrapLossValues, v);
    let nextAdjust = removeCI(adjustValues, v);
    let nextOther = removeCI(otherValues, v);

    if (bucket === "IN") nextIn = uniqCI([...nextIn, v]);
    if (bucket === "OUT") nextOut = uniqCI([...nextOut, v]);
    if (bucket === "TRANSFER") nextTransfer = uniqCI([...nextTransfer, v]);
    if (bucket === "LOSS") nextLoss = uniqCI([...nextLoss, v]);
    if (bucket === "ADJUST") nextAdjust = uniqCI([...nextAdjust, v]);
    if (bucket === "OTHER") nextOther = uniqCI([...nextOther, v]);

    setInValues(nextIn);
    setOutValues(nextOut);
    setTransferValues(nextTransfer);
    setScrapLossValues(nextLoss);
    setAdjustValues(nextAdjust);
    setOtherValues(nextOther);
  }

  function autoGuess() {
    setError("");
    setInfo("");

    // Keywords (generic across ERPs)
    const IN_WORDS = [
      "receipt",
      "gr",
      "receive",
      "inbound",
      "putaway",
      "poreceipt",
      "stock in",
      "completion",
      "produce",
      "production receipt",
    ];
    const OUT_WORDS = [
      "issue",
      "gi",
      "outbound",
      "pick",
      "ship",
      "delivery",
      "sale",
      "consume",
      "consumption",
    ];
    const TRANSFER_WORDS = [
      "transfer",
      "sto",
      "relocation",
      "move",
      "bin to bin",
      "wh to wh",
      "stock transfer",
      "xfer",
    ];
    const LOSS_WORDS = [
      "scrap",
      "damage",
      "shrink",
      "write-off",
      "wastage",
      "reject",
      "expiry",
      "expired",
      "obsolete",
      "loss",
    ];
    const ADJ_WORDS = [
      "adjust",
      "adjustment",
      "count",
      "cycle count",
      "variance",
      "recount",
      "inventory count",
      "stocktake",
      "physical inventory",
    ];

    // Common 3-digit codes (SAP-like) — useful even لو ERP مختلف بيستعمل أكواد
    const IN_CODES = new Set(["101", "102", "105", "131", "132", "501", "531"]);
    const OUT_CODES = new Set(["201", "202", "221", "222", "261", "262", "601", "602"]);
    const TRANSFER_CODES = new Set(["301", "302", "311", "312", "321", "322", "641"]);
    const LOSS_CODES = new Set(["551", "552", "553", "554", "555", "556"]);
    const ADJ_CODES = new Set(["701", "702", "703", "704", "711", "712"]);

    const next: Record<Bucket, string[]> = {
      IN: [],
      OUT: [],
      TRANSFER: [],
      LOSS: [],
      ADJUST: [],
      OTHER: [],
    };

    const has = (low: string, arr: string[]) => arr.some((k) => low.includes(k));
    const byCode = (code: string, set: Set<string>) => (code ? set.has(code) : false);

    for (const v of allValues) {
      const { code, low } = pickCodeOrToken(v);

      // Priority: TRANSFER / LOSS / ADJUST first (more specific)
      if (byCode(code, TRANSFER_CODES) || has(low, TRANSFER_WORDS)) next.TRANSFER.push(v);
      else if (byCode(code, LOSS_CODES) || has(low, LOSS_WORDS)) next.LOSS.push(v);
      else if (byCode(code, ADJ_CODES) || has(low, ADJ_WORDS)) next.ADJUST.push(v);
      else if (byCode(code, IN_CODES) || has(low, IN_WORDS)) next.IN.push(v);
      else if (byCode(code, OUT_CODES) || has(low, OUT_WORDS)) next.OUT.push(v);
      else next.OTHER.push(v);
    }

    setInValues(uniqCI(next.IN));
    setOutValues(uniqCI(next.OUT));
    setTransferValues(uniqCI(next.TRANSFER));
    setScrapLossValues(uniqCI(next.LOSS)); // ✅ FIX
    setAdjustValues(uniqCI(next.ADJUST));
    setOtherValues(uniqCI(next.OTHER));

    setInfo("Auto-guess applied (keywords + common codes). Please review.");
  }

  function clearAll() {
    setError("");
    setInfo("");
    setInValues([]);
    setOutValues([]);
    setTransferValues([]);
    setScrapLossValues([]);
    setAdjustValues([]);
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

    // Must have at least 1 IN and 1 OUT
    if (inValues.length === 0 || outValues.length === 0) {
      setError("Please assign at least 1 value to IN and 1 value to OUT.");
      return;
    }

    // Overlap check across ALL buckets
    const allPicked: Array<[Bucket, string[]]> = [
      ["IN", inValues],
      ["OUT", outValues],
      ["TRANSFER", transferValues],
      ["LOSS", scrapLossValues],
      ["ADJUST", adjustValues],
      ["OTHER", otherValues],
    ];

    const seen = new Map<string, Bucket>();
    for (const [b, arr] of allPicked) {
      for (const v of arr) {
        const k = v.toLowerCase();
        const prev = seen.get(k);
        if (prev && prev !== b) {
          setError(`Same value cannot be in multiple buckets: "${v}" is in ${prev} and ${b}.`);
          return;
        }
        seen.set(k, b);
      }
    }

    if (unassigned.length > 0) {
      setInfo(
        `Note: ${unassigned.length} values are still unassigned. They will be treated as OTHER (ignored) for now.`
      );
    }

    const finalOther = uniqCI([...otherValues, ...unassigned]);

    // ✅ FIX: save using demoStore's keys (scrapLossValues)
    saveMovementTypeValueMappingV2({
      inValues: uniqCI(inValues),
      outValues: uniqCI(outValues),
      transferValues: uniqCI(transferValues),
      scrapLossValues: uniqCI(scrapLossValues),
      adjustValues: uniqCI(adjustValues),
      otherValues: finalOther,
    });

    router.push("/results");
  }

  const styles = useMemo(() => {
    const card: CSSProperties = {
      borderRadius: 18,
      border: "1px solid #1b2340",
      background:
        "linear-gradient(180deg, rgba(18,24,43,0.85), rgba(12,16,28,0.85))",
    };

    const btnBase: CSSProperties = {
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
      wrap: {
        minHeight: "100vh",
        color: "#e6e8ee",
        fontFamily: "Arial, sans-serif",
      } as CSSProperties,
      container: {
        maxWidth: 1120,
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

      hero: { ...card, padding: 18, marginBottom: 14 } as CSSProperties,

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

      grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 } as CSSProperties,
      cardPad: { ...card, padding: 16 } as CSSProperties,

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

      kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
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

      sectionTitle: { fontWeight: 950, marginBottom: 10 } as CSSProperties,

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
      } as CSSProperties,

      pillOut: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(255,196,0,0.30)",
        background: "rgba(255,196,0,0.10)",
      } as CSSProperties,

      pillTransfer: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(167,139,250,0.30)",
        background: "rgba(167,139,250,0.10)",
      } as CSSProperties,

      pillLoss: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.10)",
      } as CSSProperties,

      pillAdjust: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        border: "1px solid rgba(80,255,170,0.22)",
        background: "rgba(80,255,170,0.08)",
      } as CSSProperties,

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
      } as CSSProperties,

      list: { display: "flex", flexWrap: "wrap", gap: 8 } as CSSProperties,

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
      } as CSSProperties,

      chipValue: { fontWeight: 900 } as CSSProperties,
      chipBtns: { display: "inline-flex", gap: 6, flexWrap: "wrap" } as CSSProperties,

      miniBtn: {
        padding: "6px 8px",
        borderRadius: 10,
        border: "1px solid #2a3350",
        background: "transparent",
        color: "#e6e8ee",
        cursor: "pointer",
        fontWeight: 850,
        fontSize: 12,
      } as CSSProperties,

      row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 } as CSSProperties,

      btnPrimary: {
        ...btnBase,
        fontWeight: 900,
        background: "linear-gradient(135deg,#6ee7ff,#a78bfa)",
        color: "#0b0f1a",
      } as CSSProperties,

      btnGhost: {
        ...btnBase,
        background: "transparent",
        border: "1px solid #2a3350",
        color: "#e6e8ee",
      } as CSSProperties,

      error: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,80,80,0.35)",
        background: "rgba(255,80,80,0.08)",
        color: "#ffd4d4",
      } as CSSProperties,
      info: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(110,231,255,0.35)",
        background: "rgba(110,231,255,0.08)",
        color: "#dfefff",
      } as CSSProperties,
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
              <p style={styles.p}>
                Go back and upload Movements.csv then map the Movement Type column.
              </p>

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
              <a href="/" style={styles.link}>Home</a>
              <a href="/upload" style={styles.link}>Upload</a>
              <a href="/mapping" style={styles.link}>Mapping</a>
            </div>
          </div>

          {/* Hero */}
          <div className="anim-in anim-delay-2" style={styles.hero}>
            <span style={styles.pill}>🧠 Movement Type Value Mapping</span>
            <h1 style={styles.h1}>Classify movement type values</h1>
            <p style={styles.p}>
              We detected unique values from{" "}
              <b style={{ color: "#e6e8ee" }}>{movementTypeCol}</b> in{" "}
              <span style={styles.badge}>{fileName}</span>. Assign each value to the right bucket.
            </p>

            <div style={styles.kpiGrid}>
              <KPI title="Unique values" value={total} styles={styles} />
              <KPI title="IN" value={inValues.length} styles={styles} />
              <KPI title="OUT" value={outValues.length} styles={styles} />
              <KPI title="TRANSFER" value={transferValues.length} styles={styles} />
              <KPI title="LOSS" value={scrapLossValues.length} styles={styles} />
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

          {/* Buckets Row 1 */}
          <div style={styles.grid}>
            <BucketCard title="IN" subtitle={bucketSubtitle("IN")} pillStyle={styles.pillIn} values={inValues} onMoveTo={setBucket} styles={styles} />
            <BucketCard title="OUT" subtitle={bucketSubtitle("OUT")} pillStyle={styles.pillOut} values={outValues} onMoveTo={setBucket} styles={styles} />
            <BucketCard title="TRANSFER" subtitle={bucketSubtitle("TRANSFER")} pillStyle={styles.pillTransfer} values={transferValues} onMoveTo={setBucket} styles={styles} />
          </div>

          {/* Buckets Row 2 */}
          <div style={{ ...styles.grid, marginTop: 12 }}>
            <BucketCard title="LOSS" subtitle={bucketSubtitle("LOSS")} pillStyle={styles.pillLoss} values={scrapLossValues} onMoveTo={setBucket} styles={styles} />
            <BucketCard title="ADJUST" subtitle={bucketSubtitle("ADJUST")} pillStyle={styles.pillAdjust} values={adjustValues} onMoveTo={setBucket} styles={styles} />
            <BucketCard title="OTHER" subtitle={bucketSubtitle("OTHER")} pillStyle={styles.pillOther} values={otherValues} onMoveTo={setBucket} styles={styles} />
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
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "IN")}>IN</button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "OUT")}>OUT</button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "TRANSFER")}>TRANSFER</button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "LOSS")}>LOSS</button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "ADJUST")}>ADJUST</button>
                      <button style={styles.miniBtn} onClick={() => setBucket(v, "OTHER")}>OTHER</button>
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
  title: Bucket;
  subtitle: string;
  pillStyle: any;
  values: string[];
  onMoveTo: (v: string, b: Bucket) => void;
  styles: any;
}) {
  const choices: Bucket[] = ["IN", "OUT", "TRANSFER", "LOSS", "ADJUST", "OTHER"];

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
                  {choices.filter((c) => c !== title).map((c) => (
                    <button key={c} style={styles.miniBtn} onClick={() => onMoveTo(v, c)}>
                      {c}
                    </button>
                  ))}
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
        0%, 100% { background-position: 0% 0%, 100% 0%, 50% 50%; }
        50% { background-position: 10% 8%, 92% 12%, 50% 50%; }
      }

      .anim-in {
        opacity: 0;
        transform: translateY(10px);
        animation: fadeUp 650ms ease-out forwards;
      }

      .anim-delay-1 { animation-delay: 80ms; }
      .anim-delay-2 { animation-delay: 160ms; }

      @keyframes fadeUp {
        to { opacity: 1; transform: translateY(0); }
      }

      .hover-lift { transition: transform 200ms ease, box-shadow 200ms ease; }
      .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 40px rgba(0, 0, 0, 0.35); }

      @media (prefers-reduced-motion: reduce) {
        .anim-in, .bg-breathe, .hover-lift {
          animation: none !important;
          transition: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
      }
    `}</style>
  );
}