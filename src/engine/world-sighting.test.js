import { describe, expect, it } from "vitest";
import { siteSighting, siteKnowledgeGrade } from "./world-sighting.js";

describe("site sighting", () => {
  it("carries a silhouette further over open ground than through cover", () => {
    expect(siteSighting({ family: "fortification", terrain: "mountains" }).range).toBe(9);
    expect(siteSighting({ family: "fortification", terrain: "forest" }).range).toBe(5);
    expect(siteSighting({ family: "camp", terrain: "jungle" }).range).toBe(1);
  });

  it("lets road traffic name the places it stops at, but never a hostile one", () => {
    expect(siteSighting({ family: "shrine", terrain: "plains" }).named).toBe(false);
    expect(siteSighting({ family: "shrine", terrain: "plains", route: { id: "r" } }).named).toBe(true);
    expect(siteSighting({ family: "bandit-camp", terrain: "plains", route: { id: "r" } }).named).toBe(false);
  });

  it("keeps hostile lairs off the map however close the party gets", () => {
    // The one thing still hidden. Nobody charts the people who would rather not
    // be found, which is what makes these an ambush rather than a marker.
    expect(siteKnowledgeGrade(siteSighting({ family: "den", terrain: "hills" }))).toBe("");
    expect(siteKnowledgeGrade(siteSighting({ family: "bandit-camp", terrain: "plains" }))).toBe("");
  });

  it("charts every other site regardless of how far off it is", () => {
    // Distance is not a question the map asks any more: the continent has been
    // surveyed for centuries, and this party's eyesight has nothing to do with it.
    const ruin = siteSighting({ family: "ruin", terrain: "plains" });
    expect(ruin.range).toBe(6);
    expect(siteKnowledgeGrade(ruin)).toBe("silhouette");

    const village = siteSighting({ family: "settlement", terrain: "plains" });
    expect(siteKnowledgeGrade(village)).toBe("rumoured");
  });

  it("gives up a name only where travellers use one", () => {
    // The grade is about naming, not visibility. A ruin is a shape on the chart
    // until somebody walks into it; a village has been called something for
    // generations, so the map can say what.
    expect(siteKnowledgeGrade(siteSighting({ family: "wonder", terrain: "hills" }))).toBe("silhouette");
    expect(siteKnowledgeGrade(siteSighting({ family: "roadside-inn", terrain: "plains" }))).toBe("rumoured");
  });
});
