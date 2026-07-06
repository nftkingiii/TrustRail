import { askClaudeForAuditNotes } from "./claude.js";

const HIGH_RISK_DOMAINS = ["financial", "medical", "legal"];

export async function auditOutput(input) {
  const normalized = normalizeInput(input);
  const checks = runChecks(normalized);
  const riskScore = calculateRiskScore(checks, normalized);
  const verdict = chooseVerdict(riskScore, checks);
  const confidence = calculateConfidence(checks, normalized);
  const claudeNotes = await askClaudeForAuditNotes(normalized, checks).catch((error) => ({
    available: false,
    note: `Claude audit notes unavailable: ${error.message}`
  }));

  return {
    agent: "TrustRail",
    version: "0.1.0",
    verdict,
    riskScore,
    confidence,
    checks,
    issues: checks.filter((check) => check.status !== "pass"),
    correctedSummary: buildCorrectedSummary(normalized, checks, verdict),
    nextActions: buildNextActions(checks, normalized),
    modelNotes: claudeNotes,
    auditedAt: new Date().toISOString()
  };
}

export function normalizeInput(input = {}) {
  const content = stringOrEmpty(input.content);
  const claims = Array.isArray(input.claims)
    ? input.claims.map(stringOrEmpty).filter(Boolean)
    : extractLikelyClaims(content);
  const sources = Array.isArray(input.sources)
    ? input.sources.map(normalizeSource).filter((source) => source.url || source.title || source.excerpt)
    : [];

  return {
    task: stringOrEmpty(input.task) || "Audit agent output",
    content,
    claims,
    sources,
    riskContext: input.riskContext || {}
  };
}

export function runChecks(input) {
  return [
    checkHasContent(input),
    checkClaimCoverage(input),
    checkSourceCoverage(input),
    checkSourceQuality(input),
    checkHighRiskDomain(input),
    checkHedgingAndUncertainty(input)
  ];
}

function checkHasContent(input) {
  if (input.content.length >= 80) {
    return pass("content_presence", "Output has enough substance to audit.");
  }

  return warn("content_presence", "Output is short, so the audit has limited evidence to inspect.");
}

function checkClaimCoverage(input) {
  if (input.claims.length >= 2) {
    return pass("claim_coverage", `${input.claims.length} explicit claims supplied.`);
  }

  if (input.claims.length === 1) {
    return warn("claim_coverage", "Only one explicit claim supplied.");
  }

  return fail("claim_coverage", "No explicit claims supplied or detected.");
}

function checkSourceCoverage(input) {
  if (input.sources.length >= input.claims.length && input.claims.length > 0) {
    return pass("source_coverage", "Source count covers the supplied claims.");
  }

  if (input.sources.length > 0) {
    return warn("source_coverage", "Some claims may not have direct source coverage.");
  }

  return fail("source_coverage", "No sources supplied for verification.");
}

function checkSourceQuality(input) {
  const reachableLookingSources = input.sources.filter((source) => /^https?:\/\//i.test(source.url));

  if (reachableLookingSources.length === input.sources.length && input.sources.length > 0) {
    return pass("source_quality", "Sources use reachable-looking HTTP URLs.");
  }

  if (reachableLookingSources.length > 0) {
    return warn("source_quality", "Some sources are missing valid HTTP URLs.");
  }

  return fail("source_quality", "No source has a valid HTTP URL.");
}

function checkHighRiskDomain(input) {
  const riskContext = input.riskContext || {};
  const flaggedDomains = HIGH_RISK_DOMAINS.filter((domain) => {
    const directFlag = riskContext[`is${capitalize(domain)}`] === true;
    return directFlag || String(riskContext.domain || "").toLowerCase().includes(domain);
  });

  if (flaggedDomains.length === 0) {
    return pass("domain_risk", "No high-risk domain declared.");
  }

  return warn("domain_risk", `High-risk domain declared: ${flaggedDomains.join(", ")}.`);
}

function checkHedgingAndUncertainty(input) {
  const text = input.content.toLowerCase();
  const hasAbsoluteLanguage = ["guaranteed", "always", "never", "risk-free", "certain"].some((word) =>
    text.includes(word)
  );

  if (!hasAbsoluteLanguage) {
    return pass("uncertainty_language", "No obvious absolute-risk language detected.");
  }

  return warn("uncertainty_language", "Output uses absolute language that may need qualification.");
}

function calculateRiskScore(checks, input) {
  const base = checks.reduce((score, check) => {
    if (check.status === "fail") return score + 24;
    if (check.status === "warning") return score + 11;
    return score;
  }, 0);

  const highRiskPenalty = checkHighRiskDomain(input).status === "warning" ? 10 : 0;
  return Math.min(100, base + highRiskPenalty);
}

function chooseVerdict(riskScore, checks) {
  if (checks.some((check) => check.status === "fail") || riskScore >= 70) {
    return "fail";
  }

  if (checks.some((check) => check.status === "warning") || riskScore >= 30) {
    return "warning";
  }

  return "pass";
}

function calculateConfidence(checks, input) {
  const passCount = checks.filter((check) => check.status === "pass").length;
  const sourceBonus = Math.min(0.2, input.sources.length * 0.04);
  const claimBonus = Math.min(0.15, input.claims.length * 0.03);
  const base = passCount / checks.length;
  return Number(Math.min(0.95, base * 0.7 + sourceBonus + claimBonus).toFixed(2));
}

function buildCorrectedSummary(input, checks, verdict) {
  const issueNames = checks.filter((check) => check.status !== "pass").map((check) => check.name);

  if (verdict === "pass") {
    return `TrustRail found the output deliverable with current evidence. It includes ${input.claims.length} claim(s) and ${input.sources.length} source(s).`;
  }

  return `TrustRail recommends revising before delivery. Main audit concerns: ${issueNames.join(", ")}. Add direct sources for each claim, qualify uncertain statements, and rerun verification.`;
}

function buildNextActions(checks, input) {
  const actions = [];

  if (checks.some((check) => check.name === "source_coverage" && check.status !== "pass")) {
    actions.push("Attach one direct source per claim.");
  }

  if (checks.some((check) => check.name === "source_quality" && check.status !== "pass")) {
    actions.push("Replace vague or missing source references with public HTTP URLs.");
  }

  if (checks.some((check) => check.name === "domain_risk" && check.status !== "pass")) {
    actions.push("Add a high-risk domain disclaimer and require human confirmation before execution.");
  }

  if (input.claims.length === 0) {
    actions.push("Extract claims explicitly before requesting a paid audit.");
  }

  return actions.length > 0 ? actions : ["Deliver output or request a deeper audit for critical use cases."];
}

function extractLikelyClaims(content) {
  return content
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30)
    .slice(0, 5);
}

function normalizeSource(source = {}) {
  return {
    url: stringOrEmpty(source.url),
    title: stringOrEmpty(source.title),
    excerpt: stringOrEmpty(source.excerpt)
  };
}

function pass(name, message) {
  return { name, status: "pass", message };
}

function warn(name, message) {
  return { name, status: "warning", message };
}

function fail(name, message) {
  return { name, status: "fail", message };
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
