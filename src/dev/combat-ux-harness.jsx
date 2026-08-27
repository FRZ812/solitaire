// Dev-only harness: mounts TowCombatView with a scripted two-foe encounter so the
// combat UX flow can be exercised in a real browser without auth or Supabase.
// Load via `vite` at /src/dev/combat-ux-harness.html. Not imported by any test.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TowCombatView } from "../components/combat/TowCombatView.jsx";
import { createTowSession } from "../gameplay/tow/session.js";
import { dispatchTowPlayerAction } from "../gameplay/tow/commands.js";
import { startingBuild } from "../gameplay/tow/build.js";

const ALLY_BUILD = () => ({ traits: {}, skills: ["strike", "block"] });

function makeEncounter({ allies = true, secondFoe = true } = {}) {
  const opened = createTowSession({
    sessionId: "combat-ux-harness:1",
    rootSeed: "combat-ux-harness:1",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 120,
      resolve: 3,
      resolveMax: 5,
      stats: { attack: 14, defense: 4, critRate: 10, dodgeRate: 5 },
    },
    allies: allies
      ? [{
        id: "ally-kestrel",
        name: "Kestrel",
        maxHp: 60,
        resolve: 2,
        resolveMax: 4,
        stats: { attack: 8, defense: 5, critRate: 0, dodgeRate: 0 },
        build: ALLY_BUILD(),
      }]
      : [],
    enemies: [
      {
        id: "foe-0",
        name: "Brigand captain",
        maxHp: 45,
        stats: { attack: 6, defense: 1, critRate: 0, dodgeRate: 0 },
        attacks: [
          { id: "foe-0-jab", name: "Jab", hits: 1, damage: 5 },
          { id: "foe-0-sweep", name: "Sweep", hits: 2, damage: 3 },
        ],
      },
      ...(secondFoe
        ? [{
          id: "foe-1",
          name: "Brigand cutthroat",
          maxHp: 30,
          stats: { attack: 4, defense: 0, critRate: 0, dodgeRate: 0 },
          attacks: [{ id: "foe-1-jab", name: "Jab", hits: 1, damage: 3 }],
        }]
        : []),
    ],
    build: startingBuild("fighter", { level: 1 }),
    context: {
      source: { kind: "travel", note: "Brigands block the road." },
      location: "the road",
      lethalPolicy: "nonlethal",
      playerStakes: "survivable",
      participantBindings: {
        "foe-0": { campaignEntityId: null, lethal: null },
        ...(secondFoe ? { "foe-1": { campaignEntityId: null, lethal: null } } : {}),
        ...(allies ? { "ally-kestrel": { campaignEntityId: null, lethal: null } } : {}),
      },
    },
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function Harness() {
  const [session, setSession] = useState(() => makeEncounter({}));
  const [feedback, setFeedback] = useState(null);
  const [log, setLog] = useState([]);
  const [settled, setSettled] = useState(false);
  const revisionRef = useRef(session.revision);

  const push = useCallback((line) => {
    setLog((rows) => [...rows.slice(-40), `${new Date().toISOString().slice(11, 23)} ${line}`]);
  }, []);

  const runCommand = useCallback((command) => {
    const result = dispatchTowPlayerAction(session, command);
    if (!result.ok) {
      push(`REJECTED ${command.type} ${command.skillId || command.actionId || ""}: ${result.reason}`);
      setFeedback(result.reason);
      return;
    }
    push(`OK ${command.type} ${command.skillId || ""} -> rev ${result.session.revision}`);
    revisionRef.current = result.session.revision;
    setFeedback(null);
    setSession(result.session);
  }, [session, push]);

  const onUseSkill = useCallback((skillId, targetId, actorId) => {
    runCommand({
      id: `h-${revisionRef.current + 1}`,
      expectedRevision: revisionRef.current,
      type: "use-skill",
      actorId,
      skillId,
      targetId,
    });
  }, [runCommand]);

  const onUseItem = useCallback(() => setFeedback("satchel items are not wired in the harness"), []);
  const onStandDown = useCallback((actorId) => {
    runCommand({ id: `h-${revisionRef.current + 1}`, expectedRevision: revisionRef.current, type: "end-turn", actorId });
  }, [runCommand]);
  const onRetreat = useCallback(() => setFeedback("retreat is not wired in the harness"), []);
  const onSettle = useCallback(() => {
    push("settle clicked");
    setSettled(true);
  }, [push]);

  if (settled) {
    return (
      <div style={{ color: "#ddd", font: "14px system-ui", padding: 24 }}>
        <p>Settlement applied. Fight over.</p>
        <button type="button" onClick={() => { setSession(makeEncounter({})); setSettled(false); setLog([]); }}>
          Restart fight
        </button>
      </div>
    );
  }

  return (
    <>
      <TowCombatView
        encounter={session.encounter}
        note={session.context?.source?.note}
        onUseSkill={onUseSkill}
        onUseItem={onUseItem}
        onStandDown={onStandDown}
        onRetreat={onRetreat}
        onSettle={onSettle}
        error={feedback}
      />
      <div
        id="harness-log"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "18vh", overflowY: "auto",
          background: "rgba(8,8,12,0.92)", color: "#9fe29f", font: "11px/1.5 ui-monospace,monospace",
          padding: "6px 10px", zIndex: 99999, pointerEvents: "none",
        }}
      >
        {log.map((row, index) => <div key={index}>{row}</div>)}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
