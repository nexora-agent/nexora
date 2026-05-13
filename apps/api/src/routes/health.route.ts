import type { FastifyInstance } from "fastify";
import { mvpLoop, productSteps } from "@nexora/shared";
import { mantleSepolia } from "../config/mantle";

export async function healthRoute(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "nexora-api",
    network: mantleSepolia,
    story: productSteps,
    mvpLoop,
  }));
}
