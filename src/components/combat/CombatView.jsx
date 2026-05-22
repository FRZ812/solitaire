import React, { useRef, useEffect, useState } from "react";
import { Icon } from "../Icon.jsx";
import { colors, radius, fonts, metaStyle, shadow, glass } from "../tokens.js";
import { tierColor, tierLabel } from "../../data/tiers.js";
import { getAbilityDef, abilityRequiredStat, abilityScaling } from "../../data/abilities.js";
import { demeanorLabel } from "../../data/combat-flavor.js";
import { abilityUsable } from "../../engine/combat.js";

// Soft-requirement readout for the ability bar: stat shortfall + off-weapon.
function abilityEff(player, def, tierId) {
  let statEff = 1, reqLabel = null;
  const req = abilityRequiredStat(def, tierId || "common");
  if (req && req.value) {
    const have = player.attrs?.[req.attr] || 0;
    statEff = Math.max(0.2, Math.min(1, have / req.value));
    if (have < req.value) reqLabel = `${req.attr.slice(0, 3).toUpperCase()} ${have}/${req.value}`;
  }
  let weaponBad = false;
  if (abilityScaling(def) === "weapon" && def.weaponReq?.length && !def.weaponReq.includes(player.weapon?.category)) weaponBad = true;
  return { eff: statEff * (weaponBad ? 0.6 : 1), reqLabel, weaponBad };
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
};
const STATUS_COLOR = {
  bleed: "#d97a6c", poison: "#86b34a", stun: "#e6c84a", weaken: "#8fb0c9",
  vulnerable: "#e09a5a", guard: "#9ab0b0", rally: "#f5b97a", regen: "#74c66b", focus: "#b072e6",
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

function EnemyCard({ enemy, selected, onSelect }) {
  const dead = enemy.health <= 0;
  const resolvedWord = enemy.resolved === "yielded" ? "Yielded" : enemy.resolved === "fled" ? "Fled" : null;
  const inactive = dead || !!enemy.resolved;
  const mood = inactive ? null : moodOf(enemy);
  const resolvedColor = enemy.resolved === "yielded" ? "#a7f3d0" : "#9ab0b0";
  return (
    <button
      onClick={() => !inactive && onSelect()}
      disabled={inactive}
      style={{
        flex: "1 1 130px", minWidth: 0, textAlign: "left",
        padding: "9px 11px", borderRadius: radius.panelCompact,
        backgroundColor: inactive ? "rgba(20,29,29,0.35)" : "rgba(35,15,15,0.55)",
        border: selected && !inactive ? `1px solid ${colors.gold}` : `1px solid rgba(239,68,68,0.3)`,
        boxShadow: selected && !inactive ? `0 0 12px rgba(215,167,111,0.3)` : "none",
        opacity: inactive ? 0.5 : 1, cursor: inactive ? "default" : "pointer",
        fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
        <span style={{
          fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px",
          color: dead ? colors.parchmentMuted : resolvedWord ? resolvedColor : "#fde8e4", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: dead ? "line-through" : "none",
        }}>{enemy.name}</span>
        <TierBadge tier={enemy.tier} />
      </div>
      {resolvedWord ? (
        <div style={{ fontSize: "12px", fontStyle: "italic", color: resolvedColor, padding: "4px 0" }}>{resolvedWord}</div>
      ) : (
        <>
          <Bar value={enemy.health} max={enemy.maxHealth} color="linear-gradient(90deg,#8f4c3c,#c75b48)" height={7} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
            <span style={{ fontSize: "9px", color: colors.parchmentMuted }}>{Math.ceil(enemy.health)}/{enemy.maxHealth}</span>
            <span style={{ fontSize: "8px", color: "rgba(237,228,208,0.5)" }}>
              {enemy.armor > 0 ? `AR ${enemy.armor} ` : ""}{enemy.ward > 0 ? `WD ${enemy.ward}` : ""}
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

function AbilityButton({ entry, combat, onAct }) {
  const def = getAbilityDef(entry.id);
  if (!def) return null;
  const cd = combat.player.cooldowns[entry.id] || 0;
  const usable = abilityUsable(combat, entry.id);
  const tcolor = tierColor(entry.tier || "common");
  const { eff, reqLabel, weaponBad } = abilityEff(combat.player, def, entry.tier);
  const penalised = eff < 1;
  const costParts = [];
  if (def.cost > 0) costParts.push(`${def.cost} stam`);
  if (def.resolveCost > 0) costParts.push(`${def.resolveCost} res`);
  if (def.cooldown) costParts.push(`cd ${def.cooldown}`);
  return (
    <button
      onClick={() => onAct(entry.id)}
      disabled={!usable}
      title={`${def.desc}${reqLabel ? ` · needs ${reqLabel}` : ""}${weaponBad ? " · wrong weapon" : ""}`}
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
      {(reqLabel || weaponBad) && (
        <div style={{ fontSize: "7px", color: "#e0913a", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {weaponBad ? "off-weapon" : reqLabel}
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
  const resolved = combat.phase === "resolved";
  const fled = combat.phase === "playerFled";
  const title = win ? "Victory" : resolved ? "Stood Down" : fled ? "Escaped" : "Defeat";
  const color = win ? "#a7f3d0" : resolved ? "#a7f3d0" : fled ? colors.gold : "#fca5a5";
  const subtitle =
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

export function CombatView({ combat, onAct, onTalk, onEnvironment, onDraw, onSetTarget, onEndTurn, onFlee, onResolve }) {
  const logRef = useRef(null);
  const [talkOpen, setTalkOpen] = useState(false);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log.length]);

  const { player } = combat;
  const over = ["victory", "defeat", "resolved", "playerFled"].includes(combat.phase);
  const isPlayerPhase = combat.phase === "player";
  const talkUsable = abilityUsable(combat, "talk");
  const environment = combat.environment || [];
  const doTalk = (intent) => { setTalkOpen(false); onTalk(intent); };

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
          <span style={{ fontSize: "11px", color: colors.parchment, fontWeight: 700, flexShrink: 0 }}>{Math.ceil(player.health)}/{player.maxHealth}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
          <span style={{ ...metaStyle, fontSize: "8px", color: "rgba(237,228,208,0.55)" }}>Stamina</span>
          <div style={{ display: "flex", gap: "3px" }}>
            {Array.from({ length: player.maxStamina }).map((_, i) => (
              <div key={i} style={{
                width: "10px", height: "10px", borderRadius: "50%",
                backgroundColor: i < player.stamina ? colors.gold : "rgba(215,167,111,0.15)",
                border: `1px solid rgba(215,167,111,0.3)`,
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
          AR {player.armor} · WD {player.ward} · DODGE {player.dodge}% · {player.weapon?.name}
        </div>
        <StatusRow statuses={player.statuses} />

        {/* Ability grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "9px" }}>
          {player.abilities.map((entry, i) => entry.id === "talk" ? (
            <button
              key={`talk-${i}`}
              onClick={() => setTalkOpen((v) => !v)}
              disabled={!talkUsable}
              title="Demand surrender, demoralize, or provoke"
              style={{
                textAlign: "left", padding: "8px 9px", borderRadius: radius.chip,
                backgroundColor: talkOpen ? "rgba(176,114,230,0.18)" : (talkUsable ? "rgba(20,29,29,0.7)" : "rgba(20,29,29,0.3)"),
                border: `1px solid ${talkUsable ? "#b072e6" : "rgba(215,167,111,0.12)"}`,
                opacity: talkUsable ? 1 : 0.45, cursor: talkUsable ? "pointer" : "default", fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="user" size={13} color="#b072e6" strokeWidth={1.8} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: colors.parchment }}>Talk</span>
              </div>
              <div style={{ fontSize: "8px", color: "rgba(237,228,208,0.55)", marginTop: "3px" }}>1 stam · cd 1 · pick intent</div>
            </button>
          ) : (
            <AbilityButton key={`${entry.id}-${i}`} entry={entry} combat={combat} onAct={onAct} />
          ))}
        </div>

        {/* Talk intents */}
        {talkOpen && isPlayerPhase && (
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            {[["surrender", "Demand Surrender"], ["demoralize", "Demoralize"], ["provoke", "Provoke"]].map(([intent, label]) => (
              <button key={intent} onClick={() => doTalk(intent)} style={{
                flex: 1, padding: "9px 6px", borderRadius: radius.chip, fontSize: "11px", fontWeight: 700,
                backgroundColor: "rgba(176,114,230,0.12)", color: "#d9bdf2",
                border: `1px solid rgba(176,114,230,0.45)`, cursor: "pointer", fontFamily: "inherit",
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* Environment — dynamic, single-use battlefield features */}
        {environment.some((f) => f.uses > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
            {environment.filter((f) => f.uses > 0).map((f) => (
              <button
                key={f.id}
                onClick={() => onEnvironment(f.id)}
                disabled={!isPlayerPhase || player.stamina < 1}
                title="Battlefield feature (1 stamina)"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 10px", borderRadius: radius.pill, fontSize: "11px", fontWeight: 700,
                  backgroundColor: "rgba(120,90,50,0.2)", color: "#e6c89a",
                  border: `1px dashed rgba(215,167,111,0.45)`,
                  cursor: isPlayerPhase && player.stamina >= 1 ? "pointer" : "default",
                  opacity: isPlayerPhase && player.stamina >= 1 ? 1 : 0.5, fontFamily: "inherit",
                }}
              >
                <Icon name={f.icon || "swords"} size={12} color="#e6c89a" strokeWidth={1.8} />
                {f.name}{f.uses > 1 ? ` (${f.uses})` : ""}
              </button>
            ))}
          </div>
        )}

        {/* Draw weapon — only in a bare-knuckle brawl, when you have steel to draw. */}
        {!combat.lethal && player.stowedWeapon && player.stowedWeapon.category !== "unarmed" && (
          <button onClick={onDraw} disabled={!isPlayerPhase} style={{
            width: "100%", marginTop: "8px", padding: "9px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(239,68,68,0.12)", color: "#fca5a5",
            border: `1px solid rgba(239,68,68,0.4)`, fontSize: "12px", fontWeight: 800,
            cursor: isPlayerPhase ? "pointer" : "default", fontFamily: "inherit", opacity: isPlayerPhase ? 1 : 0.5,
          }}>Draw {player.stowedWeapon.name} — make it lethal</button>
        )}

        {/* Turn controls */}
        <div style={{ display: "flex", gap: "8px", marginTop: "9px" }}>
          <button onClick={onEndTurn} disabled={combat.phase !== "player"} style={{
            flex: 1, padding: "11px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(215,167,111,0.12)", color: colors.parchmentLight,
            border: `1px solid rgba(215,167,111,0.3)`, fontSize: "13px", fontWeight: 700,
            cursor: combat.phase === "player" ? "pointer" : "default", fontFamily: "inherit", opacity: combat.phase === "player" ? 1 : 0.5,
          }}>End Turn</button>
          <button onClick={onFlee} disabled={combat.phase !== "player"} style={{
            padding: "11px 18px", borderRadius: radius.panelCompact,
            backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
            border: `1px solid rgba(215,167,111,0.2)`, fontSize: "13px", fontWeight: 700,
            cursor: combat.phase === "player" ? "pointer" : "default", fontFamily: "inherit", opacity: combat.phase === "player" ? 1 : 0.5,
          }}>Flee</button>
        </div>
      </div>

      {over && <ResolveOverlay combat={combat} onResolve={onResolve} />}
    </div>
  );
}
