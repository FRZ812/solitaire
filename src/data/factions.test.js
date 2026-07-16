import { describe, expect, it } from "vitest";
import { PROVINCES, REALMS, REALM_FACTIONS } from "./continent.js";
import { FACTIONS, getFaction } from "./factions.js";

describe("continental faction registry", () => {
  it("resolves every realm and provincial authority through the shared faction catalog", () => {
    const ids = new Set(FACTIONS.map((faction) => faction.id));

    for (const realm of REALMS) {
      expect(ids.has(realm.faction.id), realm.id).toBe(true);
      expect(getFaction(realm.faction.id)?.name, realm.id).toBeTruthy();
    }

    for (const province of PROVINCES) {
      const faction = getFaction(province.authorityFactionId);
      expect(faction, province.id).toBeTruthy();
      expect(faction.realmId || province.realmId, province.id).toBe(province.realmId);
    }

    for (const faction of REALM_FACTIONS) {
      expect(getFaction(faction.id), faction.id).toMatchObject({
        id: faction.id,
        name: faction.name,
      });
    }
  });

  it("gives every atlas-scale realm several competing powers", () => {
    for (const realm of REALMS) {
      const realmFactions = REALM_FACTIONS.filter((faction) => faction.realmId === realm.id);
      expect(realmFactions.length, realm.id).toBeGreaterThanOrEqual(3);
      expect(new Set(realmFactions.map((faction) => faction.type)).size, realm.id).toBeGreaterThanOrEqual(2);
      for (const faction of realmFactions) {
        expect(faction.leader?.name, faction.id).toBeTruthy();
        expect(faction.agenda, faction.id).toBeTruthy();
        expect(faction.forces?.length, faction.id).toBeGreaterThan(0);
      }
    }
  });
});
