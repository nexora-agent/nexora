import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT ?? 8787);
const sharedSecret = process.env.LOCAL_HARNESS_SECRET;

function verifySignature(request, rawBody) {
  if (!sharedSecret) {
    return true;
  }

  const runId = request.headers["x-nexora-run-id"];
  const timestamp = request.headers["x-nexora-timestamp"];
  const signatureHeader = request.headers["x-nexora-signature"];

  if (!runId || !timestamp || !signatureHeader) {
    return false;
  }

  const signature = String(signatureHeader).replace(/^sha256=/, "");
  const expected = createHmac("sha256", sharedSecret)
    .update(`${runId}.${timestamp}.${rawBody}`)
    .digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

function chooseVault(payload) {
  const vaults = payload.benchmarkContext?.vaults ?? [];
  const safeVault =
    vaults.find((vault) => vault.name === "NexoraSafeVault") ?? vaults[0];
  const rejectedVaults = vaults
    .filter((vault) => vault.name !== safeVault.name)
    .map((vault) => vault.name);

  return {
    confidence: 0.91,
    rejectedVaults,
    reasoning:
      "NexoraSafeVault best matches a conservative policy because it has low volatility, high liquidity, verified benchmark status, and no owner risk. NexoraVolatileVault is rejected because medium/high volatility is not appropriate for capital preservation. NexoraRiskyVault is rejected because high advertised APR is not enough to offset low liquidity, high volatility, upgradeable strategy risk, and opaque yield source.",
    selectedVault: safeVault.name,
    usedTools: payload.toolManifest?.allowedToolNames?.slice(0, 2) ?? [],
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/nexora/run") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  try {
    let rawBody = "";
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    await new Promise((resolve, reject) => {
      request.on("end", resolve);
      request.on("error", reject);
    });

    if (!verifySignature(request, rawBody)) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_signature" }));
      return;
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const decision = chooseVault(payload);

    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    response.end(JSON.stringify(decision, null, 2));
  } catch (error) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : "bad_request",
    }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nexora local harness example listening on http://127.0.0.1:${port}/nexora/run`);
});
