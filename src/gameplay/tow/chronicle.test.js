import { describe, expect, it } from "vitest";
import {
  MAX_DECISIVE_EVENTS,
  buildCombatChronicle,
  chronicleSummary,
  renderCombatChronicle,
} from "./chronicle.js";
import { dispatchTowCommand } from "./commands.js";
import { sealTowTerminalReceipt } from "./outcomes.js";
import { createTowSession } from "./session.js";

function open(overrides = {}) {
  const opened = createTowSession({
    sessionId: "combat-1",
    rootSeed: "chronicle",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 200,
      stats: { attack: 14, defense: 10, critRate: 0, dodgeRate: 0 },
    },
    allies: overrides.allies,
    enemies: overrides.enemies || [{
      id: "foe-0",
      name: "Brigand",
      maxHp: 30,
      stats: { attack: 4, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "foe-0-jab", name: "Jab", hits: 1, damage: 4 }],
    }],
    build: { traits: {}, skills: ["strike", "block"] },
    context: {
      location: "the Broken Wheel",
      source: { kind: "narrator", note: "a barfight" },
      lethalPolicy: overrides.lethalPolicy || "nonlethal",
      playerStakes: overrides.playerStakes || "survivable",
      participantBindings: overrides.participantBindings,
    },
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function fightToEnd(session, rounds = 30) {
  let current = session;
  for (let round = 0; round < rounds && current.encounter.phase === "player"; round += 1) {
    current = dispatchTowCommand(current, {
      id: `guard-${round}`,
      expectedRevision: current.revision,
      type: "use-skill",
      actorId: "wanderer",
      skillId: round === 0 ? "block" : "strike",
      targetId: current.encounter.enemyIds.find((id) => current.encounter.actors[id].hp > 0),
    }).session;
    if (current.encounter.phase !== "player") break;
    current = dispatchTowCommand(current, {
      id: `end-${round}`,
      expectedRevision: current.revision,
      type: "end-turn",
      actorId: "wanderer",
    }).session;
  }
  return sealTowTerminalReceipt(current).session;
}

describe("the report exists at all", () => {
  it("is null while the fight is still live", () => {
    expect(buildCombatChronicle(open(), null)).toBe(null);
  });

  it("names every participant and their exact fate", () => {
    // The instruction the narrator has always been given — "name the actual foes and their
    // exact fates" — referred to a document nobody built.
    const session = fightToEnd(open());
    const chronicle = buildCombatChronicle(session, session.terminalReceipt);
    expect(chronicle.participants.map((row) => row.name)).toEqual(["Wanderer", "Brigand"]);
    const foe = chronicle.participants.find((row) => row.side === "foe");
    expect(foe.combatState).toBe("incapacitated");
    expect(foe.worldFate).toBe("alive");
  });

  it("distinguishes knocked out from killed", () => {
    const spared = fightToEnd(open({ lethalPolicy: "nonlethal" }));
    const killed = fightToEnd(open({ lethalPolicy: "lethal" }));
    expect(buildCombatChronicle(spared, spared.terminalReceipt)
      .participants.find((row) => row.side === "foe").combatState).toBe("incapacitated");
    expect(buildCombatChronicle(killed, killed.terminalReceipt)
      .participants.find((row) => row.side === "foe").combatState).toBe("dead");
  });

  it("reports damage that actually landed, not what the skill claims", () => {
    const session = fightToEnd(open());
    const chronicle = buildCombatChronicle(session, session.terminalReceipt);
    const strike = chronicle.decisiveEvents.find((event) => event.action === "strike");
    expect(strike.damage).toBeGreaterThan(0);
    expect(strike.actor).toBe("Wanderer");
    expect(strike.target).toBe("Brigand");
  });

  it("records the guards raised as well as the blows struck", () => {
    const session = fightToEnd(open());
    const chronicle = buildCombatChronicle(session, session.terminalReceipt);
    expect(chronicle.mitigations.some((entry) => entry.kind === "shield")).toBe(true);
  });

  it("marks an ally as an ally rather than as a foe", () => {
    const session = fightToEnd(open({
      allies: [{
        id: "kestrel", name: "Kestrel", maxHp: 60,
        stats: { attack: 6, defense: 4, critRate: 0, dodgeRate: 0 },
        build: { traits: {}, skills: ["strike"] },
      }],
    }));
    const chronicle = buildCombatChronicle(session, session.terminalReceipt);
    expect(chronicle.participants.find((row) => row.name === "Kestrel").side).toBe("ally");
  });

  it("is stable for the same receipt", () => {
    const session = fightToEnd(open());
    const first = buildCombatChronicle(session, session.terminalReceipt);
    const second = buildCombatChronicle(session, session.terminalReceipt);
    expect(second).toEqual(first);
    expect(second.checksum).toBe(first.checksum);
  });

  it("trims a long fight without reordering it", () => {
    const session = fightToEnd(open({
      enemies: [{
        id: "foe-0", name: "Ogre", maxHp: 600,
        stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "foe-0-jab", name: "Jab", hits: 1, damage: 2 }],
      }],
    }), 60);
    const chronicle = buildCombatChronicle(session, session.terminalReceipt);
    expect(chronicle.decisiveEvents.length).toBeLessThanOrEqual(MAX_DECISIVE_EVENTS);
    const order = chronicle.decisiveEvents.map((event) => event.sequence);
    expect(order).toEqual([...order].sort((first, second) => first - second));
  });

  it("leaks nothing that has not happened yet", () => {
    // A report that carried the next round's declaration would let prose foreshadow a blow
    // the player has not been shown.
    const session = fightToEnd(open());
    const text = JSON.stringify(buildCombatChronicle(session, session.terminalReceipt));
    expect(text).not.toContain("intentRng");
    expect(text).not.toContain("declarationIndex");
  });
});

