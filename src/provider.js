import { loadEnv } from "./config/env.js";
import { createCrooClient } from "./cap/client.js";
import { auditOutput } from "./verifier.js";

loadEnv();

const { client, DeliverableType, EventType } = createCrooClient();
const smokeTest = process.argv.includes("--smoke-test") || process.env.TRUSTRAIL_PROVIDER_SMOKE_TEST === "true";
const liveMode = process.env.TRUSTRAIL_PROVIDER_MODE === "live";

console.log("TrustRail provider starting...");
console.log(`CROO API: ${process.env.CROO_API_URL || "https://api.croo.network"}`);
console.log(`CROO WS: ${process.env.CROO_WS_URL || "wss://api.croo.network/ws"}`);
console.log(`Provider mode: ${liveMode ? "live" : "dry-run"}`);

const stream = await client.connectWebSocket();

console.log("TrustRail provider connected. Waiting for paid verification jobs.");

if (smokeTest) {
  console.log("Smoke test connected successfully; closing without accepting jobs.");
  stream.close();
  process.exit(0);
}

stream.on(EventType.NegotiationCreated, async (event) => {
  await runSafely("accept negotiation", async () => {
    if (!event.negotiation_id) {
      throw new Error("Negotiation event did not include negotiation_id.");
    }

    if (!liveMode) {
      console.log(`Dry-run: would accept negotiation ${event.negotiation_id}.`);
      return;
    }

    const result = await client.acceptNegotiation(event.negotiation_id);
    console.log(`Accepted negotiation ${event.negotiation_id}; order ${result.order.orderId} created.`);
  });
});

stream.on(EventType.OrderPaid, async (event) => {
  await runSafely("deliver paid order", async () => {
    if (!event.order_id) {
      throw new Error("OrderPaid event did not include order_id.");
    }

    if (!liveMode) {
      console.log(`Dry-run: would audit and deliver paid order ${event.order_id}.`);
      return;
    }

    const order = await client.getOrder(event.order_id);
    const negotiation = await client.getNegotiation(order.negotiationId);
    console.log("Preparing audit payload", {
      orderId: event.order_id,
      negotiationId: order.negotiationId,
      requirementsLength: negotiation.requirements?.length || 0,
      metadataLength: negotiation.metadata?.length || 0
    });
    const payload = parseRequirements(firstNonEmpty(
      negotiation.requirements,
      negotiation.metadata,
      order.requirements,
      order.metadata
    ));
    const audit = await auditOutput(payload);

    const delivery = await client.deliverOrder(event.order_id, {
      deliverableType: DeliverableType.Text,
      deliverableText: JSON.stringify(audit)
    });

    console.log(`Delivered TrustRail audit for order ${event.order_id}; tx ${delivery.txHash}.`);
  });
});

stream.onAny((event) => {
  console.log(`CROO event: ${event.type}`);
});

process.on("SIGINT", () => {
  console.log("TrustRail provider stopping...");
  stream.close();
  process.exit(0);
});

export function parseRequirements(requirements) {
  if (!requirements) {
    return {
      task: "Audit paid CROO agent output",
      content: "",
      claims: [],
      sources: []
    };
  }

  try {
    const parsed = JSON.parse(requirements);
    return normalizeParsedRequirements(parsed);
  } catch {
    return {
      task: "Audit paid CROO agent output",
      content: requirements,
      claims: [],
      sources: []
    };
  }
}

function normalizeParsedRequirements(parsed) {
  if (typeof parsed === "string") {
    return parseRequirements(parsed);
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      task: "Audit paid CROO agent output",
      content: String(parsed),
      claims: [],
      sources: []
    };
  }

  const nested = firstNonEmpty(
    parsed.requirements,
    parsed.input,
    parsed.content,
    parsed.prompt,
    parsed.message,
    parsed.text
  );

  if (
    nested &&
    !parsed.claims &&
    !parsed.sources &&
    !parsed.content &&
    typeof nested === "string" &&
    nested.trim().startsWith("{")
  ) {
    return parseRequirements(nested);
  }

  return {
    task: parsed.task || "Audit paid CROO agent output",
    content: parsed.content || parsed.output || parsed.report || parsed.answer || nested || "",
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    riskContext: parsed.riskContext || parsed.risk_context || {}
  };
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) || "";
}

async function runSafely(label, action) {
  try {
    await action();
  } catch (error) {
    console.error(`Failed to ${label}: ${error.message}`);
  }
}
