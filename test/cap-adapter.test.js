import test from "node:test";
import assert from "node:assert/strict";
import { getCapListing, prepareCapContext, settleCapJob } from "../src/cap/adapter.js";

test("reports CROO SDK readiness when a key is configured", async () => {
  const previousKey = process.env.CROO_API_KEY;
  process.env.CROO_API_KEY = "croo_sk_test";

  const listing = getCapListing();
  const cap = await prepareCapContext({
    headers: {},
    payload: { content: "local audit" }
  });
  const settlement = await settleCapJob(cap.job, { verdict: "pass" });

  assert.equal(listing.sdk, "@croo-network/sdk");
  assert.equal(listing.sdkKeyConfigured, true);
  assert.equal(cap.public.settlementMode, "croo_sdk_ready_no_order");
  assert.equal(settlement.receipt.mode, "croo_sdk_ready_no_order");

  if (previousKey === undefined) {
    delete process.env.CROO_API_KEY;
  } else {
    process.env.CROO_API_KEY = previousKey;
  }
});
