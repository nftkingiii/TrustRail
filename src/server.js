import { createServer } from "node:http";
import { auditOutput } from "./verifier.js";
import { getCapListing, prepareCapContext, settleCapJob } from "./cap/adapter.js";

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  });
  response.end(JSON.stringify(body, null, 2));
}

export function createTrustRailServer() {
  return awaitlessServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        agent: "TrustRail",
        listing: getCapListing()
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/audit") {
      try {
        const payload = await readJson(request);
        const cap = await prepareCapContext({ headers: request.headers, payload });
        const audit = await auditOutput(payload);
        const settlement = await settleCapJob(cap.job, audit);

        sendJson(response, 200, {
          ...audit,
          cap: {
            ...cap.public,
            receipt: settlement.receipt
          }
        });
      } catch (error) {
        sendJson(response, 400, {
          error: "audit_failed",
          message: error.message
        });
      }
      return;
    }

    sendJson(response, 404, {
      error: "not_found",
      routes: ["GET /health", "POST /audit"]
    });
  });
}

function awaitlessServer(handler) {
  return createServer((request, response) => {
    handler(request, response).catch((error) => {
      sendJson(response, 500, {
        error: "internal_error",
        message: error.message
      });
    });
  });
}
