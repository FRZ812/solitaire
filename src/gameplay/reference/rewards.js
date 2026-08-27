import { getActionProgressionOffer } from "./actions.js";
import { getReferenceTrait } from "./abilities.js";
import { getReferenceItem } from "./items.js";

const KNIGHT_GUIDE_SOURCE = Object.freeze({
  confidence: "secondary",
  date: "2023-09-12",
  referenceVersion: "guide-current-on-source-date",
  url: "https://gall.dcinside.com/mgallery/board/view/?id=combat&no=5666",
});

function actionReward(offerId) {
  const offer = getActionProgressionOffer(offerId);
  return Object.freeze({
    id: `action:${offerId}`,
    kind: "action",
    name: offer.name,
    actionOfferId: offerId,
    evidence: KNIGHT_GUIDE_SOURCE,
  });
}

function traitReward(traitId) {
  const trait = getReferenceTrait(traitId);
  return Object.freeze({
    id: `trait:${traitId}:1`,
    kind: "trait",
    name: `${trait.name} +1`,
    traitId,
    levels: 1,
    magnitudeConfidence: "inferred-placeholder",
    evidence: KNIGHT_GUIDE_SOURCE,
  });
}

export const REFERENCE_REWARDS = Object.freeze([
  actionReward("shield-bash-upgrade"),
  actionReward("slaughter-upgrade"),
  actionReward("shield-bash-replacement"),
  actionReward("slaughter-replacement"),
  Object.freeze({
    id: "item:mithril-helm",
    kind: "item",
    name: getReferenceItem("mithril-helm").name,
    itemId: "mithril-helm",
    evidence: getReferenceItem("mithril-helm").evidence,
  }),
  traitReward("ironclad"),
  traitReward("force-field"),
]);

const REWARDS = Object.freeze(Object.fromEntries(
  REFERENCE_REWARDS.map((reward) => [reward.id, reward]),
));

export function getReferenceReward(rewardId) {
  return typeof rewardId === "string" && Object.hasOwn(REWARDS, rewardId)
    ? REWARDS[rewardId]
    : null;
}

export function referenceRewardIds() {
  return REFERENCE_REWARDS.map((reward) => reward.id);
}
