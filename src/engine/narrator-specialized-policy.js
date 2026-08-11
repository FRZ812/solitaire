function constrainedTarget(message, route, effect, field, pattern, { relatedCharacter = false } = {}) {
  const match = message.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Specialized narrator route ${route} is missing its engine-issued target.`);
  }
  const effectConstraints = {
    [effect]: { fields: { [field]: match[1] } },
  };
  if (relatedCharacter) {
    effectConstraints.relationship_changes = { eachFields: { id: match[1] } };
    effectConstraints.memory_updates = { eachFields: { id: match[1] } };
  }
  return { route, effectConstraints };
}

export function specializedNarratorPolicyOptions(userMessage) {
  const message = String(userMessage || "").trim();
  if (message.startsWith("[TRADE]")) return { route: "trade-presentation" };
  if (message.startsWith("[APPROACH MOUNT]")) {
    return constrainedTarget(
      message,
      "mount-negotiation",
      "buy_mount",
      "id",
      /\(id:\s*([a-z0-9-]+)\)/i,
    );
  }
  if (message.startsWith("[APPROACH RECRUIT]")) {
    return constrainedTarget(
      message,
      "recruitment-negotiation",
      "recruit_companion",
      "id",
      /\(id:\s*([a-z0-9-]+)\)/i,
      { relatedCharacter: true },
    );
  }
  if (message.startsWith("[PLAYER ACTION] [PART WAYS]")) {
    return constrainedTarget(
      message,
      "party-departure",
      "part_ways",
      "id",
      /part_ways:\s*\{\s*"id"\s*:\s*"([^"]+)"/,
      { relatedCharacter: true },
    );
  }
  if (message.startsWith("[PLAYER ACTION] [SCRY]")) {
    const match = message.match(/\(id:\s*([a-z0-9-]+)\)/i);
    if (!match?.[1]) {
      throw new Error("Specialized narrator route scry-presentation is missing its engine-issued target.");
    }
    return { route: "scry-presentation", storyCharacterIds: [match[1]] };
  }
  if (message.startsWith("[INSPECT RIGHTS]")) {
    return constrainedTarget(
      message,
      "rights-negotiation",
      "purchase_rights",
      "key",
      /purchase_rights:\s*\{\s*"key"\s*:\s*"([^"]+)"/,
    );
  }
  if (message.startsWith("[INSPECT CAPTIVE]")) {
    return constrainedTarget(
      message,
      "captive-negotiation",
      "purchase_captive",
      "key",
      /purchase_captive:\s*\{\s*"key"\s*:\s*"([^"]+)"/,
    );
  }
  if (message.startsWith("[PLAYER ACTION] You go looking for a fight")) {
    return { route: "combat-search-presentation" };
  }
  throw new Error("Specialized narrator call is missing an engine-issued route.");
}
