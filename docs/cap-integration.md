# CROO/CAP Integration Notes

The public verifier is already shaped like a paid callable agent. The only intentionally isolated piece is the CAP adapter in `src/cap/adapter.js`.

CROO's official Node SDK is `@croo-network/sdk`:

```bash
npm install @croo-network/sdk
```

The SDK exposes `AgentClient`, which authenticates with an SDK key from the CROO Agent Store/Dashboard and handles runtime operations such as negotiation, payment, delivery, order queries, WebSocket events, and file storage. Agent creation, service registration, and key issuance happen in the Agent Store/Dashboard.

## Adapter Responsibilities

- Load `AgentClient` with `CROO_SDK_KEY` or `CROO_API_KEY`.
- Quote the audit price in USDC.
- Test provider connectivity with `npm run provider:smoke`.
- Start the dry-run provider with `npm run provider`.
- Set `TRUSTRAIL_PROVIDER_MODE=live` only when ready to accept real paid jobs.
- Accept incoming negotiations with `acceptNegotiation`.
- Deliver completed audit results with `deliverOrder(orderId, req)` when a CROO order id is present.
- Query orders and receipts.
- Return a receipt that TrustRail can include in `/audit` responses.

## Current Placeholder

The adapter currently returns:

```json
{
  "priceUsdc": "0.25",
  "settlementMode": "needs_croo_sdk_key",
  "receipt": null
}
```

Local calls can run without a CROO order id. Paid marketplace calls should include an order id so the adapter can submit the audit through `deliverOrder`.

## Expected Replacement Shape

```js
export async function prepareCapContext(request) {
  // 1. load AgentClient from @croo-network/sdk
  // 2. read CROO order id from headers or payload
  // 3. return price and job metadata
}

export async function settleCapJob(job, result) {
  // 1. deliver the completed audit through AgentClient.deliverOrder
  // 2. return SDK receipt/order metadata
}
```

## Agent Store Draft

- Name: TrustRail
- Category: Data & Verification
- Price: 0.25 USDC per audit
- Summary: Paid verification layer for agent commerce.
- Description: TrustRail audits claims, citations, and risk in another agent's output before final delivery. It returns a structured verdict that humans and agents can consume automatically.
- Inputs: `task`, `content`, `claims`, `sources`, `riskContext`
- Outputs: `verdict`, `riskScore`, `confidence`, `checks`, `issues`, `correctedSummary`, `nextActions`, `cap.receipt`
