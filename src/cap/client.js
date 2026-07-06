import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";

export function createCrooClient() {
  const sdkKey = process.env.CROO_SDK_KEY || process.env.CROO_API_KEY;

  if (!sdkKey) {
    throw new Error("Set CROO_API_KEY or CROO_SDK_KEY before starting the CROO provider.");
  }

  return {
    client: new AgentClient(
      {
        baseURL: process.env.CROO_API_URL || "https://api.croo.network",
        wsURL: process.env.CROO_WS_URL || "wss://api.croo.network/ws",
        rpcURL: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        logger: createRedactingLogger()
      },
      sdkKey
    ),
    DeliverableType,
    EventType
  };
}

function createRedactingLogger() {
  return {
    info: (...args) => console.info(...redactArgs(args)),
    warn: (...args) => console.warn(...redactArgs(args)),
    error: (...args) => console.error(...redactArgs(args)),
    debug: (...args) => console.debug(...redactArgs(args))
  };
}

function redactArgs(args) {
  return args.map((arg) => {
    if (typeof arg === "string") {
      return redactString(arg);
    }

    if (arg && typeof arg === "object") {
      return JSON.parse(redactString(JSON.stringify(arg)));
    }

    return arg;
  });
}

function redactString(value) {
  return value.replace(/croo_sk_[A-Za-z0-9_-]+/g, "croo_sk_[redacted]");
}
