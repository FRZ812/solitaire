// Phase 0 exit gate: every retained old module has a named destination.
//
// The ledger is derived against the real directory listing, so a module cannot be added or
// removed without the accounting noticing. The teeth are the last test: once a module's
// blocker is cleared, nothing may still import it.

import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESTINATION,
  isValidDestination,
  ledgerEntryFor,
  readyForDeletion,
  RETIREMENT_LEDGER,
} from "./retirement-ledger.js";

const ROOT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TRACKED_DIRS = ["kernel", "production", "reference", "run"];

function modulesOnDisk() {
  const found = [];
  for (const dir of TRACKED_DIRS) {
    for (const file of readdirSync(join(ROOT, dir))) {
      if (!file.endsWith(".js") || file.includes(".test.")) continue;
      found.push(`${dir}/${file}`);
    }
  }
  return found.sort();
}

describe("the ledger matches what is on disk", () => {
  it("classifies every module in the duplicate stacks", () => {
    const unclassified = modulesOnDisk().filter((module) => !ledgerEntryFor(module));
    expect(unclassified).toEqual([]);
  });

  it("carries no entry for a module that no longer exists", () => {
    const present = new Set(modulesOnDisk());
    const stale = RETIREMENT_LEDGER.map((row) => row.module).filter((m) => !present.has(m));
    expect(stale).toEqual([]);
  });

  it("names each module exactly once", () => {
    const modules = RETIREMENT_LEDGER.map((row) => row.module);
    expect(new Set(modules).size).toBe(modules.length);
  });
});

describe("every destination is a real decision", () => {
  it("uses a valid destination and gives a substantive reason", () => {
    for (const row of RETIREMENT_LEDGER) {
      expect(isValidDestination(row.destination), row.module).toBe(true);
      expect(row.why.length, row.module).toBeGreaterThan(30);
    }
  });

  it("makes a port name where the capability is going", () => {
    for (const row of RETIREMENT_LEDGER.filter((r) => r.destination === DESTINATION.PORT)) {
      expect(row.successor, `${row.module} needs a successor`).toBeTruthy();
      expect(row.blockedBy, `${row.module} needs a blocking phase`).toBeTruthy();
    }
  });

  it("does not let a keep pretend to be blocked", () => {
    for (const row of RETIREMENT_LEDGER.filter((r) => r.destination === DESTINATION.KEEP)) {
      expect(row.blockedBy, row.module).toBeNull();
      expect(row.successor, row.module).toBeNull();
    }
  });
});

describe("nothing unblocked is still imported", () => {
  // The teeth. Clearing a blocker in the ledger without actually removing the imports
  // fails here, so the ledger cannot claim progress the code has not made.
  function sourceFilesImporting(module) {
    const specifier = module.replace(/^([a-z-]+)\//, "$1/");
    const hits = [];
    const walk = (dir) => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          if (item.name === "node_modules") continue;
          walk(full);
          continue;
        }
        if (!/\.(js|jsx)$/.test(item.name) || item.name.includes(".test.")) continue;
        if (full.endsWith(join("gameplay", ...module.split("/")))) continue;
        const text = readFileSync(full, "utf8");
        if (text.includes(specifier)) hits.push(full);
      }
    };
    walk(join(ROOT, "..", ".."));
    return hits;
  }

  it("has nothing ready for deletion that is still referenced", () => {
    for (const module of readyForDeletion()) {
      expect(sourceFilesImporting(module), `${module} is unblocked but still imported`)
        .toEqual([]);
    }
  });

  it("records a blocker for every delete that is not yet ready", () => {
    const blocked = RETIREMENT_LEDGER
      .filter((row) => row.destination === DESTINATION.DELETE && row.blockedBy !== null);
    expect(blocked.length).toBeGreaterThan(0);
    for (const row of blocked) {
      expect(typeof row.blockedBy).toBe("string");
      expect(row.blockedBy.length).toBeGreaterThan(3);
    }
  });
});
