import React, { useRef, useEffect, useState } from "react";
import { Icon } from "../Icon.jsx";
import { colors, radius, fonts, metaStyle, shadow, glass } from "../tokens.js";
import { tierColor, tierLabel, tierOrder } from "../../data/tiers.js";
import { getAbilityDef, abilityRequiredStat, abilityScaling } from "../../data/abilities.js";
import { demeanorLabel } from "../../data/combat-flavor.js";
import { abilityUsable } from "../../engine/combat.js";

// Requirement readout for the ability bar. Stat shortfall is a soft % dropoff;
// a weapon-type mismatch hard-blocks the ability (we show what weapon it needs).
function abilityEff(player, def, tierId) {
  let statEff = 1, reqLabel = null;
  const req = abilityRequiredStat(def, tierId || "common");
  if (req && req.value) {
    const have = player.attrs?.[req.attr] || 0;
    statEff = Math.max(0.2, Math.min(1, have / req.value));
    if (have < req.value) reqLabel = `${req.attr.slice(0, 3).toUpperCase()} ${have}/${req.value}`;
  }
  let needWeapon = null;
  if (abilityScaling(def) === "weapon" && def.weaponReq?.length && !def.weaponReq.includes(player.weapon?.category)) {
    needWeapon = def.weaponReq.join("/");
  }
  return { eff: statEff, reqLabel, needWeapon };
}

function moodOf(enemy) {
  if (enemy.demeanor === "mindless") return { label: "unfeeling", color: "#8a8f8f" };
  const r = enemy.morale / (enemy.moraleMax || 100);
  if (r > 0.66) return { label: "steadfast", color: "#9ab0b0" };
  if (r > 0.4) return { label: "wary", color: "#f5b97a" };
  if (r > 0.18) return { label: "wavering", color: "#e0913a" };
  return { label: "breaking", color: "#fca5a5" };
}

const STATUS_LABEL = {
  bleed: "Bleed", poison: "Poison", stun: "Stun", weaken: "Weakened",
  vulnerable: "Vulnerable", guard: "Guard", rally: "Rallied", regen: "Regen", focus: "Focused",
  burn: "Burning", chill: "Chilled", curse: "Cursed", dodgeStack: "Evasion",
};
const STATUS_COLOR = {
  bleed: "#d97a6c", poison: "#86b34a", stun: "#e6c84a", weaken: "#8fb0c9",
  vulnerable: "#e09a5a", guard: "#9ab0b0", rally: "#f5b97a", regen: "#74c66b", focus: "#b072e6",
  burn: "#f07b3f", chill: "#7fc7e0", curse: "#a86fd0", dodgeStack: "#8fd0b0",
};

function TierBadge({ tier }) {
  return (
    <span style={{
      ...metaStyle, fontSize: "7px", letterSpacing: "0.1em",
      padding: "1px 5px", borderRadius: radius.pill,
      color: tierColor(tier), border: `1px solid ${tierColor(tier)}`,
      backgroundColor: `${tierColor(tier)}1a`, whiteSpace: "nowrap",
    }}>{tierLabel(tier)}</span>
  );
}

