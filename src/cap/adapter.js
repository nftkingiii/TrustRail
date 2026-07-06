import { createCrooClient } from "./client.js";

const DEFAULT_PRICE_USDC = "0.25";
let cachedSdk;

export function getCapListing() {
  const sdkKey = getSdkKey();

  return {
    name: "TrustRail",
    agentId: process.env.CROO_AGENT_ID || "trustrail.local",
    sdk: "@croo-network/sdk",
    sdkKeyConfigured: Boolean(sdkKey),
    walletAddress: process.env.CROO_WALLET_ADDRESS || null,
    apiBaseUrl: process.env.CROO_API_URL || "https://api.croo.network",
    priceUsdc: process.env.TRUSTRAIL_PRICE_USDC || DEFAULT_PRICE_USDC,
    capabilities: [
      "claim-verification",
      "citation-audit",
      "agent-output-risk-scoring",
      "a2a-pre-delivery-review"
    ],
    status: sdkKey ? "croo_sdk_configured" : "needs_croo_sdk_key"
  };
}

export async function prepareCapContext({ headers, payload }) {
  const sdk = await getCrooSdk();
  const orderId = headers["x-croo-order-id"] || headers["x-croo-orderid"] || payload.orderId || null;
  const jobId = headers["x-croo-job-id"] || orderId || `local-${Date.now()}`;

  return {
    job: {
      id: jobId,
      orderId,
      caller: headers["x-croo-caller-agent"] || "local-demo-agent",
      payload,
      sdk
    },
    public: {
      priceUsdc: process.env.TRUSTRAIL_PRICE_USDC || DEFAULT_PRICE_USDC,
      settlementMode: sdk
        ? orderId
          ? "croo_sdk_order_delivery"
          : "croo_sdk_ready_no_order"
        : "needs_croo_sdk_key"
    }
  };
}

export async function settleCapJob(job, result) {
  if (job.sdk?.client && job.orderId) {
    const delivery = await job.sdk.client.deliverOrder(job.orderId, {
      deliverableType: job.sdk.DeliverableType?.Text || "text",
      deliverableText: JSON.stringify(result)
    });

    return {
      receipt: {
        mode: "croo_sdk_agent_client",
        jobId: job.id,
        orderId: job.orderId,
        delivery
      },
      result
    };
  }

  return {
    receipt: getSdkKey()
      ? {
          mode: "croo_sdk_ready_no_order",
          jobId: job.id,
          note: "AgentClient is configured. Provide a CROO order id to deliver through deliverOrder."
        }
      : null,
    result
  };
}

async function getCrooSdk() {
  const sdkKey = getSdkKey();

  if (!sdkKey) {
    return null;
  }

  if (cachedSdk) {
    return cachedSdk;
  }

  try {
    cachedSdk = createCrooClient();
    return cachedSdk;
  } catch (error) {
    throw new Error(`CROO SDK unavailable. Run npm install @croo-network/sdk. ${error.message}`);
  }
}

function getSdkKey() {
  return process.env.CROO_SDK_KEY || process.env.CROO_API_KEY || "";
}
