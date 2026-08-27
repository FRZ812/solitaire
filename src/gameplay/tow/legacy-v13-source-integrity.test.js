import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "./fixtures/v13-verifier-manifest.json";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const provenance = "// Frozen verifier-only Tower v1.3 semantics from deployed commit 1dd86f8.\n"
  + "// Never route playable/current combat through this module.\n";
const sourceCache = new Map();

function normalize(value) {
  return value.replace(/\r\n/g, "\n");
}

function sourceAt(sourcePath) {
  if (!sourceCache.has(sourcePath)) {
    sourceCache.set(sourcePath, normalize(execFileSync(
      "git",
      ["show", `${manifest.sourceCommit}:${sourcePath}`],
      { cwd: root, encoding: "utf8", maxBuffer: 4_000_000 },
    )));
  }
  return sourceCache.get(sourcePath);
}

function localSpecifiers(source) {
  const found = new Set();
  const pattern = /(?:from\s*|import\s*\()(["'])(\.[^"']+)\1/g;
  for (const match of source.matchAll(pattern)) found.add(match[2]);
  return [...found];
}

function sourceDependency(fromPath, specifier) {
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidates = path.posix.extname(joined)
    ? [joined]
    : [`${joined}.js`, `${joined}.jsx`, `${joined}/index.js`];
  for (const candidate of candidates) {
    try {
      sourceAt(candidate);
      return candidate;
    } catch {
      // Try the next explicit JS resolution candidate.
    }
  }
  throw new Error(`unresolved deployed dependency: ${fromPath} -> ${specifier}`);
}

function deployedClosure(rootPath) {
  const seen = new Set();
  const pending = [rootPath];
  while (pending.length > 0) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const specifier of localSpecifiers(sourceAt(current))) {
      pending.push(sourceDependency(current, specifier));
    }
  }
  return [...seen].sort();
}

function expectedRuntime(entry, bySource) {
  const source = sourceAt(entry.sourcePath);
  if (entry.runtimePath === entry.sourcePath) return source;
  let transformed = source;
  for (const specifier of localSpecifiers(source)) {
    const dependency = sourceDependency(entry.sourcePath, specifier);
    const runtimeDependency = bySource.get(dependency)?.runtimePath;
    if (!runtimeDependency) throw new Error(`dependency missing from manifest: ${dependency}`);
    let replacement = path.posix.relative(
      path.posix.dirname(entry.runtimePath),
      runtimeDependency,
    );
    if (!replacement.startsWith(".")) replacement = `./${replacement}`;
    transformed = transformed
      .replaceAll(`"${specifier}"`, `"${replacement}"`)
      .replaceAll(`'${specifier}'`, `'${replacement}'`);
  }
  return provenance + transformed;
}

describe("the frozen deployed-v1.3 verifier graph", () => {
  it("matches the complete deployed source closure through an external Git oracle", () => {
    expect(manifest).toMatchObject({
      version: 1,
      sourceCommit: "1dd86f8a8cf36bae9808dbb80bece23462617677",
      purpose: "verifier-only Tower v1.3 replay graph",
    });
    const closure = deployedClosure("src/gameplay/tow/replay.js");
    expect(closure).toHaveLength(73);
    expect(manifest.files.map((entry) => entry.sourcePath).sort()).toEqual(closure);

    const bySource = new Map(manifest.files.map((entry) => [entry.sourcePath, entry]));
    expect(bySource.size).toBe(manifest.files.length);
    for (const entry of manifest.files) {
      const runtime = normalize(readFileSync(path.join(root, entry.runtimePath), "utf8"));
      expect(runtime, `${entry.runtimePath} diverged from ${entry.sourcePath}`)
        .toBe(expectedRuntime(entry, bySource));
    }
  });

  it("is unreachable from the playable runtime registry", () => {
    const runtime = readFileSync(new URL("./runtime.js", import.meta.url), "utf8");
    const currentCommands = readFileSync(new URL("./commands.js", import.meta.url), "utf8");
    const currentEncounter = readFileSync(new URL("./encounter.js", import.meta.url), "utf8");
    const currentReplay = readFileSync(new URL("./replay.js", import.meta.url), "utf8");

    expect(runtime).not.toContain("-v13.js");
    expect(currentCommands).not.toContain("-v13.js");
    expect(currentEncounter).not.toContain("replayRetiredV13TowEncounter");
    expect(currentReplay).not.toContain("-v13.js");
    expect(currentReplay).not.toContain("verifyRetiredTowV13Session");
    expect(runtime).not.toContain("verifyRetiredTowV13Session");
  });
});