function Bar({ value, max, color, height = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div style={{
      width: "100%", height, backgroundColor: "rgba(0,0,0,0.4)",
      border: `1px solid rgba(215,167,111,0.14)`, borderRadius: "4px", overflow: "hidden",
      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: "3px",
        transition: "width 0.35s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

function StatusRow({ statuses }) {
  if (!statuses || statuses.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" }}>
      {statuses.map((s, i) => (
        <span key={i} style={{
          fontSize: "8px", fontWeight: 700, padding: "1px 5px", borderRadius: radius.pill,
          color: STATUS_COLOR[s.type] || colors.parchmentMuted,
          border: `1px solid ${(STATUS_COLOR[s.type] || colors.parchmentMuted)}55`,
          backgroundColor: `${(STATUS_COLOR[s.type] || colors.parchmentMuted)}14`,
        }}>{STATUS_LABEL[s.type] || s.type}{s.duration > 1 ? ` ${s.duration}` : ""}</span>
      ))}
    </div>
  );
}

// Defensive overlays: a physical shield, a magic ward-shield, and a brief
// invulnerability. Shown as small chips next to a combatant's health.
function DefenseBadges({ c, compact = false }) {
  const badges = [];
  if ((c.invuln || 0) > 0) badges.push(["INVULN", "#ffe08a"]);
  if ((c.shield || 0) > 0) badges.push([`◈${Math.round(c.shield)}`, "#7fb6e0"]);
  if ((c.magicShield || 0) > 0) badges.push([`✦${Math.round(c.magicShield)}`, "#b08fe0"]);
  if (badges.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: "3px", flexShrink: 0 }}>
      {badges.map(([txt, col], i) => (
        <span key={i} style={{
          fontSize: compact ? "7px" : "8px", fontWeight: 800, padding: "1px 4px", borderRadius: radius.pill,
          color: col, border: `1px solid ${col}66`, backgroundColor: `${col}1f`, whiteSpace: "nowrap",
        }}>{txt}</span>
      ))}
    </span>
  );
}

function EnemyCard({ enemy, selected, onSelect }) {
  const dead = enemy._dead || (enemy.health <= 0 && !enemy.resolved);
  const yielded = enemy.resolved === "yielded" && !enemy._dead;
  const fleeing = !!enemy.fleeing && !enemy.resolved && !enemy._dead;
  const gone = enemy.resolved === "fled" || enemy.resolved === "ko";
  // A yielded foe is a CHOICE (execute or spare) — keep it selectable. A fleeing
  // foe can still be run down — selectable too. Dead/fled/KO foes are out.
  const selectable = !dead && !gone;
  const inactive = !selectable;
  const stateWord = dead ? null : yielded ? "Yielded — at your mercy" : enemy.resolved === "fled" ? "Fled" : enemy.resolved === "ko" ? "Out cold" : null;
  const stateColor = yielded ? "#fcd34d" : "#9ab0b0";
  const mood = inactive || fleeing ? null : moodOf(enemy);
  return (
    <button
      onClick={() => selectable && onSelect()}
      disabled={inactive}
      style={{
        flex: "1 1 130px", minWidth: 0, textAlign: "left",
        padding: "9px 11px", borderRadius: radius.panelCompact,
        backgroundColor: inactive ? "rgba(20,29,29,0.35)" : yielded ? "rgba(45,38,12,0.55)" : "rgba(35,15,15,0.55)",
        border: selected && selectable ? `1px solid ${colors.gold}` : yielded ? "1px solid rgba(252,211,77,0.4)" : `1px solid rgba(239,68,68,0.3)`,
        boxShadow: selected && selectable ? `0 0 12px rgba(215,167,111,0.3)` : "none",
        opacity: inactive ? 0.5 : 1, cursor: selectable ? "pointer" : "default",
        fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
        <span style={{
          fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px",
          color: dead ? colors.parchmentMuted : stateWord ? stateColor : "#fde8e4", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: dead ? "line-through" : "none",
        }}>{enemy.name}</span>
        <TierBadge tier={enemy.tier} />
      </div>
      {stateWord ? (
        <div style={{ fontSize: "12px", fontStyle: "italic", color: stateColor, padding: "4px 0" }}>
          {stateWord}{yielded ? <span style={{ fontSize: "9px", fontStyle: "normal", color: "rgba(237,228,208,0.5)", display: "block", marginTop: "2px" }}>Tap to target — strike to execute, or Stand Down to spare.</span> : null}
        </div>
      ) : (
        <>
          <Bar value={enemy.health} max={enemy.maxHealth} color="linear-gradient(90deg,#8f4c3c,#c75b48)" height={7} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px", gap: "4px" }}>
            <span style={{ fontSize: "9px", color: colors.parchmentMuted }}>{Math.ceil(enemy.health)}/{enemy.maxHealth}</span>
            <DefenseBadges c={enemy} compact />
            <span style={{ fontSize: "8px", color: "rgba(237,228,208,0.5)" }}>
              {enemy.armor > 0 ? `AR ${enemy.armor} ` : ""}{enemy.ward > 0 ? `WD ${enemy.ward}` : ""}
            </span>
            <span style={{ fontSize: "8px", color: fleeing ? "#fcd34d" : (enemy.distance || 0) <= 1 ? "rgba(199,91,72,0.85)" : "rgba(127,199,224,0.85)" }} title={fleeing ? "running — close in or shoot it before it gets clear" : "engagement distance"}>
              {fleeing ? `FLEEING ${enemy.distance}/6` : (enemy.distance || 0) <= 1 ? "engaged" : `dist ${enemy.distance}`}
            </span>
          </div>
          {mood && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
              <span style={{ fontSize: "8px", fontStyle: "italic", color: mood.color }}>{mood.label}</span>
              <span style={{ fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(237,228,208,0.4)" }}>{demeanorLabel(enemy.demeanor)}</span>
            </div>
          )}
        </>
      )}
      <StatusRow statuses={enemy.statuses} />
    </button>
  );
}

// Allied companion card — read-only; they take their own AI turns.
function AllyCard({ ally }) {
  const dead = ally._dead || ally.resolved === "ko";
  return (
    <div style={{
      flex: "1 1 120px", minWidth: 0, padding: "8px 10px", borderRadius: radius.panelCompact,
      backgroundColor: dead ? "rgba(20,29,29,0.35)" : "rgba(24,40,30,0.5)",
      border: `1px solid ${dead ? "rgba(215,167,111,0.15)" : "rgba(116,198,107,0.3)"}`,
      opacity: dead ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{
          fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px",
          color: dead ? colors.parchmentMuted : "#bfe6b5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: ally._dead ? "line-through" : "none",
        }}>{ally.name}</span>
        <Icon name="users" size={11} color={dead ? colors.parchmentMuted : "#74c66b"} strokeWidth={1.8} />
      </div>
      {dead ? (
        <div style={{ fontSize: "11px", fontStyle: "italic", color: colors.parchmentMuted }}>{ally._dead ? "Slain" : "Down"}</div>
      ) : (
        <>
          <Bar value={ally.health} max={ally.maxHealth} color="linear-gradient(90deg,#4a7a44,#74c66b)" height={6} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px", marginTop: "2px" }}>
            <span style={{ fontSize: "9px", color: colors.parchmentMuted }}>{Math.ceil(ally.health)}/{ally.maxHealth}</span>
            <DefenseBadges c={ally} compact />
          </div>
        </>
      )}
      <StatusRow statuses={ally.statuses} />
    </div>
  );
}

function AbilityButton({ entry, combat, onAct }) {
  const def = getAbilityDef(entry.id);
  if (!def) return null;
  const cd = combat.player.cooldowns[entry.id] || 0;
  const usable = abilityUsable(combat, entry.id);
  const tcolor = tierColor(entry.tier || "common");
  const { eff, reqLabel, needWeapon } = abilityEff(combat.player, def, entry.tier);
  const penalised = eff < 1 && !needWeapon;
  const costParts = [];
  if ((def.actionCost || 1) > 1) costParts.push(`${def.actionCost} AP`);
  if (def.resolveCost > 0) costParts.push(`${def.resolveCost} res`);
  if (def.cooldown) costParts.push(`cd ${def.cooldown}`);
  return (
    <button
      onClick={() => onAct(entry.id)}
      disabled={!usable}
      title={`${def.desc}${reqLabel ? ` · needs ${reqLabel}` : ""}${needWeapon ? ` · needs ${needWeapon}` : ""}`}
      style={{
        position: "relative", textAlign: "left",
        padding: "8px 9px", borderRadius: radius.chip,
        backgroundColor: usable ? "rgba(20,29,29,0.7)" : "rgba(20,29,29,0.3)",
        border: `1px solid ${usable ? tcolor : "rgba(215,167,111,0.12)"}`,
        boxShadow: usable ? `inset 0 0 10px ${tcolor}18` : "none",
        opacity: usable ? 1 : 0.45, cursor: usable ? "pointer" : "default",
        fontFamily: "inherit", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Icon name={def.icon || "swords"} size={13} color={tcolor} strokeWidth={1.8} />
        <span style={{ fontSize: "12px", fontWeight: 700, color: colors.parchment, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.name}</span>
        {penalised && <span style={{ fontSize: "8px", fontWeight: 800, color: "#e0913a", marginLeft: "auto" }}>{Math.round(eff * 100)}%</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
        <span style={{ fontSize: "8px", color: "rgba(237,228,208,0.55)" }}>
          {costParts.length ? costParts.join(" · ") : "free"}
        </span>
        {(entry.tier && entry.tier !== "common") && <TierBadge tier={entry.tier} />}
      </div>
      {(reqLabel || needWeapon) && (
        <div style={{ fontSize: "7px", color: needWeapon ? "#fca5a5" : "#e0913a", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {needWeapon ? `needs ${needWeapon}` : reqLabel}
        </div>
      )}
      {cd > 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(8,12,12,0.66)", color: colors.gold, fontSize: "16px", fontWeight: 800,
        }}>{cd}</div>
      )}
    </button>
  );
}

function ResolveOverlay({ combat, onResolve }) {
  const win = combat.phase === "victory";
  const standoff = combat.standoff;
  const resolved = combat.phase === "resolved";
  const fled = combat.phase === "playerFled";
  const title = standoff ? "Standoff" : win ? "Victory" : resolved ? "Stood Down" : fled ? "Escaped" : "Defeat";
  const color = standoff ? colors.gold : win ? "#a7f3d0" : resolved ? "#a7f3d0" : fled ? colors.gold : "#fca5a5";
  const subtitle =
    standoff ? "A wary draw — neither side could best the other." :
    win ? "The fallen lie where they dropped." :
    resolved ? "They're done — down, yielded, or fled." :
    fled ? "You slipped away." : "You went under.";
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "14px", padding: "24px",
      backgroundColor: "rgba(8,12,12,0.82)", backdropFilter: "blur(6px)",
    }}>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "40px", color, textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "rgba(237,228,208,0.7)", fontStyle: "italic", textAlign: "center", maxWidth: "300px" }}>{subtitle}</div>
      <button onClick={onResolve} style={{
        padding: "13px 28px", borderRadius: radius.control, backgroundColor: colors.gold,
        color: colors.ink, border: "none", fontSize: "14px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
      }}>Continue</button>
    </div>
  );
}

export function CombatView({ combat, onAct, onAction, onTalk, busy, onDraw, onSetTarget, onEndTurn, onFlee, onStandDown, onCeasefire, onWithdraw, onAdvance, onResolve }) {
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const [actionText, setActionText] = useState("");
  const [talkOpen, setTalkOpen] = useState(false);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log.length]);

  const { player } = combat;
  const over = ["victory", "defeat", "resolved", "playerFled"].includes(combat.phase);
  const isPlayerPhase = combat.phase === "player";
  // When no foe is still fighting but some have yielded or are fleeing, the player
  // can Stand Down — sparing the captives and letting the runners go.
  const liveAttacker = combat.enemies.some((e) => e.health > 0 && !e.resolved && !e.fleeing && !e._dead);
  const brokenPresent = combat.enemies.some((e) => (e.resolved === "yielded" && !e._dead) || e.fleeing);
  const canStand = isPlayerPhase && !liveAttacker && brokenPresent;
  const submitAction = () => {
    const t = actionText.trim();
    if (!t || busy || !isPlayerPhase) return;
    setActionText("");
    onAction(t);
  };
  // Talk: structured intents are engine-resolved (need an action + a foe that can
  // be reached); "Say something" routes a spoken line through the narrator.
  const talkReachable = combat.enemies.some((e) => e.health > 0 && !e.resolved && e.canTalk !== false);
  const canTalkIntents = isPlayerPhase && !busy && talkReachable && abilityUsable(combat, "talk");
  const doTalk = (intent) => { setTalkOpen(false); onTalk?.(intent); };
  const sayInstead = () => { setTalkOpen(false); inputRef.current?.focus(); };
  // Core actions stay pinned; learned abilities sort by tier (best first) and
  // scroll, so the bar never overruns the screen as the kit grows.
  const CORE = ["basic-attack", "defend", "talk"];
  const strikeEntry = player.abilities.find((a) => a.id === "basic-attack");
  const braceEntry = player.abilities.find((a) => a.id === "defend");
  const learned = player.abilities
    .filter((a) => !CORE.includes(a.id))
    .sort((x, y) => tierOrder(y.tier || "common") - tierOrder(x.tier || "common"));

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      backgroundColor: colors.ink,
      backgroundImage: "radial-gradient(circle at 50% 18%, #2a1414 0%, #0a0f0e 78%)",
      maxWidth: "640px", margin: "0 auto",
      display: "flex", flexDirection: "column",
      padding: "calc(env(safe-area-inset-top,0px) + 12px) 14px calc(env(safe-area-inset-bottom,0px) + 12px) 14px",
      boxSizing: "border-box", overflow: "hidden",
    }}>
      {/* Enemies */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        {combat.enemies.map((e, i) => (
          <EnemyCard key={e.id} enemy={e} selected={combat.target === i} onSelect={() => onSetTarget(i)} />
        ))}
      </div>

      {/* Allies — companions fighting at your side (they act on their own) */}
      {combat.allies && combat.allies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {combat.allies.map((a) => <AllyCard key={a.id} ally={a} />)}
        </div>
      )}

      {/* Log */}
      <div ref={logRef} className="custom-scroll" style={{
        flex: 1, overflowY: "auto", minHeight: "70px",
        padding: "10px 12px", borderRadius: radius.panelCompact,
        backgroundColor: "rgba(10,15,15,0.5)", border: `1px solid rgba(215,167,111,0.12)`,
        marginBottom: "10px",
      }}>
        {combat.log.map((l) => (
          <div key={l.id} style={{
            fontSize: l.kind === "system" ? "11px" : "12px",
            lineHeight: 1.5, marginBottom: "2px",
            color: l.kind === "crit" ? "#f5d76e"
              : l.kind === "miss" ? "rgba(237,228,208,0.45)"
              : l.kind === "player" ? colors.parchmentLight
              : l.kind === "enemy" ? "#e6a59a"
              : l.kind === "status" ? "#9ab0b0"
              : "rgba(215,167,111,0.6)",
            fontStyle: l.kind === "system" ? "italic" : "normal",
            fontFamily: l.kind === "system" ? fonts.serif : "inherit",
          }}>{l.text}</div>
        ))}
      </div>

      {/* Player panel */}
      <div style={{
        padding: "10px 12px", borderRadius: radius.panel,
        backgroundColor: "rgba(20,29,29,0.72)", border: `1px solid rgba(215,167,111,0.2)`,
        ...glass, boxShadow: shadow.card,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.parchmentLight, flexShrink: 0 }}>{player.name}</span>
          <div style={{ flex: 1 }}>
            <Bar value={player.health} max={player.maxHealth} color="linear-gradient(90deg,#606d43,#7B8460)" height={9} />
          </div>
          <DefenseBadges c={player} />
          <span style={{ fontSize: "11px", color: colors.parchment, fontWeight: 700, flexShrink: 0 }}>{Math.ceil(player.health)}/{player.maxHealth}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
          <span style={{ ...metaStyle, fontSize: "8px", color: "rgba(127,199,224,0.85)" }}>Actions</span>
          <div style={{ display: "flex", gap: "3px" }}>
            {Array.from({ length: Math.max(1, player.actionsPerTurn || 1) }).map((_, i) => (
              <div key={i} style={{
                width: "11px", height: "11px", borderRadius: "3px",
                backgroundColor: i < (player.actionsLeft || 0) ? "#7fc7e0" : "rgba(127,199,224,0.15)",
                border: `1px solid rgba(127,199,224,0.45)`,
              }} />
            ))}
          </div>
          {player.resolveMax > 0 && (
            <>
              <span style={{ ...metaStyle, fontSize: "8px", color: "rgba(176,114,230,0.7)", marginLeft: "4px" }}>Resolve</span>
              <div style={{ display: "flex", gap: "3px" }}>
                {Array.from({ length: player.resolveMax }).map((_, i) => (
                  <div key={i} style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    backgroundColor: i < player.resolve ? "#b072e6" : "rgba(176,114,230,0.15)",
                    border: `1px solid rgba(176,114,230,0.4)`,
                  }} />
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ fontSize: "9px", color: "rgba(237,228,208,0.5)", marginBottom: "6px" }}>
          AR {player.armor} · WD {player.ward} · DODGE {player.dodge}% · SPD {player.speed}
          {player.weapon?.name ? ` · ${player.weapon.name}` : ""}
          {player.weapon?.category && player.weapon.category !== "unarmed"
            ? ` [${player.weapon.category}${(player.weapon.range || 0) > 0 ? ` · rng ${player.weapon.range}` : (player.weapon.reach || 1) > 1 ? ` · reach ${player.weapon.reach}` : ""}]`
            : ""}
        </div>
        <StatusRow statuses={player.statuses} />

        {/* Learned abilities — sorted by tier, scrollable so the bar stays bounded */}
        {learned.length > 0 && (
          <div className="custom-scroll" style={{ maxHeight: "164px", overflowY: "auto", marginTop: "9px", paddingRight: "2px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {learned.map((entry, i) => (
                <AbilityButton key={`${entry.id}-${i}`} entry={entry} combat={combat} onAct={onAct} />
              ))}
            </div>
          </div>
        )}

        {/* Core actions — your trained techniques */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
          {strikeEntry && <AbilityButton entry={strikeEntry} combat={combat} onAct={onAct} />}
          {braceEntry && <AbilityButton entry={braceEntry} combat={combat} onAct={onAct} />}
        </div>

        {/* Improvise — type what you do or say; the narrator adjudicates it.
            Use the surroundings, demand surrender, taunt, terrify, plead, goad. */}
        {combat.environment?.some((f) => f.uses > 0) && (
          <div style={{ fontSize: "9px", color: "rgba(230,200,154,0.75)", marginTop: "8px", fontStyle: "italic" }}>
            Around you: {combat.environment.filter((f) => f.uses > 0).map((f) => f.name).join(", ")}
          </div>
        )}
        {/* Talk — speak to your foes. Quick intents resolve instantly; "Say
            something" hands a spoken line to the narrator for real dialogue. */}
        {talkReachable && (
          <div style={{ marginTop: "8px" }}>
            <button onClick={() => setTalkOpen((o) => !o)} disabled={!isPlayerPhase || busy} style={{
              width: "100%", padding: "9px", borderRadius: radius.panelCompact,
              backgroundColor: talkOpen ? "rgba(127,199,224,0.16)" : "rgba(127,199,224,0.08)",
              color: "rgba(159,212,230,0.95)", border: `1px solid rgba(127,199,224,0.32)`,
              fontSize: "12px", fontWeight: 700, cursor: isPlayerPhase && !busy ? "pointer" : "default",
              fontFamily: "inherit", opacity: isPlayerPhase && !busy ? 1 : 0.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}>
              <Icon name="user" size={13} color="rgba(159,212,230,0.95)" strokeWidth={2} />
              Talk to your foes {talkOpen ? "▾" : "▸"}
            </button>
            {talkOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" }}>
                {[
                  ["Demand surrender", "surrender", "Call on the foe to yield."],
                  ["Demoralize", "demoralize", "Threats that sap the will to fight."],
                  ["Provoke", "provoke", "Goad a foe into a reckless fury."],
                ].map(([label, intent, tip]) => (
                  <button key={intent} onClick={() => doTalk(intent)} disabled={!canTalkIntents} title={tip} style={{
                    padding: "9px 8px", borderRadius: radius.panelCompact,
                    backgroundColor: "rgba(127,199,224,0.1)", color: "rgba(159,212,230,0.95)",
                    border: `1px solid rgba(127,199,224,0.28)`, fontSize: "11px", fontWeight: 700,
                    cursor: canTalkIntents ? "pointer" : "default", fontFamily: "inherit", opacity: canTalkIntents ? 1 : 0.4,
                  }}>{label}</button>
                ))}
                <button onClick={sayInstead} disabled={!isPlayerPhase || busy} title="Say something in your own words — the narrator plays out the exchange." style={{
                  padding: "9px 8px", borderRadius: radius.panelCompact,
                  backgroundColor: "rgba(176,114,230,0.12)", color: "#c9a6ef",
                  border: `1px solid rgba(176,114,230,0.4)`, fontSize: "11px", fontWeight: 700,
                  cursor: isPlayerPhase && !busy ? "pointer" : "default", fontFamily: "inherit", opacity: isPlayerPhase && !busy ? 1 : 0.4,
                }}>Say something…</button>
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <input
            ref={inputRef}
            type="text" value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAction(); } }}
            placeholder={busy ? "The moment unfolds…" : isPlayerPhase ? "Improvise — do or say something…" : "Not your turn"}
            disabled={!isPlayerPhase || busy}
            style={{
              flex: 1, height: "40px", borderRadius: radius.control,
              border: `1px solid rgba(176,114,230,0.4)`, backgroundColor: "rgba(10,15,15,0.65)",
              padding: "0 14px", fontSize: "13px", color: colors.parchment, outline: "none",
              opacity: isPlayerPhase && !busy ? 1 : 0.5, fontFamily: "inherit",
            }}
          />
          <button onClick={submitAction} disabled={!isPlayerPhase || busy || !actionText.trim()} title="Improvise (uses your turn)" style={{
            width: "44px", height: "40px", borderRadius: radius.control, border: "none",
            backgroundColor: (!isPlayerPhase || busy || !actionText.trim()) ? "rgba(176,114,230,0.15)" : "#b072e6",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: (!isPlayerPhase || busy || !actionText.trim()) ? "default" : "pointer", flexShrink: 0,
          }}>
            <Icon name="send" size={16} color={(!isPlayerPhase || busy || !actionText.trim()) ? "rgba(176,114,230,0.4)" : colors.ink} strokeWidth={2.2} />
          </button>
        </div>

        {/* Draw weapon — only in a bare-knuckle brawl, when you have steel to draw. */}
        {!combat.lethal && player.stowedWeapon && player.stowedWeapon.category !== "unarmed" && (
          <button onClick={onDraw} disabled={!isPlayerPhase} style={{
            width: "100%", marginTop: "8px", padding: "9px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(239,68,68,0.12)", color: "#fca5a5",
            border: `1px solid rgba(239,68,68,0.4)`, fontSize: "12px", fontWeight: 800,
            cursor: isPlayerPhase ? "pointer" : "default", fontFamily: "inherit", opacity: isPlayerPhase ? 1 : 0.5,
          }}>Draw {player.stowedWeapon.name} — make it lethal</button>
        )}

        {/* Reposition — each costs an action point: charge in or kite away */}
        {(onAdvance || onWithdraw) && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {[["Advance", onAdvance], ["Withdraw", onWithdraw]].map(([label, fn]) => {
              const canMove = isPlayerPhase && (player.actionsLeft || 0) >= 1;
              return (
                <button key={label} onClick={fn} disabled={!canMove} style={{
                  flex: 1, padding: "8px", borderRadius: radius.panelCompact,
                  backgroundColor: "rgba(127,199,224,0.1)", color: "rgba(127,199,224,0.9)",
                  border: `1px solid rgba(127,199,224,0.3)`, fontSize: "11px", fontWeight: 700,
                  cursor: canMove ? "pointer" : "default", fontFamily: "inherit", opacity: canMove ? 1 : 0.4,
                }}>{label}</button>
              );
            })}
          </div>
        )}

        {/* Turn controls */}
        {/* Truce: once a fight grinds past a stalemate, the foe's offer to break off
            to a draw stays on the table — fight on, or take it. */}
        {isPlayerPhase && combat.ceasefire && (
          <button onClick={onCeasefire} style={{
            width: "100%", marginTop: "9px", padding: "10px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(127,199,224,0.14)", color: "#9fd4e6",
            border: "1px solid rgba(127,199,224,0.4)", fontSize: "13px", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }} title="Both sides break off — a wary draw. No victor, no spoils.">Call a Truce — break off to a draw</button>
        )}
        <div style={{ display: "flex", gap: "8px", marginTop: "9px" }}>
          <button onClick={onEndTurn} disabled={combat.phase !== "player"} style={{
            flex: 1, padding: "11px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(215,167,111,0.12)", color: colors.parchmentLight,
            border: `1px solid rgba(215,167,111,0.3)`, fontSize: "13px", fontWeight: 700,
            cursor: combat.phase === "player" ? "pointer" : "default", fontFamily: "inherit", opacity: combat.phase === "player" ? 1 : 0.5,
          }}>End Turn</button>
          {canStand ? (
            <button onClick={onStandDown} style={{
              padding: "11px 18px", borderRadius: radius.panelCompact,
              backgroundColor: "rgba(252,211,77,0.14)", color: "#fcd34d",
              border: `1px solid rgba(252,211,77,0.4)`, fontSize: "13px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }} title="End the fight — spare the foes that yielded and let any runners go">Stand Down</button>
          ) : (
            <button onClick={onFlee} disabled={combat.phase !== "player"} style={{
              padding: "11px 18px", borderRadius: radius.panelCompact,
              backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
              border: `1px solid rgba(215,167,111,0.2)`, fontSize: "13px", fontWeight: 700,
              cursor: combat.phase === "player" ? "pointer" : "default", fontFamily: "inherit", opacity: combat.phase === "player" ? 1 : 0.5,
            }}>Flee</button>
          )}
        </div>
      </div>

      {over && <ResolveOverlay combat={combat} onResolve={onResolve} />}
    </div>
  );
}
