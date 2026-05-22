import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass } from "./tokens.js";
import { itemTemplate } from "../data/catalog.js";
import { tierLabel, tierColor } from "../data/tiers.js";
import { rankTitle, apprenticeStep } from "../data/schematics.js";
import { forgeQuality, resolveForgeTier, canForge } from "../engine/forge.js";
import { formatCopper } from "../engine/economy.js";

const STRIKES = 3;

// The smith's forge: pick an unlocked schematic you have the materials for,
// then play the anvil minigame — three timed strikes whose accuracy sets the
// piece's grade (and so its tier, capped by your rank). Locked schematics need
// a higher apprenticeship rank, bought with coin + time at the counter.
export function ForgeView({ state, building, schematics, rank, onApprentice, onForge, onBack, onClose, loading }) {
  const [forging, setForging] = useState(null); // active schematic in the minigame
  const [result, setResult] = useState(null);   // { item, tier, quality } after a forge

  const step = apprenticeStep(rank);

  function startForge(sch) {
    setResult(null);
    setForging(sch);
  }

  // Minigame finished: resolve the output tier, apply the forge, show the result.
  function completeForge(strikes) {
    const quality = forgeQuality(strikes);
    const tier = resolveForgeTier(forging.baseTier, quality.bump, rank);
    const item = onForge(forging, tier); // App applies + returns the produced def
    setForging(null);
    setResult({ item, tier, quality });
  }

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 31,
      backgroundColor: "#0d1312",
      display: "flex", flexDirection: "column",
      maxWidth: "480px", margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)",
      borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)",
        backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button onClick={onBack} aria-label="Back to counter" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0, padding: "0 6px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>The Forge</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>
            {rankTitle(rank)} smith
          </div>
        </div>
        <button onClick={onClose} aria-label="Leave" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="x" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 4px", WebkitOverflowScrolling: "touch" }}>
        {result && <ResultCard result={result} onClose={() => setResult(null)} />}

        {/* Apprenticeship — raise rank to unlock the harder patterns. */}
        <SectionHeader>Apprenticeship</SectionHeader>
        {step ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 13px", marginBottom: "14px",
            borderRadius: radius.panelCompact,
            backgroundColor: "rgba(48, 32, 20, 0.6)", border: "1px solid rgba(215, 167, 111, 0.25)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight }}>
                Train as {step.title}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35, margin: "2px 0 4px" }}>{step.blurb}</div>
              <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold }}>{formatCopper(step.costCp)} · {step.days} days</div>
            </div>
            <button onClick={() => onApprentice(step)} disabled={loading} style={{
              padding: "8px 16px", borderRadius: radius.pill, border: "none",
              backgroundColor: loading ? "rgba(215,167,111,0.1)" : colors.gold,
              color: loading ? "rgba(215,167,111,0.4)" : colors.ink,
              fontSize: "12px", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>Train</button>
          </div>
        ) : (
          <div style={{ padding: "8px 4px 14px", fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.5)" }}>
            You have learned all this smith can teach.
          </div>
        )}

        {/* Schematics */}
        <SectionHeader>Schematics</SectionHeader>
        {schematics.map((sch) => {
          const tmpl = itemTemplate(sch.item);
          const unlocked = rank >= sch.rank;
          const check = canForge(state, sch);
          return (
            <SchematicRow
              key={sch.id}
              tmpl={tmpl}
              sch={sch}
              state={state}
              unlocked={unlocked}
              ready={unlocked && check.ok}
              onForge={() => startForge(sch)}
            />
          );
        })}
        <div style={{ height: "8px" }} />
      </div>

      {forging && (
        <ForgeMinigame
          tmpl={itemTemplate(forging.item)}
          onStrikesDone={completeForge}
          onCancel={() => setForging(null)}
        />
      )}
    </div>
  );
}

