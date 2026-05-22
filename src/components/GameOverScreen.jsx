import React from "react";
import { colors, fonts } from "./tokens.js";
import { InitialBackdrop } from "./InitialBackdrop.jsx";

// Shown when the player has truly fallen (state.ended) — only a legendary-tier+
// foe ends a run. A memorial: an epitaph plus the narrator's final death passage.
// The run is over; the only way on is back to the campaigns list.
export function GameOverScreen({ state, onExit }) {
  const ended = state.ended || {};
  const name = state.character?.name || "the Wanderer";
  const finalBeat = [...(state.beats || [])].reverse().find((b) => b.type === "narration");
  const slainLine = [
    ended.foe ? `Slain by ${ended.foe}` : "Slain",
    ended.place ? `at ${ended.place}` : "",
  ].filter(Boolean).join(", ");

  return (
    <div style={{
      backgroundColor: colors.inkDeep,
      height: "100dvh", width: "100%", maxWidth: "480px", margin: "0 auto",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <InitialBackdrop />
      <div style={{
        position: "relative", zIndex: 1, flex: 1, overflowY: "auto",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "36px 26px calc(env(safe-area-inset-bottom, 0px) + 30px)",
        WebkitOverflowScrolling: "touch",
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            fontSize: "9px", letterSpacing: "0.32em", textTransform: "uppercase",
            fontWeight: 800, color: "rgba(215,167,111,0.6)", marginBottom: "16px",
          }}>Here ends the tale of</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "36px", lineHeight: 1.05, color: colors.parchmentLight }}>
            {name}
          </div>
          {slainLine && (
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: "rgba(237,228,208,0.7)", marginTop: "12px", lineHeight: 1.4 }}>
              {slainLine}{ended.day ? ` · day ${ended.day}` : ""}.
            </div>
          )}
        </div>

        {finalBeat && (
          <div style={{
            borderTop: "1px solid rgba(215,167,111,0.18)",
            borderBottom: "1px solid rgba(215,167,111,0.18)",
            padding: "22px 4px", margin: "0 0 28px",
          }}>
            <div style={{
              fontFamily: fonts.serif, fontStyle: "italic", fontSize: "17px",
              lineHeight: 1.6, color: colors.parchment, whiteSpace: "pre-wrap", textAlign: "center",
            }}>
              {finalBeat.content}
            </div>
          </div>
        )}

        <button onClick={onExit} style={{
          alignSelf: "center", padding: "13px 32px", borderRadius: 14,
          background: "transparent", color: colors.parchmentLight,
          border: "1px solid rgba(215,167,111,0.4)", fontSize: "13px", fontWeight: 800,
          letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit",
        }}>
          Return to your camps
        </button>
      </div>
    </div>
  );
}
