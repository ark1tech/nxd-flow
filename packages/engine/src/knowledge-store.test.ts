import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeStore } from "./knowledge-store.js";

describe("KnowledgeStore", () => {
  it("dedupes matching facts and revalidates typed locators", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-knowledge-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { fastify: "5.0.0" } }));
    const store = new KnowledgeStore(join(dir, "knowledge.md"), dir);
    const fact = store.propose({
      subject: "fixture-framework",
      claim: "The fixture uses Fastify",
      locator: { kind: "file-symbol", locator: "package.json", expected: "fastify" },
      provenance: { file: "package.json", note: "package dependency" }
    });
    const same = store.propose({
      subject: "fixture-framework",
      claim: "The fixture uses Fastify",
      locator: { kind: "file-symbol", locator: "package.json", expected: "fastify" },
      provenance: { file: "package.json", note: "confirmed again" }
    });

    expect(same.id).toBe(fact.id);
    expect(store.revalidate(fact)).toBe("fresh");
    expect(store.coverageFor("Should we use Fastify middleware?").evidence).toContain("fixture-framework: The fixture uses Fastify");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: {} }));
    expect(store.revalidate(fact)).toBe("stale");
    expect(store.coverageFor("Should we use Fastify middleware?").evidence).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("marks contradictory claims as contested", () => {
    const dir = mkdtempSync(join(tmpdir(), "autopilot-knowledge-"));
    writeFileSync(join(dir, "auth.txt"), "jwt");
    const store = new KnowledgeStore(join(dir, "knowledge.md"), dir);
    store.propose({
      subject: "auth-strategy",
      claim: "Auth uses JWT",
      locator: { kind: "file-symbol", locator: "auth.txt", expected: "jwt" },
      provenance: { file: "auth.txt", note: "jwt marker" }
    });
    const contested = store.propose({
      subject: "auth-strategy",
      claim: "Auth uses sessions",
      locator: { kind: "file-symbol", locator: "auth.txt", expected: "session" },
      provenance: { file: "auth.txt", note: "session marker" }
    });
    expect(contested.status).toBe("contested");
    expect(store.revalidate(contested)).toBe("contested");
    rmSync(dir, { recursive: true, force: true });
  });
});
