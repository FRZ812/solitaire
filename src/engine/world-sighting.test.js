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

  it("keeps hostile lairs off the map even from an adjacent hex", () => {
    const den = siteSighting({ family: "den", terrain: "hills" });
    expect(siteKnowledgeGrade(den, { distance: 0, explored: true })).toBe("");
  });

  it("grades a site by whether it is in range or already on the sight record", () => {
    const ruin = siteSighting({ family: "ruin", terrain: "plains" });
    expect(ruin.range).toBe(6);
    expect(siteKnowledgeGrade(ruin, { distance: 6, explored: false })).toBe("silhouette");
    expect(siteKnowledgeGrade(ruin, { distance: 7, explored: false })).toBe("");
    // Ground the party has already crossed keeps its sites regardless of range.
    expect(siteKnowledgeGrade(ruin, { distance: 40, explored: true })).toBe("silhouette");

    const village = siteSighting({ family: "settlement", terrain: "plains" });
    expect(siteKnowledgeGrade(village, { distance: 3, explored: false })).toBe("rumoured");
  });
});
