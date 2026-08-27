import { applyBeat } from "./beat.js";
import { resolveNarratorIntents } from "../gameplay/campaign/command-gateway.js";
import { consumeCompiledNarratorTurn } from "./narrator-turn-compiler.js";
import { narratorStateRevision } from "./narrator-projection.js";
import { storyFromResponse } from "./narrative-sequence.js";
import { maxVitalityFor } from "./attributes.js";

function applyAuthorizedAssassinationDeath(state, effect) {
  const targetId = effect.target_id;
  const originalCharacters = state.world.codex.characters;
  const originalTarget = originalCharacters[targetId];
  if (!originalTarget) return state;

  const characters = { ...originalCharacters };
  const cloneCharacter = (id) => {
    const current = characters[id];
    if (!current) return null;
    if (current === originalCharacters[id]) characters[id] = { ...current };
    return characters[id];
  };
  const target = cloneCharacter(targetId);
  const maxHealth = target.combatState?.maxHealth || target.health || maxVitalityFor(target);
  const carrierId = target.ridingOn;
  if (carrierId) {
    const carrier = cloneCharacter(carrierId);
    if (carrier) carrier.riders = (carrier.riders || []).filter((id) => id !== targetId);
  }
  for (const riderId of target.riders || []) {
    const rider = cloneCharacter(riderId);
    if (rider) rider.ridingOn = null;
  }
  target.ridingOn = null;
  target.riders = [];
  target.deathDay = state.time?.day ?? 0;
  target.combatState = { health: 0, maxHealth, status: "dead" };

  return {
    ...state,
    party: (state.party || []).filter((id) => id !== targetId),
    world: {
      ...state.world,
      codex: { ...state.world.codex, characters },
    },
  };
}

function withNarratorContinuation(state, turn, policy) {
  const terminalEffect = policy?.continuation?.terminalEffect;
  if (!terminalEffect) return state;
  if (turn[terminalEffect] != null) {
    if (!("narratorTurnContinuation" in state)) return state;
    const { narratorTurnContinuation: _completed, ...rest } = state;
    return rest;
  }
  return {
    ...state,
    narratorTurnContinuation: {
      route: policy.id,
      ...(policy.effectConstraints ? { effectConstraints: policy.effectConstraints } : {}),
    },
  };
}

export function applyCompiledNarratorTurn(
  state,
  turn,
  { acceptTerminalEffect = false } = {},
) {
  const revision = narratorStateRevision(state);
  const policy = consumeCompiledNarratorTurn(turn, revision, "apply");

  // One door. Every mechanical field crosses the gateway before anything is applied, and a
  // refused field is stripped here rather than complained about afterwards — which is what
  // makes a refusal an actual refusal and not a note attached to a change that happened.
  const governed = resolveNarratorIntents(state, turn, {
    stateRevision: revision,
    // The exact compiler-bound capability is the single route authority. Route remains
    // only as receipt context and a legacy fallback for older direct gateway callers.
    route: policy?.id ?? null,
    turnPolicy: policy,
  });
  const admitted = governed.turn;

  const terminalEffect = policy?.continuation?.terminalEffect;
  const reducerTurn = terminalEffect && admitted[terminalEffect] != null && !acceptTerminalEffect
    ? { ...admitted, [terminalEffect]: null }
    : admitted;
  const reduced = applyBeat(state, reducerTurn);
  const settled = admitted.assassination?.outcome === "killed"
    ? applyAuthorizedAssassinationDeath(reduced, admitted.assassination)
    : reduced;
  const continued = withNarratorContinuation(settled, admitted, policy);
  // Refusals are recorded on the state so a player can be told their beat was trimmed, and
  // so a support report has something to read.
  return governed.refused
    ? { ...continued, lastIntentRefusals: governed.refusals }
    : withoutRefusals(continued);
}

function withoutRefusals(state) {
  if (!("lastIntentRefusals" in state)) return state;
  const { lastIntentRefusals: _cleared, ...rest } = state;
  return rest;
}

export function applyCompiledNarratorPresentation(
  state,
  turn,
  applyPresentation,
  generationState = state,
) {
  consumeCompiledNarratorTurn(turn, narratorStateRevision(generationState), "present");
  return applyPresentation(state, turn);
}

export function applyCompiledNarratorStoryPresentation(
  state,
  turn,
  generationState = state,
) {
  consumeCompiledNarratorTurn(turn, narratorStateRevision(generationState), "present");
  const story = storyFromResponse(turn).filter((item) => (
    item.type === "beat" ? !!item.text : !!item.name && !!item.line
  ));
  const stamp = Date.now();
  const storyBeats = story.map((item, index) => {
    const shared = {
      thinking: index === 0 ? (turn._thinking || null) : null,
      model: index === 0 ? (turn._model || null) : null,
      truncated: index === story.length - 1 && !!turn._truncated,
    };
    return item.type === "beat"
      ? {
        id: `n${stamp}-${index}`,
        type: "narration",
        ...(item.actor_id ? { actorId: item.actor_id } : {}),
        content: item.text,
        ...shared,
      }
      : {
        id: `d${stamp}-${index}`,
        type: "dialogue",
        ...(item.speaker_id ? { speakerId: item.speaker_id } : {}),
        name: item.name,
        line: item.line,
        ...shared,
      };
  });
  const apiHistory = [...(state.apiHistory || [])];
  if (turn._userMsg) apiHistory.push({ role: "user", content: turn._userMsg });
  if (turn._raw) apiHistory.push({ role: "assistant", content: turn._raw });
  return {
    ...state,
    beats: [...(state.beats || []), ...storyBeats],
    apiHistory,
  };
}
