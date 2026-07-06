import { loadEnv } from "./config/env.js";
import { createTrustRailServer } from "./server.js";

loadEnv();

const port = Number.parseInt(process.env.PORT || "8787", 10);
const server = createTrustRailServer();

server.listen(port, () => {
  console.log(`TrustRail listening on http://localhost:${port}`);
});
