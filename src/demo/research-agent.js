import { loadEnv } from "../config/env.js";
import { auditOutput } from "../verifier.js";

loadEnv();

const researchAgentOutput = {
  task: "Pre-delivery audit for a research agent writing about CROO",
  content:
    "CROO is building commerce infrastructure for AI agents. Its CAP protocol is intended to let agents discover, hire, and pay one another, while the Agent Store gives humans and agents a marketplace for paid callable services.",
  claims: [
    "CROO is building commerce infrastructure for AI agents.",
    "CAP is intended to let agents discover, hire, and pay one another.",
    "CROO Agent Store lists paid callable agent services."
  ],
  sources: [
    {
      url: "https://docs.croo.network",
      title: "CROO docs"
    },
    {
      url: "https://agent.croo.network",
      title: "CROO Agent Store"
    },
    {
      url: "https://dorahacks.io/hackathon/croo-hackathon/detail",
      title: "CROO Agent Hackathon"
    }
  ],
  riskContext: {
    domain: "research",
    isFinancial: false,
    isMedical: false,
    isLegal: false
  }
};

console.log("Research Agent: prepared buyer answer.");
console.log("Research Agent: hiring TrustRail for paid verification before delivery...");

const audit = await auditOutput(researchAgentOutput);

console.log(JSON.stringify(audit, null, 2));

const modelAdvice = audit.modelNotes?.note?.deliveryAdvice;

if (modelAdvice === "hold_for_review") {
  console.log("Research Agent: delivery held for source review based on TrustRail model notes.");
} else if (audit.verdict === "pass" || audit.verdict === "warning") {
  console.log("Research Agent: delivery allowed with TrustRail audit attached.");
} else {
  console.log("Research Agent: delivery blocked until issues are fixed.");
}