describe("the text the narrator is handed", () => {
  it("opens as the report the prompt names", () => {
    const session = fightToEnd(open());
    const text = renderCombatChronicle(buildCombatChronicle(session, session.terminalReceipt));
    expect(text.startsWith("[COMBAT REPORT]")).toBe(true);
  });

  it("states each fate in words rather than codes", () => {
    const session = fightToEnd(open({ lethalPolicy: "nonlethal" }));
    const text = renderCombatChronicle(buildCombatChronicle(session, session.terminalReceipt));
    expect(text).toContain("Brigand: knocked out, alive");
    expect(text).toContain("this is the player");
  });

  it("forbids inventing a participant", () => {
    const session = fightToEnd(open());
    const text = renderCombatChronicle(buildCombatChronicle(session, session.terminalReceipt));
    expect(text).toContain("do not invent a participant who is not listed");
  });

  it("says whether the player's life was actually at risk", () => {
    const safe = fightToEnd(open({ playerStakes: "survivable" }));
    const risky = fightToEnd(open({ playerStakes: "lethal" }));
    expect(renderCombatChronicle(buildCombatChronicle(safe, safe.terminalReceipt)))
      .toContain("the player's life was not at risk");
    expect(renderCombatChronicle(buildCombatChronicle(risky, risky.terminalReceipt)))
      .toContain("the player's life was at risk");
  });

  it("renders nothing for nothing", () => {
    expect(renderCombatChronicle(null)).toBe("");
    expect(chronicleSummary(null)).toBe("");
  });
});

describe("the sentence a player sees even if narration never arrives", () => {
  it("names the foe that went down", () => {
    const session = fightToEnd(open());
    expect(chronicleSummary(buildCombatChronicle(session, session.terminalReceipt)))
      .toBe("Brigand is knocked out. The fight is over.");
  });

  it("says plainly when the player lost", () => {
    const session = fightToEnd(open({
      enemies: [{
        id: "foe-0", name: "Fabled beast", maxHp: 9000,
        stats: { attack: 400, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "foe-0-maul", name: "Maul", hits: 1, damage: 400 }],
      }],
    }));
    expect(chronicleSummary(buildCombatChronicle(session, session.terminalReceipt)))
      .toContain("You went down");
  });
});
