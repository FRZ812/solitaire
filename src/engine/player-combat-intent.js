const ATTACK = /^(?:i|we)\s+(?:will\s+)?(attack|strike|charge|fight|hit|punch|kick|tackle|grapple|stab|slash|shoot|kill)\b/i;
const NONLETHAL = new Set(["hit", "punch", "kick", "tackle", "grapple"]);

function normalizedWords(value) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function playerCombatDirective(message, projection) {
  if (typeof message !== "string") return null;
  const action = message.trim();
  const intent = action.match(ATTACK);
  if (!intent) return null;
  if (action.includes("?")) return null;

  const remainder = normalizedWords(action.slice(intent[0].length));
  const combatTargetIds = projection?.combatTargetIds || [];
  let targets = combatTargetIds.filter((id) => {
    const character = projection?.characters?.[id];
    if (!character) return false;
    const aliases = [id, character.name].map(normalizedWords).filter(Boolean);
    return aliases.some((alias) => (
      remainder === alias
      || remainder === `at ${alias}`
      || (!alias.startsWith("the ") && remainder === `the ${alias}`)
    ));
  });
  if (
    targets.length === 0
    && combatTargetIds.length === 1
    && remainder === ""
  ) targets = [combatTargetIds[0]];
  if (targets.length !== 1) return null;

  const target = projection.characters[targets[0]];
  return {
    initiator: "player",
    surprise: false,
    lethal: !NONLETHAL.has(intent[1].toLocaleLowerCase("en-US")),
    foes: [{
      npc_id: target.id,
      kind: target.kind || "npc",
      name: target.name || target.id,
      tier: target.tier ?? null,
      count: 1,
    }],
    note: `You commit to combat with ${target.name || target.id}.`,
  };
}