function SchematicRow({ tmpl, sch, state, unlocked, ready, onForge }) {
  const carried = state.character.inventory.carried;
  return (
    <div style={{
      padding: "11px 13px", marginBottom: "8px",
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(20, 29, 29, 0.5)",
      border: "1px solid rgba(215, 167, 111, 0.14)",
      opacity: unlocked ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight }}>
            {tmpl?.name || sch.item}
          </div>
          <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "2px" }}>
            {tmpl?.kind} · base {tierLabel(sch.baseTier)}
          </div>
        </div>
        {unlocked ? (
          <button onClick={ready ? onForge : undefined} disabled={!ready} style={{
            padding: "7px 16px", borderRadius: radius.pill, border: "none",
            backgroundColor: ready ? colors.gold : "rgba(215, 167, 111, 0.1)",
            color: ready ? colors.ink : "rgba(215, 167, 111, 0.4)",
            fontSize: "12px", fontWeight: 800, cursor: ready ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0,
          }}>Forge</button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, color: "rgba(215,167,111,0.6)" }}>
            <Icon name="alert" size={12} color="rgba(215,167,111,0.6)" />
            <span style={{ fontSize: "10px", fontWeight: 800 }}>{rankTitle(sch.rank)}</span>
          </div>
        )}
      </div>
      {/* Material requirements — green when you have enough, red when short. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 8px", marginTop: "7px" }}>
        {(sch.requires || []).map((req) => {
          const have = carried.find((c) => c.itemId === req.id)?.quantity || 0;
          const enough = have >= req.qty;
          const name = itemTemplate(req.id)?.name || req.id;
          return (
            <span key={req.id} style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.02em",
              padding: "3px 7px", borderRadius: radius.chip,
              border: `1px solid ${enough ? "rgba(116,198,107,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: enough ? "#a7f3d0" : "#fca5a5",
              backgroundColor: enough ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            }}>{name} {have}/{req.qty}</span>
          );
        })}
      </div>
    </div>
  );
}

// Three timed strikes. A marker sweeps the bar; tap Strike inside the bright
// sweet-spot for a clean hit. Accuracy across the strikes sets the grade.
function ForgeMinigame({ tmpl, onStrikesDone, onCancel }) {
  const [marker, setMarker] = useState(0);
  const [strikes, setStrikes] = useState([]);
  const dirRef = useRef(1);
  const posRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    let last = performance.now();
    const SPEED = 1.35; // full sweeps per second-ish
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let p = posRef.current + dirRef.current * SPEED * dt;
      if (p >= 1) { p = 1; dirRef.current = -1; }
      else if (p <= 0) { p = 0; dirRef.current = 1; }
      posRef.current = p;
      setMarker(p);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Sweet spot centred at 0.5. Accuracy bands: dead-on, decent, miss.
  function strike() {
    const d = Math.abs(posRef.current - 0.5);
    const acc = d <= 0.05 ? 1 : d <= 0.13 ? 0.6 : 0;
    const next = [...strikes, acc];
    setStrikes(next);
    if (next.length >= STRIKES) {
      cancelAnimationFrame(rafRef.current);
      onStrikesDone(next);
    }
  }

  const lastAcc = strikes.length ? strikes[strikes.length - 1] : null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      backgroundColor: "rgba(8,11,11,0.92)", ...glass,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight, marginBottom: "6px" }}>
        Forging {tmpl?.name}
      </div>
      <div style={{ ...metaStyle, fontSize: "9px", color: "rgba(215,167,111,0.7)", marginBottom: "22px" }}>
        Strike {Math.min(strikes.length + 1, STRIKES)} of {STRIKES}
      </div>

      {/* The anvil bar */}
      <div style={{
        position: "relative", width: "100%", maxWidth: "320px", height: "26px",
        borderRadius: radius.pill, overflow: "hidden",
        backgroundColor: "rgba(20,29,29,0.8)", border: "1px solid rgba(215,167,111,0.25)",
      }}>
        {/* decent zone */}
        <div style={{ position: "absolute", left: "37%", width: "26%", top: 0, bottom: 0, backgroundColor: "rgba(215,167,111,0.18)" }} />
        {/* sweet spot */}
        <div style={{ position: "absolute", left: "45%", width: "10%", top: 0, bottom: 0, backgroundColor: "rgba(245,215,110,0.5)" }} />
        {/* marker */}
        <div style={{
          position: "absolute", top: "-2px", bottom: "-2px", width: "4px",
          left: `calc(${(marker * 100).toFixed(1)}% - 2px)`,
          backgroundColor: colors.parchmentLight, borderRadius: "2px",
          boxShadow: "0 0 8px rgba(245,220,184,0.9)",
        }} />
      </div>

      {/* strike pips */}
      <div style={{ display: "flex", gap: "8px", margin: "18px 0 24px" }}>
        {Array.from({ length: STRIKES }).map((_, i) => {
          const a = strikes[i];
          const color = a == null ? "rgba(215,167,111,0.25)" : a >= 0.85 ? "#f5d76e" : a >= 0.5 ? "#a7f3d0" : "#fca5a5";
          return <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: color }} />;
        })}
      </div>

      {lastAcc != null && (
        <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "12px", color: lastAcc >= 0.85 ? "#f5d76e" : lastAcc >= 0.5 ? "#a7f3d0" : "#fca5a5" }}>
          {lastAcc >= 0.85 ? "Clean strike!" : lastAcc >= 0.5 ? "Solid hit" : "Off the mark"}
        </div>
      )}

      <button onClick={strike} style={{
        width: "200px", height: "56px", borderRadius: radius.control, border: "none",
        backgroundColor: colors.gold, color: colors.ink, fontSize: "16px", fontWeight: 800,
        cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}>Strike</button>
      <button onClick={onCancel} style={{
        marginTop: "14px", padding: "8px 18px", borderRadius: radius.pill,
        backgroundColor: "transparent", border: "1px solid rgba(215,167,111,0.25)",
        color: "rgba(215,167,111,0.75)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>Step away</button>
    </div>
  );
}

function ResultCard({ result, onClose }) {
  const { item, tier, quality } = result;
  return (
    <Panel tone="discovery" style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...metaStyle, fontSize: "8px", color: "#a7f3d0", marginBottom: "3px" }}>{quality.grade} · forged</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "18px", color: colors.parchmentLight }}>
            {item?.name}
          </div>
          <div style={{ ...metaStyle, fontSize: "8px", marginTop: "3px", color: tierColor(tier) }}>{tierLabel(tier)}</div>
        </div>
        <button onClick={onClose} aria-label="Dismiss" style={{
          ...iconButtonStyle, width: "28px", height: "28px",
        }}>
          <Icon name="x" size={12} color="#e6b98c" strokeWidth={2} />
        </button>
      </div>
    </Panel>
  );
}
