# TrustRail

TrustRail is a paid verification agent for agent commerce. Other agents call it before delivering work, pay through CROO/CAP, and receive a structured audit they can consume automatically.

The hackathon thesis is simple: if agents can hire agents, they also need trust dependencies. TrustRail is the audit layer an agent can call to check claims, sources, and delivery risk before it sends paid output to a buyer.

## What It Does

- Audits agent outputs, research reports, claims, and cited sources.
- Returns machine-readable verdicts: `pass`, `warning`, or `fail`.
- Scores evidence quality, citation coverage, contradiction risk, and action risk.
- Produces a corrected summary and follow-up checks for the calling agent.
- Exposes a CAP adapter using CROO's Node SDK package, `@croo-network/sdk`.

## Tracks

- Research & Intelligence Agents
- Data & Verification Agents

## Quick Start

```bash
cp .env.example .env
npm install
npm test
npm start
```

Then call the local agent:

```bash
curl -X POST http://localhost:8787/audit \
  -H "content-type: application/json" \
  -d "{\"task\":\"Verify this agent output\",\"content\":\"CROO lets agents discover, hire, and pay other agents on-chain.\",\"claims\":[\"CROO provides an Agent Store\",\"CAP supports paid callable agents\"],\"sources\":[{\"url\":\"https://docs.croo.network\",\"title\":\"CROO docs\"}]}"
```

Run the A2A demo:

```bash
npm run demo
```

## Claude Setup

TrustRail works without an API key by using deterministic local heuristics. Add a Claude key to enable model-backed audit notes:

```text
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
```

## CROO Setup

CROO account setup happens in the Agent Store, while the SDK handles runtime operations.

1. Create the TrustRail agent in [CROO Agent Store](https://agent.croo.network/).
2. Register a service such as `trustrail.audit`.
3. Issue an API key for the agent.
4. Add it to `.env`:

```text
CROO_SDK_KEY=croo_sk_...
CROO_AGENT_ID=...
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
```

Install the official Node SDK when you are ready for live CAP calls:

```bash
npm install @croo-network/sdk
```

Start TrustRail as a CROO provider:

```bash
npm run provider
```

By default the provider starts in `dry-run` mode, so it will connect and log incoming jobs without accepting or delivering them. Use this for a safe connection test:

```bash
npm run provider:smoke
```

To go live after your Agent Store service is ready:

```text
TRUSTRAIL_PROVIDER_MODE=live
```

In live mode, the provider listens for `NegotiationCreated`, accepts the job, waits for `OrderPaid`, audits the buyer's `requirements`, and delivers the JSON audit through `deliverOrder`.

## API

### `GET /health`

Returns service metadata and CAP listing readiness.

### `POST /audit`

Request:

```json
{
  "task": "Verify a research agent's output before delivery",
  "content": "The answer or report to audit.",
  "claims": ["Specific claim 1", "Specific claim 2"],
  "sources": [
    {
      "url": "https://example.com/source",
      "title": "Optional source title",
      "excerpt": "Optional excerpt used by the upstream agent"
    }
  ],
  "riskContext": {
    "domain": "research",
    "isFinancial": false,
    "isMedical": false,
    "isLegal": false
  }
}
```

Response:

```json
{
  "agent": "TrustRail",
  "verdict": "warning",
  "riskScore": 42,
  "confidence": 0.76,
  "checks": [],
  "issues": [],
  "correctedSummary": "A cautious summary the caller can safely return.",
  "nextActions": [],
  "cap": {
    "priceUsdc": "0.25",
    "settlementMode": "needs_agent_store_api_key",
    "receipt": null
  }
}
```

## CAP Integration

The current code keeps CROO/CAP inside [src/cap/adapter.js](src/cap/adapter.js). It dynamically loads `@croo-network/sdk` and initializes `AgentClient` when `CROO_SDK_KEY` or `CROO_API_KEY` is present.

See [docs/cap-integration.md](docs/cap-integration.md).

## Wallet

See [docs/wallet.md](docs/wallet.md) for the wallet setup checklist.

## Demo Story

1. A Research Agent prepares an answer for a buyer.
2. Before delivery, it hires TrustRail through CAP.
3. TrustRail audits the claims and sources.
4. The Research Agent only delivers if the audit is good enough, or it revises based on TrustRail's structured issues.

That proves the CROO-native loop: one paid agent buying a specialized paid service from another agent.
