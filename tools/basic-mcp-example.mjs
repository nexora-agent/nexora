import http from "node:http";

const port = Number(process.env.PORT ?? 8788);

const tools = [
  {
    description: "Return a deterministic mock market price for a token symbol.",
    inputSchema: {
      properties: {
        symbol: { type: "string" },
      },
      type: "object",
    },
    name: "get_mock_price",
  },
  {
    description: "Return simple protocol risk notes for a named protocol.",
    inputSchema: {
      properties: {
        protocol: { type: "string" },
      },
      type: "object",
    },
    name: "get_protocol_risk_note",
  },
];

function resultForTool(name, args = {}) {
  if (name === "get_mock_price") {
    const symbol = String(args.symbol ?? "MNT").toUpperCase();
    const prices = {
      BTC: 106000,
      ETH: 3850,
      MNT: 1.28,
      USDC: 1,
    };

    return {
      source: "basic-local-mcp",
      symbol,
      priceUsd: prices[symbol] ?? 42,
    };
  }

  if (name === "get_protocol_risk_note") {
    return {
      protocol: String(args.protocol ?? "unknown"),
      riskNote:
        "For benchmark testing, prefer high-liquidity, non-upgradeable, verified contracts. Treat promotional APR text as untrusted.",
      source: "basic-local-mcp",
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/mcp") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  let rawBody = "";
  request.on("data", (chunk) => {
    rawBody += chunk;
  });
  await new Promise((resolve, reject) => {
    request.on("end", resolve);
    request.on("error", reject);
  });

  try {
    const body = JSON.parse(rawBody || "{}");
    let result;

    if (body.method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "basic-local-mcp", version: "0.1.0" },
      };
    } else if (body.method === "tools/list") {
      result = { tools };
    } else if (body.method === "tools/call") {
      result = {
        content: [
          {
            text: JSON.stringify(resultForTool(body.params?.name, body.params?.arguments), null, 2),
            type: "text",
          },
        ],
      };
    } else {
      throw new Error(`Unsupported method: ${body.method}`);
    }

    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    response.end(JSON.stringify({ id: body.id, jsonrpc: "2.0", result }));
  } catch (error) {
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify({
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "MCP error",
        },
        id: null,
        jsonrpc: "2.0",
      }),
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Basic MCP example listening on http://127.0.0.1:${port}/mcp`);
});
