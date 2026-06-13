import { describe, expect, it } from "vitest";
import { deriveFileOverlapEdges } from "./edge-deriver.js";

describe("EdgeDeriver", () => {
  it("derives edges from git-diff file overlap", () => {
    expect(
      deriveFileOverlapEdges([
        { decisionId: "a", files: ["src/auth.ts"] },
        { decisionId: "b", files: ["src/auth.ts", "src/routes.ts"] },
        { decisionId: "c", files: ["src/billing.ts"] }
      ])
    ).toContainEqual({ from: "a", to: "b", kind: "derived", evidence: "file-overlap:src/auth.ts" });
  });
});
