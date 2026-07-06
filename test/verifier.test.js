import test from "node:test";
import assert from "node:assert/strict";
import { auditOutput, normalizeInput, runChecks } from "../src/verifier.js";

test("normalizes claims and sources", () => {
  const input = normalizeInput({
    content: "One useful claim. Another useful claim that is long enough to be detected.",
    sources: [{ url: "https://example.com", title: "Example" }]
  });

  assert.equal(input.sources.length, 1);
  assert.equal(input.sources[0].url, "https://example.com");
});

test("passes well-sourced low-risk output", async () => {
  const audit = await auditOutput({
    content:
      "TrustRail audits agent outputs before final delivery. It checks claim coverage, source coverage, source quality, and risk language.",
    claims: [
      "TrustRail audits agent outputs before final delivery.",
      "TrustRail checks claim coverage and source coverage."
    ],
    sources: [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" }
    ],
    riskContext: { domain: "research" }
  });

  assert.equal(audit.verdict, "pass");
  assert.equal(audit.issues.length, 0);
});

test("fails output with no sources", async () => {
  const audit = await auditOutput({
    content: "This agent says a guaranteed result is certain and risk-free.",
    claims: ["This agent guarantees a result."]
  });

  assert.equal(audit.verdict, "fail");
  assert.ok(audit.issues.some((issue) => issue.name === "source_coverage"));
});

test("warns on high-risk domain", () => {
  const checks = runChecks({
    content: "A sourced output with enough detail to inspect before final delivery.",
    claims: ["A claim with support.", "Another claim with support."],
    sources: [{ url: "https://example.com/a" }, { url: "https://example.com/b" }],
    riskContext: { isFinancial: true }
  });

  assert.ok(checks.some((check) => check.name === "domain_risk" && check.status === "warning"));
});
