import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { auditOutput } from "./verifier.js";
import { getCapListing, prepareCapContext, settleCapJob } from "./cap/adapter.js";

const publicDirectory = join(process.cwd(), "public");
const publicTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg"
};

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

    if (request.method === "GET" && ["/", "/index.html", "/styles.css", "/trustrail-mark.jpg"].includes(url.pathname)) {
      const assetName = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      try {
        const asset = await readFile(join(publicDirectory, assetName));
        response.writeHead(200, {
          "content-type": publicTypes[extname(assetName)] || "application/octet-stream",
          "cache-control": assetName === "index.html" ? "no-cache" : "public, max-age=31536000, immutable"
        });
        response.end(asset);
      } catch {
        sendJson(response, 404, { error: "site_asset_not_found" });
      }
      return;
    }

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
