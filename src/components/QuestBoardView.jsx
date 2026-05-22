import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass } from "./tokens.js";
import { formatCopper } from "../engine/economy.js";
import { activeQuests } from "../engine/quests.js";
import { isRecruited, partyStanding, recruitOutlook } from "../engine/party.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";

const OUTLOOK = {
  eager:    { label: "keen to join",            color: "#a7f3d0" },
  open:     { label: "willing to hear you out",  color: colors.gold },
  wary:     { label: "will take real convincing", color: "#e0913a" },
  scornful: { label: "unimpressed by your lot",   color: "#fca5a5" },
};

const TYPE_LABEL = { errand: "Errand", delivery: "Delivery", hunt: "Hunt", bounty: "Bounty" };

// The tavern quest board: leads to pursue (tasks you accept and track), folk
// looking to take the road with you (narrative recruits, handed to the
// narrator), and day-labour you can take on the spot for coin + time.
export function QuestBoardView({ state, building, board, onAccept, onAbandon, onLabour, onRecruit, onClose, loading }) {
  const taken = new Set((state.world.quests || []).map((q) => q.id));
  const active = activeQuests(state).filter((q) => q.type !== "bounty"); // bounties live at the gaol

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
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
        <button onClick={onClose} aria-label="Leave" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0, padding: "0 6px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>{building.label}</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>Quest Board</div>
        </div>
        <div style={{ width: "30px" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px", WebkitOverflowScrolling: "touch" }}>
        <Panel tone="warm" style={{ marginBottom: "12px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px", color: colors.parchment, lineHeight: 1.4 }}>{building.blurb}</div>
        </Panel>

        {/* Accepted — what you're already carrying. */}
        {active.length > 0 && (
          <>
            <SectionHeader>Taken on</SectionHeader>
            {active.map((q) => (
              <Row key={q.id}
                title={q.title}
                meta={`${TYPE_LABEL[q.type] || "Task"} · ${q.giver}`}
                desc={q.desc}
                reward={q.rewardCp}
                action={<ActionButton label="Abandon" ghost enabled={!loading} onClick={() => onAbandon(q.id)} />}
              />
            ))}
          </>
        )}

        {/* Work — leads to pursue out in the world. */}
        <SectionHeader>Work posted</SectionHeader>
        {board.tasks.map((t) => {
          const isTaken = taken.has(t.id);
          return (
            <Row key={t.id}
              title={t.title}
              meta={`${TYPE_LABEL[t.type] || "Task"} · ${t.giver}`}
              desc={t.desc}
              reward={t.rewardCp}
              action={<ActionButton label={isTaken ? "Taken" : "Take"} enabled={!isTaken && !loading} onClick={() => onAccept(t)} />}
            />
          );
        })}

        {/* For hire — real people. Approaching only OPENS the talk; you must win
            them round, and your party's standing colours how they receive you. */}
        <SectionHeader>Looking to join</SectionHeader>
        {(() => {
          const standing = partyStanding(state);
          return board.recruits.map((r) => (
            <RecruitCard key={r.id} r={r} joined={isRecruited(state, r.id)}
              outlook={recruitOutlook(standing, r.choosiness)} loading={loading}
              onApproach={() => onRecruit(r)} />
          ));
        })()}

        {/* Day labour — hire yourself out, here and now. */}
        <SectionHeader>Hire yourself out</SectionHeader>
        {board.jobs.map((j) => (
          <Row key={j.id}
            title={j.title}
            meta={`${j.hours} hours`}
            desc={j.desc}
            reward={j.payCp}
            action={<ActionButton label="Work" enabled={!loading} onClick={() => onLabour(j)} />}
          />
        ))}
        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}

// A recruit on the board — shows who they are, their stats and kit, their terms,
// and how they're likely to take to being approached (their choosiness vs your
// party's standing). "Approach" only opens the conversation.
function RecruitCard({ r, joined, outlook, loading, onApproach }) {
  const ol = OUTLOOK[outlook] || OUTLOOK.open;
  const skills = (r.skills || []).map((s) => s.name).join(", ");
  return (
    <div style={{
      padding: "11px 13px", marginBottom: "8px", borderRadius: radius.panelCompact,
      backgroundColor: "rgba(20, 29, 29, 0.5)", border: "1px solid rgba(215, 167, 111, 0.14)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight, lineHeight: 1.2 }}>{r.name} — {r.role}</div>
          <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "2px" }}>{r.race} · {r.terms}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
          {!joined && <span style={{ fontSize: "9px", fontWeight: 800, color: ol.color, textAlign: "right", maxWidth: "96px" }}>{ol.label}</span>}
          <ActionButton label={joined ? "With you" : "Approach"} enabled={!joined && !loading} onClick={onApproach} />
        </div>
      </div>
      <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35, margin: "6px 0" }}>{r.desc}</div>
      {/* Attributes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "3px", marginBottom: "6px" }}>
        {ATTR_KEYS.map((k) => (
          <div key={k} style={{ textAlign: "center", padding: "3px 1px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.12)" }}>
            <div style={{ ...metaStyle, fontSize: "6px", color: colors.gold }}>{ATTR_LABELS[k].slice(0, 3)}</div>
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px", color: colors.parchment }}>{r.attributes?.[k] ?? 0}</div>
          </div>
        ))}
      </div>
      {skills && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.6)" }}><span style={{ ...metaStyle, fontSize: "7px", color: colors.parchmentMuted }}>Skilled in </span>{skills}</div>}
    </div>
  );
}

function Row({ title, meta, desc, reward, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "11px 13px", marginBottom: "8px",
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(20, 29, 29, 0.5)",
      border: "1px solid rgba(215, 167, 111, 0.14)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight, lineHeight: 1.2 }}>{title}</div>
        <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, margin: "2px 0 4px" }}>{meta}</div>
        <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {reward != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Icon name="sparkle" size={10} color={colors.gold} />
            <span style={{ fontSize: "12px", fontWeight: 800, color: colors.gold }}>{formatCopper(reward)}</span>
          </div>
        )}
        {action}
      </div>
    </div>
  );
}

function ActionButton({ label, enabled, ghost = false, onClick }) {
  return (
    <button onClick={enabled ? onClick : undefined} disabled={!enabled} style={{
      padding: "7px 16px", borderRadius: radius.pill,
      border: ghost ? "1px solid rgba(215,167,111,0.3)" : "none",
      backgroundColor: ghost ? "transparent" : enabled ? colors.gold : "rgba(215, 167, 111, 0.1)",
      color: ghost ? "rgba(215,167,111,0.8)" : enabled ? colors.ink : "rgba(215, 167, 111, 0.4)",
      fontSize: "12px", fontWeight: 800, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit",
    }}>{label}</button>
  );
}
